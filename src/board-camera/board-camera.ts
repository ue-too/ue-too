import { PointCal, Point } from "point2point";
import { CameraObserver } from "../camera-observer/camera-observer";
import { EaseFunctions } from "../ease-functions";
import { EaseFunction } from "../ease-functions";
import { CameraEventMapping, CameraState } from "../camera-observer/camera-observer";

/**
 * @category Board Camera
 * @translation need to translate boundaries text
 */
export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

/**
 * @category Board Camera
 */
export interface CameraLockableObject{
    getPosition(): Point;
    getRotation(): number;
    getOptimalZoomLevel(): number;
}

export type PositionAnimation = {
    animationPercentage: number;
    easingFn: EaseFunction;
    duration: number;
    diff: Point;
}

export type RotationAnimation = {
    animationPercentage: number;
    easingFn: EaseFunction;
    duration: number;
    diff: number;
}

export type ZoomAnimation = {
    animationPercentage: number;
    easingFn: EaseFunction;
    duration: number;
    diff: number;
    anchorPoint?: Point;
}

export type CameraZoomSuccessRes = {
    success: true;
    deltaZoomAmount: number;
    resultingZoomLevel: number;
}

export type CameraZoomFailureRes = {
    success: false;
}

export type CameraZoomResult = CameraZoomSuccessRes | CameraZoomFailureRes;

export type CameraPanSuccessRes = {
    success: true;
    deltaPosition: Point;
    resultingPosition: Point;
}

export type CameraPanFailureRes = {
    success: false;
}

export type CameraPanResult = CameraPanSuccessRes | CameraPanFailureRes;

export type CameraRotateSuccessRes = {
    success: true;
    deltaRotation: number;
    resultingRotation: number;
}

export type CameraRotateFailureRes = {
    success: false;
}

export type CameraRotateRes = CameraRotateSuccessRes | CameraRotateFailureRes;

/**
 * @category Board Camera
 * @translationBlock This is the backbone of the canvas panning and a lot of other stuff that is made easy by the camera.
 * This would normally be retrieved from the board class as this camera is not that useful without the board.
 * 
 * Example Usage: 
 * ```typescript
 * const camera = board.getCamera();
 * camera.setPosition({x: 0, y: 0});
 * ```
 */
export default class BoardCamera {

    private _position: Point;
    private _zoomLevel: number;
    private _rotation: number;
    
    private _boundaries: {min: {x?: number, y?: number}, max: {x?: number, y?: number}};
    private zoomLevelLimits: {min?: number, max?: number};

    private _viewPortWidth: number;
    private _viewPortHeight: number;

    private lockOnObject: CameraLockableObject;
    private lockRotationOnObject: boolean = false;
    private lockPositionOnObject: boolean = false;

    private positionAnimation: PositionAnimation;
    private rotationAnimation: RotationAnimation;
    private zoomAnimation: ZoomAnimation;

    private _restrictXTranslationFromGesture: boolean = false;

    private _observer: CameraObserver;
    /**
     * @group Restriction
     */
    get restrictXTranslationFromGesture(): boolean {
        return this._restrictXTranslationFromGesture;
    }

    private _restrictYTranslationFromGesture: boolean = false;

    /**
     * @group Restriction 
    */
    get restrictYTranslationFromGesture(): boolean {
        return this._restrictYTranslationFromGesture;
    }

    private _restrictRelativeXTranslationFromGesture: boolean = false;

    /**
     * @group Restriction
     */
    get restrictRelativeXTranslationFromGesture(): boolean {
        return this._restrictRelativeXTranslationFromGesture;
    }

    private _restrictRelativeYTranslationFromGesture: boolean = false;

    /**
     * @group Restriction
     */
    get restrictRelativeYTranslationFromGesture(): boolean {
        return this._restrictRelativeYTranslationFromGesture;
    }

    private _restrictZoomFromGesture: boolean = false;

    /**
     * @group Restriction
     */
    get restrictZoomFromGesture(): boolean {
        return this._restrictZoomFromGesture;
    }

    private _restrictRotationFromGesture: boolean = false;

    /**
     * @group Restriction
     */
    get restrictRotationFromGesture(): boolean {
        return this._restrictRotationFromGesture;
    }

    constructor(position: Point = {x: 0, y: 0}, viewPortWidth: number = 1000, viewPortHeight: number = 1000, zoomLevel: number =  1, rotation: number = 0){
        if (!this.zoomLevelValid(zoomLevel)){
            throw new InvalidZoomLevelError("zoom level cannot be less than or equal to 0");
        }
        this._position = position;
        this._zoomLevel = zoomLevel;
        this._rotation = rotation;
        this._viewPortHeight = viewPortHeight;
        this._viewPortWidth = viewPortWidth;
        this._observer = new CameraObserver();
        this.positionAnimation = {
            animationPercentage: 1.1,
            easingFn: undefined,
            diff: undefined,
            duration: undefined
        };
        this.rotationAnimation = {
            animationPercentage: 1.1,
            easingFn: undefined,
            diff: undefined,
            duration: undefined
        };
        this.zoomAnimation = {
            animationPercentage: 1.1,
            easingFn: undefined,
            diff: undefined,
            duration: undefined
        }
    }

