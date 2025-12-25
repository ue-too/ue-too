import { Boundaries, translationHeightOf, translationWidthOf } from "../camera/utils/position";
import { ZoomLevelLimits } from "../camera/utils/zoom";

/**
 * Calculates minimum zoom level to fit boundaries within canvas at any rotation.
 *
 * @param boundaries - The world-space boundaries to fit
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param cameraRotation - Camera rotation angle in radians
 * @returns Minimum zoom level, or undefined if boundaries are incomplete
 *
 * @remarks
 * This function ensures the entire boundary region remains visible regardless
 * of camera rotation. It considers both width and height projections of the
 * rotated boundaries.
 *
 * When boundaries are rotated, they occupy a larger axis-aligned bounding box.
 * This function calculates the minimum zoom needed to fit that box:
 *
 * For each dimension (width/height):
 * 1. Project boundary width onto canvas width axis: `width * cos(rotation)`
 * 2. Project boundary height onto canvas width axis: `height * cos(rotation)`
 * 3. Calculate zoom needed for each projection
 * 4. Take the maximum of all zoom levels
 *
 * Returns undefined if boundaries don't have both width and height defined.
 *
 * Used when canvas is resized to automatically adjust zoom to keep content visible.
 *
 * @example
 * ```typescript
 * const boundaries = {
 *   min: { x: 0, y: 0 },
 *   max: { x: 1000, y: 500 }
 * };
 *
 * // No rotation, 800x600 canvas
 * const zoom1 = minZoomLevelBaseOnDimensions(boundaries, 800, 600, 0);
 * // Result: 1.2 (600/500, height is limiting)
 *
 * // 45 degree rotation
 * const zoom2 = minZoomLevelBaseOnDimensions(
 *   boundaries, 800, 600, Math.PI / 4
 * );
 * // Result: higher zoom (rotated bounds need more space)
 * ```
 *
 * @category Camera
 * @see {@link minZoomLevelBaseOnWidth} for width-only calculation
 * @see {@link minZoomLevelBaseOnHeight} for height-only calculation
 */
export function minZoomLevelBaseOnDimensions(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    const height = translationHeightOf(boundaries);
    if(width == undefined || height == undefined){
        return undefined;
    }
    // console.log(canvasHeight, canvasWidth);
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    let minZoomLevelWidthWidth = canvasWidth / widthWidthProjection;
    let minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    let minZoomLevelWidthHeight = canvasHeight / widthHeightProjection;
    let minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;
    if(minZoomLevelWidthWidth == Infinity){
        minZoomLevelWidthWidth = 0;
    }
    if(minZoomLevelHeightWidth == Infinity){
        minZoomLevelHeightWidth = 0;
    }
    if(minZoomLevelWidthHeight == Infinity){
        minZoomLevelWidthHeight = 0;
    }
    if(minZoomLevelHeightHeight == Infinity){
        minZoomLevelHeightHeight = 0;
    }

    // console.log(minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);

    const minZoomLevelHeight = canvasHeight / height;
    const minZoomLevelWidth = canvasWidth / width;
    const minZoomLevel = Math.max(minZoomLevelHeight, minZoomLevelWidth, minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);
    return minZoomLevel;
}

/**
 * Determines if zoom level boundaries should be updated.
 *
 * @param zoomLevelBoundaries - Current zoom level limits
 * @param targetMinZoomLevel - Proposed new minimum zoom level
 * @returns True if boundaries should be updated (type guard for targetMinZoomLevel)
 *
 * @remarks
 * Zoom level boundary updates only tighten (increase minimum zoom), never relax.
 * This prevents the camera from zooming out too far when boundaries shrink.
 *
 * Returns true (update needed) when:
 * - No current boundaries exist (first-time setup)
 * - Target minimum is higher than current minimum (tightening)
 *
 * Returns false (no update) when:
 * - Target is undefined (invalid/incomplete)
 * - Target is Infinity (invalid state)
 * - Target is lower than current minimum (would relax, not allowed)
 *
 * This function is a type guard: when it returns true, TypeScript knows
 * targetMinZoomLevel is a number (not undefined).
 *
 * @example
 * ```typescript
 * const currentLimits = { min: 0.5, max: 10 };
 * const newMin = 0.8;
 *
 * if (zoomLevelBoundariesShouldUpdate(currentLimits, newMin)) {
 *   // Safe to use newMin as number here
 *   currentLimits.min = newMin;  // Tighten the limit
 * }
 *
 * // No update for lower values
 * zoomLevelBoundariesShouldUpdate(currentLimits, 0.3);  // false
 * ```
 *
 * @category Camera
 */
