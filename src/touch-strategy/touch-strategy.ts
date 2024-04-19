import { PointCal } from "point2point";
import { Point } from "src";
import BoardCameraV1 from "src/board-camera/board-camera";
import { BoardCamera } from "src/board-camera/interface";
import { PanHandler } from "src/board-camera/pan";
import { ZoomHandler } from "src/board-camera/zoom";

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
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

export interface BoardTouchStrategyV2 {
    disabled: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}
export class TwoFingerPanZoom implements BoardTouchStrategy {

    private touchPoints: Point[];
    private canvas: HTMLCanvasElement;
    private dragStartDist: number;
    private camera: BoardCameraV1;
    private _disabled: boolean = false;
    private _limitEntireViewPort: boolean = true;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(canvas: HTMLCanvasElement, camera: BoardCameraV1, limitEntireViewPort: boolean = true, alignCoordinateSystem: boolean = true){
        this.canvas = canvas;
        this.camera = camera;
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this._limitEntireViewPort = limitEntireViewPort;
        this._alignCoordinateSystem = alignCoordinateSystem;
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

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(alignCoordinateSystem: boolean){
        this._alignCoordinateSystem = alignCoordinateSystem;
    }

    set panDisabled(panDisabled: boolean){
        this._panDisabled = panDisabled;
    }

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set zoomDisabled(zoomDisabled: boolean){
        this._zoomDisabled = zoomDisabled;
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set rotateDisabled(rotateDisabled: boolean){
        this._rotateDisabled = rotateDisabled;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
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
                if(this._zoomDisabled){return;}
                let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
                let distDiff = this.dragStartDist - touchPointDist;
                let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
                if(!this._alignCoordinateSystem){
                    midPoint = PointCal.flipYAxis(PointCal.subVector(midPoint, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom}));
                } else {
                    midPoint = PointCal.subVector(midPoint, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top});
                }
                let zoomAmount = distDiff * 0.1 * this.camera.getZoomLevel() * this.ZOOM_SENSATIVITY;
                if(this._limitEntireViewPort){
                    this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomAmount, midPoint);
                } else {
                    this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomAmount, midPoint);
                }
                this.touchPoints = [startPoint, endPoint];
            } else {
                if(this._panDisabled){return;}
                let diff = PointCal.subVector(this.touchPoints[0], startPoint);
                if(!this._alignCoordinateSystem){
                    diff.y = -diff.y;
                }
                let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
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

export class TwoFingerPanZoomLegacy implements BoardTouchStrategyLegacy {

    private touchPoints: Point[];
    private controlCamera: BoardCameraV1;
    private dragStartDist: number;

    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: BoardCameraV1){
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

export class OneFingerPanTwoFingerZoomLegacy implements BoardTouchStrategyLegacy {

    private touchPoints: Point[];
    private controlCamera: BoardCameraV1;
    private zoomStartDist: number;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(controlCamera: BoardCameraV1){
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

export class OneFingerPanTwoFingerZoom implements BoardTouchStrategy {

    private touchPoints: Point[];
    private controlCamera: BoardCameraV1;
    private canvas: HTMLCanvasElement;
    private _limitEntireViewPort: boolean;
    private _disabled: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;
    private zoomStartDist: number;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(canvas: HTMLCanvasElement, controlCamera: BoardCameraV1, limitEntireViewPort: boolean = true, alignCoordinateSystem: boolean = true){
        this.controlCamera = controlCamera;
        this.canvas = canvas;
        this._disabled = false;
        this.touchPoints = [];
        this.zoomStartDist = 0;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this._limitEntireViewPort = limitEntireViewPort;
        this._alignCoordinateSystem = alignCoordinateSystem;
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

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(alignCoordinateSystem: boolean){
        this._alignCoordinateSystem = alignCoordinateSystem;
    }

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set panDisabled(panDisabled: boolean){
        this._panDisabled = panDisabled;
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set zoomDisabled(zoomDisabled: boolean){
        this._zoomDisabled = zoomDisabled;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
    }

    set rotateDisabled(rotateDisabled: boolean){
        this._rotateDisabled = rotateDisabled;
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
            if(this._zoomDisabled){
                return;
            }
            let startPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let endPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
            let distDiff = this.zoomStartDist - touchPointDist;
            let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
            if(this._alignCoordinateSystem){
                midPoint = this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top}, midPoint);
            } else {
                midPoint = this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom}, midPoint);
            }
            let zoomAmount = distDiff * 0.1 * this.controlCamera.getZoomLevel() * this.ZOOM_SENSATIVITY;
            if(this._limitEntireViewPort){
                this.controlCamera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            } else {
                this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            }
            // this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            this.touchPoints = [startPoint, endPoint];
            this.tapPoint = null;
        } else if(e.targetTouches.length == 1 && this.isDragging && !this._panDisabled){
            let touchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let diff = PointCal.subVector(this.dragStartPoint, touchPoint);
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.controlCamera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.controlCamera.getZoomLevel());
            if(this._limitEntireViewPort){
                this.controlCamera.moveWithClampEntireViewPortFromGesture(diffInWorld);
            } else {
                this.controlCamera.moveWithClampFromGesture(diffInWorld);
            }
            // this.controlCamera.moveWithClampFromGesture(diffInWorld);
            this.dragStartPoint = touchPoint;
            this.tapPoint = null;
        }
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        if(this._alignCoordinateSystem) {
            return {x: res.x, y: res.y};
        } else {
            return {x: res.x, y: -res.y};
        }
    }
}

