import { PointCal } from "point2point";
import { Point } from "../../src";
import * as easeFunctions from "../easeFunctions";

export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

interface CameraLockableObject{
    getPosition(): Point;
    getRotation(): number;
    getOptimalZoomLevel(): number;
}

export class vCamera {

    private position: Point;
    private zoomLevel: number;
    private rotation: number;
    
    private boundaries: {min: {x?: number, y?: number}, max: {x?: number, y?: number}};
    private zoomLevelLimits: {min?: number, max?: number};

    private viewPortWidth: number;
    private viewPortHeight: number;

    private lockOnObject: CameraLockableObject;

    private positionAnimationPercentage: number = 1.1;
    private rotationAnimationPercentage: number = 1.1;
    private zoomAnimationPercentage: number = 1.1;

    private restrictXTranslationFromGesture: boolean = false;
    private restrictYTranslationFromGesture: boolean = false;

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
        if(this.cameraLocked()){
            return false;
        }
        if(this.restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this.restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        return this.setPosition(position);
    }

    clampPoint(point: Point){
        if(this.withinBoundaries(point)){
            return point;
        }
        let limit = this.boundaries.min;
        if (limit != undefined){
            if(limit.x != undefined){
                point.x = Math.max(point.x, limit.x);
            }
            if(limit.y != undefined){
                point.y = Math.max(point.y, limit.y);
            }
        }
        limit = this.boundaries.max;
        if(limit != undefined){
            if(limit.x != undefined){
                point.x = Math.min(point.x, limit.x);
            }
            if(limit.y != undefined){
                point.y = Math.min(point.y, limit.y);
            }
        }
        return point;
    }

    setPositionWithClamp(position: Point) {
        this.cancelPositionAnimation();
        if (this.withinBoundaries(position)){
            this.position = position;
        } else {
            this.position = this.clampPoint(position);
        }
    }

    setPositionWithClampFromGesture(position: Point) {
        if (this.cameraLocked()){
            return;
        }
        if(this.restrictXTranslationFromGesture){
            position.x = this.position.x;
        }
        if(this.restrictYTranslationFromGesture){
            position.y = this.position.y;
        }
        this.cancelAnimations();
        this.setPositionWithClamp(position);
    }

    setRotation(rotation: number){
        rotation = this.normalizeAngleZero2TwoPI(rotation);
        this.rotation = rotation;
    }

    setRotationFromGesture(rotation: number){
        if(this.cameraLocked()){
            return;
        }
        if(this.restrictRotationFromGesture){
            return;
        }
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
        if(this.cameraLocked()){
            return false;
        }
        if(this.restrictXTranslationFromGesture && this.restrictYTranslationFromGesture){
            return false;
        }
        if(this.restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this.restrictYTranslationFromGesture){
            delta.y = 0;
        }
        this.cancelAnimations();
        return this.move(delta);
    }

    moveWithClampFromGesture(delta: Point){
        if(this.cameraLocked()){
            return;
        }
        if(this.restrictXTranslationFromGesture && this.restrictYTranslationFromGesture){
            return false;
        }
        if(this.restrictXTranslationFromGesture){
            delta.x = 0;
        }
        if(this.restrictYTranslationFromGesture){
            delta.y = 0;
        }
        this.cancelAnimations();
        this.moveWithClamp(delta);
    }

    moveWithClamp(delta: Point){
        const target = PointCal.addVector(this.position, delta);
        const clampedTarget = this.clampPoint(target);
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
        if(this.cameraLocked()){
            return;
        }
        if(this.restrictRotationFromGesture){
            return;
        }
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

    convert2WorldSpace(point: Point): Point{
        let cameraFrameCenter = {x: this.viewPortWidth / 2, y: this.viewPortHeight / 2};
        let delta2Point = PointCal.subVector(point, cameraFrameCenter);
        delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / this.zoomLevel);
        delta2Point = PointCal.rotatePoint(delta2Point, this.rotation);
        return PointCal.addVector(this.position, delta2Point);
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
        this.updatePositionToLockedOnObject();
        this.updateRotationToLockedOnObject();
        this.updateZoomLevelToLockedOnObject();
    }

    cameraLocked(): boolean{
        if(this.lockOnObject != undefined){
            return true;
        }
        return false;
    }

    releaseFromLockedObject(){
        if(this.lockOnObject == undefined){
            return;
        }
        this.lockOnObject = undefined;
    }

    updatePositionToLockedOnObject(){
        if(this.lockOnObject != undefined){
            this.position = this.clampPoint(this.lockOnObject.getPosition());
        }
    }

    updateRotationToLockedOnObject(){
        if(this.lockOnObject != undefined){
            this.rotation = this.normalizeAngleZero2TwoPI(this.lockOnObject.getRotation());
        }
    }

    updateZoomLevelToLockedOnObject(){
        if(!this.cameraLocked()){
            return;
        }
        this.setZoomLevelWithClamp(this.lockOnObject.getOptimalZoomLevel());
    }

