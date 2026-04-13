import { BCurve, Point } from "@ue-too/curve";

/** Visual style applied to track rendering. */
export type TrackStyle = 'ballasted' | 'slab';

export enum ELEVATION {
    SUB_3 = -3,
    SUB_2,
    SUB_1,
    GROUND,
    ABOVE_1,
    ABOVE_2,
    ABOVE_3,
}

/** Sorted numeric values of ELEVATION (min first). Derived at runtime so new enum members (e.g. SUB_4 = -4) are included. */
export const ELEVATION_VALUES: number[] = (Object.values(ELEVATION).filter((v): v is number => typeof v === 'number') as ELEVATION[]).sort((a, b) => a - b);

/** Minimum ELEVATION value. Use this instead of hardcoding so adding lower levels (e.g. SUB_4) stays correct. */
export const ELEVATION_MIN: ELEVATION = (ELEVATION_VALUES[0] ?? ELEVATION.SUB_3) as ELEVATION;

/** Maximum ELEVATION value. Use this instead of hardcoding so adding higher levels stays correct. */
export const ELEVATION_MAX: ELEVATION = (ELEVATION_VALUES[ELEVATION_VALUES.length - 1] ?? ELEVATION.ABOVE_3) as ELEVATION;

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: BCurve;
    gauge: number;
    /** Total width of the gravel bed foundation (meters). Used for snapping when bed is enabled. */
    bedWidth?: number;
    /** Visual style for this track segment. Preserved through splits so branching doesn't alter appearance. */
    trackStyle?: TrackStyle;
    /** Whether this track segment has overhead catenary electrification. */
    electrified?: boolean;
    /** Which side of the track the catenary poles are placed on (1 = left, -1 = right relative to curve direction). */
    catenarySide?: 1 | -1;
    /** Whether this track segment should render a bed (gravel foundation below the ballast). */
    bed?: boolean;
    splits: number[];
    splitCurves: {
        curve: BCurve;
        elevation: { from: number; to: number };
        tValInterval: { start: number; end: number };
    }[];
};

export type TrackSegmentWithElevation = TrackSegment & {
    elevation: {
        from: ELEVATION; // this is the resulting elevation: result = base (terrain) + track elevation
        to: ELEVATION;
    };
};

export type TrackJoint = {
    position: Point;
    connections: Map<number, number>; // maps joint number -> track segment number; this joint is connected to the track segment by this connection
    tangent: Point; // the tangent direction of the joint
    direction: {
        tangent: Set<number>; // to the next joint number
        reverseTangent: Set<number>; // to the next joint number
    };
};

export type TrackJointWithElevation = TrackJoint & {
    elevation: ELEVATION; // this is the resulting elevation: result = base (terrain) + joint elevation
};

export type TrackSegmentWithCollision = TrackSegmentWithElevation & {
    collision: {
        selfT: number;
        anotherCurve: {
            curve: BCurve;
            tVal: number;
        };
    }[];
};

export type TrackSegmentDrawData = {
    curve: BCurve;
    originalTrackSegment: {
        trackSegmentNumber: number;
        startJointPosition: Point;
        endJointPosition: Point;
        tValInterval: {
            start: number; // tVal interval start for the draw data split segment
            end: number; // tVal interval end for the draw data split segment
        };
    };
    gauge: number; // track gauge in meters
    elevation: {
        from: number;
        to: number;
    };
    originalElevation: {
        from: ELEVATION;
        to: ELEVATION;
    };
    excludeSegmentsForCollisionCheck: Set<number>;
    /** Visual style for this track segment. Defaults to 'ballasted' if not set. */
    trackStyle?: TrackStyle;
    /** Whether this track segment has overhead catenary electrification. */
    electrified?: boolean;
    /** Which side of the track the catenary poles are placed on (1 = left, -1 = right relative to curve direction). */
    catenarySide?: 1 | -1;
    /** Total width of the gravel bed foundation in world units (meters). Used for snapping. */
    bedWidth?: number;
    /** Whether this track segment should render a bed (gravel foundation below the ballast). */
    bed?: boolean;
};

