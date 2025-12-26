import { Point, PointCal } from "@ue-too/math";
import { BoardCamera } from "../interface";
import { createHandlerChain } from "../../utils/handler-pipeline";
import { clampPoint, clampPointEntireViewPort } from "../utils/position";

/**
 * Combined configuration for pan handler behavior, merging restriction and clamping settings.
 *
 * @remarks
 * This type combines {@link PanHandlerRestrictionConfig} and {@link PanHandlerClampConfig}
 * to provide complete control over camera panning behavior.
 *
 * Pan handlers use this configuration to:
 * - Restrict movement along specific axes (world or viewport-relative)
 * - Clamp camera position to stay within boundaries
 * - Control whether entire viewport or just center must stay in bounds
 *
 * @category Camera Rig
 * @see {@link PanHandlerRestrictionConfig} for movement restriction options
 * @see {@link PanHandlerClampConfig} for boundary clamping options
 */
export type PanHandlerConfig = PanHandlerRestrictionConfig & PanHandlerClampConfig;

/**
 * Configuration for boundary clamping behavior during camera panning.
 *
 * @remarks
 * Controls how camera position is constrained to stay within defined boundaries.
 *
 * @property limitEntireViewPort - When true, ensures the entire viewport rectangle stays within boundaries.
 *                                 When false, only the camera center point (position) is constrained.
 *                                 This affects how {@link BoardCamera.boundaries} are interpreted.
 *
 * @property clampTranslation - When true, enforces boundary constraints on pan operations.
 *                              When false, camera can pan freely outside boundaries.
 *
 * @example
 * ```typescript
 * const config: PanHandlerClampConfig = {
 *   limitEntireViewPort: true,  // Entire view must stay in bounds
 *   clampTranslation: true       // Enforce boundaries
 * };
 * ```
 *
 * @category Camera Rig
 */
export type PanHandlerClampConfig = {
    /**
     * Whether to constrain the entire viewport or just the camera center.
     */
    limitEntireViewPort: boolean;
    /**
     * Whether to enforce boundary constraints on panning.
     */
    clampTranslation: boolean;
};

/**
 * Configuration for restricting camera movement along specific axes.
 *
 * @remarks
 * Provides fine-grained control over which directions the camera can move.
 * Supports both world-space restrictions (absolute X/Y) and viewport-relative
 * restrictions (screen-space horizontal/vertical, accounting for rotation).
 *
 * **World-space restrictions:**
 * - `restrictXTranslation`: Prevents movement along world X axis
 * - `restrictYTranslation`: Prevents movement along world Y axis
 *
 * **Viewport-relative restrictions (rotation-aware):**
 * - `restrictRelativeXTranslation`: Prevents horizontal movement (screen-space)
 * - `restrictRelativeYTranslation`: Prevents vertical movement (screen-space)
 *
 * Use cases:
 * - Side-scrolling games: `restrictYTranslation = true`
 * - Locked vertical scrolling: `restrictRelativeYTranslation = true`
 * - Fixed-axis pan tools in editors
 *
 * @example
 * ```typescript
 * // Side-scroller: only allow horizontal movement in world space
 * const config: PanHandlerRestrictionConfig = {
 *   restrictXTranslation: false,
 *   restrictYTranslation: true,
 *   restrictRelativeXTranslation: false,
 *   restrictRelativeYTranslation: false
 * };
 *
 * // Lock to vertical screen movement only (with camera rotation)
 * const screenConfig: PanHandlerRestrictionConfig = {
 *   restrictXTranslation: false,
 *   restrictYTranslation: false,
 *   restrictRelativeXTranslation: true,
 *   restrictRelativeYTranslation: false
 * };
 * ```
 *
 * @category Camera Rig
 */
