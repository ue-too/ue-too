import { Point } from "point2point";

export interface Pan {
    panTo(destination: Point): void;
    panBy(offset: Point): void;
}