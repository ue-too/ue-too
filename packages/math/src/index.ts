/**
 * @packageDocumentation
 * Mathematical utilities for 2D and 3D point operations, vector calculations, and transformations.
 *
 * @remarks
 * This package provides essential mathematical operations for canvas applications including:
 * - Vector arithmetic (add, subtract, multiply, divide)
 * - Vector operations (dot product, cross product, magnitude, unit vectors)
 * - Geometric transformations (rotation, axis transformation)
 * - Angle calculations and normalization
 * - Point comparisons and interpolation
 * - Line intersection detection
 *
 * All operations support both 2D and 3D coordinates, with the z-axis being optional.
 *
 * @example
 * Basic vector operations
 * ```typescript
 * import { PointCal, Point } from '@ue-too/math';
 *
 * const a: Point = { x: 1, y: 2 };
 * const b: Point = { x: 3, y: 4 };
 *
 * // Add vectors
 * const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }
 *
 * // Calculate magnitude
 * const mag = PointCal.magnitude(a); // 2.236...
 *
 * // Get unit vector
 * const unit = PointCal.unitVector(a); // { x: 0.447..., y: 0.894... }
 * ```
 *
 * @example
 * Rotation and transformation
 * ```typescript
 * import { PointCal, Point } from '@ue-too/math';
 *
 * const point: Point = { x: 10, y: 0 };
 * const angle = Math.PI / 2; // 90 degrees
 *
 * // Rotate point around origin
 * const rotated = PointCal.rotatePoint(point, angle); // { x: 0, y: 10 }
 *
 * // Rotate around a custom anchor
 * const anchor: Point = { x: 5, y: 5 };
 * const rotatedAroundAnchor = PointCal.transformPointWRTAnchor(point, anchor, angle);
 * ```
 */

/**
 * Represents a 2D or 3D point with optional z-coordinate.
 *
 * @remarks
 * This is a lowercase variant maintained for backward compatibility.
 * Use {@link Point} for new code.
 *
 * @deprecated Use {@link Point} instead for better TypeScript conventions.
 */
export type point = {
    /** X-coordinate */
    x: number;
    /** Y-coordinate */
    y: number;
    /** Optional Z-coordinate for 3D operations */
    z?: number;
}

/**
 * Represents a 2D or 3D point with optional z-coordinate.
 *
 * @remarks
 * When z is undefined, operations treat the point as 2D (z = 0).
 * This type is used throughout the library for all point and vector operations.
 *
 * @example
 * ```typescript
 * // 2D point
 * const p2d: Point = { x: 10, y: 20 };
 *
 * // 3D point
 * const p3d: Point = { x: 10, y: 20, z: 30 };
 * ```
 */
export type Point = {
    /** X-coordinate */
    x: number;
    /** Y-coordinate */
    y: number;
    /** Optional Z-coordinate for 3D operations */
    z?: number;
}


/**
 * Utility class for point and vector calculations.
 *
 * @remarks
 * PointCal provides static methods for common 2D and 3D mathematical operations
 * used in canvas applications. All methods handle both 2D and 3D coordinates seamlessly.
 *
 * @example
 * ```typescript
 * import { PointCal, Point } from '@ue-too/math';
 *
 * const v1: Point = { x: 1, y: 2 };
 * const v2: Point = { x: 3, y: 4 };
 *
 * const sum = PointCal.addVector(v1, v2);
 * const dot = PointCal.dotProduct(v1, v2);
 * ```
 */
export class PointCal {