export type PanHandlerRestrictionConfig = {
    /**
     * Whether to prevent movement along the world X axis.
     */
    restrictXTranslation: boolean;
    /**
     * Whether to prevent movement along the world Y axis.
     */
    restrictYTranslation: boolean;
    /**
     * Whether to prevent horizontal movement in viewport/screen space.
     * Accounts for camera rotation - locks movement perpendicular to screen's vertical direction.
     */
    restrictRelativeXTranslation: boolean;
    /**
     * Whether to prevent vertical movement in viewport/screen space.
     * Accounts for camera rotation - locks movement perpendicular to screen's horizontal direction.
     */
    restrictRelativeYTranslation: boolean;
};

/**
 * Handler function type for absolute "pan to" camera operations.
 *
 * @param destination - Target camera position in world space
 * @param camera - Current camera instance
 * @param config - Pan behavior configuration
 * @returns Transformed destination position (after applying restrictions and clamping)
 *
 * @remarks
 * Pan-to handlers process absolute camera positioning requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations to the target position.
 *
 * Handler pipeline pattern:
 * - Each handler receives the current destination, camera state, and config
 * - Returns a potentially modified destination point
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Axis restrictions (prevent movement on specific axes)
 * - Boundary clamping (keep position within bounds)
 * - Viewport constraints (ensure entire viewport stays in bounds)
 *
 * @example
 * ```typescript
 * const myPanToHandler: PanToHandlerFunction = (dest, camera, config) => {
 *   // Custom logic: snap to grid
 *   return {
 *     x: Math.round(dest.x / 100) * 100,
 *     y: Math.round(dest.y / 100) * 100
 *   };
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultPanToHandler} for the default implementation
 */
