import type { Point } from '@ue-too/math';

// ---------------------------------------------------------------------------
// Handle types — how Bezier control point handles behave
// ---------------------------------------------------------------------------

export enum HandleType {
    /** Auto-positioned at 30% toward adjacent control point. */
    VECTOR = 1,
    /** Manually positioned but constrained to mirror the opposite handle. */
    ALIGNED,
    /** Independently positioned, no constraints. */
    FREE,
}

// ---------------------------------------------------------------------------
// Control point structure
// ---------------------------------------------------------------------------

export type HandlePoint = {
    /** Position in local (anchor-relative) space. */
    coord: Point;
    /** Position in world space after rotation + translation. */
    transformedCoord: Point;
    handleType: HandleType;
};

export type ControlPoint = {
    /** Position in local (anchor-relative) space. */
    coord: Point;
    /** Position in world space after rotation + translation. */
    transformedCoord: Point;
    left_handle: HandlePoint;
    right_handle: HandlePoint;
    /** Grade (rise/run) for the segment starting at this control point. null = flat. */
    slope: number | null;
};

// ---------------------------------------------------------------------------
// Point type for hit-test results
// ---------------------------------------------------------------------------

export type PointType = 'cp' | 'lh' | 'rh';

export type HitTestResult = {
    hit: boolean;
    pointIndex: number;
    pointType: PointType | null;
    pointPos: Point | null;
};

// ---------------------------------------------------------------------------
// Track export types (matches simulation import format)
// ---------------------------------------------------------------------------

export enum TrackType {
    STRAIGHT = 'STRAIGHT',
    CURVE = 'CURVE',
}

export type Track = {
    tracktype: TrackType;
    startPoint: Point;
    endPoint: Point;
    angleSpan?: number;
    radius?: number;
    slope?: number;
    center?: Point;
};

// ---------------------------------------------------------------------------
// Curve collection types
// ---------------------------------------------------------------------------

export type BezierCurveItem = {
    name: string;
    selected: boolean;
};

export type GrabbedPoint = {
    ident: string | null;
    pointIndex: number;
    pointType: PointType | null;
    lastPos: Point | null;
};

export type CurveListEntry = {
    ident: string;
    name: string;
    selected: boolean;
    beingEdited: boolean;
};
