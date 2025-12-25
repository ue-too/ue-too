import { Point } from "@ue-too/math";
import { UnSubscribe } from "./update-publisher";

import { RotationLimits } from "./utils/rotation";
import { ZoomLevelLimits } from "./utils/zoom";
import { Boundaries } from "./utils/position";
import { CameraEventMap, CameraState } from "./update-publisher";
import { SubscriptionOptions } from "../utils/observable";

/**
 * Observable camera interface that extends {@link BoardCamera} with event subscription capabilities.
 * Allows observers to subscribe to camera state changes such as pan, zoom, and rotation events.
 *
 * @example
 * ```typescript
 * const camera: ObservableBoardCamera = new DefaultBoardCamera();
 *
 * // Subscribe to pan events
 * const unsubscribe = camera.on('pan', (event, state) => {
 *   console.log('Camera panned by:', event.diff);
 * });
 *
 * // Later, unsubscribe
 * unsubscribe();
 * ```
 *
 * @category Camera
 */
export interface ObservableBoardCamera extends BoardCamera {
    /**
     * Subscribes to camera events with an optional AbortController for cancellation.
     *
     * @typeParam K - The event type key from CameraEventMap
     * @param eventName - The type of camera event to listen for ('pan', 'zoom', 'rotate', or 'all')
     * @param callback - Function called when the event occurs, receives event data and current camera state
     * @param options - Optional subscription configuration including AbortController signal
     * @returns Function to unsubscribe from the event
     *
     * @example
     * ```typescript
     * // Basic subscription
     * camera.on('zoom', (event, state) => {
     *   console.log(`Zoom changed by ${event.deltaZoomAmount}`);
     * });
     *
     * // With AbortController for batch unsubscribing
     * const controller = new AbortController();
     * camera.on('pan', handlePan, { signal: controller.signal });
     * camera.on('zoom', handleZoom, { signal: controller.signal });
     *
     * // Unsubscribe all at once
     * controller.abort();
     * ```
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void, options?: SubscriptionOptions): UnSubscribe;
}

/**
 * Core camera interface for the infinite canvas board system.
 * Manages camera position, rotation, zoom, and coordinate transformations between viewport and world space.
 *
 * The camera uses a center-anchored coordinate system where the camera position represents
 * the center of the viewport in world coordinates.
 *
 * @remarks
 * Transformation order: Scale (devicePixelRatio) → Translation (viewport center) → Rotation → Zoom → Translation (camera position)
 *
 * @example
 * ```typescript
 * const camera: BoardCamera = new BaseCamera(1920, 1080);
 * camera.setPosition({ x: 100, y: 100 });
 * camera.setZoomLevel(2.0);
 * camera.setRotation(Math.PI / 4); // 45 degrees
 *
 * // Convert mouse position to world coordinates
 * const worldPos = camera.convertFromViewPort2WorldSpace(mousePos);
 * ```
 *
 * @category Camera
 */
export interface BoardCamera {
    /** Current camera position in world coordinates (center of viewport) */
    position: Point;

    /** Current rotation in radians (0 to 2π), normalized */
    rotation: number;

    /** Current zoom level (1.0 = 100%, 2.0 = 200%, etc.) */
    zoomLevel: number;

    /** Width of the viewport in CSS pixels */
    viewPortWidth: number;

    /** Height of the viewport in CSS pixels */
    viewPortHeight: number;

    /** Optional position boundaries for the camera in world coordinates */
    boundaries?: Boundaries;

    /** Optional zoom level constraints (min and max zoom) */
    zoomBoundaries?: ZoomLevelLimits;

    /** Optional rotation constraints (start and end angles) */
    rotationBoundaries?: RotationLimits;

    /**
     * Calculates the axis-aligned bounding box (AABB) of the viewport in world space.
     *
     * @param alignCoordinate - If true, uses standard coordinate system (y-up). If false, uses inverted y-axis
     * @returns Object with min and max points defining the bounding box
     *
     * @remarks
     * Useful for culling and determining which objects are visible in the current viewport.
     */
    viewPortAABB(alignCoordinate?: boolean): {min: Point, max: Point};

    /**
     * Calculates the four corners of the viewport in world space, accounting for rotation.
     *
     * @param alignCoordinate - If true, uses standard coordinate system (y-up). If false, uses inverted y-axis
     * @returns Object containing the four corner points (top-left, top-right, bottom-left, bottom-right)
     *
     * @remarks
     * Returns the actual rotated viewport corners, not an AABB. Use this for precise viewport bounds.
     */
    viewPortInWorldSpace(alignCoordinate?: boolean): {top: {left: Point, right: Point}, bottom: {left: Point, right: Point}};

