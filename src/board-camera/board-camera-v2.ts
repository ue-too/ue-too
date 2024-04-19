import { Point } from 'src';
import { Boundaries } from 'src/board-camera';
import { CameraObserverV2 } from 'src/camera-observer';
import { withinBoundaries } from 'src/board-camera/utils/position';
import { zoomLevelWithinLimits, ZoomLevelLimits, clampZoomLevel } from 'src/board-camera/utils/zoom';
import { RotationLimits, rotationWithinLimits, normalizeAngleZero2TwoPI, clampRotation } from 'src/board-camera/utils/rotation';
import { convert2WorldSpace } from 'src/board-camera/utils/coordinate-conversion';
import { PointCal } from 'point2point';
import { CameraEvent, CameraState } from 'src/camera-observer';
import { BoardCamera } from 'src/board-camera/interface';

export class BoardCameraV2 implements BoardCamera {

    private _position: Point;
    private _rotation: number;
    private _zoomLevel: number;

    private _viewPortWidth: number;
    private _viewPortHeight: number;

    private _boundaries?: Boundaries;
    private _zoomBoundaries?: ZoomLevelLimits;
    private _rotationBoundaries?: RotationLimits;

    private _observer: CameraObserverV2;

    constructor(cameraObserver: CameraObserverV2 = new CameraObserverV2(), position: Point = {x: 0, y: 0}, viewPortWidth: number = 1000, viewPortHeight: number = 1000, zoomLevel: number =  1, rotation: number = 0){
        this._position = position;
        this._zoomLevel = zoomLevel;
        this._rotation = rotation;
        this._viewPortHeight = viewPortHeight;
        this._viewPortWidth = viewPortWidth;
        this._observer = cameraObserver;
    }

    get boundaries(): Boundaries | undefined{
        return this._boundaries;
    }

    get zoomBoundaries(): ZoomLevelLimits | undefined{
        return this._zoomBoundaries;
    }

    get rotationBoundaries(): RotationLimits | undefined{
        return this._rotationBoundaries;
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

    get observer(): CameraObserverV2{
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

    get zoomLevel(): number{
        return this._zoomLevel;
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

    convertFromViewPort2WorldSpace(point: Point): Point{
        return convert2WorldSpace(point, this._viewPortWidth, this._viewPortHeight, this._position, this._zoomLevel, this._rotation);
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

    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined){
        if(zoomBoundaries !== undefined && zoomBoundaries.min !== undefined && zoomBoundaries.max !== undefined && zoomBoundaries.min > zoomBoundaries.max){
            let temp = zoomBoundaries.max;
            zoomBoundaries.max = zoomBoundaries.min;
            zoomBoundaries.min = temp;
        }
        this._zoomBoundaries = zoomBoundaries;
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): void {
        this._observer.on(eventName, callback);
    }
     
}
