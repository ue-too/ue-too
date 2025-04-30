import { Observable, Observer, SubscriptionOptions } from "src/utils/observable";

export type Position = {
    x: number;
    y: number;
};

export type Velocity = {
    vx: number;
    vy: number;
};

export type DestinationUpdate = Position & {
    type: 'destination';
};

export type DeltaUpdate = Position & {
    type: 'delta';
};

export type PositionUpdate = DestinationUpdate | DeltaUpdate;

export class CameraPositionUpdateBatcher {
    private nextPosition: Position | null = null;
    private delta: Position = { x: 0, y: 0 };
    private observable: Observable<[PositionUpdate]>;
    // Debug counters
    private queuePositionUpdateCount: number = 0;
    private queuePositionUpdateToCount: number = 0;
    private queuePositionUpdateByCount: number = 0;
    private lastUpdateCount: number = 0;
    
    constructor() {
        this.observable = new Observable<[PositionUpdate]>();
    }

    /**
     * Queue an absolute position update to be processed in the next animation frame
     */
    public queuePositionUpdate(x: number, y: number): void {
        this.queuePositionUpdateCount++;
        this.queuePositionUpdateTo({ x, y });
    }

    /**
     * Queue a position update to a specific destination to be processed in the next animation frame
     * This will override any pending delta updates
     */
    public queuePositionUpdateTo(destination: Position): void {
        this.queuePositionUpdateToCount++;
        this.nextPosition = { ...destination };
        this.delta = { x: 0, y: 0 }; // Reset any pending deltas
    }

    /**
     * Queue a position update by delta to be processed in the next animation frame
     * This will be ignored if there's a pending destination update
     */
    public queuePositionUpdateBy(delta: Position): void {
        this.queuePositionUpdateByCount++;
        
        // If we have a pending destination update, add the delta to it
        if (this.nextPosition !== null) {
            this.nextPosition = {
                x: this.nextPosition.x + delta.x,
                y: this.nextPosition.y + delta.y
            };
            return;
        }
        
        this.delta = {
            x: this.delta.x + delta.x,
            y: this.delta.y + delta.y
        };
    }

    /**
     * Process and clear all queued position updates
     * @returns the update to apply to the position, with type information
     */
    public processQueuedUpdates(): PositionUpdate | null {
        this.lastUpdateCount = this.queuePositionUpdateCount + this.queuePositionUpdateToCount + this.queuePositionUpdateByCount;
        // Reset counters after update
        this.queuePositionUpdateCount = 0;
        this.queuePositionUpdateToCount = 0;
        this.queuePositionUpdateByCount = 0;
        
        if (this.nextPosition !== null) {
            const update: DestinationUpdate = {
                ...this.nextPosition,
                type: 'destination'
            };
            this.nextPosition = null;
            this.delta = { x: 0, y: 0 };
            this.observable.notify(update);
            return update;
        } else if (this.delta.x !== 0 || this.delta.y !== 0) {
            const update: DeltaUpdate = {
                ...this.delta,
                type: 'delta'
            };
            this.delta = { x: 0, y: 0 };
            this.observable.notify(update);
            return update;
        }
        
        return null;
    }

    /**
     * Subscribe to position updates
     */
    public subscribe(observer: Observer<[PositionUpdate]>, options?: SubscriptionOptions): () => void {
        return this.observable.subscribe(observer, options);
    }

    /**
     * Get debug information about queue method calls since last update
     */
    public getDebugInfo(): {
        lastUpdateTotalCalls: number;
        queuePositionUpdateCalls: number;
        queuePositionUpdateToCalls: number;
        queuePositionUpdateByCalls: number;
    } {
        return {
            lastUpdateTotalCalls: this.lastUpdateCount,
            queuePositionUpdateCalls: this.queuePositionUpdateCount,
            queuePositionUpdateToCalls: this.queuePositionUpdateToCount,
            queuePositionUpdateByCalls: this.queuePositionUpdateByCount
        };
    }
}
