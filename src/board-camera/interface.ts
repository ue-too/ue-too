import { Point } from "src/utils/misc";
import { UnSubscribe } from "src/board-camera/camera-update-publisher";

import { RotationLimits } from "src/board-camera/utils/rotation";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";
import { Boundaries } from "src/board-camera/utils/position";
import { CameraEventMap, CameraState } from "src/board-camera/camera-update-publisher";
import { SubscriptionOptions } from "src/utils/observable";

/**
 * @description The interface for the observable board camera.
 * 
 * @category Camera
 */
export interface ObservableBoardCamera extends BoardCamera {
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void, options?: SubscriptionOptions): UnSubscribe;
}

/**
 * @description The interface for the board camera.
 * 
 * @category Camera
 */
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
    setMaxZoomLevel(maxZoomLevel: number): void;
    setHorizontalBoundaries(min: number, max: number): void;
    setVerticalBoundaries(min: number, max: number): void;
    getCameraOriginInWindow(centerInWindow: Point): Point;
    convertFromViewPort2WorldSpace(point: Point): Point;
    convertFromWorld2ViewPort(point: Point): Point;
    getTRS(devicePixelRatio: number, alignCoordinateSystem: boolean): {scale: {x: number, y: number}, rotation: number, translation: {x: number, y: number}};
    getTransform(devicePixelRatio: number, alignCoordinateSystem: boolean): {a: number, b: number, c: number, d: number, e: number, f: number};
}
