import { Point } from "point2point";

export function drawBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string = "black"){
    context.strokeStyle = color;
    context.beginPath();
    context.rect(x, y, width, height);
    context.stroke();
}

export function drawText(context: CanvasRenderingContext2D, text: string, position: Point, color: string = "black"){
    context.fillStyle = color;
    context.font = "30px Arial";
    context.fillText(text, position.x, position.y);
}

export function drawArrow(context: CanvasRenderingContext2D, from: Point, to: Point, color: string = "black"){
    const originalColor = context.strokeStyle;
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();

    let angle = Math.atan2(to.y - from.y, to.x - from.x);
    let arrowLength = 10;
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(to.x - arrowLength * Math.cos(angle - Math.PI/6), to.y - arrowLength * Math.sin(angle - Math.PI/6));
    context.moveTo(to.x, to.y);
    context.lineTo(to.x - arrowLength * Math.cos(angle + Math.PI/6), to.y - arrowLength * Math.sin(angle + Math.PI/6));
    context.stroke();
    context.strokeStyle = originalColor;
}

export function drawLine(context: CanvasRenderingContext2D, from: Point, to: Point, color: string = "black"){
    const originalColor = context.strokeStyle;
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.strokeStyle = originalColor;
}

export function drawCircle(context: CanvasRenderingContext2D, center: Point, radius: number, percentage: number = 1, color: string = "black"){
    const originalColor = context.strokeStyle;
    context.strokeStyle = color;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, 2 * Math.PI * percentage);
    context.stroke();
    context.strokeStyle = originalColor;
}