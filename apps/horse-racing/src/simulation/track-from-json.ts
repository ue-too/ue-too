import { Crescent, Polygon, type World } from '@ue-too/dynamics';
import { Point, PointCal } from '@ue-too/math';

import type { CurveSegment, StraightSegment, TrackSegment } from './track-types';

export type BuildTrackOptions = {
    /** Half distance between inner and outer rail (Python demo used 30 full width). */
    halfTrackWidth: number;
    /** Thickness of each rail strip. */
    railThickness: number;
    /** Static body mass (unused for static; kept for API symmetry). */
    railMass: number;
};

const DEFAULT_BUILD: BuildTrackOptions = {
    halfTrackWidth: 15,
    railThickness: 3,
    railMass: 500,
};

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function asPoint(v: unknown): Point {
    if (!isRecord(v)) throw new Error('expected point object');
    const x = v.x;
    const y = v.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('point must have numeric x,y');
    }
    return { x, y };
}

/**
 * Parses track JSON (array of segments) into typed segments.
 *
 * @param raw - Parsed JSON value
 * @returns Normalized segment list
 */
export function parseTrackJson(raw: unknown): TrackSegment[] {
    if (!Array.isArray(raw)) {
        throw new Error('Track JSON must be an array');
    }
    const out: TrackSegment[] = [];
    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (!isRecord(item)) throw new Error(`Segment ${i} invalid`);
        const tt = item.tracktype;
        if (tt !== 'STRAIGHT' && tt !== 'CURVE') {
            throw new Error(`Segment ${i}: unknown tracktype`);
        }
        if (tt === 'STRAIGHT') {
            out.push({
                tracktype: 'STRAIGHT',
                startPoint: asPoint(item.startPoint),
                endPoint: asPoint(item.endPoint),
            });
        } else {
            const radius = item.radius;
            const angleSpan = item.angleSpan;
            if (typeof radius !== 'number' || typeof angleSpan !== 'number') {
                throw new Error(`Segment ${i}: CURVE needs radius and angleSpan`);
            }
            out.push({
                tracktype: 'CURVE',
                startPoint: asPoint(item.startPoint),
                endPoint: asPoint(item.endPoint),
                center: asPoint(item.center),
                radius,
                angleSpan,
            });
        }
    }
    return out;
}

function straightRailPolygons(
    seg: StraightSegment,
    opt: BuildTrackOptions,
): { outer: Polygon; inner: Polygon } {
    const start = { x: seg.startPoint.x, y: seg.startPoint.y };
    const end = { x: seg.endPoint.x, y: seg.endPoint.y };
    const ab = PointCal.subVector(end, start);
    const len = PointCal.magnitude(ab);
    if (len < 1e-6) {
        throw new Error('STRAIGHT segment has zero length');
    }
    const forward = PointCal.unitVector(ab);
    const outward = PointCal.unitVector(
        PointCal.rotatePoint(forward, -Math.PI / 2),
    );
    const mid = PointCal.multiplyVectorByScalar(
        PointCal.addVector(start, end),
        0.5,
    );
    const outerCenter = PointCal.addVector(
        mid,
        PointCal.multiplyVectorByScalar(outward, opt.halfTrackWidth),
    );
    const innerCenter = PointCal.subVector(
        mid,
        PointCal.multiplyVectorByScalar(outward, opt.halfTrackWidth),
    );
    const angle = Math.atan2(forward.y, forward.x);
    const hw = opt.railThickness / 2;
    const hl = len / 2 + 4;
    const local: Point[] = [
        { x: hl, y: hw },
        { x: hl, y: -hw },
        { x: -hl, y: -hw },
        { x: -hl, y: hw },
    ];
    return {
        outer: new Polygon(
            outerCenter,
            local,
            angle,
            opt.railMass,
            true,
            false,
        ),
        inner: new Polygon(
            innerCenter,
            local,
            angle,
            opt.railMass,
            true,
            false,
        ),
    };
}

/**
 * Adds static rails and curve barriers from track data into the physics world.
 *
 * @param world - Target world
 * @param segments - Parsed track
 * @param options - Rail geometry (defaults match Python-style 30px track width)
 */
export function buildTrackIntoWorld(
    world: World,
    segments: TrackSegment[],
    options: Partial<BuildTrackOptions> = {},
): void {
    const opt = { ...DEFAULT_BUILD, ...options };
    let straightIndex = 0;
    let curveIndex = 0;

    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            const { outer, inner } = straightRailPolygons(seg, opt);
            world.addRigidBody(`rail-s-${straightIndex}-o`, outer);
            world.addRigidBody(`rail-s-${straightIndex}-i`, inner);
            straightIndex += 1;
        } else {
            const c = seg as CurveSegment;
            const center = { x: c.center.x, y: c.center.y };
            const fromCenterStart = PointCal.subVector(
                { x: c.startPoint.x, y: c.startPoint.y },
                center,
            );
            const orientationAngle = PointCal.angleFromA2B(
                { x: 1, y: 0 },
                fromCenterStart,
            );
            const crescent = new Crescent(
                center,
                c.radius,
                c.angleSpan,
                orientationAngle,
                opt.railMass,
                true,
                false,
            );
            world.addRigidBody(`rail-c-${curveIndex}`, crescent);
            curveIndex += 1;
        }
    }
}

/**
 * Axis-aligned bounds of all segment geometry (for world / camera sizing).
 *
 * @param segments - Parsed track
 * @param margin - Extra padding
 */
export function trackBounds(
    segments: TrackSegment[],
    margin: number,
): { min: Point; max: Point } {
    const pts: Point[] = [];
    for (const seg of segments) {
        pts.push({ x: seg.startPoint.x, y: seg.startPoint.y });
        pts.push({ x: seg.endPoint.x, y: seg.endPoint.y });
        if (seg.tracktype === 'CURVE') {
            pts.push({ x: seg.center.x, y: seg.center.y });
            const c = seg;
            const r = c.radius;
            pts.push({ x: c.center.x - r, y: c.center.y - r });
            pts.push({ x: c.center.x + r, y: c.center.y + r });
        }
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return {
        min: { x: minX - margin, y: minY - margin },
        max: { x: maxX + margin, y: maxY + margin },
    };
}

/**
 * First segment start point and forward unit direction (for horse lineup).
 */
export function trackStartFrame(segments: TrackSegment[]): {
    origin: Point;
    forward: Point;
    outward: Point;
} | null {
    if (segments.length === 0) return null;
    const first = segments[0];
    const start = { x: first.startPoint.x, y: first.startPoint.y };
    const end = { x: first.endPoint.x, y: first.endPoint.y };
    const ab = PointCal.subVector(end, start);
    const mag = PointCal.magnitude(ab);
    if (mag < 1e-6) return { origin: start, forward: { x: 1, y: 0 }, outward: { x: 0, y: 1 } };
    const forward = PointCal.unitVector(ab);
    const outward = PointCal.unitVector(
        PointCal.rotatePoint(forward, -Math.PI / 2),
    );
    return { origin: start, forward, outward };
}
