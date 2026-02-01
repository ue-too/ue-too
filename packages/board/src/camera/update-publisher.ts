import { Point } from '@ue-too/math';

import {
    AsyncObservable,
    Observable,
    Observer,
    SubscriptionOptions,
} from '../utils/observable';

/**
 * Payload for camera pan (position change) events.
 *
 * @property diff - The displacement vector from previous to new position
 *
 * @category Camera
 */
export type CameraPanEventPayload = {
    /** Movement delta in world coordinates */
    diff: Point;
};

/**
 * Payload for camera zoom (scale change) events.
 *
 * @property deltaZoomAmount - Change in zoom level (positive = zoom in, negative = zoom out)
 *
 * @category Camera
 */
export type CameraZoomEventPayload = {
    /** Change in zoom level from previous value */
    deltaZoomAmount: number;
};

/**
 * Payload for camera rotation events.
 *
 * @property deltaRotation - Change in rotation angle in radians
 *
 * @category Camera
 */
export type CameraRotateEventPayload = {
    /** Change in rotation from previous value, in radians */
    deltaRotation: number;
};

/**
 * Mapping of camera event names to their payload types.
 * Used for type-safe event subscription.
 *
 * @category Camera
 */
export type CameraEventMap = {
    /** Position change event */
    pan: CameraPanEventPayload;
    /** Zoom level change event */
    zoom: CameraZoomEventPayload;
    /** Rotation change event */
    rotate: CameraRotateEventPayload;
    /** Any camera change event (union of pan, zoom, rotate) */
    all: AllCameraEventPayload;
};

/**
 * Rotation event with discriminated type field for 'all' event handling.
 * Includes type discriminator and rotation payload.
 *
 * @category Camera
 */
export type CameraRotateEvent = {
    /** Event type discriminator */
    type: 'rotate';
} & CameraRotateEventPayload;

/**
 * Pan event with discriminated type field for 'all' event handling.
 * Includes type discriminator and pan payload.
 *
 * @category Camera
 */
export type CameraPanEvent = {
    /** Event type discriminator */
    type: 'pan';
} & CameraPanEventPayload;

/**
 * Zoom event with discriminated type field for 'all' event handling.
 * Includes type discriminator and zoom payload.
 *
 * @category Camera
 */
export type CameraZoomEvent = {
    /** Event type discriminator */
    type: 'zoom';
} & CameraZoomEventPayload;

/**
 * Snapshot of camera state at the time an event occurs.
 * Passed to all event callbacks alongside the event payload.
 *
 * @category Camera
 */
export type CameraState = {
    /** Camera position in world coordinates */
    position: Point;
    /** Current zoom level */
    zoomLevel: number;
    /** Current rotation in radians */
    rotation: number;
};

/**
 * Union type of all camera event payloads with type discriminators.
 * Used for the 'all' event which fires for any camera change.
 *
 * @category Camera
 */
export type AllCameraEventPayload =
    | CameraRotateEvent
    | CameraPanEvent
    | CameraZoomEvent;

/**
 * Generic callback function type for camera events.
 *
 * @typeParam K - The event type key from CameraEventMap
 * @param event - The event payload specific to this event type
 * @param cameraState - Current camera state snapshot at the time of the event
 *
 * @category Camera
 */
export type Callback<K extends keyof CameraEventMap> = (
    event: CameraEventMap[K],
    cameraState: CameraState
) => void;

/**
 * Callback function type specifically for the 'all' camera event.
 * Receives a discriminated union of all camera events.
 *
 * @category Camera
 */
export type ConslidateCallback = (
    payload: AllCameraEventPayload,
    cameraState: CameraState
) => void;

/**
 * Function returned by event subscriptions that unsubscribes the callback when called.
 *
 * @category Camera
 */
export type UnSubscribe = () => void;

/**
 * Callback type for pan (position change) events.
 *
 * @category Camera
 */
export type PanObserver = Callback<'pan'>;

/**
 * Callback type for zoom (scale change) events.
 *
 * @category Camera
 */
export type ZoomObserver = Callback<'zoom'>;

/**
 * Callback type for rotation events.
 *
 * @category Camera
 */
export type RotateObserver = Callback<'rotate'>;

/**
 * Callback type for the 'all' event that fires on any camera change.
 *
 * @category Camera
 */
export type AllObserver = Callback<'all'>;

/**
 * Event publisher for camera state changes using the Observable pattern.
 * Manages subscriptions and notifications for pan, zoom, and rotate events.
 *
 * @remarks
 * This class is used internally by {@link DefaultBoardCamera} to implement the event system.
 * You typically don't instantiate this directly unless building custom camera implementations.
 *
 * Each specific event (pan, zoom, rotate) also triggers the 'all' event, allowing
 * listeners to subscribe to any camera change with a single handler.
 *
 * @example
 * ```typescript
 * const publisher = new CameraUpdatePublisher();
 *
 * // Subscribe to pan events
 * publisher.on('pan', (event, state) => {
 *   console.log('Camera panned:', event.diff);
 * });
 *
 * // Notify subscribers of a pan event
 * publisher.notifyPan(
 *   { diff: { x: 10, y: 20 } },
 *   { position: { x: 100, y: 200 }, zoomLevel: 1, rotation: 0 }
 * );
 * ```
 *
 * @category Camera
 * @see {@link DefaultBoardCamera} for the primary consumer of this class
 */
