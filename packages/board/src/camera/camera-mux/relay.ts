import DefaultBoardCamera from "../default-camera";
import { ObservableBoardCamera } from "../interface";
import { CameraRig, createDefaultCameraRig } from "../camera-rig";
import { CameraMux } from "./interface";
import { Point } from "@ue-too/math";

/**
 * @description The simple relay flow control.
 * This would be the default flow control for {@link Board}.
 * 
 * @category Input Flow Control
 */
export class Relay implements CameraMux {

    private _cameraRig: CameraRig;

    constructor(cameraRig: CameraRig = createDefaultCameraRig(new DefaultBoardCamera())) {
        this._cameraRig = cameraRig;
    }

    notifyPanInput(diff: Point): void {
        this._cameraRig.panByViewPort(diff);
    }
    
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void {
        this._cameraRig.zoomByAt(deltaZoomAmount, anchorPoint);
    }

    notifyRotationInput(deltaRotation: number): void {
        this._cameraRig.rotateBy(deltaRotation);
    }
    
}

/**
 * @description Create a default relay control center.
 * 
 * @category Input Flow Control
 */
export function createDefaultCameraMux(camera: ObservableBoardCamera): CameraMux {
    const context = createDefaultCameraRig(camera);
    return new Relay(context);
}

/**
 * 
 */
export function createDefaultCameraMuxWithCameraRig(cameraRig: CameraRig): CameraMux {
    return new Relay(cameraRig);
}
