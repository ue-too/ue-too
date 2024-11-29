import { Point } from "src";
import type BoardCamera from "../board-camera-v2";
import { PointCal } from "point2point";

import { clampPoint, clampPointEntireViewPort } from "src/board-camera/utils/position";

export interface PanHandler {
    nextHandler?: PanHandler;
    chainHandler(handler: PanHandler): PanHandler;
    panCameraTo(camera: BoardCamera, destination: Point): void
    panCameraBy(camera: BoardCamera, delta: Point): void
}

export interface PanController extends PanHandler {
    limitEntireViewPort: boolean;
    restrictXTranslation: boolean;
    restrictYTranslation: boolean;
    restrictRelativeXTranslation: boolean;
    restrictRelativeYTranslation: boolean;
    restrictTranslation: boolean;
}

export abstract class PanHandlerBoilerPlate implements PanHandler {

    protected _nextHandler?: PanHandler;

    constructor(nextHandler: PanHandler | undefined = undefined) {
        this._nextHandler = nextHandler;
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

    panCameraTo(camera: BoardCamera, destination: Point): void {
        if(this._nextHandler){
            this._nextHandler.panCameraTo(camera, destination);
        }
    }

    panCameraBy(camera: BoardCamera, delta: Point): void {
        if(this._nextHandler){
            this._nextHandler.panCameraBy(camera, delta);
        }
    }
}

export class BasePanHandler extends PanHandlerBoilerPlate {


    constructor(nextHandler: PanHandler | undefined = undefined) {
        super(nextHandler);
    }

    override panCameraTo(camera: BoardCamera, destination: Point): void{
        camera.setPosition(destination);
    }

    override panCameraBy(camera: BoardCamera, diff: Point): void {
        camera.setPosition(PointCal.addVector(camera.position, diff));
    }
}

export class ClampHandler extends PanHandlerBoilerPlate {

    private _entireViewPort: boolean = false;

    constructor(nextHandler: PanHandler | undefined = undefined) {
        super(nextHandler);
    }

    set entireViewPort(entireViewPort: boolean) {
        this._entireViewPort = entireViewPort;
    }

    get entireViewPort(): boolean {
        return this._entireViewPort;
    }

    panCameraTo(camera: BoardCamera, destination: Point): void {
        let actualDest = clampPoint(destination, camera.boundaries);
        if(this._entireViewPort){
            actualDest = clampPointEntireViewPort(destination, camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation);
        }
        super.panCameraTo(camera, actualDest);
    }

    panCameraBy(camera: BoardCamera, delta: Point): void {
        let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(camera.position, delta), camera.boundaries), camera.position);
        if(this._entireViewPort){
            actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(camera.position, delta), camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation), camera.position);
        }
        super.panCameraBy(camera, actualDelta);
    }

}

export class PanWithRestriction extends PanHandlerBoilerPlate {

    private _restrictXTranslation: boolean = false;
    private _restrictYTranslation: boolean = false;
    private _restrictRelativeXTranslation: boolean = false;
    private _restrictRelativeYTranslation: boolean = false;

    constructor(nextHandler: PanHandler | undefined = undefined) {
        super(nextHandler);
    }

    set restrictXTranslation(restrictXTranslation: boolean) {
        this._restrictXTranslation = restrictXTranslation;
    }

    get restrictXTranslation(): boolean {
        return this._restrictXTranslation;
    }

    set restrictYTranslation(restrictYTranslation: boolean) {
        this._restrictYTranslation = restrictYTranslation;
    }

    get restrictYTranslation(): boolean {
        return this._restrictYTranslation;
    }

    set restrictRelativeXTranslation(restrictRelativeXTranslation: boolean) {
        this._restrictRelativeXTranslation = restrictRelativeXTranslation;
    }

    get restrictRelativeXTranslation(): boolean {
        return this._restrictRelativeXTranslation;
    }

    set restrictRelativeYTranslation(restrictRelativeYTranslation: boolean) {
        this._restrictRelativeYTranslation = restrictRelativeYTranslation;
    }

    get restrictRelativeYTranslation(): boolean {
        return this._restrictRelativeYTranslation;
    }

    convertDeltaToComplyWithRestriction(camera: BoardCamera, delta: Point): Point {
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
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, camera.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslation){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, camera.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        return delta;
    }

    override panCameraTo(camera: BoardCamera, destination: Point): void {
        let delta = PointCal.subVector(destination, camera.position);
        delta = this.convertDeltaToComplyWithRestriction(camera, delta);
        if (delta.x === 0 && delta.y === 0) {
            return;
        }
        const dest = PointCal.addVector(camera.position, delta);
        super.panCameraTo(camera, dest);
    }

    override panCameraBy(camera: BoardCamera, delta: Point): void {
       delta = this.convertDeltaToComplyWithRestriction(camera, delta);
       super.panCameraBy(camera, delta);
    }
}

export class PanRig extends PanHandlerBoilerPlate implements PanController {

    private baseHandler: BasePanHandler;
    private clampHandler: ClampHandler;
    private restrictionHandler: PanWithRestriction;

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

    set restrictTranslation(restrictTranslation: boolean) {
        // console.log("setting", restrictTranslation);
        this.restrictionHandler.restrictXTranslation = restrictTranslation;
        this.restrictionHandler.restrictYTranslation = restrictTranslation;
    }

    get restrictTranslation(): boolean {
        return this.restrictionHandler.restrictXTranslation;
    }

    get restrictXTranslation(): boolean {
        return this.restrictionHandler.restrictXTranslation;
    }

    get restrictYTranslation(): boolean {
        return this.restrictionHandler.restrictYTranslation;
    }

    get restrictRelativeXTranslation(): boolean {
        return this.restrictionHandler.restrictRelativeXTranslation;
    }

    get restrictRelativeYTranslation(): boolean {
        return this.restrictionHandler.restrictRelativeYTranslation;
    }

    set limitEntireViewPort(limitEntireViewPort: boolean) {
        this.clampHandler.entireViewPort = limitEntireViewPort;
    }

    get limitEntireViewPort(): boolean {
        return this.clampHandler.entireViewPort;
    }

    constructor() {
        super();
        this.baseHandler = new BasePanHandler();
        this.clampHandler = new ClampHandler();
        this.restrictionHandler = new PanWithRestriction();
        this.restrictionHandler.chainHandler(this.clampHandler).chainHandler(this.baseHandler);
        this.nextHandler = this.restrictionHandler;
    }
}
