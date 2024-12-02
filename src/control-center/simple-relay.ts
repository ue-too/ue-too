import { createDefaultPanByHandler, PanByHandlerFunction, PanHandlerConfig  } from "src/board-camera/pan/pan-handlers";
import { createDefaultZoomToAtHandler, ZoomToAtHandlerFunction } from "src/board-camera/zoom/zoom-handler";
import { InputControlCenter } from "./control-center";
import { Point } from "src/index";
import BoardCamera from "src/board-camera/board-camera-v2";
import { PointCal } from "point2point";
import { PanControlStateMachine } from "./pan-control-state-machine";
import { ZoomControlStateMachine } from "./zoom-control-state-machine";


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

    notifyPanInput(delta: Point): void {
        this._panStateMachine.notifyPanInput(delta);
    }

    notifyZoomInput(delta: number, at: Point): void {
        this._zoomStateMachine.notifyZoomByAtInput(delta, at);
    }

    notifyRotationInput(delta: number): void {
        console.error("Rotation input is not implemented");
    }
}

export type ZoomConfig = {
    restrictZoom: boolean;
}

export class Relay {

    private _panHandler: PanByHandlerFunction;
    private _zoomHandler: ZoomToAtHandlerFunction;
    private _config: PanHandlerConfig & ZoomConfig & { panByHandler: PanByHandlerFunction };
    private _camera: BoardCamera;

    constructor(config: PanHandlerConfig & ZoomConfig, camera: BoardCamera = new BoardCamera()){
        this._panHandler = createDefaultPanByHandler();
        this._zoomHandler = createDefaultZoomToAtHandler();
        this._config = {...config, panByHandler: this._panHandler};
        this._camera = camera;
    }

    notifyPanInput(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._panHandler(this._camera, diffInWorld, this._config);
    }

    notifyZoomByAtInput(delta: number, at: Point): void {
        const targetZoom = this._camera.zoomLevel + delta * this._camera.zoomLevel;
        this._zoomHandler(this._camera, targetZoom, at, this._config);
    }

    notifyRotationInput(delta: number): void {
        // TODO: implement rotation
        console.error("Rotation input is not implemented");
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
}
