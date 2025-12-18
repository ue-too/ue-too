import { PointCal } from "@ue-too/math";

import { 
    createDefaultPanByHandler, 
    createDefaultPanToHandler, 
    PanByHandlerFunction, 
    PanHandlerConfig, 
    PanToHandlerFunction } from "./pan-handler";
import { 
    ZoomHandlerConfig, 
    ZoomToHandlerFunction, 
    createDefaultZoomToOnlyHandler, 
    ZoomByHandlerFunction, 
    createDefaultZoomByOnlyHandler, 
} from "./zoom-handler";
import DefaultBoardCamera from "../default-camera";
import { createDefaultRotateToHandler, createDefaultRotateByHandler } from "./rotation-handler";
import type { RotateToHandlerFunction, RotateByHandlerFunction, RotationHandlerConfig } from "./rotation-handler";
import { ObservableBoardCamera } from "../interface";
import { Point } from "@ue-too/math";
import { convertDeltaInViewPortToWorldSpace } from "../utils";
import type { BaseContext } from "@ue-too/being";

/**
 * @description The config for the camera rig.
 * Camera rig combines pan, zoom and rotation handlers.
 * 
 * @category Input Flow Control
 */
export type CameraRigConfig = PanHandlerConfig & ZoomHandlerConfig & RotationHandlerConfig;

export interface CameraRig extends BaseContext {
    camera: ObservableBoardCamera;
    config: CameraRigConfig;
    configure(config: Partial<CameraRigConfig>): void;
    update(): void;
    panByViewPort: (delta: Point) => void;
    panToViewPort: (target: Point) => void;
    panByWorld: (delta: Point) => void;
    panToWorld: (target: Point) => void;
    rotateBy: (delta: number) => void;
    rotateTo: (target: number) => void;
    zoomToAt: (targetZoom: number, at: Point) => void;
    zoomByAt: (delta: number, at: Point) => void;
    zoomTo: (targetZoom: number) => void;
    zoomBy: (delta: number) => void;
    zoomToAtWorld: (targetZoom: number, at: Point) => void;
    zoomByAtWorld: (delta: number, at: Point) => void;
}

export class DefaultCameraRig implements CameraRig { // this is used as a context passed to the pan and zoom state machines; essentially a consolidated handler function for pan and zoom

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
        const convertedDelta = delta * this._camera.zoomLevel;
        let originalAnchorInWorld = this._camera.convertFromViewPort2WorldSpace(at);
        const transformedDelta = this._zoomBy(convertedDelta, this._camera, this._config);
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
        const transformedTarget = this._zoomTo(targetZoom, this._camera, this._config);
        this._camera.setZoomLevel(transformedTarget);
    }

    /**
     * @description Zoom by a certain amount with respect to the center of the viewport.
     */
    zoomBy(delta: number): void {
        const transformedDelta = this._zoomBy(delta, this._camera, this._config);
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
    }

    /**
     * @description Zoom to a certain zoom level with respect to a point in the world coordinate system.
     */
    zoomToAtWorld(targetZoom: number, at: Point): void {
        let originalAnchorInViewPort = this._camera.convertFromWorld2ViewPort(at);
        const transformedTarget = this._zoomTo(targetZoom, this._camera, this._config);
        this._camera.setZoomLevel(transformedTarget);
        let anchorInViewPortAfterZoom = this._camera.convertFromWorld2ViewPort(at);
        const cameraPositionDiffInViewPort = PointCal.subVector(anchorInViewPortAfterZoom, originalAnchorInViewPort);
        const cameraPositionDiffInWorld = convertDeltaInViewPortToWorldSpace(cameraPositionDiffInViewPort, this._camera.zoomLevel, this._camera.rotation);
        const transformedCameraPositionDiff = this._panBy(cameraPositionDiffInWorld, this._camera, this._config);
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
        const diffInViewPort = PointCal.subVector(anchorInViewPortAfterZoom, anchorInViewPortBeforeZoom);
        const diffInWorld = convertDeltaInViewPortToWorldSpace(diffInViewPort, this._camera.zoomLevel, this._camera.rotation);
        const transformedDiff = this._panBy(diffInWorld, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDiff));
    }

    /**
     * @description Pan By a certain amount. (delta is in the viewport coordinate system)
     */
    panByViewPort(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this.panByWorld(diffInWorld);
    }

    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    panByWorld(delta: Point): void {
        const transformedDelta = this._panBy(delta, this._camera, this._config);
        this._camera.setPosition(PointCal.addVector(this._camera.position, transformedDelta));
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

    set camera(camera: ObservableBoardCamera){
        this._camera = camera;
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

    update(): void {
    }
}

/**
 * @description Create a default camera rig.
 * 
 * @category Camera
 */
export function createDefaultCameraRig(camera: ObservableBoardCamera): CameraRig{
    return new DefaultCameraRig({
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
