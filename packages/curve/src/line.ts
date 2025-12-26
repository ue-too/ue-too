import { PointCal, Point } from "@ue-too/math";

/**
 * Line segment class with geometric utilities.
 *
 * @remarks
 * Represents a straight line segment between two points with operations for:
 * - Line-line intersection
 * - Point projection onto line
 * - Point-in-line testing
 * - Linear interpolation (lerp)
 *
 * @example
 * ```typescript
 * const line = new Line({ x: 0, y: 0 }, { x: 100, y: 100 });
 *
 * // Get length
 * console.log('Length:', line.length());
 *
 * // Interpolate at midpoint
 * const mid = line.lerp(0.5); // { x: 50, y: 50 }
 *
 * // Project a point onto the line
 * const result = line.projectPoint({ x: 50, y: 0 });
 * if (result.within) {
 *   console.log('Projection:', result.projectionPoint);
 * }
 * ```
 *
 * @category Core
 */
export class Line {
    private startPoint: Point;
    private endPoint: Point;

    constructor(startPoint: Point, endPoint: Point){
        this.startPoint = startPoint;
        this.endPoint = endPoint;
    }

    getStartPoint(): Point{
        return this.startPoint;
    }

    getEndPoint(): Point{
        return this.endPoint;
    }

    intersectionWithAnotherLine(lineToIntersect: Line){
        return getLineIntersection(this.startPoint, this.endPoint, lineToIntersect.getStartPoint(), lineToIntersect.getEndPoint());
    }

    projectPoint(point: Point){
        return projectPointOntoLine(point, this.getStartPoint(), this.getEndPoint());
    }

    length(): number{
        return PointCal.distanceBetweenPoints(this.startPoint, this.endPoint);
    }
    
    getTranslationRotationToAlginXAxis(){
        const translation = PointCal.subVector({x: 0, y: 0}, this.startPoint);
        const rotationAngle = PointCal.angleFromA2B(PointCal.subVector(this.endPoint, this.startPoint), {x: 1, y: 0});

        return {translation, rotationAngle};
    }

    pointInLine(point: Point): boolean{
        const baseVector = PointCal.unitVectorFromA2B(this.startPoint, this.endPoint);
        const start2PointVector = PointCal.subVector(point, this.startPoint);
        const length = PointCal.dotProduct(start2PointVector, baseVector);
        const start2PointUnitVector = PointCal.unitVector(start2PointVector);
        const errorThreshold = PointCal.distanceBetweenPoints(this.startPoint, this.endPoint) * 0.0001;
        return length <= PointCal.distanceBetweenPoints(this.startPoint, this.endPoint) && length >= 0 && Math.abs(start2PointUnitVector.x - baseVector.x) < 0.0001 && Math.abs(start2PointUnitVector.y - baseVector.y) < 0.0001;
    }

    lerp(ratio: number): Point {
        return PointCal.linearInterpolation(this.startPoint, this.endPoint, ratio);
    }
}

export function getLineIntersection(startPoint: Point, endPoint: Point, startPoint2: Point, endPoint2: Point):{
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

export function projectPointOntoLine(point: Point, lineStartPoint: Point, lineEndPoint: Point): {
    within: boolean,
    projectionPoint?: Point,
    offset?: number
}{
    const baseVector = PointCal.unitVector(PointCal.subVector(lineEndPoint, lineStartPoint));
    const vectorToPoint = PointCal.subVector(point, lineStartPoint);
    const res = PointCal.dotProduct(vectorToPoint, baseVector);
    if (res < 0 || res > PointCal.magnitude(PointCal.subVector(lineEndPoint, lineStartPoint))){
        return {
            within: false,
        };
    }
    return {
        within: true,
        projectionPoint: PointCal.addVector(lineStartPoint, PointCal.multiplyVectorByScalar(baseVector, res)),
        offset: res / PointCal.magnitude(PointCal.subVector(lineEndPoint, lineStartPoint))
    };

}
