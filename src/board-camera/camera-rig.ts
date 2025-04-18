import { PointCal } from "point2point";

import { 
    createDefaultPanByHandler, 
    createDefaultPanToHandler, 
    PanByHandlerFunction, 
    PanHandlerConfig, 
    PanToHandlerFunction } from "src/board-camera/pan/pan-handlers";
import { 
    ZoomHandlerConfig, 
    ZoomToHandlerFunction, 
    createDefaultZoomToOnlyHandler, 
    ZoomByHandlerFunction, 
    createDefaultZoomByOnlyHandler, 
} from "src/board-camera/zoom/zoom-handler";
import DefaultBoardCamera from "src/board-camera/board-camera-v2";
import { createDefaultRotateToHandler, createDefaultRotateByHandler } from "./rotation";
import type { RotateToHandlerFunction, RotateByHandlerFunction, RotationHandlerConfig } from "./rotation";
import { ObservableBoardCamera } from "./interface";
import { PanContext } from "src/input-flow-control/pan-control-state-machine";
import { ZoomContext } from "src/input-flow-control/zoom-control-state-machine";
import { convertDeltaInViewPortToWorldSpace } from "src/board-camera/utils/coordinate-conversion";
import { Point } from "src/util/misc";
import { RotateContext } from "src/input-flow-control/rotate-control-state-machine";
import { CameraPositionUpdateBatcher } from "src/batcher/camera-position-update";
import { CameraZoomUpdateBatcher } from "src/batcher/camera-zoom-update";

/**
 * @description The config for the camera rig.
 * Camera rig combines pan, zoom and rotation handlers.
 * 
 * @category Input Flow Control
 */
export type CameraRigConfig = PanHandlerConfig & ZoomHandlerConfig & RotationHandlerConfig;

/**
 * @description The camera rig.
 * 
 * This is a consolidated handler function for pan, zoom and rotation.
 * Essentially, it is a controller that controls the camera, so you don't have to figure out some of the math that is involved in panning, zooming and rotating the camera.
 * 
 * @category Camera
 */
export class CameraRig implements PanContext, ZoomContext, RotateContext { // this is used as a context passed to the pan and zoom state machines; essentially a consolidated handler function for pan and zoom

    private _panBy: PanByHandlerFunction;
    private _panTo: PanToHandlerFunction;
    private _zoomTo: ZoomToHandlerFunction;
    private _zoomBy: ZoomByHandlerFunction;
    private _rotateBy: RotateByHandlerFunction;
    private _rotateTo: RotateToHandlerFunction;
    private _config: CameraRigConfig;
    private _camera: ObservableBoardCamera;
    private _positionBatcher: CameraPositionUpdateBatcher; // all queued destination and delta updates are in world coordinate system
    private _zoomBatcher: CameraZoomUpdateBatcher;

    constructor(config: PanHandlerConfig & ZoomHandlerConfig, camera: ObservableBoardCamera = new DefaultBoardCamera()){
        this._panBy = createDefaultPanByHandler();
        this._panTo = createDefaultPanToHandler();
        this._zoomTo = createDefaultZoomToOnlyHandler();
        this._zoomBy = createDefaultZoomByOnlyHandler();
        this._rotateBy = createDefaultRotateByHandler();
        this._rotateTo = createDefaultRotateToHandler();
        this._config = {...config, restrictRotation: false, clampRotation: true};
        this._camera = camera;
        this._positionBatcher = new CameraPositionUpdateBatcher();
        this._zoomBatcher = new CameraZoomUpdateBatcher();
    }

    /**
     * @description Zoom to a certain zoom level at a certain point. The point is in the viewport coordinate system.
     */
    zoomToAt(targetZoom: number, at: Point): void {
        this._zoomBatcher.queueZoomUpdateTo(targetZoom, at, this._camera.zoomLevel, this._camera.rotation);
    }

    /**
     * @description Zoom by a certain amount at a certain point. The point is in the viewport coordinate system.
     */
    zoomByAt(delta: number, at: Point): void {
        this._zoomBatcher.queueZoomUpdateBy(delta, at, this._camera.zoomLevel, this._camera.rotation);
    }

    /**
     * @description Zoom to a certain zoom level with respect to the center of the viewport.
     */
    zoomTo(targetZoom: number): void {
        this._zoomBatcher.queueZoomUpdateTo(targetZoom);
    }

    /**
     * @description Zoom by a certain amount with respect to the center of the viewport.
     */
    zoomBy(delta: number): void {
        this._zoomBatcher.queueZoomUpdateBy(delta);
    }

    /**
     * @description Zoom to a certain zoom level with respect to a point in the world coordinate system.
     */
    zoomToAtWorld(targetZoom: number, at: Point): void {
        // let originalAnchorInViewPort = this._camera.convertFromWorld2ViewPort(at);
        // const transformedTarget = this._zoomTo(targetZoom, this._camera, this._config);
        // this._camera.setZoomLevel(transformedTarget);
        // let anchorInViewPortAfterZoom = this._camera.convertFromWorld2ViewPort(at);
        // const cameraPositionDiff = PointCal.subVector(originalAnchorInViewPort, anchorInViewPortAfterZoom);
        // const transformedCameraPositionDiff = this._panBy(cameraPositionDiff, this._camera, this._config);
        // this._camera.setPosition(PointCal.addVector(this._camera.position, transformedCameraPositionDiff));
        const delta = targetZoom - this._camera.zoomLevel;
        this._zoomBatcher.queueZoomByAtWorld(delta, at, this._camera.zoomLevel, this._camera.rotation);
    }

