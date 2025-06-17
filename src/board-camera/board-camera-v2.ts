import { Point } from 'src/utils/misc';
import { Boundaries, TransformationMatrix } from 'src/board-camera';
import { CameraUpdatePublisher, UnSubscribe } from 'src/board-camera/camera-update-publisher';
import { ZoomLevelLimits } from 'src/board-camera/utils/zoom';
import { RotationLimits } from 'src/board-camera/utils/rotation';
import { convert2WorldSpaceAnchorAtCenter, convert2ViewPortSpaceAnchorAtCenter } from 'src/board-camera/utils/coordinate-conversion';
import { PointCal } from 'point2point';
import { CameraEventMap, CameraState } from 'src/board-camera/camera-update-publisher';
import { ObservableBoardCamera } from 'src/board-camera/interface';
import BaseCamera from 'src/board-camera/base-camera';
import { SubscriptionOptions } from 'src/utils/observable';


export const DEFAULT_BOARD_CAMERA_VIEWPORT_WIDTH = 1000;
export const DEFAULT_BOARD_CAMERA_VIEWPORT_HEIGHT = 1000;

export const DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES: ZoomLevelLimits = {min: 0.1, max: 10};
export const DEFAULT_BOARD_CAMERA_BOUNDARIES: Boundaries = {min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}};
export const DEFAULT_BOARD_CAMERA_ROTATION_BOUNDARIES: RotationLimits = undefined;

/**
 * @description The default board camera. This is basically the same as the {@link BaseCamera} class.
 * But it's observable.
 * 
 * @category Camera
 */
export default class DefaultBoardCamera implements ObservableBoardCamera {

    private _baseCamera: BaseCamera;
    private _observer: CameraUpdatePublisher;
    /**
     * @param position The position of the camera in the world coordinate system
     * @param rotation The rotation of the camera in the world coordinate system
     * @param zoomLevel The zoom level of the camera
     * @param viewPortWidth The width of the viewport. (The width of the canvas in css pixels)
     * @param viewPortHeight The height of the viewport. (The height of the canvas in css pixels)
     * @param boundaries The boundaries of the camera in the world coordinate system
     * @param zoomLevelBoundaries The boundaries of the zoom level of the camera
     * @param rotationBoundaries The boundaries of the rotation of the camera
     */
    constructor(viewPortWidth: number = DEFAULT_BOARD_CAMERA_VIEWPORT_WIDTH, viewPortHeight: number = DEFAULT_BOARD_CAMERA_VIEWPORT_HEIGHT, position: Point = {x: 0, y: 0}, rotation: number = 0, zoomLevel: number = 1, boundaries: Boundaries = DEFAULT_BOARD_CAMERA_BOUNDARIES, zoomLevelBoundaries: ZoomLevelLimits = DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES, rotationBoundaries: RotationLimits = DEFAULT_BOARD_CAMERA_ROTATION_BOUNDARIES){
        this._baseCamera = new BaseCamera(viewPortWidth, viewPortHeight, position, rotation, zoomLevel, boundaries, zoomLevelBoundaries, rotationBoundaries);
        this._observer = new CameraUpdatePublisher();
    }

    /**
     * @description The boundaries of the camera in the world coordinate system.
     * 
     * @category Camera
     */
    get boundaries(): Boundaries | undefined{
        return this._baseCamera.boundaries;
    }

    set boundaries(boundaries: Boundaries | undefined){
        this._baseCamera.boundaries = boundaries;
    }

    /**
     * @description The width of the viewport. (The width of the canvas in css pixels)
     * 
     * @category Camera
     */
    get viewPortWidth(): number{
        return this._baseCamera.viewPortWidth;
    }

    set viewPortWidth(width: number){
        this._baseCamera.viewPortWidth = width;
    }

    /**
     * @description The height of the viewport. (The height of the canvas in css pixels)
     * 
     * @category Camera
     */
    get viewPortHeight(): number{
        return this._baseCamera.viewPortHeight;
    }

    set viewPortHeight(height: number){
        this._baseCamera.viewPortHeight = height;
    }

    /**
     * @description The position of the camera in the world coordinate system.
     * 
     * @category Camera
     */
    get position(): Point{
        return this._baseCamera.position;
    }

    /**
     * @description This function is used to set the position of the camera.
     * @param destination The destination point of the camera.
     * @returns Whether the position is set successfully.
     * 
     * @description This function has a guard that checks if the destination point is within the boundaries of the camera.
     * If the destination point is not within the boundaries, the function will return false and the position will not be updated.
     * If the destination point is within the boundaries, the function will return true and the position will be updated.
     */
    setPosition(destination: Point){
        const currentPosition = {...this._baseCamera.position};
        if(!this._baseCamera.setPosition(destination)){
            return false;
        }
        this._observer.notifyPan({diff: PointCal.subVector(destination, currentPosition)}, {position: this._baseCamera.position, rotation: this._baseCamera.rotation, zoomLevel: this._baseCamera.zoomLevel});
        return true;
    }

    /**
     * @description The zoom level of the camera.
     * 
     * @category Camera
     */
    get zoomLevel(): number{
        return this._baseCamera.zoomLevel;
    }

