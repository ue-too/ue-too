import { Observable, Observer, SubscriptionOptions } from "src/util/observable";
import { Point } from "src/util/misc";

export type ZoomLevel = number;

export type ZoomVelocity = number;

export type ZoomToOperation = {
    destination: ZoomLevel;
    anchor: Point;
};

export type DestinationZoomUpdate = {
    type: 'destination';
    destination: ZoomLevel;
    anchor?: Point;
};

export type ZoomUpdate = DestinationZoomUpdate;

export function combineZoomToOperations(
    op1: ZoomToOperation,
    op2: ZoomToOperation,
    initialZoom: number,
    rotation: number
): ZoomToOperation {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    // Calculate intermediate and final zoom levels
    const zoom1 = initialZoom;
    const zoom2 = op1.destination;
    const zoom3 = op2.destination;
    
    // Calculate position deltas for first operation
    const positionDeltaX1 = cos * (op1.anchor.x/zoom1 - op1.anchor.x/zoom2) + 
                          sin * (op1.anchor.y/zoom2 - op1.anchor.y/zoom1);
    const positionDeltaY1 = cos * (op1.anchor.y/zoom1 - op1.anchor.y/zoom2) + 
                          sin * (op1.anchor.x/zoom1 - op1.anchor.x/zoom2);
    
    // Calculate position deltas for second operation
    const positionDeltaX2 = cos * (op2.anchor.x/zoom2 - op2.anchor.x/zoom3) + 
                          sin * (op2.anchor.y/zoom3 - op2.anchor.y/zoom2);
    const positionDeltaY2 = cos * (op2.anchor.y/zoom2 - op2.anchor.y/zoom3) + 
                          sin * (op2.anchor.x/zoom2 - op2.anchor.x/zoom3);
    
    // Calculate total position deltas
    const totalPositionDeltaX = positionDeltaX1 + positionDeltaX2;
    const totalPositionDeltaY = positionDeltaY1 + positionDeltaY2;
    
    // Calculate effective anchor point
    const zoomDiff = (1/initialZoom - 1/zoom3);
    const effectiveAnchorX = totalPositionDeltaX / (cos * zoomDiff);
    const effectiveAnchorY = totalPositionDeltaY / (cos * zoomDiff);
    
    return {
        destination: op2.destination,
        anchor: {
            x: effectiveAnchorX,
            y: effectiveAnchorY
        }
    };
}

export class CameraZoomUpdateBatcher {
    private nextZoom: ZoomLevel | null = null;
    private velocity: ZoomVelocity = 0;
    private lastUpdateTime: number | null = null;
    private observable: Observable<[ZoomUpdate]>;
    private anchor: Point | null = null;
    // Debug counters
    private queueZoomUpdateCount: number = 0;
    private queueZoomUpdateToCount: number = 0;
    private lastUpdateCount: number = 0;
    
    constructor() {
        this.observable = new Observable<[ZoomUpdate]>();
    }

    /**
     * Queue an absolute zoom update to be processed in the next animation frame
     */
    public queueZoomUpdate(zoom: ZoomLevel, anchor?: Point, currentZoom?: number, currentRotation?: number): void {
        this.queueZoomUpdateCount++;
        this.queueZoomUpdateTo(zoom, anchor, currentZoom, currentRotation);
    }

    /**
     * Queue a zoom update to a specific destination to be processed in the next animation frame
     */
    public queueZoomUpdateTo(destination: ZoomLevel, anchor?: Point, currentZoom?: number, currentRotation?: number): void {
        this.queueZoomUpdateToCount++;
        const now = performance.now();
        
        // Update velocity if we have previous zoom levels
        if (this.lastUpdateTime !== null && this.nextZoom !== null) {
            const dt = Math.max(1, now - this.lastUpdateTime);
            this.velocity = (destination - this.nextZoom) / dt;
        }
        
        this.lastUpdateTime = now;

        // If we have a pending destination update and an anchor point, combine the operations
        if (this.nextZoom !== null && this.anchor !== null && anchor !== undefined && currentZoom !== undefined && currentRotation !== undefined) {
            const currentOp: ZoomToOperation = {
                destination: this.nextZoom,
                anchor: this.anchor
            };
            const newOp: ZoomToOperation = {
                destination: destination,
                anchor: anchor
            };
            const combinedOp = combineZoomToOperations(currentOp, newOp, currentZoom, currentRotation);
            this.nextZoom = combinedOp.destination;
            this.anchor = combinedOp.anchor;
        } else {
            this.nextZoom = destination;
            this.anchor = anchor || null;
        }
    }

