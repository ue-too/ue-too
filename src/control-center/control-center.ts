import { Point } from "src/index";
import { PanController } from "src/board-camera/pan";
import { ZoomController } from "src/board-camera/zoom";
import { RotationController } from "src/board-camera/rotation";
import { BoardCamera } from "src/board-camera/interface";

export interface InputControlCenter {
    panController: PanController;
    zoomController: ZoomController;
    rotationController: RotationController;
    notifyPanInput(camera: BoardCamera, diff: Point): void;
    notifyZoomInput(camera: BoardCamera, deltaZoomAmount: number, anchorPoint: Point): void;
    notifyRotationInput(camera: BoardCamera, deltaRotation: number): void;
}

export class SimpleRelay implements InputControlCenter {

    private _panController: PanController;
    private _zoomController: ZoomController;
    private _rotationController: RotationController;

    constructor(panHandler: PanController, zoomHandler: ZoomController, rotationHandler: RotationController){
        this._panController = panHandler;
        this._zoomController = zoomHandler;
        this._rotationController = rotationHandler;
    }

    get panController(): PanController {
        return this._panController;
    }

    get zoomController(): ZoomController {
        return this._zoomController;
    }

    get rotationController(): RotationController {
        return this._rotationController;
    }

    notifyPanInput(camera: BoardCamera, diff: Point): void {
        this._panController.panCameraBy(camera, diff);
    }

    notifyZoomInput(camera: BoardCamera, deltaZoomAmount: number, anchorPoint: Point): void {
        this._zoomController.zoomCameraToAt(camera, camera.zoomLevel + deltaZoomAmount, anchorPoint);
    }

    notifyRotationInput(camera: BoardCamera, deltaRotation: number): void {
        this._rotationController.rotateCameraBy(camera, deltaRotation);
    }
}
