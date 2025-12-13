import { CameraMux, CameraMuxPanOutput, CameraMuxZoomOutput, CameraMuxRotationOutput } from "./interface";
import { Point } from "@ue-too/math";

/**
 * @description The simple relay flow control.
 * This is a stateless mux that always allows input passthrough.
 * The actual camera control happens in the orchestrator.
 *
 * @category Input Flow Control
 */
export class Relay implements CameraMux {

    constructor() {
    }

    notifyPanInput(diff: Point): CameraMuxPanOutput {
        return { allowPassThrough: true, delta: diff };
    }

    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): CameraMuxZoomOutput {
        return { allowPassThrough: true, delta: deltaZoomAmount, anchorPoint: anchorPoint };
    }

    notifyRotationInput(deltaRotation: number): CameraMuxRotationOutput {
        return { allowPassThrough: true, delta: deltaRotation };
    }

}

/**
 * @description Create a default relay control center.
 * The relay is stateless and simply allows all inputs to pass through.
 *
 * @category Input Flow Control
 */
export function createDefaultCameraMux(): CameraMux {
    return new Relay();
}
