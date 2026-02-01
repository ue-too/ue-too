import type { Point } from '@ue-too/math';

/**
 * Discriminated union type for pan input results.
 * Indicates whether camera panning is allowed and provides the delta if accepted.
 *
 * @remarks
 * This type uses discriminated unions for type-safe flow control:
 * - When `allowPassThrough` is `true`, the `delta` property is available
 * - When `allowPassThrough` is `false`, no delta is provided
 *
 * Use this to implement input gating, animation systems, or input arbitration.
 *
 * @example
 * ```typescript
 * const output = cameraMux.notifyPanInput({ x: 10, y: 5 });
 * if (output.allowPassThrough) {
 *   // TypeScript knows output.delta exists here
 *   camera.setPosition(
 *     PointCal.addVector(camera.position, output.delta)
 *   );
 * } else {
 *   // Input was blocked (e.g., during animation)
 *   console.log('Pan input blocked');
 * }
 * ```
 *
 * @category Input Flow Control
 */
export type CameraMuxPanOutput =
    | { allowPassThrough: true; delta: Point }
    | { allowPassThrough: false };

/**
 * Discriminated union type for zoom input results.
 * Indicates whether camera zooming is allowed and provides zoom parameters if accepted.
 *
 * @remarks
 * This type uses discriminated unions for type-safe flow control:
 * - When `allowPassThrough` is `true`, both `delta` and `anchorPoint` are available
 * - When `allowPassThrough` is `false`, zoom is blocked
 *
 * The `anchorPoint` ensures zoom focuses on a specific viewport location (e.g., cursor position).
 *
 * @example
 * ```typescript
 * const output = cameraMux.notifyZoomInput(0.1, mousePosition);
 * if (output.allowPassThrough) {
 *   // Calculate new camera position to keep anchor point stationary
 *   const newZoom = camera.zoomLevel + output.delta;
 *   const newPosition = cameraPositionToGet(
 *     worldAtAnchor,
 *     output.anchorPoint,
 *     newZoom,
 *     camera.rotation
 *   );
 *   camera.setZoomLevel(newZoom);
 *   camera.setPosition(newPosition);
 * }
 * ```
 *
 * @category Input Flow Control
 */
export type CameraMuxZoomOutput =
    | { allowPassThrough: true; delta: number; anchorPoint: Point }
    | { allowPassThrough: false };

/**
 * Discriminated union type for rotation input results.
 * Indicates whether camera rotation is allowed and provides the delta if accepted.
 *
 * @remarks
 * This type uses discriminated unions for type-safe flow control:
 * - When `allowPassThrough` is `true`, the `delta` property is available
 * - When `allowPassThrough` is `false`, rotation is blocked
 *
 * @example
 * ```typescript
 * const output = cameraMux.notifyRotationInput(0.1); // 0.1 radians
 * if (output.allowPassThrough) {
 *   camera.setRotation(camera.rotation + output.delta);
 * }
 * ```
 *
 * @category Input Flow Control
 */
export type CameraMuxRotationOutput =
    | { allowPassThrough: true; delta: number }
    | { allowPassThrough: false };

/**
 * Input multiplexer interface for camera control flow management.
 * Acts as a gatekeeper that can allow or block camera inputs based on state.
 *
 * @remarks
 * The CameraMux pattern enables:
 * - **Input arbitration**: Decide which inputs should affect the camera
 * - **Animation systems**: Block user input during camera animations
 * - **State management**: Control camera behavior based on application state
 * - **Input filtering**: Modify or clamp inputs before applying to camera
 *
 * Implementations can be:
 * - **Stateless**: Always pass through (e.g., {@link Relay})
 * - **Stateful**: Block inputs during animations or specific states
 * - **Smart**: Modify inputs based on context (e.g., smooth damping)
 *
 * @example
 * ```typescript
 * // Simple relay implementation
 * class SimpleMux implements CameraMux {
 *   notifyPanInput(diff: Point): CameraMuxPanOutput {
 *     return { allowPassThrough: true, delta: diff };
 *   }
 *   notifyZoomInput(delta: number, anchor: Point): CameraMuxZoomOutput {
 *     return { allowPassThrough: true, delta, anchorPoint: anchor };
 *   }
 *   notifyRotationInput(delta: number): CameraMuxRotationOutput {
 *     return { allowPassThrough: true, delta };
 *   }
 * }
 *
 * // Animation-blocking implementation
 * class AnimatedMux implements CameraMux {
 *   private isAnimating = false;
 *
 *   notifyPanInput(diff: Point): CameraMuxPanOutput {
 *     if (this.isAnimating) {
 *       return { allowPassThrough: false };
 *     }
 *     return { allowPassThrough: true, delta: diff };
 *   }
 *   // ... similar for zoom and rotation
 * }
 * ```
 *
 * @category Input Flow Control
 * @see {@link Relay} for a simple passthrough implementation
 */
export interface CameraMux {
    /**
     * Processes a pan input request.
     *
     * @param diff - Pan displacement in viewport space (CSS pixels)
     * @returns Output indicating if pan is allowed and the delta to apply
     */
    notifyPanInput(diff: Point): CameraMuxPanOutput;

    /**
     * Processes a zoom input request.
     *
     * @param deltaZoomAmount - Change in zoom level (positive = zoom in, negative = zoom out)
     * @param anchorPoint - Point to zoom towards in viewport coordinates (typically cursor position)
     * @returns Output indicating if zoom is allowed and the parameters to apply
     */
    notifyZoomInput(
        deltaZoomAmount: number,
        anchorPoint: Point
    ): CameraMuxZoomOutput;

    /**
     * Processes a rotation input request.
     *
     * @param deltaRotation - Change in rotation in radians
     * @returns Output indicating if rotation is allowed and the delta to apply
     */
    notifyRotationInput(deltaRotation: number): CameraMuxRotationOutput;
}