    /**
     * Adds two vectors together.
     *
     * @param a - First vector
     * @param b - Second vector
     * @returns The sum of vectors a and b
     *
     * @remarks
     * If either vector lacks a z-coordinate, it's treated as 0.
     * The result will include a z-coordinate if either input has one.
     *
     * @example
     * ```typescript
     * const a = { x: 1, y: 2 };
     * const b = { x: 3, y: 4 };
     * const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }
     *
     * // With 3D coordinates
     * const a3d = { x: 1, y: 2, z: 3 };
     * const b3d = { x: 4, y: 5, z: 6 };
     * const sum3d = PointCal.addVector(a3d, b3d); // { x: 5, y: 7, z: 9 }
     * ```
     *
     * @group Vector Arithmetic
     */
    static addVector(a: point, b: point): Point {
        if (a.z == null && b.z == null) return {x: a.x + b.x, y: a.y + b.y};
        if (a.z == null || b.z == null) {
            if (a.z == null) a.z = 0;
            if (b.z == null) b.z = 0;
        }
        return {x: a.x + b.x, y: a.y + b.y, z: a.z + b.z}; 
    }

    /**
     * Subtracts vector b from vector a.
     *
     * @param a - Vector to subtract from
     * @param b - Vector to subtract
     * @returns The difference (a - b)
     *
     * @remarks
     * If either vector lacks a z-coordinate, it's treated as 0.
     *
     * @example
     * ```typescript
     * const a = { x: 5, y: 7 };
     * const b = { x: 2, y: 3 };
     * const diff = PointCal.subVector(a, b); // { x: 3, y: 4 }
     * ```
     *
     * @group Vector Arithmetic
     */
    static subVector(a: point, b: point): Point {
        if (a.z == null && b.z == null) return {x: a.x - b.x, y: a.y - b.y};
        if (a.z == null || b.z == null) {
            if (a.z == null) a.z = 0;
            if (b.z == null) b.z = 0;
        }
        return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
    }

    /**
     * Multiplies a vector by a scalar value.
     *
     * @param a - Vector to multiply
     * @param b - Scalar multiplier
     * @returns The scaled vector
     *
     * @example
     * ```typescript
     * const v = { x: 2, y: 3 };
     * const scaled = PointCal.multiplyVectorByScalar(v, 2.5); // { x: 5, y: 7.5 }
     * ```
     *
     * @group Vector Arithmetic
     */
    static multiplyVectorByScalar(a: point, b: number): Point {
        if (a.z == null) return {x: a.x * b, y: a.y * b};
        return {x: a.x * b, y: a.y * b, z: a.z * b};
    }

    /**
     * Divides a vector by a scalar value.
     *
     * @param a - Vector to divide
     * @param b - Scalar divisor
     * @returns The divided vector, or the original vector if b is 0
     *
     * @remarks
     * Division by zero returns the original vector unchanged to prevent NaN values.
     *
     * @example
     * ```typescript
     * const v = { x: 10, y: 20 };
     * const divided = PointCal.divideVectorByScalar(v, 2); // { x: 5, y: 10 }
     * ```
     *
     * @group Vector Arithmetic
     */
    static divideVectorByScalar(a: point, b: number): Point {
        if (b == 0) return {x: a.x, y: a.y};
        if (a.z == null) return {x: a.x / b, y: a.y / b};
        return {x: a.x / b, y: a.y / b, z: a.z / b};
    }

    /**
     * Calculates the magnitude (length) of a vector.
     *
     * @param a - Vector to measure
     * @returns The magnitude of the vector
     *
     * @remarks
     * Uses the Euclidean distance formula: √(x² + y² + z²)
     *
     * @example
     * ```typescript
     * const v = { x: 3, y: 4 };
     * const mag = PointCal.magnitude(v); // 5
     *
     * const v3d = { x: 1, y: 2, z: 2 };
     * const mag3d = PointCal.magnitude(v3d); // 3
     * ```
     *
     * @group Vector Operations
     */
    static magnitude(a: point): number {
        if (a.z == null) a.z = 0;
        return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    }

