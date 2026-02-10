import { Point } from "@ue-too/math";
import { AABBIntersects, offset2 } from "@ue-too/curve";
import { LEVEL_HEIGHT, VERTICAL_CLEARANCE } from "./constants";
import { TrackJointManager } from "./trackjoint-manager";
import { ELEVATION, TrackSegmentDrawData, TrackSegmentSplit, TrackSegmentWithCollision, TrackSegmentWithElevation } from "./types";

export function getElevationAtT(
    t: number,
    trackSegment: { elevation: { from: number; to: number } } // this is the elevation height evaluated using the LEVEL_HEIGHT constant and the ELEVATION enum
): number {
    const startElevationLevel = trackSegment.elevation.from;
    const endElevationLevel = trackSegment.elevation.to;

    const elevation =
        startElevationLevel + (endElevationLevel - startElevationLevel) * t;

    return elevation;
};

export function trackIsSlopedByJoints(
    trackSegment: TrackSegmentWithElevation,
    trackJointManager: TrackJointManager
): boolean {
    const startJointNumber = trackSegment.t0Joint;
    const endJointNumber = trackSegment.t1Joint;

    const startJoint = trackJointManager.getJoint(startJointNumber);
    const endJoint = trackJointManager.getJoint(endJointNumber);

    if (startJoint === null || endJoint === null) {
        return false;
    }

    return startJoint.elevation !== endJoint.elevation;
};

export function trackIsSloped(trackSegment: {
    elevation: { from: ELEVATION; to: ELEVATION };
}): boolean {
    return trackSegment.elevation.from !== trackSegment.elevation.to;
};

export function satisfiesVerticalClearance(elevation: number): boolean {
    if (elevation >= VERTICAL_CLEARANCE) {
        return true;
    }
    return false;
}

export function intersectionSatisfiesVerticalClearance(
    intersectionTVal: number,
    trackSegment: { elevation: { from: ELEVATION; to: ELEVATION } },
    intersectionTVal2: number,
    trackSegment2: { elevation: { from: ELEVATION; to: ELEVATION } }
): boolean {
    const elevation1 = getElevationAtT(intersectionTVal, {
        elevation: {
            from: trackSegment.elevation.from * LEVEL_HEIGHT,
            to: trackSegment.elevation.to * LEVEL_HEIGHT,
        },
    });
    const elevation2 = getElevationAtT(intersectionTVal2, {
        elevation: {
            from: trackSegment2.elevation.from * LEVEL_HEIGHT,
            to: trackSegment2.elevation.to * LEVEL_HEIGHT,
        },
    });

    const diff = Math.abs(elevation1 - elevation2);

    return satisfiesVerticalClearance(diff);
}

export function elevationIntervalOverlaps(
    track1: { elevation: { from: ELEVATION; to: ELEVATION } },
    track2: { elevation: { from: ELEVATION; to: ELEVATION } }
): boolean {
    const t1Min = Math.min(track1.elevation.from, track1.elevation.to);
    const t1Max = Math.max(track1.elevation.from, track1.elevation.to);
    const t2Min = Math.min(track2.elevation.from, track2.elevation.to);
    const t2Max = Math.max(track2.elevation.from, track2.elevation.to);

    if (t1Min <= t2Max && t2Min <= t1Max) {
        return true;
    }
    return false;
};

