import { BoardCamera } from "src/board-camera/interface";
import { createHandlerChain } from "../utils";
import { normalizeAngleZero2TwoPI, angleSpan, clampRotation } from "src/board-camera/utils/rotation";

export type RotationHandlerConfig = {
    restrictRotation: boolean;
};

export type RotateByHandlerFunction = (delta: number, camera: BoardCamera, config: RotationHandlerConfig) => number;
export type RotateToHandlerFunction = (targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig) => number;

export function baseRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    camera.setRotation(targetRotation);
    return delta;
}

export function clampRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

export function restrictRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return 0;
    }
    return delta;
}

export function baseRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    camera.setRotation(targetRotation);
    return targetRotation;
}

export function clampRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

export function restrictRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return camera.rotation;
    }
    return targetRotation;
}

export const rotateBy = createHandlerChain(
    [baseRotateByHandler,
    clampRotateByHandler,
    restrictRotateByHandler]
);

export const rotateTo = createHandlerChain(
    [baseRotateToHandler,
    clampRotateToHandler,
    restrictRotateToHandler]
);

export function createDefaultRotateByHandler(): RotateByHandlerFunction {
    return createHandlerChain([baseRotateByHandler, clampRotateByHandler, restrictRotateByHandler]);
}

export function createDefaultRotateToHandler(): RotateToHandlerFunction {
    return createHandlerChain([baseRotateToHandler, clampRotateToHandler, restrictRotateToHandler]);
}
