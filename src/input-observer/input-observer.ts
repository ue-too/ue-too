import { Point } from "src/index";
import { InputControlCenter } from "src/control-center";
import { BoardCamera } from "src/board-camera";

export type UnsubscribeToInput = () => void;

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

export class InputObserver {

    private panCallbackList: InputCallBackList<"pan"> = [];
    private zoomCallbackList: InputCallBackList<"zoom"> = [];
    private rotateCallbackList: InputCallBackList<"rotate"> = [];

    private _controlCenter: InputControlCenter;

    constructor(controlCenter: InputControlCenter){
        this._controlCenter = controlCenter;
    }

    notifyOnPan(camera: BoardCamera, diff: Point): void{
        this._controlCenter.notifyPanInput(camera, diff);
        this.panCallbackList.forEach((callback) => {
            queueMicrotask(()=>{callback({diff: diff});});
        });
    }

    notifyOnZoom(camera: BoardCamera, deltaZoomAmount: number, anchorPoint: Point): void{
        this._controlCenter.notifyZoomInput(camera, deltaZoomAmount, anchorPoint);
        this.zoomCallbackList.forEach((callback) => {
            queueMicrotask(()=>{callback({deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});});
        });
    }

    notifyOnRotation(camera: BoardCamera, deltaRotation: number): void{
        this._controlCenter.notifyRotationInput(camera, deltaRotation);
        this.rotateCallbackList.forEach((callback) => {
            queueMicrotask(()=>{callback({deltaRotation: deltaRotation});});
        });
    }

    onInput<K extends keyof BoardInputEvent>(eventName: K, callback: (event: BoardInputEvent[K])=>void): UnsubscribeToInput {
        switch (eventName){
        case "pan":
            this.panCallbackList.push(callback as (event: BoardInputEvent["pan"])=>void);
            return () => {
                this.panCallbackList = this.panCallbackList.filter((cb) => cb !== callback);
            }
        case "zoom":
            this.zoomCallbackList.push(callback as (event: BoardInputEvent["zoom"])=>void);
            return () => {
                this.zoomCallbackList = this.zoomCallbackList.filter((cb) => cb !== callback);
            }
        case "rotate":
            this.rotateCallbackList.push(callback as (event: BoardInputEvent["rotate"])=>void);
            return () => {
                this.rotateCallbackList = this.rotateCallbackList.filter((cb) => cb !== callback);
            }
        default:
            throw new Error("Invalid input event name");
        }
    }

    get controlCenter(): InputControlCenter {
        return this._controlCenter;
    }

    set controlCenter(value: InputControlCenter){
        this._controlCenter = value;
    }
}
