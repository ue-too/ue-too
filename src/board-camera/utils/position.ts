import { Point } from "src";
import { PointCal } from "point2point";

import { convert2WorldSpaceWRT } from "./coordinate-conversion";

export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

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

export function isValidBoundaries(boundaries: Boundaries | undefined): boolean{
    if(boundaries == undefined){
        return true;
    }
    const minX = boundaries.min?.x;
    const maxX = boundaries.max?.x;
    if (minX != undefined && maxX != undefined && minX >= maxX){
        return false;
    }
    const minY = boundaries.min?.y;
    const maxY = boundaries.max?.y;
    if (minY != undefined && maxY != undefined && minY >= maxY){
        return false;
    }
    return true;
}

export function boundariesFullyDefined(boundaries: Boundaries | undefined): boolean{
    if(boundaries == undefined){
        return false;
    }
    if(boundaries.max == undefined || boundaries.min == undefined){
        return false;
    }
    if(boundaries.max.x == undefined || boundaries.max.y == undefined || boundaries.min.x == undefined || boundaries.min.y == undefined){
        return false;
    }
    return true;
}

export function clampPoint(point: Point, boundaries: Boundaries | undefined): Point{
    if(withinBoundaries(point, boundaries) || boundaries == undefined){
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

export function translationWidthOf(boundaries: Boundaries | undefined): number | undefined{
    if(boundaries == undefined || boundaries.min == undefined || boundaries.max == undefined || boundaries.min.x == undefined || boundaries.max.x == undefined){
        return undefined;
    }
    return boundaries.max.x - boundaries.min.x;
}

export function halfTranslationWidthOf(boundaries: Boundaries): number | undefined{
    const translationWidth = translationWidthOf(boundaries);
    return translationWidth != undefined ? translationWidth / 2 : undefined;
}

export function translationHeightOf(boundaries: Boundaries | undefined): number | undefined{
    if(boundaries == undefined || boundaries.min == undefined || boundaries.max == undefined || boundaries.min.y == undefined || boundaries.max.y == undefined){
        return undefined;
    }
    return boundaries.max.y - boundaries.min.y;
}

export function halfTranslationHeightOf(boundaries: Boundaries): number | undefined{
    const translationHeight = translationHeightOf(boundaries);
    return translationHeight != undefined ? translationHeight / 2 : undefined;
}

export function clampPointEntireViewPort(point: Point, viewPortWidth: number, viewPortHeight: number, boundaries: Boundaries | undefined, cameraZoomLevel: number, cameraRotation: number): Point{
    if(boundaries == undefined){
        return point;
    }
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
