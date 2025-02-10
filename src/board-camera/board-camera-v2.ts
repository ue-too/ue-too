import { Point } from 'src';
import { Boundaries } from 'src/board-camera';
import { CameraObserver, UnSubscribe } from 'src/camera-observer';
import { withinBoundaries } from 'src/board-camera/utils/position';
import { zoomLevelWithinLimits, ZoomLevelLimits, clampZoomLevel } from 'src/board-camera/utils/zoom';
import { RotationLimits, rotationWithinLimits, normalizeAngleZero2TwoPI, clampRotation } from 'src/board-camera/utils/rotation';
import { convert2WorldSpaceAnchorAtCenter, convert2ViewPortSpaceAnchorAtCenter } from 'src/board-camera/utils/coordinate-conversion';
import { PointCal } from 'point2point';
import { CameraEvent, CameraState } from 'src/camera-observer';
import { BoardCamera } from './interface';

export default class DefaultBoardCamera implements BoardCamera {

    private _position: Point;
    private _rotation: number;
    private _zoomLevel: number;

    private _viewPortWidth: number;
    private _viewPortHeight: number;

    private _boundaries?: Boundaries;
    private _zoomBoundaries?: ZoomLevelLimits;
    private _rotationBoundaries?: RotationLimits;

    private _observer: CameraObserver;


