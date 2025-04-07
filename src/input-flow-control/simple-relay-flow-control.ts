import DefaultBoardCamera, { ObservableBoardCamera } from "src/board-camera";
import { CameraRig, createDefaultCameraRig } from "src/board-camera/camera-rig";
import { InputFlowControl } from "./interface";
import { Point } from "src/util/misc";

/**
 * @description The simple relay flow control.
 * This would be the default flow control for {@link Board}.
 * 
 * @category Input Flow Control
 */
export class SimpleRelayFlowControl implements InputFlowControl {

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
export function createDefaultFlowControl(camera: ObservableBoardCamera): InputFlowControl {
    const context = createDefaultCameraRig(camera);
    return new SimpleRelayFlowControl(context);
}

/**
 * 
 */
export function createDefaultFlowControlWithCameraRig(cameraRig: CameraRig): InputFlowControl {
    return new SimpleRelayFlowControl(cameraRig);
}
