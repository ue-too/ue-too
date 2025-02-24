import { Point } from "src/index";

export interface InputControlCenter {
    limitEntireViewPort: boolean;
    notifyPanInput(diff: Point): void;
    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void;
    notifyRotationInput(deltaRotation: number): void;
}
