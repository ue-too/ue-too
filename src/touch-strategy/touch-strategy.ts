import BoardCamera from "../board-camera/board-camera";
import Board from "../boardify/board";
import BoardElement from "../board-element/board-element";
import { PointCal } from "point2point";
import { Point } from "..";

export interface BoardTouchStrategyLegacy {
    touchstartHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchendHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchcancelHandler(e: TouchEvent, bottomLeftCorner: Point): void;
    touchmoveHandler(e: TouchEvent, bottomLeftCorner: Point): void;
}


/**
 * @category Touch Strategy
 */
export interface BoardTouchStrategy {
    disabled: boolean;
    limitEntireViewPort: boolean;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

export class TwoFingerPanZoom implements BoardTouchStrategy {

    private touchPoints: Point[];
    private canvas: HTMLCanvasElement;
    private dragStartDist: number;
    private camera: BoardCamera;
    private _disabled: boolean = false;
    private _limitEntireViewPort: boolean = true;

    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(canvas: HTMLCanvasElement, camera: BoardCamera, limitEntireViewPort: boolean = true){
        this.canvas = canvas;
        this.camera = camera;
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this._limitEntireViewPort = limitEntireViewPort;
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(limitEntireViewPort: boolean){
        this._limitEntireViewPort = limitEntireViewPort;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    disableStrategy(): void {
        this.dragStartDist = 0;
        this.touchPoints = [];
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    setUp(): void {
        this.canvas.addEventListener('touchstart', this.touchstartHandler);
        this.canvas.addEventListener('touchend', this.touchendHandler);
        this.canvas.addEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.addEventListener('touchmove', this.touchmoveHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('touchstart', this.touchstartHandler);
        this.canvas.removeEventListener('touchend', this.touchendHandler);
        this.canvas.removeEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.removeEventListener('touchmove', this.touchmoveHandler);
    }

    touchstartHandler(e: TouchEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.targetTouches.length === 2){
            let firstTouchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let secondTouchPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            this.dragStartDist = PointCal.distanceBetweenPoints(firstTouchPoint, secondTouchPoint);
            this.touchPoints = [firstTouchPoint, secondTouchPoint];
        } else if (e.targetTouches.length === 1){
        }
    }

    touchcancelHandler(e: TouchEvent){
        if(this._disabled) return;
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) return;
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent){
        if(this._disabled) return;
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
                midPoint = PointCal.flipYAxis(PointCal.subVector(midPoint, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom}));
                let zoomAmount = distDiff * 0.1 * this.camera.getZoomLevel() * this.ZOOM_SENSATIVITY;
                if(this._limitEntireViewPort){
                    this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomAmount, midPoint);
                } else {
                    this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomAmount, midPoint);
                }
                this.touchPoints = [startPoint, endPoint];
            } else {
                const diff = PointCal.subVector(this.touchPoints[0], startPoint);
                let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.camera.getRotation());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 0.5);
                if(this._limitEntireViewPort){
                    this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
                } else {
                    this.camera.moveWithClampFromGesture(diffInWorld);
                }
                this.touchPoints = [startPoint, endPoint];
            }
        }
    }

}

export class TwoFingerPanZoomForBoardElement implements BoardTouchStrategy {

    private touchPoints: Point[];
    private canvas: BoardElement;
    private dragStartDist: number;
    private camera: BoardCamera;
    private _limitEntireViewPort: boolean = true;

    private ZOOM_SENSATIVITY: number = 0.005;

    private _disabled: boolean = false;

    constructor(canvas: BoardElement, camera: BoardCamera){
        this.canvas = canvas;
        this.camera = camera;
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
        this.touchstartHandler = this.touchstartHandler.bind(this);
    }

