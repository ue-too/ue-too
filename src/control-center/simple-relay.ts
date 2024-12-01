import { createDefaultPanByHandler, PanByHandlerFunction, PanHandlerConfig  } from "src/board-camera/pan/pan-handlers";
import { createDefaultZoomByAtHandler, createDefaultZoomToAtHandler, ZoomByAtHandlerFunction, ZoomHandlerConfig, ZoomToAtHandlerFunction } from "src/board-camera/zoom/zoom-handler";
import { InputControlCenter } from "./control-center";
import { Point } from "src/index";
import BoardCamera from "src/board-camera/board-camera-v2";
import { PointCal } from "point2point";


export type ZoomConfig = {
    restrictZoom: boolean;
}

export class Relay implements InputControlCenter {

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

    notifyZoomInput(delta: number, at: Point): void {
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
}
