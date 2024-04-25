import { Point } from "src";
import { BoardCamera } from "../interface";
import { PointCal } from "point2point";

import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";

export interface PanHandler {
    nextHandler?: PanHandler;
    camera: BoardCamera;
    chainHandler(handler: PanHandler): PanHandler;
    panTo(destination: Point): void
    panBy(delta: Point): void
}

export interface PanController extends PanHandler {
    limitEntireViewPort: boolean;
    restrictXTranslation: boolean;
    restrictYTranslation: boolean;
    restrictRelativeXTranslation: boolean;
    restrictRelativeYTranslation: boolean;
}

export abstract class PanHandlerBoilerPlate implements PanHandler {

    protected _nextHandler?: PanHandler;
    protected _camera: BoardCamera;

    constructor(camera: BoardCamera){
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    get camera(): BoardCamera {
        return this._camera;
    }

    set nextHandler(handler: PanHandler | undefined) {
        this._nextHandler = handler;
    }

    get nextHandler(): PanHandler | undefined {
        return this._nextHandler;
    }

    chainHandler(handler: PanHandler): PanHandler {
        this._nextHandler = handler;
        return handler;
    }

    panTo(destination: Point): void {
        if(this._nextHandler){
            this._nextHandler.panTo(destination);
        }
    }

    panBy(delta: Point): void {
        if(this._nextHandler){
            this._nextHandler.panBy(delta);
        }
    }
}

export class BasePanHandler extends PanHandlerBoilerPlate {


    constructor(camera: BoardCamera, nextHandler: PanHandler | undefined = undefined) {
        super(camera);
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    override panTo(destination: Point): void{
        this._camera.setPosition(destination);
    }

    override panBy(diff: Point): void {
        this._camera.setPosition(PointCal.addVector(this._camera.position, diff));
    }
}

class ClampHandler extends PanHandlerBoilerPlate {

    private _entireViewPort: boolean = false;

    constructor(camera: BoardCamera) {
        super(camera);
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

    panTo(destination: Point): void {
        let actualDest = clampPoint(destination, this._camera.boundaries);
        if(this._entireViewPort){
            actualDest = clampPointEntireViewPort(destination, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.boundaries, this._camera.zoomLevel, this._camera.rotation);
        }
        super.panTo(actualDest);
    }

    panBy(delta: Point): void {
        let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(this._camera.position, delta), this._camera.boundaries), this._camera.position);
        if(this._entireViewPort){
            actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(this._camera.position, delta), this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.boundaries, this._camera.zoomLevel, this._camera.rotation), this._camera.position);
        }
        super.panBy(actualDelta);
    }

}

class PanWithRestriction extends PanHandlerBoilerPlate {

    private _restrictXTranslation: boolean = false;
    private _restrictYTranslation: boolean = false;
    private _restrictRelativeXTranslation: boolean = false;
    private _restrictRelativeYTranslation: boolean = false;

    constructor(camera: BoardCamera) {
        super(camera);
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
        super.panTo(dest);
    }

    override panBy(delta: Point): void {
       delta = this.convertDeltaToComplyWithRestriction(delta);
       super.panBy(delta);
    }
}

export class PanRig extends PanHandlerBoilerPlate implements PanController {

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

    constructor(camera: BoardCamera) {
        super(camera);
        this.baseHandler = new BasePanHandler(camera);
        this.clampHandler = new ClampHandler(camera);
        this.restrictionHandler = new PanWithRestriction(camera);
        this.restrictionHandler.chainHandler(this.clampHandler).chainHandler(this.baseHandler);
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