    /**
     * Queue a zoom update by delta to be processed in the next animation frame
     */
    public queueZoomUpdateBy(delta: ZoomLevel, anchor?: Point, currentZoom?: number, currentRotation?: number): void {
        if (this.nextZoom !== null) {
            this.queueZoomUpdateTo(this.nextZoom + delta, anchor, currentZoom, currentRotation);
        } else if (currentZoom !== undefined) {
            this.queueZoomUpdateTo(currentZoom + delta, anchor, currentZoom, currentRotation);
        }
    }

    /**
     * Queue a zoom update by delta at a world anchor to be processed in the next animation frame
     */
    public queueZoomByAtWorld(delta: ZoomLevel, worldAnchor: Point, currentZoom: number, currentRotation: number): void {
        // Calculate the new zoom level
        const newZoom = currentZoom + delta;
        
        // Calculate the effective anchor point in viewport coordinates
        // that would produce the same camera position delta as the world-space zoom
        const cos = Math.cos(currentRotation);
        const sin = Math.sin(currentRotation);
        
        // Calculate the camera position delta components
        const deltaX = -(worldAnchor.x * cos + worldAnchor.y * sin) * (delta / newZoom);
        const deltaY = -(worldAnchor.y * cos - worldAnchor.x * sin) * (delta / newZoom);
        
        // Calculate the effective anchor point in viewport coordinates
        const zoomDiff = (1/currentZoom - 1/newZoom);
        const effectiveAnchorX = deltaX / (cos * zoomDiff);
        const effectiveAnchorY = deltaY / (cos * zoomDiff);
        
        // Queue the zoom update with the effective anchor point
        this.queueZoomUpdateTo(newZoom, { x: effectiveAnchorX, y: effectiveAnchorY }, currentZoom, currentRotation);
    }

    /**
     * Process and clear all queued zoom updates
     * @returns the update to apply to the zoom level, with type information
     */
    public processQueuedUpdates(): ZoomUpdate | null {
        this.lastUpdateCount = this.queueZoomUpdateCount + this.queueZoomUpdateToCount;
        // Reset counters after update
        this.queueZoomUpdateCount = 0;
        this.queueZoomUpdateToCount = 0;
        
        if (this.nextZoom !== null) {
            const update: DestinationZoomUpdate = {
                destination: this.nextZoom,
                type: 'destination',
                anchor: this.anchor || undefined
            };
            this.nextZoom = null;
            this.anchor = null;
            this.observable.notify(update);
            return update;
        }
        
        return null;
    }
    
    /**
     * Get the current zoom velocity
     */
    public getVelocity(): ZoomVelocity {
        return this.velocity;
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

// Example usage
// ------------------------------------------------------------

// Create zoom manager
// const cameraZoom = new CameraZoomUpdateBatcher();

// Add event listeners
// function handleWheel(event: WheelEvent) {
//     // Example: zoom in/out based on wheel delta
//     const zoomDelta = -event.deltaY * 0.001;
//     cameraZoom.queueZoomUpdateBy(zoomDelta);
// }

// Attach to DOM events
// document.addEventListener('wheel', handleWheel);

// Add update listener to respond to zoom changes
// cameraZoom.subscribe(update => {
//     // Update camera zoom
//     if (update.type === 'destination') {
//         // Set absolute zoom level
//         camera.setZoom(update.zoom);
//     } else {
//         // Apply zoom delta
//         camera.zoomBy(update.zoom);
//     }
// });

// In your animation loop
// function animationLoop() {
//     // Update zoom
//     cameraZoom.update();
    
//     // Continue animation loop
//     requestAnimationFrame(animationLoop);
// }

// Start animation loop
// requestAnimationFrame(animationLoop); 
