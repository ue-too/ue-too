import type { Point } from '@ue-too/math';
import type { TrackFrame, TrackNavigator } from './track-navigator';
import type { CoreAttributes } from './attributes';
import { F_T_MAX, F_N_MAX } from './attributes';

import { computeCruiseForce } from './cruise';
import {
    C_DRAG,
    NORMAL_DAMP,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
} from './types';

/**
 * Project world-space velocity onto track-relative components.
 */
export function projectVelocity(
    worldVel: Point,
    frame: TrackFrame,
): { tangentialVel: number; normalVel: number } {
    return {
        tangentialVel:
            worldVel.x * frame.tangential.x + worldVel.y * frame.tangential.y,
        normalVel:
            worldVel.x * frame.normal.x + worldVel.y * frame.normal.y,
    };
}

/**
 * Compute track-relative accelerations for a single horse.
 *
 * Tangential: cruise + player input − drag, capped at maxSpeed.
 * Normal: centripetal (−v²/r) + NORMAL_DAMP + player steering − drag.
 *
 * @returns Tuple `[tangentialAccel, normalAccel]` in m/s².
 */
export function computeAccelerations(
    tangentialVel: number,
    normalVel: number,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
    horseId: number,
    frame: TrackFrame,
): [number, number] {
    // --- Tangential ---
    let a_t = computeCruiseForce(tangentialVel, attrs.cruiseSpeed);
    if (horseId === playerHorseId) {
        a_t += input.tangential * F_T_MAX * attrs.forwardAccel;
    }
    a_t -= C_DRAG * tangentialVel;
    if (tangentialVel >= attrs.maxSpeed && a_t > 0) {
        a_t = 0;
    }

    // --- Normal ---
    let a_n = 0;
    if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-3) {
        a_n -= (tangentialVel * tangentialVel) / frame.turnRadius;
    }
    a_n -= NORMAL_DAMP * normalVel;
    if (horseId === playerHorseId) {
        a_n += input.normal * F_N_MAX * attrs.turnAccel;
    }
    a_n -= C_DRAG * normalVel;

    return [a_t, a_n];
}

/**
 * Signed lateral displacement from the centerline, in meters.
 * Positive = outside (toward outer rail); negative = inside (toward inner rail).
 */
function lateralDisplacement(
    frame: TrackFrame,
    pos: Point,
    navigator: TrackNavigator,
): number {
    const seg = navigator.segment;
    if (seg.tracktype === 'CURVE') {
        const toHorseX = pos.x - seg.center.x;
        const toHorseY = pos.y - seg.center.y;
        const currentRadius = Math.sqrt(toHorseX * toHorseX + toHorseY * toHorseY);
        const target = Number.isFinite(frame.targetRadius)
            ? frame.targetRadius
            : seg.radius;
        return currentRadius - target;
    }
    const offX = pos.x - seg.startPoint.x;
    const offY = pos.y - seg.startPoint.y;
    return offX * frame.normal.x + offY * frame.normal.y;
}

/**
 * Advance a single horse by one physics substep. Mutates horse in place.
 *
 * Force model per horse: F_total = F_cruise + F_player - F_drag, using
 * per-horse effective attributes for cruise speed, force caps, and max speed.
 */
export function stepPhysicsSingle(
    h: Horse,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
    dt: number,
): void {
    if (h.finished) return;

    // 1. Forces — cruise toward per-horse cruise speed
    let F_t = computeCruiseForce(h.tangentialVel, attrs.cruiseSpeed);
    let F_n = 0;
    if (h.id === playerHorseId) {
        F_t += input.tangential * F_T_MAX * attrs.forwardAccel;
        F_n += input.normal * F_N_MAX * attrs.turnAccel;
    }

    // 2. Drag
    F_t -= C_DRAG * h.tangentialVel;
    F_n -= C_DRAG * h.normalVel;

    // 3. Integrate velocity
    h.tangentialVel += F_t * dt;
    h.normalVel += F_n * dt;

    // 4. Max speed cap
    if (h.tangentialVel > attrs.maxSpeed) {
        h.tangentialVel = attrs.maxSpeed;
    }

    // 5. Integrate position using the horse's current track frame
    const frame = h.navigator.getTrackFrame(h.pos);
    h.pos.x += (frame.tangential.x * h.tangentialVel + frame.normal.x * h.normalVel) * dt;
    h.pos.y += (frame.tangential.y * h.tangentialVel + frame.normal.y * h.normalVel) * dt;

    // 6. Segment advance + progress refresh
    h.navigator.updateSegment(h.pos);
    h.trackProgress = h.navigator.computeProgress(h.pos);

    // 7. Rail clamp (soft wall)
    const postFrame = h.navigator.getTrackFrame(h.pos);
    const disp = lateralDisplacement(postFrame, h.pos, h.navigator);
    if (Math.abs(disp) > TRACK_HALF_WIDTH) {
        h.normalVel = 0;
        const excess = disp - Math.sign(disp) * TRACK_HALF_WIDTH;
        h.pos.x -= postFrame.normal.x * excess;
        h.pos.y -= postFrame.normal.y * excess;
    }
}

/**
 * Run physics substeps for all horses in one game tick.
 */
export function stepPhysics(
    horses: Horse[],
    input: InputState,
    playerHorseId: number | null,
    substeps: number,
    dt: number,
): void {
    for (let s = 0; s < substeps; s++) {
        for (const h of horses) {
            stepPhysicsSingle(h, h.effectiveAttributes, input, playerHorseId, dt);
        }
    }
}
