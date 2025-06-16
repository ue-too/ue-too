import { PointCal } from "point2point";
import { Point } from "../../src";

export function drawVectorTip(context: CanvasRenderingContext2D, vectorStartPoint: Point, vectorEndPoint: Point, cameraZoomLevel: number, color: string = "black"){
    const originalColor = context.fillStyle;
    context.beginPath();
    context.moveTo(vectorEndPoint.x, vectorEndPoint.y);
    const unitvector = PointCal.unitVector(PointCal.subVector(vectorStartPoint, vectorEndPoint));
    const tip1 = PointCal.addVector(vectorEndPoint, PointCal.rotatePoint(PointCal.multiplyVectorByScalar(unitvector, 8 / cameraZoomLevel), Math.PI/6));
    const tip2 = PointCal.addVector(vectorEndPoint, PointCal.rotatePoint(PointCal.multiplyVectorByScalar(unitvector, 8 / cameraZoomLevel), -Math.PI/6));
    context.lineTo(tip1.x, tip1.y);
    context.lineTo(tip2.x, tip2.y);
    context.fillStyle = color;
    context.fill();
    context.fillStyle = originalColor;
}

export function drawArrow(context: CanvasRenderingContext2D, from: Point, to: Point, cameraZoomLevel: number, color: string = "black"){
    if(PointCal.magnitude(PointCal.subVector(to, from)) < 0.1){
        return;
    }
    const originalColor = context.strokeStyle;
    context.lineWidth = 1 / cameraZoomLevel;
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    drawVectorTip(context, from, to, cameraZoomLevel, color);
    context.strokeStyle = originalColor;
}

export function drawXAxis(context: CanvasRenderingContext2D, cameraZoomLevel: number, color: string="red"){
    const originalColor = context.strokeStyle;
    context.strokeStyle = color;
    context.beginPath();
    context.lineWidth = 1 / cameraZoomLevel;
    context.moveTo(0, 0);
    context.lineTo(5000, 0);
    context.stroke();
    context.strokeStyle = originalColor;
}

export function drawYAxis(context: CanvasRenderingContext2D, cameraZoomLevel: number, color: string="green"){
    const originalColor = context.strokeStyle;
    context.strokeStyle = color;
    context.beginPath();
    context.lineWidth = 1 / cameraZoomLevel;
    context.moveTo(0, 0);
    context.lineTo(0, 5000);
    context.stroke();
    context.strokeStyle = originalColor;
}
