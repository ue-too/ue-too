import { PointCal } from "point2point";
import { Point } from "..";
import { EaseFunctions } from "../ease-functions";
import { EaseFunction } from "../ease-functions";

export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

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
 * @translation test string
 */
export default class BoardCamera {

    /**!SECTION
     * @translation test string for position
     */
    private position: Point;
    private zoomLevel: number;
    private rotation: number;
    
    private boundaries: {min: {x?: number, y?: number}, max: {x?: number, y?: number}};
    private zoomLevelLimits: {min?: number, max?: number};

    private viewPortWidth: number;
    private viewPortHeight: number;

    private lockOnObject: CameraLockableObject;
    private lockRotationOnObject: boolean = false;
    private lockPositionOnObject: boolean = false;

    private positionAnimation: PositionAnimation;
    private rotationAnimation: RotationAnimation;
    private zoomAnimation: ZoomAnimation;

    private _restrictXTranslationFromGesture: boolean = false;

    get restrictXTranslationFromGesture(): boolean {
        return this._restrictXTranslationFromGesture;
    }

    private _restrictYTranslationFromGesture: boolean = false;

    get restrictYTranslationFromGesture(): boolean {
        return this._restrictYTranslationFromGesture;
    }

    private _restrictRelativeXTranslationFromGesture: boolean = false;

    get restrictRelativeXTranslationFromGesture(): boolean {
        return this._restrictRelativeXTranslationFromGesture;
    }

    private _restrictRelativeYTranslationFromGesture: boolean = false;

    get restrictRelativeYTranslationFromGesture(): boolean {
        return this._restrictRelativeYTranslationFromGesture;
    }

    private _restrictZoomFromGesture: boolean = false;

    get restrictZoomFromGesture(): boolean {
        return this._restrictZoomFromGesture;
    }

    /**!SECTION
     * @translation restrict on rotation
     */
    private _restrictRotationFromGesture: boolean = false;

    get restrictRotationFromGesture(): boolean {
        return this._restrictRotationFromGesture;
    }

