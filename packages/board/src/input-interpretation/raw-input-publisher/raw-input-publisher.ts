import type { Point } from "@ue-too/math";
import { AsyncObservable, Observable, Observer } from "../../utils/observable";

/**
 * Function to unsubscribe from raw user input events.
 *
 * @remarks
 * Calling this function removes the subscriber from the event stream.
 *
 * @category Raw Input Publisher
 */
export type UnsubscribeToUserRawInput = () => void;

/**
 * Payload for pan input events.
 *
 * @property diff - The pan delta in viewport pixels
 *
 * @category Raw Input Publisher
 */
export type RawUserPanInputEventPayload = {
    diff: Point;
}

/**
 * Pan input event with discriminated type.
 *
 * @remarks
 * The `type` property allows TypeScript discriminated unions to distinguish
 * between different event types when subscribing to the "all" event stream.
 *
 * @category Raw Input Publisher
 */
export type RawUserPanInputEvent = {
    type: "pan",
} & RawUserPanInputEventPayload;

/**
 * Payload for zoom input events.
 *
 * @property deltaZoomAmount - The zoom delta (scale change)
 * @property anchorPoint - The zoom anchor point in viewport coordinates
 *
 * @category Raw Input Publisher
 */
export type RawUserZoomInputEventPayload = {
    deltaZoomAmount: number;
    anchorPoint: Point;
}

/**
 * Zoom input event with discriminated type.
 *
 * @remarks
 * The `type` property allows TypeScript discriminated unions to distinguish
 * between different event types when subscribing to the "all" event stream.
 *
 * @category Raw Input Publisher
 */
export type RawUserZoomInputEvent = {
    type: "zoom",
} & RawUserZoomInputEventPayload;

/**
 * Payload for rotate input events.
 *
 * @property deltaRotation - The rotation delta in radians
 *
 * @category Raw Input Publisher
 */
export type RawUserRotateInputEventPayload = {
    deltaRotation: number;
}

/**
 * Rotate input event with discriminated type.
 *
 * @remarks
 * The `type` property allows TypeScript discriminated unions to distinguish
 * between different event types when subscribing to the "all" event stream.
 *
 * @category Raw Input Publisher
 */
export type RawUserRotateInputEvent = {
    type: "rotate",
} & RawUserRotateInputEventPayload;

/**
 * Mapping of event names to their payload types.
 *
 * @remarks
 * This type enables type-safe event subscription:
 * - Subscribe to specific events ("pan", "zoom", "rotate") to receive only those payloads
 * - Subscribe to "all" to receive all events with discriminated type property
 *
 * @category Raw Input Publisher
 */
export type RawUserInputEventMap = {
    "pan": RawUserPanInputEventPayload,
    "zoom": RawUserZoomInputEventPayload,
    "rotate": RawUserRotateInputEventPayload,
    "all": RawUserInputEvent,
}

/**
 * Union type of all raw user input events.
 *
 * @remarks
 * Use the `type` discriminator property to determine which event variant you have.
 *
 * @category Raw Input Publisher
 */
export type RawUserInputEvent = RawUserPanInputEvent | RawUserZoomInputEvent | RawUserRotateInputEvent;

/**
 * Callback function type for raw user input events.
 *
 * @typeParam K - The event name key from RawUserInputEventMap
 *
 * @category Raw Input Publisher
 */
export type RawUserInputCallback<K extends keyof RawUserInputEventMap> = (event: RawUserInputEventMap[K])=>void;

/**
 * Interface for publishing raw user input events to observers.
 *
 * @remarks
 * This interface defines the contract for broadcasting user input events
 * to external subscribers. Implementations provide the observable pattern
 * for input event distribution.
 *
 * @category Raw Input Publisher
 */
export interface UserInputPublisher {
    /** Notifies subscribers of a pan gesture */
    notifyPan(diff: Point): void;
    /** Notifies subscribers of a zoom gesture */
    notifyZoom(deltaZoomAmount: number, anchorPoint: Point): void;
    /** Notifies subscribers of a rotate gesture */
    notifyRotate(deltaRotation: number): void;
    /** Subscribes to input events */
    on<K extends keyof RawUserInputEventMap>(eventName: K, callback: (event: RawUserInputEventMap[K])=>void): UnsubscribeToUserRawInput;
}

