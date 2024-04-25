import { Point } from "src";
import { BoardCamera } from "src/board-camera/interface";
import { convert2WorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import { PanController, PanHandler } from "src/board-camera/pan/pan";

export interface ZoomHandler {
    nextHandler?: ZoomHandler;
    camera: BoardCamera;
    chainHandler(handler: ZoomHandler): ZoomHandler;
    zoomTo(targetZoom: number): void;
    zoomBy(delta: number): void;
    zoomToAt(to: number, at: Point): void;
    zoomByAt(delta: number, at: Point): void;
}

export interface ZoomController extends ZoomHandler {
    restrictZoom: boolean;
}

export abstract class ZoomHandlerBoilerPlate implements ZoomHandler {
    private _nextHandler?: ZoomHandler;
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

    set nextHandler(handler: ZoomHandler | undefined) {
        this._nextHandler = handler;
    }

    get nextHandler(): ZoomHandler | undefined {
        return this._nextHandler;
    }

    chainHandler(handler: ZoomHandler): ZoomHandler {
        this._nextHandler = handler;
        return handler;
    }

    zoomTo(targetZoom: number): void {
        if(this._nextHandler){
            this._nextHandler.zoomTo(targetZoom);
        }
    }

    zoomBy(delta: number): void {
        if(this._nextHandler){
            this._nextHandler.zoomBy(delta);
        }
    }

    zoomToAt(to: number, at: Point): void {
        if(this._nextHandler){
            this._nextHandler.zoomToAt(to, at);
        }
    }

    zoomByAt(delta: number, at: Point): void {
        if(this._nextHandler){
            this._nextHandler.zoomByAt(delta, at);
        }
    }
}

export class BaseZoomHandler extends ZoomHandlerBoilerPlate {

    private basePanHandler: PanHandler;

    constructor(camera: BoardCamera, basePanHandler: PanHandler) {
        super(camera);
        this.basePanHandler = basePanHandler;
        this.basePanHandler.camera = camera;
    }

    zoomTo(targetZoom: number): void{
        this._camera.setZoomLevel(targetZoom);
    }

    zoomBy(diff: number): void {
        const curZoomLevel = this._camera.zoomLevel;
        const targetZoom = curZoomLevel + diff;
        this._camera.setZoomLevel(targetZoom);
    }

    zoomToAt(to: number, at: Point): void {
        let originalAnchorInWorld = convert2WorldSpace(at, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
        const originalZoomLevel = this._camera.zoomLevel;
        this._camera.setZoomLevel(to);
        let anchorInWorldAfterZoom = convert2WorldSpace(at, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
        const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        this.basePanHandler.panBy(diff);
    }

    zoomByAt(delta: number, at: Point): void {
        let originalAnchorInWorld = convert2WorldSpace(at, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
        const originalZoomLevel = this._camera.zoomLevel;
        const targetZoom = originalZoomLevel + delta;
        this._camera.setZoomLevel(targetZoom);
        let anchorInWorldAfterZoom = convert2WorldSpace(at, this._camera.viewPortWidth, this._camera.viewPortHeight, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
        const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        this.basePanHandler.panBy(diff);
    }
}

export class ZoomClampHandler extends ZoomHandlerBoilerPlate{
    

    constructor(camera: BoardCamera) {
        super(camera);
    }

    zoomTo(targetZoom: number): void{
        targetZoom = clampZoomLevel(targetZoom, this._camera.zoomBoundaries);
        super.zoomTo(targetZoom);
    }

    zoomBy(diff: number): void {
        let targetZoom = this._camera.zoomLevel + diff;
        targetZoom = clampZoomLevel(targetZoom, this._camera.zoomBoundaries);
        diff = targetZoom - this._camera.zoomLevel;
        super.zoomBy(diff);
    }

    zoomToAt(to: number, at: Point): void {
        to = clampZoomLevel(to, this._camera.zoomBoundaries);
        super.zoomToAt(to, at);
    }

    zoomByAt(delta: number, at: Point): void {
        let targetZoom = this._camera.zoomLevel + delta;
        targetZoom = clampZoomLevel(targetZoom, this._camera.zoomBoundaries);
        delta = targetZoom - this._camera.zoomLevel;
        super.zoomByAt(delta, at);
    }
}

export class ZoomRestrictionHandler extends ZoomHandlerBoilerPlate{

    private _restrictZoom: boolean = false;

    constructor(camera: BoardCamera) {
        super(camera);
    }

    set restrictZoom(restrictZoom: boolean){
        this._restrictZoom = restrictZoom;
    }

    get restrictZoom(): boolean{
        return this._restrictZoom;
    }

    zoomTo(targetZoom: number): void{
        if(this._restrictZoom){
            return;
        }
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomTo(targetZoom);
        }
    }

    zoomBy(diff: number): void {
        if(this._restrictZoom){
            return;
        }
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomBy(diff);
        }
    }

    zoomToAt(to: number, at: Point): void {
        if(this._restrictZoom){
            return;
        }
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomToAt(to, at);
        }
    }

    zoomByAt(delta: number, at: Point): void {
        if(this._restrictZoom){
            return;
        }
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomByAt(delta, at);
        }
    }
}

export class ZoomRig extends ZoomHandlerBoilerPlate {

    private _baseHandler: BaseZoomHandler;
    private _clampHandler: ZoomClampHandler;
    private _restrictionHandler: ZoomRestrictionHandler;

    constructor(camera: BoardCamera, basePanHandler: PanHandler) {
        super(camera);
        this._baseHandler = new BaseZoomHandler(camera, basePanHandler);
        this._clampHandler = new ZoomClampHandler(camera);
        this._restrictionHandler = new ZoomRestrictionHandler(camera);
        this._restrictionHandler.chainHandler(this._clampHandler).chainHandler(this._baseHandler);
    }

    set restrictZoom(restrict: boolean) {
        this._restrictionHandler.restrictZoom = restrict;
    }

    get restrictZoom(): boolean {
        return this._restrictionHandler.restrictZoom;
    }

    zoomTo(targetZoom: number): void {
        this._restrictionHandler.zoomTo(targetZoom);
        if(this.nextHandler){
            this.nextHandler.zoomTo(targetZoom);
        }
    }

    zoomBy(delta: number): void {
        this._restrictionHandler.zoomBy(delta);
        if(this.nextHandler){
            this.nextHandler.zoomBy(delta);
        }
    }

    zoomByAt(delta: number, at: Point): void {
        this._restrictionHandler.zoomByAt(delta, at);
        if(this.nextHandler){
            this.nextHandler.zoomByAt(delta, at);
        }
    }

    zoomToAt(to: number, at: Point): void {
        this._restrictionHandler.zoomToAt(to, at);
        if(this.nextHandler){
            this.nextHandler.zoomToAt(to, at);
        }
    }
}
