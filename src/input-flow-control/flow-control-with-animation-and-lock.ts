
import { InputFlowControl } from "./interface";
import { Point } from "src/utils/misc";
import { ObservableBoardCamera } from "src/board-camera";
import { createDefaultPanControlStateMachine, PanControlStateMachine } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomControlStateMachine } from "./zoom-control-state-machine";
import { createDefaultRotateControlStateMachine, RotateControlStateMachine } from "./rotate-control-state-machine";
import { CameraRig } from "src/board-camera/camera-rig";
import { createDefaultCameraRig } from "src/board-camera/camera-rig";

/**
 * @description The flow control with animation and lock input.
 * 
 * This is a customized input flow control that suits a specific use case.
 * 
 * You can use the default one ({@link SimpleRelayFlowControl}) instead or implement your own.
 * 
 * The internal ruleset on which input is used and which is ignored is controlled by the state machines.
 * 
 * @category Input Flow Control
 */
export class FlowControlWithAnimationAndLockInput implements InputFlowControl {

    private _panStateMachine: PanControlStateMachine;
    private _zoomStateMachine: ZoomControlStateMachine;
    private _rotateStateMachine: RotateControlStateMachine;

    constructor(panStateMachine: PanControlStateMachine, zoomStateMachine: ZoomControlStateMachine, rotateStateMachine: RotateControlStateMachine){
        this._panStateMachine = panStateMachine;
        this._zoomStateMachine = zoomStateMachine;
        this._rotateStateMachine = rotateStateMachine;
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

    notifyRotateByInput(delta: number): void {
        this._rotateStateMachine.notifyRotateByInput(delta);
    }

    notifyRotateToAnimationInput(target: number): void {
        this._rotateStateMachine.notifyRotateToAnimationInput(target);
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

    initateRotateTransition(): void {
        this._rotateStateMachine.initateTransition();
    }

    get rotateStateMachine(): RotateControlStateMachine {
        return this._rotateStateMachine;
    }

    get panStateMachine(): PanControlStateMachine {
        return this._panStateMachine;
    }

    get zoomStateMachine(): ZoomControlStateMachine {
        return this._zoomStateMachine;
    }
}

/**
 * @description Create a flow control that allows animation and lock inputs.
 * 
 * @category Input Flow Control
 */
export function createFlowControlWithAnimationAndLock(camera: ObservableBoardCamera): InputFlowControl {
    const context = createDefaultCameraRig(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    const rotateStateMachine = createDefaultRotateControlStateMachine(context);
    return new FlowControlWithAnimationAndLockInput(panStateMachine, zoomStateMachine, rotateStateMachine);
}

/**
 * @description Create a default flow control with a camera rig.
 * 
 * @category Input Flow Control
 */
export function createFlowControlWithAnimationAndLockWithCameraRig(cameraRig: CameraRig): InputFlowControl {
    const panStateMachine = createDefaultPanControlStateMachine(cameraRig);
    const zoomStateMachine = createDefaultZoomControlStateMachine(cameraRig);
    const rotateStateMachine = createDefaultRotateControlStateMachine(cameraRig);
    return new FlowControlWithAnimationAndLockInput(panStateMachine, zoomStateMachine, rotateStateMachine);
}