    /**
     * @description Zoom by a certain amount with respect to a point in the world coordinate system.
     */
    zoomByAtWorld(delta: number, at: Point): void {
        let anchorInViewPortBeforeZoom = this._camera.convertFromWorld2ViewPort(at);
        const transformedDelta = this._zoomBy(delta, this._camera, this._config);
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
        let anchorInViewPortAfterZoom = this._camera.convertFromWorld2ViewPort(at);
        const diffInViewPort = PointCal.subVector(anchorInViewPortBeforeZoom, anchorInViewPortAfterZoom);
        const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, this._camera.zoomLevel, this._camera.rotation);
        const transformedDiff = this._panBy(diffInWorld, this._camera, this._config);
        this._positionBatcher.queuePositionUpdateBy(transformedDiff);
    }


    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    private _actualPanByWorld(delta: Point): void {
        const transformedDelta = this._panBy(delta, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDelta));
    }

    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    private _actualPanToWorld(target: Point): void {
        const transformedTarget = this._panTo(target, this._camera, this._config);
        this._camera.setPosition(transformedTarget);
    }

    public panByWorld(delta: Point): void {
        this._positionBatcher.queuePositionUpdateBy(delta);
    }

    public panByViewPort(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._positionBatcher.queuePositionUpdateBy(diffInWorld);
    }

    public panToWorld(target: Point): void {
        this._positionBatcher.queuePositionUpdateTo(target);
    }

    public panToViewPort(target: Point): void {
        const targetInWorld = this._camera.convertFromViewPort2WorldSpace(target);
        this._positionBatcher.queuePositionUpdateTo(targetInWorld);
    }

    /**
     * @description Rotate by a certain amount.
     */
    rotateBy(delta: number): void {
        const transformedDelta = this._rotateBy(delta, this._camera, this._config);
        this._camera.setRotation(this._camera.rotation + transformedDelta);
    }

    /**
     * @description Rotate to a certain angle.
     */
    rotateTo(target: number): void {
        const transformedTarget = this._rotateTo(target, this._camera, this._config);
        this._camera.setRotation(transformedTarget);
    }

    set limitEntireViewPort(limit: boolean){
        this._config.limitEntireViewPort = limit;
    }

    /**
     * @description Whether the entire view port is limited.
     */
    get limitEntireViewPort(): boolean {
        return this._config.limitEntireViewPort;
    }

    get camera(): ObservableBoardCamera {
        return this._camera;
    }

    get config(): CameraRigConfig {
        return this._config;
    }

    set config(config: CameraRigConfig){
        this._config = {...config};
    }

    updatePosition(){
        const positionUpdate = this._positionBatcher.processQueuedUpdates();
        if(positionUpdate == null){
            return;
        }
        switch(positionUpdate.type){
            case 'destination':
                this._actualPanToWorld(positionUpdate);
                break;
            case 'delta':
                this._actualPanByWorld(positionUpdate);
        }
    }

    updateZoom(){
        const op = this._zoomBatcher.processQueuedUpdates();
        if(op == null){
            return;
        }
        if(op.anchor){
            this._zoomToAtViewPort(op.destination, op.anchor);
        } else {
            const transformedTarget = this._zoomTo(op.destination, this._camera, this._config);
            this._camera.setZoomLevel(transformedTarget);
        }
    }

    update(){
        this.updatePosition();
        this.updateZoom();
    }

    private _zoomToAtViewPort(targetZoom: number, at: Point): void {
        const originalAnchorInWorld = this._camera.convertFromViewPort2WorldSpace(at);
        const transformedTarget = this._zoomTo(targetZoom, this._camera, this._config);
        this._camera.setZoomLevel(transformedTarget);
        const anchorInWorldAfterZoom = this._camera.convertFromViewPort2WorldSpace(at);
        const cameraPositionDiff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        const transformedCameraPositionDiff = this._panBy(cameraPositionDiff, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedCameraPositionDiff));
    }

    /**
     * @description Configure the camera rig.
     */
    configure(config: Partial<CameraRigConfig>){
        this._config = {...this._config, ...config};
    }

    /**
     * @description Cleanup the camera rig.
     */
    cleanup(): void {
    }

    /**
     * @description Setup the camera rig.
     */
    setup(): void {
    }
}

/**
 * @description Create a default camera rig.
 * 
 * @category Camera
 */
export function createDefaultCameraRig(camera: ObservableBoardCamera): CameraRig{
    return new CameraRig({
        limitEntireViewPort: true,
        restrictRelativeXTranslation: false,
        restrictRelativeYTranslation: false,
        restrictXTranslation: false,
        restrictYTranslation: false,
        restrictZoom: false,
        clampTranslation: true,
        clampZoom: true,
    }, camera);
}
