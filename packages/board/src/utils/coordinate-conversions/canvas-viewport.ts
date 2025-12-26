import { Point, PointCal } from "@ue-too/math";

/**
 * Converts a point from canvas space to viewport space.
 *
 * @param pointInCanvas - The point in canvas coordinates to convert
 * @param viewportOriginInCanvasSpace - The viewport's origin position in canvas coordinates (default: {0, 0})
 * @param viewportHasFlippedYAxis - Whether viewport uses inverted y-axis (default: false)
 * @returns The point in viewport coordinates
 *
 * @remarks
 * Canvas and viewport coordinate systems can differ in two ways:
 * 1. Origin position: Viewport origin may not be at canvas top-left (0,0)
 * 2. Y-axis direction: Viewport may use mathematical coordinates (y-up) vs canvas (y-down)
 *
 * The conversion process:
 * 1. Translate: Subtract viewport origin from point (shifts coordinate system)
 * 2. Flip Y (if needed): Negate y-coordinate for mathematical coordinate system
 *
 * Common use case: Converting mouse click positions (canvas space) to positions
 * relative to a centered viewport that uses mathematical coordinates.
 *
 * @example
 * ```typescript
 * // Canvas with centered viewport using mathematical coordinates
 * const canvasPoint = { x: 400, y: 300 };  // Click near center
 * const viewportOrigin = { x: 400, y: 300 }; // Viewport centered in 800x600 canvas
 *
 * // Convert to viewport space with flipped y-axis
 * const viewportPoint = convertFromCanvas2ViewPort(
 *   canvasPoint,
 *   viewportOrigin,
 *   true  // viewport has y-up
 * );
 * // Result: { x: 0, y: 0 } (center of viewport)
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromViewPort2Canvas} for inverse conversion
 */
export function convertFromCanvas2ViewPort(pointInCanvas: Point, viewportOriginInCanvasSpace: Point = {x: 0, y: 0}, viewportHasFlippedYAxis: boolean = false): Point {
    const res = PointCal.subVector(pointInCanvas, viewportOriginInCanvasSpace);
    if(viewportHasFlippedYAxis){
        res.y = -res.y;
    }
    return res;
}

/**
 * Converts a point from viewport space to canvas space.
 *
 * @param pointInViewPort - The point in viewport coordinates to convert
 * @param viewportOriginInCanvasSpace - The viewport's origin position in canvas coordinates (default: {0, 0})
 * @param viewportHasFlippedYAxis - Whether viewport uses inverted y-axis (default: false)
 * @returns The point in canvas coordinates
 *
 * @remarks
 * This is the inverse of {@link convertFromCanvas2ViewPort}. It transforms points
 * from viewport-relative coordinates back to absolute canvas coordinates.
 *
 * The conversion process:
 * 1. Flip Y (if needed): Negate y-coordinate to convert from mathematical to canvas system
 * 2. Translate: Add viewport origin to convert from relative to absolute position
 *
 * This is essential for rendering viewport-space objects (like shapes drawn by user)
 * onto the actual canvas element.
 *
 * @example
 * ```typescript
 * // Viewport space point (centered viewport with y-up)
 * const viewportPoint = { x: 100, y: 50 };  // 100 right, 50 up from viewport center
 * const viewportOrigin = { x: 400, y: 300 }; // Viewport centered in canvas
 *
 * // Convert to canvas coordinates
 * const canvasPoint = convertFromViewPort2Canvas(
 *   viewportPoint,
 *   viewportOrigin,
 *   true  // viewport has y-up
 * );
 * // Result: { x: 500, y: 250 }
 * // (400 + 100 = 500 in x, 300 - 50 = 250 in y due to flip)
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromCanvas2ViewPort} for inverse conversion
 */
export function convertFromViewPort2Canvas(pointInViewPort: Point, viewportOriginInCanvasSpace: Point = {x: 0, y: 0},viewportHasFlippedYAxis: boolean = false): Point {
    if(viewportHasFlippedYAxis){
        pointInViewPort.y = -pointInViewPort.y;
    }
    return PointCal.addVector(pointInViewPort, viewportOriginInCanvasSpace);
}
