import { BoardCamera } from "../interface";
import { createHandlerChain } from "../../utils/handler-pipeline";
import { clampZoomLevel } from "../utils/zoom";

/**
 * Combined configuration for zoom handler behavior, merging restriction and clamping settings.
 *
 * @remarks
 * This type combines {@link ZoomHandlerClampConfig} and {@link ZoomHandlerRestrictConfig}
 * to provide complete control over camera zoom behavior.
 *
 * Zoom handlers use this configuration to:
 * - Completely disable zoom operations (restriction)
 * - Clamp zoom level to stay within defined limits (min/max bounds)
 *
 * @category Camera Rig
 * @see {@link ZoomHandlerClampConfig} for boundary clamping options
 * @see {@link ZoomHandlerRestrictConfig} for zoom disabling options
 */
export type ZoomHandlerConfig = ZoomHandlerClampConfig & ZoomHandlerRestrictConfig;

/**
 * Configuration for zoom level boundary clamping.
 *
 * @remarks
 * Controls whether zoom operations should be constrained to camera's zoom boundaries.
 *
 * When `clampZoom` is true, zoom handlers enforce {@link BoardCamera.zoomBoundaries}
 * limits (min/max zoom levels). When false, zoom can exceed configured boundaries.
 *
 * @example
 * ```typescript
 * const config: ZoomHandlerClampConfig = {
 *   clampZoom: true  // Enforce zoom boundaries
 * };
 *
 * camera.zoomBoundaries = { min: 0.5, max: 4.0 };
 * // Zoom will be clamped to [0.5, 4.0] range
 * ```
 *
 * @category Camera Rig
 */
export type ZoomHandlerClampConfig = {
    /**
     * Whether to enforce zoom level boundaries.
     */
    clampZoom: boolean;
};

/**
 * Configuration for completely disabling zoom operations.
 *
 * @remarks
 * Provides a global "zoom lock" to prevent any zoom changes.
 *
 * When `restrictZoom` is true:
 * - Zoom-to operations return current zoom level (no change)
 * - Zoom-by operations return zero delta (no change)
 *
 * This is useful for:
 * - Locking zoom during specific application states
 * - Fixed-zoom viewing modes
 * - Preventing user zoom in certain contexts
 *
 * @example
 * ```typescript
 * const config: ZoomHandlerRestrictConfig = {
 *   restrictZoom: true  // Disable all zoom operations
 * };
 *
 * // Any zoom attempt will be ignored
 * ```
 *
 * @category Camera Rig
 */
export type ZoomHandlerRestrictConfig = {
    /**
     * Whether to completely prevent zoom operations.
     */
    restrictZoom: boolean;
};

/**
 * Handler function type for absolute "zoom to" camera operations.
 *
 * @param destination - Target zoom level
 * @param camera - Current camera instance
 * @param config - Zoom behavior configuration
 * @returns Transformed zoom level (after applying restrictions and clamping)
 *
 * @remarks
 * Zoom-to handlers process absolute zoom level requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations.
 *
 * Handler pipeline pattern:
 * - Each handler receives the target zoom, camera state, and config
 * - Returns a potentially modified zoom level
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Boundary clamping (enforce min/max zoom limits)
 * - Zoom locking (prevent any zoom changes)
 * - Custom zoom constraints or snapping
 *
 * @example
 * ```typescript
 * const myZoomToHandler: ZoomToHandlerFunction = (target, camera, config) => {
 *   // Custom logic: snap to integer zoom levels
 *   return Math.round(target);
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultZoomToOnlyHandler} for the default implementation
 */
export type ZoomToHandlerFunction = (destination: number, camera: BoardCamera, config: ZoomHandlerConfig) => number;

/**
 * Handler function type for relative "zoom by" camera operations.
 *
 * @param delta - Zoom level change (added to current zoom)
 * @param camera - Current camera instance
 * @param config - Zoom behavior configuration
 * @returns Transformed zoom delta (after applying restrictions and clamping)
 *
 * @remarks
 * Zoom-by handlers process relative zoom change requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations to the delta.
 *
 * Handler pipeline pattern:
 * - Each handler receives the zoom delta, camera state, and config
 * - Returns a potentially modified delta
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Boundary clamping (prevent exceeding min/max zoom)
 * - Zoom locking (return zero delta)
 * - Delta dampening or acceleration
 *
 * @example
 * ```typescript
 * const myZoomByHandler: ZoomByHandlerFunction = (delta, camera, config) => {
 *   // Custom logic: dampen large zoom changes
 *   if (Math.abs(delta) > 1.0) {
 *     return delta * 0.5;  // 50% dampening
 *   }
 *   return delta;
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultZoomByOnlyHandler} for the default implementation
 */
export type ZoomByHandlerFunction = (delta: number, camera: BoardCamera, config: ZoomHandlerConfig) => number;