export type PanToHandlerFunction = (destination: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;

/**
 * Handler function type for relative "pan by" camera operations.
 *
 * @param delta - Movement delta in world space
 * @param camera - Current camera instance
 * @param config - Pan behavior configuration
 * @returns Transformed movement delta (after applying restrictions and clamping)
 *
 * @remarks
 * Pan-by handlers process relative camera movement requests. They form a pipeline
 * that can apply restrictions, clamping, and other transformations to the movement delta.
 *
 * Handler pipeline pattern:
 * - Each handler receives the current delta, camera state, and config
 * - Returns a potentially modified delta
 * - Handlers can be chained using {@link createHandlerChain}
 *
 * Common transformations:
 * - Axis restrictions (prevent movement on specific axes)
 * - Boundary clamping (prevent moving outside bounds)
 * - Delta dampening or acceleration
 *
 * @example
 * ```typescript
 * const myPanByHandler: PanByHandlerFunction = (delta, camera, config) => {
 *   // Custom logic: dampen large movements
 *   const magnitude = Math.sqrt(delta.x ** 2 + delta.y ** 2);
 *   if (magnitude > 100) {
 *     const scale = 100 / magnitude;
 *     return { x: delta.x * scale, y: delta.y * scale };
 *   }
 *   return delta;
 * };
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for composing handler pipelines
 * @see {@link createDefaultPanByHandler} for the default implementation
 */
export type PanByHandlerFunction = (delta: Point, camera: BoardCamera, config: PanHandlerConfig) => Point;

/**
 * Creates a default "pan to" handler pipeline for absolute camera positioning.
 *
 * @returns Pan-to handler function with restriction and clamping
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Restriction** ({@link restrictPanToHandler}): Applies axis restrictions based on config
 * 2. **Clamping** ({@link clampToHandler}): Clamps position to boundaries
 *
 * This ensures that:
 * - Camera respects axis lock settings (e.g., side-scroller constraints)
 * - Camera position stays within configured boundaries
 * - Entire viewport can be kept in bounds (if `limitEntireViewPort` is true)
 *
 * All operations work in world coordinate space.
 *
 * @example
 * ```typescript
 * const panTo = createDefaultPanToHandler();
 *
 * // Use in camera rig
 * const destination = { x: 1000, y: 500 };
 * const constrainedDest = panTo(destination, camera, {
 *   restrictYTranslation: true,  // Lock Y axis
 *   clampTranslation: true,
 *   limitEntireViewPort: true,
 *   // ... other config
 * });
 * camera.setPosition(constrainedDest);
 * ```
 *
 * @example
 * ```typescript
 * // Create custom pipeline using default handlers
 * const customPanTo = createHandlerChain<Point, [BoardCamera, PanHandlerConfig]>(
 *   restrictPanToHandler,  // From default
 *   myCustomHandler,       // Your custom logic
 *   clampToHandler         // From default
 * );
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link restrictPanToHandler} for the restriction step
 * @see {@link clampToHandler} for the clamping step
 */
export function createDefaultPanToHandler(): PanToHandlerFunction {
    return createHandlerChain<Point, [BoardCamera, PanHandlerConfig]>(
        restrictPanToHandler,
        clampToHandler,
    );
}

/**
 * Creates a default "pan by" handler pipeline for relative camera movement.
 *
 * @returns Pan-by handler function with restriction and clamping
 *
 * @remarks
 * The default handler pipeline applies transformations in this order:
 * 1. **Restriction** ({@link restrictPanByHandler}): Applies axis restrictions based on config
 * 2. **Clamping** ({@link clampByHandler}): Clamps resulting position to boundaries
 *
 * This ensures that:
 * - Camera movement respects axis lock settings
 * - Camera stays within configured boundaries after applying delta
 * - Delta is adjusted to prevent boundary violations
 *
 * The input delta is in world space. All operations work in world coordinates.
 *
 * @example
 * ```typescript
 * const panBy = createDefaultPanByHandler();
 *
 * // Use in camera rig
 * const delta = { x: 50, y: -30 };
 * const constrainedDelta = panBy(delta, camera, {
 *   restrictRelativeYTranslation: true,  // Lock screen-vertical movement
 *   clampTranslation: true,
 *   limitEntireViewPort: false,
 *   // ... other config
 * });
 * camera.setPosition(PointCal.addVector(camera.position, constrainedDelta));
 * ```
 *
 * @example
 * ```typescript
 * // Create custom pipeline with dampening
 * const dampenedPanBy = createHandlerChain<Point, [BoardCamera, PanHandlerConfig]>(
 *   restrictPanByHandler,
 *   (delta) => ({ x: delta.x * 0.8, y: delta.y * 0.8 }),  // 20% dampening
 *   clampByHandler
 * );
 * ```
 *
 * @category Camera Rig
 * @see {@link createHandlerChain} for creating custom handler pipelines
 * @see {@link restrictPanByHandler} for the restriction step
 * @see {@link clampByHandler} for the clamping step
 */
export function createDefaultPanByHandler(): PanByHandlerFunction {
    return createHandlerChain<Point, [BoardCamera, PanHandlerConfig]>(
        restrictPanByHandler,
        clampByHandler,
    );
}

/**
 * Handler pipeline step that applies axis restrictions to "pan to" destinations.
 *
 * @param destination - Target camera position in world space
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Restricted destination position
 *
 * @remarks
 * This handler enforces axis-lock constraints on absolute camera positioning.
 * It converts the destination to a delta, applies restrictions, then converts back.
 *
 * Algorithm:
 * 1. Calculate delta from current position to destination
 * 2. Apply restrictions using {@link convertDeltaToComplyWithRestriction}
 * 3. If delta becomes zero, return original destination (already at target)
 * 4. Otherwise, return current position + restricted delta
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultPanToHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * // Standalone usage
 * const config: PanHandlerRestrictionConfig = {
 *   restrictYTranslation: true,  // Lock Y axis
 *   restrictXTranslation: false,
 *   restrictRelativeXTranslation: false,
 *   restrictRelativeYTranslation: false
 * };
 *
 * const destination = { x: 1000, y: 500 };
 * const restricted = restrictPanToHandler(destination, camera, config);
 * // If camera is at { x: 0, y: 200 }, result is { x: 1000, y: 200 }
 * ```
 *
 * @category Camera Rig
 * @see {@link convertDeltaToComplyWithRestriction} for restriction logic
 * @see {@link createDefaultPanToHandler} for default pipeline usage
 */
export function restrictPanToHandler(destination: Point, camera: BoardCamera, config: PanHandlerRestrictionConfig): Point {
    let delta = PointCal.subVector(destination, camera.position);
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    if (delta.x === 0 && delta.y === 0) {
        return destination;
    }
    const dest = PointCal.addVector(camera.position, delta);
    return dest;
}

/**
 * Handler pipeline step that applies axis restrictions to "pan by" deltas.
 *
 * @param delta - Movement delta in world space
 * @param camera - Current camera instance
 * @param config - Restriction configuration
 * @returns Restricted movement delta
 *
 * @remarks
 * This handler enforces axis-lock constraints on relative camera movement.
 * It directly transforms the delta according to restriction rules.
 *
 * Restrictions applied by {@link convertDeltaToComplyWithRestriction}:
 * - World-space axis locks (X/Y)
 * - Viewport-relative axis locks (horizontal/vertical, accounting for rotation)
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultPanByHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * // Standalone usage - lock to screen-horizontal movement
 * const config: PanHandlerRestrictionConfig = {
 *   restrictXTranslation: false,
 *   restrictYTranslation: false,
 *   restrictRelativeXTranslation: false,
 *   restrictRelativeYTranslation: true  // Lock screen-vertical
 * };
 *
 * const delta = { x: 50, y: 30 };
 * const restricted = restrictPanByHandler(delta, camera, config);
 * // Result depends on camera rotation - only horizontal screen movement allowed
 * ```
 *
 * @category Camera Rig
 * @see {@link convertDeltaToComplyWithRestriction} for restriction logic
 * @see {@link createDefaultPanByHandler} for default pipeline usage
 */
export function restrictPanByHandler(delta: Point, camera: BoardCamera, config: PanHandlerRestrictionConfig): Point {
    delta = convertDeltaToComplyWithRestriction(delta, camera, config);
    return delta;
}

/**
 * Handler pipeline step that clamps "pan to" destinations to camera boundaries.
 *
 * @param destination - Target camera position in world space
 * @param camera - Current camera instance (provides boundaries and viewport dimensions)
 * @param config - Clamping configuration
 * @returns Clamped destination position
 *
 * @remarks
 * This handler enforces boundary constraints on absolute camera positioning.
 * Behavior depends on configuration:
 *
 * - If `clampTranslation` is false: Returns destination unchanged (no clamping)
 * - If `limitEntireViewPort` is false: Clamps camera center to boundaries
 * - If `limitEntireViewPort` is true: Ensures entire viewport rectangle stays in bounds
 *
 * The entire-viewport mode accounts for:
 * - Viewport dimensions (width/height)
 * - Current zoom level (affects viewport size in world space)
 * - Camera rotation (affects viewport orientation)
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultPanToHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * // Standalone usage - ensure entire viewport stays in bounds
 * camera.boundaries = {
 *   min: { x: 0, y: 0 },
 *   max: { x: 2000, y: 1000 }
 * };
 *
 * const config: PanHandlerClampConfig = {
 *   clampTranslation: true,
 *   limitEntireViewPort: true
 * };
 *
 * const destination = { x: 2500, y: 500 };  // Outside bounds
 * const clamped = clampToHandler(destination, camera, config);
 * // Result keeps entire viewport within [0,0] to [2000,1000]
 * ```
 *
 * @category Camera Rig
 * @see {@link clampPoint} for center-point clamping
 * @see {@link clampPointEntireViewPort} for full-viewport clamping
 * @see {@link createDefaultPanToHandler} for default pipeline usage
 */
export function clampToHandler(destination: Point, camera: BoardCamera, config: PanHandlerClampConfig): Point {
    if(!config.clampTranslation){
        return destination;
    }
    let actualDest = clampPoint(destination, camera.boundaries);
    if(config.limitEntireViewPort){
        actualDest = clampPointEntireViewPort(destination, camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation);
    }
    return actualDest;
}

/**
 * Handler pipeline step that clamps "pan by" deltas to prevent boundary violations.
 *
 * @param delta - Movement delta in world space
 * @param camera - Current camera instance (provides boundaries and viewport dimensions)
 * @param config - Clamping configuration
 * @returns Adjusted delta that respects boundaries
 *
 * @remarks
 * This handler ensures that applying the delta won't move the camera outside boundaries.
 * It works by:
 * 1. Calculating the potential new position (current + delta)
 * 2. Clamping that position to boundaries
 * 3. Returning the difference (clamped - current) as the new delta
 *
 * Behavior depends on configuration:
 * - If `clampTranslation` is false: Returns delta unchanged
 * - If `limitEntireViewPort` is false: Clamps based on camera center
 * - If `limitEntireViewPort` is true: Ensures entire viewport stays in bounds
 *
 * The resulting delta may be zero if the camera is already at a boundary
 * and trying to move further outside.
 *
 * Can be used standalone, but typically composed into a handler pipeline via
 * {@link createDefaultPanByHandler} or {@link createHandlerChain}.
 *
 * @example
 * ```typescript
 * // Standalone usage
 * camera.position = { x: 1950, y: 500 };
 * camera.boundaries = { max: { x: 2000 } };
 *
 * const config: PanHandlerClampConfig = {
 *   clampTranslation: true,
 *   limitEntireViewPort: false
 * };
 *
 * const delta = { x: 100, y: 0 };  // Try to move right
 * const clamped = clampByHandler(delta, camera, config);
 * // Result: { x: 50, y: 0 } - only move to boundary, not beyond
 * ```
 *
 * @category Camera Rig
 * @see {@link clampPoint} for center-point clamping
 * @see {@link clampPointEntireViewPort} for full-viewport clamping
 * @see {@link createDefaultPanByHandler} for default pipeline usage
 */
export function clampByHandler(delta: Point, camera: BoardCamera, config: PanHandlerClampConfig): Point {
    if(!config.clampTranslation){
        return delta;
    }
    let actualDelta = PointCal.subVector(clampPoint(PointCal.addVector(camera.position, delta), camera.boundaries), camera.position);
    if(config.limitEntireViewPort){
        actualDelta = PointCal.subVector(clampPointEntireViewPort(PointCal.addVector(camera.position, delta), camera.viewPortWidth, camera.viewPortHeight, camera.boundaries, camera.zoomLevel, camera.rotation), camera.position);
    }
    return actualDelta;
}

/**
 * Transforms a movement delta to comply with axis restriction configuration.
 *
 * @param delta - Original movement delta in world space
 * @param camera - Current camera instance (provides rotation for relative restrictions)
 * @param config - Restriction configuration
 * @returns Transformed delta that respects all enabled restrictions
 *
 * @remarks
 * This function applies axis-lock logic for both world-space and viewport-relative restrictions.
 * Restrictions are processed in priority order:
 *
 * 1. **Complete locks** (highest priority):
 *    - Both world axes locked → return zero delta
 *    - Both relative axes locked → return zero delta
 *
 * 2. **World-space axis locks**:
 *    - `restrictXTranslation` → Zero out X component
 *    - `restrictYTranslation` → Zero out Y component
 *
 * 3. **Viewport-relative axis locks** (rotation-aware):
 *    - `restrictRelativeXTranslation` → Project delta onto screen-vertical direction
 *    - `restrictRelativeYTranslation` → Project delta onto screen-horizontal direction
 *
 * For viewport-relative restrictions:
 * - "Relative X" = horizontal in viewport/screen space
 * - "Relative Y" = vertical in viewport/screen space
 * - These account for camera rotation by projecting onto rotated axes
 *
 * @example
 * ```typescript
 * // World-space restriction: lock Y axis
 * const config1 = {
 *   restrictXTranslation: false,
 *   restrictYTranslation: true,
 *   restrictRelativeXTranslation: false,
 *   restrictRelativeYTranslation: false
 * };
 *
 * const delta1 = { x: 50, y: 30 };
 * const result1 = convertDeltaToComplyWithRestriction(delta1, camera, config1);
 * // result1 = { x: 50, y: 0 } - Y component removed
 * ```
 *
 * @example
 * ```typescript
 * // Viewport-relative restriction: lock horizontal screen movement
 * const config2 = {
 *   restrictXTranslation: false,
 *   restrictYTranslation: false,
 *   restrictRelativeXTranslation: true,  // Lock screen-horizontal
 *   restrictRelativeYTranslation: false
 * };
 *
 * // Camera rotated 45 degrees
 * const delta2 = { x: 100, y: 100 };
 * const result2 = convertDeltaToComplyWithRestriction(delta2, camera, config2);
 * // result2 projects delta onto screen-vertical direction
 * // (perpendicular to screen-horizontal)
 * ```
 *
 * @category Camera Rig
 * @see {@link restrictPanByHandler} for usage in pan-by pipeline
 * @see {@link restrictPanToHandler} for usage in pan-to pipeline
 */
export function convertDeltaToComplyWithRestriction(delta: Point, camera: BoardCamera, config: PanHandlerRestrictionConfig): Point {
    if(config.restrictXTranslation && config.restrictYTranslation){
        return {x: 0, y: 0};
    }
    if(config.restrictRelativeXTranslation && config.restrictRelativeYTranslation){
        return {x: 0, y: 0};
    }
    if(config.restrictXTranslation){
        delta.x = 0;
    }
    if(config.restrictYTranslation){
        delta.y = 0;
    }
    if(config.restrictRelativeXTranslation){
        const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, camera.rotation);
        const value = PointCal.dotProduct(upDirection, delta);
        delta = PointCal.multiplyVectorByScalar(upDirection, value);
    }
    if(config.restrictRelativeYTranslation){
        const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, camera.rotation);
        const value = PointCal.dotProduct(rightDirection, delta);
        delta = PointCal.multiplyVectorByScalar(rightDirection, value);
    }
    return delta;
}

