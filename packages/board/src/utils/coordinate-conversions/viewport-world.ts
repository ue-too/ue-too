import { Point, PointCal } from "@ue-too/math";

/**
 * Converts a point from viewport space to world space.
 *
 * @param pointInViewport - The point in viewport coordinates to convert
 * @param cameraPositionInWorldSpace - The camera's center position in world coordinates
 * @param cameraZoomLevel - The camera's zoom level (1.0 = normal, >1 = zoomed in, <1 = zoomed out)
 * @param cameraRotation - The camera's rotation angle in radians
 * @param worldHasFlippedYAxis - Whether world space uses inverted y-axis (default: false)
 * @returns The point in world coordinates
 *
 * @remarks
 * This function applies the inverse of the camera transformation to convert from
 * viewport coordinates to world coordinates. It's essential for translating user
 * interactions (clicks, drags) into world-space positions.
 *
 * The transformation applies these operations in reverse order:
 * 1. Unzoom: Divide by zoom level (world units per viewport pixel)
 * 2. Unrotate: Rotate by positive camera rotation (reverse the camera's rotation)
 * 3. Flip Y (if needed): Negate y if world uses mathematical coordinates
 * 4. Translate: Add camera position to get absolute world position
 *
 * Mathematical formula:
 * ```
 * worldPoint = rotate(pointInViewport / zoom, cameraRotation) + cameraPosition
 * ```
 *
 * @example
 * ```typescript
 * // Click at viewport center with zoomed and rotated camera
 * const viewportPoint = { x: 0, y: 0 };  // Center of viewport
 * const cameraPos = { x: 1000, y: 500 };
 * const zoom = 2.0;  // Zoomed in 2x
 * const rotation = Math.PI / 4;  // 45 degrees
 *
 * const worldPoint = convertFromViewport2World(
 *   viewportPoint,
 *   cameraPos,
 *   zoom,
 *   rotation,
 *   false
 * );
 * // Result: { x: 1000, y: 500 } (camera position, since viewport center maps to camera position)
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromWorld2Viewport} for inverse conversion
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

/**
 * Converts a point from world space to viewport space.
 *
 * @param pointInWorld - The point in world coordinates to convert
 * @param cameraPositionInWorldSpace - The camera's center position in world coordinates
 * @param cameraZoomLevel - The camera's zoom level (1.0 = normal, >1 = zoomed in, <1 = zoomed out)
 * @param cameraRotation - The camera's rotation angle in radians
 * @param worldHasFlippedYAxis - Whether world space uses inverted y-axis (default: false)
 * @returns The point in viewport coordinates
 *
 * @remarks
 * This function applies the camera transformation to convert from world coordinates
 * to viewport coordinates. This is used for rendering world objects onto the viewport.
 *
 * The transformation applies these operations in order:
 * 1. Translate: Subtract camera position (make position relative to camera)
 * 2. Flip Y (if needed): Negate y if world uses mathematical coordinates
 * 3. Zoom: Multiply by zoom level (viewport pixels per world unit)
 * 4. Rotate: Rotate by negative camera rotation (to align with viewport)
 *
 * Mathematical formula:
 * ```
 * viewportPoint = rotate((pointInWorld - cameraPosition) * zoom, -cameraRotation)
 * ```
 *
 * The negative rotation ensures that when the camera rotates clockwise, the world
 * appears to rotate counter-clockwise (from the viewer's perspective), which is
 * the expected behavior.
 *
 * @example
 * ```typescript
 * // World object at (1100, 550) with camera at (1000, 500)
 * const worldPoint = { x: 1100, y: 550 };
 * const cameraPos = { x: 1000, y: 500 };
 * const zoom = 2.0;  // Zoomed in 2x
 * const rotation = 0;  // No rotation
 *
 * const viewportPoint = convertFromWorld2Viewport(
 *   worldPoint,
 *   cameraPos,
 *   zoom,
 *   rotation,
 *   false
 * );
 * // Result: { x: 200, y: 100 }
 * // ((1100 - 1000) * 2 = 200, (550 - 500) * 2 = 100)
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromViewport2World} for inverse conversion
 */
export function convertFromWorld2Viewport(pointInWorld: Point, cameraPositionInWorldSpace: Point, cameraZoomLevel: number, cameraRotation: number, worldHasFlippedYAxis: boolean = false): Point {
    const withOffset = PointCal.subVector(pointInWorld, cameraPositionInWorldSpace);
    if(worldHasFlippedYAxis){
        withOffset.y = -withOffset.y;
    }
    const scaled = PointCal.multiplyVectorByScalar(withOffset, cameraZoomLevel);
    const rotated = PointCal.rotatePoint(scaled, -cameraRotation);
    return rotated;
}
