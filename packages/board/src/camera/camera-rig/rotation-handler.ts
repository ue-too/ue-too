import { BoardCamera } from "../interface";
import { createHandlerChain } from "../../utils/handler-pipeline";
import { normalizeAngleZero2TwoPI, angleSpan, clampRotation } from "../utils/rotation";

/**
 * Combined configuration for rotation handler behavior, merging restriction and clamping settings.
 *
 * @remarks
 * This type combines {@link RotationHandlerRestrictConfig} and {@link RotationHandlerClampConfig}
 * to provide complete control over camera rotation behavior.
 *
 * Rotation handlers use this configuration to:
 * - Completely disable rotation operations (restriction)
 * - Clamp rotation angle to stay within defined angular limits
 *
 * @category Camera Rig
 * @see {@link RotationHandlerRestrictConfig} for rotation locking options
 * @see {@link RotationHandlerClampConfig} for angular boundary options
 */
export type RotationHandlerConfig = RotationHandlerRestrictConfig & RotationHandlerClampConfig;

/**
 * Configuration for completely disabling rotation operations.
 *
 * @remarks
 * Provides a global "rotation lock" to prevent any rotation changes.
 *
 * When `restrictRotation` is true:
 * - Rotate-to operations return current rotation (no change)
 * - Rotate-by operations return zero delta (no change)
 *
 * This is useful for:
 * - Locking rotation during specific application states
 * - Fixed-orientation viewing modes (north-up maps, etc.)
 * - Preventing user rotation in certain contexts
 *
 * @example
 * ```typescript
 * const config: RotationHandlerRestrictConfig = {
 *   restrictRotation: true  // Lock rotation
 * };
 *
 * // Any rotation attempt will be ignored
 * ```
 *
 * @category Camera Rig
 */
export type RotationHandlerRestrictConfig = {
    /**
     * Whether to completely prevent rotation operations.
     */
    restrictRotation: boolean;
}

/**
 * Configuration for rotation angle boundary clamping.
 *
 * @remarks
 * Controls whether rotation operations should be constrained to camera's rotation boundaries.
 *
 * When `clampRotation` is true, rotation handlers enforce {@link BoardCamera.rotationBoundaries}
 * limits (min/max angles in radians). When false, rotation can exceed configured boundaries.
 *
 * Rotation boundaries allow limiting camera rotation to a specific angular range,
 * useful for scenarios like:
 * - Restricting rotation to ±45 degrees from north
 * - Allowing only certain cardinal directions
 * - Preventing full 360-degree rotation
 *
 * @example
 * ```typescript
 * const config: RotationHandlerClampConfig = {
 *   clampRotation: true  // Enforce rotation boundaries
 * };
 *
 * camera.rotationBoundaries = { min: 0, max: Math.PI / 2 };
 * // Rotation clamped to [0, 90 degrees] range
 * ```
 *
 * @category Camera Rig
 */
export type RotationHandlerClampConfig = {
    /**
     * Whether to enforce rotation angle boundaries.
     */
    clampRotation: boolean;
}

/**
 * Handler function type for relative "rotate by" camera operations.
 *
 * @param delta - Rotation angle change in radians (positive = counter-clockwise)
 * @param camera - Current camera instance
 * @param config - Rotation behavior configuration
 * @returns Transformed rotation delta (after applying restrictions and clamping)
 *
 * @remarks
 * Rotate-by handlers process relative rotation change requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations to the delta.
 *
 * Handler pipeline pattern:
 * - Each handler receives the rotation delta, camera state, and config
 * - Returns a potentially modified delta
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Angular boundary clamping (prevent exceeding min/max angles)
 * - Rotation locking (return zero delta)
 * - Delta dampening or snapping
 *
 * Rotation angles are in radians where:
 * - 0 = North (no rotation)
 * - Positive values = Counter-clockwise rotation
 * - Negative values = Clockwise rotation
 *
 * @example
 * ```typescript
 * const myRotateByHandler: RotateByHandlerFunction = (delta, camera, config) => {
 *   // Custom logic: snap to 45-degree increments
 *   const totalRotation = camera.rotation + delta;
 *   const snapped = Math.round(totalRotation / (Math.PI / 4)) * (Math.PI / 4);
 *   return snapped - camera.rotation;
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultRotateByHandler} for the default implementation
 */
export type RotateByHandlerFunction = (delta: number, camera: BoardCamera, config: RotationHandlerConfig) => number;

