import { PointCal } from "point2point";
import { Point } from "../../src";


export type CameraOptions = {
    initialPosition?: Point;
    initialZoom?: number;
    initialRotation?: number;
}

export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

const defaultCameraOptions: CameraOptions = {
    initialPosition: {x: 0, y: 0},
    initialZoom: 1,
    initialRotation: 0
}

interface CameraLockableObject{
    getPosition(): Point;
    getRotation(): number;
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
        if(!this.withinBoundaries(position) || this.cameraLocked()){
            return false;
        }
        this.position = position;
        return true;
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
        if (this.cameraLocked()){
            return;
        }
        if (this.withinBoundaries(position)){
            this.position = position;
        } else {
            this.position = this.clampPoint(position);
        }
    }

    setRotation(rotation: number){
        if(this.cameraLocked()){
            return;
        }
        rotation = this.normalizeAngleZero2TwoPI(rotation);
        this.rotation = rotation;
    }
    
    setRotationDeg(rotationDeg: number){
        this.setRotation(rotationDeg * Math.PI / 180);
    }

    setZoomLevel(zoomLevel: number){
        if(this.zoomLevelLimits !== undefined && 
        ((this.zoomLevelLimits.max !== undefined && this.zoomLevelLimits.max < zoomLevel) || 
         (this.zoomLevelLimits.min !== undefined && this.zoomLevelLimits.min > zoomLevel)
        )){
            return false;
        }
        this.zoomLevel = zoomLevel;
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
        if(!this.withinBoundaries(PointCal.addVector(this.position, delta)) || this.cameraLocked()){
            return false;
        }
        this.position = PointCal.addVector(this.position, delta);
        return true;
    }

    moveWithClamp(delta: Point){
        if(this.cameraLocked()){
            return;
        }
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

        // force it to be the positive remainder, so that 0 <= angle < 360  
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

    spin(deltaAngle: number){
        // in radians
        if(this.cameraLocked()){
            return;
        }
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
        this.lockOnObject = undefined;
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
    }

    cameraLocked(): boolean{
        if(this.lockOnObject != undefined){
            return true;
        }
        return false;
    }

    releaseFromLockedObject(){
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

}

export class InvalidZoomLevelError extends Error {

    constructor(msg: string){
        super(msg);
    }
}