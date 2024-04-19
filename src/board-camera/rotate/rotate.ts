import { normalizeAngleZero2TwoPI, rotationWithinLimits, angleSpan, clampRotation } from "src/board-camera/utils/rotation";
import { BoardCamera } from "src/board-camera/interface"

export abstract class RotationHandler {
    protected nextHandler: RotationHandler | undefined;

    setNextHandler(handler: RotationHandler): RotationHandler {
        this.nextHandler = handler;
        return handler;
    }

    rotateTo(targetRotation: number): void {
        if(this.nextHandler){
            this.nextHandler.rotateTo(targetRotation);
        }
    }

    rotateBy(delta: number): void {
        if(this.nextHandler){
            this.nextHandler.rotateBy(delta);
        }
    }
}

export class BaseRotationHandler extends RotationHandler{

    private _camera: BoardCamera;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    rotateTo(targetRotation: number): void{
        targetRotation = normalizeAngleZero2TwoPI(targetRotation);
        this._camera.setRotation(targetRotation);
    }

    rotateBy(diff: number): void {
        const curRotation = this._camera.rotation;
        const targetRotation = normalizeAngleZero2TwoPI(curRotation + diff);
        diff = angleSpan(curRotation, targetRotation);
        this._camera.setRotation(targetRotation);
    }
}

export class RotationRestrictionHandler extends RotationHandler{
    private _camera: BoardCamera;
    private _restrictRotation: boolean = false;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    get restrictRotation(): boolean{
        return this._restrictRotation;
    }

    set restrictRotation(restrictRotation: boolean){
        this._restrictRotation = restrictRotation;
    }

    rotateBy(diff: number): void {
        if(this._restrictRotation){
            return;
        }
        if(this.nextHandler){
            this.nextHandler.rotateBy(diff);
        }
    }

    rotateTo(targetRotation: number): void {
        if(this._restrictRotation){
            return;
        }
        if(this.nextHandler){
            this.nextHandler.rotateTo(targetRotation);
        }
    }
}

export class RotationClampHandler extends RotationHandler{
    
    private _camera: BoardCamera;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    rotateBy(diff: number): void {
        const curRotation = this._camera.rotation;
        let targetRotation = normalizeAngleZero2TwoPI(curRotation + diff);
        targetRotation = clampRotation(targetRotation, this._camera.rotationBoundaries); 
        diff = angleSpan(curRotation, targetRotation);
        if(this.nextHandler){
            this.nextHandler.rotateBy(diff);
        }
    }

    rotateTo(targetRotation: number): void {
        targetRotation = normalizeAngleZero2TwoPI(targetRotation);
        targetRotation = clampRotation(targetRotation, this._camera.rotationBoundaries);
        if(this.nextHandler){
            this.nextHandler.rotateTo(targetRotation);
        }
    }
}

export class RotateRig extends RotationHandler {
    private _camera: BoardCamera;
    private _baseHandler: BaseRotationHandler;
    private _clampHandler: RotationClampHandler;
    private _restrictionHandler: RotationRestrictionHandler;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
        this._restrictionHandler = new RotationRestrictionHandler(camera);
        this._baseHandler = new BaseRotationHandler(camera);
        this._clampHandler = new RotationClampHandler(camera);
        this._restrictionHandler.setNextHandler(this._clampHandler).setNextHandler(this._baseHandler);
    }

    rotateBy(diff: number): void {
        this._restrictionHandler.rotateBy(diff);
        if(this.nextHandler){
            this.nextHandler.rotateBy(diff);
        }
    }

    rotateTo(targetRotation: number): void {
        this._restrictionHandler.rotateTo(targetRotation);
        if(this.nextHandler){
            this.nextHandler.rotateTo(targetRotation);
        }
    }
}
