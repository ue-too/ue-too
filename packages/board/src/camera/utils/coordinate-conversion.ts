import { Point, PointCal } from "@ue-too/math";
import { multiplyMatrix, TransformationMatrix } from "./matrix";
import { convertFromCanvas2ViewPort, convertFromViewPort2Canvas } from "../../utils/coordinate-conversions/canvas-viewport";
import { convertFromViewport2World, convertFromWorld2Viewport } from "../../utils/coordinate-conversions/viewport-world";

/**
 * @description Finds the world space coordinate of the interest point if the camera is at target position.
 * The target position is the "would be" position of the camera in world space.
 * The interest point is the point in view port space where the "bottom left" corner is the origin.
 * 
 * @category Camera
 */
export function convert2WorldSpaceWRT(targetPosition: Point, interestPoint: Point, viewPortWidth: number, viewPortHeight: number, cameraZoomLevel: number, cameraRotation: number): Point{
    const interestPointInViewPort = convertFromCanvas2ViewPort(interestPoint, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
    return convertFromViewport2World(interestPointInViewPort, targetPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * @description Converts the point to world space.
 * The point is in the viewport space where the "bottom left" corner is the origin.
 * Camera position is the position of the camera in world space.
 * 
 * @category Camera
 */
export function convert2WorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    const pointInViewPort = convertFromCanvas2ViewPort(point, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
    return convertFromViewport2World(pointInViewPort, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * @description Converts the point to world space.
 * The point is in the viewport space where the origin is at the center of the viewport.
 * Camera position is the position of the camera in world space.
 * 
 * @category Camera
 */
export function convert2WorldSpaceAnchorAtCenter(point: Point, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return convertFromViewport2World(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * @description Converts a point in "stage/context/world" space to view port space.
 * The origin of the viewport is at the center of the viewport.
 * The point is in world space.
 * The camera position is the position of the camera in world space.
 * 
 * @category Camera
 */
export function convert2ViewPortSpaceAnchorAtCenter(point: Point, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return convertFromWorld2Viewport(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * @description Converts a point in "stage/context/world" space to view port space.
 * The origin of the view port is at the bottom left corner.
 * The point is in world space.
 * The camera position is the position of the camera in world space.
 * 
 * @category Camera
 */
export function invertFromWorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    const pointInViewPort = convertFromWorld2Viewport(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
    return convertFromViewPort2Canvas(pointInViewPort, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
}

/**
 * @description Checks if a point is in the view port.
 * The point is in world space.
 * The camera position is the position of the camera in world space.
 * 
 * @category Camera
 */
export function pointIsInViewPort(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): boolean{
    const pointInCameraFrame = invertFromWorldSpace(point, viewPortWidth, viewPortHeight, cameraPosition, cameraZoomLevel, cameraRotation);
    if(pointInCameraFrame.x < 0 || pointInCameraFrame.x > viewPortWidth || pointInCameraFrame.y < 0 || pointInCameraFrame.y > viewPortHeight){
        return false;
    }
    return true;
}

/**
 * @description Converts a delta in view port space to world space.
 * The delta is in view port space.
 * 
 * @category Camera
 */
export function convertDeltaInViewPortToWorldSpace(delta: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, cameraRotation), 1 / cameraZoomLevel);
}

/**
 * @description Converts a delta in world space to view port space.
 * The delta is in world space.
 * 
 * @category Camera
 */
export function convertDeltaInWorldToViewPortSpace(delta: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, -cameraRotation), cameraZoomLevel);
}

/**
 * @description Calculates the camera position to get a point in "stage/context/world" space to be at a certain point in view port space.
 * This is useful to coordinate camera pan and zoom at the same time.
 * 
 * @category Camera
 */
export function cameraPositionToGet(pointInWorld: Point, toPointInViewPort: Point, cameraZoomLevel: number, cameraRotation: number): Point {
    const scaled = PointCal.multiplyVectorByScalar(toPointInViewPort, 1 / cameraZoomLevel);
    const rotated = PointCal.rotatePoint(scaled, cameraRotation);
    return PointCal.subVector(pointInWorld, rotated);
}

export function transformationMatrixFromCamera(cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): TransformationMatrix{
    const cos = Math.cos(cameraRotation);
    const sin = Math.sin(cameraRotation);
    const trMatrix = multiplyMatrix({
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: cameraPosition.x,
        f: cameraPosition.y
    }, {
        a: cos,
        b: sin,
        c: -sin,
        d: cos,
        e: 0,
        f: 0
    });
    const trsMatrix = multiplyMatrix(trMatrix, {
        a: 1 / cameraZoomLevel,
        b: 0,
        c: 0,
        d: 1 / cameraZoomLevel,
        e: 0,
        f: 0
    });
    return trsMatrix;
}

export function convert2WorldSpaceWithTransformationMatrix(point: Point, transformationMatrix: TransformationMatrix): Point{
    return {
        x: point.x * transformationMatrix.a + point.y * transformationMatrix.c + transformationMatrix.e,
        y: point.x * transformationMatrix.b + point.y * transformationMatrix.d + transformationMatrix.f
    }
}
