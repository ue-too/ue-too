import { BoardCamera } from "src/board-camera/interface";
import { createHandlerChain } from "src/util/handler-pipeline";
import { normalizeAngleZero2TwoPI, angleSpan, clampRotation } from "src/board-camera/utils/rotation";

/**
 * @description This is the configuration for the rotation handler functions.
 * This is the configuration object that is passed to the rotation handler functions.
 * 
 * @category Camera
 */
export type RotationHandlerConfig = {
    /**
     * @description Whether to restrict the rotation. (if true, rotation input will be ignored)
     */
    restrictRotation: boolean;
    /**
     * @description Whether to clamp the rotation if the rotation is out of the rotation boundaries.
     */
    clampRotation: boolean;
};

/**
 * @description The function that is used to rotate the camera by a specific delta. 
 * The delta is in radians.
 * This is structured as a handler pipeline. 
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export type RotateByHandlerFunction = (delta: number, camera: BoardCamera, config: RotationHandlerConfig) => number;
/**
 * @description The function that is used to rotate the camera to a specific target rotation.
 * The target rotation is in radians.
 * This is structured as a handler pipeline. 
 * 
 * @see {@link createHandlerChain}
 * @category Camera
 */
export type RotateToHandlerFunction = (targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig) => number;

/**
 * @description This is the base handler for the "rotate by" handler pipeline.
 * It normalizes the delta to the range of 0 to 2π, and then sets the rotation of the camera to the new rotation.
 * 
 * @category Camera
 */
export function baseRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    camera.setRotation(targetRotation);
    return delta;
}

/**
 * @description This is the clamp handler for the "rotate by" handler pipeline.
 * It clamps the delta to the range of the camera's rotation boundaries.
 * 
 * @category Camera
 */
export function clampRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(!config.clampRotation){
        return delta;
    }
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

/**
 * @description This is the restrict handler for the "rotate by" handler pipeline.
 * It restricts the delta to the range of the camera's rotation boundaries.
 * 
 * @category Camera
 */
export function restrictRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return 0;
    }
    return delta;
}

/**
 * @description This is the base handler for the "rotate to" handler pipeline.
 * It sets the rotation of the camera to the target rotation.
 * 
 * @category Camera
 */
export function baseRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    camera.setRotation(targetRotation);
    return targetRotation;
}

/**
 * @description This is the clamp handler for the "rotate to" handler pipeline.
 * It clamps the target rotation to the range of the camera's rotation boundaries.
 * 
 * @category Camera
 */
export function clampRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(!config.clampRotation){
        return targetRotation;
    }
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

/**
 * @description This is the restrict handler for the "rotate to" handler pipeline.
 * It restricts the target rotation to the range of the camera's rotation boundaries.
 * 
 * @category Camera
 */
export function restrictRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return camera.rotation;
    }
    return targetRotation;
}

/**
 * @description This is the create default handler chain function for the "rotate by" handler pipeline.
 * 
 * @category Camera
 */
export function createDefaultRotateByHandler(): RotateByHandlerFunction {
    return createHandlerChain([baseRotateByHandler, clampRotateByHandler, restrictRotateByHandler]);
}

/**
 * @description This is the create default handler chain function for the "rotate to" handler pipeline.
 * 
 * @category Camera
 */
export function createDefaultRotateToHandler(): RotateToHandlerFunction {
    return createHandlerChain([baseRotateToHandler, clampRotateToHandler, restrictRotateToHandler]);
}
