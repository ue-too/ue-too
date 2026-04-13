import type { Point } from '@ue-too/math';
import type { StopPosition } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Half the car body width in meters. Typical passenger car ~3m wide. */
export const DEFAULT_CAR_HALF_WIDTH = 1.5;

/** Safety gap between car body edge and platform edge (meters). */
export const DEFAULT_PLATFORM_CLEARANCE = 0.15;

/** Maximum distance (meters) from station position to platform start point. */
export const MAX_STATION_DISTANCE = 500;

// ---------------------------------------------------------------------------
// Spine
// ---------------------------------------------------------------------------

/** One segment of a platform spine — a slice of a track curve. */
export type SpineEntry = {
    trackSegment: number;
    tStart: number;
    tEnd: number;
    /**
     * Which side of this segment's curve the platform is on.
     * Per-segment because curve tangent direction can flip at joints.
     *  1 = positive-normal (left of tangent),
     * -1 = negative-normal (right of tangent).
     */
    side: 1 | -1;
};

// ---------------------------------------------------------------------------
// Outer vertices
// ---------------------------------------------------------------------------

/** Single-spine: a polyline from spine end anchor back to spine start anchor. */
export type SingleOuterVertices = {
    kind: 'single';
    vertices: Point[];
};

/** Dual-spine: two end caps connecting the four spine anchors. */
export type DualOuterVertices = {
    kind: 'dual';
    /** Vertices connecting spine A end anchor to spine B end anchor. */
    capA: Point[];
    /** Vertices connecting spine B start anchor to spine A start anchor. */
    capB: Point[];
};

export type OuterVertices = SingleOuterVertices | DualOuterVertices;

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export type TrackAlignedPlatform = {
    id: number;
    /** Required — every track-aligned platform belongs to a station. */
    stationId: number;
    /** Primary spine (track-side edge). */
    spineA: SpineEntry[];
    /** Second spine (dual-spine only). null for single-spine platforms. */
    spineB: SpineEntry[] | null;
    /** Offset from track centerline to platform edge (meters). */
    offset: number;
    /** User-placed vertices defining the non-track side(s). */
    outerVertices: OuterVertices;
    stopPositions: StopPosition[];
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export type SerializedSpineEntry = {
    trackSegment: number;
    tStart: number;
    tEnd: number;
    side: 1 | -1;
};

export type SerializedOuterVertices =
    | { kind: 'single'; vertices: { x: number; y: number }[] }
    | { kind: 'dual'; capA: { x: number; y: number }[]; capB: { x: number; y: number }[] };

export type SerializedTrackAlignedPlatform = {
    id: number;
    stationId: number;
    spineA: SerializedSpineEntry[];
    spineB: SerializedSpineEntry[] | null;
    offset: number;
    outerVertices: SerializedOuterVertices;
    stopPositions: StopPosition[];
};

export type SerializedTrackAlignedPlatformData = {
    platforms: SerializedTrackAlignedPlatform[];
};
