import { Observable, Observer, SubscriptionOptions } from "src/utils/observable";

export type Rotation = number; // in radians

export type RotationVelocity = number; // in radians per millisecond

export type RotationDestinationUpdate = {
    type: 'destination';
    destination: Rotation;
};

export type RotationDeltaUpdate = {
    type: 'delta';
    delta: Rotation;
};

export type RotationUpdate = RotationDestinationUpdate | RotationDeltaUpdate;

export class CameraRotationUpdateBatcher {
    private nextRotation: Rotation | null = null;
    private delta: Rotation = 0;
    private observable: Observable<[RotationUpdate]>;
    // Debug counters
    private queueRotationUpdateCount: number = 0;
    private queueRotationUpdateToCount: number = 0;
    private queueRotationUpdateByCount: number = 0;
    private lastUpdateCount: number = 0;
    
    constructor() {
        this.observable = new Observable<[RotationUpdate]>();
    }

    /**
     * Queue an absolute rotation update to be processed in the next animation frame
     */
    public queueRotationUpdate(rotation: Rotation): void {
        this.queueRotationUpdateCount++;
        this.queueRotationUpdateTo(rotation);
    }

    /**
     * Queue a rotation update to a specific destination to be processed in the next animation frame
     * This will override any pending delta updates
     */
    public queueRotationUpdateTo(destination: Rotation): void {
        this.queueRotationUpdateToCount++;
        this.nextRotation = destination;
        this.delta = 0; // Reset any pending deltas
    }

    /**
     * Queue a rotation update by delta to be processed in the next animation frame
     * This will be ignored if there's a pending destination update
     */
    public queueRotationUpdateBy(delta: Rotation): void {
        this.queueRotationUpdateByCount++;
        
        // If we have a pending destination update, add the delta to it
        if (this.nextRotation !== null) {
            this.nextRotation = this.nextRotation + delta;
            return;
        }
        
        this.delta = this.delta + delta;
    }

    /**
     * Process and clear all queued rotation updates
     * @returns the update to apply to the rotation, with type information
     */
    public processQueuedUpdates(): RotationUpdate | null {
        this.lastUpdateCount = this.queueRotationUpdateCount + this.queueRotationUpdateToCount + this.queueRotationUpdateByCount;
        // Reset counters after update
        this.queueRotationUpdateCount = 0;
        this.queueRotationUpdateToCount = 0;
        this.queueRotationUpdateByCount = 0;
        
        if (this.nextRotation !== null) {
            const update: RotationDestinationUpdate = {
                destination: this.nextRotation,
                type: 'destination'
            };
            this.nextRotation = null;
            this.delta = 0;
            this.observable.notify(update);
            return update;
        } else if (this.delta !== 0) {
            const update: RotationDeltaUpdate = {
                delta: this.delta,
                type: 'delta'
            };
            this.delta = 0;
            this.observable.notify(update);
            return update;
        }
        
        return null;
    }

    /**
     * Subscribe to rotation updates
     */
    public subscribe(observer: Observer<[RotationUpdate]>, options?: SubscriptionOptions): () => void {
        return this.observable.subscribe(observer, options);
    }

    /**
     * Get debug information about queue method calls since last update
     */
    public getDebugInfo(): {
        lastUpdateTotalCalls: number;
        queueRotationUpdateCalls: number;
        queueRotationUpdateToCalls: number;
        queueRotationUpdateByCalls: number;
    } {
        return {
            lastUpdateTotalCalls: this.lastUpdateCount,
            queueRotationUpdateCalls: this.queueRotationUpdateCount,
            queueRotationUpdateToCalls: this.queueRotationUpdateToCount,
            queueRotationUpdateByCalls: this.queueRotationUpdateByCount
        };
    }
}
