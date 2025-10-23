import { Point } from '@ue-too/math';
import { Boundaries, withinBoundaries } from './utils/position';
import { zoomLevelWithinLimits, ZoomLevelLimits, clampZoomLevel } from './utils/zoom';
import { RotationLimits, rotationWithinLimits, normalizeAngleZero2TwoPI, clampRotation } from './utils/rotation';
import { convert2WorldSpaceAnchorAtCenter, convert2ViewPortSpaceAnchorAtCenter } from './utils/coordinate-conversion';
import { PointCal } from '@ue-too/math';
import { BoardCamera } from './interface';
import { decomposeCameraMatrix, decomposeTRS, TransformationMatrix } from './utils/matrix';

/**
 * 
 * @description This is the base class for the camera. It is used to create a camera that can be used to view a board.
 * 
 * If there's only one class that you want to use in this library, it is this one. The is the back bone of the board camera system.
 * 
 * With the {@link CameraRig} class, you can create a camera system that can be used to achieve the infinite canvas effect.
 * 
 * This class is not observable (you can not register a callback for camera state changes). If you need to observe the camera state, use the {@link DefaultBoardCamera} class instead.
 * @category Camera
 */
export default class BaseCamera implements BoardCamera {

    private _position: Point;
    private _rotation: number;
    private _zoomLevel: number;

    private currentCachedTransform: {transform: {a: number, b: number, c: number, d: number, e: number, f: number}, position: Point, rotation: number, zoomLevel: number, alignCoorindate: boolean, devicePixelRatio: number, viewPortWidth: number, viewPortHeight: number} | undefined;

    private _viewPortWidth: number;
    private _viewPortHeight: number;

