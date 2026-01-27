import { Point } from '@ue-too/math';

import { Canvas } from '../input-interpretation/input-state-machine/kmt-input-context';
import { convertFromCanvas2ViewPort } from './coordinate-conversions/canvas-viewport';
import { convertFromWindow2Canvas } from './coordinate-conversions/window-canvas';

/**
 * Converts an isometric 3D point to a flat 2D world point.
 *
 * @param point - The 3D point in isometric space (with optional z coordinate)
 * @returns The 2D point in flat world coordinates
 *
 * @remarks
 * This function performs an isometric projection transformation, converting 3D
 * coordinates to 2D using standard isometric angles (30 degrees).
 *
 * The transformation uses:
 * - cos(30°) ≈ 0.866 for x-axis projection
 * - cos(60°) = 0.5 for y-axis projection
 * - Z-coordinate is added directly to the y-axis (height)
 *
 * Mathematical formulas:
 * ```
 * x_2d = (x_3d * cos30) - (y_3d * cos30)
 * y_2d = (x_3d * cos60) + (y_3d * cos60) + z_3d
 * ```
 *
 * This creates the classic isometric diamond grid appearance where:
 * - Moving along +X goes down-right
 * - Moving along +Y goes down-left
 * - Moving along +Z goes straight up
 *
 * @example
 * ```typescript
 * // Convert a 3D cube corner to 2D isometric projection
 * const point3D = { x: 10, y: 10, z: 5 };
 * const point2D = pointConversion(point3D);
 * // Result: { x: 0, y: 15 }
 * // x: (10 * 0.866) - (10 * 0.866) = 0
 * // y: (10 * 0.5) + (10 * 0.5) + 5 = 15
 *
 * // 2D point without z-coordinate
 * const flatPoint = { x: 20, y: 0 };
 * const projected = pointConversion(flatPoint);
 * // Result: { x: 17.32, y: 10 }
 * ```
 *
 * @category Coordinate Conversion
 */
export function pointConversion(point: Point) {
    const cos30 = Math.cos(Math.PI / 6);
    const cos60 = Math.cos(Math.PI / 3);

    return {
        x: point.x * cos30 - point.y * cos30,
        y: point.x * cos60 + point.y * cos60 + (point.z ?? 0),
    };
}

/**
 * Converts a point from window coordinates to viewport coordinates in one step.
 *
 * @param point - The point in window coordinates (browser viewport)
 * @param canvas - The canvas object with position and dimensions
 * @param viewportOriginInCanvasSpace - Viewport origin in canvas space (default: canvas center)
 * @param viewportHasFlippedYAxis - Whether viewport uses mathematical y-axis (default: false)
 * @returns The point in viewport coordinates
 *
 * @remarks
 * This is a convenience function that combines two conversions:
 * 1. Window to Canvas: {@link convertFromWindow2Canvas}
 * 2. Canvas to Viewport: {@link convertFromCanvas2ViewPort}
 *
 * It's particularly useful for processing input events (mouse clicks, touches)
 * that need to be converted directly to viewport space for interaction handling.
 *
 * The default viewport origin is the canvas center, which is common for
 * mathematical/engineering applications where (0,0) should be in the middle.
 *
 * @example
 * ```typescript
 * // Mouse click event
 * const clickPos = { x: event.clientX, y: event.clientY };
 *
 * const canvas = {
 *   position: { x: 100, y: 50 },
 *   width: 800,
 *   height: 600
 * };
 *
 * // Convert to centered viewport with y-up
 * const viewportPos = convertFromWindow2ViewPortWithCanvasOperator(
 *   clickPos,
 *   canvas,
 *   { x: 400, y: 300 },  // center of canvas
 *   true  // mathematical coordinates
 * );
 *
 * // viewportPos is now relative to viewport center with y-up
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromWindow2Canvas} for window to canvas conversion
 * @see {@link convertFromCanvas2ViewPort} for canvas to viewport conversion
 */
export function convertFromWindow2ViewPortWithCanvasOperator(
    point: Point,
    canvas: Canvas,
    viewportOriginInCanvasSpace: Point = {
        x: canvas.width / 2,
        y: canvas.height / 2,
    },
    viewportHasFlippedYAxis: boolean = false
): Point {
    const pointInCanvas = convertFromWindow2Canvas(point, canvas);
    return convertFromCanvas2ViewPort(
        pointInCanvas,
        viewportOriginInCanvasSpace,
        viewportHasFlippedYAxis
    );
}
