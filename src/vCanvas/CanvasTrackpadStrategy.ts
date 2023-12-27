import { vCamera } from "../vCamera";
import { PointCal } from "point2point";
import { InteractiveUIComponent, Point } from "..";

export interface CanvasTrackpadStrategy {
    scrollHandler(e: WheelEvent, controlCamera: vCamera, coordinateConversionFn: (interestPoint: Point) => Point): void;
}


export class TwoFingerPanPinchZoom implements CanvasTrackpadStrategy {

    private SCROLL_SENSATIVITY: number;

    constructor(){
        this.SCROLL_SENSATIVITY = 0.005;
    }


    scrollHandler(e: WheelEvent, controlCamera: vCamera, coordinateConversionFn: (interestPoint: Point) => Point){
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;

        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), controlCamera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / controlCamera.getZoomLevel());
            controlCamera.moveWithClampFromGesture(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            const cursorPosition = {x: e.clientX, y: e.clientY};
            controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(controlCamera.getZoomLevel() - ((zoomAmount * 5) * controlCamera.getZoomLevel()), coordinateConversionFn(cursorPosition));
        }
    }
}

export class TwoFingerPanPinchZoomLimitEntireView implements CanvasTrackpadStrategy {

    private SCROLL_SENSATIVITY: number;

    constructor(){
        this.SCROLL_SENSATIVITY = 0.005;
    }


    scrollHandler(e: WheelEvent, controlCamera: vCamera, coordinateConversionFn: (interestPoint: Point) => Point){
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;

        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), controlCamera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / controlCamera.getZoomLevel());
            controlCamera.moveWithClampEntireViewPortFromGesture(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            const cursorPosition = {x: e.clientX, y: e.clientY};
            controlCamera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(controlCamera.getZoomLevel() - (controlCamera.getZoomLevel() * zoomAmount * 5), coordinateConversionFn(cursorPosition));
        }
    }
}