export function zoomLevelBoundariesShouldUpdate(zoomLevelBoundaries: ZoomLevelLimits | undefined, targetMinZoomLevel: number | undefined): targetMinZoomLevel is number{
    if(targetMinZoomLevel == undefined){
        return false;
    }
    if(zoomLevelBoundaries == undefined){
        return true;
    }
    if(targetMinZoomLevel == Infinity){
        return false;
    }
    if(zoomLevelBoundaries !== undefined && (zoomLevelBoundaries.min == undefined || targetMinZoomLevel > zoomLevelBoundaries.min)){
        return true;
    }
    return false;
}

/**
 * Calculates minimum zoom level based only on boundary width.
 *
 * @param boundaries - The world-space boundaries
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param cameraRotation - Camera rotation angle in radians
 * @returns Minimum zoom level, or undefined if width is not defined
 *
 * @remarks
 * Similar to {@link minZoomLevelBaseOnDimensions} but only considers the
 * width constraint. Useful when height is unbounded or not relevant.
 *
 * Calculates zoom needed to fit the boundary width within the canvas,
 * accounting for rotation:
 * - Width projection on canvas X-axis: `width * cos(rotation)`
 * - Width projection on canvas Y-axis: `width * sin(rotation)`
 *
 * Takes the maximum of these to ensure the width fits regardless of
 * how rotation distributes it across canvas axes.
 *
 * @example
 * ```typescript
 * const boundaries = {
 *   min: { x: 0 },
 *   max: { x: 1000 }
 * };
 *
 * const zoom = minZoomLevelBaseOnWidth(boundaries, 800, 600, 0);
 * // Result: 0.8 (800/1000)
 * ```
 *
 * @category Camera
 * @see {@link minZoomLevelBaseOnDimensions} for full calculation
 */
export function minZoomLevelBaseOnWidth(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    if(width == undefined){
        return undefined;
    }
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const minZoomLevelWidthWidth = canvasWidth / widthWidthProjection;
    const minZoomLevelWidthHeight = canvasHeight / widthHeightProjection;
    if(minZoomLevelWidthWidth == Infinity){
        return minZoomLevelWidthHeight;
    }
    const minZoomLevel = Math.max(canvasWidth / widthWidthProjection, canvasHeight / widthHeightProjection);
    return minZoomLevel;
}

/**
 * Calculates minimum zoom level based only on boundary height.
 *
 * @param boundaries - The world-space boundaries
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param cameraRotation - Camera rotation angle in radians
 * @returns Minimum zoom level, or undefined if height is not defined
 *
 * @remarks
 * Similar to {@link minZoomLevelBaseOnDimensions} but only considers the
 * height constraint. Useful when width is unbounded or not relevant.
 *
 * Calculates zoom needed to fit the boundary height within the canvas,
 * accounting for rotation:
 * - Height projection on canvas X-axis: `height * cos(rotation)`
 * - Height projection on canvas Y-axis: `height * sin(rotation)`
 *
 * Takes the maximum of these to ensure the height fits regardless of
 * how rotation distributes it across canvas axes.
 *
 * @example
 * ```typescript
 * const boundaries = {
 *   min: { y: 0 },
 *   max: { y: 500 }
 * };
 *
 * const zoom = minZoomLevelBaseOnHeight(boundaries, 800, 600, 0);
 * // Result: 1.2 (600/500)
 * ```
 *
 * @category Camera
 * @see {@link minZoomLevelBaseOnDimensions} for full calculation
 */
export function minZoomLevelBaseOnHeight(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const height = translationHeightOf(boundaries);
    if(height == undefined){
        return undefined;
    }
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    const minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    const minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;
    if(minZoomLevelHeightHeight == Infinity){
        return minZoomLevelHeightWidth;
    }
    const minZoomLevel = Math.max(minZoomLevelHeightWidth, minZoomLevelHeightHeight);
    return minZoomLevel;
}
