import { Point, PointCal } from "point2point";

export function drawArrow(context: CanvasRenderingContext2D, cameraZoomLevel: number, startPoint: Point, endPoint: Point, width: number = 1, arrowRatio: number = 0.3) {
    const length = PointCal.distanceBetweenPoints(startPoint, endPoint);
    const arrowHeight = 10 < length * cameraZoomLevel * 0.5 ? 10 / cameraZoomLevel : length * 0.5;
    const offsetLength = length - arrowHeight;
    const offsetPoint = PointCal.linearInterpolation(startPoint, endPoint, offsetLength / length);
    context.beginPath();
    context.lineWidth = width / cameraZoomLevel;
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(offsetPoint.x, offsetPoint.y);
    context.stroke();
    const unitVector = PointCal.rotatePoint(PointCal.unitVectorFromA2B(endPoint, startPoint), Math.PI / 2);
    const arrowPoint1 = PointCal.addVector(offsetPoint, PointCal.multiplyVectorByScalar(unitVector, arrowHeight*0.5));
    const arrowPoint2 = PointCal.subVector(offsetPoint, PointCal.multiplyVectorByScalar(unitVector, arrowHeight*0.5));
    context.beginPath();
    context.moveTo(endPoint.x, endPoint.y);
    context.lineTo(arrowPoint1.x, arrowPoint1.y);
    context.lineTo(arrowPoint2.x, arrowPoint2.y);
    context.closePath();
    context.fill();
}
