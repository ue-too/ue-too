import type { Point } from "src/util/misc";
import { BoardCamera } from "src/board-camera";
import { createHandlerChain } from "src/util/handler-pipeline";
import { convertDeltaInViewPortToWorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import type { PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";

/**
 * @description The configuration for the base zoom handler.
 * 
 * @category Camera
 */
export type ZoomHandlerConfig = ZoomHandlerClampConfig & ZoomHandlerRestrictConfig;

export type ZoomHandlerClampConfig = {
    /**
     * @description Whether to clamp the zoom level.
     */
    clampZoom: boolean;
};

export type ZoomHandlerRestrictConfig = {
    /**
     * @description Whether to restrict the zoom level.
     */
    restrictZoom: boolean;
};

/**
 * @description The configuration for the zoom handler. (because zoom at a point requires panning as well so the complete config would contain pan handler config as well)
 * 
 * @category Camera
 */
type LegacyZoomHandlerConfig = ZoomHandlerConfig & PanHandlerConfig & {
    panByHandler: PanByHandlerFunction;
};

/**
 * @description The function signature for the zoom to handler.
 * 
 * @category Camera
 */
export type ZoomToHandlerFunction = (destination: number, camera: BoardCamera, config: ZoomHandlerConfig) => number;

/**
 * @description The function signature for the zoom by handler.
 * 
 * @category Camera
 */
export type ZoomByHandlerFunction = (delta: number, camera: BoardCamera, config: ZoomHandlerConfig) => number;

/**
 * @description The function that is part of the zoom by at handler pipeline.
 * The anchor point is in the viewport space. (the origin of the viewport is the center of the screen)
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomByAtHandler(delta: number, camera: BoardCamera, at: Point, config: LegacyZoomHandlerConfig): number {
    let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
    const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
    config.panByHandler(diff, camera, config);
    return delta;
}

/**
 * @description The function that is part of the zoom to at handler pipeline.
 * The anchor point is in the viewport space. (the origin of the viewport is the center of the screen)
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomToAtHandler(destination: number, camera: BoardCamera, at: Point, config: LegacyZoomHandlerConfig): number {
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

/**
 * @description The function that is part of the zoom to at handler pipeline.
 * The anchor point is in the world space.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomToAtWorldHandler(destination: number, camera: BoardCamera, at: Point, config: LegacyZoomHandlerConfig): number {
    let anchorInViewPortBeforeZoom = camera.convertFromWorld2ViewPort(at);
    camera.setZoomLevel(destination);
    let anchorInViewPortAfterZoom = camera.convertFromWorld2ViewPort(at);
    const diffInViewPort = PointCal.subVector(anchorInViewPortAfterZoom, anchorInViewPortBeforeZoom);
    const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, camera.zoomLevel, camera.rotation);
    config.panByHandler(diffInWorld, camera, config);
    return destination;
}

/**
 * @description The function that is part of the zoom by at handler pipeline.
 * The anchor point is in the world space.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomByAtWorldHandler(delta: number, camera: BoardCamera, at: Point, config: LegacyZoomHandlerConfig): number {
    let anchorInViewPortBeforeZoom = camera.convertFromWorld2ViewPort(at);
    camera.setZoomLevel(camera.zoomLevel + delta);
    let anchorInViewPortAfterZoom = camera.convertFromWorld2ViewPort(at);
    const diffInViewPort = PointCal.subVector(anchorInViewPortBeforeZoom, anchorInViewPortAfterZoom);
    const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, camera.zoomLevel, camera.rotation);
    config.panByHandler(diffInWorld, camera, config);
    return delta;
}

/**
 * @description The function that is part of the zoom to handler pipeline.
 * This would zoom at the center of the viewport.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomToHandler(destination: number, camera: BoardCamera, config: ZoomHandlerConfig): number {
    camera.setZoomLevel(destination);
    return destination;
}

/**
 * @description The function that is part of the zoom by handler pipeline.
 * This would zoom at the center of the viewport.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
function baseZoomByHandler(delta: number, camera: BoardCamera, config: ZoomHandlerConfig): number {
    camera.setZoomLevel(camera.zoomLevel + delta);
    return delta;
}

/**
 * @description The function that is part of the zoom to handler pipeline.
 * Clamps the zoom level to the zoom boundaries.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function clampZoomToHandler(destination: number, camera: BoardCamera, config: ZoomHandlerClampConfig): number {
    if(!config.clampZoom){
        return destination;
    }
    return clampZoomLevel(destination, camera.zoomBoundaries);
}

/**
 * @description The function that is part of the zoom by handler pipeline.
 * Clamps the zoom level to the zoom boundaries.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function clampZoomByHandler(delta: number, camera: BoardCamera, config: ZoomHandlerClampConfig): number {
    if(!config.clampZoom){
        return delta;
    }
    let targetZoom = camera.zoomLevel + delta;
    targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
    delta = targetZoom - camera.zoomLevel;
    return delta;
}

/**
 * @description The function that is part of the zoom to handler pipeline.
 * Restricts the zoom level to the zoom boundaries.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function restrictZoomToHandler(destination: number, camera: BoardCamera, config: ZoomHandlerRestrictConfig): number {
    if(config.restrictZoom){
        return camera.zoomLevel;
    }
    return destination;
}

/**
 * @description The function that is part of the zoom by handler pipeline.
 * Restricts the zoom level to the zoom boundaries.
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function restrictZoomByHandler(delta: number, camera: BoardCamera, config: ZoomHandlerRestrictConfig): number {
    if(config.restrictZoom){
        return 0;
    }
    return delta;
}

/**
 * @description The function that creates the default zoom to only handler.
 * clamp -> restrict -> base
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function createDefaultZoomToOnlyHandler(): ZoomToHandlerFunction {
    return createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
        clampZoomToHandler,
        restrictZoomToHandler,
    );
}

/**
 * @description The function that creates the default zoom by only handler.
 * clamp -> restrict -> base
 * @see {@link createHandlerChain}
 * @category Camera
 */
export function createDefaultZoomByOnlyHandler(): ZoomByHandlerFunction {
    return createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
        clampZoomByHandler,
        restrictZoomByHandler,
    );
}
