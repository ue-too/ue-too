import { Point } from "src";
import { UnSubscribe } from "src/camera-observer";

import { RotationLimits } from "src/board-camera/utils/rotation";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";
import { Boundaries } from "src/board-camera/utils/position";

import { CameraEventMap, CameraState } from "src/camera-observer";

export interface ObservableBoardCamera extends BoardCamera {
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void): UnSubscribe;
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
    setPosition(destination: Point): boolean;
    setZoomLevel(zoomLevel: number): boolean;
    setRotation(rotation: number): boolean;
    setMinZoomLevel(minZoomLevel: number): void;
    setHorizontalBoundaries(min: number, max: number): void;
    setVerticalBoundaries(min: number, max: number): void;
    getCameraOriginInWindow(centerInWindow: Point): Point;
    convertFromViewPort2WorldSpace(point: Point): Point;
    convertFromWorld2ViewPort(point: Point): Point;
    getTransform(devicePixelRatio: number, alignCoordinateSystem: boolean): {a: number, b: number, c: number, d: number, e: number, f: number};
}
