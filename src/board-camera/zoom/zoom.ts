import { Point } from "src";
import type { BoardCamera } from "../interface";
import { convert2WorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { clampZoomLevel } from "src/board-camera/utils/zoom";
import { PointCal } from "point2point";
import type { PanHandler } from "src/board-camera/pan/pan";

export interface ZoomHandler {
    nextHandler?: ZoomHandler;
    chainHandler(handler: ZoomHandler): ZoomHandler;
    zoomCameraTo(camera: BoardCamera, targetZoom: number): void;
    zoomCameraBy(camera: BoardCamera, delta: number): void;
    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void;
    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void;
}

export interface ZoomController extends ZoomHandler {
    restrictZoom: boolean;
}

export abstract class ZoomHandlerBoilerPlate implements ZoomHandler {

    protected _nextHandler?: ZoomHandler;

    constructor(nextHandler: ZoomHandler | undefined = undefined) {
        this._nextHandler = nextHandler;
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

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void {
        if(this._nextHandler){
            this._nextHandler.zoomCameraTo(camera, targetZoom);
        }
    }

    zoomCameraBy(camera: BoardCamera, delta: number): void {
        if(this._nextHandler){
            this._nextHandler.zoomCameraBy(camera, delta);
        }
    }

    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void {
        if(this._nextHandler){
            this._nextHandler.zoomCameraToAt(camera, to, at);
        }
    }

    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void {
        if(this._nextHandler){
            this._nextHandler.zoomCameraByAt(camera, delta, at);
        }
    }
}

export class BaseZoomHandler extends ZoomHandlerBoilerPlate {

    private panHandler: PanHandler;

    constructor(panHandler: PanHandler, nextHandler: ZoomHandler | undefined = undefined) {
        super(nextHandler);
        this.panHandler = panHandler;
    }

    set nextHandler(handler: ZoomHandler | undefined) {
        this._nextHandler = undefined;
    }

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void{
        camera.setZoomLevel(targetZoom);
    }

    zoomCameraBy(camera: BoardCamera, diff: number): void {
        const curZoomLevel = camera.zoomLevel;
        const targetZoom = curZoomLevel + diff;
        camera.setZoomLevel(targetZoom);
    }

    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void {
        let originalAnchorInWorld = camera.convertFromViewPort2WorldSpace(at);
        camera.setZoomLevel(to);
        let anchorInWorldAfterZoom = camera.convertFromViewPort2WorldSpace(at);
        const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        this.panHandler.panCameraBy(camera, diff);
    }

    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void {
        let originalAnchorInWorld = convert2WorldSpace(at, camera.viewPortWidth, camera.viewPortHeight, camera.position, camera.zoomLevel, camera.rotation);
        const originalZoomLevel = camera.zoomLevel;
        const targetZoom = originalZoomLevel + delta;
        camera.setZoomLevel(targetZoom);
        let anchorInWorldAfterZoom = convert2WorldSpace(at, camera.viewPortWidth, camera.viewPortHeight, camera.position, camera.zoomLevel, camera.rotation);
        const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        this.panHandler.panCameraBy(camera, diff);
    }
}

export class ZoomClampHandler extends ZoomHandlerBoilerPlate{
    

    constructor(nextHandler: ZoomHandler | undefined = undefined) {
        super(nextHandler);
    }

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void{
        targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
        super.zoomCameraTo(camera, targetZoom);
    }

    zoomCameraBy(camera: BoardCamera, diff: number): void {
        let targetZoom = camera.zoomLevel + diff;
        targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
        diff = targetZoom - camera.zoomLevel;
        super.zoomCameraBy(camera, diff);
    }

    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void {
        to = clampZoomLevel(to, camera.zoomBoundaries);
        super.zoomCameraToAt(camera, to, at);
    }

    zoomByAt(camera: BoardCamera, delta: number, at: Point): void {
        let targetZoom = camera.zoomLevel + delta;
        targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
        delta = targetZoom - camera.zoomLevel;
        super.zoomCameraByAt(camera, delta, at);
    }
}

export class ZoomRestrictionHandler extends ZoomHandlerBoilerPlate{

    private _restrictZoom: boolean = false;

    constructor(nextHandler: ZoomHandler | undefined = undefined) {
        super(nextHandler);
    }

    set restrictZoom(restrictZoom: boolean){
        this._restrictZoom = restrictZoom;
    }

    get restrictZoom(): boolean{
        return this._restrictZoom;
    }

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void{
        if(this._restrictZoom){
            return;
        }
        super.zoomCameraTo(camera, targetZoom);
    }

    zoomCameraBy(camera: BoardCamera, diff: number): void {
        if(this._restrictZoom){
            return;
        }
        super.zoomCameraBy(camera, diff);
    }

    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void {
        if(this._restrictZoom){
            return;
        }
        super.zoomCameraToAt(camera, to, at);
    }

    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void {
        if(this._restrictZoom){
            return;
        }
        super.zoomCameraByAt(camera, delta, at);
    }
}

export class ZoomRig extends ZoomHandlerBoilerPlate implements ZoomController{

    private _baseHandler: BaseZoomHandler;
    private _clampHandler: ZoomClampHandler;
    private _restrictionHandler: ZoomRestrictionHandler;

    constructor(basePanHandler: PanHandler, nextHandler: ZoomHandler | undefined = undefined) {
        super(nextHandler);
        this._baseHandler = new BaseZoomHandler(basePanHandler);
        this._clampHandler = new ZoomClampHandler();
        this._restrictionHandler = new ZoomRestrictionHandler();
        this._restrictionHandler.chainHandler(this._clampHandler).chainHandler(this._baseHandler);
        this._nextHandler = this._restrictionHandler;
    }

    set restrictZoom(restrict: boolean) {
        this._restrictionHandler.restrictZoom = restrict;
    }

    get restrictZoom(): boolean {
        return this._restrictionHandler.restrictZoom;
    }

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void {
        super.zoomCameraTo(camera, targetZoom);
    }

    zoomCameraBy(camera: BoardCamera, delta: number): void {
        super.zoomCameraBy(camera, delta);
    }

    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void {
        super.zoomCameraByAt(camera, delta, at);
    }

    zoomCameraToAt(camera: BoardCamera, to: number, at: Point): void {
        super.zoomCameraToAt(camera, to, at);
    }
}
