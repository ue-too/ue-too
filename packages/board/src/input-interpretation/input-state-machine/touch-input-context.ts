import { BaseContext } from '@ue-too/being';

import { Canvas } from './kmt-input-context';

/**
 * Represents a single touch point in window coordinates.
 *
 * @property ident - The unique identifier for this touch point (from TouchEvent.identifier)
 * @property x - X coordinate in window space
 * @property y - Y coordinate in window space
 *
 * @remarks
 * Touch points are tracked by their identifiers to maintain consistency across touch events.
 * Each finger/contact point maintains its identifier for the duration of the touch interaction.
 *
 * @category Input State Machine - Touch
 */
export type TouchPoints = {
    ident: number;
    x: number;
    y: number;
};

/**
 * Context interface for the touch input state machine.
 *
 * @remarks
 * This context manages the state required for multi-touch gesture recognition:
 *
 * **Touch Point Tracking**:
 * - Maintains a map of active touch points by identifier
 * - Stores initial positions to calculate deltas for pan gestures
 * - Stores initial distances to calculate zoom factors
 *
 * **Gesture Recognition**:
 * - Single-finger: Not handled (reserved for UI interactions)
 * - Two-finger: Pan and pinch-to-zoom gestures
 * - Three+ fingers: Currently not handled
 *
 * **Coordinate System**:
 * Similar to KMT, the `alignCoordinateSystem` flag controls Y-axis orientation.
 *
 * This interface extends BaseContext from the @ue-too/being state machine library.
 *
 * @category Input State Machine - Touch
 */
export interface TouchContext extends BaseContext {
    /** Adds new touch points to tracking */
    addTouchPoints: (points: TouchPoints[]) => void;
    /** Removes touch points from tracking by identifier */
    removeTouchPoints: (idents: number[]) => void;
    /** Returns the current number of active touch points */
    getCurrentTouchPointsCount: () => number;
    /** Retrieves the initial positions of specific touch points */
    getInitialTouchPointsPositions: (idents: number[]) => TouchPoints[];
    /** Updates the current positions of touch points */
    updateTouchPoints: (pointsMoved: TouchPoints[]) => void;
    /** Whether to use standard screen coordinate system (vs inverted Y-axis) */
    alignCoordinateSystem: boolean;
    /** Canvas accessor for dimensions and coordinate transformations */
    canvas: Canvas;
}

/**
 * Production implementation of TouchContext that tracks multi-touch state.
 *
 * @remarks
 * This class maintains a map of active touch points, storing their initial positions
 * to enable gesture recognition. The state machine uses this context to:
 *
 * - Calculate pan deltas (difference between initial and current midpoint)
 * - Calculate zoom factors (change in distance between two touch points)
 * - Determine gesture type (pan vs zoom based on relative magnitudes)
 *
 * **Touch Point Lifecycle**:
 * 1. `addTouchPoints`: Called on touchstart to register new touches
 * 2. `updateTouchPoints`: Called on touchmove to update current positions
 * 3. `removeTouchPoints`: Called on touchend/touchcancel to unregister touches
 *
 * The initial positions are preserved until the touch ends, allowing continuous
 * calculation of deltas throughout the gesture.
 *
 * @category Input State Machine - Touch
 *
 * @example
 * ```typescript
 * const canvasProxy = new CanvasProxy(canvasElement);
 * const context = new TouchInputTracker(canvasProxy);
 * const stateMachine = createTouchInputStateMachine(context);
 *
 * // When a two-finger touch starts
 * context.addTouchPoints([
 *   {ident: 0, x: 100, y: 200},
 *   {ident: 1, x: 300, y: 200}
 * ]);
 * console.log(context.getCurrentTouchPointsCount()); // 2
 * ```
 */
export class TouchInputTracker implements TouchContext {
    private _touchPointsMap: Map<number, TouchPoints> = new Map<
        number,
        TouchPoints
    >();
    private _canvas: Canvas;
    private _alignCoordinateSystem: boolean;

    constructor(canvas: Canvas) {
        this._canvas = canvas;
        this._alignCoordinateSystem = true;
    }

    addTouchPoints(points: TouchPoints[]): void {
        points.forEach(point => {
            this._touchPointsMap.set(point.ident, { ...point });
        });
    }

    removeTouchPoints(identifiers: number[]): void {
        identifiers.forEach(ident => {
            if (this._touchPointsMap.has(ident)) {
                this._touchPointsMap.delete(ident);
            }
        });
    }

    getCurrentTouchPointsCount(): number {
        return this._touchPointsMap.size;
    }

    getInitialTouchPointsPositions(idents: number[]): TouchPoints[] {
        const res: TouchPoints[] = [];
        idents.forEach(ident => {
            if (this._touchPointsMap.has(ident)) {
                const point = this._touchPointsMap.get(ident);
                if (point) {
                    res.push(point);
                }
            }
        });
        return res;
    }

    updateTouchPoints(pointsMoved: TouchPoints[]): void {
        pointsMoved.forEach(point => {
            if (this._touchPointsMap.has(point.ident)) {
                this._touchPointsMap.set(point.ident, { ...point });
            }
        });
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean) {
        this._alignCoordinateSystem = value;
    }

    get canvas(): Canvas {
        return this._canvas;
    }

    cleanup(): void {}

    setup(): void {}
}