    /**
     * Converts a vector to its unit vector (normalized to length 1).
     *
     * @param a - Vector to normalize
     * @returns Unit vector in the same direction, or zero vector if magnitude is 0
     *
     * @remarks
     * A unit vector has magnitude 1 and preserves the original direction.
     * Returns {x: 0, y: 0, z: 0} if the input vector has zero magnitude.
     *
     * **Performance note**: This method calls `magnitude()` twice. For better performance
     * when you need both magnitude and unit vector, calculate magnitude once and divide manually.
     *
     * @example
     * ```typescript
     * const v = { x: 3, y: 4 };
     * const unit = PointCal.unitVector(v); // { x: 0.6, y: 0.8 }
     * ```
     *
     * @group Vector Operations
     */
    static unitVector(a: point): Point {
        if (a.z == null) a.z = 0;
        return this.magnitude(a) != 0 ? {x: a.x / this.magnitude(a), y: a.y / this.magnitude(a), z: a.z / this.magnitude(a)} : {x: 0, y: 0, z: 0};
    }

    /**
     * Calculates the dot product of two vectors.
     *
     * @param a - First vector
     * @param b - Second vector
     * @returns The dot product (scalar value)
     *
     * @remarks
     * The dot product is: a.x * b.x + a.y * b.y + a.z * b.z
     *
     * **Use cases:**
     * - Determine if vectors are perpendicular (dot = 0)
     * - Calculate angle between vectors: θ = acos(dot / (|a| * |b|))
     * - Project one vector onto another
     *
     * @example
     * ```typescript
     * const a = { x: 1, y: 0 };
     * const b = { x: 0, y: 1 };
     * const dot = PointCal.dotProduct(a, b); // 0 (perpendicular vectors)
     *
     * const c = { x: 2, y: 3 };
     * const d = { x: 4, y: 5 };
     * const dot2 = PointCal.dotProduct(c, d); // 23
     * ```
     *
     * @group Vector Operations
     */
    static dotProduct(a: point, b: point): number {
        if (a.z == null && b.z == null) return a.x * b.x + a.y * b.y;
        if (a.z == null || b.z == null) {
            if (a.z == null) a.z = 0;
            if (b.z == null) b.z = 0;
        }
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * Calculates the cross product of two vectors.
     *
     * @param a - First vector
     * @param b - Second vector
     * @returns The cross product vector perpendicular to both inputs
     *
     * @remarks
     * The cross product is perpendicular to both input vectors, following the right-hand rule.
     * For 2D vectors (z undefined), z is treated as 0.
     *
     * **Properties:**
     * - Result is perpendicular to both input vectors
     * - Magnitude equals area of parallelogram formed by vectors
     * - Direction follows right-hand rule
     *
     * @example
     * ```typescript
     * const a = { x: 1, y: 0, z: 0 };
     * const b = { x: 0, y: 1, z: 0 };
     * const cross = PointCal.crossProduct(a, b); // { x: 0, y: 0, z: 1 }
     * ```
     *
     * @group Vector Operations
     */
    static crossProduct(a: point, b: point): Point {
        if (a.z == null || b.z == null) {
            if (a.z == null) a.z = 0;
            if (b.z == null) b.z = 0;
        }
        return {x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x};
    }

    /**
     * Calculates the unit vector pointing from point a to point b.
     *
     * @param a - Starting point
     * @param b - Ending point
     * @returns Unit vector in the direction from a to b
     *
     * @remarks
     * Equivalent to calling unitVector(subVector(b, a))
     *
     * @example
     * ```typescript
     * const a = { x: 0, y: 0 };
     * const b = { x: 3, y: 4 };
     * const direction = PointCal.unitVectorFromA2B(a, b); // { x: 0.6, y: 0.8 }
     * ```
     *
     * @group Geometric Calculations
     */
    static unitVectorFromA2B(a: point, b: point): Point {
        return this.unitVector(this.subVector(b, a));
    }

    /**
     * Rotates a point around the origin.
     *
     * @param point - Point to rotate
     * @param angle - Rotation angle in radians (counter-clockwise)
     * @returns Rotated point
     *
     * @remarks
     * Rotation is performed around the origin (0, 0).
     * Positive angles rotate counter-clockwise, negative angles rotate clockwise.
     * For rotation around a custom anchor, use {@link transformPointWRTAnchor}.
     *
     * **Performance**: Uses trigonometric functions (sin/cos). For many rotations with
     * the same angle, pre-calculate sin/cos values and apply the transformation manually.
     *
     * @example
     * ```typescript
     * const point = { x: 1, y: 0 };
     * const rotated = PointCal.rotatePoint(point, Math.PI / 2); // { x: 0, y: 1 }
     * ```
     *
     * @group Transformations
     */
    static rotatePoint(point: point, angle: number): Point {
        return {x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle)};
    }

