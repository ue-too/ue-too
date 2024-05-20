import { BoardCamera } from 'src/board-camera';
import { Point } from 'src/index';

import { PanController } from 'src/board-camera/pan';
import { ZoomController } from 'src/board-camera/zoom';
import { RotationController } from 'src/board-camera/rotate'

export interface BoardControlState {
    panCameraTo(camera: BoardCamera, destination: Point): void;
    panCameraBy(camera: BoardCamera, delta: Point): void;
    zoomCameraTo(camera: BoardCamera, targetZoom: number): void;
    zoomCameraBy(camera: BoardCamera, delta: number): void;
    zoomCameraToAt(camera: BoardCamera, targetZoom: number, at: Point): void;
    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void;
    rotateCameraTo(camera: BoardCamera, targetRotation: number): void;
    rotateCameraBy(camera: BoardCamera, delta: number): void;
}

export class Transistion implements BoardControlState {

    private _panHandler: PanController;
    private _zoomHandler: ZoomController;
    private _rotationHandler: RotationController;

    constructor(panHandler: PanController, zoomHandler: ZoomController, rotationHandler: RotationController){
        this._panHandler = panHandler;
        this._zoomHandler = zoomHandler;
        this._rotationHandler = rotationHandler;
    }

    panCameraTo(camera: BoardCamera, destination: Point): void {
        this._panHandler.panCameraTo(camera, destination);
    }

    panCameraBy(camera: BoardCamera, delta: Point): void {
        this._panHandler.panCameraBy(camera, delta);
    }

    zoomCameraTo(camera: BoardCamera, targetZoom: number): void {
        this._zoomHandler.zoomCameraTo(camera, targetZoom);
    }

    zoomCameraBy(camera: BoardCamera, delta: number): void {
        this._zoomHandler.zoomCameraBy(camera, delta);
    }

    zoomCameraToAt(camera: BoardCamera, targetZoom: number, at: Point): void {
        this._zoomHandler.zoomCameraToAt(camera, targetZoom, at);
    }

    zoomCameraByAt(camera: BoardCamera, delta: number, at: Point): void {
        this._zoomHandler.zoomCameraByAt(camera, delta, at);
    }

    rotateCameraTo(camera: BoardCamera, targetRotation: number): void {
        this._rotationHandler.rotateCameraTo(camera, targetRotation);
    }

    rotateCameraBy(camera: BoardCamera, delta: number): void {
        this._rotationHandler.rotateCameraBy(camera, delta);
    }
}