/**
 * Handler function type for absolute "rotate to" camera operations.
 *
 * @param targetRotation - Target rotation angle in radians
 * @param camera - Current camera instance
 * @param config - Rotation behavior configuration
 * @returns Transformed rotation angle (after applying restrictions and clamping)
 *
 * @remarks
 * Rotate-to handlers process absolute rotation angle requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations.
 *
 * Handler pipeline pattern:
 * - Each handler receives the target angle, camera state, and config
 * - Returns a potentially modified angle
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Angular boundary clamping (enforce min/max angles)
 * - Rotation locking (return current angle)
 * - Angle snapping or normalization
 *
 * Rotation angles are in radians where:
 * - 0 = North (no rotation)
 * - π/2 = West (90° counter-clockwise)
 * - π = South (180°)
 * - 3π/2 = East (270° counter-clockwise)
 *
 * @example
 * ```typescript
 * const myRotateToHandler: RotateToHandlerFunction = (target, camera, config) => {
 *   // Custom logic: snap to cardinal directions
 *   const cardinals = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
 *   return cardinals.reduce((prev, curr) =>
 *     Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
 *   );
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultRotateToHandler} for the default implementation
 */
export type RotateToHandlerFunction = (targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig) => number;

/**
 * Handler pipeline step that clamps "rotate by" deltas to prevent angular boundary violations.
 *
 * @param delta - Rotation angle change in radians
 * @param camera - Current camera instance (provides current rotation and boundaries)
 * @param config - Clamping configuration
 * @returns Adjusted delta that respects rotation boundaries
 *
 * @remarks
 * This handler ensures that applying the delta won't exceed rotation boundaries.
 *
 * Algorithm:
 * 1. Calculate potential new rotation (current + delta)
 * 2. Normalize angle to [0, 2π) range
 * 3. Clamp to rotation boundaries
 * 4. Calculate shortest angular distance from current to clamped angle
 * 5. Return that distance as the new delta
 *
 * Behavior:
 * - If `clampRotation` is false: Returns delta unchanged
 * - If `clampRotation` is true: Adjusts delta to stay within boundaries
 *
 * The resulting delta may be zero if already at a boundary and trying to rotate further.
 *
 * @example
 * ```typescript
 * camera.rotation = Math.PI * 0.4;  // 72 degrees
 * camera.rotationBoundaries = { max: Math.PI / 2 };  // Max 90 degrees
 *
 * const config: RotationHandlerClampConfig = {
 *   clampRotation: true
 * };
 *
 * const delta = Math.PI * 0.2;  // Try to rotate 36 degrees (would exceed max)
 * const clamped = clampRotateByHandler(delta, camera, config);
 * // clamped ≈ 0.314 radians (18 degrees - only rotate to boundary)
 * ```
 *
 * @category Camera Rig
 * @see {@link normalizeAngleZero2TwoPI} for angle normalization
 * @see {@link clampRotation} for boundary clamping
 * @see {@link angleSpan} for calculating angular distance
 */
export function clampRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerClampConfig): number {
    if(!config.clampRotation){
        return delta;
    }
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

/**
 * Handler pipeline step that prevents "rotate by" operations when rotation is locked.
 *
 * @param delta - Rotation angle change in radians
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Zero (if locked) or delta (if unlocked)
 *
 * @remarks
 * This handler implements a global rotation lock for relative rotation operations.
 *
 * Behavior:
 * - If `restrictRotation` is true: Returns 0 (prevents any change)
 * - If `restrictRotation` is false: Returns delta unchanged
 *
 * @example
 * ```typescript
 * const config: RotationHandlerRestrictConfig = {
 *   restrictRotation: true  // Lock rotation
 * };
 *
 * const delta = Math.PI / 4;  // Try to rotate 45 degrees
 * const result = restrictRotateByHandler(delta, camera, config);
 * // result = 0 (rotation locked, no change allowed)
 * ```
 *
 * @category Camera Rig
 * @see {@link createDefaultRotateByHandler} for default pipeline usage
 */
export function restrictRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerRestrictConfig): number {
    if(config.restrictRotation){
        return 0;
    }
    return delta;
}

/**
 * Handler pipeline step that clamps "rotate to" targets to camera rotation boundaries.
 *
 * @param targetRotation - Target rotation angle in radians
 * @param camera - Current camera instance (provides rotationBoundaries)
 * @param config - Clamping configuration
 * @returns Clamped rotation angle
 *
 * @remarks
 * This handler enforces angular limits on absolute rotation requests.
 *
 * Behavior:
 * - If `clampRotation` is false: Returns target unchanged
 * - If `clampRotation` is true: Clamps target to {@link BoardCamera.rotationBoundaries}
 *
 * The clamping handles:
 * - Missing boundaries (undefined min/max)
 * - One-sided constraints (only min or only max)
 * - Full range constraints
 *
 * @example
 * ```typescript
 * camera.rotationBoundaries = { min: 0, max: Math.PI };  // [0°, 180°]
 *
 * const config: RotationHandlerClampConfig = {
 *   clampRotation: true
 * };
 *
 * const target = Math.PI * 1.5;  // 270 degrees (exceeds max)
 * const clamped = clampRotateToHandler(target, camera, config);
 * // clamped = π (180 degrees - clamped to max boundary)
 * ```
 *
 * @category Camera Rig
 * @see {@link clampRotation} for clamping implementation
 * @see {@link createDefaultRotateToHandler} for default pipeline usage
 */
