import { PointCal } from "point2point";
import type { Point } from "src/index";
import { BoardCamera } from "src/board-camera";
import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";

export type PanHandlerConfig = {
    entireViewPort: boolean;
    restrictXTranslation: boolean;
    restrictYTranslation: boolean;
    restrictRelativeXTranslation: boolean;
    restrictRelativeYTranslation: boolean;
}

// delta and destination are in world "stage/context" space
export type PanToHandlerFunction = (camera: BoardCamera, destination: Point, config: PanHandlerConfig) => Point;
export type PanByHandlerFunction = (camera: BoardCamera, delta: Point, config: PanHandlerConfig) => Point;

export function createPanToHandlerChain(...handlers: PanToHandlerFunction[] | [PanToHandlerFunction[]]): PanToHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as PanToHandlerFunction[];
    return (camera: BoardCamera, destination: Point, config: PanHandlerConfig) => {
        return normalizedHandlers.reduce<Point>((currentDestination, currentHandler) => {
            return currentHandler(camera, currentDestination, config);
        }, destination);
    };
}

export function createPanByHandlerChain(...handlers: PanByHandlerFunction[] | [PanByHandlerFunction[]]): PanByHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as PanByHandlerFunction[];
    return (camera: BoardCamera, delta: Point, config: PanHandlerConfig) => {
        return normalizedHandlers.reduce((currentDelta, currentHandler) => {
            return currentHandler(camera, currentDelta, config);
        }, delta);
    };
}

export function createDefaultPanToHandler(): PanToHandlerFunction {
    return createPanToHandlerChain(restrictPanToHandler, clampToHandler, PanToBaseHandler);
}

export function createDefaultPanByHandler(): PanByHandlerFunction {
    return createPanByHandlerChain(restrictPanByHandler, clampByHandler, PanByBaseHandler);
}

export function restrictPanToHandler(camera: BoardCamera, destination: Point, config: PanHandlerConfig): Point {
    let delta = PointCal.subVector(destination, camera.position);
    delta = convertDeltaToComplyWithRestriction(camera, delta, config);
    if (delta.x === 0 && delta.y === 0) {
        return destination;
    }
    const dest = PointCal.addVector(camera.position, delta);
    return dest;
}

export function restrictPanByHandler(camera: BoardCamera, delta: Point, config: PanHandlerConfig): Point {
    delta = convertDeltaToComplyWithRestriction(camera, delta, config);
    return delta;
}

export function clampToHandler(camera: BoardCamera, destination: Point, config: PanHandlerConfig): Point {
    let actualDest = clampPoint(destination, camera.boundaries);
    if(config.entireViewPort){
        actualDest = clampPointEntireViewPort(destination, camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation);
    }
    return actualDest;
}

export function clampByHandler(camera: BoardCamera, delta: Point, config: PanHandlerConfig): Point {
    let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(camera.position, delta), camera.boundaries), camera.position);
    if(config.entireViewPort){
        actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(camera.position, delta), camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation), camera.position);
    }
    return actualDelta;
}

function PanByBaseHandler(camera: BoardCamera, delta: Point, config: PanHandlerConfig): Point {
    const target = PointCal.addVector(camera.position, delta);
    camera.setPosition(target);
    return delta;
}

export function PanToBaseHandler(camera: BoardCamera, destination: Point, config: PanHandlerConfig): Point {
    camera.setPosition(destination);
    return destination;
}

export function convertDeltaToComplyWithRestriction(camera: BoardCamera, delta: Point, config: PanHandlerConfig): Point {
    if(config.restrictXTranslation && config.restrictYTranslation){
        return {x: 0, y: 0};
    }
    if(config.restrictRelativeXTranslation && config.restrictRelativeYTranslation){
        return {x: 0, y: 0};
    }
    if(config.restrictXTranslation){
        delta.x = 0;
    }
    if(config.restrictYTranslation){
        delta.y = 0;
    }
    if(config.restrictRelativeXTranslation){
        const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, camera.rotation);
        const value = PointCal.dotProduct(upDirection, delta);
        delta = PointCal.multiplyVectorByScalar(upDirection, value);
    }
    if(config.restrictRelativeYTranslation){
        const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, camera.rotation);
        const value = PointCal.dotProduct(rightDirection, delta);
        delta = PointCal.multiplyVectorByScalar(rightDirection, value);
    }
    return delta;
}

export function convertUserInputDeltaToCameraDelta(camera: BoardCamera, delta: Point): Point {
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, camera.rotation), 1 / camera.zoomLevel);
}
