import { Point, PointCal } from "@ue-too/math";

export type HandleType = "ALIGNED" | "VECTOR" | "FREE";

export type HandlePoint = {
    position: Point;
    type: HandleType;
}

export class ControlPoint {

    private position: Point;
    private leftHandle: HandlePoint;
    private rightHandle: HandlePoint;

    constructor(position: Point, leftHandle: HandlePoint, rightHandle: HandlePoint){
        this.position = position;
        this.leftHandle = leftHandle;
        this.rightHandle = rightHandle;
    }

    setPosition(destinationPosition: Point, prevControlPoint: ControlPoint | undefined, nextControlPoint: ControlPoint | undefined){
        let diff = PointCal.subVector(destinationPosition, this.position);
        this.position = destinationPosition;
        this.leftHandle.position = PointCal.addVector(this.leftHandle.position, diff);
        this.rightHandle.position = PointCal.addVector(this.rightHandle.position, diff);
        if(this.leftHandle.type == "VECTOR" && prevControlPoint){
            let relativeVector = PointCal.subVector(prevControlPoint.getPosition(), this.position);
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
            this.leftHandle.position = PointCal.addVector(this.position, relativeVector);
            if(this.rightHandle.type == "ALIGNED"){
                let relativeVector = PointCal.subVector(this.rightHandle.position, this.position);
                let mag = PointCal.magnitude(relativeVector);
                let direction = PointCal.unitVectorFromA2B(this.leftHandle.position, this.position);
                this.rightHandle.position = PointCal.addVector(this.position, PointCal.multiplyVectorByScalar(direction, mag));
            }
        }
        if(this.rightHandle.type == "VECTOR" && nextControlPoint){
            let relativeVector = PointCal.subVector(nextControlPoint.getPosition(), this.position);
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
            this.rightHandle.position = PointCal.addVector(this.position, relativeVector);
            if(this.leftHandle.type == "ALIGNED"){
                let mag = PointCal.distanceBetweenPoints(this.leftHandle.position, this.position);
                let direction = PointCal.subVector(this.position, this.rightHandle.position);
                this.leftHandle.position = PointCal.addVector(this.position, PointCal.multiplyVectorByScalar(direction, mag));
            }
        }
        if(prevControlPoint !== undefined && prevControlPoint.getRightHandle().type == "VECTOR"){
            let relativeVector = PointCal.subVector(this.position, prevControlPoint.getPosition());
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
            prevControlPoint.setRightHandlePosition(PointCal.addVector(prevControlPoint.getPosition(), relativeVector));
        }
        if(nextControlPoint !== undefined && nextControlPoint.getLeftHandle().type == "VECTOR"){
            let relativeVector = PointCal.subVector(this.position, nextControlPoint.getPosition());
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
            nextControlPoint.setLeftHandlePosition(PointCal.addVector(nextControlPoint.getPosition(), relativeVector));
        }
    }

    getPosition(): Point{
        return this.position;
    }

    setLeftHandleTypeVector(prevControlPoint: ControlPoint | undefined){
        if(this.rightHandle.type != "VECTOR"){
            this.rightHandle.type = "FREE";
        }
        let relativeVector: Point;
        if(prevControlPoint == undefined){
            relativeVector = PointCal.subVector(this.leftHandle.position, this.position);
        } else {
            relativeVector = PointCal.subVector(prevControlPoint.getPosition(), this.position);
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
        }
        this.leftHandle.position = PointCal.addVector(this.position, relativeVector);
    }

    setLeftHandleTypeAligned(){
        this.leftHandle.type = "ALIGNED";
        if(this.rightHandle.type == "VECTOR"){
            let direction = PointCal.unitVectorFromA2B(this.rightHandle.position, this.position);
            let mag = PointCal.distanceBetweenPoints(this.position, this.leftHandle.position);
            this.leftHandle.position = PointCal.addVector(this.position, PointCal.multiplyVectorByScalar(direction, mag));
        }
    }

    setLeftHandleTypeFree(){
        this.leftHandle.type = "FREE";
    }

    setRightHandleTypeVector(nextControlPoint: ControlPoint | undefined) {
        if(this.leftHandle.type != "VECTOR"){
            this.leftHandle.type = "FREE";
        }
        let relativeVector: Point;
        if(nextControlPoint == undefined){
            relativeVector = PointCal.subVector(this.rightHandle.position, this.position);
        } else {
            relativeVector = PointCal.subVector(nextControlPoint.getPosition(), this.position);
            relativeVector = PointCal.multiplyVectorByScalar(relativeVector, 1 / 3);
        }
        this.rightHandle.position = PointCal.addVector(this.position, relativeVector);
    }

    setRightHandleTypeAligned(){
        this.rightHandle.type = "ALIGNED";
        if(this.leftHandle.type == "VECTOR") {
            let direciton = PointCal.unitVectorFromA2B(this.leftHandle.position, this.position);
            let mag = PointCal.distanceBetweenPoints(this.position, this.rightHandle.position);
            this.rightHandle.position = PointCal.addVector(this.position, PointCal.multiplyVectorByScalar(direciton, mag));
        } 
    }

