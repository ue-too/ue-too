import { Point } from "src/utils/misc";

/**
 * @description The interface for the input flow control.
 * It should at least have user input handlers for pan, zoom and rotation.
 * 
 * @category Input Flow Control
 */
export interface InputFlowControl {
    notifyPanInput(diff: Point): void;
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void;
    notifyRotationInput(deltaRotation: number): void;
}
