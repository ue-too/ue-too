import { BoardCamera } from "../interface";
import { createHandlerChain } from "../../utils/handler-pipeline";
import { clampZoomLevel } from "../utils/zoom";

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
