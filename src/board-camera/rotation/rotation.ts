import { normalizeAngleZero2TwoPI, angleSpan, clampRotation } from "src/board-camera/utils/rotation";
import type { BoardCamera } from "../interface";

export interface RotationHandler {
    nextHandler?: RotationHandler;
    chainHandler(handler: RotationHandler): RotationHandler;
    rotateCameraTo(camera: BoardCamera, targetRotation: number): void
    rotateCameraBy(camera: BoardCamera, delta: number): void
}

export interface RotationController extends RotationHandler {
    restrictRotation: boolean;
}

export abstract class RotationHandlerBoilerPlate implements RotationHandler {

    private _nextHandler?: RotationHandler;

    constructor(nextHandler: RotationHandler | undefined = undefined) {
        this._nextHandler = nextHandler;
    }

    set nextHandler(handler: RotationHandler | undefined) {
        this._nextHandler = handler;
    }

    get nextHandler(): RotationHandler | undefined {
        return this._nextHandler;
    }

    chainHandler(handler: RotationHandler): RotationHandler {
        this._nextHandler = handler;
        return handler;
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void {
        if(this._nextHandler){
            this._nextHandler.rotateCameraTo(camera, targetRotation);
        }
    }

    rotateCameraBy(camera: BoardCamera, delta: number): void {
        if(this._nextHandler){
            this._nextHandler.rotateCameraBy(camera, delta);
        }
    }

}

export class BaseRotationHandler extends RotationHandlerBoilerPlate{

    constructor(nextHandler: RotationHandler | undefined = undefined) {
        super();
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void{
        targetRotation = normalizeAngleZero2TwoPI(targetRotation);
        camera.setRotation(targetRotation);
    }

    rotateCameraBy(camera: BoardCamera, diff: number): void {
        const curRotation = camera.rotation;
        const targetRotation = normalizeAngleZero2TwoPI(curRotation + diff);
        diff = angleSpan(curRotation, targetRotation);
        camera.setRotation(targetRotation);
    }
}

export class RotationRestrictionHandler extends RotationHandlerBoilerPlate{

    private _restrictRotation: boolean = false;

    constructor(nextHandler: RotationHandler | undefined = undefined) {
        super(nextHandler);
    }

    get restrictRotation(): boolean{
        return this._restrictRotation;
    }

    set restrictRotation(restrictRotation: boolean){
        this._restrictRotation = restrictRotation;
    }

    rotateCameraBy(camera: BoardCamera, diff: number): void {
        if(this._restrictRotation){
            return;
        }
        super.rotateCameraBy(camera, diff);
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void {
        if(this._restrictRotation){
            return;
        }
        super.rotateCameraTo(camera, targetRotation);
    }
}

export class RotationClampHandler extends RotationHandlerBoilerPlate{
    

    constructor(nextHandler: RotationHandler | undefined = undefined) {
        super(nextHandler);
    }

    rotateCameraBy(camera: BoardCamera, diff: number): void {
        const curRotation = camera.rotation;
        let targetRotation = normalizeAngleZero2TwoPI(curRotation + diff);
        targetRotation = clampRotation(targetRotation, camera.rotationBoundaries); 
        diff = angleSpan(curRotation, targetRotation);
        super.rotateCameraBy(camera, diff);
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void {
        targetRotation = normalizeAngleZero2TwoPI(targetRotation);
        targetRotation = clampRotation(targetRotation, camera.rotationBoundaries);
        super.rotateCameraTo(camera, targetRotation);
    }
}

export class RotationRig extends RotationHandlerBoilerPlate implements RotationController {

    private _baseHandler: BaseRotationHandler;
    private _clampHandler: RotationClampHandler;
    private _restrictionHandler: RotationRestrictionHandler;

    get restrictRotation(): boolean{
        return this._restrictionHandler.restrictRotation;
    }

    set restrictRotation(restrictRotation: boolean){
        this._restrictionHandler.restrictRotation = restrictRotation;
    }

    constructor(nextHandler: RotationHandler | undefined = undefined) {
        super(nextHandler);
        this._baseHandler = new BaseRotationHandler();
        this._clampHandler = new RotationClampHandler(this._baseHandler);
        this._restrictionHandler = new RotationRestrictionHandler(this._clampHandler);
    }

    rotateCameraBy(camera: BoardCamera, diff: number): void {
        this._restrictionHandler.rotateCameraBy(camera, diff);
        super.rotateCameraBy(camera, diff);
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void {
        this._restrictionHandler.rotateCameraTo(camera, targetRotation);
        super.rotateCameraTo(camera, targetRotation);
    }
}
