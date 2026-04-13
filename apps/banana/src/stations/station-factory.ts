import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import type { TrackGraph } from '@/trains/tracks/track';
import type { ELEVATION } from '@/trains/tracks/types';
import { DEFAULT_GAUGE_PRESET } from '@/trains/tracks/gauge-presets';

import type { StationManager } from './station-manager';
import type { Platform, StopPosition } from './types';

/** Default lateral distance from track centerline to platform edge (meters).
 * Must be larger than ballast half-width (~0.75m) to create a gap between track and platform. */
const DEFAULT_PLATFORM_OFFSET = 1.2;

/** Default track gauge in meters (from preset registry). */
const DEFAULT_GAUGE = DEFAULT_GAUGE_PRESET.width;

/** Default platform width (meters). Typical island platform is ~8–10m wide. */
const DEFAULT_PLATFORM_WIDTH = 8;

/** Distance between the two track centerlines of an island-platform station (meters). */
const DEFAULT_TRACK_SPACING =
    DEFAULT_PLATFORM_WIDTH + 2 * DEFAULT_PLATFORM_OFFSET;

export type CreateIslandStationOptions = {
    /** Center position of the station in world coordinates. */
    position: Point;
    /** Unit tangent direction the tracks run along. */
    direction: Point;
    /** Length of the station / platform (meters). */
    length: number;
    elevation: ELEVATION;
    name?: string;
    gauge?: number;
    trackSpacing?: number;
    platformOffset?: number;
};

/**
 * Creates an island-platform station: two parallel straight tracks with a
 * single platform between them.
 *
 * Returns the station entity ID assigned by the StationManager.
 *
 * Side-effects: creates 4 joints and 2 track segments in the TrackGraph.
 */
export function createIslandStation(
    trackGraph: TrackGraph,
    stationManager: StationManager,
    options: CreateIslandStationOptions
): number {
    const {
        position,
        direction,
        length,
        elevation,
        name = 'Station',
        gauge = DEFAULT_GAUGE,
        trackSpacing = DEFAULT_TRACK_SPACING,
        platformOffset = DEFAULT_PLATFORM_OFFSET,
    } = options;

    const dir = PointCal.unitVector(direction);
    // Normal is perpendicular to the track direction (rotated 90° CCW).
    const normal: Point = { x: -dir.y, y: dir.x };

    const halfLength = length / 2;
    const halfSpacing = trackSpacing / 2;

    // ----- Track 1 (left of center) -----
    const t1Start: Point = {
        x: position.x + dir.x * -halfLength + normal.x * halfSpacing,
        y: position.y + dir.y * -halfLength + normal.y * halfSpacing,
    };
    const t1End: Point = {
        x: position.x + dir.x * halfLength + normal.x * halfSpacing,
        y: position.y + dir.y * halfLength + normal.y * halfSpacing,
    };

    // ----- Track 2 (right of center) -----
    const t2Start: Point = {
        x: position.x + dir.x * -halfLength + normal.x * -halfSpacing,
        y: position.y + dir.y * -halfLength + normal.y * -halfSpacing,
    };
    const t2End: Point = {
        x: position.x + dir.x * halfLength + normal.x * -halfSpacing,
        y: position.y + dir.y * halfLength + normal.y * -halfSpacing,
    };

    // Create joints (empty, at station elevation)
    const j1Start = trackGraph.createNewEmptyJoint(t1Start, dir, elevation);
    const j1End = trackGraph.createNewEmptyJoint(t1End, dir, elevation);
    const j2Start = trackGraph.createNewEmptyJoint(t2Start, dir, elevation);
    const j2End = trackGraph.createNewEmptyJoint(t2End, dir, elevation);

    // Connect joints with straight segments (one midpoint control point for a valid quadratic BCurve)
    const t1Mid: Point = {
        x: (t1Start.x + t1End.x) / 2,
        y: (t1Start.y + t1End.y) / 2,
    };
    const t2Mid: Point = {
        x: (t2Start.x + t2End.x) / 2,
        y: (t2Start.y + t2End.y) / 2,
    };
    trackGraph.connectJoints(j1Start, j1End, [t1Mid], gauge);
    trackGraph.connectJoints(j2Start, j2End, [t2Mid], gauge);

    // Resolve segment IDs from the joints' connection maps
    const j1StartJoint = trackGraph.getJoint(j1Start)!;
    const j2StartJoint = trackGraph.getJoint(j2Start)!;
    const seg1 = j1StartJoint.connections.get(j1End)!;
    const seg2 = j2StartJoint.connections.get(j2End)!;

    const joints = [j1Start, j1End, j2Start, j2End];
    const trackSegments = [seg1, seg2];

    const platformWidth = (trackSpacing - 2 * platformOffset) / 2;

    // Platform 1: serves track 1, extends toward center (negative normal = -1)
    const platform1: Platform = {
        id: 0,
        track: seg1,
        width: platformWidth,
        offset: platformOffset,
        side: -1,
        stopPositions: [
            { trackSegmentId: seg1, direction: 'tangent', tValue: 0.5 },
            { trackSegmentId: seg1, direction: 'reverseTangent', tValue: 0.5 },
        ],
    };

    // Platform 2: serves track 2, extends toward center (positive normal = 1)
    const platform2: Platform = {
        id: 1,
        track: seg2,
        width: platformWidth,
        offset: platformOffset,
        side: 1,
        stopPositions: [
            { trackSegmentId: seg2, direction: 'tangent', tValue: 0.5 },
            { trackSegmentId: seg2, direction: 'reverseTangent', tValue: 0.5 },
        ],
    };

    const stationId = stationManager.createStation({
        name,
        position,
        elevation,
        platforms: [platform1, platform2],
        trackSegments,
        joints,
        trackAlignedPlatforms: [],
    });

    return stationId;
}