/**
 * Handler pipeline step that clamps "zoom to" targets to camera zoom boundaries.
 *
 * @param destination - Target zoom level
 * @param camera - Current camera instance (provides zoomBoundaries)
 * @param config - Clamping configuration
 * @returns Clamped zoom level
 *
 * @remarks
 * This handler enforces zoom level limits on absolute zoom requests.
 *
 * Behavior:
 * - If `clampZoom` is false: Returns destination unchanged
 * - If `clampZoom` is true: Clamps destination to {@link BoardCamera.zoomBoundaries} (min/max)
 *
 * The clamping is performed by {@link clampZoomLevel}, which handles:
 * - Missing boundaries (undefined min/max)
 * - One-sided constraints (only min or only max)
 * - Full range constraints
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultZoomToOnlyHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * camera.zoomBoundaries = { min: 0.5, max: 3.0 };
 *
 * const config: ZoomHandlerClampConfig = {
 *   clampZoom: true
 * };
 *
 * const target = 5.0;  // Exceeds max
 * const clamped = clampZoomToHandler(target, camera, config);
 * // clamped = 3.0 (clamped to max boundary)
 * ```
 *
 * @category Camera Rig
 * @see {@link clampZoomLevel} for clamping implementation
 * @see {@link createDefaultZoomToOnlyHandler} for default pipeline usage
 */
export function clampZoomToHandler(destination: number, camera: BoardCamera, config: ZoomHandlerClampConfig): number {
    if(!config.clampZoom){
        return destination;
    }
    return clampZoomLevel(destination, camera.zoomBoundaries);
}

/**
 * Handler pipeline step that clamps "zoom by" deltas to prevent boundary violations.
 *
 * @param delta - Zoom level change
 * @param camera - Current camera instance (provides current zoom and boundaries)
 * @param config - Clamping configuration
 * @returns Adjusted delta that respects zoom boundaries
 *
 * @remarks
 * This handler ensures that applying the delta won't exceed zoom boundaries.
 *
 * Algorithm:
 * 1. Calculate potential new zoom level (current + delta)
 * 2. Clamp that level to boundaries
 * 3. Return the difference (clamped - current) as the new delta
 *
 * Behavior:
 * - If `clampZoom` is false: Returns delta unchanged
 * - If `clampZoom` is true: Adjusts delta to stay within boundaries
 *
 * The resulting delta may be zero if already at a boundary and trying to zoom further.
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultZoomByOnlyHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * camera.zoomLevel = 2.8;
 * camera.zoomBoundaries = { max: 3.0 };
 *
 * const config: ZoomHandlerClampConfig = {
 *   clampZoom: true
 * };
 *
 * const delta = 0.5;  // Would exceed max
 * const clamped = clampZoomByHandler(delta, camera, config);
 * // clamped = 0.2 (only zoom to boundary, not beyond)
 * ```
 *
 * @category Camera Rig
 * @see {@link clampZoomLevel} for clamping implementation
 * @see {@link createDefaultZoomByOnlyHandler} for default pipeline usage
 */
export function clampZoomByHandler(delta: number, camera: BoardCamera, config: ZoomHandlerClampConfig): number {
    if(!config.clampZoom){
        return delta;
    }
    let targetZoom = camera.zoomLevel + delta;
    targetZoom = clampZoomLevel(targetZoom, camera.zoomBoundaries);
    delta = targetZoom - camera.zoomLevel;
    return delta;
}

/**
 * Handler pipeline step that prevents "zoom to" operations when zoom is locked.
 *
 * @param destination - Target zoom level
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Current zoom level (if locked) or destination (if unlocked)
 *
 * @remarks
 * This handler implements a global zoom lock for absolute zoom operations.
 *
 * Behavior:
 * - If `restrictZoom` is true: Returns current zoom level (prevents any change)
 * - If `restrictZoom` is false: Returns destination unchanged
 *
 * Use this for:
 * - Disabling zoom during specific application states
 * - Fixed-zoom viewing modes
 * - Read-only camera modes
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultZoomToOnlyHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * camera.zoomLevel = 2.0;
 *
 * const config: ZoomHandlerRestrictConfig = {
 *   restrictZoom: true  // Lock zoom
 * };
 *
 * const target = 3.0;
 * const result = restrictZoomToHandler(target, camera, config);
 * // result = 2.0 (zoom locked, returns current level)
 * ```
 *
 * @category Camera Rig
 * @see {@link createDefaultZoomToOnlyHandler} for default pipeline usage
 */
export function restrictZoomToHandler(destination: number, camera: BoardCamera, config: ZoomHandlerRestrictConfig): number {
    if(config.restrictZoom){
        return camera.zoomLevel;
    }
    return destination;
}