/**
 * Publisher for broadcasting raw user input events to observers.
 *
 * @remarks
 * This class implements the observable pattern to distribute user input events
 * to external subscribers. It operates in parallel to camera control - the
 * orchestrator both sends events to this publisher AND controls the camera.
 *
 * **Architecture**:
 * ```
 * Orchestrator → Publisher → Observers (UI, analytics, etc.)
 *             ↓
 *          CameraMux → CameraRig
 * ```
 *
 * **Event Streams**:
 * - **Specific streams**: Subscribe to "pan", "zoom", or "rotate" for typed events
 * - **Unified stream**: Subscribe to "all" for all events with type discriminator
 *
 * **Use Cases**:
 * - Update UI elements based on user interactions
 * - Log analytics about user gestures
 * - Synchronize secondary views or previews
 * - Implement custom gesture reactions independent of camera
 *
 * **Observable Implementation**:
 * Uses AsyncObservable for asynchronous event delivery, preventing observers
 * from blocking the input processing pipeline.
 *
 * @category Raw Input Publisher
 *
 * @example
 * ```typescript
 * const publisher = new RawUserInputPublisher();
 *
 * // Subscribe to pan events
 * const unsubscribe = publisher.on("pan", (event) => {
 *   console.log("User panned by:", event.diff);
 *   updateMinimap(event.diff);
 * });
 *
 * // Subscribe to all events
 * publisher.on("all", (event) => {
 *   switch (event.type) {
 *     case "pan":
 *       analytics.log("pan", event.diff);
 *       break;
 *     case "zoom":
 *       analytics.log("zoom", event.deltaZoomAmount, event.anchorPoint);
 *       break;
 *     case "rotate":
 *       analytics.log("rotate", event.deltaRotation);
 *       break;
 *   }
 * });
 *
 * // Later, unsubscribe
 * unsubscribe();
 * ```
 */
export class RawUserInputPublisher implements UserInputPublisher {

    private pan: Observable<Parameters<RawUserInputCallback<"pan">>>;
    private zoom: Observable<Parameters<RawUserInputCallback<"zoom">>>;
    private rotate: Observable<Parameters<RawUserInputCallback<"rotate">>>;
    private all: Observable<Parameters<RawUserInputCallback<"all">>>;

    constructor(){
        this.pan = new AsyncObservable<Parameters<RawUserInputCallback<"pan">>>();
        this.zoom = new AsyncObservable<Parameters<RawUserInputCallback<"zoom">>>();
        this.rotate = new AsyncObservable<Parameters<RawUserInputCallback<"rotate">>>();
        this.all = new AsyncObservable<Parameters<RawUserInputCallback<"all">>>();
    }

    notifyPan(diff: Point): void {
        this.pan.notify({diff: diff});
        this.all.notify({type: "pan", diff: diff});
    }

    notifyZoom(deltaZoomAmount: number, anchorPoint: Point): void {
        this.zoom.notify({deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
        this.all.notify({type: "zoom", deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
    }

    notifyRotate(deltaRotation: number): void {
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
}

/**
 * Creates a default raw user input publisher.
 *
 * @returns A new RawUserInputPublisher instance
 *
 * @remarks
 * Factory function for creating a standard publisher. Useful for dependency injection
 * and testing scenarios where you want to swap implementations.
 *
 * @category Raw Input Publisher
 */
export function createDefaultRawUserInputPublisher(): RawUserInputPublisher {
    return new RawUserInputPublisher();
}

export class RawUserInputPublisherWithWebWorkerRelay implements UserInputPublisher {

    private pan: Observable<Parameters<RawUserInputCallback<"pan">>>;
    private zoom: Observable<Parameters<RawUserInputCallback<"zoom">>>;
    private rotate: Observable<Parameters<RawUserInputCallback<"rotate">>>;
    private all: Observable<Parameters<RawUserInputCallback<"all">>>;
    private webWorker: Worker;

    constructor(webWorker: Worker){
        this.pan = new AsyncObservable<Parameters<RawUserInputCallback<"pan">>>();
        this.zoom = new AsyncObservable<Parameters<RawUserInputCallback<"zoom">>>();
        this.rotate = new AsyncObservable<Parameters<RawUserInputCallback<"rotate">>>();
        this.all = new AsyncObservable<Parameters<RawUserInputCallback<"all">>>();
        this.webWorker = webWorker;
    }

    notifyPan(diff: Point): void {
        this.webWorker.postMessage({type: "notifyUserInput", payload: {type: "pan", diff: diff}});
        this.pan.notify({diff: diff});
        this.all.notify({type: "pan", diff: diff});
    }

    notifyZoom(deltaZoomAmount: number, anchorPoint: Point): void {
        this.webWorker.postMessage({type: "notifyUserInput", payload: {type: "zoom", deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint}});
        this.zoom.notify({deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
        this.all.notify({type: "zoom", deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint});
    }

    notifyRotate(deltaRotation: number): void {
        this.webWorker.postMessage({type: "notifyUserInput", payload: {type: "rotate", deltaRotation: deltaRotation}});
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
}
