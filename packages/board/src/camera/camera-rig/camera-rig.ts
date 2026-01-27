import type { BaseContext } from '@ue-too/being';
import { PointCal } from '@ue-too/math';
import { Point } from '@ue-too/math';

import DefaultBoardCamera from '../default-camera';
import { ObservableBoardCamera } from '../interface';
import {
    clampPointEntireViewPort,
    convertDeltaInViewPortToWorldSpace,
} from '../utils';
import {
    PanByHandlerFunction,
    PanHandlerConfig,
    PanToHandlerFunction,
    createDefaultPanByHandler,
    createDefaultPanToHandler,
} from './pan-handler';
import {
    createDefaultRotateByHandler,
    createDefaultRotateToHandler,
} from './rotation-handler';
import type {
    RotateByHandlerFunction,
    RotateToHandlerFunction,
    RotationHandlerConfig,
} from './rotation-handler';
import {
    ZoomByHandlerFunction,
    ZoomHandlerConfig,
    ZoomToHandlerFunction,
    createDefaultZoomByOnlyHandler,
    createDefaultZoomToOnlyHandler,
} from './zoom-handler';

/**
 * Configuration for camera rig behavior combining pan, zoom, and rotation settings.
 * Composed from individual handler configs.
 *
 * @remarks
 * This type merges configuration from:
 * - {@link PanHandlerConfig} - Pan clamping and boundaries
 * - {@link ZoomHandlerConfig} - Zoom limits and restrictions
 * - {@link RotationHandlerConfig} - Rotation constraints
 *
 * @category Camera Rig
 * @see {@link PanHandlerConfig}
 * @see {@link ZoomHandlerConfig}
 * @see {@link RotationHandlerConfig}
 */
export type CameraRigConfig = PanHandlerConfig &
    ZoomHandlerConfig &
    RotationHandlerConfig;

/**
 * High-level camera control interface providing intuitive methods for pan, zoom, and rotation.
 * The camera rig acts as a facade over the camera, handling coordinate conversions and constraints.
 *
 * @remarks
 * CameraRig provides:
 * - **Coordinate-aware methods**: Separate methods for viewport and world coordinates
 * - **Anchor-point zooming**: Keep points stationary during zoom (zoom-to-cursor)
 * - **Configuration management**: Unified config for all camera operations
 * - **Handler composition**: Combines pan, zoom, rotation handlers with proper sequencing
 *
 * The rig ensures correct transformation order when combining operations
 * (e.g., zoom-at-point requires zoom followed by pan compensation).
 *
 * @category Camera Rig
 * @see {@link DefaultCameraRig} for the default implementation
 * @see {@link createDefaultCameraRig} for a factory function
 */
export interface CameraRig extends BaseContext {
    /** The underlying observable camera being controlled */
    camera: ObservableBoardCamera;

    /** Current configuration for all camera operations */
    config: CameraRigConfig;

    /**
     * Updates the camera rig configuration.
     * @param config - Partial configuration to merge with current config
     */
    configure(config: Partial<CameraRigConfig>): void;

    /**
     * Updates the camera rig state (called per frame if needed).
     */
    update(): void;

    /**
     * Pans the camera by a delta in viewport coordinates.
     * @param delta - Movement delta in viewport space (CSS pixels, origin at center)
     */
    panByViewPort: (delta: Point) => void;

    /**
     * Pans the camera to a target position in viewport coordinates.
     * @param target - Target position in viewport space
     */
    panToViewPort: (target: Point) => void;

    /**
     * Pans the camera by a delta in world coordinates.
     * @param delta - Movement delta in world space
     */
    panByWorld: (delta: Point) => void;

    /**
     * Pans the camera to a target position in world coordinates.
     * @param target - Target position in world space
     */
    panToWorld: (target: Point) => void;

    /**
     * Rotates the camera by a delta angle.
     * @param delta - Rotation delta in radians
     */
    rotateBy: (delta: number) => void;

    /**
     * Rotates the camera to a target angle.
     * @param target - Target rotation in radians
     */
    rotateTo: (target: number) => void;

    /**
     * Zooms to a target level, keeping a viewport point stationary.
     * @param targetZoom - Target zoom level
     * @param at - Anchor point in viewport coordinates
     */
    zoomToAt: (targetZoom: number, at: Point) => void;