    setPositionWithAnimation(destPos: Point, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        this.releaseFromLockedObject();
        destPos = this.clampPoint(destPos);
        const diff = PointCal.subVector(destPos, this.position);
        const animationSpeed = 1 / duration; // how many percent in decimal per second
        this.positionAnimationPercentage = 0;
        this.updatePosition = ((deltaTime: number) => {
            if (this.positionAnimationPercentage <= 1){
                let currentDeltaPercentage = deltaTime * animationSpeed;
                // console.log("current camera position animation percentage", this.positionAnimationPercentage);
                let targetPercentage = this.positionAnimationPercentage + currentDeltaPercentage;
                let percentageOnDeltaMovement = easeFunction(targetPercentage) - easeFunction(this.positionAnimationPercentage)
                if (targetPercentage > 1){
                    percentageOnDeltaMovement = easeFunction(1) - easeFunction(this.positionAnimationPercentage);
                }
                this.moveWithClamp(PointCal.multiplyVectorByScalar(diff, percentageOnDeltaMovement));
                this.positionAnimationPercentage = targetPercentage;
            }
        }).bind(this);
    }

    setRotationWithAnimation(destRotation: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        this.releaseFromLockedObject();
        const diff = this.getAngleSpan(destRotation);
        // console.log("diff angle", diff);
        const animationSpeed = 1 / duration; // how many percent in decimal per second
        this.rotationAnimationPercentage = 0;
        this.updateRotation = ((deltaTime: number) => {
            if (this.rotationAnimationPercentage <= 1){
                let currentDeltaPercentage = deltaTime * animationSpeed;
                // console.log("current camera rotation animation percentage", this.rotationAnimationPercentage);
                let targetPercentage = this.rotationAnimationPercentage + currentDeltaPercentage;
                let percentageOnDeltaRotation = easeFunction(targetPercentage) - easeFunction(this.rotationAnimationPercentage)
                if (targetPercentage > 1){
                    percentageOnDeltaRotation = easeFunction(1) - easeFunction(this.rotationAnimationPercentage);
                }
                this.spin(diff * percentageOnDeltaRotation);
                this.rotationAnimationPercentage = targetPercentage;
            }
        }).bind(this);
    }

    spinWithAnimationFromGesture(angleSpan: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        if(this.cameraLocked()){
            return;
        }
        if(this.restrictRotationFromGesture){
            return;
        }
        const diff = angleSpan;
        // console.log("diff angle", diff);
        const animationSpeed = 1 / duration; // how many percent in decimal per second
        this.rotationAnimationPercentage = 0;
        this.updateRotation = ((deltaTime: number) => {
            if (this.rotationAnimationPercentage <= 1){
                let currentDeltaPercentage = deltaTime * animationSpeed;
                // console.log("current camera rotation animation percentage", this.rotationAnimationPercentage);
                let targetPercentage = this.rotationAnimationPercentage + currentDeltaPercentage;
                let percentageOnDeltaRotation = easeFunction(targetPercentage) - easeFunction(this.rotationAnimationPercentage)
                if (targetPercentage > 1){
                    percentageOnDeltaRotation = easeFunction(1) - easeFunction(this.rotationAnimationPercentage);
                }
                this.spin(diff * percentageOnDeltaRotation);
                this.rotationAnimationPercentage = targetPercentage;
            }
        }).bind(this);
    }

    setZoomWithAnimation(destZoomLevel: number, duration: number = 1, easeFunction: (t: number)=> number = easeFunctions.easeInOutSine){
        this.releaseFromLockedObject();
        destZoomLevel = this.clampZoomLevel(destZoomLevel);
        const diff = destZoomLevel - this.zoomLevel;
        // console.log("diff angle", diff);
        const animationSpeed = 1 / duration; // how many percent in decimal per second
        this.zoomAnimationPercentage = 0;
        this.updateZoomLevel = ((deltaTime: number) => {
            if (this.zoomAnimationPercentage <= 1){
                let currentDeltaPercentage = deltaTime * animationSpeed;
                // console.log("current camera rotation animation percentage", this.rotationAnimationPercentage);
                let targetPercentage = this.zoomAnimationPercentage + currentDeltaPercentage;
                let percentageOnDeltaZoom = easeFunction(targetPercentage) - easeFunction(this.zoomAnimationPercentage)
                if (targetPercentage > 1){
                    percentageOnDeltaZoom = easeFunction(1) - easeFunction(this.zoomAnimationPercentage);
                }
                this.zoomLevel = this.zoomLevel + diff * percentageOnDeltaZoom;
                this.zoomAnimationPercentage = targetPercentage;
            }
        }).bind(this);
    }

    cancelAnimations(){
        this.cancelPositionAnimation();
        this.cancelRotationAnimation();
        this.cancelZoomAnimation();
    }

    cancelPositionAnimation(){
        this.positionAnimationPercentage = 1.1;
    }

    cancelRotationAnimation(){
        this.rotationAnimationPercentage = 1.1;
    }

    cancelZoomAnimation(){
        this.zoomAnimationPercentage = 1.1;
    }

    updatePosition(deltaTime: number){

    }

    updateRotation(deltaTime: number){

    }

    updateZoomLevel(deltaTime: number){

    }

    step(deltaTime: number){
        // deltaTime in seconds;
        if (this.cameraLocked()){
            this.updatePositionToLockedOnObject();
            this.updateRotationToLockedOnObject();
            return;
        }
        this.updatePosition(deltaTime);
        this.updateRotation(deltaTime);
        this.updateZoomLevel(deltaTime);
    }

    resetCameraWithAnimation(){
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

}

export class InvalidZoomLevelError extends Error {

    constructor(msg: string){
        super(msg);
    }
}