export type TrackSegmentSplit = {
    curve: BCurve;
    elevation: { from: number; to: number }; // the elevation is evaluated using the LEVEL_HEIGHT constant and the ELEVATION enum
    tValInterval: { start: number; end: number }; // the tVal interval for the split segment in the original track segment curve
};

export type TrackSegmentShadow = {
    positive: Point[];
    negative: Point[];
};

export type TrackSegmentWithCollisionAndNumber = TrackSegmentWithCollision & {
    trackSegmentNumber: number;
};

export type ProjectionInfo = {
    curve: number; // this is the track segment number
    t0Joint: number;
    t1Joint: number;
    atT: number;
    projectionPoint: Point;
    tangent: Point;
    curvature: number;
    elevation: SlopedElevation | FlatElevation;
};

export type SlopedElevation = {
    curveIsSloped: true;
    elevation: number;
};

export type FlatElevation = {
    curveIsSloped: false;
    elevation: ELEVATION;
};

export type ProjectionResult = ProjectionFalseResult | ProjectionPositiveResult;

export type ProjectionFalseResult = {
    hit: false;
};

export type ProjectionPositiveResult = {
    hit: true;
} & (ProjectionJointResult | ProjectionCurveResult | ProjectionEdgeResult);

export type ProjectionEdgeResult = {
    hitType: 'edge';
} & ProjectionInfo;

export type ProjectionJointResult = {
    hitType: 'joint';
    jointNumber: number;
    projectionPoint: Point;
    tangent: Point;
    curvature: number;
    endingJoint: boolean;
};

export type ProjectionCurveResult = {
    hitType: 'curve';
} & ProjectionInfo;

export type PointOnJointPositiveResult = {};

export type TrackSegmentRTreeEntry = {
    segmentNumber: number;
    elevation: {
        from: ELEVATION;
        to: ELEVATION;
    };
    t0Joint: number;
    t1Joint: number;
};

/**
 * JSON-safe representation of a TrackJointWithElevation for serialization.
 * Map and Set fields are converted to arrays.
 */
export type SerializedTrackJoint = {
    jointNumber: number;
    position: Point;
    connections: [number, number][];
    tangent: Point;
    direction: {
        tangent: number[];
        reverseTangent: number[];
    };
    elevation: ELEVATION;
};

/**
 * JSON-safe representation of a track segment for serialization.
 * BCurve is stored as its control points; derived state (offsets, collisions,
 * draw data, RTree entries) is recomputed during deserialization.
 */
export type SerializedTrackSegment = {
    segmentNumber: number;
    controlPoints: Point[];
    t0Joint: number;
    t1Joint: number;
    elevation: { from: ELEVATION; to: ELEVATION };
    gauge: number;
    splits: number[];
    trackStyle?: TrackStyle;
    electrified?: boolean;
    catenarySide?: 1 | -1;
    bed?: boolean;
};

export type SerializedTrackData = {
    joints: SerializedTrackJoint[];
    segments: SerializedTrackSegment[];
};

/**
 * Validates that `data` conforms to the {@link SerializedTrackData} schema.
 * Returns an object with `valid: true` on success, or `valid: false` with
 * a human-readable `error` string describing the first problem found.
 */
