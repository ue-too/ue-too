/**
 * Constraints for camera rotation defining an angular range with direction.
 *
 * @property start - Starting angle of the allowed range in radians
 * @property end - Ending angle of the allowed range in radians
 * @property ccw - If true, the range is measured counter-clockwise from start to end. If false, clockwise
 * @property startAsTieBreaker - When clamping and distance to start equals distance to end, clamp to start if true, end if false
 *
 * @remarks
 * Rotation limits define an angular arc. The direction (ccw) determines which
 * way around the circle the range extends from start to end.
 *
 * For example:
 * - start=0, end=π/2, ccw=true: allows 0 to π/2 (0° to 90°)
 * - start=0, end=π/2, ccw=false: allows 0 to -3π/2 going clockwise (0° to 270° the other way)
 *
 * @category Camera
 */
export type RotationLimits = {
    start: number;
    end: number;
    ccw: boolean;
    startAsTieBreaker: boolean;
};

/**
 * Experimental rotation boundary type with positive/negative direction semantics.
 *
 * @property start - Starting angle of the boundary in radians
 * @property end - Ending angle of the boundary in radians
 * @property positiveDirection - If true, range extends in positive angle direction. If false, negative direction
 * @property startAsTieBreaker - When equidistant from start and end, prefer start if true, end if false
 *
 * @remarks
 * This is an experimental alternative to {@link RotationLimits} with different direction semantics.
 *
 * @category Camera
 */
export type RotationBoundary = {
    start: number;
    end: number;
    positiveDirection: boolean;
    startAsTieBreaker: boolean;
};

/**
 * Clamps a rotation angle to stay within specified angular limits.
 *
 * @param rotation - The rotation angle to clamp in radians
 * @param rotationLimits - Optional rotation constraints with direction
 * @returns The clamped rotation angle, or original if already within limits
 *
 * @remarks
 * If the rotation is outside the allowed arc, it's clamped to the nearest
 * boundary (start or end). When equidistant from both, the `startAsTieBreaker`
 * flag determines which boundary to use.
 *
 * The rotation is normalized to [0, 2π] before clamping.
 *
 * @example
 * ```typescript
 * const limits = { start: 0, end: Math.PI/2, ccw: true, startAsTieBreaker: true };
 *
 * clampRotation(Math.PI/4, limits);  // π/4 (within range)
 * clampRotation(Math.PI, limits);    // π/2 (clamped to end)
 * clampRotation(-0.1, limits);       // 0 (clamped to start)
 * ```
 *
 * @category Camera
 */
export function clampRotation(
    rotation: number,
    rotationLimits?: RotationLimits
): number {
    if (
        rotationWithinLimits(rotation, rotationLimits) ||
        rotationLimits === undefined
    ) {
        return rotation;
    }
    rotation = normalizeAngleZero2TwoPI(rotation);
    const angleSpanFromStart = angleSpan(rotationLimits.start, rotation);
    const angleSpanFromEnd = angleSpan(rotationLimits.end, rotation);
    if (
        (rotationLimits.ccw &&
            (angleSpanFromStart < 0 || angleSpanFromEnd > 0)) ||
        (!rotationLimits.ccw &&
            (angleSpanFromStart > 0 || angleSpanFromEnd < 0))
    ) {
        // ccw out of bounds
        if (Math.abs(angleSpanFromStart) === Math.abs(angleSpanFromEnd)) {
            // console.log("tie", "start:", rotationLimits.start, "end:", rotationLimits.end, "rotation:", rotation);
            return rotationLimits.startAsTieBreaker
                ? rotationLimits.start
                : rotationLimits.end;
        }
        const closerToStart =
            Math.abs(angleSpanFromStart) < Math.abs(angleSpanFromEnd);
        return closerToStart ? rotationLimits.start : rotationLimits.end;
    }
    return rotation;
}

/**
 * Checks if a rotation angle is within specified angular limits.
 *
 * @param rotation - The rotation angle to check in radians
 * @param rotationLimits - Optional rotation constraints with direction
 * @returns True if rotation is within the allowed arc or no limits specified, false otherwise
 *
 * @remarks
 * Returns true if:
 * - No limits are specified (undefined)
 * - Start and end angles are effectively equal (full circle allowed)
 * - Rotation falls within the arc from start to end in the specified direction
 *
 * The rotation is normalized to [0, 2π] before checking.
 *
 * @example
 * ```typescript
 * const limits = { start: 0, end: Math.PI/2, ccw: true, startAsTieBreaker: true };
 *
 * rotationWithinLimits(Math.PI/4, limits);   // true (within range)
 * rotationWithinLimits(Math.PI, limits);     // false (outside range)
 * rotationWithinLimits(0, limits);           // true (at start)
 * rotationWithinLimits(Math.PI/2, limits);   // true (at end)
 * ```
 *
 * @category Camera
 */
export function rotationWithinLimits(
    rotation: number,
    rotationLimits?: RotationLimits
): boolean {
    if (rotationLimits === undefined) {
        return true;
    }
    if (
        normalizeAngleZero2TwoPI(rotationLimits.start) ===
        normalizeAngleZero2TwoPI(rotationLimits.end)
    ) {
        return true;
    }
    if (
        normalizeAngleZero2TwoPI(rotationLimits.start + 0.01) ===
        normalizeAngleZero2TwoPI(rotationLimits.end + 0.01)
    ) {
        return true;
    }
    const normalizedRotation = normalizeAngleZero2TwoPI(rotation);
    const angleSpanFromStart = angleSpan(
        rotationLimits.start,
        normalizedRotation
    );
    const angleSpanFromEnd = angleSpan(rotationLimits.end, normalizedRotation);
    if (
        (rotationLimits.ccw &&
            (angleSpanFromStart < 0 || angleSpanFromEnd > 0)) ||
        (!rotationLimits.ccw &&
            (angleSpanFromStart > 0 || angleSpanFromEnd < 0))
    ) {
        return false;
    }
    return true;
}

