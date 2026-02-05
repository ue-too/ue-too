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
};

const addVector = (a: Point, b: Point) => {
    if (a.z == null && b.z == null) return { x: a.x + b.x, y: a.y + b.y };
    if (a.z == null || b.z == null) {
        if (a.z == null) a.z = 0;
        if (b.z == null) b.z = 0;
    }
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
};

const subVector = (a: Point, b: Point): Point => {
    if (a.z == null && b.z == null) return { x: a.x - b.x, y: a.y - b.y };
    if (a.z == null || b.z == null) {
        if (a.z == null) a.z = 0;
        if (b.z == null) b.z = 0;
    }
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
};

const multiplyVectorByScalar = (a: Point, b: number): Point => {
    if (a.z == null) return { x: a.x * b, y: a.y * b };
    return { x: a.x * b, y: a.y * b, z: a.z * b };
};

const divideVectorByScalar = (a: Point, b: number): Point => {
    if (b == 0) return { x: a.x, y: a.y };
    if (a.z == null) return { x: a.x / b, y: a.y / b };
    return { x: a.x / b, y: a.y / b, z: a.z / b };
};

const magnitude = (a: Point): number => {
    if (a.z == null) a.z = 0;
    return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
};

const unitVector = (a: Point): Point => {
    if (a.z == null) a.z = 0;
    const mag = magnitude(a);
    return mag != 0
        ? {
            x: a.x / mag,
            y: a.y / mag,
            z: a.z / mag,
        }
        : { x: 0, y: 0, z: 0 };
};

const dotProduct = (a: Point, b: Point): number => {
    if (a.z == null && b.z == null) return a.x * b.x + a.y * b.y;
    if (a.z == null || b.z == null) {
        if (a.z == null) a.z = 0;
        if (b.z == null) b.z = 0;
    }
    return a.x * b.x + a.y * b.y + a.z * b.z;
};

const crossProduct = (a: Point, b: Point): Point => {
    if (a.z == null || b.z == null) {
        if (a.z == null) a.z = 0;
        if (b.z == null) b.z = 0;
    }
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
};

const unitVectorFromA2B = (a: Point, b: Point): Point => {
    return unitVector(subVector(b, a));
};

const rotatePoint = (point: Point, angle: number): Point => {
    return {
        x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
        y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
    };
};

const transform2NewAxis = (
    point: Point,
    angleFromOriginalAxis2DestAxis: number
): Point => {
    // angle is the angle from the original axis to the destination axis ccw is positive as always
    return {
        x:
            point.x * Math.cos(angleFromOriginalAxis2DestAxis) +
            point.y * Math.sin(angleFromOriginalAxis2DestAxis),
        y:
            -point.x * Math.sin(angleFromOriginalAxis2DestAxis) +
            point.y * Math.cos(angleFromOriginalAxis2DestAxis),
    };
};

const angleFromA2B = (a: Point, b: Point): number => {
    return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
};

const transformPointWRTAnchor = (
    point: Point,
    anchor: Point,
    angle: number
): Point => {
    // angle is in radians
    let newPoint = rotatePoint(subVector(point, anchor), angle);
    return addVector(newPoint, anchor);
};

const distanceBetweenPoints = (a: Point, b: Point): number => {
    return magnitude(subVector(a, b));
};

const flipYAxis = (point: Point): Point => {
    return { x: point.x, y: -point.y, z: point.z };
};

const linearInterpolation = (a: Point, b: Point, t: number): Point => {
    if (a.z == null || b.z == null) {
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    } else {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t,
        };
    }
};

const isEqual = (a: Point, b: Point): boolean => {
    if (a.z == null) {
        a.z = 0;
    }
    if (b.z == null) {
        b.z = 0;
    }
    return a.x == b.x && a.y == b.y && a.z == b.z;
};

const getLineIntersection = (
    startPoint: Point,
    endPoint: Point,
    startPoint2: Point,
    endPoint2: Point
): {
    intersects: boolean;
    intersection?: Point;
    offset?: number;
} => {
    const numerator =
        (endPoint2.x - startPoint2.x) * (startPoint.y - startPoint2.y) -
        (endPoint2.y - startPoint2.y) * (startPoint.x - startPoint2.x);
    const denominator =
        (endPoint2.y - startPoint2.y) * (endPoint.x - startPoint.x) -
        (endPoint2.x - startPoint2.x) * (endPoint.y - startPoint.y);

    if (denominator === 0) {
        return { intersects: false };
    }
    const t = numerator / denominator;
    if (t >= 0 && t <= 1) {
        return {
            intersects: true,
            intersection: linearInterpolation(
                startPoint,
                endPoint,
                t
            ),
            offset: t,
        };
    } else {
        return {
            intersects: false,
        };
    }
};

export {
    addVector,
    subVector,
    multiplyVectorByScalar,
    divideVectorByScalar,
    magnitude,
    unitVector,
    dotProduct,
    crossProduct,
    unitVectorFromA2B,
    rotatePoint,
    transform2NewAxis,
    angleFromA2B,
    transformPointWRTAnchor,
    distanceBetweenPoints,
    flipYAxis,
    linearInterpolation,
    isEqual,
    getLineIntersection,
};