    setRightHandleTypeFree(){
        this.rightHandle.type = "FREE";
    }

    setLeftHandlePosition(destPos: Point){
        let leftHandleType = this.leftHandle.type;
        switch(leftHandleType){
            case "ALIGNED":
                if(this.rightHandle.type == "VECTOR"){
                    let diff = PointCal.subVector(destPos, this.position);
                    let rightHandleDiff = PointCal.unitVectorFromA2B(this.rightHandle.position, this.position);
                    let resMag = PointCal.dotProduct(diff, rightHandleDiff);
                    let res = PointCal.multiplyVectorByScalar(rightHandleDiff, resMag);
                    this.leftHandle.position = PointCal.addVector(this.position, res);
                } else if (this.rightHandle.type == "ALIGNED"){
                    this.leftHandle.position = destPos;
                    let mag = PointCal.distanceBetweenPoints(this.rightHandle.position, this.position);
                    let direction = PointCal.unitVectorFromA2B(this.leftHandle.position, this.position);
                    let res = PointCal.multiplyVectorByScalar(direction, mag);
                    this.rightHandle.position = PointCal.addVector(res, this.position);
                } else {
                    this.leftHandle.position = destPos;
                }
                break;
            case "FREE":
                this.leftHandle.position = destPos;
                break;
            case "VECTOR":
                break;
            default:
                throw new Error(`Unknown left handle type for control point`);
        }
    }

    setRightHandlePosition(destPos: Point){
        let rightHandleType = this.rightHandle.type;
        switch(rightHandleType){
            case "ALIGNED":
                if(this.leftHandle.type == "VECTOR"){
                    let diff = PointCal.subVector(destPos, this.position);
                    let leftHandleDiff = PointCal.unitVectorFromA2B(this.leftHandle.position, this.position);
                    let resMag = PointCal.dotProduct(diff, leftHandleDiff);
                    let res = PointCal.multiplyVectorByScalar(leftHandleDiff, resMag);
                    this.rightHandle.position = PointCal.addVector(this.position, res);
                } else if (this.rightHandle.type == "ALIGNED"){
                    this.rightHandle.position = destPos;
                    let mag = PointCal.distanceBetweenPoints(this.leftHandle.position, this.position);
                    let direction = PointCal.unitVectorFromA2B(this.rightHandle.position, this.position);
                    let res = PointCal.multiplyVectorByScalar(direction, mag);
                    this.leftHandle.position = PointCal.addVector(res, this.position);
                } else {
                    this.rightHandle.position = destPos;
                }
                break;
            case "FREE":
                this.rightHandle.position = destPos;
                break;
            case "VECTOR":
                break;
            default:
                throw new Error(`Unknown left handle type for control point`);
        }
    }

    getLeftHandle(): HandlePoint{
        return this.leftHandle;
    }

    getRightHandle(): HandlePoint{
        return this.rightHandle;
    }
}

export class CompositeBCurve{

    private controlPoints: ControlPoint[];

    constructor(controlPoints: ControlPoint[] = []){
        this.controlPoints = controlPoints;
    }

    getControlPoints(): ControlPoint[]{
        return this.controlPoints;
    }

    appendControlPoint(position: Point){
        let leftHandlePosition = PointCal.addVector(position, {x: -100, y: 0});
        let rightHandlePosition = PointCal.addVector(position, {x: 100, y: 0});
        let leftHandlePoint: HandlePoint = {
            position: leftHandlePosition,
            type: "FREE"
        }
        let rightHandlePoint: HandlePoint = {
            position: rightHandlePosition,
            type: "FREE"
        }

        let newControlPoint = new ControlPoint(position, leftHandlePoint, rightHandlePoint);
        this.controlPoints.push(newControlPoint);
    }

    setLeftHandlePositionOfControlPoint(controlPointIndex: number, destPos: Point){
        if(controlPointIndex >= this.controlPoints.length || controlPointIndex < 0){
            return;
        }
        this.controlPoints[controlPointIndex].setLeftHandlePosition(destPos);
    }

    setRightHandlePositionOfControlPoint(controlPointIndex: number, destPos: Point){
        if(controlPointIndex >= this.controlPoints.length || controlPointIndex < 0){
            return;
        }
        this.controlPoints[controlPointIndex].setRightHandlePosition(destPos);
    }
    
    setPositionOfControlPoint(controlPointIndex: number, destPos: Point){
        if(controlPointIndex >= this.controlPoints.length || controlPointIndex < 0){
            return;
        }
        let prevControlPoint = undefined;
        let nextControlPoint = undefined;
        if(controlPointIndex + 1 < this.controlPoints.length){
            nextControlPoint = this.controlPoints[controlPointIndex + 1];
        }
        if(controlPointIndex - 1 >= 0){
            prevControlPoint = this.controlPoints[controlPointIndex - 1];
        }
        this.controlPoints[controlPointIndex].setPosition(destPos, prevControlPoint, nextControlPoint);
    }
}
