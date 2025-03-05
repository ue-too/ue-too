import { createDefaultPanByHandler, PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";

import { 
    createDefaultZoomToAtHandler, 
    ZoomToAtHandlerFunction, 
    BaseZoomHandlerConfig, 
    ZoomToHandlerFunction, 
    createDefaultZoomToOnlyHandler, 
    createDefaultZoomToAtWorldHandler, 
    ZoomByAtHandlerFunction, 
    ZoomByHandlerFunction, 
    createDefaultZoomByAtHandler, 
    createDefaultZoomByOnlyHandler, 
    createDefaultZoomByAtWorldHandler } from "src/board-camera/zoom/zoom-handler";

import { InputFlowControl } from "./interface";
import { Point } from "src/util/misc";
import DefaultBoardCamera, {
    createDefaultRotateByHandler, 
    createDefaultRotateToHandler, 
    ObservableBoardCamera, 
    RotateByHandlerFunction, 
    RotateToHandlerFunction, 
    RotationHandlerConfig } from "src/board-camera";
import { PointCal } from "point2point";
import { createDefaultPanControlStateMachine, PanContext, PanControlStateMachine } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomContext, ZoomControlStateMachine } from "./zoom-control-state-machine";

/**
 * @description The config for the camera rig.
 * Camera rig combines pan, zoom and rotation handlers.
 * 
 * @category Input Flow Control
 */
export type CameraRigConfig = PanHandlerConfig & BaseZoomHandlerConfig & RotationHandlerConfig;

/**
 * @description The flow control with animation and lock input.
 * 
 * This is a customized input flow control that suits a specific use case. 
 * 
 * You can use the default one ({@link SimpleRelayFlowControl}) instead or implement your own.
 * 
 * The internal ruleset on which input is used and which is ignored is controlled by the state machines.
 * 
 * @category Input Flow Control
 */
export class FlowControlWithAnimationAndLockInput implements InputFlowControl {

    private _panStateMachine: PanControlStateMachine;
    private _zoomStateMachine: ZoomControlStateMachine;

    constructor(panStateMachine: PanControlStateMachine, zoomStateMachine: ZoomControlStateMachine){
        this._panStateMachine = panStateMachine;
        this._zoomStateMachine = zoomStateMachine;
    }

    notifyPanToAnimationInput(target: Point): void {
        this._panStateMachine.notifyPanToAnimationInput(target);
    }

    notifyPanInput(delta: Point): void {
        this._panStateMachine.notifyPanInput(delta);
    }

    notifyZoomInput(delta: number, at: Point): void {
        this._zoomStateMachine.notifyZoomByAtInput(delta, at);
    }

    notifyZoomInputAnimation(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtCenterInput(targetZoom, at);
    }

    notifyZoomInputAnimationWorld(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtWorldInput(targetZoom, at);
    }

    notifyRotationInput(delta: number): void {
        console.error("Rotation input is not implemented");
    }

    initatePanTransition(): void {
        this._panStateMachine.initateTransition();
    }

    initateZoomTransition(): void {
        this._zoomStateMachine.initateTransition();
    }
}

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
    private _zoomToAt: ZoomToAtHandlerFunction;
    private _zoomByAt: ZoomByAtHandlerFunction;
    private _zoomTo: ZoomToHandlerFunction;
    private _zoomBy: ZoomByHandlerFunction;
    private _zoomToAtWorld: ZoomToAtHandlerFunction;
    private _zoomByAtWorld: ZoomByAtHandlerFunction;
    private _rotateBy: RotateByHandlerFunction;
    private _rotateTo: RotateToHandlerFunction;
    private _config: CameraRigConfig;
    private _camera: ObservableBoardCamera;

    constructor(config: PanHandlerConfig & BaseZoomHandlerConfig, camera: ObservableBoardCamera = new DefaultBoardCamera()){
        this._panBy = createDefaultPanByHandler();
        this._zoomToAt = createDefaultZoomToAtHandler();
        this._zoomByAt = createDefaultZoomByAtHandler();
        this._zoomTo = createDefaultZoomToOnlyHandler();
        this._zoomBy = createDefaultZoomByOnlyHandler();
        this._zoomToAtWorld = createDefaultZoomToAtWorldHandler();
        this._zoomByAtWorld = createDefaultZoomByAtWorldHandler();
        this._rotateBy = createDefaultRotateByHandler();
        this._rotateTo = createDefaultRotateToHandler();
        this._config = {...config, restrictRotation: false};
        this._camera = camera;
    }

    /**
     * @description Zoom to a certain zoom level at a certain point. The point is in the viewport coordinate system.
     */
    zoomToAt(targetZoom: number, at: Point): void {
        this._zoomToAt(targetZoom, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    /**
     * @description Zoom by a certain amount at a certain point. The point is in the viewport coordinate system.
     */
    zoomByAt(delta: number, at: Point): void {
        this._zoomByAt(delta, this._camera, at, {...this._config, panByHandler: this._panBy});
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
        this._zoomToAtWorld(targetZoom, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    /**
     * @description Zoom by a certain amount with respect to a point in the world coordinate system.
     */
    zoomByAtWorld(delta: number, at: Point): void {
        this._zoomByAtWorld(delta, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    /**
     * @description Pan By a certain amount. (delta is in the viewport coordinate system)
     */
    panBy(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._panBy(diffInWorld, this._camera, this._config);
    }

    /**
     * @description Pan to a certain point. (target is in the world coordinate system)
     */
    panTo(target: Point): void {
        const deltaInWorld = PointCal.subVector(target, this._camera.position);
        this._panBy(deltaInWorld, this._camera, this._config);
    }

    /**
     * @description Rotate by a certain amount.
     */
    rotateBy(delta: number): void {
        this._rotateBy(delta, this._camera, this._config);
    }

    /**
     * @description Rotate to a certain angle.
     */
    rotateTo(target: number): void {
        this._rotateTo(target, this._camera, this._config);
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
    }, camera);
}


/**
 * @description Create a flow control that allows animation and lock inputs.
 * 
 * @category Input Flow Control
 */
export function createFlowControlWithAnimationAndLock(camera: ObservableBoardCamera): InputFlowControl {
    const context = createDefaultCameraRig(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    return new FlowControlWithAnimationAndLockInput(panStateMachine, zoomStateMachine);
}

/**
 * @description Create a default flow control with a camera rig.
 * 
 * @category Input Flow Control
 */
export function createFlowControlWithAnimationAndLockWithCameraRig(cameraRig: CameraRig): InputFlowControl {
    const panStateMachine = createDefaultPanControlStateMachine(cameraRig);
    const zoomStateMachine = createDefaultZoomControlStateMachine(cameraRig);
    return new FlowControlWithAnimationAndLockInput(panStateMachine, zoomStateMachine);
}