    set limitEntireViewPort(limitEntireViewPort: boolean){
        this._limitEntireViewPort = limitEntireViewPort;
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    disableStrategy(): void {
        this.dragStartDist = 0;
        this.touchPoints = [];
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    setUp(): void {
        this.canvas.addEventListener('touchstart', this.touchstartHandler);
        this.canvas.addEventListener('touchend', this.touchendHandler);
        this.canvas.addEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.addEventListener('touchmove', this.touchmoveHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('touchstart', this.touchstartHandler);
        this.canvas.removeEventListener('touchend', this.touchendHandler);
        this.canvas.removeEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.removeEventListener('touchmove', this.touchmoveHandler);
    }

    touchstartHandler(e: TouchEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.targetTouches.length === 2){
            let firstTouchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let secondTouchPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            this.dragStartDist = PointCal.distanceBetweenPoints(firstTouchPoint, secondTouchPoint);
            this.touchPoints = [firstTouchPoint, secondTouchPoint];
        } else if (e.targetTouches.length === 1){
        }
    }

    touchcancelHandler(e: TouchEvent){
        if(this._disabled) return;
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) return;
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent){
        if(this._disabled) return;
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
                midPoint = this.canvas.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom}, midPoint);
                let zoomAmount = distDiff * 0.1 * this.canvas.getCamera().getZoomLevel() * this.ZOOM_SENSATIVITY;
                if(this._limitEntireViewPort){
                    this.camera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(zoomAmount, midPoint);
                } else {
                    this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomAmount, midPoint);
                }
                this.touchPoints = [startPoint, endPoint];
            } else {
                const diff = PointCal.subVector(this.touchPoints[0], startPoint);
                let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.canvas.getCamera().getRotation());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 0.5);
                if(this._limitEntireViewPort){
                    this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
                } else {
                    this.camera.moveWithClampFromGesture(diffInWorld);
                }
                this.touchPoints = [startPoint, endPoint];
            }
        }
    }
}
export class TwoFingerPanZoomLegacy implements BoardTouchStrategyLegacy {

    private touchPoints: Point[];
    private controlCamera: BoardCamera;
    private dragStartDist: number;

    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: BoardCamera){
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

export class OneFingerPanTwoFingerZoom implements BoardTouchStrategyLegacy {

    private touchPoints: Point[];
    private controlCamera: BoardCamera;
    private zoomStartDist: number;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: BoardCamera){
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

export class OneFingerPanTwoFingerZoomForBoard implements BoardTouchStrategy {

    private touchPoints: Point[];
    private controlCamera: BoardCamera;
    private canvas: HTMLCanvasElement;
    private _limitEntireViewPort: boolean;
    private _disabled: boolean;
    private zoomStartDist: number;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: BoardCamera, canvas: HTMLCanvasElement){
        this.controlCamera = controlCamera;
        this.canvas = canvas;
        this._disabled = false;
        this.touchPoints = [];
        this.zoomStartDist = 0;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this._limitEntireViewPort = true;
        this.bindListeners();
    }

    bindListeners(): void{
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
    }

    resetAttributes(): void{
        this.touchPoints = [];
        this.zoomStartDist = 0;
        this.isDragging = false;
        this.dragStartPoint = null;
        this.tapPoint = null;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    disableStrategy(): void {
        this.resetAttributes();
        this._disabled = true;
    }

    setUp(): void {
        this.canvas.addEventListener('touchstart', this.touchstartHandler);
        this.canvas.addEventListener('touchend', this.touchendHandler);
        this.canvas.addEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.addEventListener('touchmove', this.touchmoveHandler);
    }

    tearDown(): void {
        this.resetAttributes();
        this.canvas.removeEventListener('touchstart', this.touchstartHandler);
        this.canvas.removeEventListener('touchend', this.touchendHandler);
        this.canvas.removeEventListener('touchcancel', this.touchcancelHandler);
        this.canvas.removeEventListener('touchmove', this.touchmoveHandler);
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }
    
    set limitEntireViewPort(limitEntireViewPort: boolean){
        this._limitEntireViewPort = limitEntireViewPort;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    touchstartHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        e.preventDefault();
        if(e.targetTouches.length === 2){
            this.isDragging = false;
            let firstTouchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let secondTouchPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            this.zoomStartDist = PointCal.distanceBetweenPoints(firstTouchPoint, secondTouchPoint);
            this.touchPoints = [firstTouchPoint, secondTouchPoint];
        } else if (e.targetTouches.length === 1){
            this.tapPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            this.tapPoint = this.controlCamera.convert2WorldSpace(this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top}, this.tapPoint));
            this.isDragging = true;
            this.dragStartPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
        }
    }

    touchcancelHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        this.isDragging = false;
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        this.isDragging = false;
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        e.preventDefault();
        if(e.targetTouches.length == 2 && this.touchPoints.length == 2){
            //NOTE Touch Zooming
            let startPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let endPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
            let distDiff = this.zoomStartDist - touchPointDist;
            let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
            midPoint = this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top}, midPoint);
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