    /**
     * 
     * @translation this is the board camera
     */
    constructor(position: Point = {x: 0, y: 0}, viewPortWidth: number = 1000, viewPortHeight: number = 1000, zoomLevel: number =  1, rotation: number = 0){
        if (!this.zoomLevelValid(zoomLevel)){
            throw new InvalidZoomLevelError("zoom level cannot be less than or equal to 0");
        }
        this.position = position;
        this.zoomLevel = zoomLevel;
        this.rotation = rotation;
        this.viewPortHeight = viewPortHeight;
        this.viewPortWidth = viewPortWidth;
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

    zoomLevelValid(zoomLevel: number){
        if(zoomLevel <= 0){
            return false;
        }
        return true;
    }

    setViewPortWidth(width: number){
        this.viewPortWidth = width;
    }

    getViewPortWidth(): number{
        return this.viewPortWidth;
    }

    setViewPortHeight(height: number){
        this.viewPortHeight = height;
    }

    getViewPortHeight(): number{
        return this.viewPortHeight;
    }
    
    setPosition(position: Point): boolean{
        if(!this.withinBoundaries(position)){
            return false;
        }
        this.position = position;
        return true;
    }

    /**
     * @translation another test string
     */
    setPositionFromGesture(position: Point): boolean{
        this.releasePositionFromLockedObject();
        
        if(this._restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        return this.setPosition(position);
    }

    clampPointEntireViewPort(point: Point){
        let topLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: this.viewPortHeight});
        let bottomLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: 0});
        let topRightCorner = this.convert2WorldSpaceWRT(point, {x: this.viewPortWidth, y: this.viewPortHeight});
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
    
    clampPointWithRes(point: Point): {clipped: boolean, point: Point}{
        if(this.withinBoundaries(point)){
            return {clipped: false, point: point};
        }
        let manipulatePoint = {x: point.x, y: point.y};
        let limit = this.boundaries.min;
        if (limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.max(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.max(manipulatePoint.y, limit.y);
            }
        }
        limit = this.boundaries.max;
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

    clampPoint(point: Point): Point{
        if(this.withinBoundaries(point)){
            return point;
        }
        let manipulatePoint = {x: point.x, y: point.y};
        let limit = this.boundaries.min;
        if (limit != undefined){
            if(limit.x != undefined){
                manipulatePoint.x = Math.max(manipulatePoint.x, limit.x);
            }
            if(limit.y != undefined){
                manipulatePoint.y = Math.max(manipulatePoint.y, limit.y);
            }
        }
        limit = this.boundaries.max;
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

    setPositionWithClamp(position: Point) {
        this.cancelPositionAnimation();
        if (this.withinBoundaries(position)){
            this.position = position;
        } else {
            this.position = this.clampPoint(position);
        }
    }

    setPositionWithClampEntireViewPort(position: Point){
        this.cancelPositionAnimation();
        this.position = this.clampPointEntireViewPort(position);
    }

    setPositionWithClampEntireViewPortFromGesture(position: Point) {
        if(this._restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        this.cancelAnimations();
        this.releasePositionFromLockedObject();
        this.setPositionWithClampEntireViewPort(position);
    }


    setPositionWithClampFromGesture(position: Point) {
        if(this._restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this._restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        this.cancelAnimations();
        this.releasePositionFromLockedObject();
        this.setPositionWithClamp(position);
    }

    setRotation(rotation: number){
        rotation = this.normalizeAngleZero2TwoPI(rotation);
        this.rotation = rotation;
    }

    setRotationFromGesture(rotation: number){
        if(this._restrictRotationFromGesture){
            return;
        }
        this.releaseRotationFromLockedObject();
        this.cancelAnimations();
        this.setRotation(rotation);
    }
    
    setRotationDegFromGesture(rotationDeg: number){
        this.setRotationFromGesture(rotationDeg * Math.PI / 180);
    }
    
    setRotationDeg(rotationDeg: number){
        this.setRotation(rotationDeg * Math.PI / 180);
    }

    setZoomLevel(zoomLevel: number){
        if(!this.zoomLevelWithinLimits(zoomLevel)){
            return false;
        }
        this.zoomLevel = zoomLevel;
        return true;
    }

    setZoomLevelWithClamp(zoomLevel: number){
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this.zoomLevel = zoomLevel;
    }

    setZoomLevelFromGesture(zoomLevel: number){
        if(!this.zoomLevelWithinLimits(zoomLevel)){
            return false;
        }
        if(this._restrictZoomFromGesture){
            return false;
        }
        this.cancelZoomAnimation();
        this.zoomLevel = zoomLevel;
        return true;
    }

    setZoomLevelWithClampFromGesture(zoomLevel: number){
        if(this._restrictZoomFromGesture){
            return;
        }
        this.cancelZoomAnimation();
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this.zoomLevel = zoomLevel;
    }

    setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point): CameraZoomResult{
        if(this._restrictZoomFromGesture){
            return {success: false};
        }
        this.cancelZoomAnimation();
        let originalAnchorInWorld = this.convert2WorldSpace(anchorInViewPort);
        const originalZoomLevel = this.zoomLevel;
        if(this.zoomLevelLimits.max !== undefined && this.clampZoomLevel(zoomLevel) == this.zoomLevelLimits.max && this.zoomLevel == this.zoomLevelLimits.max){
            return {success: false};
        }
        if(this.zoomLevelLimits.min !== undefined && this.clampZoomLevel(zoomLevel) == this.zoomLevelLimits.min && this.zoomLevel == this.zoomLevelLimits.min){
            return {success: false};
        }
        zoomLevel = this.clampZoomLevel(zoomLevel);
        const deltaZoomAmount = zoomLevel - originalZoomLevel;
        this.zoomLevel = zoomLevel;
        if(!this.lockPositionOnObject){
            let anchorInWorldAfterZoom = this.convert2WorldSpace(anchorInViewPort);
            const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
            const res = this.moveWithClampEntireViewPortFromGesture(diff);
        }
        return {success: true, deltaZoomAmount: deltaZoomAmount, resultingZoomLevel: zoomLevel};
    }

    setZoomLevelWithClampFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point): boolean{
        if(this._restrictZoomFromGesture){
            return false;
        }
        this.cancelZoomAnimation();
        let originalAnchorInWorld = this.convert2WorldSpace(anchorInViewPort);
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this.zoomLevel = zoomLevel;
        if(!this.lockPositionOnObject){
            let anchorInWorldAfterZoom = this.convert2WorldSpace(anchorInViewPort);
            const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
            this.moveWithClampFromGesture(diff);
        }
        return true;
    }

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
        if(this.boundaries == undefined){
            this.boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this.boundaries.min.x = min;
        this.boundaries.max.x = max;
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
        if(this.boundaries == undefined){
            this.boundaries = {min: {x: undefined, y: undefined}, max: {x: undefined, y: undefined}};
        }
        this.boundaries.min.y = min;
        this.boundaries.max.y = max;
    }

    getPosition(): Point{
        return this.position;
    }

    getZoomLevel(): number{
        return this.zoomLevel;
    }

    getRotation(): number{
        return this.rotation;
    }

    getRotationDeg(): number{
        return this.rotation * 180 / Math.PI
    }

    getBoundaries(): Boundaries | undefined {
        return this.boundaries;
    }

    withinBoundaries(point: Point): boolean{
        if(this.boundaries == undefined){
            // no boundaries 
            return true;
        }
        let leftSide = false;
        let rightSide = false;
        let topSide = false;
        let bottomSide = false;
        // check within boundaries horizontally
        if(this.boundaries.max.x == undefined || point.x <= this.boundaries.max.x){
            rightSide = true;
        }
        if(this.boundaries.min.x == undefined || point.x >= this.boundaries.min.x){
            leftSide = true;
        }
        if(this.boundaries.max.y == undefined || point.y <= this.boundaries.max.y){
            topSide = true;
        }
        if(this.boundaries.min.y == undefined || point.y >= this.boundaries.min.y){
            bottomSide = true;
        }
        return leftSide && rightSide && topSide && bottomSide;
    }

    move(delta: Point){
        if(!this.withinBoundaries(PointCal.addVector(this.position, delta))){
            return false;
        }
        this.position = PointCal.addVector(this.position, delta);
        return true;
    }

    moveFromGesture(delta: Point){
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return false;
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return false;
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        return this.move(delta);
    }

    moveWithClampFromGesture(delta: Point): boolean{
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return false;
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return false;
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        this.moveWithClamp(delta);
        return true;
    }

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
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        const res = this.moveWithClampEntireViewPort(delta);
        if(res.moved){
            return {success: res.moved, deltaPosition: res.actualDelta, resultingPosition: this.position};
        }
        return {success: false}
    }

    moveWithClampEntireViewPortFromGestureBypass(delta: Point){
        if(this._restrictXTranslationFromGesture && this._restrictYTranslationFromGesture){
            return false;
        }
        if(this._restrictRelativeXTranslationFromGesture && this._restrictRelativeYTranslationFromGesture){
            return false;
        }
        if(this._restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this._restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this._restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this._restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        return this.moveWithClampEntireViewPort(delta);
    }

    moveWithClamp(delta: Point){
        const target = PointCal.addVector(this.position, delta);
        const clampedTarget = this.clampPoint(target);
        this.position = clampedTarget;
    }

    moveWithClampEntireViewPort(delta: Point): {moved: boolean, actualDelta: Point}{
        const target = PointCal.addVector(this.position, delta);
        const clampedTarget = this.clampPointEntireViewPort(target);
        const diff = PointCal.subVector(clampedTarget, this.position);
        if(PointCal.magnitude(diff) < 10E-10 && PointCal.magnitude(diff) < 1 / this.zoomLevel){
            return {moved: false, actualDelta: {x: 0, y: 0}};
        }
        const actualDelta = PointCal.subVector(clampedTarget, this.position);
        this.position = clampedTarget;
        return {moved: true, actualDelta: actualDelta};
    }

    moveWithClampEntireViewPortBypass(delta: Point){
        const target = PointCal.addVector(this.position, delta);
        const clampedTarget = this.clampPointEntireViewPort(target);
        this.position = clampedTarget;
    }

    resetZoomLevel(){
        this.zoomLevel = 1;
    }

    normalizeAngleZero2TwoPI(angle: number){
        // reduce the angle  
        angle = angle % (Math.PI * 2);

        // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI 
        angle = (angle + Math.PI * 2) % (Math.PI * 2); 
        return angle;
    }

    getAngleSpan(angle: number): number{
        // in radians
        angle = this.normalizeAngleZero2TwoPI(angle);
        let angleDiff = angle - this.rotation;
        
        if(angleDiff > Math.PI){
            angleDiff = - (Math.PI * 2 - angleDiff);
        }

        if(angleDiff < -Math.PI){
            angleDiff += (Math.PI * 2);
        }
        return angleDiff;
    }

    getAngleSpanDeg(angle: number): number{
        // in degrees
        return this.getAngleSpan(angle * Math.PI / 180) * 180 / Math.PI;
    }

    spinDeg(deltaAngle: number){
        // in degrees
        this.spin(deltaAngle * Math.PI / 180);
    }

    spinDegFromGesture(deltaAngle: number){
        // in degrees
        return this.spinFromGesture(deltaAngle * Math.PI / 180);
    }

    spinFromGesture(deltaAngle: number){
        // in radians
        if(this._restrictRotationFromGesture){
            return false;
        }
        this.releaseRotationFromLockedObject();
        this.cancelAnimations();
        this.spin(deltaAngle);
        return true;
    }

    spin(deltaAngle: number){
        // in radians
        this.rotation = this.normalizeAngleZero2TwoPI(this.rotation + deltaAngle);
    }

    setMaxZoomLevel(maxZoomLevel: number){
        if(this.zoomLevelLimits == undefined){
            this.zoomLevelLimits = {min: undefined, max: undefined};
        }
        if((this.zoomLevelLimits.min != undefined && this.zoomLevelLimits.min > maxZoomLevel) || this.zoomLevel > maxZoomLevel){
            return false;
        }
        this.zoomLevelLimits.max = maxZoomLevel;
        return true
    }

    setMinZoomLevel(minZoomLevel: number){
        if(this.zoomLevelLimits == undefined){
            this.zoomLevelLimits = {min: undefined, max: undefined};
        }
        if((this.zoomLevelLimits.max != undefined && this.zoomLevelLimits.max < minZoomLevel) || this.zoomLevel < minZoomLevel){
            return false;
        }
        this.zoomLevelLimits.min = minZoomLevel;
        if(this.zoomLevel < minZoomLevel){
            this.zoomLevel = minZoomLevel;
        }
        return true;
    }

    getZoomLevelLimits(): {min?: number, max?: number} | undefined{
        return this.zoomLevelLimits;
    }

    convert2WorldSpaceWRT(centerPoint: Point, interestPoint: Point): Point{
        // the coordinate for the interest point is relative to the center point
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this.viewPortHeight / 2};
        let delta2Point = PointCal.subVector(interestPoint, cameraFrameCenter);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / this.zoomLevel);
        delta2Point = PointCal.rotatePoint(delta2Point, this.rotation);
        return PointCal.addVector(centerPoint, delta2Point);
    }

    convert2WorldSpace(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this.viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, cameraFrameCenter);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / this.zoomLevel);
        delta2Point = PointCal.rotatePoint(delta2Point, this.rotation);
        return PointCal.addVector(this.position, delta2Point);
    }

    invertFromWorldSpace(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this.viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, this.position);
        delta2Point = PointCal.rotatePoint(delta2Point, -this.rotation);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, this.zoomLevel);
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    resetCamera(){
        this.releaseFromLockedObject();
        this.position = {x: 0, y: 0};
        this.rotation = 0;
        this.zoomLevel = 1;
    }

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

    cameraPositionLockedOnObject(): boolean{
        return this.lockPositionOnObject;
    }

    cameraRotationLockedOnObject(): boolean{
        return this.lockRotationOnObject;
    }

    releaseFromLockedObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.lockOnObject = undefined;
        this.releasePositionFromLockedObject();
        this.releaseRotationFromLockedObject();
    }

    releasePositionFromLockedObject(){
        this.lockPositionOnObject = false;
    }

    releaseRotationFromLockedObject(){
        this.lockRotationOnObject = false;
    }

    updatePositionToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.position = this.clampPoint(this.lockOnObject.getPosition());
    }

    updateRotationToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.rotation = this.normalizeAngleZero2TwoPI(-this.lockOnObject.getRotation());
    }

    updateZoomLevelToLockedOnObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.setZoomLevelWithClamp(this.lockOnObject.getOptimalZoomLevel());
    }

    setPositionWithAnimation(destPos: Point, duration: number = 1, easeFunction: EaseFunction = EaseFunctions.easeInOutSine){
        destPos = this.clampPoint(destPos);
        const diff = PointCal.subVector(destPos, this.position);
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
        const diff = destZoomLevel - this.zoomLevel;
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
        const diff = destZoomLevel - this.zoomLevel;
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
                this.zoomLevel = this.zoomLevel + this.zoomAnimation.diff * percentageOnDeltaZoom; 
                let anchorInWorldAfterZoom = this.convert2WorldSpace(this.zoomAnimation.anchorPoint);
                const diff = PointCal.subVector(anchorInWorld, anchorInWorldAfterZoom);
                this.moveWithClamp(diff);
            } else {
                this.zoomLevel = this.zoomLevel + this.zoomAnimation.diff * percentageOnDeltaZoom; 
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
        if(pointInCameraFrame.x < 0 || pointInCameraFrame.x > this.viewPortWidth || pointInCameraFrame.y < 0 || pointInCameraFrame.y > this.viewPortHeight){
            return false;
        }
        return true;
    }

}

export class InvalidZoomLevelError extends Error {

    constructor(msg: string){
        super(msg);
    }
}