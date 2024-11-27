import { Point } from "src";
import { CameraObserverV2, UnSubscribe } from "src/camera-observer";

import { RotationLimits } from "src/board-camera/utils/rotation";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";
import { Boundaries } from "src/board-camera/utils/position";

import { CameraEvent, CameraState } from "src/camera-observer";

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
    setMinZoomLevel(minZoomLevel: number): void;
    setHorizontalBoundaries(min: number, max: number): void;
    setVerticalBoundaries(min: number, max: number): void;
    convertFromViewPort2WorldSpace(point: Point): Point;
    // pointInView(point: Point): boolean;
    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe;
}
