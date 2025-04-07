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
export class CameraRig implements PanContext, ZoomContext { // this is used as a context passed to the pan and zoom state machines; essentially a consolidated handler function for pan and zoom

    private _panBy: PanByHandlerFunction;
    private _panTo: PanToHandlerFunction;
    private _zoomTo: ZoomToHandlerFunction;
    private _zoomBy: ZoomByHandlerFunction;
    private _rotateBy: RotateByHandlerFunction;
    private _rotateTo: RotateToHandlerFunction;
    private _config: CameraRigConfig;
    private _camera: ObservableBoardCamera;

    constructor(config: PanHandlerConfig & ZoomHandlerConfig, camera: ObservableBoardCamera = new DefaultBoardCamera()){
        this._panBy = createDefaultPanByHandler();
        this._panTo = createDefaultPanToHandler();
        this._zoomTo = createDefaultZoomToOnlyHandler();
        this._zoomBy = createDefaultZoomByOnlyHandler();
        this._rotateBy = createDefaultRotateByHandler();
        this._rotateTo = createDefaultRotateToHandler();
        this._config = {...config, restrictRotation: false, clampRotation: true};
        this._camera = camera;
    }

    /**
     * @description Zoom to a certain zoom level at a certain point. The point is in the viewport coordinate system.
     */
    zoomToAt(targetZoom: number, at: Point): void {
        let originalAnchorInWorld = this._camera.convertFromViewPort2WorldSpace(at);
        const transformTarget = this._zoomTo(targetZoom, this._camera, this._config);
        this._camera.setZoomLevel(transformTarget);
        let anchorInWorldAfterZoom = this._camera.convertFromViewPort2WorldSpace(at);
        const cameraPositionDiff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        const transformedCameraPositionDiff = this._panBy(cameraPositionDiff, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedCameraPositionDiff));
    }

    /**
     * @description Zoom by a certain amount at a certain point. The point is in the viewport coordinate system.
     */
    zoomByAt(delta: number, at: Point): void {
        let originalAnchorInWorld = this._camera.convertFromViewPort2WorldSpace(at);
        const transformedDelta = this._zoomBy(delta, this._camera, this._config);
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
        let anchorInWorldAfterZoom = this._camera.convertFromViewPort2WorldSpace(at);
        const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
        const transformedDiff = this._panBy(diff, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDiff));
    }

    /**
     * @description Zoom to a certain zoom level with respect to the center of the viewport.
     */
    zoomTo(targetZoom: number): void {
        this._zoomTo(targetZoom, this._camera, this._config);
    }

    /**
     * @description Zoom by a certain amount with respect to the center of the viewport.
     */
    zoomBy(delta: number): void {
        this._zoomBy(delta, this._camera, this._config);
    }

    /**
     * @description Zoom to a certain zoom level with respect to a point in the world coordinate system.
     */
    zoomToAtWorld(targetZoom: number, at: Point): void {
        let originalAnchorInViewPort = this._camera.convertFromWorld2ViewPort(at);
        const transformedTarget = this._zoomTo(targetZoom, this._camera, this._config);
        this._camera.setZoomLevel(transformedTarget);
        let anchorInViewPortAfterZoom = this._camera.convertFromWorld2ViewPort(at);
        const cameraPositionDiff = PointCal.subVector(originalAnchorInViewPort, anchorInViewPortAfterZoom);
        const transformedCameraPositionDiff = this._panBy(cameraPositionDiff, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedCameraPositionDiff));
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
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDiff));
    }

    /**
     * @description Pan By a certain amount. (delta is in the viewport coordinate system)
     */
    panByViewPort(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        const transformedDelta = this._panBy(diffInWorld, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDelta));
    }

    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    panByWorld(delta: Point): void {
        const diffInViewPort = this._camera.convertFromWorld2ViewPort(delta);
        this.panByViewPort(diffInViewPort);
    }

    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    panToWorld(target: Point): void {
        const transformedTarget = this._panTo(target, this._camera, this._config);
        this._camera.setPosition(transformedTarget);
    }

    /**
     * @description Pan to a certain point. (target is in the viewport coordinate system)
     */
    panToViewPort(target: Point): void {
        const targetInWorld = this._camera.convertFromViewPort2WorldSpace(target);
        this.panToWorld(targetInWorld);
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
