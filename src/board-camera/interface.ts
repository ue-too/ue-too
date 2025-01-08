import { Point } from "src";
import { CameraObserver, UnSubscribe } from "src/camera-observer";

import { RotationLimits } from "src/board-camera/utils/rotation";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";
import { Boundaries } from "src/board-camera/utils/position";

import { CameraEvent, CameraState } from "src/camera-observer";

export interface BoardCamera {
    type: string;
    position: Point;
    rotation: number;
    zoomLevel: number;
    viewPortWidth: number;
    viewPortHeight: number;
    boundaries?: Boundaries;
    zoomBoundaries?: ZoomLevelLimits;
    rotationBoundaries?: RotationLimits;
    observer: CameraObserver;
    setPosition(destination: Point): void;
    setPositionByDelta(delta: Point): void;
    setZoomLevel(zoomLevel: number): void;
    setRotation(rotation: number): void;
    setMinZoomLevel(minZoomLevel: number): void;
    setHorizontalBoundaries(min: number, max: number): void;
    setVerticalBoundaries(min: number, max: number): void;
    getCameraOriginInWindow(centerInWindow: Point): Point;
    convertFromViewPort2WorldSpace(point: Point): Point;
    getTransform(canvasWidth: number, canvasHeight: number, devicePixelRatio: number, alignCoordinateSystem: boolean): {a: number, b: number, c: number, d: number, e: number, f: number};
    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe;
}
