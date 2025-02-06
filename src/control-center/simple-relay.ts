import { createDefaultPanByHandler, PanByHandlerFunction, PanHandlerConfig, PanToHandlerFunction  } from "src/board-camera/pan/pan-handlers";
import { createDefaultZoomToAtHandler, ZoomToAtHandlerFunction, BaseZoomHandlerConfig, ZoomToHandlerFunction, createDefaultZoomToOnlyHandler, createDefaultZoomToAtWorldHandler } from "src/board-camera/zoom/zoom-handler";
import { InputControlCenter } from "./control-center";
import { Point } from "src/index";
import DefaultBoardCamera, { BoardCamera } from "src/board-camera";
import { PointCal } from "point2point";
import { createDefaultPanControlStateMachine, PanContext, PanControlStateMachine } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomContext, ZoomControlStateMachine } from "./zoom-control-state-machine";

export class RelayControlCenter implements InputControlCenter {

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

export class Relay implements PanContext, ZoomContext { // this is used as a context passed to the pan and zoom state machines; essentially a consolidated handler function for pan and zoom

    private _panHandlerBy: PanByHandlerFunction;
    private _panHandlerTo: PanToHandlerFunction;
    private _zoomHandler: ZoomToAtHandlerFunction;
    private _experimentalZoomHandler: ZoomToAtHandlerFunction;
    private _pureZoomHandler: ZoomToHandlerFunction;
    private _config: PanHandlerConfig & BaseZoomHandlerConfig & { panByHandler: PanByHandlerFunction };
    private _camera: BoardCamera;

    constructor(config: PanHandlerConfig & BaseZoomHandlerConfig, camera: BoardCamera = new DefaultBoardCamera()){
        this._panHandlerBy = createDefaultPanByHandler();
        this._zoomHandler = createDefaultZoomToAtHandler();
        this._pureZoomHandler = createDefaultZoomToOnlyHandler();
        this._experimentalZoomHandler = createDefaultZoomToAtWorldHandler();
        this._config = {...config, panByHandler: this._panHandlerBy};
        this._camera = camera;
    }

    notifyPanInput(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._panHandlerBy(this._camera, diffInWorld, this._config);
    }

    notifyPanToInput(target: Point): void {
        const deltaInWorld = PointCal.subVector(target, this._camera.position);
        this._panHandlerBy(this._camera, deltaInWorld, this._config);
    }

    notifyZoomByAtInput(delta: number, at: Point): void {
        const targetZoom = this._camera.zoomLevel + delta * this._camera.zoomLevel;
        this._zoomHandler(this._camera, targetZoom, at, this._config);
    }

    notifyZoomByAtCenterInput(delta: number): void {
        const targetZoom = this._camera.zoomLevel + delta * this._camera.zoomLevel;
        this._zoomHandler(this._camera, targetZoom, {x: this._camera.viewPortWidth / 2, y: this._camera.viewPortHeight / 2}, this._config);
    }

    notifyZoomToAtCenterInput(targetZoom: number): void {
        // this._zoomHandler(this._camera, targetZoom, {x: this._camera.viewPortWidth / 2, y: this._camera.viewPortHeight / 2}, this._config);
        this._pureZoomHandler(this._camera, targetZoom, this._config);
    }

    notifyRotationInput(delta: number): void {
        // TODO: implement rotation
        console.error("Rotation input is not implemented");
    }

    experimentalZoomToAtWorld(targetZoom: number, at: Point): void {
        this._experimentalZoomHandler(this._camera, targetZoom, at, this._config);
    }

    set limitEntireViewPort(limit: boolean){
        this._config.entireViewPort = limit;
    }

    get limitEntireViewPort(): boolean {
        return this._config.entireViewPort;
    }

    get camera(): BoardCamera {
        return this._camera;
    }

    get config(): PanHandlerConfig & BaseZoomHandlerConfig {
        return this._config;
    }

    set config(config: PanHandlerConfig & BaseZoomHandlerConfig){
        this._config = {...config, panByHandler: this._panHandlerBy};
    }

    configure(config: Partial<PanHandlerConfig & BaseZoomHandlerConfig>){
        this._config = {...this._config, ...config, panByHandler: this._panHandlerBy};
    }
}

export function createDefaultRelay(camera: BoardCamera): Relay{
    return new Relay({
        entireViewPort: true,
        restrictRelativeXTranslation: false,
        restrictRelativeYTranslation: false,
        restrictXTranslation: false,
        restrictYTranslation: false,
        restrictZoom: false,
    }, camera);
}

export function createDefaultRelayControlCenter(camera: BoardCamera): InputControlCenter {
    const context = createDefaultRelay(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    return new RelayControlCenter(panStateMachine, zoomStateMachine);
}
