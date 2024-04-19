import { Point } from "src";
import { CameraObserverV2 } from "src/camera-observer";

import { RotationLimits } from "src/board-camera/utils/rotation";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";

type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

export interface BoardCamera {
    position: Point;
    rotation: number;
    zoomLevel: number;
    viewPortWidth: number;
    viewPortHeight: number;
    boundaries?: Boundaries;
    zoomBoundaries?: ZoomLevelLimits;
    rotationBoundaries?: RotationLimits;
    observer: CameraObserverV2;
    setPosition(destination: Point): void;
    setZoomLevel(zoomLevel: number): void;
    setRotation(rotation: number): void;
    convertFromViewPort2WorldSpace(point: Point): Point;
}