    /**
     * Transforms a point's coordinates to a new rotated axis system.
     *
     * @param point - Point in original coordinate system
     * @param angleFromOriginalAxis2DestAxis - Rotation angle from original to destination axis (radians, CCW positive)
     * @returns Point coordinates in the new axis system
     *
     * @remarks
     * This performs an axis rotation transformation, converting coordinates from one
     * reference frame to another rotated by the specified angle.
     *
     * @example
     * ```typescript
     * const point = { x: 10, y: 0 };
     * const angle = Math.PI / 4; // 45 degrees
     * const transformed = PointCal.transform2NewAxis(point, angle);
     * ```
     *
     * @group Transformations
     */
    static transform2NewAxis(point: point, angleFromOriginalAxis2DestAxis: number): Point {
        // angle is the angle from the original axis to the destination axis ccw is positive as always
        return {x: point.x * Math.cos(angleFromOriginalAxis2DestAxis) + point.y * Math.sin(angleFromOriginalAxis2DestAxis), y: -point.x * Math.sin(angleFromOriginalAxis2DestAxis) + point.y * Math.cos(angleFromOriginalAxis2DestAxis)};
    }

    /**
     * Calculates the signed angle from vector a to vector b.
     *
     * @param a - First vector (starting direction)
     * @param b - Second vector (ending direction)
     * @returns The signed angle in radians, range: (-π, π]
     *
     * @remarks
     * - Positive angles indicate counter-clockwise rotation from a to b
     * - Negative angles indicate clockwise rotation from a to b
     * - Uses atan2 for proper quadrant handling
     *
     * @example
     * ```typescript
     * const right = { x: 1, y: 0 };
     * const up = { x: 0, y: 1 };
     * const angle = PointCal.angleFromA2B(right, up); // π/2 (90 degrees CCW)
     *
     * const down = { x: 0, y: -1 };
     * const angleDown = PointCal.angleFromA2B(right, down); // -π/2 (90 degrees CW)
     * ```
     *
     * @group Angle Utilities
     */
    static angleFromA2B(a: point, b: point): number {
        return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
    }

    /**
     * Rotates a point around a custom anchor point.
     *
     * @param point - Point to rotate
     * @param anchor - Anchor point to rotate around
     * @param angle - Rotation angle in radians (counter-clockwise)
     * @returns Rotated point
     *
     * @remarks
     * This is equivalent to:
     * 1. Translate point by -anchor
     * 2. Rotate around origin
     * 3. Translate back by +anchor
     *
     * @example
     * ```typescript
     * const point = { x: 10, y: 5 };
     * const anchor = { x: 5, y: 5 };
     * const angle = Math.PI / 2; // 90 degrees
     * const rotated = PointCal.transformPointWRTAnchor(point, anchor, angle);
     * // Rotates point around anchor (5, 5)
     * ```
     *
     * @group Transformations
     */
    static transformPointWRTAnchor(point: point, anchor: point, angle: number): Point {
        // angle is in radians
        let newPoint = this.rotatePoint(this.subVector(point, anchor), angle);
        return this.addVector(newPoint, anchor);
    }