export function validateSerializedTrackData(
    data: unknown
): { valid: true } | { valid: false; error: string } {
    if (data == null || typeof data !== 'object') {
        return { valid: false, error: 'Data must be a non-null object' };
    }

    const obj = data as Record<string, unknown>;

    if (!Array.isArray(obj.joints)) {
        return { valid: false, error: 'Missing or invalid "joints" array' };
    }
    if (!Array.isArray(obj.segments)) {
        return { valid: false, error: 'Missing or invalid "segments" array' };
    }

    const jointNumbers = new Set<number>();

    for (let i = 0; i < obj.joints.length; i++) {
        const j = obj.joints[i] as Record<string, unknown>;
        const prefix = `joints[${i}]`;

        if (typeof j.jointNumber !== 'number' || j.jointNumber < 0) {
            return { valid: false, error: `${prefix}.jointNumber must be a non-negative number` };
        }
        if (jointNumbers.has(j.jointNumber)) {
            return { valid: false, error: `${prefix}.jointNumber ${j.jointNumber} is duplicated` };
        }
        jointNumbers.add(j.jointNumber);

        if (!isPoint(j.position)) {
            return { valid: false, error: `${prefix}.position must be {x, y}` };
        }
        if (!isPoint(j.tangent)) {
            return { valid: false, error: `${prefix}.tangent must be {x, y}` };
        }
        if (!Array.isArray(j.connections)) {
            return { valid: false, error: `${prefix}.connections must be an array of [number, number] pairs` };
        }
        for (let ci = 0; ci < (j.connections as unknown[]).length; ci++) {
            const pair = (j.connections as unknown[])[ci];
            if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') {
                return { valid: false, error: `${prefix}.connections[${ci}] must be a [number, number] tuple` };
            }
        }
        if (typeof j.elevation !== 'number') {
            return { valid: false, error: `${prefix}.elevation must be a number` };
        }
        if (j.direction == null || typeof j.direction !== 'object') {
            return { valid: false, error: `${prefix}.direction must be an object` };
        }
        const dir = j.direction as Record<string, unknown>;
        if (!Array.isArray(dir.tangent) || !dir.tangent.every((v: unknown) => typeof v === 'number')) {
            return { valid: false, error: `${prefix}.direction.tangent must be a number[]` };
        }
        if (!Array.isArray(dir.reverseTangent) || !dir.reverseTangent.every((v: unknown) => typeof v === 'number')) {
            return { valid: false, error: `${prefix}.direction.reverseTangent must be a number[]` };
        }
    }

    const segmentNumbers = new Set<number>();

    for (let i = 0; i < obj.segments.length; i++) {
        const s = obj.segments[i] as Record<string, unknown>;
        const prefix = `segments[${i}]`;

        if (typeof s.segmentNumber !== 'number' || s.segmentNumber < 0) {
            return { valid: false, error: `${prefix}.segmentNumber must be a non-negative number` };
        }
        if (segmentNumbers.has(s.segmentNumber)) {
            return { valid: false, error: `${prefix}.segmentNumber ${s.segmentNumber} is duplicated` };
        }
        segmentNumbers.add(s.segmentNumber);

        if (!Array.isArray(s.controlPoints) || s.controlPoints.length < 2) {
            return { valid: false, error: `${prefix}.controlPoints must be an array of at least 2 points` };
        }
        for (let pi = 0; pi < (s.controlPoints as unknown[]).length; pi++) {
            if (!isPoint((s.controlPoints as unknown[])[pi])) {
                return { valid: false, error: `${prefix}.controlPoints[${pi}] must be {x, y}` };
            }
        }

        if (typeof s.t0Joint !== 'number') {
            return { valid: false, error: `${prefix}.t0Joint must be a number` };
        }
        if (typeof s.t1Joint !== 'number') {
            return { valid: false, error: `${prefix}.t1Joint must be a number` };
        }
        if (!jointNumbers.has(s.t0Joint)) {
            return { valid: false, error: `${prefix}.t0Joint (${s.t0Joint}) references a non-existent joint` };
        }
        if (!jointNumbers.has(s.t1Joint)) {
            return { valid: false, error: `${prefix}.t1Joint (${s.t1Joint}) references a non-existent joint` };
        }

        if (s.elevation == null || typeof s.elevation !== 'object') {
            return { valid: false, error: `${prefix}.elevation must be {from, to}` };
        }
        const elev = s.elevation as Record<string, unknown>;
        if (typeof elev.from !== 'number' || typeof elev.to !== 'number') {
            return { valid: false, error: `${prefix}.elevation.from and .to must be numbers` };
        }

        if (typeof s.gauge !== 'number' || s.gauge <= 0) {
            return { valid: false, error: `${prefix}.gauge must be a positive number` };
        }
        if (!Array.isArray(s.splits) || !(s.splits as unknown[]).every((v: unknown) => typeof v === 'number')) {
            return { valid: false, error: `${prefix}.splits must be a number[]` };
        }
    }

    return { valid: true };
}

function isPoint(v: unknown): v is Point {
    return v != null && typeof v === 'object' && typeof (v as Record<string, unknown>).x === 'number' && typeof (v as Record<string, unknown>).y === 'number';
}