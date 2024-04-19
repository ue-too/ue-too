import { Point } from "src";
import { BoardCamera } from "../interface";
import { PointCal } from "point2point";

import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";

export abstract class PanHandler {
    protected nextHandler: PanHandler | undefined;

    setNextHandler(handler: PanHandler): PanHandler {
        this.nextHandler = handler;
        return handler;
    }

    panTo(destination: Point): void {
        if(this.nextHandler){
            this.nextHandler.panTo(destination);
        }
    }

    panBy(delta: Point): void {
        if(this.nextHandler){
            this.nextHandler.panBy(delta);
        }
    }
}

export interface PanController {
    camera: BoardCamera;
    limitEntireViewPort: boolean;
    restrictXTranslation: boolean;
    restrictYTranslation: boolean;
    restrictRelativeXTranslation: boolean;
    restrictRelativeYTranslation: boolean;
    panTo(destination: Point): void;
    panBy(delta: Point): void;
}

export class BasePanHandler extends PanHandler{

    private _camera: BoardCamera;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    panTo(destination: Point): void{
        this._camera.setPosition(destination);
    }

    panBy(diff: Point): void {
        this._camera.setPosition(PointCal.addVector(this._camera.position, diff));
    }
}

class ClampHandler extends PanHandler {

    private _camera: BoardCamera;
    private _entireViewPort: boolean = false;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    set entireViewPort(entireViewPort: boolean) {
        this._entireViewPort = entireViewPort;
    }

    get entireViewPort(): boolean {
        return this._entireViewPort;
    }

    override panTo(destination: Point): void {
        let actualDest = clampPoint(destination, this._camera.boundaries);
        if(this._entireViewPort){
            actualDest = clampPointEntireViewPort(destination, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.boundaries, this._camera.zoomLevel, this._camera.rotation);
        }
        if(this.nextHandler){
            this.nextHandler.panTo(actualDest);
        }
    }

    override panBy(delta: Point): void {
        let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(this._camera.position, delta), this._camera.boundaries), this._camera.position);
        if(this._entireViewPort){
            actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(this._camera.position, delta), this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.boundaries, this._camera.zoomLevel, this._camera.rotation), this._camera.position);
        }
        if(this.nextHandler){
            this.nextHandler.panBy(actualDelta);
        }
    }

}

class PanWithRestriction extends PanHandler {

    private _camera: BoardCamera;
    private _restrictXTranslation: boolean = false;
    private _restrictYTranslation: boolean = false;
    private _restrictRelativeXTranslation: boolean = false;
    private _restrictRelativeYTranslation: boolean = false;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set restrictXTranslation(restrictXTranslation: boolean) {
        this._restrictXTranslation = restrictXTranslation;
    }

    set restrictYTranslation(restrictYTranslation: boolean) {
        this._restrictYTranslation = restrictYTranslation;
    }

    set restrictRelativeXTranslation(restrictRelativeXTranslation: boolean) {
        this._restrictRelativeXTranslation = restrictRelativeXTranslation;
    }

    set restrictRelativeYTranslation(restrictRelativeYTranslation: boolean) {
        this._restrictRelativeYTranslation = restrictRelativeYTranslation;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    convertDeltaToComplyWithRestriction(delta: Point): Point {
        if(this._restrictXTranslation && this._restrictYTranslation){
            return {x: 0, y: 0};
        }
        if(this._restrictRelativeXTranslation && this._restrictRelativeYTranslation){
            return {x: 0, y: 0};
        }
        if(this._restrictXTranslation){
            delta.x = 0;
        }
        if(this._restrictYTranslation){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslation){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._camera.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslation){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._camera.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        return delta;
    }

    override panTo(destination: Point): void {
        let delta = PointCal.subVector(destination, this._camera.position);
        delta = this.convertDeltaToComplyWithRestriction(delta);
        if (delta.x === 0 && delta.y === 0) {
            return;
        }
        const dest = PointCal.addVector(this._camera.position, delta);
        if(this.nextHandler){
            this.nextHandler.panTo(dest);
        }
    }

    override panBy(delta: Point): void {
       delta = this.convertDeltaToComplyWithRestriction(delta);
       if(this.nextHandler){
           this.nextHandler.panBy(delta);
       }
    }
}

export class PanRig extends PanHandler {

    private _camera: BoardCamera;
    private _limitEntireViewPort: boolean = false;
    private _restrictXTranslation: boolean = false;
    private _restrictYTranslation: boolean = false;
    private _restrictRelativeXTranslation: boolean = false;
    private _restrictRelativeYTranslation: boolean = false;
    private baseHandler: BasePanHandler;
    private clampHandler: ClampHandler;
    private restrictionHandler: PanWithRestriction;

    set camera(camera: BoardCamera) {
        this._camera = camera;
        this.baseHandler.camera = camera;
        this.clampHandler.camera = camera;
        this.restrictionHandler.camera = camera;
    }

    set restrictRelativeXTranslation(restrictRelativeXTranslation: boolean) {
        this.restrictionHandler.restrictRelativeXTranslation = restrictRelativeXTranslation;
    }

    set restrictRelativeYTranslation(restrictRelativeYTranslation: boolean) {
        this.restrictionHandler.restrictRelativeYTranslation = restrictRelativeYTranslation;
    }

    set restrictXTranslation(restrictXTranslation: boolean) {
        this.restrictionHandler.restrictXTranslation = restrictXTranslation;
    }

    set restrictYTranslation(restrictYTranslation: boolean) {
        this.restrictionHandler.restrictYTranslation = restrictYTranslation;
    }

    set limitEntireViewPort(limitEntireViewPort: boolean) {
        this.clampHandler.entireViewPort = limitEntireViewPort;
    }

    setNextHandler(handler: PanHandler): PanHandler {
        this.nextHandler = handler;
        return handler;
    }

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
        this.baseHandler = new BasePanHandler(camera);
        this.clampHandler = new ClampHandler(camera);
        this.restrictionHandler = new PanWithRestriction(camera);
        this.restrictionHandler.setNextHandler(this.clampHandler).setNextHandler(this.baseHandler);
    }

    override panTo(destination: Point): void {
        this.restrictionHandler.panTo(destination);
        if(this.nextHandler){
            this.nextHandler.panTo(destination);
        }
    }

    override panBy(delta: Point): void {
       this.restrictionHandler.panBy(delta); 
       if(this.nextHandler){
           this.nextHandler.panBy(delta);
       }
    }
}
