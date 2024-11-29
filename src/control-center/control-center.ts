import { Point } from "src/index";
import { PanController } from "src/board-camera/pan";
import { ZoomController } from "src/board-camera/zoom";
import { RotationController } from "src/board-camera/rotation";
import BoardCamera from "src/board-camera/board-camera-v2";
import { PointCal } from "point2point";

export interface InputControlCenter {
    panController: PanController;
    zoomController: ZoomController;
    rotationController: RotationController;
    notifyPanInput(diff: Point): void;
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void;
    notifyRotationInput(deltaRotation: number): void;
}

export class SimpleRelay implements InputControlCenter {

    private _panController: PanController;
    private _zoomController: ZoomController;
    private _rotationController: RotationController;
    private _camera: BoardCamera;

    constructor(panHandler: PanController, zoomHandler: ZoomController, rotationHandler: RotationController, camera: BoardCamera = new BoardCamera()){
        this._panController = panHandler;
        this._zoomController = zoomHandler;
        this._rotationController = rotationHandler;
        this._camera = camera;
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

    notifyPanInput(diff: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(PointCal.rotatePoint(diff, this._camera.rotation), 1 / this._camera.zoomLevel);
        this._panController.panCameraBy(this._camera, diffInWorld);
    }

    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void {
        const targetZoom = this._camera.zoomLevel + deltaZoomAmount * this._camera.zoomLevel;
        this._zoomController.zoomCameraToAt(this._camera, targetZoom, anchorPoint);
    }

    notifyRotationInput(deltaRotation: number): void {
        this._rotationController.rotateCameraBy(this._camera, deltaRotation);
    }
}