    /**
     * Calculates the Euclidean distance between two points.
     *
     * @param a - First point
     * @param b - Second point
     * @returns The distance between the two points
     *
     * @remarks
     * Equivalent to calculating the magnitude of the vector from a to b.
     *
     * @example
     * ```typescript
     * const a = { x: 0, y: 0 };
     * const b = { x: 3, y: 4 };
     * const distance = PointCal.distanceBetweenPoints(a, b); // 5
     * ```
     *
     * @group Geometric Calculations
     */
    static distanceBetweenPoints(a: point, b: point): number {
        return this.magnitude(this.subVector(a, b));
    }

    /**
     * Flips a point's y-coordinate (mirrors across the x-axis).
     *
     * @param point - Point to flip
     * @returns Point with negated y-coordinate
     *
     * @remarks
     * Useful for converting between coordinate systems where the y-axis direction differs.
     * Common when converting between screen coordinates (y-down) and mathematical coordinates (y-up).
     *
     * @example
     * ```typescript
     * const point = { x: 10, y: 20 };
     * const flipped = PointCal.flipYAxis(point); // { x: 10, y: -20 }
     * ```
     *
     * @group Transformations
     */
    static flipYAxis(point: point): Point{
        return {x: point.x, y: -point.y, z: point.z};
    }

    /**
     * Performs linear interpolation between two points.
     *
     * @param a - Starting point (t = 0)
     * @param b - Ending point (t = 1)
     * @param t - Interpolation parameter (0 to 1)
     * @returns Interpolated point
     *
     * @remarks
     * - t = 0 returns point a
     * - t = 1 returns point b
     * - t = 0.5 returns the midpoint
     * - Values outside [0, 1] perform extrapolation
     *
     * **Performance**: Suitable for animation loops and real-time interpolation.
     *
     * @example
     * ```typescript
     * const a = { x: 0, y: 0 };
     * const b = { x: 10, y: 20 };
     * const mid = PointCal.linearInterpolation(a, b, 0.5); // { x: 5, y: 10 }
     * const quarter = PointCal.linearInterpolation(a, b, 0.25); // { x: 2.5, y: 5 }
     * ```
     *
     * @group Geometric Calculations
     */
    static linearInterpolation(a: point, b: point, t: number): point{
        if (a.z == null || b.z == null) {
            return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
        } else {
            return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t};
        }
    }

    /**
     * Checks if two points are exactly equal.
     *
     * @param a - First point
     * @param b - Second point
     * @returns True if all coordinates are exactly equal
     *
     * @remarks
     * Uses strict equality (===) for comparison.
     * For approximate equality with tolerance, use {@link samePoint} instead.
     * Missing z-coordinates are treated as 0.
     *
     * @example
     * ```typescript
     * const a = { x: 1, y: 2 };
     * const b = { x: 1, y: 2 };
     * PointCal.isEqual(a, b); // true
     *
     * const c = { x: 1.0000001, y: 2 };
     * PointCal.isEqual(a, c); // false (use samePoint for tolerance)
     * ```
     *
     * @group Geometric Calculations
     */
    static isEqual(a: point, b: point): boolean{
        if (a.z == null){
            a.z = 0;
        }
        if (b.z == null){
            b.z = 0;
        }
        return a.x == b.x && a.y == b.y && a.z == b.z;
    }

    /**
     * Calculates the intersection point of two line segments.
     *
     * @param startPoint - Start of first line segment
     * @param endPoint - End of first line segment
     * @param startPoint2 - Start of second line segment
     * @param endPoint2 - End of second line segment
     * @returns Object containing intersection status and details
     *
     * @remarks
     * Returns an object with:
     * - `intersects`: Boolean indicating if segments intersect
     * - `intersection`: The intersection point (only if intersects is true)
     * - `offset`: Parameter t where intersection occurs on first segment (0 to 1)
     *
     * The segments must actually cross within their bounds (not just their infinite extensions).
     *
     * **Use cases:**
     * - Collision detection between line segments
     * - Ray casting and visibility checks
     * - Path intersection detection
     *
     * @example
     * ```typescript
     * const line1Start = { x: 0, y: 0 };
     * const line1End = { x: 10, y: 10 };
     * const line2Start = { x: 0, y: 10 };
     * const line2End = { x: 10, y: 0 };
     *
     * const result = PointCal.getLineIntersection(line1Start, line1End, line2Start, line2End);
     * // { intersects: true, intersection: { x: 5, y: 5 }, offset: 0.5 }
     * ```
     *
     * @group Geometric Calculations
     */
    static getLineIntersection(startPoint: Point, endPoint: Point, startPoint2: Point, endPoint2: Point):{
        intersects: boolean,
        intersection?: Point,
        offset?: number
    }{
        const numerator = (endPoint2.x - startPoint2.x) * (startPoint.y - startPoint2.y) - (endPoint2.y - startPoint2.y) * (startPoint.x - startPoint2.x);
        const denominator = (endPoint2.y - startPoint2.y) * (endPoint.x - startPoint.x) - (endPoint2.x - startPoint2.x) * (endPoint.y - startPoint.y);
        
        if (denominator === 0){
            return {intersects: false};
        }
        const t = numerator / denominator;
        if (t >= 0 && t <= 1){
            return {
                intersects: true, 
                intersection: PointCal.linearInterpolation(startPoint, endPoint, t),
                offset: t
            }
        } else {
            return {
                intersects: false,
            }
        }
    
    }
    
}

