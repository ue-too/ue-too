/**
 * Constraints for camera zoom level with optional minimum and maximum bounds.
 *
 * @property min - Minimum allowed zoom level (optional, e.g., 0.1 for 10% zoom)
 * @property max - Maximum allowed zoom level (optional, e.g., 10 for 1000% zoom)
 *
 * @remarks
 * Zoom level of 1.0 represents 100% (no zoom), values >1 zoom in, values <1 zoom out.
 * If both min and max are undefined, no constraints are applied.
 *
 * @category Camera
 */
export type ZoomLevelLimits = { min?: number; max?: number };

/**
 * Validates that zoom level limits are logically consistent.
 *
 * @param zoomLevelLimits - The zoom limits to validate
 * @returns True if limits are valid or undefined, false if min > max
 *
 * @remarks
 * Returns true if:
 * - Limits are undefined (no constraints)
 * - Only min or max is defined
 * - Both are defined and min ≤ max
 *
 * @example
 * ```typescript
 * isValidZoomLevelLimits({ min: 0.5, max: 5 });    // true
 * isValidZoomLevelLimits({ min: 5, max: 0.5 });    // false
 * isValidZoomLevelLimits({ min: 0.5 });            // true
 * isValidZoomLevelLimits(undefined);               // true
 * ```
 *
 * @category Camera
 */
export function isValidZoomLevelLimits(
    zoomLevelLimits: ZoomLevelLimits | undefined
): boolean {
    if (zoomLevelLimits === undefined) {
        return true;
    }
    if (
        zoomLevelLimits.min !== undefined &&
        zoomLevelLimits.max !== undefined &&
        zoomLevelLimits.min > zoomLevelLimits.max
    ) {
        return false;
    }
    return true;
}

/**
 * Clamps a zoom level to stay within specified limits.
 *
 * @param zoomLevel - The zoom level to clamp
 * @param zoomLevelLimits - Optional zoom constraints
 * @returns The clamped zoom level, or original value if already within limits
 *
 * @remarks
 * If the zoom level is already within limits, returns it unchanged.
 * If no limits are specified, returns the original value.
 *
 * @example
 * ```typescript
 * const limits = { min: 0.5, max: 4 };
 *
 * clampZoomLevel(2.0, limits);  // 2.0 (within bounds)
 * clampZoomLevel(0.1, limits);  // 0.5 (clamped to min)
 * clampZoomLevel(10, limits);   // 4.0 (clamped to max)
 * clampZoomLevel(2.0);          // 2.0 (no limits)
 * ```
 *
 * @category Camera
 */
export function clampZoomLevel(
    zoomLevel: number,
    zoomLevelLimits?: ZoomLevelLimits
): number {
    if (
        zoomLevelWithinLimits(zoomLevel, zoomLevelLimits) ||
        zoomLevelLimits === undefined
    ) {
        return zoomLevel;
    }
    if (zoomLevelLimits.max) {
        zoomLevel = Math.min(zoomLevelLimits.max, zoomLevel);
    }
    if (zoomLevelLimits.min) {
        zoomLevel = Math.max(zoomLevelLimits.min, zoomLevel);
    }
    return zoomLevel;
}

/**
 * Checks if a zoom level is within specified limits.
 *
 * @param zoomLevel - The zoom level to check
 * @param zoomLevelLimits - Optional zoom constraints
 * @returns True if zoom level is valid and within limits, false otherwise
 *
 * @remarks
 * Returns false if:
 * - Zoom level is ≤ 0 (invalid zoom)
 * - Zoom level exceeds maximum limit (if defined)
 * - Zoom level is below minimum limit (if defined)
 *
 * Returns true if no limits are defined or zoom is within bounds.
 *
 * @example
 * ```typescript
 * const limits = { min: 0.5, max: 4 };
 *
 * zoomLevelWithinLimits(2.0, limits);   // true
 * zoomLevelWithinLimits(0.1, limits);   // false (below min)
 * zoomLevelWithinLimits(10, limits);    // false (above max)
 * zoomLevelWithinLimits(-1, limits);    // false (negative zoom)
 * zoomLevelWithinLimits(0, limits);     // false (zero zoom)
 * zoomLevelWithinLimits(2.0);           // true (no limits)
 * ```
 *
 * @category Camera
 */
export function zoomLevelWithinLimits(
    zoomLevel: number,
    zoomLevelLimits?: ZoomLevelLimits
): boolean {
    if (zoomLevelLimits === undefined) {
        return true;
    }
    if (
        zoomLevel <= 0 ||
        (zoomLevelLimits !== undefined &&
            ((zoomLevelLimits.max !== undefined &&
                zoomLevelLimits.max < zoomLevel) ||
                (zoomLevelLimits.min !== undefined &&
                    zoomLevelLimits.min > zoomLevel)))
    ) {
        return false;
    }
    return true;
}
