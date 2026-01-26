import { Point, PointCal } from "@ue-too/math";
import { convert2WorldSpaceWRT } from "./coordinate-conversion";

/**
 * Position boundaries for camera movement in world space.
 * Allows optional constraints on x and y axes independently.
 *
 * @property min - Minimum position constraints (both x and y are optional)
 * @property max - Maximum position constraints (both x and y are optional)
 *
 * @remarks
 * All coordinates are in world space. Each axis (x, y) can be:
 * - Fully constrained: both min and max defined
 * - Partially constrained: only min or max defined
 * - Unconstrained: neither min nor max defined
 *
 * This allows for flexible boundary configurations like:
 * - Horizontal-only boundaries (x constrained, y free)
 * - Vertical-only boundaries (y constrained, x free)
 * - One-sided boundaries (e.g., minimum x but no maximum)
 *
 * @example
 * ```typescript
 * // Fully constrained rectangular boundary
 * const rect: Boundaries = {
 *   min: { x: -1000, y: -1000 },
 *   max: { x: 1000, y: 1000 }
 * };
 *
 * // Horizontal constraints only
 * const horizontal: Boundaries = {
 *   min: { x: -500 },
 *   max: { x: 500 }
 * };
 *
 * // One-sided constraint (can't go below y=0)
 * const floor: Boundaries = {
 *   min: { y: 0 }
 * };
 * ```
 *
 * @category Camera
 */
export type Boundaries = {
    min?: {x?: number, y?: number};
    max?: {x?: number, y?: number};
}

/**
 * Checks if a point is within the specified boundaries.
 *
 * @param point - Point to check in world coordinates
 * @param boundaries - Optional boundary constraints
 * @returns True if point is within boundaries or no boundaries specified, false otherwise
 *
 * @remarks
 * Returns true if:
 * - No boundaries are defined (undefined)
 * - Point satisfies all defined constraints
 *
 * Each axis is checked independently. A missing constraint on an axis means
 * that axis is unbounded.
 *
 * @example
 * ```typescript
 * const bounds: Boundaries = {
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * };
 *
 * withinBoundaries({ x: 0, y: 0 }, bounds);      // true (inside)
 * withinBoundaries({ x: 150, y: 0 }, bounds);    // false (x too large)
 * withinBoundaries({ x: 0, y: -100 }, bounds);   // false (y too small)
 * withinBoundaries({ x: 100, y: 50 }, bounds);   // true (on boundary)
 * withinBoundaries({ x: 0, y: 0 }, undefined);   // true (no bounds)
 * ```
 *
 * @category Camera
 */
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

/**
 * Validates that boundaries are logically consistent.
 *
 * @param boundaries - The boundaries to validate
 * @returns True if boundaries are valid or undefined, false if min >= max on any axis
 *
 * @remarks
 * Returns false if:
 * - On any axis, both min and max are defined AND min >= max
 *
 * Returns true if:
 * - Boundaries are undefined
 * - Only min or max is defined on an axis
 * - Both are defined and min < max on all axes
 *
 * @example
 * ```typescript
 * isValidBoundaries({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }); // true
 * isValidBoundaries({ min: { x: 100 }, max: { x: 0 } });               // false (min > max)
 * isValidBoundaries({ min: { x: 50, y: 50 }, max: { x: 50, y: 60 } }); // false (x min == max)
 * isValidBoundaries({ min: { x: 0 } });                                // true (partial)
 * isValidBoundaries(undefined);                                         // true
 * ```
 *
 * @category Camera
 */
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

/**
 * Checks if boundaries have all four constraints (min/max for both x and y) defined.
 *
 * @param boundaries - The boundaries to check
 * @returns True if all four constraints are defined, false otherwise
 *
 * @remarks
 * Returns true only if boundaries define a complete rectangular region:
 * - min.x, min.y, max.x, and max.y are all defined
 *
 * @example
 * ```typescript
 * boundariesFullyDefined({
 *   min: { x: 0, y: 0 },
 *   max: { x: 100, y: 100 }
 * }); // true
 *
 * boundariesFullyDefined({
 *   min: { x: 0, y: 0 },
 *   max: { x: 100 }  // missing max.y
 * }); // false
 *
 * boundariesFullyDefined({ min: { x: 0 } }); // false
 * boundariesFullyDefined(undefined);          // false
 * ```
 *
 * @category Camera
 */
