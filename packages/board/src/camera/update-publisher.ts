import { Point } from "@ue-too/math";
import { AsyncObservable, Observable, Observer, SubscriptionOptions } from "../utils/observable";

/**
 * @description The payload for the pan event.
 * 
 * @category Camera
 */
export type CameraPanEventPayload = {
    diff: Point;
}

/**
 * @description The payload for the zoom event.
 * 
 * @category Camera
 */
export type CameraZoomEventPayload = {
    deltaZoomAmount: number;
}

/**
 * @description The payload for the rotate event.
 * 
 * @category Camera
 */
export type CameraRotateEventPayload = {
    deltaRotation: number;
}

/**
 * @description The mapping of the camera events.
 * This is primarily used for type inference.
 * 
 * @category Camera
 */
export type CameraEventMap = {
    "pan": CameraPanEventPayload,
    "zoom": CameraZoomEventPayload,
    "rotate": CameraRotateEventPayload,
    "all": AllCameraEventPayload,
}

/**
 * @description The type of the camera rotate event.
 * The type is for discriminating the event type when the all event is triggered.
 * 
 * @category Camera
 */
export type CameraRotateEvent = {
    type: "rotate",
} & CameraRotateEventPayload;

/**
 * @description The type of the camera pan event.
 * The type is for discriminating the event type when the all event is triggered.
 * 
 * @category Camera
 */
export type CameraPanEvent = {
    type: "pan",
} & CameraPanEventPayload;

/**
 * @description The type of the camera zoom event.
 * The type is for discriminating the event type when the all event is triggered.
 * 
 * @category Camera
 */
export type CameraZoomEvent = {
    type: "zoom",
} & CameraZoomEventPayload;

/**
 * @description The type of the camera state.
 * 
 * @category Camera
 */
export type CameraState = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

/**
 * @description The payload type of the "all" camera event payload.
 * 
 * @category Camera
 */
export type AllCameraEventPayload = CameraRotateEvent | CameraPanEvent | CameraZoomEvent;

/**
 * @description The callback function type for the camera event.
 * 
 * @category Camera
 */
export type Callback<K extends keyof CameraEventMap> = (event: CameraEventMap[K], cameraState: CameraState)=>void;

/**
 * @description The callback function type for the "all" camera event.
 * 
 * @category Camera
 */
export type ConslidateCallback = (payload: AllCameraEventPayload, cameraState: CameraState) => void;

/**
 * @description The type of the unsubscribe function.
 * 
 * @category Camera
 */
export type UnSubscribe = () => void;

/**
 * @description The observer type for the pan event.
 * 
 * @category Camera
 */
export type PanObserver = Callback<"pan">;

/**
 * @description The observer type for the zoom event.
 * 
 * @category Camera
 */
export type ZoomObserver = Callback<"zoom">;

/**
 * @description The observer type for the rotate event.
 * 
 * @category Camera
 */
export type RotateObserver = Callback<"rotate">;

/**
 * @description The observer type for the "all" camera event.
 * 
 * @category Camera
 */
export type AllObserver = Callback<"all">;

/**
 * @description The camera update publisher.
 * 
 * @category Camera
 */
export class CameraUpdatePublisher {

    private pan: Observable<Parameters<Callback<"pan">>>;
    private zoom: Observable<Parameters<Callback<"zoom">>>;
    private rotate: Observable<Parameters<Callback<"rotate">>>;
    private all: Observable<Parameters<Callback<"all">>>;

    constructor() {
        this.pan = new AsyncObservable<Parameters<Callback<"pan">>>();
        this.zoom = new AsyncObservable<Parameters<Callback<"zoom">>>();
        this.rotate = new AsyncObservable<Parameters<Callback<"rotate">>>();
        this.all = new AsyncObservable<Parameters<Callback<"all">>>();
    }

    /**
     * @description Notify the pan event.
     * Will also notify the "all" event.
     * 
     * @category Camera
     */
    notifyPan(event: CameraEventMap["pan"], cameraState: CameraState): void {
        this.pan.notify(event, cameraState);
        this.all.notify({type: "pan", diff: event.diff}, cameraState);
    }

    /**
     * @description Notify the zoom event.
     * Will also notify the "all" event.
     * 
     * @category Camera
     */
    notifyZoom(event: CameraEventMap["zoom"], cameraState: CameraState): void {
        this.zoom.notify(event, cameraState);
        this.all.notify({type: "zoom", deltaZoomAmount: event.deltaZoomAmount}, cameraState);
    }

    /**
     * @description Notify the rotate event.
     * Will also notify the "all" event.
     * 
     * @category Camera
     */
    notifyRotate(event: CameraEventMap["rotate"], cameraState: CameraState): void {
        this.rotate.notify(event, cameraState);
        this.all.notify({type: "rotate", deltaRotation: event.deltaRotation}, cameraState);
    }
    
    /**
     * @description Subscribe to the camera event.
     * You can also pass in the abort controller signal within the options to cancel the subscription. Like this:
     * ```ts
     * const controller = new AbortController();
     * const unSubscribe = on("pan", (event, cameraState)=>{}, {signal: controller.signal});
     * 
     * // later in other place where you want to unsubscribe
     * controller.abort();
     *
     * ```
     * This means you can cancel multiple subscriptions by aborting the same controller. Just like regular event listeners.
     * 
     * @category Camera
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void, options?: SubscriptionOptions): UnSubscribe {
        switch (eventName){
        case "pan":
            return this.pan.subscribe(callback as Observer<Parameters<Callback<"pan">>>, options);
        case "zoom":
            return this.zoom.subscribe(callback as Observer<Parameters<Callback<"zoom">>>, options);
        case "rotate":
            return this.rotate.subscribe(callback as Observer<Parameters<Callback<"rotate">>>, options);
        case "all":
            return this.all.subscribe(callback as Observer<Parameters<Callback<"all">>>, options);
        default:
            throw new Error(`Invalid event name: ${eventName}`);
        }
    }
}
