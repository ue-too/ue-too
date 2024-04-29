import { Point } from "src";
import { PointCal } from "point2point";

export function convert2WorldSpaceWRT(targetPosition: Point, interestPoint: Point, viewPortWidth: number, viewPortHeight: number, cameraZoomLevel: number, cameraRotation: number): Point{
    // the target position is the position of the camera in world space
    // the coordinate for the interest point is in view port space where bottom left corner is the origin 
    let cameraFrameCenter = {x: viewPortWidth / 2, y: viewPortHeight / 2};
    let delta2Point = PointCal.subVector(interestPoint, cameraFrameCenter);
    delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / cameraZoomLevel);
    delta2Point = PointCal.rotatePoint(delta2Point, cameraRotation);
    return PointCal.addVector(targetPosition, delta2Point);
}

export function convert2WorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    let cameraFrameCenter = {x: viewPortWidth / 2, y: viewPortHeight / 2};
    let delta2Point = PointCal.subVector(point, cameraFrameCenter);
    delta2Point = PointCal.multiplyVectorByScalar(delta2Point, 1 / cameraZoomLevel);
    delta2Point = PointCal.rotatePoint(delta2Point, cameraRotation);
    return PointCal.addVector(cameraPosition, delta2Point);
}

export function invertFromWorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    let cameraFrameCenter = {x: viewPortWidth / 2, y: viewPortHeight / 2};
    let delta2Point = PointCal.subVector(point, cameraPosition);
    delta2Point = PointCal.rotatePoint(delta2Point, -cameraRotation);
    delta2Point = PointCal.multiplyVectorByScalar(delta2Point, cameraZoomLevel);
    return PointCal.addVector(cameraFrameCenter, delta2Point);
}

export function pointIsInViewPort(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): boolean{
    const pointInCameraFrame = invertFromWorldSpace(point, viewPortWidth, viewPortHeight, cameraPosition, cameraZoomLevel, cameraRotation);
    if(pointInCameraFrame.x < 0 || pointInCameraFrame.x > viewPortWidth || pointInCameraFrame.y < 0 || pointInCameraFrame.y > viewPortHeight){
        return false;
    }
    return true;
}
