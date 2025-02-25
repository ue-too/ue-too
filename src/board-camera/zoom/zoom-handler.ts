import type { Point } from "src/util/misc";
import { BoardCamera } from "src/board-camera";
import { createHandlerChain } from "src/board-camera/utils";
import { convertDeltaInViewPortToWorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import type { PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";

export type BaseZoomHandlerConfig = {
    restrictZoom: boolean;
};

export type ZoomHandlerConfig = BaseZoomHandlerConfig & PanHandlerConfig & {
    panByHandler: PanByHandlerFunction;
};

export type ZoomToAtHandlerFunction = (destination: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig) => number;
export type ZoomByAtHandlerFunction = (delta: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig) => number;
export type ZoomToHandlerFunction = (destination: number, camera: BoardCamera, config: BaseZoomHandlerConfig) => number;
export type ZoomByHandlerFunction = (delta: number, camera: BoardCamera, config: BaseZoomHandlerConfig) => number;

// the anchor point is in the viewport space
export function baseZoomByAtHandler(delta: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(diff, camera, config);
    return delta;
}

// the anchor point is in the viewport space
export function baseZoomToAtHandler(destination: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    const beforeZoomLevel = camera.zoomLevel;
    camera.setZoomLevel(destination);
    const afterZoomLevel = camera.zoomLevel;
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(diff, camera, config);

    // const cursorWithZoomLevelBefore = PointCal.multiplyVectorByScalar(at, 1 / beforeZoomLevel);
    // const cursorWithZoomLevelAfter = PointCal.multiplyVectorByScalar(at, 1 / afterZoomLevel);
    // const sin = Math.sin(camera.rotation);
    // const cos = Math.cos(camera.rotation);
    // const deltaX = (cursorWithZoomLevelAfter.y - cursorWithZoomLevelBefore.y) * sin + (cursorWithZoomLevelBefore.x - cursorWithZoomLevelAfter.x) * cos;
    // const deltaY = (cursorWithZoomLevelBefore.y - cursorWithZoomLevelAfter.y) * cos + (cursorWithZoomLevelBefore.x - cursorWithZoomLevelAfter.x) * sin;
    // config.panByHandler(camera, {x: deltaX, y: deltaY}, config);
    return destination;
}

// the anchor point is in the world space
export function baseZoomToAtWorldHandler(destination: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    let anchorInViewPortBeforeZoom = camera.convertFromWorld2ViewPort(at);
    camera.setZoomLevel(destination);
    let anchorInViewPortAfterZoom = camera.convertFromWorld2ViewPort(at);
    const diffInViewPort = PointCal.subVector(anchorInViewPortAfterZoom, anchorInViewPortBeforeZoom);
    const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, camera.zoomLevel, camera.rotation);
    // console.log("--------------------------------");
    // console.log("diffInWorld", diffInWorld);
    // console.log("camera pos before", camera.position);
    config.panByHandler(diffInWorld, camera, config);
    // console.log("camera pos after", camera.position);
    return destination;
}

// the anchor point is in the world space
export function baseZoomByAtWorldHandler(delta: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    let anchorInViewPortBeforeZoom = camera.convertFromWorld2ViewPort(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInViewPortAfterZoom = camera.convertFromWorld2ViewPort(at);
    const diffInViewPort = PointCal.subVector(anchorInViewPortBeforeZoom, anchorInViewPortAfterZoom);
    const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, camera.zoomLevel, camera.rotation);
    config.panByHandler(diffInWorld, camera, config);
    return delta;
}

export function baseZoomToHandler(destination: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    camera.setZoomLevel(destination);
    return destination;
}

export function baseZoomByHandler(delta: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    camera.setZoomLevel(camera.zoomLevel + delta);
    return delta;
}

export function clampZoomToAtHandler(destination: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    return clampZoomToHandler(destination, camera, config);
}

export function clampZoomToHandler(destination: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    return clampZoomLevel(destination, camera.zoomBoundaries);
}

export function clampZoomByHandler(delta: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    let targetZoom = camera.zoomLevel + delta;
    targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
    delta = targetZoom - camera.zoomLevel;
    return delta;
}

export function restrictZoomToHandler(destination: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    if(config.restrictZoom){
        return camera.zoomLevel;
    }
    return destination;
}

export function restrictZoomByHandler(delta: number, camera: BoardCamera, config: BaseZoomHandlerConfig): number {
    if(config.restrictZoom){
        return 0;
    }
    return delta;
}

export function clampZoomByAtHandler(delta: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    return clampZoomByHandler(delta, camera, config);
}

export function restrictZoomToAtHandler(destination: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    return restrictZoomToHandler(destination, camera, config);
}

export function restrictZoomByAtHandler(delta: number, camera: BoardCamera, at: Point, config: ZoomHandlerConfig): number {
    return restrictZoomByHandler(delta, camera, config);
}

export function createDefaultZoomToAtHandler(): ZoomToAtHandlerFunction {
    return createHandlerChain(
        clampZoomToAtHandler,
        restrictZoomToAtHandler,
        baseZoomToAtHandler,
    );
}

export function createDefaultZoomByAtHandler(): ZoomByAtHandlerFunction {
    return createHandlerChain(
        clampZoomByAtHandler,
        restrictZoomByAtHandler,
        baseZoomByAtHandler,
    );
}

export function createDefaultZoomToAtWorldHandler(): ZoomToAtHandlerFunction {
    return createHandlerChain(
        clampZoomToAtHandler,
        restrictZoomToAtHandler,
        baseZoomToAtWorldHandler,
    );
}

export function createDefaultZoomByAtWorldHandler(): ZoomByAtHandlerFunction {
    return createHandlerChain(
        clampZoomByAtHandler,
        restrictZoomByAtHandler,
        baseZoomByAtWorldHandler,
    );
}

export function createDefaultZoomToOnlyHandler(): ZoomToHandlerFunction {
    return createHandlerChain(
        clampZoomToHandler,
        restrictZoomToHandler,
        baseZoomToHandler,
    );
}

export function createDefaultZoomByOnlyHandler(): ZoomByHandlerFunction {
    return createHandlerChain(
        clampZoomByHandler,
        restrictZoomByHandler,
        baseZoomByHandler,
    );
}
