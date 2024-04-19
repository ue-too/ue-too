import { Point } from "src";
import { BoardCamera } from "src/board-camera/interface";
import { convert2WorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import { PanController, PanHandler } from "src/board-camera/pan/pan";

export abstract class ZoomHandler {
    protected nextHandler: ZoomHandler | undefined;

    setNextHandler(handler: ZoomHandler): ZoomHandler{
        this.nextHandler = handler;
        return handler;
    }

    zoomTo(targetZoom: number): void {
        if(this.nextHandler){
            this.nextHandler.zoomTo(targetZoom);
        }
    }

    zoomBy(delta: number): void {
        if(this.nextHandler){
            this.nextHandler.zoomBy(delta);
        }
    }

    zoomToAt(to: number, at: Point): void {
        if(this.nextHandler){
            this.nextHandler.zoomToAt(to, at);
        }
    }

    zoomByAt(delta: number, at: Point): void {
        if(this.nextHandler){
            this.nextHandler.zoomByAt(delta, at);
        }
    }

}

export class BaseZoomHandler extends ZoomHandler{

    private _camera: BoardCamera;
    private basePanHandler: PanHandler;

    constructor(camera: BoardCamera, basePanHandler: PanHandler) {
        super();
        this._camera = camera;
        this.basePanHandler = basePanHandler;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
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
}

export class ZoomClampHandler extends ZoomHandler{
    
    private _camera: BoardCamera;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
    }

    zoomTo(targetZoom: number): void{
        targetZoom = clampZoomLevel(targetZoom, this._camera.zoomBoundaries);
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomTo(targetZoom);
        }
    }

    zoomBy(diff: number): void {
        let targetZoom = this._camera.zoomLevel + diff;
        targetZoom = clampZoomLevel(targetZoom, this._camera.zoomBoundaries);
        diff = targetZoom - this._camera.zoomLevel;
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomBy(diff);
        }
    }

    zoomToAt(to: number, at: Point): void {
        to = clampZoomLevel(to, this._camera.zoomBoundaries);
        if(this.nextHandler !== undefined){
            this.nextHandler.zoomToAt(to, at);
        }
    }
}

export class ZoomRestrictionHandler extends ZoomHandler{

    private _camera: BoardCamera;
    private _restrictZoom: boolean = false;

    constructor(camera: BoardCamera) {
        super();
        this._camera = camera;
    }

    set camera(camera: BoardCamera) {
        this._camera = camera;
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
}

export class ZoomRig extends ZoomHandler {
    private _camera: BoardCamera;
    private _baseHandler: BaseZoomHandler;
    private _clampHandler: ZoomClampHandler;
    private _restrictionHandler: ZoomRestrictionHandler;

    constructor(camera: BoardCamera, basePanHandler: PanHandler) {
        super();
        this._camera = camera;
        this._baseHandler = new BaseZoomHandler(camera, basePanHandler);
        this._clampHandler = new ZoomClampHandler(camera);
        this._restrictionHandler = new ZoomRestrictionHandler(camera);
        this._restrictionHandler.setNextHandler(this._clampHandler).setNextHandler(this._baseHandler);
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
