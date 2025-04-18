import { Observable, Observer, SubscriptionOptions } from "src/util/observable";

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
    private velocity: Velocity = { vx: 0, vy: 0 };
    private lastUpdateTime: number | null = null;
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
        const now = performance.now();
        
        // Update velocity if we have previous positions
        if (this.lastUpdateTime !== null) {
            const dt = Math.max(1, now - this.lastUpdateTime);
            
            // Calculate instantaneous velocity
            if (this.nextPosition) {
                this.velocity = {
                    vx: (destination.x - this.nextPosition.x) / dt,
                    vy: (destination.y - this.nextPosition.y) / dt
                };
            } else {
                // If we have a delta, use it to calculate velocity
                this.velocity = {
                    vx: (destination.x - this.delta.x) / dt,
                    vy: (destination.y - this.delta.y) / dt
                };
            }
        }
        
        this.lastUpdateTime = now;
        this.nextPosition = { ...destination };
        this.delta = { x: 0, y: 0 }; // Reset any pending deltas
    }

    /**
     * Queue a position update by delta to be processed in the next animation frame
     * This will be ignored if there's a pending destination update
     */
    public queuePositionUpdateBy(delta: Position): void {
        this.queuePositionUpdateByCount++;
        const now = performance.now();
        
        // If we have a pending destination update, add the delta to it
        if (this.nextPosition !== null) {
            this.nextPosition = {
                x: this.nextPosition.x + delta.x,
                y: this.nextPosition.y + delta.y
            };
            return;
        }
        
        // Update velocity if we have previous positions
        if (this.lastUpdateTime !== null) {
            const dt = Math.max(1, now - this.lastUpdateTime);
            
            // Calculate instantaneous velocity
            this.velocity = {
                vx: delta.x / dt,
                vy: delta.y / dt
            };
        }
        
        this.lastUpdateTime = now;
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
     * Get the current velocity vector
     */
    public getVelocity(): Velocity {
        return { ...this.velocity };
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

// Example usage
// ------------------------------------------------------------

// Create position manager
// const objectPosition = new CameraPositionUpdateBatcher({
//     initialPosition: { x: 100, y: 100 }
// });

// Add event listeners
// function handlePointerMove(event: PointerEvent) {
//     objectPosition.queuePositionUpdate(event.clientX, event.clientY);
// }

// Attach to DOM events
// document.addEventListener('pointermove', handlePointerMove);

// Add update listener to respond to position changes
// objectPosition.addUpdateListener(position => {
//     // Update UI element position
//     const element = document.getElementById('movable-element');
//     if (element) {
//         element.style.transform = `translate(${position.x}px, ${position.y}px)`;
//     }
// });

// In your animation loop
// function animationLoop() {
//     // Update position
//     objectPosition.update();
    
//     // Continue animation loop
//     requestAnimationFrame(animationLoop);
// }

// Start animation loop
// requestAnimationFrame(animationLoop);
