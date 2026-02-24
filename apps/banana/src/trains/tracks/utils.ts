import { LEVEL_HEIGHT, VERTICAL_CLEARANCE } from "./constants";
import { TrackJointManager } from "./trackjoin-manager";
import { ELEVATION, TrackSegmentWithElevation } from "./types";

export function getElevationAtT(
    t: number,
    trackSegment: { elevation: { from: number; to: number } }
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
}

