import { PointCal } from "point2point";
import { Point } from "src";
import { BoardCamera } from "src/board-camera/interface";
import { InputCallBackList, InputObserver } from "src/input-observer";
export interface BoardTouchStrategy {
    disabled: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    camera: BoardCamera;
    updateCamera(camera: BoardCamera): void;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

/**
 * @category Input Strategy
 */
export class DefaultTouchStrategy implements BoardTouchStrategy {

    private touchPoints: Point[];
    private controlCamera: BoardCamera;
    private canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;
    private zoomStartDist: number;

    private inputObserver: InputObserver;

    private isDragging: boolean = false;
    private dragStartPoint: Point;
    private tapPoint: Point;


    private ZOOM_SENSATIVITY: number = 0.005;

    private panInputCallBackList: InputCallBackList<"pan"> = [];
    private zoomInputCallBackList: InputCallBackList<"zoom"> = [];

    constructor(canvas: HTMLCanvasElement, controlCamera: BoardCamera, inputObserver: InputObserver,alignCoordinateSystem: boolean = true){
        this.controlCamera = controlCamera;
        this.canvas = canvas;
        this._disabled = false;
        this.touchPoints = [];
        this.zoomStartDist = 0;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this._alignCoordinateSystem = alignCoordinateSystem;

        this.inputObserver = inputObserver;

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

    get camera(): BoardCamera {
        return this.controlCamera;
    }

    set camera(camera: BoardCamera){
        this.controlCamera = camera;
    }

    updateCamera(camera: BoardCamera): void {
        this.controlCamera = camera;
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
            const boundingRect = this.canvas.getBoundingClientRect();
            const cameraCenterInWindow = {x: boundingRect.left + boundingRect.width / 2, y: boundingRect.top + boundingRect.height / 2};
            const tapPointInWindow = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            const tapPointInViewPort = PointCal.subVector(tapPointInWindow, cameraCenterInWindow); 
            this.tapPoint = this.controlCamera.convertFromViewPort2WorldSpace(tapPointInViewPort);
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
            const boundingRect = this.canvas.getBoundingClientRect();
            const midPointInWindow = {x: midPoint.x, y: midPoint.y};
            const cameraCenterInWindow = {x: boundingRect.left + boundingRect.width / 2, y: boundingRect.top + boundingRect.height / 2};
            const midPointInViewPort = PointCal.subVector(midPointInWindow, cameraCenterInWindow);
            if(!this._alignCoordinateSystem){
                midPointInViewPort.y = -midPointInViewPort.y;
            }
            let zoomAmount = distDiff * 0.1 * this.controlCamera.zoomLevel * this.ZOOM_SENSATIVITY;
            this.inputObserver.notifyOnZoom(this.controlCamera, -zoomAmount, midPointInViewPort);
            // this._zoomHandler.zoomCameraToAt(this.controlCamera, this.controlCamera.zoomLevel - zoomAmount, midPoint);
            // this.controlCamera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.controlCamera.getZoomLevel() - zoomAmount, midPoint);
            this.touchPoints = [startPoint, endPoint];
            this.tapPoint = null;
        } else if(e.targetTouches.length == 1 && this.isDragging && !this._panDisabled){
            let touchPoint = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            const diff = PointCal.subVector(this.dragStartPoint, touchPoint);
            if(!this._alignCoordinateSystem){
                diff.y = -diff.y;
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.controlCamera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.controlCamera.zoomLevel);
            this.inputObserver.notifyOnPan(this.controlCamera, diffInWorld);
            // this._panHandler.panCameraBy(this.camera, diffInWorld);
            this.dragStartPoint = touchPoint;
            this.tapPoint = null;
        }
    }
}
