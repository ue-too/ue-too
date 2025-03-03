import { PointCal } from "point2point";
import type { Point } from "src/util/misc";
import { BoardCamera } from "src/board-camera/interface";
import { createHandlerChain } from "src/util/handler-pipeline";
import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";

/**
 * @description Configuration for the pan handler functions.
 * 
 * @category Camera
 */
export type PanHandlerConfig = {
    /**
     * @description Whether to limit the pan to the entire view port.
     */
    limitEntireViewPort: boolean;
    /**
     * @description Whether to restrict the x translation.
     */
    restrictXTranslation: boolean;
    /**
     * @description Whether to restrict the y translation.
     */
    restrictYTranslation: boolean;
    /**
     * @description Whether to restrict the relative x translation. (because the camera can be rotated, the relative x translation is the horizontal direction of what the user sees on the screen)
     */
    restrictRelativeXTranslation: boolean;
    /**
     * @description Whether to restrict the relative y translation. (because the camera can be rotated, the relative y translation is the vertical direction of what the user sees on the screen)
     */
    restrictRelativeYTranslation: boolean;
}

/**
 * @description Function Type that is used to define the "pan to" handler.
 * The destination is in "stage/context/world" space.
 * This is structured as a handler pipeline. 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export type PanToHandlerFunction = (destination: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;
/**
 * @description Function Type that is used to define the "pan by" handler.
 * The delta is in "stage/context/world" space.
 * This is structured as a handler pipeline. 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export type PanByHandlerFunction = (delta: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;

/**
 * @description Helper function that creates a default "pan to" handler.
 * The default pan to handler will first restrict the pan to the view port, then clamp the pan to the boundaries, and then pan to the destination.
 * 
 * @see {@link createHandlerChain} to create your own custom pan handler pipeline. (you can also use this function as a part of your own custom pan handler pipeline)
 * @category Camera
 */
export function createDefaultPanToHandler(): PanToHandlerFunction {
    return createHandlerChain(
        restrictPanToHandler,
        clampToHandler,
        PanToBaseHandler
    );
}

/**
 * @description Helper function that creates a default "pan by" handler.
 * The default pan by handler will first restrict the pan by the view port, then clamp the pan by the boundaries, and then pan by the delta.
 * 
 * @see {@link createHandlerChain} to create your own custom pan handler pipeline. (you can also use this function as a part of your own custom pan handler pipeline)
 * @category Camera
 */
export function createDefaultPanByHandler(): PanByHandlerFunction {
    return createHandlerChain(
        restrictPanByHandler,
        clampByHandler,
        PanByBaseHandler
    );
}

/**
 * @description Function that is part of the "pan to" handler pipeline. It restricts the "pan to" destination to within a single axis based on the config. (relative to the current camera position)
 * You can use this function standalone to restrict the "pan to" destination to within a single axis based on the config. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
export function restrictPanToHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let delta = PointCal.subVector(destination, camera.position);
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    if (delta.x === 0 && delta.y === 0) {
        return destination;
    }
    const dest = PointCal.addVector(camera.position, delta);
    return dest;
}

/**
 * @description Function that is part of the "pan by" handler pipeline. It restricts the pan delta to within a single axis based on the config. (relative to the current camera position)
 * You can use this function standalone to restrict the pan delta to within a single axis based on the config. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
export function restrictPanByHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    return delta;
}

/**
 * @description Function that is part of the "pan to" handler pipeline. It clamps the pan destination within the boundaries of the view port.
 * You can use this function standalone to clamp the pan destination within the boundaries of the view port. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
export function clampToHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let actualDest = clampPoint(destination, camera.boundaries);
    if(config.limitEntireViewPort){
        actualDest = clampPointEntireViewPort(destination, camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation);
    }
    return actualDest;
}

/**
 * @description Function that is part of the "pan by" handler pipeline. It clamps the pan delta within the boundaries of the view port.
 * You can use this function standalone to clamp the pan delta within the boundaries of the view port. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
export function clampByHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(camera.position, delta), camera.boundaries), camera.position);
    if(config.limitEntireViewPort){
        actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(camera.position, delta), camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation), camera.position);
    }
    return actualDelta;
}

/**
 * @description Function that is part of the "pan by" handler pipeline. It pans the camera by the delta.
 * You can use this function standalone to pan the camera by the delta. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
function PanByBaseHandler(delta: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    const target = PointCal.addVector(camera.position, delta);
    camera.setPosition(target);
    return delta;
}

/**
 * @description Function that is part of the "pan to" handler pipeline. It pans the camera to the destination.
 * You can use this function standalone to pan the camera to the destination. 
 * But it is recommended to use this kind of function as part of the pan handler pipeline. (to include this function in your own custom pan handler pipeline)
 * 
 * @category Camera
 */
function PanToBaseHandler(destination: Point, camera: BoardCamera, config: PanHandlerConfig): Point {
    camera.setPosition(destination);
    return destination;
}

/**
 * @description Helper function that converts the delta to comply with the restrictions of the config.
 * 
 * @category Camera
 */
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

/**
 * @description Helper function that converts the user input delta to the camera delta.
 * 
 * @category Camera
 */
export function convertUserInputDeltaToCameraDelta(delta: Point, camera: BoardCamera): Point {
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, camera.rotation), 1 / camera.zoomLevel);
}
