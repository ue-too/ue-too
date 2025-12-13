
import { CameraMux, CameraMuxPanOutput, CameraMuxZoomOutput, CameraMuxRotationOutput } from "../interface";
import { Point } from "@ue-too/math";
import { ObservableBoardCamera } from "../../interface";
import { createDefaultPanControlStateMachine, PanControlStateMachine, PanControlOutputEvent } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomControlStateMachine, ZoomControlOutputEvent } from "./zoom-control-state-machine";
import { createDefaultRotateControlStateMachine, RotateControlStateMachine, RotateControlOutputEvent } from "./rotation-control-state-machine";
import { CameraRig } from "../../camera-rig";
import { createDefaultCameraRig } from "../../camera-rig";

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
export class CameraMuxWithAnimationAndLock implements CameraMux {

    private _panStateMachine: PanControlStateMachine;
    private _zoomStateMachine: ZoomControlStateMachine;
    private _rotateStateMachine: RotateControlStateMachine;

    constructor(panStateMachine: PanControlStateMachine, zoomStateMachine: ZoomControlStateMachine, rotateStateMachine: RotateControlStateMachine){
        this._panStateMachine = panStateMachine;
        this._zoomStateMachine = zoomStateMachine;
        this._rotateStateMachine = rotateStateMachine;
    }

    notifyPanToAnimationInput(target: Point): CameraMuxPanOutput {
        const res = this._panStateMachine.notifyPanToAnimationInput(target);

        if(res.handled) {
            const output = res.output;
            if(output !== undefined){
                switch(output.type){
                    case 'panByViewPort':
                        return { allowPassThrough: true, delta: output.delta };
                    case 'panToWorld':
                        return { allowPassThrough: true, delta: output.target };
                    default:
                        return { allowPassThrough: false };
                }

            }
        }
        return { allowPassThrough: false };
    }

    notifyPanInput(delta: Point): CameraMuxPanOutput {
        const result = this._panStateMachine.happens("userPanByInput", { diff: delta });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as PanControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta };
            }
        }
        return { allowPassThrough: false };
    }

    notifyZoomInput(delta: number, at: Point): CameraMuxZoomOutput {
        const result = this._zoomStateMachine.happens("userZoomByAtInput", { deltaZoom: delta, anchorPoint: at });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as ZoomControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta, anchorPoint: at };
            }
        }
        return { allowPassThrough: false };
    }

    notifyRotateByInput(delta: number) {
        return this._rotateStateMachine.notifyRotateByInput(delta);
    }

    notifyRotateToAnimationInput(target: number) {
        return this._rotateStateMachine.notifyRotateToAnimationInput(target);
    }

    notifyZoomInputAnimation(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtCenterInput(targetZoom, at);
    }

    notifyZoomInputAnimationWorld(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtWorldInput(targetZoom, at);
    }

    notifyRotationInput(delta: number): CameraMuxRotationOutput {
        const result = this._rotateStateMachine.happens("userRotateByInput", { diff: delta });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as RotateControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta };
            }
        }
        return { allowPassThrough: false };
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
export function createCameraMuxWithAnimationAndLock(camera: ObservableBoardCamera): CameraMux {
    const context = createDefaultCameraRig(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    const rotateStateMachine = createDefaultRotateControlStateMachine(context);
    return new CameraMuxWithAnimationAndLock(panStateMachine, zoomStateMachine, rotateStateMachine);
}

/**
 * @description Create a default flow control with a camera rig.
 * 
 * @category Input Flow Control
 */
export function createCameraMuxWithAnimationAndLockWithCameraRig(cameraRig: CameraRig): CameraMux {
    const panStateMachine = createDefaultPanControlStateMachine(cameraRig);
    const zoomStateMachine = createDefaultZoomControlStateMachine(cameraRig);
    const rotateStateMachine = createDefaultRotateControlStateMachine(cameraRig);
    return new CameraMuxWithAnimationAndLock(panStateMachine, zoomStateMachine, rotateStateMachine);
}
