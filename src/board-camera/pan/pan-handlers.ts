import { PointCal } from "point2point";
import type { Point } from "src/util/misc";
import { BoardCamera } from "src/board-camera/interface";
import { createHandlerChain } from "src/board-camera/utils";
import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";


export type PanHandlerConfig = {
    limitEntireViewPort: boolean;
    restrictXTranslation: boolean;
    restrictYTranslation: boolean;
    restrictRelativeXTranslation: boolean;
    restrictRelativeYTranslation: boolean;
}

// delta and destination are in world "stage/context" space
export type PanToHandlerFunction = (destination: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;
export type PanByHandlerFunction = (delta: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;

export function createDefaultPanToHandler(): PanToHandlerFunction {
    return createHandlerChain(
        restrictPanToHandler,
        clampToHandler,
        PanToBaseHandler
    );
}

export function createDefaultPanByHandler(): PanByHandlerFunction {
    return createHandlerChain(
        restrictPanByHandler,
        clampByHandler,
        PanByBaseHandler
    );
}

export function restrictPanToHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let delta = PointCal.subVector(destination, camera.position);
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    if (delta.x === 0 && delta.y === 0) {
        return destination;
    }
    const dest = PointCal.addVector(camera.position, delta);
    return dest;
}

export function restrictPanByHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    return delta;
}

export function clampToHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let actualDest = clampPoint(destination, camera.boundaries);
    if(config.limitEntireViewPort){
        actualDest = clampPointEntireViewPort(destination, camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation);
    }
    return actualDest;
}

export function clampByHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(camera.position, delta), camera.boundaries), camera.position);
    if(config.limitEntireViewPort){
        actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(camera.position, delta), camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation), camera.position);
    }
    return actualDelta;
}

function PanByBaseHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    const target = PointCal.addVector(camera.position, delta);
    camera.setPosition(target);
    return delta;
}

function PanToBaseHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    camera.setPosition(destination);
    return destination;
}

export function convertDeltaToComplyWithRestriction(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
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

export function convertUserInputDeltaToCameraDelta(delta: Point, camera: BoardCamera): Point {
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, camera.rotation), 1 / camera.zoomLevel);
}