    /**
     * Zooms by a delta, keeping a viewport point stationary.
     * @param delta - Zoom delta
     * @param at - Anchor point in viewport coordinates
     */
    zoomByAt: (delta: number, at: Point) => void;

    /**
     * Zooms to a target level at viewport center.
     * @param targetZoom - Target zoom level
     */
    zoomTo: (targetZoom: number) => void;

    /**
     * Zooms by a delta at viewport center.
     * @param delta - Zoom delta
     */
    zoomBy: (delta: number) => void;

    /**
     * Zooms to a target level, keeping a world point stationary.
     * @param targetZoom - Target zoom level
     * @param at - Anchor point in world coordinates
     */
    zoomToAtWorld: (targetZoom: number, at: Point) => void;

    /**
     * Zooms by a delta, keeping a world point stationary.
     * @param delta - Zoom delta
     * @param at - Anchor point in world coordinates
     */
    zoomByAtWorld: (delta: number, at: Point) => void;
}

/**
 * Default implementation of the camera rig providing comprehensive camera control.
 * Composes pan, zoom, and rotation handlers into a unified, easy-to-use API.
 *
 * @remarks
 * DefaultCameraRig serves as:
 * - **Context for state machines**: Passed to pan/zoom state machines as execution context
 * - **Handler composition**: Combines individual pan/zoom/rotation handlers
 * - **Coordinate conversion**: Manages conversions between viewport and world space
 * - **Configuration management**: Applies constraints and limits through handlers
 *
 * The rig ensures proper transformation sequencing:
 * 1. For anchor-point zoom: Apply zoom, then compensate camera position to keep anchor stationary
 * 2. For rotation: Transform coordinates based on current camera rotation
 * 3. For pan: Apply clamping and boundary constraints
 *
 * @example
 * ```typescript
 * const camera = new DefaultBoardCamera();
 * const rig = new DefaultCameraRig({
 *   limitEntireViewPort: true,
 *   clampTranslation: true,
 *   clampZoom: true,
 *   restrictZoom: false
 * }, camera);
 *
 * // Pan in viewport coordinates
 * rig.panByViewPort({ x: 50, y: -30 });
 *
 * // Zoom at cursor position
 * rig.zoomByAt(0.1, mousePosition);
 *
 * // Rotate camera
 * rig.rotateBy(Math.PI / 4);
 * ```
 *
 * @category Camera Rig
 * @see {@link CameraRig} for the interface definition
 * @see {@link createDefaultCameraRig} for a convenient factory function
 */
export class DefaultCameraRig implements CameraRig {
    private _panBy: PanByHandlerFunction;
    private _panTo: PanToHandlerFunction;
    private _zoomTo: ZoomToHandlerFunction;
    private _zoomBy: ZoomByHandlerFunction;
    private _rotateBy: RotateByHandlerFunction;
    private _rotateTo: RotateToHandlerFunction;
    private _config: CameraRigConfig;
    private _camera: ObservableBoardCamera;

    /**
     * Creates a new DefaultCameraRig with specified configuration and camera.
     *
     * @param config - Camera rig configuration for pan and zoom constraints
     * @param camera - Observable camera instance to control (defaults to new DefaultBoardCamera)
     *
     * @remarks
     * The constructor initializes:
     * - Default pan, zoom, and rotation handler functions
     * - Rotation config with `restrictRotation: false` and `clampRotation: true`
     * - Handler functions that will be used to process and constrain all camera operations
     *
     * @example
     * ```typescript
     * const rig = new DefaultCameraRig({
     *   limitEntireViewPort: true,
     *   clampTranslation: true,
     *   clampZoom: true,
     *   restrictZoom: false,
     *   restrictXTranslation: false,
     *   restrictYTranslation: false
     * });
     * ```
     */
    constructor(
        config: PanHandlerConfig & ZoomHandlerConfig,
        camera: ObservableBoardCamera = new DefaultBoardCamera()
    ) {
        this._panBy = createDefaultPanByHandler();
        this._panTo = createDefaultPanToHandler();
        this._zoomTo = createDefaultZoomToOnlyHandler();
        this._zoomBy = createDefaultZoomByOnlyHandler();
        this._rotateBy = createDefaultRotateByHandler();
        this._rotateTo = createDefaultRotateToHandler();
        this._config = {
            ...config,
            restrictRotation: false,
            clampRotation: true,
        };
        this._camera = camera;
    }

