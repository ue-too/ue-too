import vCamera from "../vCamera";
import { PointCal } from "point2point";
import { InteractiveUIComponent, Point } from "..";

export interface CanvasTouchStrategy {
    touchstartHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchendHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchcancelHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchmoveHandler(e: TouchEvent, bottomLeftCorner: Point): void;
}

export class TwoFingerPanZoom implements CanvasTouchStrategy {

    private touchPoints: Point[];
    private controlCamera: vCamera;
    private dragStartDist: number;

    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: vCamera){
        this.controlCamera = controlCamera;
    }

    touchstartHandler(e: TouchEvent, bottomLeftCorner: Point){
        e.preventDefault();
        if(e.targetTouches.length === 2){
            let firstTouchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let secondTouchPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            this.dragStartDist = PointCal.distanceBetweenPoints(firstTouchPoint, secondTouchPoint);
            this.touchPoints = [firstTouchPoint, secondTouchPoint];
        } else if (e.targetTouches.length === 1){
        }
    }

    touchcancelHandler(e: TouchEvent, bottomLeftCorner: Point){
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent, bottomLeftCorner: Point){
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent, bottomLeftCorner: Point){
        e.preventDefault();
        if(e.targetTouches.length == 2 && this.touchPoints.length == 2){
            //NOTE Touch Zooming
            let startPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let endPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            let deltaStartPoint = PointCal.subVector(startPoint, this.touchPoints[0]);
            let deltaEndPoint = PointCal.subVector(endPoint, this.touchPoints[1]);
            let angleDiff = PointCal.angleFromA2B(deltaStartPoint, deltaEndPoint);
            let panZoom = Math.abs(angleDiff) > 20 * Math.PI / 180 ? "ZOOMING" : "PANNING";
            if(panZoom == "ZOOMING"){
                let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
                let distDiff = this.dragStartDist - touchPointDist;
                let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
                midPoint = this.convertWindowPoint2ViewPortPoint(bottomLeftCorner, midPoint);
                let zoomAmount = distDiff * 0.1 * this.controlCamera.getZoomLevel() * this.ZOOM_SENSATIVITY;
                this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
                this.touchPoints = [startPoint, endPoint];
            } else {
                const diff = PointCal.subVector(this.touchPoints[0], startPoint);
                let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.controlCamera.getRotation());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.controlCamera.getZoomLevel());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 0.5);
                this.controlCamera.moveWithClampFromGesture(diffInWorld);
                this.touchPoints = [startPoint, endPoint];
            }
        }
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }
}

export class OneFingerPanTwoFingerZoom implements CanvasTouchStrategy {

    private touchPoints: Point[];
    private controlCamera: vCamera;
    private zoomStartDist: number;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: vCamera){
        this.controlCamera = controlCamera;
    }

    touchstartHandler(e: TouchEvent, bottomLeftCorner: Point){
        e.preventDefault();
        if(e.targetTouches.length === 2){
            this.isDragging = false;
            let firstTouchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let secondTouchPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            this.zoomStartDist = PointCal.distanceBetweenPoints(firstTouchPoint, secondTouchPoint);
            this.touchPoints = [firstTouchPoint, secondTouchPoint];
        } else if (e.targetTouches.length === 1){
            this.tapPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            this.tapPoint = this.controlCamera.convert2WorldSpace(this.convertWindowPoint2ViewPortPoint(bottomLeftCorner, this.tapPoint));
            this.isDragging = true;
            this.dragStartPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
        }
    }

    touchcancelHandler(e: TouchEvent, bottomLeftCorner: Point){
        this.isDragging = false;
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent, bottomLeftCorner: Point){
        this.isDragging = false;
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent, bottomLeftCorner: Point){
        e.preventDefault();
        if(e.targetTouches.length == 2 && this.touchPoints.length == 2){
            //NOTE Touch Zooming
            let startPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let endPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
            let distDiff = this.zoomStartDist - touchPointDist;
            let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
            midPoint = this.convertWindowPoint2ViewPortPoint(bottomLeftCorner, midPoint);
            let zoomAmount = distDiff * 0.1 * this.controlCamera.getZoomLevel() * this.ZOOM_SENSATIVITY;
            this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            this.touchPoints = [startPoint, endPoint];
            this.tapPoint = null;
        } else if(e.targetTouches.length == 1 && this.isDragging){
            let touchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            const diff = PointCal.subVector(this.dragStartPoint, touchPoint);
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.controlCamera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.controlCamera.getZoomLevel());
            this.controlCamera.moveWithClampFromGesture(diffInWorld);
            this.dragStartPoint = touchPoint;
            this.tapPoint = null;
        }
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }
}