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
};

export type CurveSegment = {
    tracktype: 'CURVE';
    startPoint: TrackPoint;
    endPoint: TrackPoint;
    center: TrackPoint;
    radius: number;
    angleSpan: number;
};

export type TrackSegment = StraightSegment | CurveSegment;