/**
 * Normalizes an angle to the range [0, 2π).
 *
 * @param angle - Angle in radians (can be any value)
 * @returns Normalized angle between 0 and 2π
 *
 * @remarks
 * This function wraps any angle to the range [0, 2π) by taking the modulo
 * and ensuring the result is positive.
 *
 * @example
 * ```typescript
 * normalizeAngleZero2TwoPI(Math.PI * 3); // π (180 degrees)
 * normalizeAngleZero2TwoPI(-Math.PI / 2); // 3π/2 (270 degrees)
 * normalizeAngleZero2TwoPI(0); // 0
 * ```
 *
 * @category Angle
 */
export function normalizeAngleZero2TwoPI(angle: number){
    // reduce the angle  
    angle = angle % (Math.PI * 2);

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI 
    angle = (angle + Math.PI * 2) % (Math.PI * 2); 
    return angle;
}

/**
 * Calculates the smallest angular difference between two angles.
 *
 * @param from - Starting angle in radians
 * @param to - Ending angle in radians
 * @returns The smallest angle span from 'from' to 'to', in range (-π, π]
 *
 * @remarks
 * This function accounts for wrapping around 2π and always returns the shorter path.
 * Positive result means counter-clockwise rotation, negative means clockwise.
 *
 * @example
 * ```typescript
 * // From 0° to 90°
 * angleSpan(0, Math.PI / 2); // π/2 (90 degrees CCW)
 *
 * // From 350° to 10° (shorter to go CCW through 0°)
 * angleSpan(350 * Math.PI / 180, 10 * Math.PI / 180); // ≈ 20 degrees
 *
 * // From 10° to 350° (shorter to go CW through 0°)
 * angleSpan(10 * Math.PI / 180, 350 * Math.PI / 180); // ≈ -20 degrees
 * ```
 *
 * @category Angle
 */
export function angleSpan(from: number, to: number): number{
    // in radians
    from = normalizeAngleZero2TwoPI(from);
    to = normalizeAngleZero2TwoPI(to);
    let angleDiff = to - from;
    
    if(angleDiff > Math.PI){
        angleDiff = - (Math.PI * 2 - angleDiff);
    }

    if(angleDiff < -Math.PI){
        angleDiff += (Math.PI * 2);
    }
    return angleDiff;
}

