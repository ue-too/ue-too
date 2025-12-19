import { Point, PointCal } from "@ue-too/math";

/**
 * converts a point in the canvas space to a point in the viewport space. canvas and viewport may not have the same coordinate system, i.e. the viewport may have a flipped y axis and the origin of the viewport may not be at the top left corner of the
 * @param pointInCanvas The point in the canvas space to convert
 * @param canvas The canvas element
 * @param viewportHasFlippedYAxis Whether the viewport has a flipped y axis (default is false, meaning the viewport has the same coordinate system as the canvas)
 * @param viewportOriginInCanvasSpace The origin of the viewport in the canvas space (default is {0, 0} the top left corner of the canvas) 
 */
export function convertFromCanvas2ViewPort(pointInCanvas: Point, viewportOriginInCanvasSpace: Point = {x: 0, y: 0}, viewportHasFlippedYAxis: boolean = false): Point {
    const res = PointCal.subVector(pointInCanvas, viewportOriginInCanvasSpace);
    if(viewportHasFlippedYAxis){
        res.y = -res.y;
    }
    return res;
}

/**
 * converts a point in the viewport space to a point in the canvas space.
 * @param pointInViewPort The point in the viewport space to convert
 * @param viewportHasFlippedYAxis Whether the viewport has a flipped y axis (default is false, meaning the viewport has the same coordinate system as the canvas)
 * @param viewportOriginInCanvasSpace The origin of the viewport in the canvas space (default is {0, 0} the top left corner of the canvas)
 * @returns The converted point in canvas coordinates
 */
export function convertFromViewPort2Canvas(pointInViewPort: Point, viewportOriginInCanvasSpace: Point = {x: 0, y: 0},viewportHasFlippedYAxis: boolean = false): Point {
    if(viewportHasFlippedYAxis){
        pointInViewPort.y = -pointInViewPort.y;
    }
    return PointCal.addVector(pointInViewPort, viewportOriginInCanvasSpace);
}
