import { PointCal } from "point2point";
import { Point } from "../../src";
import * as easeFunctions from "../easeFunctions";

export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

export interface CameraLockableObject{
    getPosition(): Point;
    getRotation(): number;
    getOptimalZoomLevel(): number;
}

type PositionAnimation = {
    animationPercentage: number;
    easingFn: (percentage: number)=> number;
    duration: number;
    diff: Point;
}

type RotationAnimation = {
    animationPercentage: number;
    easingFn: (percentage: number)=> number;
    duration: number;
    diff: number;
}

type ZoomAnimation = {
    animationPercentage: number;
    easingFn: (percentage: number)=> number;
    duration: number;
    diff: number;
    anchorPoint?: Point;
}

export default class vCamera {

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

    private restrictXTranslationFromGesture: boolean = false;
    private restrictYTranslationFromGesture: boolean = false;

    private restrictRelativeXTranslationFromGesture: boolean = false;
    private restrictRelativeYTranslationFromGesture: boolean = false;

    private restrictZoomFromGesture: boolean = false;

    private restrictRotationFromGesture: boolean = false;

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

    setPositionFromGesture(position: Point): boolean{
        this.releasePositionFromLockedObject();
        
        if(this.restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this.restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        return this.setPosition(position);
    }

    clampPointEntireViewPort(point: Point){
        let topLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: this.viewPortHeight});
        let bottomLeftCorner = this.convert2WorldSpaceWRT(point, {x: 0, y: 0});
        let topRightCorner = this.convert2WorldSpaceWRT(point, {x: this.viewPortWidth, y: this.viewPortHeight});
        let bottomRightCorner = this.convert2WorldSpaceWRT(point, {x: this.viewPortWidth, y: 0});
        let topLeftCornerClamped = this.clampPoint(topLeftCorner);
        let topRightCornerClamped = this.clampPoint(topRightCorner);
        let bottomLeftCornerClamped = this.clampPoint(bottomLeftCorner);
        let bottomRightCornerClamped = this.clampPoint(bottomRightCorner);
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

