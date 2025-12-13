import type { Point } from "@ue-too/math";

/**
 * @description Output from CameraMux pan input.
 * Indicates whether the pan input is allowed to pass through and the delta if allowed.
 *
 * @category Input Flow Control
 */
export type CameraMuxPanOutput =
    | { allowPassThrough: true, delta: Point }
    | { allowPassThrough: false };

/**
 * @description Output from CameraMux zoom input.
 * Indicates whether the zoom input is allowed to pass through and the zoom data if allowed.
 *
 * @category Input Flow Control
 */
export type CameraMuxZoomOutput =
    | { allowPassThrough: true, delta: number, anchorPoint: Point }
    | { allowPassThrough: false };

/**
 * @description Output from CameraMux rotation input.
 * Indicates whether the rotation input is allowed to pass through and the delta if allowed.
 *
 * @category Input Flow Control
 */
export type CameraMuxRotationOutput =
    | { allowPassThrough: true, delta: number }
    | { allowPassThrough: false };

/**
 * @description The interface for the input flow control.
 * It should at least have user input handlers for pan, zoom and rotation.
 * Each method returns an output indicating whether the input was accepted.
 *
 * @category Input Flow Control
 */
export interface CameraMux {
    notifyPanInput(diff: Point): CameraMuxPanOutput;
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): CameraMuxZoomOutput;
    notifyRotationInput(deltaRotation: number): CameraMuxRotationOutput;
}
