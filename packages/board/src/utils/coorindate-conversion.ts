import { Point, PointCal } from "@ue-too/math";
import { Canvas } from "src/input-interpretation/input-state-machine/kmt-input-context";
import { convertFromWindow2Canvas } from "./coordinate-conversions/window-canvas";
import { convertFromCanvas2ViewPort } from "./coordinate-conversions/canvas-viewport";

// isometric point to flat world point
export function pointConversion(point: Point) {
    const cos30 = Math.cos(Math.PI / 6);
    const cos60 = Math.cos(Math.PI / 3);

    return {
        x: point.x * cos30 - point.y * cos30,
        y: point.x * cos60 + point.y * cos60 + (point.z ?? 0)
    }
}

/**
 * @description Converts the point from window coordinates(browser) to view port coordinates.
 * 
 * @category Input State Machine
 */
export function convertFromWindow2ViewPortWithCanvasOperator(point: Point, canvas: Canvas): Point {
    const pointInCanvas = convertFromWindow2Canvas(point, canvas);
    return convertFromCanvas2ViewPort(pointInCanvas, {x: canvas.width / 2, y: canvas.height / 2}, false);
}