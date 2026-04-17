import { Point, PointCal } from '@ue-too/math';

import type { CurveSegment, TrackSegment } from './track-types';

/**
 * Frame of reference at a point on the track.
 *
 * @remarks
 * `tangential` points in the direction of travel.
 * `normal` points outward from the track center (away from curve center on
 * curves, perpendicular-left of forward on straights).
 * `turnRadius` is the distance from the curve center for curves, or `Infinity`
 * for straights.
 */
export type TrackFrame = {
    tangential: Point;
    normal: Point;
    /** Actual distance from curve center (horse's current radius). */
    turnRadius: number;
    /** The track centerline radius for curves, or `Infinity` for straights. */
    nominalRadius: number;
    /**
     * The radius the horse should maintain on this curve, equal to its
     * distance from the curve center when it entered the segment.
     * `Infinity` on straights.
     */
    targetRadius: number;
    /** Grade (rise/run) of the current segment. 0 = flat. */
    slope: number;
};

/**
 * Tracks which segment a horse is on and computes the local tangential /
 * normal directions at the horse's position.
 */
export class TrackNavigator {
    private segments: TrackSegment[];
    private currentIndex: number;
    /** Half-width of the track (inner rail offset from centerline). */
    private halfTrackWidth: number;
    /** Distance from the curve center when the horse entered the current curve segment. */
    private curveEntryRadius = NaN;
    /** True once the horse has exited the last segment (crossed the finish line). */
    private _completedLap = false;
    /** Precomputed outward normals for straight segments (null for curves). */
    private outwardNormals: (Point | null)[];
    /** Precomputed length of each segment. */
    private _segmentLengths: number[];
    /** Cumulative length up to (but not including) each segment. */
    private _cumulativeLengths: number[];
    /** Total track length. */
    private _totalLength: number;

    constructor(segments: TrackSegment[], startIndex = 0, halfTrackWidth = 15) {
        this.segments = segments;
        this.currentIndex = startIndex;
        this.halfTrackWidth = halfTrackWidth;
        this.outwardNormals = this.computeOutwardNormals();

        // Precompute segment lengths and cumulative distances
        this._segmentLengths = segments.map(seg => {
            if (seg.tracktype === 'STRAIGHT') {
                const dx = seg.endPoint.x - seg.startPoint.x;
                const dy = seg.endPoint.y - seg.startPoint.y;
                return Math.sqrt(dx * dx + dy * dy);
            }
            return Math.abs(seg.angleSpan) * seg.radius;
        });
        this._cumulativeLengths = [];
        let acc = 0;
        for (const l of this._segmentLengths) {
            this._cumulativeLengths.push(acc);
            acc += l;
        }
        this._totalLength = acc;
    }

    get segmentIndex(): number {
        return this.currentIndex;
    }

    get completedLap(): boolean {
        return this._completedLap;
    }

    get segment(): TrackSegment {
        return this.segments[this.currentIndex];
    }

    get totalLength(): number {
        return this._totalLength;
    }

    /**
     * Return continuous progress fraction [0, 1] along the total track length.
     * Matches Python `TrackNavigator.compute_progress()`.
     */
    computeProgress(position: Point): number {
        if (this._totalLength < 1e-6) return 0;

        const seg = this.segments[this.currentIndex];
        const base = this._cumulativeLengths[this.currentIndex];
        const segLen = this._segmentLengths[this.currentIndex];
        let along: number;

        if (seg.tracktype === 'STRAIGHT') {
            const dx = seg.endPoint.x - seg.startPoint.x;
            const dy = seg.endPoint.y - seg.startPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1e-6) {
                along = 0;
            } else {
                const fwdX = dx / len;
                const fwdY = dy / len;
                const offX = position.x - seg.startPoint.x;
                const offY = position.y - seg.startPoint.y;
                along = offX * fwdX + offY * fwdY;
            }
        } else {
            const toPosX = position.x - seg.center.x;
            const toPosY = position.y - seg.center.y;
            const anglePos = Math.atan2(toPosY, toPosX);
            const toStartX = seg.startPoint.x - seg.center.x;
            const toStartY = seg.startPoint.y - seg.center.y;
            const angleStart = Math.atan2(toStartY, toStartX);

            let delta = anglePos - angleStart;
            if (seg.angleSpan >= 0) {
                while (delta < 0) delta += 2 * Math.PI;
                while (delta > 2 * Math.PI) delta -= 2 * Math.PI;
            } else {
                while (delta > 0) delta -= 2 * Math.PI;
                while (delta < -2 * Math.PI) delta += 2 * Math.PI;
            }
            along = Math.abs(delta) * seg.radius;
        }