    /**
     * @description The boundaries of the zoom level of the camera.
     * 
     * @category Camera
     */
    get zoomBoundaries(): ZoomLevelLimits | undefined{
        return this._baseCamera.zoomBoundaries;
    }

    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined){
        this._baseCamera.zoomBoundaries = zoomBoundaries;
    }

    setMaxZoomLevel(maxZoomLevel: number){
        const currentZoomLevel = this._baseCamera.zoomLevel;
        if(!this._baseCamera.setMaxZoomLevel(maxZoomLevel)){
            return false;
        }
        this._observer.notifyZoom({deltaZoomAmount: maxZoomLevel - currentZoomLevel}, {position: this._baseCamera.position, rotation: this._baseCamera.rotation, zoomLevel: this._baseCamera.zoomLevel});
        return true;
    }

    setMinZoomLevel(minZoomLevel: number){
        if(!this._baseCamera.setMinZoomLevel(minZoomLevel)){
            return false;
        }
        return true;
    }

    setZoomLevel(zoomLevel: number){
        if(!this._baseCamera.setZoomLevel(zoomLevel)){
            return false;
        }
        return true;
    }

    /**
     * @description The rotation of the camera in the world coordinate system.
     * 
     * @category Camera
     */
    get rotation(): number{
        return this._baseCamera.rotation;
    }

    /**
     * @description The boundaries of the rotation of the camera.
     * 
     * @category Camera
     */
    get rotationBoundaries(): RotationLimits | undefined{
        return this._baseCamera.rotationBoundaries;
    }

    set rotationBoundaries(rotationBoundaries: RotationLimits | undefined){
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
    getTransform(devicePixelRatio: number, alignCoorindate: boolean): TransformationMatrix {
        return this._baseCamera.getTransform(devicePixelRatio, alignCoorindate);
    }

    /**
     * @description This function is used to set the rotation of the camera.
     * @param rotation The rotation of the camera in the world coordinate system.
     * @returns Whether the rotation is set successfully.
     */
    setRotation(rotation: number){
        const currentRotation = this._baseCamera.rotation;
        if(!this._baseCamera.setRotation(rotation)){
            return false;
        }
        this._observer.notifyRotate({deltaRotation: rotation - currentRotation}, {position: this._baseCamera.position, rotation: this._baseCamera.rotation, zoomLevel: this._baseCamera.zoomLevel});
        return true;
    }

    /**
     * @description The origin of the camera in the window coordinate system.
     * @deprecated
     * 
     * @param centerInWindow The center of the camera in the window coordinate system.
     * @returns The origin of the camera in the window coordinate system.
     */
    getCameraOriginInWindow(centerInWindow: Point): Point{
        return centerInWindow;
    }

    /**
     * @description Converts a point from the viewport coordinate system to the world coordinate system.
     * 
     * @param point The point in the viewport coordinate system.
     * @returns The point in the world coordinate system.
     */
    convertFromViewPort2WorldSpace(point: Point): Point{
        return convert2WorldSpaceAnchorAtCenter(point, this._baseCamera.position, this._baseCamera.zoomLevel, this._baseCamera.rotation);
    }

    /**
     * @description Converts a point from the world coordinate system to the viewport coordinate system.
     * 
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     */
    convertFromWorld2ViewPort(point: Point): Point{
        return convert2ViewPortSpaceAnchorAtCenter(point, this._baseCamera.position, this._baseCamera.zoomLevel, this._baseCamera.rotation);
    }

    /**
     * @description Inverts a point from the world coordinate system to the viewport coordinate system.
     * 
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     */
    invertFromWorldSpace2ViewPort(point: Point): Point{
        let cameraFrameCenter = {x: this._baseCamera.viewPortWidth / 2, y: this._baseCamera.viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, this._baseCamera.position);
        delta2Point = PointCal.rotatePoint(delta2Point, -this._baseCamera.rotation);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, this._baseCamera.zoomLevel);
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    setHorizontalBoundaries(min: number, max: number){
        if (min > max){
            let temp = max;
            max = min;
            min = temp;
        }
        if(this._baseCamera.boundaries == undefined){
            this._baseCamera.boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this._baseCamera.boundaries.min.x = min;
        this._baseCamera.boundaries.max.x = max;
        //NOTE leave for future optimization when setting the boundaries if the camera lies outside the boundaries clamp the position of the camera
        // if(!this.withinBoundaries(this.position)){
        //     this.position = this.clampPoint(this.position);
        // }
    }

    setVerticalBoundaries(min: number, max: number){
        if (min > max){
            let temp = max;
            max = min;
            min = temp;
        }
        if(this._baseCamera.boundaries == undefined){
            this._baseCamera.boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this._baseCamera.boundaries.min.y = min;
        this._baseCamera.boundaries.max.y = max;
    }

    /**
     * @description This function is used to subscribe to the camera events.
     * @param eventName The name of the event to subscribe to.
     * @param callback The callback function to be called when the event is triggered.
     * @param options The options for the subscription.
     * @returns The unsubscribe function.
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void, options?: SubscriptionOptions): UnSubscribe {
        return this._observer.on(eventName, callback, options);
    }

    getTRS(devicePixelRatio: number, alignCoordinateSystem: boolean): {scale: {x: number, y: number}, rotation: number, translation: {x: number, y: number}} {
        return this._baseCamera.getTRS(devicePixelRatio, alignCoordinateSystem);
    }
}
