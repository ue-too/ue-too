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

    constructor(segments: TrackSegment[], startIndex = 0, halfTrackWidth = 15) {
        this.segments = segments;
        this.currentIndex = startIndex;
        this.halfTrackWidth = halfTrackWidth;
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

    /** The radius the horse should hold on the current curve, or `Infinity` on straights. */
    get targetRadius(): number {
        if (this.segment.tracktype === 'CURVE' && !isNaN(this.curveEntryRadius)) {
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
            }
            const prevSeg = seg;
            this.currentIndex =
                (this.currentIndex + 1) % this.segments.length;
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
                    const laneOffset =
                        this.curveEntryRadius - prevSeg.radius;
                    this.curveEntryRadius = Math.max(
                        newSeg.radius + laneOffset,
                        innerRail,
                    );
                } else {
                    // Straight → curve: capture from actual position.
                    // Clamp to stay outside the inner Crescent body.
                    const center: Point = {
                        x: newSeg.center.x,
                        y: newSeg.center.y,
                    };
                    const rawRadius = PointCal.magnitude(
                        PointCal.subVector(position, center),
                    );
                    this.curveEntryRadius = Math.max(
                        rawRadius,
                        innerRail,
                    );
                }
            } else {
                this.curveEntryRadius = NaN;
            }
        }
    }

    // ------------------------------------------------------------------
    // Frame helpers
    // ------------------------------------------------------------------

    private straightFrame(seg: TrackSegment): TrackFrame {
        const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
        const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
        const tangential = PointCal.unitVector(PointCal.subVector(end, start));
        const normal = PointCal.unitVector(
            PointCal.rotatePoint(tangential, -Math.PI / 2),
        );
        return { tangential, normal, turnRadius: Infinity, nominalRadius: Infinity, targetRadius: Infinity, slope: seg.slope ?? 0 };
    }

    private curveFrame(seg: CurveSegment, position: Point): TrackFrame {
        const center: Point = { x: seg.center.x, y: seg.center.y };
        const radial = PointCal.subVector(position, center);
        const turnRadius = PointCal.magnitude(radial);

        // normal points outward (away from center)
        const normal =
            turnRadius > 1e-6
                ? PointCal.unitVector(radial)
                : { x: 1, y: 0 };

        // tangential is perpendicular to normal, direction depends on sweep
        // positive angleSpan → CCW → tangential = rotate normal by +π/2
        // negative angleSpan → CW  → tangential = rotate normal by -π/2
        const tangential = PointCal.unitVector(
            PointCal.rotatePoint(
                normal,
                seg.angleSpan >= 0 ? Math.PI / 2 : -Math.PI / 2,
            ),
        );

        // Lazily capture entry radius on first frame of this curve
        // (handles the case where the starting segment is already a curve).
        // Clamp to stay outside the inner Crescent body.
        if (isNaN(this.curveEntryRadius)) {
            this.curveEntryRadius = Math.max(
                turnRadius,
                seg.radius - this.halfTrackWidth,
            );
        }

        return {
            tangential,
            normal,
            turnRadius,
            nominalRadius: seg.radius,
            targetRadius: this.curveEntryRadius,
            slope: seg.slope ?? 0,
        };
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
            PointCal.subVector(
                { x: seg.endPoint.x, y: seg.endPoint.y },
                center,
            ),
        );
        const horseDir = PointCal.unitVector(
            PointCal.subVector(position, center),
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
