import { Point } from '@ue-too/math';

import {
    CameraMux,
    CameraMuxPanOutput,
    CameraMuxRotationOutput,
    CameraMuxZoomOutput,
} from './interface';

/**
 * Stateless camera input multiplexer that always allows inputs to pass through.
 * This is the simplest {@link CameraMux} implementation with no filtering or state management.
 *
 * @remarks
 * The Relay class provides a "transparent" mux that:
 * - Never blocks inputs
 * - Passes all inputs unchanged
 * - Has no internal state
 * - Acts as a simple conduit between input sources and camera control
 *
 * Use this when you want:
 * - Direct, unfiltered camera control
 * - No animation system or input blocking
 * - Maximum simplicity with minimal overhead
 *
 * For more advanced use cases (animations, input blocking, state management),
 * implement a custom {@link CameraMux} or use a stateful implementation.
 *
 * @example
 * ```typescript
 * const relay = new Relay();
 *
 * // All inputs pass through unchanged
 * const panResult = relay.notifyPanInput({ x: 10, y: 5 });
 * // panResult = { allowPassThrough: true, delta: { x: 10, y: 5 } }
 *
 * const zoomResult = relay.notifyZoomInput(0.5, { x: 100, y: 200 });
 * // zoomResult = { allowPassThrough: true, delta: 0.5, anchorPoint: { x: 100, y: 200 } }
 *
 * const rotateResult = relay.notifyRotationInput(0.1);
 * // rotateResult = { allowPassThrough: true, delta: 0.1 }
 * ```
 *
 * @category Input Flow Control
 * @see {@link CameraMux} for the interface specification
 * @see {@link createDefaultCameraMux} for a factory function
 */
export class Relay implements CameraMux {
    /**
     * Creates a new stateless relay multiplexer.
     */
    constructor() {}

    /**
     * Processes pan input by always allowing it through unchanged.
     *
     * @param diff - Pan displacement in viewport space
     * @returns Output allowing passthrough with the original delta
     */
    notifyPanInput(diff: Point): CameraMuxPanOutput {
        return { allowPassThrough: true, delta: diff };
    }

    /**
     * Processes zoom input by always allowing it through unchanged.
     *
     * @param deltaZoomAmount - Change in zoom level
     * @param anchorPoint - Point to zoom towards in viewport coordinates
     * @returns Output allowing passthrough with the original parameters
     */
    notifyZoomInput(
        deltaZoomAmount: number,
        anchorPoint: Point
    ): CameraMuxZoomOutput {
        return {
            allowPassThrough: true,
            delta: deltaZoomAmount,
            anchorPoint: anchorPoint,
        };
    }

    /**
     * Processes rotation input by always allowing it through unchanged.
     *
     * @param deltaRotation - Change in rotation in radians
     * @returns Output allowing passthrough with the original delta
     */
    notifyRotationInput(deltaRotation: number): CameraMuxRotationOutput {
        return { allowPassThrough: true, delta: deltaRotation };
    }
}

/**
 * Factory function to create a default camera input multiplexer.
 * Returns a {@link Relay} instance that allows all inputs to pass through.
 *
 * @returns A new stateless relay multiplexer
 *
 * @remarks
 * This is a convenience function for creating the simplest possible camera mux.
 * The returned instance has no state and never blocks inputs.
 *
 * @example
 * ```typescript
 * const cameraMux = createDefaultCameraMux();
 *
 * // Use with camera rig or input handlers
 * const cameraRig = new CameraRig(camera, cameraMux);
 * ```
 *
 * @category Input Flow Control
 * @see {@link Relay} for implementation details
 */
export function createDefaultCameraMux(): CameraMux {
    return new Relay();
}