    /**
     * @group Camera Attribute Checks
     * @translation Check if the zoom level is valid
     */
    zoomLevelValid(zoomLevel: number){
        if(zoomLevel <= 0){
            return false;
        }
        return true;
    }

    /**
     * @group Camera Attributes
     */
    setViewPortWidth(width: number){
        this._viewPortWidth = width;
    }

    /**
     * @group Camera Attributes
     * @accessorDescription The width of the view port of the camera.
     */
    set viewPortWidth(width: number){
        this._viewPortWidth = width;
    }

    get viewPortWidth(): number{
        return this._viewPortWidth;
    }

    getViewPortWidth(): number{
        return this._viewPortWidth;
    }

    /**
     * @group Camera Attributes
     * @accessorDescription The height of the view port of the camera.
     */
    set viewPortHeight(height: number){
        this._viewPortHeight = height;
    }

    get viewPortHeight(): number{
        return this._viewPortHeight;
    }

    setViewPortHeight(height: number){
        this._viewPortHeight = height;
    }

    getViewPortHeight(): number{
        return this._viewPortHeight;
    }
    
    /**
     * @group Camera Position Operations
     * @translation Set the position of the camera to a specific point. This is bound by the boundaries of the camera.
     */
    setPosition(position: Point): boolean{
        if(!this.withinBoundaries(position)){
            return false;
        }
        this._position = position;
        return true;
    }

    /**
     * @group Camera Position Operations
     * @translation Set the position of the camera from gesture input of user; this is different from the setPosition method in that it takes into account the restrictions on the camera.
     */
    setPositionFromGesture(position: Point): boolean{
        this.releasePositionFromLockedObject();
        
        if(this._restrictXTranslationFromGesture){
            position.x = this._position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this._position.y;
        }
        return this.setPosition(position);
    }