    /**
     * Sets the camera position in world coordinates.
     *
     * @param destination - Target position for the camera center
     * @returns True if position was updated, false if rejected by boundaries or no significant change
     *
     * @remarks
     * Position changes smaller than 10E-10 or 1/zoomLevel are ignored to prevent floating-point jitter.
     * Position is clamped to boundaries if set.
     */
    setPosition(destination: Point): boolean;

    /**
     * Sets the camera zoom level.
     *
     * @param zoomLevel - Target zoom level (1.0 = 100%)
     * @returns True if zoom was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * Zoom is clamped to zoomBoundaries if set. Values are clamped, not rejected.
     */
    setZoomLevel(zoomLevel: number): boolean;

    /**
     * Sets the camera rotation in radians.
     *
     * @param rotation - Target rotation angle in radians
     * @returns True if rotation was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * Rotation is automatically normalized to 0-2π range. Clamped to rotationBoundaries if set.
     */
    setRotation(rotation: number): boolean;

    /**
     * Updates the minimum allowed zoom level.
     *
     * @param minZoomLevel - Minimum zoom level constraint
     *
     * @remarks
     * If current zoom is below the new minimum, camera will zoom in to match the minimum.
     */
    setMinZoomLevel(minZoomLevel: number): void;

    /**
     * Updates the maximum allowed zoom level.
     *
     * @param maxZoomLevel - Maximum zoom level constraint
     */
    setMaxZoomLevel(maxZoomLevel: number): void;

    /**
     * Sets horizontal (x-axis) movement boundaries for the camera.
     *
     * @param min - Minimum x coordinate in world space
     * @param max - Maximum x coordinate in world space
     *
     * @remarks
     * If min > max, values are automatically swapped.
     */
    setHorizontalBoundaries(min: number, max: number): void;

    /**
     * Sets vertical (y-axis) movement boundaries for the camera.
     *
     * @param min - Minimum y coordinate in world space
     * @param max - Maximum y coordinate in world space
     *
     * @remarks
     * If min > max, values are automatically swapped.
     */
    setVerticalBoundaries(min: number, max: number): void;

    /**
     * Gets the camera origin position in window coordinates.
     *
     * @deprecated This method is deprecated and will be removed in a future version
     * @param centerInWindow - Center point in window coordinates
     * @returns The camera origin point (currently just returns the input)
     */
    getCameraOriginInWindow(centerInWindow: Point): Point;

    /**
     * Converts a point from viewport coordinates to world coordinates.
     *
     * @param point - Point in viewport space (pixels from viewport center)
     * @returns Corresponding point in world coordinates
     *
     * @example
     * ```typescript
     * // Convert mouse position (relative to viewport center) to world position
     * const mouseViewport = { x: mouseX - canvas.width/2, y: mouseY - canvas.height/2 };
     * const worldPos = camera.convertFromViewPort2WorldSpace(mouseViewport);
     * ```
     */
    convertFromViewPort2WorldSpace(point: Point): Point;

    /**
     * Converts a point from world coordinates to viewport coordinates.
     *
     * @param point - Point in world coordinates
     * @returns Corresponding point in viewport space (pixels from viewport center)
     *
     * @example
     * ```typescript
     * // Find viewport position of a world object
     * const viewportPos = camera.convertFromWorld2ViewPort(objectWorldPos);
     * ```
     */
    convertFromWorld2ViewPort(point: Point): Point;

    /**
     * Decomposes the camera transformation into Translation, Rotation, and Scale components.
     *
     * @param devicePixelRatio - Device pixel ratio for high-DPI displays
     * @param alignCoordinateSystem - If true, uses standard coordinate system (y-up). If false, uses inverted y-axis
     * @returns Object containing separate scale, rotation, and translation values
     */
    getTRS(devicePixelRatio: number, alignCoordinateSystem: boolean): {scale: {x: number, y: number}, rotation: number, translation: {x: number, y: number}};

    /**
     * Calculates the complete transformation matrix for rendering.
     * This matrix transforms from world space to canvas pixel space.
     *
     * @param devicePixelRatio - Device pixel ratio for high-DPI displays (typically window.devicePixelRatio)
     * @param alignCoordinateSystem - If true, uses standard coordinate system (y-up). If false, uses inverted y-axis
     * @returns 2D transformation matrix in standard form {a, b, c, d, e, f}
     *
     * @remarks
     * Apply this matrix to canvas context: `ctx.setTransform(a, b, c, d, e, f)`
     * The transformation includes devicePixelRatio scaling, viewport centering, rotation, zoom, and camera position.
     *
     * @example
     * ```typescript
     * const transform = camera.getTransform(window.devicePixelRatio, true);
     * ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
     * // Now draw in world coordinates
     * ```
     */
    getTransform(devicePixelRatio: number, alignCoordinateSystem: boolean): {a: number, b: number, c: number, d: number, e: number, f: number};
}