export class DefaultTouchStrategy implements BoardTouchStrategyV2 {

    private touchPoints: Point[];
    private controlCamera: BoardCamera;
    private canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;
    private zoomStartDist: number;

    private _panHandler: PanHandler;
    private _zoomHandler: ZoomHandler;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    constructor(canvas: HTMLCanvasElement, controlCamera: BoardCamera, panHandler: PanHandler, zoomHandler: ZoomHandler, alignCoordinateSystem: boolean = true){
        this.controlCamera = controlCamera;
        this.canvas = canvas;
        this._disabled = false;
        this.touchPoints = [];
        this.zoomStartDist = 0;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this._alignCoordinateSystem = alignCoordinateSystem;
        
        this._panHandler = panHandler;
        this._zoomHandler = zoomHandler;

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

    get disabled(): boolean {
        return this._disabled;
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(alignCoordinateSystem: boolean){
        this._alignCoordinateSystem = alignCoordinateSystem;
    }

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set panDisabled(panDisabled: boolean){
        this._panDisabled = panDisabled;
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set zoomDisabled(zoomDisabled: boolean){
        this._zoomDisabled = zoomDisabled;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
    }

    set rotateDisabled(rotateDisabled: boolean){
        this._rotateDisabled = rotateDisabled;
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
            this.tapPoint = this.controlCamera.convertFromViewPort2WorldSpace(this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top}, this.tapPoint));
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
            if(this._zoomDisabled){
                return;
            }
            let startPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let endPoint = {x: e.targetTouches[1].clientX, y: e.targetTouches[1].clientY};
            let touchPointDist = PointCal.distanceBetweenPoints(startPoint, endPoint);
            let distDiff = this.zoomStartDist - touchPointDist;
            let midPoint = PointCal.linearInterpolation(startPoint, endPoint, 0.5);
            if(this._alignCoordinateSystem){
                midPoint = this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top}, midPoint);
            } else {
                midPoint = this.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom}, midPoint);
            }
            let zoomAmount = distDiff * 0.1 * this.controlCamera.zoomLevel * this.ZOOM_SENSATIVITY;
            this._zoomHandler.zoomToAt(this.controlCamera.zoomLevel - zoomAmount, midPoint);
            // this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            this.touchPoints = [startPoint, endPoint];
            this.tapPoint = null;
        } else if(e.targetTouches.length == 1 && this.isDragging && !this._panDisabled){
            let touchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let diff = PointCal.subVector(this.dragStartPoint, touchPoint);
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.controlCamera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.controlCamera.zoomLevel);
            this._panHandler.panBy(diffInWorld);
            // this.controlCamera.moveWithClampFromGesture(diffInWorld);
            this.dragStartPoint = touchPoint;
            this.tapPoint = null;
        }
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        if(this._alignCoordinateSystem) {
            return {x: res.x, y: res.y};
        } else {
            return {x: res.x, y: -res.y};
        }
    }
}