        along = Math.max(0, Math.min(segLen, along));
        return (base + along) / this._totalLength;
    }

    /** The radius the horse should hold on the current curve, or `Infinity` on straights. */
    get targetRadius(): number {
        if (
            this.segment.tracktype === 'CURVE' &&
            !isNaN(this.curveEntryRadius)
        ) {
            return this.curveEntryRadius;
        }
        return Infinity;
    }

    /**
     * Computes the track-relative frame at the given horse position based on
     * the current segment.
     */
    getTrackFrame(position: Point): TrackFrame {
        const seg = this.segment;

        if (seg.tracktype === 'CURVE') {
            return this.curveFrame(seg, position);
        }
        return this.straightFrame(seg);
    }

    /**
     * Signed lateral offset from track centerline, in meters.
     * Positive = outward (normal direction), negative = inward.
     */
    lateralOffset(position: Point): number {
        const seg = this.segment;
        if (seg.tracktype === 'CURVE') {
            const dx = position.x - seg.center.x;
            const dy = position.y - seg.center.y;
            const turnRadius = Math.sqrt(dx * dx + dy * dy);
            return turnRadius - seg.radius;
        }
        // Straight: project onto normal
        const frame = this.straightFrame(seg);
        const offX = position.x - seg.startPoint.x;
        const offY = position.y - seg.startPoint.y;
        return offX * frame.normal.x + offY * frame.normal.y;
    }

    /**
     * Checks whether the horse has left the current segment and advances to
     * the next one if so. Call once per tick after physics.
     */
    updateSegment(position: Point): void {
        if (this.segments.length <= 1) return;

        const seg = this.segment;
        let exited = false;

        if (seg.tracktype === 'STRAIGHT') {
            exited = this.exitedStraight(seg, position);
        } else {
            exited = this.exitedCurve(seg, position);
        }

        if (exited) {
            if (this.currentIndex === this.segments.length - 1) {
                this._completedLap = true;
                return; // stay on last segment (race is over), matching Python
            }
            const prevSeg = seg;
            this.currentIndex = this.currentIndex + 1;
            const newSeg = this.segment;

            if (newSeg.tracktype === 'CURVE') {
                // Inner rail is at radius - halfTrackWidth; clamp to stay outside it.
                const innerRail = newSeg.radius - this.halfTrackWidth;

                if (
                    prevSeg.tracktype === 'CURVE' &&
                    !isNaN(this.curveEntryRadius)
                ) {
                    // Curve → curve: carry the lane offset forward so
                    // accumulated drift doesn't get locked in.
                    const laneOffset = this.curveEntryRadius - prevSeg.radius;
                    this.curveEntryRadius = Math.max(
                        newSeg.radius + laneOffset,
                        innerRail
                    );
                } else {
                    // Straight → curve: capture from actual position.
                    // Clamp to stay outside the inner Crescent body.
                    const center: Point = {
                        x: newSeg.center.x,
                        y: newSeg.center.y,
                    };
                    const rawRadius = PointCal.magnitude(
                        PointCal.subVector(position, center)
                    );
                    this.curveEntryRadius = Math.max(rawRadius, innerRail);
                }
            } else {
                this.curveEntryRadius = NaN;
            }
        }
    }

    /** Get the precomputed outward normal for a segment (null for curves). */
    getOutwardNormal(segmentIndex: number): Point | null {
        return this.outwardNormals[segmentIndex];
    }

    // ------------------------------------------------------------------
    // Outward normal precomputation
    // ------------------------------------------------------------------

    private computeOutwardNormals(): (Point | null)[] {
        return this.segments.map((seg, i) => {
            if (seg.tracktype === 'CURVE') return null;
            const start = seg.startPoint;
            const end = seg.endPoint;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1e-6) return { x: 0, y: -1 };
            // default normal: rotate_90_cw of forward
            let nx = dy / len;
            let ny = -dx / len;
            // Find nearest curve to determine direction
            const curve = this.findNearestCurve(i);
            if (curve) {
                const mx = (start.x + end.x) / 2;
                const my = (start.y + end.y) / 2;
                const toCenterDot =
                    (curve.center.x - mx) * nx + (curve.center.y - my) * ny;
                if (toCenterDot > 0) {
                    nx = -nx;
                    ny = -ny;
                }
            }
            return { x: nx, y: ny };
        });
    }

    private findNearestCurve(idx: number): CurveSegment | null {
        for (let j = idx + 1; j < this.segments.length; j++) {
            if (this.segments[j].tracktype === 'CURVE')
                return this.segments[j] as CurveSegment;
        }
        for (let j = idx - 1; j >= 0; j--) {
            if (this.segments[j].tracktype === 'CURVE')
                return this.segments[j] as CurveSegment;
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Frame helpers
    // ------------------------------------------------------------------

    private straightFrame(seg: TrackSegment): TrackFrame {
        const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
        const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
        const tangential = PointCal.unitVector(PointCal.subVector(end, start));
        // Normal points outward, matching the nearest curve's convention:
        // CCW curve → outward = rotate tangential by -π/2
        // CW curve  → outward = rotate tangential by +π/2
        const curve = this.findNearestCurve(this.currentIndex);
        const rotation =
            curve && curve.angleSpan < 0 ? Math.PI / 2 : -Math.PI / 2;
        const normal = PointCal.unitVector(
            PointCal.rotatePoint(tangential, rotation)
        );
        return {
            tangential,
            normal,
            turnRadius: Infinity,
            nominalRadius: Infinity,
            targetRadius: Infinity,
            slope: seg.slope ?? 0,
        };
    }

    private curveFrame(seg: CurveSegment, position: Point): TrackFrame {
        const center: Point = { x: seg.center.x, y: seg.center.y };
        const radial = PointCal.subVector(position, center);
        const turnRadius = PointCal.magnitude(radial);

        // normal points outward (away from center)
        const normal =
            turnRadius > 1e-6 ? PointCal.unitVector(radial) : { x: 1, y: 0 };

        // tangential is perpendicular to normal, direction depends on sweep
        // positive angleSpan → CCW → tangential = rotate normal by +π/2
        // negative angleSpan → CW  → tangential = rotate normal by -π/2
        const tangential = PointCal.unitVector(
            PointCal.rotatePoint(
                normal,
                seg.angleSpan >= 0 ? Math.PI / 2 : -Math.PI / 2
            )
        );

        // Lazily capture entry radius on first frame of this curve
        // (handles the case where the starting segment is already a curve).
        // Clamp to stay outside the inner Crescent body.
        if (isNaN(this.curveEntryRadius)) {
            this.curveEntryRadius = Math.max(
                turnRadius,
                seg.radius - this.halfTrackWidth
            );
        }

        return {
            tangential,
            normal,
            turnRadius,
            nominalRadius: seg.radius,
            targetRadius: seg.radius,
            slope: seg.slope ?? 0,
        };
    }

    // ------------------------------------------------------------------
    // Lookahead sampling
    // ------------------------------------------------------------------

    /**
     * Sample the track frame at a point `distance` meters ahead of `position`
     * along the centerline. Walks forward through segments from currentIndex.
     * Does not mutate the navigator's state.
     */
    sampleTrackAhead(position: Point, distance: number): TrackFrame {
        const seg = this.segments[this.currentIndex];
        const along = this.distanceAlongSegment(seg, position);

        if (distance <= 0) {
            const clamped = Math.max(0, Math.min(this._segmentLengths[this.currentIndex], along));
            return this.frameAtSegmentOffset(this.currentIndex, clamped);
        }

        let remaining = distance + along;
        let idx = this.currentIndex;

        while (idx < this.segments.length) {
            const len = this._segmentLengths[idx];
            if (remaining <= len) {
                return this.frameAtSegmentOffset(idx, remaining);
            }
            remaining -= len;
            idx++;
        }

        // Past end of track: return frame at end of last segment
        const lastIdx = this.segments.length - 1;
        return this.frameAtSegmentOffset(
            lastIdx,
            this._segmentLengths[lastIdx]
        );
    }

    /**
     * Project position onto the given segment and return raw meters from
     * the segment start along the centerline.
     */
    private distanceAlongSegment(seg: TrackSegment, position: Point): number {
        if (seg.tracktype === 'STRAIGHT') {
            const dx = seg.endPoint.x - seg.startPoint.x;
            const dy = seg.endPoint.y - seg.startPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1e-6) return 0;
            const fwdX = dx / len;
            const fwdY = dy / len;
            const offX = position.x - seg.startPoint.x;
            const offY = position.y - seg.startPoint.y;
            const along = offX * fwdX + offY * fwdY;
            return Math.max(0, Math.min(len, along));
        }

        // Curve: arc length from startAngle to position angle
        const toPosX = position.x - seg.center.x;
        const toPosY = position.y - seg.center.y;
        const anglePos = Math.atan2(toPosY, toPosX);
        const toStartX = seg.startPoint.x - seg.center.x;
        const toStartY = seg.startPoint.y - seg.center.y;
        const angleStart = Math.atan2(toStartY, toStartX);

        let delta = anglePos - angleStart;
        if (seg.angleSpan >= 0) {
            while (delta < 0) delta += 2 * Math.PI;
            while (delta > 2 * Math.PI) delta -= 2 * Math.PI;
        } else {
            while (delta > 0) delta -= 2 * Math.PI;
            while (delta < -2 * Math.PI) delta += 2 * Math.PI;
        }
        const segLen = Math.abs(seg.angleSpan) * seg.radius;
        return Math.max(0, Math.min(segLen, Math.abs(delta) * seg.radius));
    }

    /**
     * Compute a TrackFrame at `offset` meters into segment `segIdx` along the
     * centerline. Uses nominalRadius for curves (geometry only, no horse
     * lateral position).
     */
    private frameAtSegmentOffset(segIdx: number, offset: number): TrackFrame {
        const seg = this.segments[segIdx];

        if (seg.tracktype === 'STRAIGHT') {
            // Frame is constant along a straight; reuse straightFrame logic
            // but we need to use this segment's index for findNearestCurve
            const start: Point = {
                x: seg.startPoint.x,
                y: seg.startPoint.y,
            };
            const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
            const tangential = PointCal.unitVector(
                PointCal.subVector(end, start)
            );
            const curve = this.findNearestCurve(segIdx);
            const rotation =
                curve && curve.angleSpan < 0 ? Math.PI / 2 : -Math.PI / 2;
            const normal = PointCal.unitVector(
                PointCal.rotatePoint(tangential, rotation)
            );
            return {
                tangential,
                normal,
                turnRadius: Infinity,
                nominalRadius: Infinity,
                targetRadius: Infinity,
                slope: seg.slope ?? 0,
            };
        }

        // Curve: compute angle at offset
        const angleAtOffset =
            this.curveStartAngle(seg) +
            (offset / seg.radius) * Math.sign(seg.angleSpan);

        // Normal points outward (away from center)
        const normal: Point = {
            x: Math.cos(angleAtOffset),
            y: Math.sin(angleAtOffset),
        };

        // tangential perpendicular to normal
        const tangential = PointCal.unitVector(
            PointCal.rotatePoint(
                normal,
                seg.angleSpan >= 0 ? Math.PI / 2 : -Math.PI / 2
            )
        );

        return {
            tangential,
            normal,
            turnRadius: seg.radius,
            nominalRadius: seg.radius,
            targetRadius: seg.radius,
            slope: seg.slope ?? 0,
        };
    }

    /** Return the start angle (radians) of a curve segment's arc. */
    private curveStartAngle(seg: CurveSegment): number {
        return Math.atan2(
            seg.startPoint.y - seg.center.y,
            seg.startPoint.x - seg.center.x
        );
    }

    // ------------------------------------------------------------------
    // Segment exit detection
    // ------------------------------------------------------------------

    /**
     * A horse exits a straight segment when it has passed the endPoint
     * boundary (projection of (pos - endPoint) onto forward > 0).
     */
    private exitedStraight(seg: TrackSegment, position: Point): boolean {
        const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
        const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
        const forward = PointCal.unitVector(PointCal.subVector(end, start));
        const toEnd = PointCal.subVector(position, end);
        return PointCal.dotProduct(toEnd, forward) > 0;
    }

    /**
     * A horse exits a curve segment when its angular position relative to
     * the curve center has passed the endPoint's angle.
     *
     * Uses the same signed-angle approach as the Python
     * `withinCurveTrackBound`.
     */
    private exitedCurve(seg: CurveSegment, position: Point): boolean {
        const center: Point = { x: seg.center.x, y: seg.center.y };
        const endDir = PointCal.unitVector(
            PointCal.subVector({ x: seg.endPoint.x, y: seg.endPoint.y }, center)
        );
        const horseDir = PointCal.unitVector(
            PointCal.subVector(position, center)
        );
        const angle = PointCal.angleFromA2B(endDir, horseDir);

        // positive angleSpan (CCW sweep) → horse exits when angle > 0
        // negative angleSpan (CW sweep)  → horse exits when angle < 0
        if (seg.angleSpan >= 0) {
            return angle > 0;
        }
        return angle < 0;
    }
}
