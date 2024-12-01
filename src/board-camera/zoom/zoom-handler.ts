import type { Point } from "src/index";
import BoardCamera from "src/board-camera/board-camera-v2";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import type { PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";

export type ZoomHandlerConfig = {
    restrictZoom: boolean;
    panByHandler: PanByHandlerFunction;
} & PanHandlerConfig;

export type ZoomToAtHandlerFunction = (camera: BoardCamera, destination: number, at: Point, config: ZoomHandlerConfig) => number;
export type ZoomByAtHandlerFunction = (camera: BoardCamera, delta: number, at: Point, config: ZoomHandlerConfig) => number;

export function createZoomToHandlerChain(...handlers: ZoomToAtHandlerFunction[] | [ZoomToAtHandlerFunction[]]): ZoomToAtHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomToAtHandlerFunction[];
    return (camera: BoardCamera, destination: number, at: Point, config: ZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDestination, currentHandler) => {
            return currentHandler(camera, currentDestination, at, config);
        }, destination);
    }
}

export function createZoomByHandlerChain(...handlers: ZoomByAtHandlerFunction[] | [ZoomByAtHandlerFunction[]]): ZoomByAtHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as ZoomByAtHandlerFunction[];
    return (camera: BoardCamera, delta: number, at: Point, config: ZoomHandlerConfig) => {
        return normalizedHandlers.reduce((currentDelta, currentHandler) => {
            return currentHandler(camera, currentDelta, at, config);
        }, delta);
    }
}

export function baseZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: ZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    camera.setZoomLevel(destination);
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(camera, diff, config);
    return destination;
}

export function baseZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: ZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(camera, diff, config);
    return delta;
}

export function clampZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: ZoomHandlerConfig): number {
    return clampZoomLevel(destination, camera.zoomBoundaries);
}

export function clampZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: ZoomHandlerConfig): number {
    let targetZoom = camera.zoomLevel + delta;
    targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
    delta = targetZoom - camera.zoomLevel;
    return delta;
}

export function restrictZoomToAtHandler(camera: BoardCamera, destination: number, at: Point, config: ZoomHandlerConfig): number {
    if(config.restrictZoom){
        return camera.zoomLevel;
    }
    return destination;
}

export function restrictZoomByAtHandler(camera: BoardCamera, delta: number, at: Point, config: ZoomHandlerConfig): number {
    if(config.restrictZoom){
        return 0;
    }
    return delta;
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