/**
 * Converts a user input delta (viewport space) to camera movement delta (world space).
 *
 * @param delta - Movement delta in viewport/screen coordinates (CSS pixels)
 * @param camera - Current camera instance (provides rotation and zoom)
 * @returns Equivalent delta in world space
 *
 * @remarks
 * This function performs the standard viewport-to-world delta conversion:
 * 1. Rotate delta by camera rotation (convert screen direction to world direction)
 * 2. Scale by inverse zoom (convert screen distance to world distance)
 *
 * Formula: `worldDelta = rotate(viewportDelta, cameraRotation) / zoomLevel`
 *
 * This is the core conversion used by {@link DefaultCameraRig.panByViewPort}.
 *
 * @example
 * ```typescript
 * // User drags mouse 100 pixels right, 50 pixels down
 * const viewportDelta = { x: 100, y: 50 };
 *
 * // Camera at 2x zoom, no rotation
 * camera.zoomLevel = 2.0;
 * camera.rotation = 0;
 *
 * const worldDelta = convertUserInputDeltaToCameraDelta(viewportDelta, camera);
 * // worldDelta = { x: 50, y: 25 } - half the viewport delta due to 2x zoom
 * ```
 *
 * @example
 * ```typescript
 * // With camera rotation
 * camera.zoomLevel = 1.0;
 * camera.rotation = Math.PI / 2;  // 90 degrees
 *
 * const viewportDelta = { x: 100, y: 0 };  // Drag right
 * const worldDelta = convertUserInputDeltaToCameraDelta(viewportDelta, camera);
 * // worldDelta ≈ { x: 0, y: -100 } - rotated 90 degrees in world space
 * ```
 *
 * @category Camera Rig
 * @see {@link DefaultCameraRig.panByViewPort} for usage
 */
export function convertUserInputDeltaToCameraDelta(delta: Point, camera: BoardCamera): Point {
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, camera.rotation), 1 / camera.zoomLevel);
}
