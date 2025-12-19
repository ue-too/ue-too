import { Point, PointCal } from "@ue-too/math";

/**
 * 
 * @param pointInViewport 
 * @param viewportHasFlippedYAxis 
 * @param viewportOriginInWorldSpace 
 */
export function convertFromViewport2World(pointInViewport: Point, cameraPositionInWorldSpace: Point, cameraZoomLevel: number, cameraRotation: number, worldHasFlippedYAxis: boolean = false): Point {
    const scaledBack = PointCal.multiplyVectorByScalar(pointInViewport, 1 / cameraZoomLevel);
    const rotatedBack = PointCal.rotatePoint(scaledBack, cameraRotation);
    if(worldHasFlippedYAxis){
        rotatedBack.y = -rotatedBack.y;
    }
    const withOffset = PointCal.addVector(rotatedBack, cameraPositionInWorldSpace);
    return withOffset;
}

export function convertFromWorld2Viewport(pointInWorld: Point, cameraPositionInWorldSpace: Point, cameraZoomLevel: number, cameraRotation: number, worldHasFlippedYAxis: boolean = false): Point {
    const withOffset = PointCal.subVector(pointInWorld, cameraPositionInWorldSpace);
    if(worldHasFlippedYAxis){
        withOffset.y = -withOffset.y;
    }
    const scaled = PointCal.multiplyVectorByScalar(withOffset, cameraZoomLevel);
    const rotated = PointCal.rotatePoint(scaled, -cameraRotation);
    return rotated;
}