/**
 * Checks if a rotation angle is within an experimental rotation boundary.
 *
 * @param rotation - The rotation angle to check in radians
 * @param rotationBoundary - Rotation boundary with positive/negative direction
 * @returns True if rotation is within the boundary range, false otherwise
 *
 * @remarks
 * This is an experimental alternative to {@link rotationWithinLimits} using
 * positive/negative direction semantics instead of ccw/cw.
 *
 * @category Camera
 */
export function rotationWithinBoundary(
    rotation: number,
    rotationBoundary: RotationBoundary
): boolean {
    if (
        normalizeAngleZero2TwoPI(rotationBoundary.start) ===
        normalizeAngleZero2TwoPI(rotationBoundary.end)
    ) {
        return true;
    }
    if (
        normalizeAngleZero2TwoPI(rotationBoundary.start + 0.01) ===
        normalizeAngleZero2TwoPI(rotationBoundary.end + 0.01)
    ) {
        return true;
    }
    const normalizedRotation = normalizeAngleZero2TwoPI(rotation);

    let angleFromStart =
        normalizedRotation - normalizeAngleZero2TwoPI(rotationBoundary.start);
    if (angleFromStart < 0) {
        angleFromStart += Math.PI * 2;
    }
    if (!rotationBoundary.positiveDirection && angleFromStart > 0) {
        angleFromStart = Math.PI * 2 - angleFromStart;
    }

    let angleRange =
        normalizeAngleZero2TwoPI(rotationBoundary.end) -
        normalizeAngleZero2TwoPI(rotationBoundary.start);
    if (angleRange < 0) {
        angleRange += Math.PI * 2;
    }
    if (!rotationBoundary.positiveDirection && angleRange > 0) {
        angleRange = Math.PI * 2 - angleRange;
    }

    return angleRange >= angleFromStart;
}

/**
 * Normalizes an angle to the range [0, 2π).
 *
 * @param angle - Angle in radians (can be any value)
 * @returns Equivalent angle in the range [0, 2π)
 *
 * @remarks
 * This function wraps angles to the standard [0, 2π) range. Useful for
 * ensuring consistent angle representation when comparing or storing angles.
 *
 * @example
 * ```typescript
 * normalizeAngleZero2TwoPI(0);           // 0
 * normalizeAngleZero2TwoPI(Math.PI);     // π
 * normalizeAngleZero2TwoPI(3 * Math.PI); // π (wraps around)
 * normalizeAngleZero2TwoPI(-Math.PI/2);  // 3π/2 (negative becomes positive)
 * normalizeAngleZero2TwoPI(2 * Math.PI); // 0 (full rotation)
 * ```
 *
 * @category Camera
 */
export function normalizeAngleZero2TwoPI(angle: number) {
    // reduce the angle
    angle = angle % (Math.PI * 2);

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI
    angle = (angle + Math.PI * 2) % (Math.PI * 2);
    return angle;
}

/**
 * Calculates the signed angular distance between two angles, taking the shorter path.
 *
 * @param from - Starting angle in radians
 * @param to - Target angle in radians
 * @returns Signed angular difference in radians, in the range (-π, π]
 *
 * @remarks
 * Returns the shortest angular path from `from` to `to`:
 * - Positive value: rotate counter-clockwise (positive direction)
 * - Negative value: rotate clockwise (negative direction)
 * - Always returns the smaller of the two possible paths
 *
 * @example
 * ```typescript
 * angleSpan(0, Math.PI/2);        // π/2 (90° ccw)
 * angleSpan(Math.PI/2, 0);        // -π/2 (90° cw)
 * angleSpan(0, 3*Math.PI/2);      // -π/2 (shorter to go cw)
 * angleSpan(3*Math.PI/2, 0);      // π/2 (shorter to go ccw)
 * angleSpan(0, Math.PI);          // π (180°, ambiguous)
 * ```
 *
 * @category Camera
 */
export function angleSpan(from: number, to: number): number {
    // in radians
    from = normalizeAngleZero2TwoPI(from);
    to = normalizeAngleZero2TwoPI(to);
    let angleDiff = to - from;

    if (angleDiff > Math.PI) {
        angleDiff = -(Math.PI * 2 - angleDiff);
    }

    if (angleDiff < -Math.PI) {
        angleDiff += Math.PI * 2;
    }
    return angleDiff;
}

/**
 * Converts degrees to radians.
 *
 * @param deg - Angle in degrees
 * @returns Equivalent angle in radians
 *
 * @example
 * ```typescript
 * deg2rad(0);     // 0
 * deg2rad(90);    // π/2
 * deg2rad(180);   // π
 * deg2rad(360);   // 2π
 * deg2rad(-45);   // -π/4
 * ```
 *
 * @category Camera
 */
export function deg2rad(deg: number): number {
    return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 *
 * @param rad - Angle in radians
 * @returns Equivalent angle in degrees
 *
 * @example
 * ```typescript
 * rad2deg(0);             // 0
 * rad2deg(Math.PI/2);     // 90
 * rad2deg(Math.PI);       // 180
 * rad2deg(2 * Math.PI);   // 360
 * rad2deg(-Math.PI/4);    // -45
 * ```
 *
 * @category Camera
 */
export function rad2deg(rad: number): number {
    return (rad * 180) / Math.PI;
}