    private _boundaries?: Boundaries;
    private _zoomBoundaries?: ZoomLevelLimits;
    private _rotationBoundaries?: RotationLimits;

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
    constructor(viewPortWidth: number = 1000, viewPortHeight: number = 1000, position: Point = {x: 0, y: 0}, rotation: number = 0, zoomLevel: number = 1, boundaries: Boundaries = {min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}}, zoomLevelBoundaries: ZoomLevelLimits = {min: 0.1, max: 10}, rotationBoundaries: RotationLimits | undefined = undefined){
        this._position = position;
        this._zoomLevel = zoomLevel;
        this._rotation = rotation;
        this._viewPortHeight = viewPortHeight;
        this._viewPortWidth = viewPortWidth;
        this._zoomBoundaries = zoomLevelBoundaries;
        this._rotationBoundaries = rotationBoundaries;
        this._boundaries = boundaries;
    }

    /**
     * @description The translation boundaries of the camera in the world coordinate system.
     * 
     * @category Camera
     */
    get boundaries(): Boundaries | undefined{
        return this._boundaries;
    }

    set boundaries(boundaries: Boundaries | undefined){
        this._boundaries = boundaries;
    }

    /**
     * @description The width of the viewport. (The width of the canvas in css pixels)
     * 
     * @category Camera
     */
    get viewPortWidth(): number{
        return this._viewPortWidth;
    }

    set viewPortWidth(width: number){
        this._viewPortWidth = width;
    }

    /**
     * @description The height of the viewport. (The height of the canvas in css pixels)
     * 
     * @category Camera
     */
    get viewPortHeight(): number{
        return this._viewPortHeight;
    }

    set viewPortHeight(height: number){
        this._viewPortHeight = height;
    }

    /**
     * @description The position of the camera in the world coordinate system.
     * 
     * @category Camera
     */
    get position(): Point{
        return this._position;
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
        if(!withinBoundaries(destination, this._boundaries)){
            return false;
        }
        const diff = PointCal.subVector(destination, this._position);
        if(PointCal.magnitude(diff) < 10E-10 && PointCal.magnitude(diff) < 1 / this._zoomLevel){
            return false;
        }
        this._position = destination;
        return true;
    }

    /**
     * @description The zoom level of the camera.
     * 
     * @category Camera
     */
    get zoomLevel(): number{
        return this._zoomLevel;
    }

    /**
     * @description The boundaries of the zoom level of the camera.
     * 
     * @category Camera
     */
    get zoomBoundaries(): ZoomLevelLimits | undefined{
        return this._zoomBoundaries;
    }

    /**
     * @description The boundaries of the zoom level of the camera.
     * 
     * @category Camera
     */
    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined){
        const newZoomBoundaries = {...zoomBoundaries};
        if(newZoomBoundaries !== undefined && newZoomBoundaries.min !== undefined && newZoomBoundaries.max !== undefined && newZoomBoundaries.min > newZoomBoundaries.max){
            let temp = newZoomBoundaries.max;
            newZoomBoundaries.max = newZoomBoundaries.min;
            newZoomBoundaries.min = temp;
        }
        this._zoomBoundaries = newZoomBoundaries;
    }

    setMaxZoomLevel(maxZoomLevel: number){
        if(this._zoomBoundaries == undefined){
            this._zoomBoundaries = {min: undefined, max: undefined};
        }
        if((this._zoomBoundaries.min != undefined && this._zoomBoundaries.min > maxZoomLevel) || this._zoomLevel > maxZoomLevel){
            return false;
        }
        this._zoomBoundaries.max = maxZoomLevel;
        console.trace('setMaxZoomLevel', maxZoomLevel);
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
        console.trace('setMinZoomLevel', minZoomLevel);
        return true;
    }

    /**
     * @description This function is used to set the zoom level of the camera.
     * @param zoomLevel The zoom level of the camera.
     * @returns Whether the zoom level is set successfully.
     * 
     * @description This function has a guard that checks if the zoom level is within the boundaries of the camera.
     * If the zoom level is not within the boundaries, the function will return false and the zoom level will not be updated.
     * If the zoom level is within the boundaries, the function will return true and the zoom level will be updated.
     */
    setZoomLevel(zoomLevel: number){
        if(!zoomLevelWithinLimits(zoomLevel, this._zoomBoundaries)){
            return false;
        }
        if(this._zoomBoundaries !== undefined && this._zoomBoundaries.max !== undefined && clampZoomLevel(zoomLevel, this._zoomBoundaries) == this._zoomBoundaries.max && this._zoomLevel == this._zoomBoundaries.max){
            return false;
        }
        if(this._zoomBoundaries !== undefined && this._zoomBoundaries.min !== undefined && clampZoomLevel(zoomLevel, this._zoomBoundaries) == this._zoomBoundaries.min && this._zoomLevel == this._zoomBoundaries.min){
            return false;
        }
        this._zoomLevel = zoomLevel;
        return true;
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
    getTransform(devicePixelRatio: number, alignCoorindate: boolean) {
        if(this.currentCachedTransform !== undefined
            && this.currentCachedTransform.devicePixelRatio === devicePixelRatio
            && this.currentCachedTransform.alignCoorindate === alignCoorindate
            && this.currentCachedTransform.position.x === this._position.x
            && this.currentCachedTransform.position.y === this._position.y
            && this.currentCachedTransform.rotation === this._rotation
            && this.currentCachedTransform.zoomLevel === this._zoomLevel
            && this.currentCachedTransform.viewPortWidth === this._viewPortWidth
            && this.currentCachedTransform.viewPortHeight === this._viewPortHeight
        ){
            return {...this.currentCachedTransform.transform, cached: true};
        }
        const tx = devicePixelRatio * this._viewPortWidth / 2;
        const ty = devicePixelRatio * this._viewPortHeight / 2;
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
        this.currentCachedTransform = {transform: {a, b, c, d, e, f}, position: this._position, rotation: this._rotation, zoomLevel: this._zoomLevel, alignCoorindate, devicePixelRatio, viewPortWidth: this._viewPortWidth, viewPortHeight: this._viewPortHeight};
        return {a, b, c, d, e, f, cached: false};
    }

    getTRS(devicePixelRatio: number, alignCoorindate: boolean){
        const transform = this.getTransform(devicePixelRatio, alignCoorindate);
        const decompositionRes = decomposeTRS(transform);
        return decompositionRes;
    }

    /**
     * @description This function is used to set the camera using a transformation matrix.
     * The transformation matrix is the same as the one returned by the {@link getTransform} function. (by performing the transformations in the same order)
     * The transformation matrix would be decomposed into SCALE(devicePixelRatio), TRANSLATION(center of the canvas), ROTATION(-rotation), SCALE(zoom level), and TRANSLATION(position).
     * The position, zoom level, and rotation are still bounded by the boundaries of the camera.
     * 
     * @param transformationMatrix The transformation matrix.
     * 
     * @category Camera
     */
    setUsingTransformationMatrix(transformationMatrix: TransformationMatrix){
        const decomposed = decomposeCameraMatrix(transformationMatrix, this._viewPortWidth, this._viewPortHeight, this._zoomLevel);
        this.setPosition(decomposed.position);
        this.setRotation(decomposed.rotation);
        this.setZoomLevel(decomposed.zoom);
    }

    setRotation(rotation: number){
        if(!rotationWithinLimits(rotation, this._rotationBoundaries)){
            return false;
        }
        rotation = normalizeAngleZero2TwoPI(rotation);
        if(this._rotationBoundaries !== undefined && this._rotationBoundaries.end !== undefined && clampRotation(rotation, this._rotationBoundaries) == this._rotationBoundaries.end && this._rotation == this._rotationBoundaries.end){
            return false;
        }
        if(this._rotationBoundaries !== undefined && this._rotationBoundaries.start !== undefined && clampRotation(rotation, this._rotationBoundaries) == this._rotationBoundaries.start && this._rotation == this._rotationBoundaries.start){
            return false;
        }
        this._rotation = rotation;
        return true;
    }

    /**
     * @description The origin of the camera in the window coordinate system.
     * @deprecated
     * 
     * @category Camera
     */
    getCameraOriginInWindow(centerInWindow: Point): Point{
        return centerInWindow;
    }

    /**
     * @description Converts a point from the viewport coordinate system to the world coordinate system.
     * 
     * @param point The point in the viewport coordinate system.
     * @returns The point in the world coordinate system.
     * 
     * @category Camera
     */
    convertFromViewPort2WorldSpace(point: Point): Point{
        return convert2WorldSpaceAnchorAtCenter(point, this._position, this._zoomLevel, this._rotation);
    }

    /**
     * @description Converts a point from the world coordinate system to the viewport coordinate system.
     * 
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     * 
     * @category Camera
     */
    convertFromWorld2ViewPort(point: Point): Point{
        return convert2ViewPortSpaceAnchorAtCenter(point, this._position, this._zoomLevel, this._rotation);
    }

    /**
     * @description Inverts a point from the world coordinate system to the viewport coordinate system.
     * 
     * @param point The point in the world coordinate system.
     * @returns The point in the viewport coordinate system.
     * 
     * @category Camera
     */
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
        if(this._boundaries.min == undefined){
            this._boundaries.min = {x: undefined, y: undefined};
        }
        if(this._boundaries.max == undefined){
            this._boundaries.max = {x: undefined, y: undefined};
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
        if(this._boundaries.min == undefined){
            this._boundaries.min = {x: undefined, y: undefined};
        }
        if(this._boundaries.max == undefined){
            this._boundaries.max = {x: undefined, y: undefined};
        }
        this._boundaries.min.y = min;
        this._boundaries.max.y = max;
    }

    viewPortInWorldSpace(alignCoordinate: boolean = true): {top: {left: Point, right: Point}, bottom: {left: Point, right: Point}}{
        const topLeftCorner = convert2WorldSpaceAnchorAtCenter({x: -this._viewPortWidth / 2, y: alignCoordinate ? -this._viewPortHeight / 2 : this._viewPortHeight / 2}, this._position, this._zoomLevel, this._rotation);
        const topRightCorner = convert2WorldSpaceAnchorAtCenter({x: this._viewPortWidth / 2, y: alignCoordinate ? -this._viewPortHeight / 2 : this._viewPortHeight / 2}, this._position, this._zoomLevel, this._rotation);
        const bottomLeftCorner = convert2WorldSpaceAnchorAtCenter({x: -this._viewPortWidth / 2, y: alignCoordinate ? this._viewPortHeight / 2 : -this._viewPortHeight / 2}, this._position, this._zoomLevel, this._rotation);
        const bottomRightCorner = convert2WorldSpaceAnchorAtCenter({x: this._viewPortWidth / 2, y: alignCoordinate ? this._viewPortHeight / 2 : -this._viewPortHeight / 2}, this._position, this._zoomLevel, this._rotation);

        return {
            top: {left: topLeftCorner, right: topRightCorner},
            bottom: {left: bottomLeftCorner, right: bottomRightCorner},
        }
    }

    viewPortAABB(alignCoordinate?: boolean): {min: Point, max: Point}{
        const {top: {left: topLeft, right: topRight}, bottom: {left: bottomLeft, right: bottomRight}} = this.viewPortInWorldSpace(alignCoordinate);

        return {
            min: {x: Math.min(topLeft.x, bottomLeft.x, topRight.x, bottomRight.x), y: Math.min(topLeft.y, bottomLeft.y, topRight.y, bottomRight.y)},
            max: {x: Math.max(topLeft.x, bottomLeft.x, topRight.x, bottomRight.x), y: Math.max(topLeft.y, bottomLeft.y, topRight.y, bottomRight.y)},
        };
    }
}
