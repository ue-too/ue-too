import { Point, PointCal } from '@ue-too/math';

import { SubscriptionOptions } from '../utils/observable';
import BaseCamera, { CameraOptions } from './base';
import { ObservableBoardCamera } from './interface';
import { CameraUpdatePublisher, UnSubscribe } from './update-publisher';
import { CameraEventMap, CameraState } from './update-publisher';
import {
    convert2ViewPortSpaceAnchorAtCenter,
    convert2WorldSpaceAnchorAtCenter,
} from './utils/coordinate-conversion';
import { TransformationMatrix } from './utils/matrix';
import { Boundaries } from './utils/position';
import { RotationLimits } from './utils/rotation';
import { ZoomLevelLimits } from './utils/zoom';

/** Default viewport width in CSS pixels */
export const DEFAULT_BOARD_CAMERA_VIEWPORT_WIDTH = 1000;

/** Default viewport height in CSS pixels */
export const DEFAULT_BOARD_CAMERA_VIEWPORT_HEIGHT = 1000;

/** Default zoom level constraints (0.1x to 10x) */
export const DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES: ZoomLevelLimits = {
    min: 0.1,
    max: 10,
};

/** Default position boundaries (±10000 on both axes) */
export const DEFAULT_BOARD_CAMERA_BOUNDARIES: Boundaries = {
    min: { x: -10000, y: -10000 },
    max: { x: 10000, y: 10000 },
};

/** Default rotation boundaries (unrestricted) */
export const DEFAULT_BOARD_CAMERA_ROTATION_BOUNDARIES:
    | RotationLimits
    | undefined = undefined;

export const DEFAULT_BOARD_CAMERA_OPTIONS: CameraOptions = {
    viewPortWidth: DEFAULT_BOARD_CAMERA_VIEWPORT_WIDTH,
    viewPortHeight: DEFAULT_BOARD_CAMERA_VIEWPORT_HEIGHT,
    position: { x: 0, y: 0 },
    rotation: 0,
    zoomLevel: 1,
    boundaries: DEFAULT_BOARD_CAMERA_BOUNDARIES,
    zoomLevelBoundaries: DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES,
    rotationBoundaries: DEFAULT_BOARD_CAMERA_ROTATION_BOUNDARIES,
};

/**
 * Observable camera implementation that extends {@link BaseCamera} with event notification.
 * This is the recommended camera class for most applications.
 *
 * @remarks
 * DefaultBoardCamera wraps {@link BaseCamera} and adds an event system via {@link CameraUpdatePublisher}.
 * All camera state changes (pan, zoom, rotate) trigger corresponding events that observers can subscribe to.
 *
 * Use this class when you need to:
 * - React to camera changes in your UI or game logic
 * - Synchronize multiple systems with camera state
 * - Implement camera-dependent features (minimap, LOD, culling)
 *
 * For a non-observable camera without event overhead, use {@link BaseCamera} directly.
 *
 * @example
 * ```typescript
 * const camera = new DefaultBoardCamera(1920, 1080);
 *
 * // Subscribe to camera events
 * camera.on('zoom', (event, state) => {
 *   console.log(`Zoomed by ${event.deltaZoomAmount}`);
 *   console.log(`New zoom level: ${state.zoomLevel}`);
 * });
 *
 * camera.on('pan', (event, state) => {
 *   console.log(`Panned by (${event.diff.x}, ${event.diff.y})`);
 * });
 *
 * // Camera updates trigger events
 * camera.setZoomLevel(2.0);
 * camera.setPosition({ x: 100, y: 200 });
 * ```
 *
 * @category Camera
 * @see {@link BaseCamera} for non-observable camera
 * @see {@link ObservableBoardCamera} for the interface definition
 */
