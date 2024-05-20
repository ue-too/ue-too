import { Point } from "src/index";

export type PanInputEvent = {
    diff: Point;
}

export type ZoomInputEvent = {
    deltaZoomAmount: number;
    anchorPoint: Point;
}

export type RotateInputEvent = {
    deltaRotation: number;
}

export type BoardInputEvent = {
    "pan": PanInputEvent,
    "zoom": ZoomInputEvent,
    "rotate": RotateInputEvent
}

export type InputCallBackList<K extends keyof BoardInputEvent> = ((event: BoardInputEvent[K])=>void)[];