    /**
     * Zooms to a target level while keeping a viewport point stationary (zoom-to-cursor).
     *
     * @param targetZoom - Target zoom level to reach
     * @param at - Anchor point in viewport coordinates (center-anchored, CSS pixels)
     *
     * @remarks
     * This implements the "zoom to cursor" behavior commonly seen in map applications.
     * The algorithm:
     * 1. Converts anchor point from viewport to world space (before zoom)
     * 2. Applies zoom transformation (may be clamped by config)
     * 3. Converts anchor point from viewport to world space (after zoom)
     * 4. Calculates position difference and pans camera to compensate
     *
     * The anchor point remains stationary on screen, while the world zooms around it.
     *
     * @example
     * ```typescript
     * // Zoom to 2x at mouse cursor position
     * rig.zoomToAt(2.0, { x: mouseX, y: mouseY });
     *
     * // The world point under the cursor stays in place
     * ```
     */
    zoomToAt(targetZoom: number, at: Point): void {
        let originalAnchorInWorld =
            this._camera.convertFromViewPort2WorldSpace(at);
        const transformTarget = this._zoomTo(
            targetZoom,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(transformTarget);
        let anchorInWorldAfterZoom =
            this._camera.convertFromViewPort2WorldSpace(at);
        const cameraPositionDiff = PointCal.subVector(
            originalAnchorInWorld,
            anchorInWorldAfterZoom
        );
        const transformedCameraPositionDiff = this._panBy(
            cameraPositionDiff,
            this._camera,
            this._config
        );
        this._camera.setPosition(
            PointCal.addVector(
                this._camera.position,
                transformedCameraPositionDiff
            )
        );
    }

    /**
     * Zooms by a relative delta while keeping a viewport point stationary.
     *
     * @param delta - Relative zoom delta (multiplied by current zoom level)
     * @param at - Anchor point in viewport coordinates (center-anchored, CSS pixels)
     *
     * @remarks
     * This method is ideal for mouse wheel zoom interactions where the delta
     * represents a relative change rather than an absolute target.
     *
     * The delta is scaled by current zoom level: `actualDelta = delta * currentZoom`
     * This provides consistent zoom "speed" regardless of current zoom level.
     *
     * Like {@link zoomToAt}, this keeps the anchor point stationary during zoom.
     *
     * @example
     * ```typescript
     * // Zoom in by 10% at cursor position (mouse wheel up)
     * rig.zoomByAt(0.1, cursorPosition);
     *
     * // Zoom out by 10% at cursor position (mouse wheel down)
     * rig.zoomByAt(-0.1, cursorPosition);
     * ```
     *
     * @see {@link zoomToAt} for zooming to an absolute level
     */
    zoomByAt(delta: number, at: Point): void {
        const convertedDelta = delta * this._camera.zoomLevel;
        let originalAnchorInWorld =
            this._camera.convertFromViewPort2WorldSpace(at);
        const transformedDelta = this._zoomBy(
            convertedDelta,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
        let anchorInWorldAfterZoom =
            this._camera.convertFromViewPort2WorldSpace(at);
        const diff = PointCal.subVector(
            originalAnchorInWorld,
            anchorInWorldAfterZoom
        );
        const transformedDiff = this._panBy(diff, this._camera, this._config);
        this._camera.setPosition(
            PointCal.addVector(this._camera.position, transformedDiff)
        );
    }

    /**
     * Zooms to a target level with the viewport center as the anchor point.
     *
     * @param targetZoom - Target zoom level to reach
     *
     * @remarks
     * This is a simpler version of {@link zoomToAt} that always zooms relative to the
     * viewport center. The camera position remains unchanged, so the center point of
     * the viewport stays fixed in world space.
     *
     * Use this when you want straightforward zoom without anchor-point tracking,
     * such as zoom controls in a UI toolbar.
     *
     * @example
     * ```typescript
     * // Zoom to 2x, centered on current view
     * rig.zoomTo(2.0);
     *
     * // Zoom to fit (100%)
     * rig.zoomTo(1.0);
     * ```
     *
     * @see {@link zoomToAt} for zoom with custom anchor point
     */
    zoomTo(targetZoom: number): void {
        const transformedTarget = this._zoomTo(
            targetZoom,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(transformedTarget);
    }

    /**
     * Zooms by a relative delta with the viewport center as the anchor point.
     *
     * @param delta - Zoom delta (added to current zoom level)
     *
     * @remarks
     * Unlike {@link zoomByAt}, the delta is NOT scaled by current zoom level.
     * This provides absolute delta changes, useful for programmatic zoom adjustments.
     *
     * The camera position remains unchanged, keeping the viewport center fixed in world space.
     *
     * @example
     * ```typescript
     * // Increase zoom by 0.5
     * rig.zoomBy(0.5);
     *
     * // Decrease zoom by 0.2
     * rig.zoomBy(-0.2);
     * ```
     *
     * @see {@link zoomByAt} for zoom with custom anchor point and scaling
     */
    zoomBy(delta: number): void {
        const transformedDelta = this._zoomBy(
            delta,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
    }

    /**
     * Zooms to a target level while keeping a world-space point stationary.
     *
     * @param targetZoom - Target zoom level to reach
     * @param at - Anchor point in world coordinates
     *
     * @remarks
     * Similar to {@link zoomToAt}, but accepts world-space coordinates instead of viewport coordinates.
     * Useful when you want to zoom to keep a specific world object or location centered,
     * rather than a screen position.
     *
     * The algorithm:
     * 1. Converts world anchor to viewport space (before zoom)
     * 2. Applies zoom transformation
     * 3. Converts world anchor to viewport space (after zoom)
     * 4. Calculates viewport movement and converts to world space
     * 5. Pans camera to compensate
     *
     * @example
     * ```typescript
     * // Zoom to 3x while keeping a specific world object in place
     * const objectWorldPos = { x: 1000, y: 500 };
     * rig.zoomToAtWorld(3.0, objectWorldPos);
     * ```
     *
     * @see {@link zoomToAt} for viewport-space variant
     */
    zoomToAtWorld(targetZoom: number, at: Point): void {
        let originalAnchorInViewPort =
            this._camera.convertFromWorld2ViewPort(at);
        const transformedTarget = this._zoomTo(
            targetZoom,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(transformedTarget);
        let anchorInViewPortAfterZoom =
            this._camera.convertFromWorld2ViewPort(at);
        const cameraPositionDiffInViewPort = PointCal.subVector(
            anchorInViewPortAfterZoom,
            originalAnchorInViewPort
        );
        const cameraPositionDiffInWorld = convertDeltaInViewPortToWorldSpace(
            cameraPositionDiffInViewPort,
            this._camera.zoomLevel,
            this._camera.rotation
        );
        const transformedCameraPositionDiff = this._panBy(
            cameraPositionDiffInWorld,
            this._camera,
            this._config
        );
        this._camera.setPosition(
            PointCal.addVector(
                this._camera.position,
                transformedCameraPositionDiff
            )
        );
    }

    /**
     * Zooms by a delta while keeping a world-space point stationary.
     *
     * @param delta - Zoom delta (added to current zoom level, not scaled)
     * @param at - Anchor point in world coordinates
     *
     * @remarks
     * World-space variant of {@link zoomByAt}. The delta is NOT scaled by current zoom level,
     * unlike the viewport-space version.
     *
     * Use this when programmatically zooming around specific world objects or coordinates.
     *
     * @example
     * ```typescript
     * // Zoom in by 0.5 while keeping a world landmark stationary
     * const landmarkPos = { x: 2000, y: 1500 };
     * rig.zoomByAtWorld(0.5, landmarkPos);
     * ```
     *
     * @see {@link zoomByAt} for viewport-space variant with scaled delta
     */
    zoomByAtWorld(delta: number, at: Point): void {
        let anchorInViewPortBeforeZoom =
            this._camera.convertFromWorld2ViewPort(at);
        const transformedDelta = this._zoomBy(
            delta,
            this._camera,
            this._config
        );
        this._camera.setZoomLevel(this._camera.zoomLevel + transformedDelta);
        let anchorInViewPortAfterZoom =
            this._camera.convertFromWorld2ViewPort(at);
        const diffInViewPort = PointCal.subVector(
            anchorInViewPortAfterZoom,
            anchorInViewPortBeforeZoom
        );
        const diffInWorld = convertDeltaInViewPortToWorldSpace(
            diffInViewPort,
            this._camera.zoomLevel,
            this._camera.rotation
        );
        const transformedDiff = this._panBy(
            diffInWorld,
            this._camera,
            this._config
        );
        this._camera.setPosition(
            PointCal.addVector(this._camera.position, transformedDiff)
        );
    }

    /**
     * Pans the camera by a delta in viewport coordinates.
     *
     * @param delta - Movement delta in viewport space (center-anchored, CSS pixels)
     *
     * @remarks
     * This is the most common pan method for user input (mouse drag, touch pan).
     * The delta is in screen/viewport coordinates and gets converted to world space
     * accounting for current camera rotation and zoom.
     *
     * Conversion formula:
     * 1. Rotate delta by camera rotation
     * 2. Scale by inverse zoom (1 / zoomLevel)
     * 3. Apply as world-space pan
     *
     * @example
     * ```typescript
     * // Pan camera when user drags mouse
     * canvas.addEventListener('mousemove', (e) => {
     *   if (isDragging) {
     *     const delta = { x: e.movementX, y: e.movementY };
     *     rig.panByViewPort(delta);
     *   }
     * });
     * ```
     *
     * @see {@link panByWorld} for world-space panning
     */
    panByViewPort(delta: Point): void {
        const diffInWorld = PointCal.multiplyVectorByScalar(
            PointCal.rotatePoint(delta, this._camera.rotation),
            1 / this._camera.zoomLevel
        );
        this.panByWorld(diffInWorld);
    }

    /**
     * Pans the camera by a delta in world coordinates.
     *
     * @param delta - Movement delta in world space
     *
     * @remarks
     * Use this for programmatic camera movement or when you already have world-space
     * coordinates (e.g., moving camera to follow a world object).
     *
     * The delta is passed through the pan handler which may apply:
     * - Boundary clamping
     * - Movement restrictions (restrictXTranslation, restrictYTranslation)
     * - Other constraints from {@link CameraRigConfig}
     *
     * @example
     * ```typescript
     * // Move camera 100 units right, 50 units up in world space
     * rig.panByWorld({ x: 100, y: -50 });
     *
     * // Follow a moving object
     * const objectMovement = { x: obj.dx, y: obj.dy };
     * rig.panByWorld(objectMovement);
     * ```
     *
     * @see {@link panByViewPort} for viewport-space panning
     */
    panByWorld(delta: Point): void {
        const transformedDelta = this._panBy(delta, this._camera, this._config);
        this._camera.setPosition(
            PointCal.addVector(this._camera.position, transformedDelta)
        );
    }

    /**
     * Pans the camera to an absolute position in world coordinates.
     *
     * @param target - Target camera position in world space
     *
     * @remarks
     * Sets the camera position directly (subject to constraints).
     * Unlike pan-by methods, this is an absolute positioning operation.
     *
     * The target is passed through the pan handler which may apply:
     * - Boundary clamping
     * - Position restrictions
     *
     * Use this for:
     * - "Go to location" features
     * - Centering camera on specific world coordinates
     * - Resetting camera to a known position
     *
     * @example
     * ```typescript
     * // Center camera on world origin
     * rig.panToWorld({ x: 0, y: 0 });
     *
     * // Go to specific landmark
     * const landmark = { x: 1000, y: 500 };
     * rig.panToWorld(landmark);
     * ```
     *
     * @see {@link panToViewPort} for viewport-space variant
     */
    panToWorld(target: Point): void {
        const transformedTarget = this._panTo(
            target,
            this._camera,
            this._config
        );
        this._camera.setPosition(transformedTarget);
    }

    /**
     * Pans the camera to position a viewport point at a specific location.
     *
     * @param target - Target position in viewport coordinates (center-anchored, CSS pixels)
     *
     * @remarks
     * Moves the camera so that the specified viewport point ends up at the viewport center.
     * This is less commonly used than world-space pan-to operations.
     *
     * The method converts the viewport target to world space, then uses {@link panToWorld}.
     *
     * @example
     * ```typescript
     * // Center the camera on what's currently at the top-left of viewport
     * rig.panToViewPort({ x: -400, y: -300 });
     * ```
     *
     * @see {@link panToWorld} for world-space variant (more commonly used)
     */
    panToViewPort(target: Point): void {
        const targetInWorld =
            this._camera.convertFromViewPort2WorldSpace(target);
        this.panToWorld(targetInWorld);
    }

    /**
     * Rotates the camera by a delta angle.
     *
     * @param delta - Rotation delta in radians (positive = counter-clockwise)
     *
     * @remarks
     * Applies a relative rotation to the camera. The delta is passed through the
     * rotation handler which may apply clamping or restrictions based on {@link CameraRigConfig}.
     *
     * Camera rotation affects:
     * - How viewport coordinates map to world coordinates
     * - The orientation of pan operations
     * - Visual rendering of the world
     *
     * @example
     * ```typescript
     * // Rotate 45 degrees counter-clockwise
     * rig.rotateBy(Math.PI / 4);
     *
     * // Rotate 90 degrees clockwise
     * rig.rotateBy(-Math.PI / 2);
     * ```
     *
     * @see {@link rotateTo} for absolute rotation
     */
    rotateBy(delta: number): void {
        const transformedDelta = this._rotateBy(
            delta,
            this._camera,
            this._config
        );
        this._camera.setRotation(this._camera.rotation + transformedDelta);
        if (!this._config.limitEntireViewPort) {
            return;
        }
        const pointAfterRotation = clampPointEntireViewPort(
            this._camera.position,
            this._camera.viewPortWidth,
            this._camera.viewPortHeight,
            this._camera.boundaries,
            this._camera.zoomLevel,
            this._camera.rotation
        );
        const transformedDestination = this._panTo(
            pointAfterRotation,
            this._camera,
            this._config
        );
        this._camera.setPosition(transformedDestination);
    }

    /**
     * Rotates the camera to an absolute angle.
     *
     * @param target - Target rotation in radians (0 = no rotation, positive = counter-clockwise)
     *
     * @remarks
     * Sets the camera rotation to a specific angle (subject to constraints).
     * The target is passed through the rotation handler which may apply clamping.
     *
     * Use this for:
     * - Resetting camera to north-up orientation (0 radians)
     * - Snapping to cardinal directions
     * - Setting rotation from UI controls
     *
     * @example
     * ```typescript
     * // Reset to north-up
     * rig.rotateTo(0);
     *
     * // Rotate to 90 degrees
     * rig.rotateTo(Math.PI / 2);
     * ```
     *
     * @see {@link rotateBy} for relative rotation
     */
    rotateTo(target: number): void {
        const transformedTarget = this._rotateTo(
            target,
            this._camera,
            this._config
        );
        this._camera.setRotation(transformedTarget);
        if (!this._config.limitEntireViewPort) {
            return;
        }
        const pointAfterRotation = clampPointEntireViewPort(
            this._camera.position,
            this._camera.viewPortWidth,
            this._camera.viewPortHeight,
            this._camera.boundaries,
            this._camera.zoomLevel,
            this._camera.rotation
        );
        const transformedDestination = this._panTo(
            pointAfterRotation,
            this._camera,
            this._config
        );
        this._camera.setPosition(transformedDestination);
    }

    /**
     * Sets whether the entire viewport must remain within boundaries.
     *
     * @remarks
     * When true, pan boundaries ensure the entire viewport stays within configured limits.
     * When false, only the camera center point is constrained.
     *
     * This is a convenience setter for {@link CameraRigConfig}.limitEntireViewPort.
     */
    set limitEntireViewPort(limit: boolean) {
        this._config.limitEntireViewPort = limit;
    }

    /**
     * Gets whether the entire viewport must remain within boundaries.
     *
     * @returns True if entire viewport is constrained, false if only center is constrained
     */
    get limitEntireViewPort(): boolean {
        return this._config.limitEntireViewPort;
    }

    /**
     * Gets the underlying observable camera instance.
     *
     * @returns The camera being controlled by this rig
     */
    get camera(): ObservableBoardCamera {
        return this._camera;
    }

    /**
     * Sets the underlying camera instance.
     *
     * @param camera - New camera to control
     *
     * @remarks
     * Use this to swap cameras at runtime, though this is uncommon.
     * Usually you create a new rig instead.
     */
    set camera(camera: ObservableBoardCamera) {
        this._camera = camera;
    }

    /**
     * Gets the current camera rig configuration.
     *
     * @returns Current configuration object
     *
     * @remarks
     * Returns a reference to the internal config. Modifications will affect rig behavior.
     * For safer updates, use {@link configure} instead.
     */
    get config(): CameraRigConfig {
        return this._config;
    }

    /**
     * Sets the camera rig configuration.
     *
     * @param config - New configuration object
     *
     * @remarks
     * Creates a shallow copy of the provided config.
     * For partial updates, use {@link configure} instead.
     */
    set config(config: CameraRigConfig) {
        this._config = { ...config };
    }

    /**
     * Updates camera rig configuration with partial settings.
     *
     * @param config - Partial configuration to merge with current config
     *
     * @remarks
     * This is the recommended way to update configuration at runtime.
     * Only provided properties are updated; others remain unchanged.
     *
     * @example
     * ```typescript
     * // Enable zoom restrictions without changing other settings
     * rig.configure({
     *   restrictZoom: true,
     *   zoomLevelLimits: { min: 0.5, max: 5.0 }
     * });
     *
     * // Disable position clamping
     * rig.configure({ clampTranslation: false });
     * ```
     */
    configure(config: Partial<CameraRigConfig>) {
        this._config = { ...this._config, ...config };
    }

    /**
     * Cleans up resources used by the camera rig.
     *
     * @remarks
     * Currently a no-op as DefaultCameraRig has no resources to clean up.
     * Implements {@link BaseContext} interface for consistency with other systems.
     */
    cleanup(): void {}

    /**
     * Sets up the camera rig.
     *
     * @remarks
     * Currently a no-op as DefaultCameraRig requires no setup.
     * Implements {@link BaseContext} interface for consistency with other systems.
     */
    setup(): void {}

    /**
     * Updates the camera rig state.
     *
     * @remarks
     * Currently a no-op as DefaultCameraRig has no per-frame update logic.
     * Implements {@link BaseContext} interface for consistency with other systems.
     *
     * In stateful rig implementations, this might handle:
     * - Animation interpolation
     * - Momentum/inertia
     * - Smooth camera following
     */
    update(): void {}
}

/**
 * Creates a camera rig with sensible default configuration.
 *
 * @param camera - Observable camera instance to control
 * @returns Configured camera rig ready for use
 *
 * @remarks
 * This factory function creates a {@link DefaultCameraRig} with a balanced default configuration:
 *
 * **Enabled by default:**
 * - `limitEntireViewPort: true` - Entire viewport stays within boundaries
 * - `clampTranslation: true` - Position is clamped to boundaries
 * - `clampZoom: true` - Zoom is clamped to limits
 *
 * **Disabled by default:**
 * - All movement restrictions (`restrictXTranslation`, `restrictYTranslation`, etc.)
 * - Zoom restrictions (`restrictZoom`)
 * - Relative translation restrictions
 *
 * This configuration allows free camera movement with boundary enforcement,
 * suitable for most infinite canvas applications.
 *
 * @example
 * ```typescript
 * const camera = new DefaultBoardCamera(1920, 1080);
 * const rig = createDefaultCameraRig(camera);
 *
 * // Ready to use with sensible defaults
 * rig.configure({
 *   boundaries: {
 *     min: { x: -1000, y: -1000 },
 *     max: { x: 1000, y: 1000 }
 *   }
 * });
 *
 * rig.panByViewPort({ x: 100, y: 50 });
 * rig.zoomByAt(0.1, mousePosition);
 * ```
 *
 * @category Camera Rig
 * @see {@link DefaultCameraRig} for the implementation
 * @see {@link CameraRigConfig} for all available configuration options
 */
export function createDefaultCameraRig(
    camera: ObservableBoardCamera
): CameraRig {
    return new DefaultCameraRig(
        {
            limitEntireViewPort: true,
            restrictRelativeXTranslation: false,
            restrictRelativeYTranslation: false,
            restrictXTranslation: false,
            restrictYTranslation: false,
            restrictZoom: false,
            clampTranslation: true,
            clampZoom: true,
        },
        camera
    );
}