export default class DefaultBoardCamera implements ObservableBoardCamera {
    private _baseCamera: BaseCamera;
    private _observer: CameraUpdatePublisher;
    /**
     * Creates a new observable camera with event notification capabilities.
     *
     * @param viewPortWidth - Width of the viewport in CSS pixels (default: 1000)
     * @param viewPortHeight - Height of the viewport in CSS pixels (default: 1000)
     * @param position - Initial camera position in world coordinates (default: {x: 0, y: 0})
     * @param rotation - Initial rotation in radians (default: 0)
     * @param zoomLevel - Initial zoom level (default: 1.0)
     * @param boundaries - Position constraints (default: ±10000 on both axes)
     * @param zoomLevelBoundaries - Zoom constraints (default: 0.1 to 10)
     * @param rotationBoundaries - Optional rotation constraints (default: unrestricted)
     *
     * @example
     * ```typescript
     * // Camera with default settings
     * const camera1 = new DefaultBoardCamera();
     *
     * // Camera with custom viewport
     * const camera2 = new DefaultBoardCamera(1920, 1080);
     *
     * // Camera with all options
     * const camera3 = new DefaultBoardCamera(
     *   1920, 1080,
     *   { x: 0, y: 0 },
     *   0,
     *   1.0,
     *   { min: { x: -5000, y: -5000 }, max: { x: 5000, y: 5000 } },
     *   { min: 0.5, max: 4 },
     *   { start: 0, end: Math.PI * 2 }
     * );
     * ```
     */
    constructor(options: CameraOptions = DEFAULT_BOARD_CAMERA_OPTIONS) {
        const {
            viewPortWidth = DEFAULT_BOARD_CAMERA_VIEWPORT_WIDTH,
            viewPortHeight = DEFAULT_BOARD_CAMERA_VIEWPORT_HEIGHT,
            position = { x: 0, y: 0 },
            rotation,
            zoomLevel = 1,
            boundaries = DEFAULT_BOARD_CAMERA_BOUNDARIES,
            zoomLevelBoundaries = DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES,
            rotationBoundaries = DEFAULT_BOARD_CAMERA_ROTATION_BOUNDARIES,
        } = options;

        this._baseCamera = new BaseCamera({
            viewPortWidth,
            viewPortHeight,
            position,
            rotation,
            zoomLevel,
            boundaries,
            zoomLevelBoundaries,
            rotationBoundaries,
        });
        this._observer = new CameraUpdatePublisher();
    }

    /**
     * @description The boundaries of the camera in the world coordinate system.
     *
     * @category Camera
     */
    get boundaries(): Boundaries | undefined {
        return this._baseCamera.boundaries;
    }

    set boundaries(boundaries: Boundaries | undefined) {
        this._baseCamera.boundaries = boundaries;
    }

    /**
     * @description The width of the viewport. (The width of the canvas in css pixels)
     *
     * @category Camera
     */
    get viewPortWidth(): number {
        return this._baseCamera.viewPortWidth;
    }

    set viewPortWidth(width: number) {
        this._baseCamera.viewPortWidth = width;
    }

    /**
     * @description The height of the viewport. (The height of the canvas in css pixels)
     *
     * @category Camera
     */
    get viewPortHeight(): number {
        return this._baseCamera.viewPortHeight;
    }

    set viewPortHeight(height: number) {
        this._baseCamera.viewPortHeight = height;
    }

    /**
     * @description The position of the camera in the world coordinate system.
     *
     * @category Camera
     */
    get position(): Point {
        return this._baseCamera.position;
    }

    /**
     * Sets the camera position and notifies observers if successful.
     *
     * @param destination - Target position in world coordinates
     * @returns True if position was updated, false if rejected by boundaries or negligible change
     *
     * @remarks
     * If the position changes, a 'pan' event is triggered with the position delta and new camera state.
     * All 'pan' and 'all' event subscribers will be notified.
     *
     * @example
     * ```typescript
     * camera.on('pan', (event, state) => {
     *   console.log(`Camera moved by (${event.diff.x}, ${event.diff.y})`);
     * });
     *
     * camera.setPosition({ x: 100, y: 200 }); // Triggers pan event
     * ```
     */
    setPosition(destination: Point) {
        const currentPosition = { ...this._baseCamera.position };
        if (!this._baseCamera.setPosition(destination)) {
            return false;
        }
        this._observer.notifyPan(
            { diff: PointCal.subVector(destination, currentPosition) },
            {
                position: this._baseCamera.position,
                rotation: this._baseCamera.rotation,
                zoomLevel: this._baseCamera.zoomLevel,
            }
        );
        return true;
    }

