import { Point, PointCal } from "@ue-too/math";
import { multiplyMatrix, TransformationMatrix } from "./matrix";
import { convertFromCanvas2ViewPort, convertFromViewPort2Canvas } from "../../utils/coordinate-conversions/canvas-viewport";
import { convertFromViewport2World, convertFromWorld2Viewport } from "../../utils/coordinate-conversions/viewport-world";

/**
 * Converts a viewport point to world space with respect to a hypothetical camera position.
 * "WRT" = "With Respect To" - calculates where a viewport point would be in world space
 * if the camera were at the target position.
 *
 * @param targetPosition - Hypothetical camera position in world coordinates
 * @param interestPoint - Point in canvas coordinates (origin at bottom-left)
 * @param viewPortWidth - Viewport width in CSS pixels
 * @param viewPortHeight - Viewport height in CSS pixels
 * @param cameraZoomLevel - Zoom level to apply
 * @param cameraRotation - Rotation to apply in radians
 * @returns World space coordinates of the interest point
 *
 * @remarks
 * This is useful for "what-if" calculations, such as:
 * - Predicting where a viewport corner would land if camera moves to a position
 * - Checking if moving to a position would show certain world objects
 *
 * The interest point uses canvas coordinates (bottom-left origin), not viewport coordinates (center origin).
 *
 * @example
 * ```typescript
 * // Where would the top-left viewport corner be in world space
 * // if camera moved to (100, 100)?
 * const worldCorner = convert2WorldSpaceWRT(
 *   { x: 100, y: 100 },  // target camera position
 *   { x: 0, y: 1080 },    // top-left in canvas coords
 *   1920, 1080,           // viewport size
 *   1.0,                  // zoom
 *   0                     // rotation
 * );
 * ```
 *
 * @category Camera
 */