/**
 * Handler pipeline step that prevents "zoom by" operations when zoom is locked.
 *
 * @param delta - Zoom level change
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Zero (if locked) or delta (if unlocked)
 *
 * @remarks
 * This handler implements a global zoom lock for relative zoom operations.
 *
 * Behavior:
 * - If `restrictZoom` is true: Returns 0 (prevents any change)
 * - If `restrictZoom` is false: Returns delta unchanged
 *
 * Use this for:
 * - Disabling zoom during specific application states
 * - Fixed-zoom viewing modes
 * - Read-only camera modes
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultZoomByOnlyHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * const config: ZoomHandlerRestrictConfig = {
 *   restrictZoom: true  // Lock zoom
 * };
 *
 * const delta = 0.5;
 * const result = restrictZoomByHandler(delta, camera, config);
 * // result = 0 (zoom locked, no change allowed)
 * ```
 *
 * @category Camera Rig
 * @see {@link createDefaultZoomByOnlyHandler} for default pipeline usage
 */
export function restrictZoomByHandler(delta: number, camera: BoardCamera, config: ZoomHandlerRestrictConfig): number {
    if(config.restrictZoom){
        return 0;
    }
    return delta;
}

/**
 * Creates a default "zoom to" handler pipeline for absolute zoom operations.
 *
 * @returns Zoom-to handler function with clamping and restriction
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Clamping** ({@link clampZoomToHandler}): Clamps zoom to configured boundaries
 * 2. **Restriction** ({@link restrictZoomToHandler}): Prevents zoom if locked
 *
 * This ensures that:
 * - Zoom level stays within configured min/max boundaries
 * - Zoom can be completely disabled via `restrictZoom` flag
 *
 * The pipeline is specifically for zoom operations without pan compensation.
 * For zoom-at-point operations, use {@link DefaultCameraRig.zoomToAt} which combines
 * zoom and pan handlers.
 *
 * @example
 * ```typescript
 * const zoomTo = createDefaultZoomToOnlyHandler();
 *
 * camera.zoomBoundaries = { min: 0.5, max: 4.0 };
 *
 * // Use in camera rig
 * const target = 5.0;  // Exceeds max
 * const constrained = zoomTo(target, camera, {
 *   clampZoom: true,
 *   restrictZoom: false
 * });
 * // constrained = 4.0 (clamped to max boundary)
 * camera.setZoomLevel(constrained);
 * ```
 *
 * @example
 * ```typescript
 * // Create custom pipeline
 * const customZoomTo = createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
 *   clampZoomToHandler,       // From default
 *   myCustomZoomHandler,      // Your custom logic
 *   restrictZoomToHandler     // From default
 * );
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link clampZoomToHandler} for the clamping step
 * @see {@link restrictZoomToHandler} for the restriction step
 */
export function createDefaultZoomToOnlyHandler(): ZoomToHandlerFunction {
    return createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
        clampZoomToHandler,
        restrictZoomToHandler,
    );
}

/**
 * Creates a default "zoom by" handler pipeline for relative zoom operations.
 *
 * @returns Zoom-by handler function with clamping and restriction
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Clamping** ({@link clampZoomByHandler}): Adjusts delta to respect boundaries
 * 2. **Restriction** ({@link restrictZoomByHandler}): Returns zero delta if locked
 *
 * This ensures that:
 * - Resulting zoom level stays within configured min/max boundaries
 * - Zoom can be completely disabled via `restrictZoom` flag
 * - Delta is adjusted to prevent boundary violations
 *
 * The pipeline is specifically for zoom operations without pan compensation.
 * For zoom-at-point operations, use {@link DefaultCameraRig.zoomByAt} which combines
 * zoom and pan handlers.
 *
 * @example
 * ```typescript
 * const zoomBy = createDefaultZoomByOnlyHandler();
 *
 * camera.zoomLevel = 3.5;
 * camera.zoomBoundaries = { max: 4.0 };
 *
 * // Use in camera rig
 * const delta = 1.0;  // Would exceed max
 * const constrained = zoomBy(delta, camera, {
 *   clampZoom: true,
 *   restrictZoom: false
 * });
 * // constrained = 0.5 (adjusted to reach boundary exactly)
 * camera.setZoomLevel(camera.zoomLevel + constrained);
 * ```
 *
 * @example
 * ```typescript
 * // Create custom pipeline with dampening
 * const dampenedZoomBy = createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
 *   (delta) => delta * 0.7,   // 30% dampening
 *   clampZoomByHandler,       // From default
 *   restrictZoomByHandler     // From default
 * );
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link clampZoomByHandler} for the clamping step
 * @see {@link restrictZoomByHandler} for the restriction step
 */
export function createDefaultZoomByOnlyHandler(): ZoomByHandlerFunction {
    return createHandlerChain<number, [BoardCamera, ZoomHandlerConfig]>(
        clampZoomByHandler,
        restrictZoomByHandler,
    );
}
