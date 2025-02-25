import DefaultBoardCamera from "src/board-camera";
import { CameraRig, createDefaultCameraRig } from "./flow-control-with-animation-and-lock";
import { InputFlowControl } from "./interface";
import { Point } from "src/util/misc";

export class SimpleRelayFlowControl implements InputFlowControl {

    private _cameraRig: CameraRig;

    constructor(cameraRig: CameraRig = createDefaultCameraRig(new DefaultBoardCamera())) {
        this._cameraRig = cameraRig;
    }

    // get limitEntireViewPort(): boolean {
    //     return this._cameraRig.limitEntireViewPort;
    // }

    // set limitEntireViewPort(value: boolean) {
    //     this._cameraRig.limitEntireViewPort = value;
    // }

    notifyPanInput(diff: Point): void {
        this._cameraRig.panBy(diff);
    }
    
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void {
        this._cameraRig.zoomByAt(deltaZoomAmount, anchorPoint);
    }

    notifyRotationInput(deltaRotation: number): void {
        this._cameraRig.rotateBy(deltaRotation);
    }
    
}