    /**
     * @description The zoom level of the camera.
     *
     * @category Camera
     */
    get zoomLevel(): number {
        return this._baseCamera.zoomLevel;
    }

    /**
     * @description The boundaries of the zoom level of the camera.
     *
     * @category Camera
     */
    get zoomBoundaries(): ZoomLevelLimits | undefined {
        return this._baseCamera.zoomBoundaries;
    }

    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined) {
        this._baseCamera.zoomBoundaries = zoomBoundaries;
    }

    setMaxZoomLevel(maxZoomLevel: number) {
        const currentZoomLevel = this._baseCamera.zoomLevel;
        if (!this._baseCamera.setMaxZoomLevel(maxZoomLevel)) {
            return false;
        }
        // this._observer.notifyZoom(
        //     { deltaZoomAmount: maxZoomLevel - currentZoomLevel },
        //     {
        //         position: this._baseCamera.position,
        //         rotation: this._baseCamera.rotation,
        //         zoomLevel: this._baseCamera.zoomLevel,
        //     }
        // );
        return true;
    }

    setMinZoomLevel(minZoomLevel: number) {
        if (!this._baseCamera.setMinZoomLevel(minZoomLevel)) {
            return false;
        }
        return true;
    }

    /**
     * Sets the camera zoom level and notifies observers if successful.
     *
     * @param zoomLevel - Target zoom level (1.0 = 100%, 2.0 = 200%, etc.)
     * @returns True if zoom was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * If the zoom changes, a 'zoom' event is triggered with the zoom delta and new camera state.
     * All 'zoom' and 'all' event subscribers will be notified.
     *
     * @example
     * ```typescript
     * camera.on('zoom', (event, state) => {
     *   console.log(`Zoom changed by ${event.deltaZoomAmount}`);
     *   console.log(`New zoom: ${state.zoomLevel}`);
     * });
     *
     * camera.setZoomLevel(2.0); // Triggers zoom event
     * ```
     */
    setZoomLevel(zoomLevel: number) {
        const currentZoomLevel = this._baseCamera.zoomLevel;
        if (!this._baseCamera.setZoomLevel(zoomLevel)) {
            return false;
        }
        this._observer.notifyZoom(
            { deltaZoomAmount: this._baseCamera.zoomLevel - currentZoomLevel },
            {
                position: this._baseCamera.position,
                rotation: this._baseCamera.rotation,
                zoomLevel: this._baseCamera.zoomLevel,
            }
        );
        return true;
    }

    /**
     * Gets the current camera rotation in radians.
     *
     * @returns Current rotation angle (0 to 2π)
     */
    get rotation(): number {
        return this._baseCamera.rotation;
    }

    /**
     * @description The boundaries of the rotation of the camera.
     *
     * @category Camera
     */
    get rotationBoundaries(): RotationLimits | undefined {
        return this._baseCamera.rotationBoundaries;
    }

    set rotationBoundaries(rotationBoundaries: RotationLimits | undefined) {
        this._baseCamera.rotationBoundaries = rotationBoundaries;
    }

    /**
     * @description The order of the transformation is as follows:
     * 1. Scale (scale the context using the device pixel ratio)
     * 2. Translation (move the origin of the context to the center of the canvas)
     * 3. Rotation (rotate the context negatively the rotation of the camera)
     * 4. Zoom (scale the context using the zoom level of the camera)
     * 5. Translation (move the origin of the context to the position of the camera in the context coordinate system)
     *
     * @param devicePixelRatio The device pixel ratio of the canvas
     * @param alignCoorindate Whether to align the coordinate system to the camera's position
     * @returns The transformation matrix
     */
    getTransform(
        devicePixelRatio: number = 1,
        alignCoorindate: boolean = true
    ): TransformationMatrix {
        return this._baseCamera.getTransform(devicePixelRatio, alignCoorindate);
    }

    /**
     * Sets the camera rotation and notifies observers if successful.
     *
     * @param rotation - Target rotation in radians
     * @returns True if rotation was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * If the rotation changes, a 'rotate' event is triggered with the rotation delta and new camera state.
     * All 'rotate' and 'all' event subscribers will be notified.
     * Rotation is automatically normalized to 0-2π range.
     *
     * @example
     * ```typescript
     * camera.on('rotate', (event, state) => {
     *   console.log(`Camera rotated by ${event.deltaRotation} radians`);
     * });
     *
     * camera.setRotation(Math.PI / 4); // Triggers rotate event
     * ```
     */
    setRotation(rotation: number) {
        const currentRotation = this._baseCamera.rotation;
        if (!this._baseCamera.setRotation(rotation)) {
            return false;
        }
        this._observer.notifyRotate(
            { deltaRotation: rotation - currentRotation },
            {
                position: this._baseCamera.position,
                rotation: this._baseCamera.rotation,
                zoomLevel: this._baseCamera.zoomLevel,
            }
        );
        return true;
    }

    /**
     * @description The origin of the camera in the window coordinate system.
     * @deprecated
     *
     * @param centerInWindow The center of the camera in the window coordinate system.
     * @returns The origin of the camera in the window coordinate system.
     */
    getCameraOriginInWindow(centerInWindow: Point): Point {
        return centerInWindow;
    }

    /**
     * @description Converts a point from the viewport coordinate system to the world coordinate system.
     *
     * @param point The point in the viewport coordinate system.
     * @returns The point in the world coordinate system.
     */
    convertFromViewPort2WorldSpace(point: Point): Point {
        return convert2WorldSpaceAnchorAtCenter(
            point,
            this._baseCamera.position,
            this._baseCamera.zoomLevel,
            this._baseCamera.rotation
        );
    }

    /**
     * @description Converts a point from the world coordinate system to the viewport coordinate system.
     *
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     */
    convertFromWorld2ViewPort(point: Point): Point {
        return convert2ViewPortSpaceAnchorAtCenter(
            point,
            this._baseCamera.position,
            this._baseCamera.zoomLevel,
            this._baseCamera.rotation
        );
    }

    /**
     * @description Inverts a point from the world coordinate system to the viewport coordinate system.
     *
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     */
    invertFromWorldSpace2ViewPort(point: Point): Point {
        let cameraFrameCenter = {
            x: this._baseCamera.viewPortWidth / 2,
            y: this._baseCamera.viewPortHeight / 2,
        };
        let delta2Point = PointCal.subVector(point, this._baseCamera.position);
        delta2Point = PointCal.rotatePoint(
            delta2Point,
            -this._baseCamera.rotation
        );
        delta2Point = PointCal.multiplyVectorByScalar(
            delta2Point,
            this._baseCamera.zoomLevel
        );
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    setHorizontalBoundaries(min: number, max: number) {
        if (min > max) {
            let temp = max;
            max = min;
            min = temp;
        }
        if (this._baseCamera.boundaries == undefined) {
            this._baseCamera.boundaries = { min: undefined, max: undefined };
        }
        if (this._baseCamera.boundaries.min == undefined) {
            this._baseCamera.boundaries.min = { x: undefined, y: undefined };
        }
        if (this._baseCamera.boundaries.max == undefined) {
            this._baseCamera.boundaries.max = { x: undefined, y: undefined };
        }
        this._baseCamera.boundaries.min.x = min;
        this._baseCamera.boundaries.max.x = max;
        //NOTE leave for future optimization when setting the boundaries if the camera lies outside the boundaries clamp the position of the camera
        // if(!this.withinBoundaries(this.position)){
        //     this.position = this.clampPoint(this.position);
        // }
    }

    setVerticalBoundaries(min: number, max: number) {
        if (min > max) {
            let temp = max;
            max = min;
            min = temp;
        }
        if (this._baseCamera.boundaries == undefined) {
            this._baseCamera.boundaries = { min: undefined, max: undefined };
        }
        if (this._baseCamera.boundaries.min == undefined) {
            this._baseCamera.boundaries.min = { x: undefined, y: undefined };
        }
        if (this._baseCamera.boundaries.max == undefined) {
            this._baseCamera.boundaries.max = { x: undefined, y: undefined };
        }
        this._baseCamera.boundaries.min.y = min;
        this._baseCamera.boundaries.max.y = max;
    }

    /**
     * Subscribes to camera events with optional AbortController for cancellation.
     *
     * @typeParam K - The event type key from CameraEventMap
     * @param eventName - Event type to listen for: 'pan', 'zoom', 'rotate', or 'all'
     * @param callback - Function called when event occurs, receives event data and camera state
     * @param options - Optional subscription configuration including AbortController signal
     * @returns Function to unsubscribe from this event
     *
     * @remarks
     * Available events:
     * - 'pan': Triggered when camera position changes
     * - 'zoom': Triggered when zoom level changes
     * - 'rotate': Triggered when rotation changes
     * - 'all': Triggered for any camera change (pan, zoom, or rotate)
     *
     * Use the AbortController pattern to manage multiple subscriptions:
     *
     * @example
     * ```typescript
     * // Basic subscription
     * const unsubscribe = camera.on('pan', (event, state) => {
     *   console.log(`Panned by (${event.diff.x}, ${event.diff.y})`);
     *   console.log(`New position: (${state.position.x}, ${state.position.y})`);
     * });
     *
     * // Later: unsubscribe
     * unsubscribe();
     *
     * // Subscribe to all events
     * camera.on('all', (event, state) => {
     *   if (event.type === 'pan') {
     *     console.log('Pan event:', event.diff);
     *   } else if (event.type === 'zoom') {
     *     console.log('Zoom event:', event.deltaZoomAmount);
     *   } else if (event.type === 'rotate') {
     *     console.log('Rotate event:', event.deltaRotation);
     *   }
     * });
     *
     * // Using AbortController for batch unsubscribe
     * const controller = new AbortController();
     * camera.on('pan', handlePan, { signal: controller.signal });
     * camera.on('zoom', handleZoom, { signal: controller.signal });
     * camera.on('rotate', handleRotate, { signal: controller.signal });
     *
     * // Unsubscribe all at once
     * controller.abort();
     * ```
     */
    on<K extends keyof CameraEventMap>(
        eventName: K,
        callback: (event: CameraEventMap[K], cameraState: CameraState) => void,
        options?: SubscriptionOptions
    ): UnSubscribe {
        return this._observer.on(eventName, callback, options);
    }

    getTRS(
        devicePixelRatio: number = 1,
        alignCoordinateSystem: boolean = true
    ): {
        scale: { x: number; y: number };
        rotation: number;
        translation: { x: number; y: number };
        cached: boolean;
    } {
        return this._baseCamera.getTRS(devicePixelRatio, alignCoordinateSystem);
    }

    setUsingTransformationMatrix(
        transformationMatrix: TransformationMatrix,
        devicePixelRatio: number = 1
    ) {
        this._baseCamera.setUsingTransformationMatrix(
            transformationMatrix,
            devicePixelRatio
        );
    }

    viewPortInWorldSpace(alignCoordinate: boolean = true): {
        top: { left: Point; right: Point };
        bottom: { left: Point; right: Point };
    } {
        return this._baseCamera.viewPortInWorldSpace(alignCoordinate);
    }

    viewPortAABB(alignCoordinate: boolean = true): { min: Point; max: Point } {
        return this._baseCamera.viewPortAABB(alignCoordinate);
    }
}
