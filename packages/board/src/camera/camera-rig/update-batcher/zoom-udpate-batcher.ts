import { AsyncObservable, Observable, Observer, SubscriptionOptions } from "../../../utils/observable";
import { Point } from "@ue-too/math";

export type DestinationZoomUpdate = {
    type: 'destination';
    destination: number;
    anchor?: Point;
};

export type DeltaZoomUpdate = {
    type: 'delta';
    delta: number;
    anchor?: Point;
}

export type ZoomUpdate = {
    anchorCoordinateSystem: 'world' | 'viewport';
    update: DestinationZoomUpdate | DeltaZoomUpdate;
}

export class CameraZoomUpdateBatcher {
    private nextZoom: number | null = null;
    private observable: Observable<[ZoomUpdate]>;
    private anchor: Point | null = null;
    private delta: number = 0;
    private anchorCoordinateSystem: 'world' | 'viewport' = 'viewport';
    // Debug counters
    private queueZoomUpdateCount: number = 0;
    private queueZoomUpdateToCount: number = 0;
    private lastUpdateCount: number = 0;
    
    constructor() {
        this.observable = new AsyncObservable<[ZoomUpdate]>();
    }

    /**
     * Queue a zoom update to a specific destination to be processed in the next animation frame
     */
    public queueZoomUpdateTo(destination: number, anchor?: Point): void {
        if(this.anchorCoordinateSystem === 'world'){
            this.anchorCoordinateSystem = 'viewport';
            this.nextZoom = null;
            this.delta = 0;
        }
        this.anchor = anchor ?? null;
        this.nextZoom = destination;
        if(this.delta !== 0){
            this.delta = 0;
        }
    }

    /**
     * Queue a zoom update by delta to be processed in the next animation frame
     */
    public queueZoomUpdateBy(delta: number, anchor?: Point): void {
        if(this.anchorCoordinateSystem === 'world'){
            this.anchorCoordinateSystem = 'viewport';
            this.nextZoom = null;
            this.delta = 0;
        }
        if (this.nextZoom === null) {
            this.delta += delta;
        } else {
            this.nextZoom += delta;
        }
        this.anchor = anchor ?? null;
    }

    /**
     * Queue a zoom update by delta at a world anchor to be processed in the next animation frame
     */
    public queueZoomByAtWorld(delta: number, worldAnchor: Point): void {
        if(this.anchorCoordinateSystem === 'viewport'){
            this.anchorCoordinateSystem = 'world';
            this.nextZoom = null;
            this.delta = 0;
        }
        this.anchor = worldAnchor;
        if (this.nextZoom === null) {
            this.delta += delta;
        } else {
            this.nextZoom += delta;
        }
    }

    /**
     * Queue a zoom update to a specific destination at a world anchor to be processed in the next animation frame
     */
    public queueZoomToAtWorld(destination: number, worldAnchor: Point): void {
        if(this.anchorCoordinateSystem === 'viewport'){
            this.anchorCoordinateSystem = 'world';
            this.nextZoom = null;
            this.delta = 0;
        }
        this.anchor = worldAnchor;
        this.nextZoom = destination;
        if(this.delta !== 0){
            this.delta = 0;
        }
    }

    /**
     * Process and clear all queued zoom updates
     * @returns the update to apply to the zoom level, with type information
     */
    public processQueuedUpdates(): ZoomUpdate | null {
        if(this.nextZoom === null && this.delta === 0){
            return null;
        }
        const delta = this.delta;
        const nextZoom = this.nextZoom;
        const anchor = this.anchor;
        this.delta = 0;
        this.nextZoom = null;
        this.anchor = null;
        if(delta !== 0){
            return {
                anchorCoordinateSystem: this.anchorCoordinateSystem,
                update: {
                    type: 'delta',
                    delta: delta,
                    anchor: anchor ?? undefined,
                }
            }
        }
        return {
            anchorCoordinateSystem: this.anchorCoordinateSystem,
            update: {
                type: 'destination',
                destination: nextZoom ?? 0,
                anchor: anchor ?? undefined,
            }
        }
    }

    /**
     * Subscribe to zoom updates
     */
    public subscribe(observer: Observer<[ZoomUpdate]>, options?: SubscriptionOptions): () => void {
        return this.observable.subscribe(observer, options);
    }

    /**
     * Get debug information about queue method calls since last update
     */
    public getDebugInfo(): {
        lastUpdateTotalCalls: number;
        queueZoomUpdateCalls: number;
        queueZoomUpdateToCalls: number;
    } {
        return {
            lastUpdateTotalCalls: this.lastUpdateCount,
            queueZoomUpdateCalls: this.queueZoomUpdateCount,
            queueZoomUpdateToCalls: this.queueZoomUpdateToCount
        };
    }
}