export const orderTest = (a: TrackSegmentDrawData, b: TrackSegmentDrawData) => {
    if (!trackIsSloped(a) && !trackIsSloped(b)) {
        return a.elevation.from - b.elevation.from;
    }

    const overlaps = elevationIntervalOverlaps(a, b);
    const aMax = Math.max(a.elevation.from, a.elevation.to);
    const bMax = Math.max(b.elevation.from, b.elevation.to);
    if (!overlaps) {
        return aMax - bMax;
    }
    if (
        a.excludeSegmentsForCollisionCheck.has(
            b.originalTrackSegment.trackSegmentNumber
        ) ||
        b.excludeSegmentsForCollisionCheck.has(
            a.originalTrackSegment.trackSegmentNumber
        )
    ) {
        return 0;
    }
    const broad = AABBIntersects(a.curve.AABB, b.curve.AABB);
    if (!broad) {
        return aMax - bMax;
    }
    const collision = a.curve.getCurveIntersections(b.curve);
    if (collision.length === 0) {
        return aMax - bMax;
    }
    if (collision.length !== 1) {
        console.warn(
            'something wrong in the sorting of track segments draw order'
        );
        // return 0;
    }
    const aElevation = getElevationAtT(collision[0].selfT, {
        elevation: {
            from: a.elevation.from * LEVEL_HEIGHT,
            to: a.elevation.to * LEVEL_HEIGHT,
        },
    });
    const bElevation = getElevationAtT(collision[0].otherT, {
        elevation: {
            from: b.elevation.from * LEVEL_HEIGHT,
            to: b.elevation.to * LEVEL_HEIGHT,
        },
    });
    return aElevation - bElevation;
};

export const orderTestWithoutCollisionCheck = (a: TrackSegmentDrawData, b: TrackSegmentDrawData) => {
    if (!trackIsSloped(a) && !trackIsSloped(b)) {
        return a.elevation.from - b.elevation.from;
    }

    const overlaps = elevationIntervalOverlaps(a, b);
    const aMax = Math.max(a.elevation.from, a.elevation.to);
    const bMax = Math.max(b.elevation.from, b.elevation.to);
    if (!overlaps) {
        return aMax - bMax;
    }
    if (
        a.excludeSegmentsForCollisionCheck.has(
            b.originalTrackSegment.trackSegmentNumber
        ) ||
        b.excludeSegmentsForCollisionCheck.has(
            a.originalTrackSegment.trackSegmentNumber
        )
    ) {
        return 0;
    }
    const broad = AABBIntersects(a.curve.AABB, b.curve.AABB);
    if (!broad) {
        return aMax - bMax;
    }
    const collision = a.curve.getCurveIntersections(b.curve);
    if (collision.length === 0) {
        return aMax - bMax;
    }
    if (collision.length !== 1) {
        console.warn(
            'something wrong in the sorting of track segments draw order'
        );
        // return 0;
    }
    const aElevation = getElevationAtT(collision[0].selfT, {
        elevation: {
            from: a.elevation.from * LEVEL_HEIGHT,
            to: a.elevation.to * LEVEL_HEIGHT,
        },
    });
    const bElevation = getElevationAtT(collision[0].otherT, {
        elevation: {
            from: b.elevation.from * LEVEL_HEIGHT,
            to: b.elevation.to * LEVEL_HEIGHT,
        },
    });
    return aElevation - bElevation;
};

export const trackSegmentDrawDataInsertIndex = (drawDataList: TrackSegmentDrawData[], drawData: TrackSegmentDrawData) => {
    let left = 0;
    let right = drawDataList.length - 1;

    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        const midDrawData = drawDataList[mid];
        const order = orderTest(midDrawData, drawData);
        if (order === 0) {
            return mid;
        }
        if (order < 0) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return left;
};

export const makeTrackSegmentDrawDataFromSplit = (split: TrackSegmentSplit, originalTrackSegment: TrackSegmentWithCollision, trackSegmentNumber: number): TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } => {
    const positiveOffsets = offset2(split.curve, originalTrackSegment.gauge / 2).points;
    const negativeOffsets = offset2(split.curve, -originalTrackSegment.gauge / 2).points;
    return {
        curve: split.curve,
        elevation: split.elevation,
        gauge: originalTrackSegment.gauge,
        originalElevation: originalTrackSegment.elevation,
        excludeSegmentsForCollisionCheck: new Set(),
        originalTrackSegment: {
            trackSegmentNumber: trackSegmentNumber,
            tValInterval: { start: split.tValInterval.start, end: split.tValInterval.end },
            startJointPosition: originalTrackSegment.curve.getControlPoints()[0],
            endJointPosition: originalTrackSegment.curve.getControlPoints()[originalTrackSegment.curve.getControlPoints().length - 1],
        },
        positiveOffsets,
        negativeOffsets,
    }
};
