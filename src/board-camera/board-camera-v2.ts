import { Point } from 'src/util/misc';
import { Boundaries } from 'src/board-camera';
import { CameraUpdatePublisher, UnSubscribe } from 'src/camera-update-publisher';
import { withinBoundaries } from 'src/board-camera/utils/position';
import { ZoomLevelLimits } from 'src/board-camera/utils/zoom';
import { RotationLimits } from 'src/board-camera/utils/rotation';
import { convert2WorldSpaceAnchorAtCenter, convert2ViewPortSpaceAnchorAtCenter } from 'src/board-camera/utils/coordinate-conversion';
import { PointCal } from 'point2point';
import { CameraEventMap, CameraState } from 'src/camera-update-publisher';
import { ObservableBoardCamera } from 'src/board-camera/interface';
import BaseCamera from 'src/board-camera/base-camera';
import { SubscriptionOptions } from 'src/util/observable';
export default class DefaultBoardCamera implements ObservableBoardCamera {

    private _baseCamera: BaseCamera;
    private _observer: CameraUpdatePublisher;
    /**
     * @param position The position of the camera in the world coordinate system
     * @param rotation The rotation of the camera in the world coordinate system
     * @param zoomLevel The zoom level of the camera
     * @param viewPortWidth The width of the viewport. (The width of the canvas in css pixels)
     * @param viewPortHeight The height of the viewport. (The height of the canvas in css pixels)
     * @param observer The observer of the camera
     * @param boundaries The boundaries of the camera in the world coordinate system
     * @param zoomLevelBoundaries The boundaries of the zoom level of the camera
     * @param rotationBoundaries The boundaries of the rotation of the camera
     */
    constructor(viewPortWidth: number = 1000, viewPortHeight: number = 1000, position: Point = {x: 0, y: 0}, rotation: number = 0, zoomLevel: number = 1, boundaries: Boundaries = {min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}}, zoomLevelBoundaries: ZoomLevelLimits = {min: 0.1, max: 10}, rotationBoundaries: RotationLimits = undefined){
        this._baseCamera = new BaseCamera(viewPortWidth, viewPortHeight, position, rotation, zoomLevel, boundaries, zoomLevelBoundaries, rotationBoundaries);
        this._observer = new CameraUpdatePublisher();
    }

    get boundaries(): Boundaries | undefined{
        return this._baseCamera.boundaries;
    }

    set boundaries(boundaries: Boundaries | undefined){
        this._baseCamera.boundaries = boundaries;
    }

    get viewPortWidth(): number{
        return this._baseCamera.viewPortWidth;
    }

    set viewPortWidth(width: number){
        this._baseCamera.viewPortWidth = width;
    }

    get viewPortHeight(): number{
        return this._baseCamera.viewPortHeight;
    }

    set viewPortHeight(height: number){
        this._baseCamera.viewPortHeight = height;
    }

    get position(): Point{
        return this._baseCamera.position;
    }

    setPosition(destination: Point){
        const currentPosition = {...this._baseCamera.position};
        if(!this._baseCamera.setPosition(destination)){
            return false;
        }
        this._observer.notifyPan({diff: PointCal.subVector(destination, currentPosition)}, {position: this._baseCamera.position, rotation: this._baseCamera.rotation, zoomLevel: this._baseCamera.zoomLevel});
        return true;
    }

    get zoomLevel(): number{
        return this._baseCamera.zoomLevel;
    }

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

    get rotation(): number{
        return this._baseCamera.rotation;
    }

    get rotationBoundaries(): RotationLimits | undefined{
        return this._baseCamera.rotationBoundaries;
    }

    set rotationBoundaries(rotationBoundaries: RotationLimits | undefined){
        this._baseCamera.rotationBoundaries = rotationBoundaries;
    }

    /**
     * @translationBlock The order of the transformation is as follows:
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
    getTransform(devicePixelRatio: number, alignCoorindate: boolean) {
        const tx = devicePixelRatio * this._baseCamera.viewPortWidth / 2;
        const ty = devicePixelRatio * this._baseCamera.viewPortHeight / 2;
        const tx2 = -this._baseCamera.position.x;
        const ty2 = alignCoorindate ? -this._baseCamera.position.y : this._baseCamera.position.y;

        const s = devicePixelRatio;
        const s2 = this._baseCamera.zoomLevel;
        const θ = alignCoorindate ? -this._baseCamera.rotation : this._baseCamera.rotation;

        const sin = Math.sin(θ);
        const cos = Math.cos(θ);

        const a = s2 * s * cos;
        const b = s2 * s * sin;
        const c = -s * s2 * sin;
        const d = s2 * s * cos;
        const e = s * s2 * cos * tx2 - s * s2 * sin * ty2 + tx;
        const f = s * s2 * sin * tx2 + s * s2 * cos * ty2 + ty;
        return {a, b, c, d, e, f};
    }

    setRotation(rotation: number){
        const currentRotation = this._baseCamera.rotation;
        if(!this._baseCamera.setRotation(rotation)){
            return false;
        }
        this._observer.notifyRotate({deltaRotation: rotation - currentRotation}, {position: this._baseCamera.position, rotation: this._baseCamera.rotation, zoomLevel: this._baseCamera.zoomLevel});
        return true;
    }

    // the points are in window space
    getCameraOriginInWindow(centerInWindow: Point): Point{
        return centerInWindow;
    }

    convertFromViewPort2WorldSpace(point: Point): Point{
        return convert2WorldSpaceAnchorAtCenter(point, this._baseCamera.position, this._baseCamera.zoomLevel, this._baseCamera.rotation);
    }

    convertFromWorld2ViewPort(point: Point): Point{
        return convert2ViewPortSpaceAnchorAtCenter(point, this._baseCamera.position, this._baseCamera.zoomLevel, this._baseCamera.rotation);
    }
    
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

    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void, options?: SubscriptionOptions): UnSubscribe {
        return this._observer.on(eventName, callback, options);
    }

    pointInView(point: Point): boolean {
        return withinBoundaries(point, {});
    }
}
