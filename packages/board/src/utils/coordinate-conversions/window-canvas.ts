import { Point, PointCal } from '@ue-too/math';

import { Canvas } from '../../input-interpretation/input-state-machine/kmt-input-context';

/**
 * Converts a point from browser window coordinates to canvas coordinates.
 *
 * @param pointInWindow - The point in window coordinates (relative to browser viewport)
 * @param canvas - The canvas object containing position information
 * @returns The point in canvas coordinates (relative to canvas element)
 *
 * @remarks
 * Window coordinates are relative to the browser's viewport (top-left = 0,0).
 * Canvas coordinates are relative to the canvas element's top-left corner.
 *
 * This conversion is essential for processing mouse and touch events, which
 * provide coordinates relative to the window, not the canvas element.
 *
 * The conversion simply subtracts the canvas position from the window position:
 * ```
 * canvasPoint = windowPoint - canvasPosition
 * ```
 *
 * Note: This function expects the canvas object to have a `position` property
 * containing the canvas element's position in window coordinates (typically
 * from getBoundingClientRect()).
 *
 * @example
 * ```typescript
 * // Mouse click at window position (500, 300)
 * const clickPos = { x: 500, y: 300 };
 *
 * // Canvas positioned at (100, 50) in window
 * const canvas = {
 *   position: { x: 100, y: 50 },
 *   width: 800,
 *   height: 600
 * };
 *
 * const canvasPos = convertFromWindow2Canvas(clickPos, canvas);
 * // Result: { x: 400, y: 250 }
 * // (500 - 100 = 400, 300 - 50 = 250)
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromCanvas2Window} for inverse conversion
 */
export function convertFromWindow2Canvas(
    pointInWindow: Point,
    canvas: Canvas
): Point {
    return PointCal.subVector(pointInWindow, canvas.position);
}

/**
 * Converts a point from canvas coordinates to browser window coordinates.
 *
 * @param pointInCanvas - The point in canvas coordinates (relative to canvas element)
 * @param canvas - The canvas object containing position information
 * @returns The point in window coordinates (relative to browser viewport)
 *
 * @remarks
 * This is the inverse of {@link convertFromWindow2Canvas}. It translates canvas-relative
 * coordinates to window-relative coordinates.
 *
 * The conversion adds the canvas position to the canvas-relative point:
 * ```
 * windowPoint = canvasPoint + canvasPosition
 * ```
 *
 * This is useful for positioning DOM elements (like tooltips or menus) at specific
 * canvas coordinates, as DOM elements use window coordinates.
 *
 * @example
 * ```typescript
 * // Point on canvas at (400, 250)
 * const canvasPos = { x: 400, y: 250 };
 *
 * // Canvas positioned at (100, 50) in window
 * const canvas = {
 *   position: { x: 100, y: 50 },
 *   width: 800,
 *   height: 600
 * };
 *
 * const windowPos = convertFromCanvas2Window(canvasPos, canvas);
 * // Result: { x: 500, y: 300 }
 * // (400 + 100 = 500, 250 + 50 = 300)
 *
 * // Use for positioning a tooltip
 * tooltip.style.left = `${windowPos.x}px`;
 * tooltip.style.top = `${windowPos.y}px`;
 * ```
 *
 * @category Coordinate Conversion
 * @see {@link convertFromWindow2Canvas} for inverse conversion
 */
export function convertFromCanvas2Window(
    pointInCanvas: Point,
    canvas: Canvas
): Point {
    return PointCal.addVector(pointInCanvas, canvas.position);
}