/**
 * Checks if two numbers are approximately equal within a tolerance.
 *
 * @param a - First number
 * @param b - Second number
 * @param precision - Optional tolerance (defaults to 0.000001)
 * @returns True if the absolute difference is within the precision threshold
 *
 * @remarks
 * Useful for floating-point comparisons where exact equality is unreliable.
 *
 * @example
 * ```typescript
 * approximatelyTheSame(1.0, 1.0000001); // true (within default epsilon)
 * approximatelyTheSame(1.0, 1.1); // false
 * approximatelyTheSame(1.0, 1.01, 0.02); // true (within custom precision)
 * ```
 *
 * @category Comparison
 */
export function approximatelyTheSame(a: number, b: number, precision?: number): boolean {
    const epsilon = 0.000001
    return Math.abs(a - b) <= (precision || epsilon);
}

/**
 * Checks if two vectors point in the same direction.
 *
 * @param a - First vector
 * @param b - Second vector
 * @param precision - Tolerance for comparison (defaults to 0.001)
 * @returns True if vectors have the same direction (after normalization)
 *
 * @remarks
 * Normalizes both vectors to unit vectors and compares them.
 * Magnitude does not matter, only direction.
 *
 * @example
 * ```typescript
 * const a = { x: 1, y: 0 };
 * const b = { x: 10, y: 0 }; // Same direction, different magnitude
 * sameDirection(a, b); // true
 *
 * const c = { x: 1, y: 1 };
 * sameDirection(a, c); // false (different direction)
 * ```
 *
 * @category Comparison
 */
export function sameDirection(a: Point, b: Point, precision: number = 0.001): boolean{
   const aNormalized = PointCal.unitVector(a);
   const bNormalized = PointCal.unitVector(b);
   return samePoint(aNormalized, bNormalized, precision);
}

/**
 * Checks if a direction vector is aligned with a tangent vector.
 *
 * @param direction - Direction vector to check
 * @param tangent - Tangent vector reference
 * @returns True if direction aligns with tangent (within 90 degrees)
 *
 * @remarks
 * Returns true if the direction is within 90 degrees of either the tangent
 * or its reverse. Useful for determining if movement is along a path.
 *
 * @example
 * ```typescript
 * const direction = { x: 1, y: 0 };
 * const tangent = { x: 1, y: 0.1 }; // Slightly rotated
 * directionAlignedToTangent(direction, tangent); // true
 *
 * const perpendicular = { x: 0, y: 1 };
 * directionAlignedToTangent(perpendicular, tangent); // false
 * ```
 *
 * @category Comparison
 */
export function directionAlignedToTangent(direction: Point, tangent: Point): boolean {
   const directionNormalized = PointCal.unitVector(direction);
   const tangentNormalized = PointCal.unitVector(tangent);
   const reversedTangent = {x: -tangent.x, y: -tangent.y, z: tangent.z};
   const angle = PointCal.angleFromA2B(directionNormalized, tangentNormalized);
   const angle2 = PointCal.angleFromA2B(directionNormalized, reversedTangent);
   return (angle < Math.PI / 2 && angle > -Math.PI / 2) && (angle2 > Math.PI / 2 || angle2 < -Math.PI / 2);
}

/**
 * Checks if two points are approximately at the same location.
 *
 * @param a - First point
 * @param b - Second point
 * @param precision - Optional tolerance for coordinate comparison
 * @returns True if both x and y coordinates are within precision
 *
 * @remarks
 * Uses {@link approximatelyTheSame} for coordinate comparison.
 * For exact equality, use {@link PointCal.isEqual} instead.
 *
 * @example
 * ```typescript
 * const a = { x: 1.0, y: 2.0 };
 * const b = { x: 1.0000001, y: 2.0000001 };
 * samePoint(a, b); // true (within default precision)
 *
 * const c = { x: 1.1, y: 2.0 };
 * samePoint(a, c); // false
 * ```
 *
 * @category Comparison
 */
export function samePoint(a: Point, b: Point, precision?: number): boolean {
    if(approximatelyTheSame(a.x, b.x, precision) && approximatelyTheSame(a.y, b.y, precision)){
        return true;
    }
    return false;
}
