import type { Polygon } from '@ue-too/dynamics';
import type { Point } from '@ue-too/math';

import type { CoreAttributes } from './attributes';
import { F_N_MAX, F_T_MAX } from './attributes';
import { computeCruiseForce } from './cruise';
import type { RaceWorld } from './race-world';
import type { TrackFrame } from './track-navigator';
import { C_DRAG, type Horse, type InputState, NORMAL_DAMP } from './types';

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };

/**
 * Project world-space velocity onto track-relative components.
 */
export function projectVelocity(
    worldVel: Point,
    frame: TrackFrame
): { tangentialVel: number; normalVel: number } {
    return {
        tangentialVel:
            worldVel.x * frame.tangential.x + worldVel.y * frame.tangential.y,
        normalVel: worldVel.x * frame.normal.x + worldVel.y * frame.normal.y,
    };
}

/**
 * Compute track-relative accelerations for a single horse.
 *
 * Tangential: cruise + agent input − drag − slope gravity, capped at maxSpeed.
 * Normal: centripetal (−v²/r) + NORMAL_DAMP + agent steering − drag.
 *
 * @returns Tuple `[tangentialAccel, normalAccel]` in m/s².
 */
export function computeAccelerations(
    tangentialVel: number,
    normalVel: number,
    attrs: CoreAttributes,
    input: InputState,
    frame: TrackFrame
): [number, number] {
    const clampedTan = Math.max(-1, Math.min(1, input.tangential));
    const clampedNor = Math.max(-1, Math.min(1, input.normal));

    // --- Tangential ---
    let a_t = computeCruiseForce(tangentialVel, attrs.cruiseSpeed);
    a_t += clampedTan * F_T_MAX * attrs.forwardAccel;
    a_t -= C_DRAG * tangentialVel;
    // Slope gravity: uphill (slope > 0) decelerates, downhill accelerates
    a_t -= 9.81 * frame.slope;
    if (tangentialVel >= attrs.maxSpeed && a_t > 0) {
        a_t = 0;
    }

    // --- Normal ---
    let a_n = 0;
    // Centripetal: -v²/r toward curve center (negative normal direction)
    if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-3) {
        a_n -= (tangentialVel * tangentialVel) / frame.turnRadius;
    }
    // Lateral damping
    a_n -= NORMAL_DAMP * normalVel;
    // Steering
    a_n += clampedNor * F_N_MAX * attrs.turnAccel;
    // Drag on normal component
    a_n -= C_DRAG * normalVel;

    return [a_t, a_n];
}

/**
 * Compute track-relative forces and apply to the horse's dynamics body.
 * Sets body orientation to track tangent and zeroes angular velocity.
 */
function applyForcesToBody(
    horse: Horse,
    body: Polygon,
    attrs: CoreAttributes,
    input: InputState
): void {
    const frame = horse.navigator.getTrackFrame(horse.pos);
    const { tangentialVel, normalVel } = projectVelocity(
        body.linearVelocity,
        frame
    );
    const [a_t, a_n] = computeAccelerations(
        tangentialVel,
        normalVel,
        attrs,
        input,
        frame
    );

    const mass = attrs.weight;
    body.applyForce({
        x: (a_t * frame.tangential.x + a_n * frame.normal.x) * mass,
        y: (a_t * frame.tangential.y + a_n * frame.normal.y) * mass,
    });

    // Lock orientation to track tangent — no angular dynamics
    body.setOrientationAngle(
        Math.atan2(frame.tangential.y, frame.tangential.x)
    );
    body.angularVelocity = 0;
}

/**
 * Read back position/velocity from the dynamics body into horse state.
 * Updates navigator segment tracking, progress, and track-relative velocities.
 */
function syncFromBody(horse: Horse, body: Polygon): void {
    horse.pos.x = body.center.x;
    horse.pos.y = body.center.y;

    horse.navigator.updateSegment(horse.pos);
    horse.trackProgress = horse.navigator.computeProgress(horse.pos);

    const frame = horse.navigator.getTrackFrame(horse.pos);
    const projected = projectVelocity(body.linearVelocity, frame);
    horse.tangentialVel = projected.tangentialVel;
    horse.normalVel = projected.normalVel;
}

/**
 * Run physics substeps for all horses using the dynamics world.
 *
 * Per substep:
 * 1. Compute + apply forces for each horse (finished horses get velocity zeroed)
 * 2. `world.step(dt)` — dynamics engine integrates + resolves collisions
 * 3. Sync position/velocity from bodies back to horse state
 */
export function stepPhysics(
    horses: Horse[],
    inputs: Map<number, InputState>,
    raceWorld: RaceWorld,
    substeps: number,
    dt: number
): void {
    // Invariant: horse.pos mirrors body.center at the start of each apply pass.
    // spawnHorses sets the initial pos, addHorse copies it to the body.
    // syncFromBody writes body.center back to horse.pos at the end of each substep.
    for (let s = 0; s < substeps; s++) {
        for (const h of horses) {
            const body = raceWorld.getHorseBody(h.id);
            if (h.finished) {
                body.linearVelocity = { x: 0, y: 0 };
                continue;
            }
            applyForcesToBody(
                h,
                body,
                h.effectiveAttributes,
                inputs.get(h.id) ?? ZERO_INPUT
            );
        }

        raceWorld.step(dt);

        for (const h of horses) {
            if (h.finished) continue;
            syncFromBody(h, raceWorld.getHorseBody(h.id));
        }
    }
}
