import type { Point } from '@ue-too/math';
import type { BCurve } from '@ue-too/curve';
import type { SpineEntry } from './track-aligned-platform-types';

// ---------------------------------------------------------------------------
// Internal minimal types for validation lookups
// ---------------------------------------------------------------------------

type SegmentLookup = { t0Joint: number; t1Joint: number };
type JointLookup = { connections: Map<number, number> };

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ValidateSpineOk = { valid: true };
export type ValidateSpineFail = { valid: false; error: string };
export type ValidateSpineResult = ValidateSpineOk | ValidateSpineFail;

// ---------------------------------------------------------------------------
// validateSpine
// ---------------------------------------------------------------------------

/**
 * Validates that the spine entries form a consecutive, non-branching path.
 *
 * @param spine - Array of spine entries to validate.
 * @param getSegment - Lookup for track segment metadata.
 * @param getJoint - Lookup for track joint metadata.
 * @returns `{ valid: true }` or `{ valid: false, error: string }`.
 */
export function validateSpine(
    spine: SpineEntry[],
    getSegment: (id: number) => SegmentLookup,
    getJoint: (id: number) => JointLookup,
): ValidateSpineResult {
    if (spine.length === 0) {
        return { valid: false, error: 'Spine must contain at least one segment.' };
    }

    for (let i = 0; i < spine.length - 1; i++) {
        const segA = getSegment(spine[i].trackSegment);
        const segB = getSegment(spine[i + 1].trackSegment);

        // Find shared joint between segA and segB
        const aJoints = [segA.t0Joint, segA.t1Joint];
        const bJoints = new Set([segB.t0Joint, segB.t1Joint]);
        const sharedJointId = aJoints.find((j) => bJoints.has(j));

        if (sharedJointId === undefined) {
            return {
                valid: false,
                error: `Segments ${spine[i].trackSegment} and ${spine[i + 1].trackSegment} are not adjacent (no shared joint).`,
            };
        }

        const joint = getJoint(sharedJointId);
        if (joint.connections.size > 2) {
            return {
                valid: false,
                error: `Joint ${sharedJointId} is a branching junction (${joint.connections.size} connections). Spines cannot pass through turnouts.`,
            };
        }
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// sampleSpineEdge
// ---------------------------------------------------------------------------

/**
 * Samples an offset edge polyline along the spine.
 *
 * For each spine entry the curve is sampled from `tStart` to `tEnd` in
 * `stepsPerSegment` steps. At each sample the perpendicular normal is
 * computed and multiplied by `offset` in the direction determined by
 * `entry.side`.
 *
 * @param spine - One or more spine entries to walk.
 * @param offset - Lateral distance from the curve (world units).
 * @param getCurve - Lookup that returns the `BCurve` for a segment id.
 * @param stepsPerSegment - Number of steps per entry. Defaults to
 *   `Math.max(2, Math.ceil(curve.fullLength / 2))`.
 * @returns Array of offset `Point` values forming the edge polyline.
 */
export function sampleSpineEdge(
    spine: SpineEntry[],
    offset: number,
    getCurve: (segmentId: number) => BCurve,
    stepsPerSegment?: number,
): Point[] {
    const points: Point[] = [];

    for (const entry of spine) {
        const curve = getCurve(entry.trackSegment);
        const steps =
            stepsPerSegment !== undefined
                ? stepsPerSegment
                : Math.max(2, Math.ceil(curve.fullLength / 2));

        const { tStart, tEnd, side } = entry;
        const tRange = tEnd - tStart;

        for (let s = 0; s <= steps; s++) {
            const t = tStart + (s / steps) * tRange;
            const pos = curve.get(t);
            const d = curve.derivative(t);
            const mag = Math.sqrt(d.x * d.x + d.y * d.y);

            if (mag < 1e-12) {
                // Degenerate tangent — just emit the curve point with no offset
                points.push({ x: pos.x, y: pos.y });
                continue;
            }

            const nx = (-d.y / mag) * side;
            const ny = (d.x / mag) * side;

            points.push({
                x: pos.x + nx * offset,
                y: pos.y + ny * offset,
            });
        }
    }

    return points;
}

// ---------------------------------------------------------------------------
// computeAnchorPoint
// ---------------------------------------------------------------------------

/**
 * Computes a single offset point at one endpoint of a spine entry.
 *
 * @param entry - The spine entry.
 * @param end - `'start'` uses `tStart`; `'end'` uses `tEnd`.
 * @param offset - Lateral distance from the curve (world units).
 * @param getCurve - Lookup that returns the `BCurve` for a segment id.
 * @returns The offset `Point`.
 */
export function computeAnchorPoint(
    entry: SpineEntry,
    end: 'start' | 'end',
    offset: number,
    getCurve: (segmentId: number) => BCurve,
): Point {
    const curve = getCurve(entry.trackSegment);
    const t = end === 'start' ? entry.tStart : entry.tEnd;
    const pos = curve.get(t);
    const d = curve.derivative(t);
    const mag = Math.sqrt(d.x * d.x + d.y * d.y);

    if (mag < 1e-12) {
        return { x: pos.x, y: pos.y };
    }

    const { side } = entry;
    const nx = (-d.y / mag) * side;
    const ny = (d.x / mag) * side;

    return {
        x: pos.x + nx * offset,
        y: pos.y + ny * offset,
    };
}
