import { createDefaultPanByHandler, PanByHandlerFunction, PanHandlerConfig } from "src/board-camera/pan/pan-handlers";
import { createDefaultZoomToAtHandler, ZoomToAtHandlerFunction, BaseZoomHandlerConfig, ZoomHandlerConfig, ZoomToHandlerFunction, createDefaultZoomToOnlyHandler, createDefaultZoomToAtWorldHandler, ZoomByAtHandlerFunction, ZoomByHandlerFunction, createDefaultZoomByAtHandler, createDefaultZoomByOnlyHandler, restrictZoomByHandler, createDefaultZoomByAtWorldHandler } from "src/board-camera/zoom/zoom-handler";
import { InputFlowControl } from "./control-center";
import { Point } from "src/index";
import DefaultBoardCamera, { BoardCamera, createDefaultRotateByHandler, createDefaultRotateToHandler, ObservableBoardCamera, RotateByHandlerFunction, RotateToHandlerFunction, RotationHandlerConfig } from "src/board-camera";
import { PointCal } from "point2point";
import { createDefaultPanControlStateMachine, PanContext, PanControlStateMachine } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomContext, ZoomControlStateMachine } from "./zoom-control-state-machine";

export type CameraRigConfig = PanHandlerConfig & BaseZoomHandlerConfig & RotationHandlerConfig;
export class RelayControlCenter implements InputFlowControl {

    private _panStateMachine: PanControlStateMachine;
    private _zoomStateMachine: ZoomControlStateMachine;

    constructor(panStateMachine: PanControlStateMachine, zoomStateMachine: ZoomControlStateMachine){
        this._panStateMachine = panStateMachine;
        this._zoomStateMachine = zoomStateMachine;
    }

    get limitEntireViewPort(): boolean {
        return this._panStateMachine.limitEntireViewPort;
    }

    set limitEntireViewPort(limit: boolean) {
        this._panStateMachine.limitEntireViewPort = limit;
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

    zoomToAt(targetZoom: number, at: Point): void {
        this._zoomToAt(targetZoom, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    zoomByAt(delta: number, at: Point): void {
        this._zoomByAt(delta, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    zoomTo(targetZoom: number): void {
        this._zoomTo(targetZoom, this._camera, this._config);
    }

    zoomBy(delta: number): void {
        this._zoomBy(delta, this._camera, this._config);
    }

    zoomToAtWorld(targetZoom: number, at: Point): void {
        this._zoomToAtWorld(targetZoom, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    zoomByAtWorld(delta: number, at: Point): void {
        this._zoomByAtWorld(delta, this._camera, at, {...this._config, panByHandler: this._panBy});
    }

    panBy(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._panBy(diffInWorld, this._camera, this._config);
    }

    panTo(target: Point): void {
        const deltaInWorld = PointCal.subVector(target, this._camera.position);
        this._panBy(deltaInWorld, this._camera, this._config);
    }

    rotateBy(delta: number): void {
        this._rotateBy(delta, this._camera, this._config);
    }

    rotateTo(target: number): void {
        this._rotateTo(target, this._camera, this._config);
    }

    set limitEntireViewPort(limit: boolean){
        this._config.limitEntireViewPort = limit;
    }

    get limitEntireViewPort(): boolean {
        return this._config.limitEntireViewPort;
    }

    get camera(): ObservableBoardCamera {
        return this._camera;
    }

    get config(): PanHandlerConfig & BaseZoomHandlerConfig {
        return this._config;
    }

    set config(config: CameraRigConfig){
        this._config = {...config};
    }

    configure(config: Partial<CameraRigConfig>){
        this._config = {...this._config, ...config};
    }

    cleanup(): void {
    }

    setup(): void {
    }
}

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

export function createDefaultRelayControlCenter(camera: ObservableBoardCamera): InputFlowControl {
    const context = createDefaultCameraRig(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    return new RelayControlCenter(panStateMachine, zoomStateMachine);
}

export function createDefaultRelayControlCenterWithCameraRig(cameraRig: CameraRig): InputFlowControl {
    const panStateMachine = createDefaultPanControlStateMachine(cameraRig);
    const zoomStateMachine = createDefaultZoomControlStateMachine(cameraRig);
    return new RelayControlCenter(panStateMachine, zoomStateMachine);
}
