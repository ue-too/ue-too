import type { Point } from "src/index";
import { BoardCamera } from "src/board-camera";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import type { PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";

export type BaseZoomHandlerConfig = {
    restrictZoom: boolean;
};

export type CompleteZoomHandlerConfig = BaseZoomHandlerConfig & PanHandlerConfig & {
    panByHandler: PanByHandlerFunction;
};

export type ZoomToAtHandlerFunction = (camera: BoardCamera, destination: number, at: Point, config: CompleteZoomHandlerConfig) => number;
export type ZoomByAtHandlerFunction = (camera: BoardCamera, delta: number, at: Point, config: CompleteZoomHandlerConfig) => number;
export type ZoomToHandlerFunction = (camera: BoardCamera, destination: number, config: BaseZoomHandlerConfig) => number;
export type ZoomByHandlerFunction = (camera: BoardCamera, delta: number, config: BaseZoomHandlerConfig) => number;

export function createZoomToHandlerChain(...handlers: ZoomToAtHandlerFunction[] | [ZoomToAtHandlerFunction[]]): ZoomToAtHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomToAtHandlerFunction[];
    return (camera: BoardCamera, destination: number, at: Point, config: CompleteZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDestination, currentHandler) => {
            return currentHandler(camera, currentDestination, at, config);
        }, destination);
    }
}

export function createZoomByHandlerChain(...handlers: ZoomByAtHandlerFunction[] | [ZoomByAtHandlerFunction[]]): ZoomByAtHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomByAtHandlerFunction[];
    return (camera: BoardCamera, delta: number, at: Point, config: CompleteZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDelta, currentHandler) => {
            return currentHandler(camera, currentDelta, at, config);
        }, delta);
    }
}

export function createOnlyZoomToHandlerChain(...handlers: ZoomToHandlerFunction[] | [ZoomToHandlerFunction[]]): ZoomToHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomToHandlerFunction[];
    return (camera: BoardCamera, destination: number, config: BaseZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDestination, currentHandler) => {
            return currentHandler(camera, currentDestination, config);
        }, destination);
    }
}

export function createOnlyZoomByHandlerChain(...handlers: ZoomByHandlerFunction[] | [ZoomByHandlerFunction[]]): ZoomByHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomByHandlerFunction[];
    return (camera: BoardCamera, delta: number, config: BaseZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDelta, currentHandler) => {
            return currentHandler(camera, currentDelta, config);
        }, delta);
    }
}

export function baseZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: CompleteZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    const beforeZoomLevel = camera.zoomLevel;
    camera.setZoomLevel(destination);
    const afterZoomLevel = camera.zoomLevel;
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(camera, diff, config);

    // const cursorWithZoomLevelBefore = PointCal.multiplyVectorByScalar(at, 1 / beforeZoomLevel);
    // const cursorWithZoomLevelAfter = PointCal.multiplyVectorByScalar(at, 1 / afterZoomLevel);
    // const sin = Math.sin(camera.rotation);
    // const cos = Math.cos(camera.rotation);
    // const deltaX = (cursorWithZoomLevelAfter.y - cursorWithZoomLevelBefore.y) * sin + (cursorWithZoomLevelBefore.x - cursorWithZoomLevelAfter.x) * cos;
    // const deltaY = (cursorWithZoomLevelBefore.y - cursorWithZoomLevelAfter.y) * cos + (cursorWithZoomLevelBefore.x - cursorWithZoomLevelAfter.x) * sin;
    // config.panByHandler(camera, {x: deltaX, y: deltaY}, config);
    return destination;
}

export function baseZoomToHandler(camera: BoardCamera, destination: number, config: BaseZoomHandlerConfig): number {
    camera.setZoomLevel(destination);
    return destination;
}

export function baseZoomByHandler(camera: BoardCamera, delta: number, config: BaseZoomHandlerConfig): number {
    camera.setZoomLevel(camera.zoomLevel + delta);
    return delta;
}

export function baseZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: CompleteZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(camera, diff, config);
    return delta;
}

export function clampZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: CompleteZoomHandlerConfig): number {
    return clampZoomToHandler(camera, destination, config);
}

export function clampZoomToHandler(camera: BoardCamera, destination: number, config: BaseZoomHandlerConfig): number {
    return clampZoomLevel(destination, camera.zoomBoundaries);
}

export function clampZoomByHandler(camera: BoardCamera, delta: number, config: BaseZoomHandlerConfig): number {
    let targetZoom = camera.zoomLevel + delta;
    targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
    delta = targetZoom - camera.zoomLevel;
    return delta;
}

export function restrictZoomToHandler(camera: BoardCamera, destination: number, config: BaseZoomHandlerConfig): number {
    if(config.restrictZoom){
        return camera.zoomLevel;
    }
    return destination;
}

export function restrictZoomByHandler(camera: BoardCamera, delta: number, config: BaseZoomHandlerConfig): number {
    if(config.restrictZoom){
        return 0;
    }
    return delta;
}

export function clampZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: CompleteZoomHandlerConfig): number {
    return clampZoomByHandler(camera, delta, config);
}

export function restrictZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: CompleteZoomHandlerConfig): number {
    return restrictZoomToHandler(camera, destination, config);
}

export function restrictZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: CompleteZoomHandlerConfig): number {
    return restrictZoomByHandler(camera, delta, config);
}

export function createDefaultZoomToAtHandler(): ZoomToAtHandlerFunction {
    return createZoomToHandlerChain(
        clampZoomToAtHandler,
        restrictZoomToAtHandler,
        baseZoomToAtHandler,
    );
}

export function createDefaultZoomByAtHandler(): ZoomByAtHandlerFunction {
    return createZoomByHandlerChain(
        clampZoomByAtHandler,
        restrictZoomByAtHandler,
        baseZoomByAtHandler,
    );
}

export function createDefaultZoomToOnlyHandler(): ZoomToHandlerFunction {
    return createOnlyZoomToHandlerChain(
        clampZoomToHandler,
        restrictZoomToHandler,
        baseZoomToHandler,
    );
}

export function createDefaultZoomByOnlyHandler(): ZoomByHandlerFunction {
    return createOnlyZoomByHandlerChain(
        clampZoomByHandler,
        restrictZoomByHandler,
        baseZoomByHandler,
    );
}
