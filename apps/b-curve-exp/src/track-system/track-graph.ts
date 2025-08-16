import { Point } from "@ue-too/math";

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: number;
}

export type TrackJoint = {
    position: Point;
    tangent: Point;
    connections: {
        positive: Map<number, TrackSegment>;
        negative: Map<number, TrackSegment>;
    };
}

export class TrackGraph {

}