    clampPoint(point: Point){
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
        if(this.restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this.restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        if(this.restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        if(this.restrictRelativeYTranslationFromGesture){
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
        if(this.restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this.restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        if(this.restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            let delta = PointCal.subVector(this.position, position);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
            position = PointCal.addVector(this.position, delta);
        }
        if(this.restrictRelativeYTranslationFromGesture){
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
        if(this.restrictRotationFromGesture){
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
        if(this.restrictZoomFromGesture){
            return false;
        }
        this.cancelZoomAnimation();
        this.zoomLevel = zoomLevel;
        return true;
    }

    setZoomLevelWithClampFromGesture(zoomLevel: number){
        if(this.restrictZoomFromGesture){
            return;
        }
        this.cancelZoomAnimation();
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this.zoomLevel = zoomLevel;
    }

    setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point){
        if(this.restrictZoomFromGesture){
            return;
        }
        this.cancelZoomAnimation();
        let originalAnchorInWorld = this.convert2WorldSpace(anchorInViewPort);
        zoomLevel = this.clampZoomLevel(zoomLevel);
        this.zoomLevel = zoomLevel;
        if(!this.lockPositionOnObject){
            let anchorInWorldAfterZoom = this.convert2WorldSpace(anchorInViewPort);
            const diff = PointCal.subVector(originalAnchorInWorld, anchorInWorldAfterZoom);
            this.moveWithClampEntireViewPortFromGesture(diff);
        }
    }

    setZoomLevelWithClampFromGestureAtAnchorPoint(zoomLevel: number, anchorInViewPort: Point){
        if(this.restrictZoomFromGesture){
            return;
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
        if(this.restrictXTranslationFromGesture && this.restrictYTranslationFromGesture){
            return false;
        }
        if(this.restrictRelativeXTranslationFromGesture && this.restrictRelativeYTranslationFromGesture){
            return false;
        }
        if(this.restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this.restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this.restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this.restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        return this.move(delta);
    }

    moveWithClampFromGesture(delta: Point){
        if(this.restrictXTranslationFromGesture && this.restrictYTranslationFromGesture){
            return;
        }
        if(this.restrictRelativeXTranslationFromGesture && this.restrictRelativeYTranslationFromGesture){
            return;
        }
        if(this.restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this.restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this.restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this.restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        this.moveWithClamp(delta);
    }

    moveWithClampEntireViewPortFromGesture(delta: Point){
        if(this.restrictXTranslationFromGesture && this.restrictYTranslationFromGesture){
            return;
        }
        if(this.restrictRelativeXTranslationFromGesture && this.restrictRelativeYTranslationFromGesture){
            return;
        }
        if(this.restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this.restrictYTranslationFromGesture){
            delta.y = 0;
        }
        if(this.restrictRelativeXTranslationFromGesture){
            const upDirection =  PointCal.rotatePoint({x: 0, y: 1}, this.rotation);
            const value = PointCal.dotProduct(upDirection, delta);
            delta = PointCal.multiplyVectorByScalar(upDirection, value);
        }
        if(this.restrictRelativeYTranslationFromGesture){
            const rightDirection =  PointCal.rotatePoint({x: 1, y: 0}, this.rotation);
            const value = PointCal.dotProduct(rightDirection, delta);
            delta = PointCal.multiplyVectorByScalar(rightDirection, value);
        }
        this.releaseFromLockedObject();
        this.cancelAnimations();
        this.moveWithClampEntireViewPort(delta);
    }

    moveWithClamp(delta: Point){
        const target = PointCal.addVector(this.position, delta);
        const clampedTarget = this.clampPoint(target);
        this.position = clampedTarget;
    }

    moveWithClampEntireViewPort(delta: Point){
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
        this.spinFromGesture(deltaAngle * Math.PI / 180);
    }

    spinFromGesture(deltaAngle: number){
        // in radians
        if(this.restrictRotationFromGesture){
            return;
        }
        this.releaseRotationFromLockedObject();
        this.cancelAnimations();
        this.spin(deltaAngle);
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
        return true;
    }

    getZoomLevelLimits(): {min?: number, max?: number} | undefined{
        return this.zoomLevelLimits;
    }

    convert2WorldSpaceWRT(centerPoint: Point, interestPoint: Point): Point{
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

    setPositionWithAnimation(destPos: Point, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        destPos = this.clampPoint(destPos);
        const diff = PointCal.subVector(destPos, this.position);
        this.positionAnimation.animationPercentage = 0;
        this.positionAnimation.duration = duration;
        this.positionAnimation.easingFn = easeFunction;
        this.positionAnimation.diff = diff;
    }

    setRotationWithAnimation(destRotation: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        const diff = this.getAngleSpan(destRotation);
        this.rotationAnimation.diff = diff;
        this.rotationAnimation.duration = duration;
        this.rotationAnimation.animationPercentage = 0;
        this.rotationAnimation.easingFn = easeFunction;
    }

    spinWithAnimationFromGesture(angleSpan: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        if(this.restrictRotationFromGesture){
            return;
        }
        this.releaseRotationFromLockedObject();
        this.rotationAnimation.diff = angleSpan;
        this.rotationAnimation.animationPercentage = 0;
        this.rotationAnimation.duration = duration;
        this.rotationAnimation.easingFn = easeFunction;
    }

    setZoomWithAnimation(destZoomLevel: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        destZoomLevel = this.clampZoomLevel(destZoomLevel);
        const diff = destZoomLevel - this.zoomLevel;
        this.zoomAnimation.diff = diff;
        this.zoomAnimation.easingFn = easeFunction;
        this.zoomAnimation.animationPercentage = 0;
        this.zoomAnimation.duration = duration;
    }

    setZoomAnimationWithAnchor(destZoomLevel: number, anchorPointInViewPort: Point, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
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
        this.restrictXTranslationFromGesture = true;
        this.restrictYTranslationFromGesture = true;
    }

    releaseLockOnTranslationFromGesture(){
        this.restrictXTranslationFromGesture = false;
        this.restrictYTranslationFromGesture = false;
    }

    lockXTranslationFromGesture(){
        this.restrictXTranslationFromGesture = true;
    }

    releaseLockOnXTranslationFromGesture(){
        this.restrictXTranslationFromGesture = false;
    }

    lockYTranslationFromGesture(){
        this.restrictYTranslationFromGesture = true;
    }

    releaseLockOnYTranslationFromGesture(){
        this.restrictYTranslationFromGesture = false;
    }

    lockZoomFromGesture(){
        this.restrictZoomFromGesture = true;
    }

    releaseLockOnZoomFromGesture(){
        this.restrictZoomFromGesture = false;
    }

    lockRotationFromGesture(){
        this.restrictRotationFromGesture = true;
    }

    releaseLockOnRotationFromGesture(){
        this.restrictRotationFromGesture = false;
    }
    
    lockRelativeXTranslationFromGesture(){
        this.restrictRelativeXTranslationFromGesture = true;
    }

    releaseLockOnRelativeXTranslationFromGesture(){
        this.restrictRelativeXTranslationFromGesture = false;
    }

    lockRelativeYTranslationFromGesture(){
        this.restrictRelativeYTranslationFromGesture = true;
    }

    releaseLockOnRelativeYTranslationFromGesture(){
        this.restrictRelativeYTranslationFromGesture = false;
    }

}

export class InvalidZoomLevelError extends Error {

    constructor(msg: string){
        super(msg);
    }
}