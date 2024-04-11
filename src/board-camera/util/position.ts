import { Point } from "src";
import { Boundaries } from "src/board-camera";
import { PointCal } from "point2point";

import { convert2WorldSpaceWRT } from "./coordinate-conversion";

export function withinBoundaries(point: Point, boundaries: Boundaries | undefined): boolean{
    if(boundaries == undefined){
        // no boundaries 
        return true;
    }
    let leftSide = false;
    let rightSide = false;
    let topSide = false;
    let bottomSide = false;
    // check within boundaries horizontally
    if(boundaries.max == undefined || boundaries.max.x == undefined || point.x <= boundaries.max.x){
        rightSide = true;
    }
    if(boundaries.min == undefined || boundaries.min.x == undefined || point.x >= boundaries.min.x){
        leftSide = true;
    }
    if(boundaries.max == undefined || boundaries.max.y == undefined || point.y <= boundaries.max.y){
        topSide = true;
    }
    if(boundaries.min == undefined || boundaries.min.y == undefined || point.y >= boundaries.min.y){
        bottomSide = true;
    }
    return leftSide && rightSide && topSide && bottomSide;
}

export function clampPoint(point: Point, boundaries: Boundaries): Point{
    if(withinBoundaries(point, boundaries)){
        return point;
    }
    let manipulatePoint = {x: point.x, y: point.y};
    let limit = boundaries.min;
    if (limit != undefined){
        if(limit.x != undefined){
            manipulatePoint.x = Math.max(manipulatePoint.x, limit.x);
        }
        if(limit.y != undefined){
            manipulatePoint.y = Math.max(manipulatePoint.y, limit.y);
        }
    }
    limit = boundaries.max;
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

export function clampPointEntireViewPort(point: Point, viewPortWidth: number, viewPortHeight: number, boundaries: Boundaries, cameraZoomLevel: number, cameraRotation: number): Point{
    let topLeftCorner = convert2WorldSpaceWRT(point, {x: 0, y: viewPortHeight}, viewPortWidth, viewPortHeight, cameraZoomLevel, cameraRotation);
    let bottomLeftCorner = convert2WorldSpaceWRT(point, {x: 0, y: 0}, viewPortWidth, viewPortHeight, cameraZoomLevel, cameraRotation);
    let topRightCorner = convert2WorldSpaceWRT(point, {x: viewPortWidth, y: viewPortHeight}, viewPortWidth, viewPortHeight, cameraZoomLevel, cameraRotation);
    let bottomRightCorner = convert2WorldSpaceWRT(point, {x: viewPortWidth, y: 0}, viewPortWidth, viewPortHeight, cameraZoomLevel, cameraRotation);
    let topLeftCornerClamped = clampPoint(topLeftCorner, boundaries);
    let topRightCornerClamped = clampPoint(topRightCorner, boundaries);
    let bottomLeftCornerClamped = clampPoint(bottomLeftCorner, boundaries);
    let bottomRightCornerClamped = clampPoint(bottomRightCorner, boundaries);
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