export class CameraUpdatePublisher {
    private pan: Observable<Parameters<Callback<'pan'>>>;
    private zoom: Observable<Parameters<Callback<'zoom'>>>;
    private rotate: Observable<Parameters<Callback<'rotate'>>>;
    private all: Observable<Parameters<Callback<'all'>>>;

    /**
     * Creates a new camera event publisher with async observables for each event type.
     */
    constructor() {
        this.pan = new AsyncObservable<Parameters<Callback<'pan'>>>();
        this.zoom = new AsyncObservable<Parameters<Callback<'zoom'>>>();
        this.rotate = new AsyncObservable<Parameters<Callback<'rotate'>>>();
        this.all = new AsyncObservable<Parameters<Callback<'all'>>>();
    }

    /**
     * Notifies all pan event subscribers.
     * Also triggers the 'all' event with type discrimination.
     *
     * @param event - Pan event payload containing position delta
     * @param cameraState - Current camera state snapshot
     */
    notifyPan(event: CameraEventMap['pan'], cameraState: CameraState): void {
        this.pan.notify(event, cameraState);
        this.all.notify({ type: 'pan', diff: event.diff }, cameraState);
    }

    /**
     * Notifies all zoom event subscribers.
     * Also triggers the 'all' event with type discrimination.
     *
     * @param event - Zoom event payload containing zoom delta
     * @param cameraState - Current camera state snapshot
     */
    notifyZoom(event: CameraEventMap['zoom'], cameraState: CameraState): void {
        this.zoom.notify(event, cameraState);
        this.all.notify(
            { type: 'zoom', deltaZoomAmount: event.deltaZoomAmount },
            cameraState
        );
    }

    /**
     * Notifies all rotation event subscribers.
     * Also triggers the 'all' event with type discrimination.
     *
     * @param event - Rotation event payload containing rotation delta
     * @param cameraState - Current camera state snapshot
     */
    notifyRotate(
        event: CameraEventMap['rotate'],
        cameraState: CameraState
    ): void {
        this.rotate.notify(event, cameraState);
        this.all.notify(
            { type: 'rotate', deltaRotation: event.deltaRotation },
            cameraState
        );
    }

    /**
     * Subscribes to camera events with type-safe callbacks and optional AbortController support.
     *
     * @typeParam K - The event type key from CameraEventMap
     * @param eventName - Event type to subscribe to ('pan', 'zoom', 'rotate', or 'all')
     * @param callback - Function called when the event occurs
     * @param options - Optional subscription options including AbortController signal
     * @returns Function that unsubscribes this callback when called
     *
     * @throws Error if an invalid event name is provided
     *
     * @remarks
     * Use the AbortController pattern for managing multiple subscriptions:
     *
     * @example
     * ```typescript
     * // Basic subscription
     * const unsubscribe = publisher.on('pan', (event, state) => {
     *   console.log(`Panned by (${event.diff.x}, ${event.diff.y})`);
     * });
     *
     * // Later: unsubscribe
     * unsubscribe();
     *
     * // Using AbortController for batch management
     * const controller = new AbortController();
     * publisher.on('pan', handlePan, { signal: controller.signal });
     * publisher.on('zoom', handleZoom, { signal: controller.signal });
     *
     * // Unsubscribe all at once
     * controller.abort();
     *
     * // Subscribe to all events with type discrimination
     * publisher.on('all', (event, state) => {
     *   switch (event.type) {
     *     case 'pan':
     *       console.log('Pan:', event.diff);
     *       break;
     *     case 'zoom':
     *       console.log('Zoom:', event.deltaZoomAmount);
     *       break;
     *     case 'rotate':
     *       console.log('Rotate:', event.deltaRotation);
     *       break;
     *   }
     * });
     * ```
     */
    on<K extends keyof CameraEventMap>(
        eventName: K,
        callback: (event: CameraEventMap[K], cameraState: CameraState) => void,
        options?: SubscriptionOptions
    ): UnSubscribe {
        switch (eventName) {
            case 'pan':
                return this.pan.subscribe(
                    callback as Observer<Parameters<Callback<'pan'>>>,
                    options
                );
            case 'zoom':
                return this.zoom.subscribe(
                    callback as Observer<Parameters<Callback<'zoom'>>>,
                    options
                );
            case 'rotate':
                return this.rotate.subscribe(
                    callback as Observer<Parameters<Callback<'rotate'>>>,
                    options
                );
            case 'all':
                return this.all.subscribe(
                    callback as Observer<Parameters<Callback<'all'>>>,
                    options
                );
            default:
                throw new Error(`Invalid event name: ${eventName}`);
        }
    }
}