export function convert2WorldSpaceWRT(targetPosition: Point, interestPoint: Point, viewPortWidth: number, viewPortHeight: number, cameraZoomLevel: number, cameraRotation: number): Point{
    const interestPointInViewPort = convertFromCanvas2ViewPort(interestPoint, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
    return convertFromViewport2World(interestPointInViewPort, targetPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * Converts a canvas point to world space using current camera state.
 *
 * @param point - Point in canvas coordinates (origin at bottom-left)
 * @param viewPortWidth - Viewport width in CSS pixels
 * @param viewPortHeight - Viewport height in CSS pixels
 * @param cameraPosition - Current camera position in world coordinates
 * @param cameraZoomLevel - Current camera zoom level
 * @param cameraRotation - Current camera rotation in radians
 * @returns World space coordinates of the point
 *
 * @remarks
 * Input coordinates use canvas space with origin at bottom-left.
 * This is useful when working with canvas element coordinates directly.
 *
 * For points already in viewport space (origin at center), use
 * {@link convert2WorldSpaceAnchorAtCenter} instead.
 *
 * @example
 * ```typescript
 * // Convert bottom-left corner of canvas to world coords
 * const worldPos = convert2WorldSpace(
 *   { x: 0, y: 0 },
 *   1920, 1080,
 *   { x: 100, y: 200 },  // camera position
 *   1.5,                  // zoom
 *   0                     // rotation
 * );
 * ```
 *
 * @category Camera
 */
export function convert2WorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    const pointInViewPort = convertFromCanvas2ViewPort(point, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
    return convertFromViewport2World(pointInViewPort, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * Converts a viewport point (center-anchored) to world space.
 * This is the most commonly used viewport-to-world conversion function.
 *
 * @param point - Point in viewport coordinates (origin at viewport center)
 * @param cameraPosition - Camera position in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns World space coordinates of the point
 *
 * @remarks
 * Viewport coordinates have the origin at the center of the viewport, with:
 * - Positive x to the right
 * - Positive y upward
 * - Point (0, 0) is the center of the viewport
 *
 * This is the standard coordinate system for camera operations.
 *
 * @example
 * ```typescript
 * // Convert viewport center (0,0) to world space
 * const worldCenter = convert2WorldSpaceAnchorAtCenter(
 *   { x: 0, y: 0 },
 *   { x: 500, y: 300 },  // camera at world (500, 300)
 *   1.0,
 *   0
 * );
 * // worldCenter will be { x: 500, y: 300 }
 *
 * // Convert point 100 pixels right of center
 * const rightPoint = convert2WorldSpaceAnchorAtCenter(
 *   { x: 100, y: 0 },
 *   { x: 500, y: 300 },
 *   2.0,  // 2x zoom
 *   0
 * );
 * // At 2x zoom, 100 viewport pixels = 50 world units
 * // Result: { x: 550, y: 300 }
 * ```
 *
 * @category Camera
 */
export function convert2WorldSpaceAnchorAtCenter(point: Point, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return convertFromViewport2World(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * Converts a world point to viewport space (center-anchored).
 * Inverse of {@link convert2WorldSpaceAnchorAtCenter}.
 *
 * @param point - Point in world coordinates
 * @param cameraPosition - Camera position in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns Viewport coordinates (origin at center, in CSS pixels)
 *
 * @remarks
 * Use this to find where a world object appears on screen.
 * Result is in viewport space with origin at center, useful for:
 * - Positioning UI elements over world objects
 * - Checking if objects are on screen
 * - Converting click positions
 *
 * @example
 * ```typescript
 * // Where does world point (600, 300) appear in viewport?
 * const viewportPos = convert2ViewPortSpaceAnchorAtCenter(
 *   { x: 600, y: 300 },  // world position
 *   { x: 500, y: 300 },  // camera position
 *   1.0,
 *   0
 * );
 * // Result: { x: 100, y: 0 } (100 pixels right of center)
 *
 * // Position a DOM element at this world object
 * element.style.left = `${viewportPos.x + canvas.width/2}px`;
 * element.style.top = `${-viewportPos.y + canvas.height/2}px`;
 * ```
 *
 * @category Camera
 */
export function convert2ViewPortSpaceAnchorAtCenter(point: Point, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return convertFromWorld2Viewport(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
}

/**
 * Converts a world point to canvas coordinates (bottom-left origin).
 *
 * @param point - Point in world coordinates
 * @param viewPortWidth - Viewport width in CSS pixels
 * @param viewPortHeight - Viewport height in CSS pixels
 * @param cameraPosition - Camera position in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns Canvas coordinates (origin at bottom-left, in CSS pixels)
 *
 * @remarks
 * "Invert" in the function name refers to inverting the forward transformation
 * (world → viewport → canvas). The result uses canvas coordinates where:
 * - (0, 0) is at the bottom-left corner
 * - x increases to the right
 * - y increases upward
 *
 * @example
 * ```typescript
 * const canvasPos = invertFromWorldSpace(
 *   { x: 500, y: 300 },  // world position
 *   1920, 1080,
 *   { x: 500, y: 300 },  // camera at same position
 *   1.0,
 *   0
 * );
 * // Result: { x: 960, y: 540 } (center of 1920x1080 canvas)
 * ```
 *
 * @category Camera
 */
export function invertFromWorldSpace(point: Point, viewPortWidth: number, viewPortHeight: number, cameraPosition: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    const pointInViewPort = convertFromWorld2Viewport(point, cameraPosition, cameraZoomLevel, cameraRotation, false);
    return convertFromViewPort2Canvas(pointInViewPort, {x: viewPortWidth / 2, y: viewPortHeight / 2}, false);
}

/**
 * Checks if a world point is currently visible in the viewport.
 *
 * @param point - Point in world coordinates
 * @param viewPortWidth - Viewport width in CSS pixels
 * @param viewPortHeight - Viewport height in CSS pixels
 * @param cameraPosition - Camera position in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns True if point is visible in viewport, false otherwise
 *
 * @remarks
 * A point is visible if it falls within the rectangular viewport bounds.
 * This uses canvas coordinates for the visibility check (0 to width/height).
 *
 * @example
 * ```typescript
 * const isVisible = pointIsInViewPort(
 *   { x: 550, y: 300 },  // world point
 *   1920, 1080,
 *   { x: 500, y: 300 },  // camera position
 *   1.0,
 *   0
 * );
 * // Returns true if point is within viewport bounds
 * ```
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
 * Converts a displacement vector from viewport space to world space.
 * Use this for converting movement deltas, not absolute positions.
 *
 * @param delta - Displacement vector in viewport space (CSS pixels)
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns Displacement vector in world coordinates
 *
 * @remarks
 * This transforms a *relative* displacement, not an absolute point.
 * The conversion accounts for:
 * - Rotation: Delta is rotated by camera rotation
 * - Zoom: Delta is scaled by 1/zoom (viewport pixels → world units)
 *
 * Note: Camera position is NOT needed for delta transformations.
 *
 * @example
 * ```typescript
 * // User dragged 100 pixels to the right in viewport
 * const viewportDelta = { x: 100, y: 0 };
 * const worldDelta = convertDeltaInViewPortToWorldSpace(
 *   viewportDelta,
 *   2.0,  // 2x zoom
 *   0     // no rotation
 * );
 * // Result: { x: 50, y: 0 } (100 viewport pixels = 50 world units at 2x zoom)
 * ```
 *
 * @category Camera
 */
export function convertDeltaInViewPortToWorldSpace(delta: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, cameraRotation), 1 / cameraZoomLevel);
}

/**
 * Converts a displacement vector from world space to viewport space.
 * Use this for converting movement deltas, not absolute positions.
 * Inverse of {@link convertDeltaInViewPortToWorldSpace}.
 *
 * @param delta - Displacement vector in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns Displacement vector in viewport space (CSS pixels)
 *
 * @remarks
 * This transforms a *relative* displacement, not an absolute point.
 * The conversion accounts for:
 * - Rotation: Delta is rotated by -camera rotation
 * - Zoom: Delta is scaled by zoom (world units → viewport pixels)
 *
 * @example
 * ```typescript
 * // Object moved 50 units right in world space
 * const worldDelta = { x: 50, y: 0 };
 * const viewportDelta = convertDeltaInWorldToViewPortSpace(
 *   worldDelta,
 *   2.0,  // 2x zoom
 *   0     // no rotation
 * );
 * // Result: { x: 100, y: 0 } (50 world units = 100 viewport pixels at 2x zoom)
 * ```
 *
 * @category Camera
 */
export function convertDeltaInWorldToViewPortSpace(delta: Point, cameraZoomLevel: number, cameraRotation: number): Point{
    return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(delta, -cameraRotation), cameraZoomLevel);
}

/**
 * Calculates the camera position needed to place a world point at a specific viewport location.
 * Useful for implementing "zoom to point" or "focus on object" features.
 *
 * @param pointInWorld - The world point to focus on
 * @param toPointInViewPort - Where in the viewport this point should appear (origin at center)
 * @param cameraZoomLevel - Target zoom level
 * @param cameraRotation - Target rotation in radians
 * @returns Camera position that achieves the desired framing
 *
 * @remarks
 * This is particularly useful for:
 * - Zoom-to-cursor: Make clicked point stay under cursor while zooming
 * - Pan-and-zoom: Smoothly navigate to show a specific object
 * - Focus features: Center camera on a world object
 *
 * The viewport point is in viewport coordinates (center origin).
 * To center on a world point, use toPointInViewPort = {x: 0, y: 0}.
 *
 * @example
 * ```typescript
 * // Center camera on world point (1000, 500)
 * const newCameraPos = cameraPositionToGet(
 *   { x: 1000, y: 500 },  // world point to focus on
 *   { x: 0, y: 0 },        // center of viewport
 *   2.0,                   // zoom level
 *   0                      // rotation
 * );
 * camera.setPosition(newCameraPos);
 *
 * // Zoom to cursor position
 * // Keep world point under cursor at (viewportX, viewportY)
 * const cursorViewport = {
 *   x: mouseX - canvas.width/2,
 *   y: mouseY - canvas.height/2
 * };
 * const worldAtCursor = camera.convertFromViewPort2WorldSpace(cursorViewport);
 * const newPos = cameraPositionToGet(worldAtCursor, cursorViewport, newZoom, rotation);
 * camera.setPosition(newPos);
 * camera.setZoomLevel(newZoom);
 * ```
 *
 * @category Camera
 */
export function cameraPositionToGet(pointInWorld: Point, toPointInViewPort: Point, cameraZoomLevel: number, cameraRotation: number): Point {
    const scaled = PointCal.multiplyVectorByScalar(toPointInViewPort, 1 / cameraZoomLevel);
    const rotated = PointCal.rotatePoint(scaled, cameraRotation);
    return PointCal.subVector(pointInWorld, rotated);
}

/**
 * Creates a transformation matrix from camera parameters.
 * Combines position, zoom, and rotation into a single transform.
 *
 * @param cameraPosition - Camera position in world coordinates
 * @param cameraZoomLevel - Camera zoom level
 * @param cameraRotation - Camera rotation in radians
 * @returns Transformation matrix for viewport-to-world conversion
 *
 * @remarks
 * The resulting matrix can be used with {@link convert2WorldSpaceWithTransformationMatrix}
 * for efficient batch transformations when camera state doesn't change.
 *
 * Matrix composition order: Translation → Rotation → Scale(1/zoom)
 *
 * @category Camera
 */
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

/**
 * Transforms a viewport point to world space using a precomputed transformation matrix.
 * Faster than repeated function calls when transforming many points with the same camera state.
 *
 * @param point - Point in viewport coordinates (origin at center)
 * @param transformationMatrix - Precomputed transformation matrix from {@link transformationMatrixFromCamera}
 * @returns World space coordinates of the point
 *
 * @remarks
 * Use this for batch transformations when the camera state is constant:
 * 1. Create matrix once with {@link transformationMatrixFromCamera}
 * 2. Transform many points with this function
 *
 * This avoids recalculating sin/cos and matrix operations for each point.
 *
 * @example
 * ```typescript
 * // Transform many points efficiently
 * const matrix = transformationMatrixFromCamera(
 *   { x: 100, y: 200 },
 *   1.5,
 *   Math.PI / 4
 * );
 *
 * const worldPoints = viewportPoints.map(vp =>
 *   convert2WorldSpaceWithTransformationMatrix(vp, matrix)
 * );
 * ```
 *
 * @category Camera
 * @see {@link transformationMatrixFromCamera} to create the matrix
 */
export function convert2WorldSpaceWithTransformationMatrix(point: Point, transformationMatrix: TransformationMatrix): Point{
    return {
        x: point.x * transformationMatrix.a + point.y * transformationMatrix.c + transformationMatrix.e,
        y: point.x * transformationMatrix.b + point.y * transformationMatrix.d + transformationMatrix.f
    }
}