export function clampRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerClampConfig): number {
    if(!config.clampRotation){
        return targetRotation;
    }
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    return clampedRotation;
}

/**
 * Handler pipeline step that prevents "rotate to" operations when rotation is locked.
 *
 * @param targetRotation - Target rotation angle in radians
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Current rotation (if locked) or target (if unlocked)
 *
 * @remarks
 * This handler implements a global rotation lock for absolute rotation operations.
 *
 * Behavior:
 * - If `restrictRotation` is true: Returns current rotation (prevents any change)
 * - If `restrictRotation` is false: Returns target unchanged
 *
 * @example
 * ```typescript
 * camera.rotation = Math.PI / 2;  // Currently at 90 degrees
 *
 * const config: RotationHandlerRestrictConfig = {
 *   restrictRotation: true  // Lock rotation
 * };
 *
 * const target = Math.PI;  // Try to rotate to 180 degrees
 * const result = restrictRotateToHandler(target, camera, config);
 * // result = π/2 (rotation locked, returns current angle)
 * ```
 *
 * @category Camera Rig
 * @see {@link createDefaultRotateToHandler} for default pipeline usage
 */
export function restrictRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerRestrictConfig): number {
    if(config.restrictRotation){
        return camera.rotation;
    }
    return targetRotation;
}

/**
 * Creates a default "rotate by" handler pipeline for relative rotation operations.
 *
 * @returns Rotate-by handler function with restriction and clamping
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Restriction** ({@link restrictRotateByHandler}): Returns zero delta if locked
 * 2. **Clamping** ({@link clampRotateByHandler}): Adjusts delta to respect boundaries
 *
 * This ensures that:
 * - Rotation can be completely disabled via `restrictRotation` flag
 * - Resulting rotation angle stays within configured angular boundaries
 * - Delta is adjusted to prevent boundary violations
 *
 * @example
 * ```typescript
 * const rotateBy = createDefaultRotateByHandler();
 *
 * camera.rotation = Math.PI * 0.4;  // 72 degrees
 * camera.rotationBoundaries = { max: Math.PI / 2 };  // Max 90 degrees
 *
 * const delta = Math.PI * 0.3;  // Try to rotate 54 degrees (would exceed max)
 * const constrained = rotateBy(delta, camera, {
 *   clampRotation: true,
 *   restrictRotation: false
 * });
 * // constrained adjusted to only rotate to boundary
 * camera.setRotation(camera.rotation + constrained);
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link restrictRotateByHandler} for the restriction step
 * @see {@link clampRotateByHandler} for the clamping step
 */
export function createDefaultRotateByHandler(): RotateByHandlerFunction {
    return createHandlerChain<number, [BoardCamera, RotationHandlerConfig]>(
        restrictRotateByHandler,
        clampRotateByHandler,
    );
}

/**
 * Creates a default "rotate to" handler pipeline for absolute rotation operations.
 *
 * @returns Rotate-to handler function with restriction and clamping
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Restriction** ({@link restrictRotateToHandler}): Returns current angle if locked
 * 2. **Clamping** ({@link clampRotateToHandler}): Clamps angle to configured boundaries
 *
 * This ensures that:
 * - Rotation can be completely disabled via `restrictRotation` flag
 * - Rotation angle stays within configured angular boundaries
 *
 * @example
 * ```typescript
 * const rotateTo = createDefaultRotateToHandler();
 *
 * camera.rotationBoundaries = { min: 0, max: Math.PI };  // [0°, 180°]
 *
 * const target = Math.PI * 1.5;  // 270 degrees (exceeds max)
 * const constrained = rotateTo(target, camera, {
 *   clampRotation: true,
 *   restrictRotation: false
 * });
 * // constrained = π (clamped to max boundary of 180 degrees)
 * camera.setRotation(constrained);
 * ```
 *
 * @example
 * ```typescript
 * // Create custom pipeline with snapping
 * const cardinalRotateTo = createHandlerChain<number, [BoardCamera, RotationHandlerConfig]>(
 *   restrictRotateToHandler,
 *   (angle) => {
 *     // Snap to cardinal directions (0°, 90°, 180°, 270°)
 *     const cardinals = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
 *     return cardinals.reduce((prev, curr) =>
 *       Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev
 *     );
 *   },
 *   clampRotateToHandler
 * );
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link restrictRotateToHandler} for the restriction step
 * @see {@link clampRotateToHandler} for the clamping step
 */
export function createDefaultRotateToHandler(): RotateToHandlerFunction {
    return createHandlerChain<number, [BoardCamera, RotationHandlerConfig]>(
        restrictRotateToHandler,
        clampRotateToHandler,
    );
}
