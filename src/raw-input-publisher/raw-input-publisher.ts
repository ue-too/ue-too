import { Point } from "src/util/misc";
import { createDefaultFlowControl, InputFlowControl } from "src/input-flow-control";
import BoardCamera from "src/board-camera";
import { Observable, Observer } from "src/util";

/**
 * @description The unsubscribe to user raw input.
 * 
 * @category Event Parser
 */
export type UnsubscribeToUserRawInput = () => void;

/**
 * @description The raw user pan input event payload.
 * 
 * @category Event Parser
 */
export type RawUserPanInputEventPayload = {
    diff: Point;
}

/**
 * @description The raw user pan input event.
 * Use type to discriminate between pan, zoom, and rotate events.
 * 
 * @category Event Parser
 */
export type RawUserPanInputEvent = {
    type: "pan",
} & RawUserPanInputEventPayload;

/**
 * @description The raw user zoom input event payload.
 * 
 * @category Event Parser
 */
export type RawUserZoomInputEventPayload = {
    deltaZoomAmount: number;
    anchorPoint: Point;
}

/**
 * @description The raw user zoom input event.
 * Use type to discriminate between pan, zoom, and rotate events.
 * 
 * @category Event Parser
 */
export type RawUserZoomInputEvent = {
    type: "zoom",
} & RawUserZoomInputEventPayload;

/**
 * @description The raw user rotate input event payload.
 * 
 * @category Event Parser
 */
export type RawUserRotateInputEventPayload = {
    deltaRotation: number;
}

/**
 * @description The raw user rotate input event.
 * Use type to discriminate between pan, zoom, and rotate events.
 * 
 * @category Event Parser
 */
export type RawUserRotateInputEvent = {
    type: "rotate",
} & RawUserRotateInputEventPayload;

/**
 * @description The raw user input event map.
 * 
 * @category Event Parser
 */
export type RawUserInputEventMap = {
    "pan": RawUserPanInputEventPayload,
    "zoom": RawUserZoomInputEventPayload,
    "rotate": RawUserRotateInputEventPayload,
    "all": RawUserInputEvent,
}

/**
 * @description The raw user input event.
 * Use type to discriminate between pan, zoom, and rotate events.
 * 
 * @category Event Parser
 */
export type RawUserInputEvent = RawUserPanInputEvent | RawUserZoomInputEvent | RawUserRotateInputEvent;

/**
 * @description The raw user input callback.
 * This is the function type of callbacks for raw user input events.
 * 
 * @category Event Parser
 */
export type RawUserInputCallback<K extends keyof RawUserInputEventMap> = (event: RawUserInputEventMap[K])=>void;

/**
 * @description The raw user input publisher.
 * Publishs raw user input events to the input flow control, and subscribers.
 * 
 * @category Event Parser
 */
export class RawUserInputPublisher {

    private pan: Observable<Parameters<RawUserInputCallback<"pan">>>;
    private zoom: Observable<Parameters<RawUserInputCallback<"zoom">>>;
    private rotate: Observable<Parameters<RawUserInputCallback<"rotate">>>;
    private all: Observable<Parameters<RawUserInputCallback<"all">>>;
    private _flowControl: InputFlowControl;

    constructor(flowControl: InputFlowControl){
        this.pan = new Observable<Parameters<RawUserInputCallback<"pan">>>();
        this.zoom = new Observable<Parameters<RawUserInputCallback<"zoom">>>();
        this.rotate = new Observable<Parameters<RawUserInputCallback<"rotate">>>();
        this.all = new Observable<Parameters<RawUserInputCallback<"all">>>();
        this._flowControl = flowControl;
    }

    notifyPan(diff: Point): void {
        this._flowControl.notifyPanInput(diff);
        this.pan.notify({diff: diff});
        this.all.notify({type: "pan", diff: diff});
    }

    notifyZoom(deltaZoomAmount: number, anchorPoint: Point): void {
        this._flowControl.notifyZoomInput(deltaZoomAmount, anchorPoint);
        this.zoom.notify({deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
        this.all.notify({type: "zoom", deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
    }

    notifyRotate(deltaRotation: number): void {
        this._flowControl.notifyRotationInput(deltaRotation);
        this.rotate.notify({deltaRotation: deltaRotation});
        this.all.notify({type: "rotate", deltaRotation: deltaRotation});
    }
    
    on<K extends keyof RawUserInputEventMap>(eventName: K, callback: (event: RawUserInputEventMap[K])=>void): UnsubscribeToUserRawInput {
        switch (eventName){
        case "pan":
            return this.pan.subscribe(callback as Observer<Parameters<RawUserInputCallback<"pan">>>);
        case "zoom":
            return this.zoom.subscribe(callback as Observer<Parameters<RawUserInputCallback<"zoom">>>);
        case "rotate":
            return this.rotate.subscribe(callback as Observer<Parameters<RawUserInputCallback<"rotate">>>);
        case "all":
            return this.all.subscribe(callback as Observer<Parameters<RawUserInputCallback<"all">>>);
        default:
            throw new Error("Invalid raw user input event name");
        }
    }

    get flowControl(): InputFlowControl {
        return this._flowControl;
    }

    set flowControl(flowControl: InputFlowControl){
        this._flowControl = flowControl;
    }
}

/**
 * @description Creates a default raw user input publisher.
 * 
 * @category Event Parser
 */
export function createDefaultRawUserInputPublisher(camera: BoardCamera): RawUserInputPublisher {
    return new RawUserInputPublisher(createDefaultFlowControl(camera));
}