    /**
     * @group Clamping
     * @translation Clamp a point with the entire view port of the camera taken into account.
     * */
    clampPointEntireViewPort(point: Point){
        let topLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: this._viewPortHeight});
        let bottomLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: 0});
        let topRightCorner = this.convert2WorldSpaceWRT(point, {x: this.viewPortWidth, y: this._viewPortHeight});
        let bottomRightCorner = this.convert2WorldSpaceWRT(point, {x: this.viewPortWidth, y: 0});
        let {clipped: topLeftRes, point: topLeftCornerClamped} = this.clampPointWithRes(topLeftCorner);
        let {clipped: topRightRes, point: topRightCornerClamped} = this.clampPointWithRes(topRightCorner);
        let {clipped: bottomLeftRes, point: bottomLeftCornerClamped} = this.clampPointWithRes(bottomLeftCorner);
        let {clipped: botomRightRes, point: bottomRightCornerClamped} = this.clampPointWithRes(bottomRightCorner);
        let topLeftCornerDiff = PointCal.subVector(topLeftCornerClamped, topLeftCorner);
        let topRightCornerDiff = PointCal.subVector(topRightCornerClamped, topRightCorner);
        let bottomLeftCornerDiff = PointCal.subVector(bottomLeftCornerClamped, bottomLeftCorner);
        let bottomRightCornerDiff = PointCal.subVector(bottomRightCornerClamped, bottomRightCorner);
        let diffs = [topLeftCornerDiff, topRightCornerDiff, bottomLeftCornerDiff, bottomRightCornerDiff];
        let maxXDiff = Math.abs(diffs[0].x);
        let maxYDiff = Math.abs(diffs[0].y);
        let delta = diffs[0];
        diffs.forEach((diff)=>{
            if(Math.abs(diff.x) > maxXDiff){
                maxXDiff = Math.abs(diff.x);
                delta.x = diff.x;
            }
            if(Math.abs(diff.y) > maxYDiff){
                maxYDiff = Math.abs(diff.y);
                delta.y = diff.y;
            }
        });
        return PointCal.addVector(point, delta);
    }
    
    /**
     * @group Clamping
     */
    clampPointWithRes(point: Point): {clipped: boolean, point: Point}{
        if(this.withinBoundaries(point)){
            return {clipped: false, point: point};
        }
        let manipulatePoint = {x: point.x, y: point.y};
        let limit = this._boundaries.min;
        if (limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.max(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.max(manipulatePoint.y, limit.y);
            }
        }
        limit = this._boundaries.max;
        if(limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.min(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.min(manipulatePoint.y, limit.y);
            }
        }
        return {clipped: true, point: manipulatePoint};
    }

    /**
     * @group Clamping
     * @translation Clamp a point within the boundaries of the world. Without taking into account the entire view port of the camera.
     */
    clampPoint(point: Point): Point{
        if(this.withinBoundaries(point)){
            return point;
        }
        let manipulatePoint = {x: point.x, y: point.y};
        let limit = this._boundaries.min;
        if (limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.max(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.max(manipulatePoint.y, limit.y);
            }
        }
        limit = this._boundaries.max;
        if(limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.min(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.min(manipulatePoint.y, limit.y);
            }
        }
        return manipulatePoint;
    }

    /**
     * @group Camera Position Operations
     * @translation Set the position of the camera to a specific point. This is bound by the boundaries of the camera.
     */
    setPositionWithClamp(position: Point) {
        this.cancelPositionAnimation();
        if (this.withinBoundaries(position)){
            this._position = position;
        } else {
            this._position = this.clampPoint(position);
        }
    }

    /**
     * @group Camera Position Operations
     */
    setPositionWithClampEntireViewPort(position: Point){
        this.cancelPositionAnimation();
        this._position = this.clampPointEntireViewPort(position);
    }

    /**
     * @group Camera Position Operations
     */
    setPositionWithClampEntireViewPortFromGesture(position: Point) {
        if(this._restrictXTranslationFromGesture){
            position.x = this._position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this._position.y;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._rotation);
            let delta = PointCal.subVector(this._position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this._position, delta);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._rotation);
            let delta = PointCal.subVector(this._position, position);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
            position = PointCal.addVector(this._position, delta);
        }
        this.cancelAnimations();
        this.releasePositionFromLockedObject();
        this.setPositionWithClampEntireViewPort(position);
    }

    /**
     * @group Camera Position Operations
     */
    setPositionWithClampFromGesture(position: Point) {
        if(this._restrictXTranslationFromGesture){
            position.x = this._position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this._position.y;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._rotation);
            let delta = PointCal.subVector(this._position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this._position, delta);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._rotation);
            let delta = PointCal.subVector(this._position, position);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
            position = PointCal.addVector(this._position, delta);
        }
        this.cancelAnimations();
        this.releasePositionFromLockedObject();
        this.setPositionWithClamp(position);
    }

    /**
     * @group Camera Rotation Operations
     * */
    setRotation(rotation: number){
        rotation = this.normalizeAngleZero2TwoPI(rotation);
        this._rotation = rotation;
    }

    /**
     * @group Camera Rotation Operations
     * */
    setRotationFromGesture(rotation: number){
        if(this._restrictRotationFromGesture){
            return;
        }
        this.releaseRotationFromLockedObject();
        this.cancelAnimations();
        this.setRotation(rotation);
    }
    
    /**
     * @group Camera Rotation Operations
     * */
    setRotationDegFromGesture(rotationDeg: number){
        this.setRotationFromGesture(rotationDeg * Math.PI / 180);
    }
    
    /**
     * @group Camera Rotation Operations
     * */
    setRotationDeg(rotationDeg: number){
        this.setRotation(rotationDeg * Math.PI / 180);
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevel(zoomLevel: number){
        if(!this.zoomLevelWithinLimits(zoomLevel)){
            return false;
        }
        this._zoomLevel = zoomLevel;
        return true;
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevelWithClamp(zoomLevel: number){
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this._zoomLevel = zoomLevel;
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevelFromGesture(zoomLevel: number){
        if(!this.zoomLevelWithinLimits(zoomLevel)){
            return false;
        }
        if(this._restrictZoomFromGesture){
            return false;
        }
        this.cancelZoomAnimation();
        const deltaZoomAmount = zoomLevel - this._zoomLevel;
        this._zoomLevel = zoomLevel;
        this._observer.notifyOnZoomChange(deltaZoomAmount, this.position, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return true;
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevelWithClampFromGesture(zoomLevel: number){
        if(this._restrictZoomFromGesture){
            return;
        }
        this.cancelZoomAnimation();
        zoomLevel = this.clampZoomLevel(zoomLevel);
        const deltaZoomAmount = zoomLevel - this._zoomLevel;
        this._zoomLevel = zoomLevel;
        this._observer.notifyOnZoomChange(deltaZoomAmount, this.position, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point): CameraZoomResult{
        if(this._restrictZoomFromGesture){
            return {success: false};
        }
        this.cancelZoomAnimation();
        let originalAnchorInWorld = this.convert2WorldSpace(anchorInViewPort);
        const originalZoomLevel = this._zoomLevel;
        if(this.zoomLevelLimits.max !== undefined && this.clampZoomLevel(zoomLevel) == this.zoomLevelLimits.max && this._zoomLevel == this.zoomLevelLimits.max){
            return {success: false};
        }
        if(this.zoomLevelLimits.min !== undefined && this.clampZoomLevel(zoomLevel) == this.zoomLevelLimits.min && this._zoomLevel == this.zoomLevelLimits.min){
            return {success: false};
        }
        zoomLevel = this.clampZoomLevel(zoomLevel);
        const deltaZoomAmount = zoomLevel - originalZoomLevel;
        this._zoomLevel = zoomLevel;
        if(!this.lockPositionOnObject){
            let anchorInWorldAfterZoom = this.convert2WorldSpace(anchorInViewPort);
            const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
            this.moveWithClampEntireViewPortFromGesture(diff);
        }
        this._observer.notifyOnZoomChange(deltaZoomAmount, anchorInViewPort, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return {success: true, deltaZoomAmount: deltaZoomAmount, resultingZoomLevel: zoomLevel};
    }

    /**
     * @group Camera Zoom Operations
     * */
    setZoomLevelWithClampFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point): CameraZoomResult{
        if(this._restrictZoomFromGesture){
            return {success: false};
        }
        this.cancelZoomAnimation();
        let originalAnchorInWorld = this.convert2WorldSpace(anchorInViewPort);
        zoomLevel = this.clampZoomLevel(zoomLevel);
        const deltaZoomAmount = zoomLevel - this._zoomLevel;
        this._zoomLevel = zoomLevel;
        if(!this.lockPositionOnObject){
            let anchorInWorldAfterZoom = this.convert2WorldSpace(anchorInViewPort);
            const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
            this.moveWithClampFromGesture(diff);
        }
        this._observer.notifyOnZoomChange(deltaZoomAmount, anchorInViewPort, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return {success: true, deltaZoomAmount: deltaZoomAmount, resultingZoomLevel: this._zoomLevel};
    }

    /**
     * @group Clamping
     */
    clampZoomLevel(zoomLevel: number): number{
        if(this.zoomLevelWithinLimits(zoomLevel)){
            return zoomLevel;
        }
        if(this.zoomLevelLimits.max){
            zoomLevel = Math.min(this.zoomLevelLimits.max, zoomLevel);
        }
        if(this.zoomLevelLimits.min){
            zoomLevel = Math.max(this.zoomLevelLimits.min, zoomLevel);
        }
        return zoomLevel;
    }

    zoomLevelWithinLimits(zoomLevel: number): boolean{
        if(zoomLevel <= 0 || (this.zoomLevelLimits !== undefined && 
        ((this.zoomLevelLimits.max !== undefined && this.zoomLevelLimits.max < zoomLevel) || 
         (this.zoomLevelLimits.min !== undefined && this.zoomLevelLimits.min > zoomLevel)
        ))){
            return false;
        }
        return true;
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

    getPosition(): Point{
        return this._position;
    }

    /**
     * @group Camera Attributes
     */
    get position(): Point {
        return this._position;
    }

    getZoomLevel(): number{
        return this._zoomLevel;
    }

    /**
     * @group Camera Attributes
     */
    get zoomLevel(): number {
        return this._zoomLevel;
    }

    getRotation(): number{
        return this._rotation;
    }

    /**
     * @group Camera Attributes
     */
    get rotation(): number{
        return this._rotation;
    }

    getRotationDeg(): number{
        return this._rotation * 180 / Math.PI
    }

    /**
     * @group Camera Attributes
     */
    get rotationDeg(): number{
        return this._rotation * 180 / Math.PI
    }

    getBoundaries(): Boundaries | undefined {
        return this._boundaries;
    }
    
    /**
     * @group Camera Attributes
     * @accessorDescription The boundaries of the camera. If undefined, the camera has no boundaries. 
     * The vertical and the horizontal boundaries are independent of each other. The max and min of the boundaries are also independent of each other.
     */
    get boundaries(): Boundaries | undefined {
        return this._boundaries;
    }

    /**
     * @group Camera Attribute Checks
     * @translation Check if a point is within the boundaries of the camera.
     */
    withinBoundaries(point: Point): boolean{
        if(this._boundaries == undefined){
            // no boundaries 
            return true;
        }
        let leftSide = false;
        let rightSide = false;
        let topSide = false;
        let bottomSide = false;
        // check within boundaries horizontally
        if(this._boundaries.max.x == undefined || point.x <= this._boundaries.max.x){
            rightSide = true;
        }
        if(this._boundaries.min.x == undefined || point.x >= this._boundaries.min.x){
            leftSide = true;
        }
        if(this._boundaries.max.y == undefined || point.y <= this._boundaries.max.y){
            topSide = true;
        }
        if(this._boundaries.min.y == undefined || point.y >= this._boundaries.min.y){
            bottomSide = true;
        }
        return leftSide && rightSide && topSide && bottomSide;
    }

    /**
     * @group Camera Position Operations
     * @translation Move the camera by a specific delta. This is bound by the boundaries of the camera. 
     * If the delta cause the camera to go out of the boundaries, the camera will not move and the method will return false.
     */
    move(delta: Point): CameraPanResult{
        if(!this.withinBoundaries(PointCal.addVector(this._position, delta))){
            return {success: false};
        }
        this._position = PointCal.addVector(this._position, delta);
        this._observer.notifyOnPositionChange(delta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return {success: true, deltaPosition: delta, resultingPosition: this._position};
    }

    /**
     * @group Camera Position Operations
     * @translation This is the same as the `move` method but it takes into account the restrictions on the camera.
     */
    moveFromGesture(delta: Point): CameraPanResult{
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return {success: false};
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return {success: false};
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        const moveRes = this.move(delta);
        if(moveRes.success){
            this.releaseFromLockedObject();
            this.cancelAnimations();
            this._observer.notifyOnPositionChange(delta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
            return moveRes;
        } else {
            return {success: false};
        }
    }

    /**
     * @group Camera Position Operations
     * @translation Move the camera by a specific delta. 
     * Different from `move` method if the delta cause the camera to go out of the boundaries, 
     * the camera will still move, only if the camera is already at the boundaries, the camera will not move and the method will return false.
     */
    moveWithClamp(delta: Point): {moved: boolean, actualDelta: Point}{
        const target = PointCal.addVector(this._position, delta);
        const clampedTarget = this.clampPoint(target);
        const diff = PointCal.subVector(clampedTarget, this._position);
        if(PointCal.magnitude(diff) < 10E-10 && PointCal.magnitude(diff) < 1 / this._zoomLevel){
            return {moved: false, actualDelta: {x: 0, y: 0}};
        }
        const actualDelta = PointCal.subVector(clampedTarget, this._position);
        this._position = clampedTarget;
        this._observer.notifyOnPositionChange(actualDelta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return {moved: true, actualDelta: actualDelta};
    }

    /**
     * @group Camera Position Operations
     * @translation This is the same as the `moveWithClamp` method but it takes into account the restrictions on the camera.
     */
    moveWithClampFromGesture(delta: Point): {moved: boolean, actualDelta: Point}{
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return {moved: false, actualDelta: {x: 0, y: 0}};
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return {moved: false, actualDelta: {x: 0, y: 0}};
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        const res = this.moveWithClamp(delta);
        if(res.moved){
            this.releaseFromLockedObject();
            this.cancelAnimations();
            this._observer.notifyOnPositionChange(res.actualDelta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        }
        return res;
    }

    /**
     * @group Camera Position Operations
     * @translation Move the camera given a delta vector. If the delta vector causes the camera to go out of the boundaries (the entire view port is taken into consideration),
     * the camera will move to the furthest point within the boundaries (for the entire view port). This is affected by the restrictions imposed on the camera.
     */
    moveWithClampEntireViewPortFromGesture(delta: Point): CameraPanResult{
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return {success: false};
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return {success: false};
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this._rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this._rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        const res = this.moveWithClampEntireViewPort(delta);
        if(res.moved){
            this._observer.notifyOnPositionChange(res.actualDelta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
            return {success: res.moved, deltaPosition: res.actualDelta, resultingPosition: this._position};
        }
        return {success: false}
    }

    /**
     * @group Camera Position Operations
     * @translation  Move the camera given a delta vector. If the delta vector causes the camera to go out of the boundaries (the entire view port is taken into consideration),
     * the camera will move to the furthest point within the boundaries (for the entire view port). This is _not_ affected by the restrictions imposed on the camera.
     */
    moveWithClampEntireViewPort(delta: Point): {moved: boolean, actualDelta: Point}{
        const target = PointCal.addVector(this._position, delta);
        const clampedTarget = this.clampPointEntireViewPort(target);
        const diff = PointCal.subVector(clampedTarget, this._position);
        if(PointCal.magnitude(diff) < 10E-10 && PointCal.magnitude(diff) < 1 / this._zoomLevel){
            return {moved: false, actualDelta: {x: 0, y: 0}};
        }
        const actualDelta = PointCal.subVector(clampedTarget, this._position);
        this._position = clampedTarget;
        this._observer.notifyOnPositionChange(actualDelta, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return {moved: true, actualDelta: actualDelta};
    }

    /**
     * @group Camera Zooming Operations
     * @translation Reset the zoom level of the camera to 1.
     */
    resetZoomLevel(){
        this._zoomLevel = 1;
    }

    /**
     * @group Camera Attribute Helper Functions
     * @translation Normalize an angle (radian) to be between 0 and 2 * Math.PI
     */
    normalizeAngleZero2TwoPI(angle: number){
        // reduce the angle  
        angle = angle % (Math.PI * 2);

        // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI 
        angle = (angle + Math.PI * 2) % (Math.PI * 2); 
        return angle;
    }

    /**
     * @group Camera Attribute Helper Functions
     * @translation Get the analge span (radian) between the current rotation and the given angle. Positive is counter clockwise and negative is clockwise.
     * The range is from -Math.PI to Math.PI.
     */
    getAngleSpan(angle: number): number{
        // in radians
        angle = this.normalizeAngleZero2TwoPI(angle);
        let angleDiff = angle - this._rotation;
        
        if(angleDiff > Math.PI){
            angleDiff = - (Math.PI * 2 - angleDiff);
        }

        if(angleDiff < -Math.PI){
            angleDiff += (Math.PI * 2);
        }
        return angleDiff;
    }

    /**
     * @group Camera Attribute Helper Functions
     * @translation Get the analge span (degree) between the current rotation and the given angle. Positive is counter clockwise and negative is clockwise.
     * The range is from -180 degrees to 180 degrees.
     */
    getAngleSpanDeg(angle: number): number{
        // in degrees
        return this.getAngleSpan(angle * Math.PI / 180) * 180 / Math.PI;
    }

    /**
     * @group Camera Rotation Operations
     * @translation Rotate the camera by a specific angle (radian). Positive angle is counter clockwise and negative angle is clockwise.
     * */
    spin(deltaAngle: number){
        // in radians
        this._rotation = this.normalizeAngleZero2TwoPI(this._rotation + deltaAngle);
    }

    /**
     * @group Camera Rotation Operations
     * @translation Rotate the camera by a specific angle (radian). Positive angle is counter clockwise and negative angle is clockwise.
     * */
    spinDeg(deltaAngle: number){
        // in degrees
        this.spin(deltaAngle * Math.PI / 180);
    }

    /**
     * @group Camera Rotation Operations
     * @translation Rotate the camera by a specific angle (degree). Positive angle is counter clockwise and negative angle is clockwise.
     * This is affected by the restrictRotationFromGesture attribute.
     * */
    spinDegFromGesture(deltaAngle: number){
        // in degrees
        const res = this.spinFromGesture(deltaAngle * Math.PI / 180);
        return res;
    }

    /**
     * @group Camera Rotation Operations
     * @translation Rotate the camera by a specific angle (radian). Positive angle is counter clockwise and negative angle is clockwise.
     * This is affected by the restrictRotationFromGesture attribute.
     * */
    spinFromGesture(deltaAngle: number){
        // in radians
        if(this._restrictRotationFromGesture){
            return false;
        }
        this.releaseRotationFromLockedObject();
        this.cancelAnimations();
        this.spin(deltaAngle);
        this._observer.notifyOnRotationChange(deltaAngle, {position: this._position, zoomLevel: this._zoomLevel, rotation: this._rotation});
        return true;
    }

    /**
     * @group Camera Attribute Bounds
     * @translation Set the maximum zoom level of the camera. The bigger the zoom level the larger the object appears.
     */
    setMaxZoomLevel(maxZoomLevel: number){
        if(this.zoomLevelLimits == undefined){
            this.zoomLevelLimits = {min: undefined, max: undefined};
        }
        if((this.zoomLevelLimits.min != undefined && this.zoomLevelLimits.min > maxZoomLevel) || this._zoomLevel > maxZoomLevel){
            return false;
        }
        this.zoomLevelLimits.max = maxZoomLevel;
        return true
    }

    /**
     * @group Camera Attribute Bounds
     * @translation Set the minimum zoom level of the camera. The smaller the zoom level the smaller the object appears.
     * The zoom level cannot be less than or equal to 0. 0 would shrink the object to nothing, and negative would flip the object.
     */
    setMinZoomLevel(minZoomLevel: number){
        if(this.zoomLevelLimits == undefined){
            this.zoomLevelLimits = {min: undefined, max: undefined};
        }
        if((this.zoomLevelLimits.max != undefined && this.zoomLevelLimits.max < minZoomLevel)){
            return false;
        }
        this.zoomLevelLimits.min = minZoomLevel;
        if(this._zoomLevel < minZoomLevel){
            this._zoomLevel = minZoomLevel;
        }
        return true;
    }

    getZoomLevelLimits(): {min?: number, max?: number} | undefined{
        return this.zoomLevelLimits;
    }

    /**
     * @group Camera Helper Functions
     * @translation Convert a point that is relative to the center point in the view port space to the world space. 
     * For example if you have a point and you want to know that the world space coordinate of a point that appears to the right of the point in the view port space.
     * Then the point is the center point and the point you want to convert is the interest point. (Interest point is relative to the center point in the view port space)
     * The center point is in world space.
     */
    convert2WorldSpaceWRT(centerPoint: Point, interestPoint: Point): Point{
        // the center point is in the world space
        // the coordinate for the interest point is relative to the center point
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this._viewPortHeight / 2};
        let delta2Point = PointCal.subVector(interestPoint, cameraFrameCenter);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / this._zoomLevel);
        delta2Point = PointCal.rotatePoint(delta2Point, this._rotation);
        return PointCal.addVector(centerPoint, delta2Point);
    }

    /**
     * @group Camera Helper Functions
     * @translation Convert a point from the view port space to the world space. The bottom left corner of the view port is the origin of the view port coordinate.
     */
    convert2WorldSpace(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this._viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, cameraFrameCenter);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / this._zoomLevel);
        delta2Point = PointCal.rotatePoint(delta2Point, this._rotation);
        return PointCal.addVector(this._position, delta2Point);
    }

    /**
     * @group Camera Helper Functions
     * @translation Convert a point from the world space to the view port space. The bottom left corner of the view port is the origin of the view port coordinate.
     * Anything negative and larger than the view port width or height is outside the view port.
     */
    invertFromWorldSpace(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this._viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, this._position);
        delta2Point = PointCal.rotatePoint(delta2Point, -this._rotation);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, this._zoomLevel);
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    /**
     * @group Camera Operations
     * @translation Reset the camera to its default position, rotation and zoom level.
     */
    resetCamera(){
        this.releaseFromLockedObject();
        this._position = {x: 0, y: 0};
        this._rotation = 0;
        this._zoomLevel = 1;
    }

    /**
     * @group Camera Operations
     * @translation Lock the camera onto an object. This means the camera will follow the object and rotate with the object.
     * There is a optimal zoom level for the object, the camera will zoom in and out to maintain the optimal zoom level.
     * However, this is not locked user can still zoom in and out and still maintain lock on position and rotation.
     */
    lockOnto(obj: CameraLockableObject){
        if (!this.withinBoundaries(obj.getPosition())){
            return;
        }
        this.lockOnObject = obj;
        this.lockPositionOnObject = true;
        this.lockRotationOnObject = true;
        this.cancelAnimations();
        this.setPosition(obj.getPosition());
        this.setRotation(obj.getRotation());
        this.setZoomLevel(obj.getOptimalZoomLevel());
    }

    /**
     * @group Camera Operations
     * @translation This is basically the same as the `lockOnto` function but with transition animation.
     */
    lockOntoWithTransition(obj: CameraLockableObject){
        if (!this.withinBoundaries(obj.getPosition())){
            return;
        }
        this.lockOnObject = obj;
        this.lockPositionOnObject = true;
        this.lockRotationOnObject = true;
        this.setPositionWithAnimation(obj.getPosition());
        this.setRotationWithAnimation(-obj.getRotation());
        this.setZoomWithAnimation(obj.getOptimalZoomLevel());
    }

    /**
     * @group Camera Attributes
     * @translation Indicating if the camera is locked onto an object position wise.
     */
    cameraPositionLockedOnObject(): boolean{
        return this.lockPositionOnObject;
    }

    /**
     * @group Camera Attributes
     * @translation Indicating if the camera is locked onto an object rotation wise.
     */
    cameraRotationLockedOnObject(): boolean{
        return this.lockRotationOnObject;
    }

    /**
     * @group Camera Attributes
     * @translation Indicating if the camera is locked onto an object zoom level wise.
     */
    releaseFromLockedObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.lockOnObject = undefined;
        this.releasePositionFromLockedObject();
        this.releaseRotationFromLockedObject();
    }

    /**
     * @group Camera Operations
     * @translation Release the camera from being locked onto an object position wise.
     */
    releasePositionFromLockedObject(){
        this.lockPositionOnObject = false;
    }

    /**
     * @group Camera Operations
     * @translation Release the camera from being locked onto an object rotation wise.
     */
    releaseRotationFromLockedObject(){
        this.lockRotationOnObject = false;
    }

    private updatePositionToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this._position = this.clampPoint(this.lockOnObject.getPosition());
    }

    private updateRotationToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this._rotation = this.normalizeAngleZero2TwoPI(-this.lockOnObject.getRotation());
    }

    private updateZoomLevelToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.setZoomLevelWithClamp(this.lockOnObject.getOptimalZoomLevel());
    }

    setPositionWithAnimation(destPos: Point, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        destPos = this.clampPoint(destPos);
        const diff = PointCal.subVector(destPos, this._position);
        this.positionAnimation.animationPercentage = 0;
        this.positionAnimation.duration = duration;
        this.positionAnimation.easingFn = easeFunction;
        this.positionAnimation.diff = diff;
    }

    setRotationWithAnimation(destRotation: number, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        const diff = this.getAngleSpan(destRotation);
        this.rotationAnimation.diff = diff;
        this.rotationAnimation.duration = duration;
        this.rotationAnimation.animationPercentage = 0;
        this.rotationAnimation.easingFn = easeFunction;
    }

    spinWithAnimationFromGesture(angleSpan: number, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        if(this._restrictRotationFromGesture){
            return;
        }
        this.releaseRotationFromLockedObject();
        this.rotationAnimation.diff = angleSpan;
        this.rotationAnimation.animationPercentage = 0;
        this.rotationAnimation.duration = duration;
        this.rotationAnimation.easingFn = easeFunction;
    }

    /**
     * @group Camera Zoom Operations
     */
    setZoomWithAnimation(destZoomLevel: number, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        destZoomLevel = this.clampZoomLevel(destZoomLevel);
        const diff = destZoomLevel - this._zoomLevel;
        this.zoomAnimation.diff = diff;
        this.zoomAnimation.easingFn = easeFunction;
        this.zoomAnimation.animationPercentage = 0;
        this.zoomAnimation.duration = duration;
    }

    /**
     * @group Camera Zoom Operations
     */
    setZoomAnimationWithAnchor(destZoomLevel: number, anchorPointInViewPort: Point, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        destZoomLevel = this.clampZoomLevel(destZoomLevel);
        const diff = destZoomLevel - this._zoomLevel;
        this.zoomAnimation.diff = diff;
        this.zoomAnimation.easingFn = easeFunction;
        this.zoomAnimation.animationPercentage = 0;
        this.zoomAnimation.duration = duration;
        this.zoomAnimation.anchorPoint = anchorPointInViewPort;
    }

    cancelAnimations(){
        this.cancelPositionAnimation();
        this.cancelRotationAnimation();
        this.cancelZoomAnimation();
    }

    cancelPositionAnimation(){
        this.positionAnimation.animationPercentage = 1.1;
    }

    cancelRotationAnimation(){
        this.rotationAnimation.animationPercentage = 1.1;
    }

    cancelZoomAnimation(){
        this.zoomAnimation.animationPercentage = 1.1;
    }

    updatePosition(deltaTime: number){
        if (this.positionAnimation.animationPercentage <= 1){
            let currentDeltaPercentage = deltaTime / this.positionAnimation.duration;
            let targetPercentage = this.positionAnimation.animationPercentage + currentDeltaPercentage;
            let percentageOnDeltaMovement = this.positionAnimation.easingFn(targetPercentage) - this.positionAnimation.easingFn(this.positionAnimation.animationPercentage)
            if (targetPercentage > 1){
                percentageOnDeltaMovement = this.positionAnimation.easingFn(1) - this.positionAnimation.easingFn(this.positionAnimation.animationPercentage);
            }
            this.moveWithClamp(PointCal.multiplyVectorByScalar(this.positionAnimation.diff, percentageOnDeltaMovement));
            this.positionAnimation.animationPercentage = targetPercentage;
        } else if(this.lockPositionOnObject) {
            this.updatePositionToLockedOnObject();
        }
    }

    updateRotation(deltaTime: number){
        if (this.rotationAnimation.animationPercentage <= 1){
            let currentDeltaPercentage = deltaTime / this.rotationAnimation.duration;
            let targetPercentage = this.rotationAnimation.animationPercentage + currentDeltaPercentage;
            let percentageOnDeltaRotation = this.rotationAnimation.easingFn(targetPercentage) - this.rotationAnimation.easingFn(this.rotationAnimation.animationPercentage)
            if (targetPercentage > 1){
                percentageOnDeltaRotation = this.rotationAnimation.easingFn(1) - this.rotationAnimation.easingFn(this.rotationAnimation.animationPercentage);
            }
            this.spin(this.rotationAnimation.diff * percentageOnDeltaRotation);
            this.rotationAnimation.animationPercentage = targetPercentage;
        } else if(this.lockRotationOnObject){
            this.updateRotationToLockedOnObject();
        }
    }

    updateZoomLevel(deltaTime: number){
        if (this.zoomAnimation.animationPercentage <= 1){
            let currentDeltaPercentage = deltaTime / this.zoomAnimation.duration;
            let targetPercentage = this.zoomAnimation.animationPercentage + currentDeltaPercentage;
            let percentageOnDeltaZoom = this.zoomAnimation.easingFn(targetPercentage) - this.zoomAnimation.easingFn(this.zoomAnimation.animationPercentage)
            if (targetPercentage > 1){
                percentageOnDeltaZoom = this.zoomAnimation.easingFn(1) - this.zoomAnimation.easingFn(this.zoomAnimation.animationPercentage);
            }
            if (this.zoomAnimation.anchorPoint != undefined){
                console.log("anchor point", this.zoomAnimation.anchorPoint);
                let anchorInWorld = this.convert2WorldSpace(this.zoomAnimation.anchorPoint);
                this.zoomAnimation.animationPercentage = targetPercentage;
                this._zoomLevel = this._zoomLevel + this.zoomAnimation.diff * percentageOnDeltaZoom; 
                let anchorInWorldAfterZoom = this.convert2WorldSpace(this.zoomAnimation.anchorPoint);
                const diff = PointCal.subVector(anchorInWorld, anchorInWorldAfterZoom);
                this.moveWithClamp(diff);
            } else {
                this._zoomLevel = this._zoomLevel + this.zoomAnimation.diff * percentageOnDeltaZoom; 
                this.zoomAnimation.animationPercentage = targetPercentage;
            }
        }
    }

    step(deltaTime: number){
        // deltaTime in seconds;
        this.updatePosition(deltaTime);
        this.updateRotation(deltaTime);
        this.updateZoomLevel(deltaTime);
    }

    resetCameraWithAnimation(){
        this.releaseFromLockedObject();
        this.setPositionWithAnimation({x: 0, y: 0});
        this.setRotationWithAnimation(0);
        this.setZoomWithAnimation(1);
    }

    lockTranslationFromGesture(){
        this._restrictXTranslationFromGesture = true;
        this._restrictYTranslationFromGesture = true;
    }

    releaseLockOnTranslationFromGesture(){
        this._restrictXTranslationFromGesture = false;
        this._restrictYTranslationFromGesture = false;
    }

    lockXTranslationFromGesture(){
        this._restrictXTranslationFromGesture = true;
    }

    releaseLockOnXTranslationFromGesture(){
        this._restrictXTranslationFromGesture = false;
    }

    lockYTranslationFromGesture(){
        this._restrictYTranslationFromGesture = true;
    }

    releaseLockOnYTranslationFromGesture(){
        this._restrictYTranslationFromGesture = false;
    }

    lockZoomFromGesture(){
        this._restrictZoomFromGesture = true;
    }

    releaseLockOnZoomFromGesture(){
        this._restrictZoomFromGesture = false;
    }

    lockRotationFromGesture(){
        this._restrictRotationFromGesture = true;
    }

    releaseLockOnRotationFromGesture(){
        this._restrictRotationFromGesture = false;
    }
    
    lockRelativeXTranslationFromGesture(){
        this._restrictRelativeXTranslationFromGesture = true;
    }

    releaseLockOnRelativeXTranslationFromGesture(){
        this._restrictRelativeXTranslationFromGesture = false;
    }

    lockRelativeYTranslationFromGesture(){
        this._restrictRelativeYTranslationFromGesture = true;
    }

    releaseLockOnRelativeYTranslationFromGesture(){
        this._restrictRelativeYTranslationFromGesture = false;
    }

    pointIsInViewPort(point: Point): boolean{
        const pointInCameraFrame = this.invertFromWorldSpace(point);
        if(pointInCameraFrame.x < 0 || pointInCameraFrame.x > this.viewPortWidth || pointInCameraFrame.y < 0 || pointInCameraFrame.y > this._viewPortHeight){
            return false;
        }
        return true;
    }

    on<K extends keyof CameraEventMapping>(eventName: K, callback: (event: CameraEventMapping[K], cameraState: CameraState)=>void): void {
        this._observer.on(eventName, callback);
    }

}

export class InvalidZoomLevelError extends Error {

    constructor(msg: string){
        super(msg);
    }
}