export function boundariesFullyDefined(boundaries: Boundaries | undefined): boundaries is {min: {x: number, y: number}, max: {x: number, y: number}}{
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

/**
 * Clamps a point to stay within specified boundaries.
 *
 * @param point - Point to clamp in world coordinates
 * @param boundaries - Optional boundary constraints
 * @returns Clamped point, or original if already within bounds or no boundaries
 *
 * @remarks
 * Each axis is clamped independently:
 * - If a min constraint exists on an axis, ensures point >= min
 * - If a max constraint exists on an axis, ensures point <= max
 * - If no constraint exists on an axis, that axis is unchanged
 *
 * @example
 * ```typescript
 * const bounds: Boundaries = {
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * };
 *
 * clampPoint({ x: 0, y: 0 }, bounds);       // { x: 0, y: 0 } (inside)
 * clampPoint({ x: 150, y: 0 }, bounds);     // { x: 100, y: 0 } (clamped x)
 * clampPoint({ x: 0, y: -100 }, bounds);    // { x: 0, y: -50 } (clamped y)
 * clampPoint({ x: 200, y: -200 }, bounds);  // { x: 100, y: -50 } (both clamped)
 * clampPoint({ x: 0, y: 0 }, undefined);    // { x: 0, y: 0 } (no bounds)
 * ```
 *
 * @category Camera
 */
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

/**
 * Calculates the width (x-axis span) of the boundaries.
 *
 * @param boundaries - The boundaries to measure
 * @returns Width in world units, or undefined if x boundaries are not fully defined
 *
 * @remarks
 * Returns undefined if boundaries don't have both min.x and max.x defined.
 * Result is always non-negative for valid boundaries (max.x - min.x).
 *
 * @example
 * ```typescript
 * translationWidthOf({
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * }); // 200
 *
 * translationWidthOf({ min: { x: 0 } }); // undefined (no max.x)
 * translationWidthOf(undefined);          // undefined
 * ```
 *
 * @category Camera
 */
export function translationWidthOf(boundaries: Boundaries | undefined): number | undefined{
    if(boundaries == undefined || boundaries.min == undefined || boundaries.max == undefined || boundaries.min.x == undefined || boundaries.max.x == undefined){
        return undefined;
    }
    return boundaries.max.x - boundaries.min.x;
}

/**
 * Calculates half the width (x-axis half-span) of the boundaries.
 *
 * @param boundaries - The boundaries to measure
 * @returns Half-width in world units, or undefined if x boundaries are not fully defined
 *
 * @remarks
 * Useful for calculating radius or offset from center for x-axis.
 * Equivalent to `translationWidthOf(boundaries) / 2`.
 *
 * @example
 * ```typescript
 * halfTranslationWidthOf({
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * }); // 100
 * ```
 *
 * @category Camera
 */
export function halfTranslationWidthOf(boundaries: Boundaries | undefined): number | undefined{
    const translationWidth = translationWidthOf(boundaries);
    return translationWidth != undefined ? translationWidth / 2 : undefined;
}

/**
 * Calculates the height (y-axis span) of the boundaries.
 *
 * @param boundaries - The boundaries to measure
 * @returns Height in world units, or undefined if y boundaries are not fully defined
 *
 * @remarks
 * Returns undefined if boundaries don't have both min.y and max.y defined.
 * Result is always non-negative for valid boundaries (max.y - min.y).
 *
 * @example
 * ```typescript
 * translationHeightOf({
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * }); // 100
 *
 * translationHeightOf({ min: { y: 0 } }); // undefined (no max.y)
 * translationHeightOf(undefined);          // undefined
 * ```
 *
 * @category Camera
 */
export function translationHeightOf(boundaries: Boundaries | undefined): number | undefined{
    if(boundaries == undefined || boundaries.min == undefined || boundaries.max == undefined || boundaries.min.y == undefined || boundaries.max.y == undefined){
        return undefined;
    }
    return boundaries.max.y - boundaries.min.y;
}

/**
 * Calculates half the height (y-axis half-span) of the boundaries.
 *
 * @param boundaries - The boundaries to measure
 * @returns Half-height in world units, or undefined if y boundaries are not fully defined
 *
 * @remarks
 * Useful for calculating radius or offset from center for y-axis.
 * Equivalent to `translationHeightOf(boundaries) / 2`.
 *
 * @example
 * ```typescript
 * halfTranslationHeightOf({
 *   min: { x: -100, y: -50 },
 *   max: { x: 100, y: 50 }
 * }); // 50
 * ```
 *
 * @category Camera
 */
export function halfTranslationHeightOf(boundaries: Boundaries | undefined): number | undefined{
    const translationHeight = translationHeightOf(boundaries);
    return translationHeight != undefined ? translationHeight / 2 : undefined;
}

/**
 * Clamps camera position to ensure the entire viewport stays within boundaries.
 * More restrictive than {@link clampPoint} as it considers viewport size and rotation.
 *
 * @param point - Proposed camera position in world coordinates
 * @param viewPortWidth - Width of the viewport in CSS pixels
 * @param viewPortHeight - Height of the viewport in CSS pixels
 * @param boundaries - Optional boundary constraints in world space
 * @param cameraZoomLevel - Current camera zoom level
 * @param cameraRotation - Current camera rotation in radians
 * @returns Adjusted camera position that keeps entire viewport within boundaries
 *
 * @remarks
 * This function ensures no part of the viewport extends outside the boundaries.
 * It accounts for:
 * - Viewport dimensions (width/height)
 * - Camera rotation (viewport corners rotate around camera center)
 * - Zoom level (affects world-space size of viewport)
 *
 * The algorithm:
 * 1. Calculates all four viewport corners in world space
 * 2. Clamps each corner to boundaries
 * 3. Finds the maximum displacement needed across all corners
 * 4. Adjusts camera position by that displacement
 *
 * Use this for "edge-stop" behavior where viewport cannot scroll past boundaries.
 * For "center-stop" behavior, use {@link clampPoint} instead.
 *
 * @example
 * ```typescript
 * const bounds: Boundaries = {
 *   min: { x: 0, y: 0 },
 *   max: { x: 1000, y: 1000 }
 * };
 *
 * // Camera at center of bounds, viewport extends outside
 * const adjusted = clampPointEntireViewPort(
 *   { x: 100, y: 100 },  // camera position
 *   800, 600,             // viewport size
 *   bounds,
 *   1.0,                  // zoom
 *   0                     // rotation
 * );
 * // Returns position that prevents viewport from exceeding bounds
 * ```
 *
 * @category Camera
 * @see {@link clampPoint} for clamping camera center only
 */
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