    constructor(position: Point = {x: 0, y: 0}, rotation: number = 0, zoomLevel: number = 1, viewPortWidth: number = 1000, viewPortHeight: number = 1000, observer: CameraObserver = new CameraObserver(), boundaries: Boundaries = {min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}}, zoomLevelBoundaries: ZoomLevelLimits = {min: 0.1, max: 10}, rotationBoundaries: RotationLimits = undefined){
        this._position = position;
        this._zoomLevel = zoomLevel;
        this._rotation = rotation;
        this._viewPortHeight = viewPortHeight;
        this._viewPortWidth = viewPortWidth;
        this._observer = observer;
        this._zoomBoundaries = zoomLevelBoundaries;
        this._rotationBoundaries = rotationBoundaries;
        this._boundaries = boundaries;
    }

    get boundaries(): Boundaries | undefined{
        return this._boundaries;
    }

    set boundaries(boundaries: Boundaries | undefined){
        this._boundaries = boundaries;
    }

    get viewPortWidth(): number{
        return this._viewPortWidth;
    }

    set viewPortWidth(width: number){
        this._viewPortWidth = width;
    }

    get viewPortHeight(): number{
        return this._viewPortHeight;
    }

    set viewPortHeight(height: number){
        this._viewPortHeight = height;
    }

    get position(): Point{
        return this._position;
    }

    get observer(): CameraObserver{
        return this._observer;
    }

    setPosition(destination: Point){
        if(withinBoundaries(destination, this._boundaries)){
            const diff = PointCal.subVector(destination, this._position);
            if(PointCal.magnitude(diff) < 10E-10 && PointCal.magnitude(diff) < 1 / this._zoomLevel){
                return;
            }
            this._position = destination;
            this._observer.notifyPositionChange(diff, {position: this._position, rotation: this._rotation, zoomLevel: this._zoomLevel})
        }
    }

    setPositionByDelta(delta: Point): void {
        this.setPosition(PointCal.addVector(this._position, delta));
    }

    moveByDeltaInViewPort(delta: Point): void {
        
    }

    get zoomLevel(): number{
        return this._zoomLevel;
    }

    get zoomBoundaries(): ZoomLevelLimits | undefined{
        return this._zoomBoundaries;
    }

    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined){
        if(zoomBoundaries !== undefined && zoomBoundaries.min !== undefined && zoomBoundaries.max !== undefined && zoomBoundaries.min > zoomBoundaries.max){
            let temp = zoomBoundaries.max;
            zoomBoundaries.max = zoomBoundaries.min;
            zoomBoundaries.min = temp;
        }
        this._zoomBoundaries = zoomBoundaries;
    }

    setMaxZoomLevel(maxZoomLevel: number){
        if(this._zoomBoundaries == undefined){
            this._zoomBoundaries = {min: undefined, max: undefined};
        }
        if((this._zoomBoundaries.min != undefined && this._zoomBoundaries.min > maxZoomLevel) || this._zoomLevel > maxZoomLevel){
            return false;
        }
        this._zoomBoundaries.max = maxZoomLevel;
        return true
    }

    setMinZoomLevel(minZoomLevel: number){
        if(this._zoomBoundaries == undefined){
            this._zoomBoundaries = {min: undefined, max: undefined};
        }
        if((this._zoomBoundaries.max != undefined && this._zoomBoundaries.max < minZoomLevel)){
            return false;
        }
        this._zoomBoundaries.min = minZoomLevel;
        if(this._zoomLevel < minZoomLevel){
            this._zoomLevel = minZoomLevel;
        }
        return true;
    }

    setZoomLevel(zoomLevel: number){
        if(zoomLevelWithinLimits(zoomLevel, this._zoomBoundaries)){
            if(this._zoomBoundaries !== undefined && this._zoomBoundaries.max !== undefined && clampZoomLevel(zoomLevel, this._zoomBoundaries) == this._zoomBoundaries.max && this._zoomLevel == this._zoomBoundaries.max){
                return;
            }
            if(this._zoomBoundaries !== undefined && this._zoomBoundaries.min !== undefined && clampZoomLevel(zoomLevel, this._zoomBoundaries) == this._zoomBoundaries.min && this._zoomLevel == this._zoomBoundaries.min){
                return;
            }
            const curZoom = this._zoomLevel;
            this._zoomLevel = zoomLevel;
            this._observer.notifyZoomChange(this._zoomLevel - curZoom, {position: this._position, rotation: this._rotation, zoomLevel: this._zoomLevel});
        }
    }

    get rotation(): number{
        return this._rotation;
    }

    get rotationBoundaries(): RotationLimits | undefined{
        return this._rotationBoundaries;
    }

    set rotationBoundaries(rotationBoundaries: RotationLimits | undefined){
        if(rotationBoundaries !== undefined && rotationBoundaries.start !== undefined && rotationBoundaries.end !== undefined && rotationBoundaries.start > rotationBoundaries.end){
            let temp = rotationBoundaries.end;
            rotationBoundaries.end = rotationBoundaries.start;
            rotationBoundaries.start = temp;
        }
        this._rotationBoundaries = rotationBoundaries;
    }

    /**
     * The order of the transformation is as follows:
     * 1. Translation (move the origin of the context to the center of the canvas)
     * 2. Scale (scale the context using the device pixel ratio)
     * 3. Rotation (rotate the context negatively the rotation of the camera)
     * 4. Zoom (scale the context using the zoom level of the camera)
     * 5. Translation (move the origin of the context to the position of the camera in the context coordinate system)
     */
    getTransform(canvasWidth: number, canvasHeight: number, devicePixelRatio: number, alignCoorindate: boolean) {
        const tx = canvasWidth / 2;
        const ty = canvasHeight / 2;
        const tx2 = -this._position.x;
        const ty2 = alignCoorindate ? -this._position.y : this._position.y;

        const s = devicePixelRatio;
        const s2 = this._zoomLevel;
        const θ = alignCoorindate ? -this._rotation : this._rotation;

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
        if(rotationWithinLimits(rotation, this._rotationBoundaries)){
            rotation = normalizeAngleZero2TwoPI(rotation);
            if(this._rotationBoundaries !== undefined && this._rotationBoundaries.end !== undefined && clampRotation(rotation, this._rotationBoundaries) == this._rotationBoundaries.end && this._rotation == this._rotationBoundaries.end){
                return;
            }
            if(this._rotationBoundaries !== undefined && this.rotationBoundaries.start !== undefined && clampRotation(rotation, this._rotationBoundaries) == this._rotationBoundaries.start && this._rotation == this._rotationBoundaries.start){
                return;
            }
            this._observer.notifyRotationChange(rotation - this._rotation, {position: this._position, rotation: rotation, zoomLevel: this._zoomLevel});
            this._rotation = rotation;
        }
    }

    // the points are in window space
    getCameraOriginInWindow(centerInWindow: Point): Point{
        return centerInWindow;
    }

    convertFromViewPort2WorldSpace(point: Point): Point{
        return convert2WorldSpaceAnchorAtCenter(point, this._position, this._zoomLevel, this._rotation);
    }

    convertFromWorld2ViewPort(point: Point): Point{
        return convert2ViewPortSpaceAnchorAtCenter(point, this._position, this._zoomLevel, this._rotation);
    }
    
    invertFromWorldSpace2ViewPort(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this._viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, this._position);
        delta2Point = PointCal.rotatePoint(delta2Point, -this._rotation);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, this._zoomLevel);
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    setHorizontalBoundaries(min: number, max: number){
        if (min > max){
            let temp = max;
            max = min;
            min = temp;
        }
        if(this._boundaries == undefined){
            this._boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this._boundaries.min.x = min;
        this._boundaries.max.x = max;
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
        if(this._boundaries == undefined){
            this._boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this._boundaries.min.y = min;
        this._boundaries.max.y = max;
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe {
        return this._observer.on(eventName, callback);
    }

    pointInView(point: Point): boolean {
        return withinBoundaries(point, {});
    }
}
