import { BCurve, Point } from "@ue-too/curve";

export enum ELEVATION {
    SUB_3 = -3,
    SUB_2,
    SUB_1,
    GROUND,
    ABOVE_1,
    ABOVE_2,
    ABOVE_3,
}

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: BCurve;
    gauge: number;
    gauges?: number[];
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