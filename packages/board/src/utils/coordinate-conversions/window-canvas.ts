import { Point, PointCal } from "@ue-too/math";
import { Canvas } from "../../input-interpretation/input-state-machine/kmt-input-context";

/**
 * converts a point in window (of browser) to a point in the canvas (canvas or svg element). the converted point is in the canvas space where the top left corner is the origin and the coordinate system is the same as the canvas (browser)
 * @param pointInWindow The point in window coordinates to convert
 * @param canvas The canvas element
 * @returns The converted point in canvas coordinates
 */
export function convertFromWindow2Canvas(pointInWindow: Point, canvas: Canvas): Point {
    return PointCal.subVector(pointInWindow, canvas.position);
}

/**
 * converts a point in the canvas space to a point in window coordinates.
 * 
 * @param pointInCanvas The point in the canvas space to convert
 * @param canvas The canvas element
 * @returns The converted point in window coordinates
 */
export function convertFromCanvas2Window(pointInCanvas: Point, canvas: Canvas): Point {
    return PointCal.addVector(pointInCanvas, canvas.position);
}

