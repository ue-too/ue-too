import type { Point } from '@ue-too/math';
import type { TrackFrame, TrackNavigator } from '../track-navigator';

import { computeCruiseForce } from './cruise';
import {
    C_DRAG,
    F_N_MAX,
    F_T_MAX,
    TARGET_CRUISE,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
} from './types';

/**
 * Signed lateral displacement from the centerline, in meters.
 * Positive = outside (toward outer rail); negative = inside (toward inner rail).
 *
 * On curves this is `turnRadius - targetRadius` (how far from the horse's
 * entry radius it has drifted). On straights this is the projection of
 * `(pos - segment.startPoint)` onto the segment's outward normal.
 */
function lateralDisplacement(
    frame: TrackFrame,
    pos: Point,
    navigator: TrackNavigator,
): number {
    const seg = navigator.segment;
    if (seg.tracktype === 'CURVE') {
        // TS narrows seg to CurveSegment via the tracktype discriminator.
        const toHorseX = pos.x - seg.center.x;
        const toHorseY = pos.y - seg.center.y;
        const currentRadius = Math.sqrt(toHorseX * toHorseX + toHorseY * toHorseY);
        const target = Number.isFinite(frame.targetRadius)
            ? frame.targetRadius
            : seg.radius;
        return currentRadius - target;
    }
    // Straight segment.
    const offX = pos.x - seg.startPoint.x;
    const offY = pos.y - seg.startPoint.y;
    return offX * frame.normal.x + offY * frame.normal.y;
}

/**
 * Advance every horse by one physics step. Mutates `horses` in place.
 *
 * Force model: F_total = F_cruise + F_player - F_drag, decomposed into
 * tangential + normal components in the horse's current track frame.
 * Forward Euler integration for velocity and position.
 */
export function stepPhysics(
    horses: Horse[],
    input: InputState,
    playerHorseId: number | null,
    dt: number,
): void {
    for (const h of horses) {
        if (h.finished) continue;

        // 1. Forces
        let F_t = computeCruiseForce(h.tangentialVel, TARGET_CRUISE);
        let F_n = 0;
        if (h.id === playerHorseId) {
            F_t += input.tangential * F_T_MAX;
            F_n += input.normal * F_N_MAX;
        }

        // 2. Drag
        F_t -= C_DRAG * h.tangentialVel;
        F_n -= C_DRAG * h.normalVel;

        // 3. Integrate velocity
        h.tangentialVel += F_t * dt;
        h.normalVel += F_n * dt;

        // 4. Integrate position using the horse's current track frame
        const frame = h.navigator.getTrackFrame(h.pos);
        h.pos.x += (frame.tangential.x * h.tangentialVel + frame.normal.x * h.normalVel) * dt;
        h.pos.y += (frame.tangential.y * h.tangentialVel + frame.normal.y * h.normalVel) * dt;

        // 5. Segment advance + progress refresh
        h.navigator.updateSegment(h.pos);
        h.trackProgress = h.navigator.computeProgress(h.pos);

        // 6. Rail clamp (soft wall). Re-fetch the frame after updateSegment in
        // case the horse crossed a segment boundary this tick.
        const postFrame = h.navigator.getTrackFrame(h.pos);
        const disp = lateralDisplacement(postFrame, h.pos, h.navigator);
        if (Math.abs(disp) > TRACK_HALF_WIDTH) {
            h.normalVel = 0;
            const excess = disp - Math.sign(disp) * TRACK_HALF_WIDTH;
            h.pos.x -= postFrame.normal.x * excess;
            h.pos.y -= postFrame.normal.y * excess;
        }
    }
}
