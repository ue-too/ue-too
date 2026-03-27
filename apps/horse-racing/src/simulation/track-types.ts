/** 2D point from track JSON (optional z ignored for physics). */
export type TrackPoint = {
    x: number;
    y: number;
    z?: number;
};

export type StraightSegment = {
    tracktype: 'STRAIGHT';
    startPoint: TrackPoint;
    endPoint: TrackPoint;
    /** Grade (rise/run). Positive = uphill in direction of travel. */
    slope?: number;
};

export type CurveSegment = {
    tracktype: 'CURVE';
    startPoint: TrackPoint;
    endPoint: TrackPoint;
    center: TrackPoint;
    radius: number;
    angleSpan: number;
    /** Grade (rise/run). Positive = uphill in direction of travel. */
    slope?: number;
};

export type TrackSegment = StraightSegment | CurveSegment;
