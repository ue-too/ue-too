import { vCamera } from "../vCamera";
import { Point } from "..";
import { PointCal } from "point2point";

export class vCanvas extends HTMLElement {
    
    private width: number;
    private height: number;
    private maxTransHalfHeight: number;
    private maxTransHalfWidth: number;

    static observedAttributes = ["width", "height", "full-screen", "style"];

    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    private _context: CanvasRenderingContext2D;

    private camera: vCamera;

    private scrollFactor: number = 0.1;
    private SCROLL_SENSITIVITY: number = 0.005;

    private isDragging: boolean = false;
    private dragStartPoint: Point;

    private touchPoints: Point[];
    private dragStartDist: number;

    private requestRef: number;
    private lastUpdateTime: number;

    private lastCameraUpdateEventEmitTime: number;

    constructor(){
        super();
        this.width = this._canvas.width;
        this.height = this._canvas.height;
        this.maxTransHalfHeight = 25000;
        this.maxTransHalfWidth = 25000;
        
        this.camera = new vCamera();
        this.camera.setHorizontalBoundaries(-this.maxTransHalfWidth, this.maxTransHalfWidth);
        this.camera.setVerticalBoundaries(-this.maxTransHalfHeight, this.maxTransHalfHeight);
        this.camera.setMaxZoomLevel(5);
        this.camera.setMinZoomLevel(0.01);
        //TODO Temporary Set Rotation

        this._context = this._canvas.getContext("2d");
        this.attachShadow({mode: "open"});
        this.bindFunctions();
        this.registerEventListeners();
        this.touchPoints = [];
    }

    bindFunctions(){
        this.step = this.step.bind(this);
    }

    connectedCallback(){
        this.shadowRoot.appendChild(this._canvas);
        this.lastCameraUpdateEventEmitTime = 0;
        this.lastUpdateTime = 0;
        this.requestRef = requestAnimationFrame(this.step);
    }

    disconnectedCallback(){
        cancelAnimationFrame(this.requestRef);
    }

    step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._canvas.width = this.width;
        this._canvas.height = this.height;

        this._context.translate( this.width / 2, this.height / 2 );
        this._context.scale(this.camera.getZoomLevel(), this.camera.getZoomLevel());
        this._context.rotate(this.camera.getRotation());
        this._context.translate(-this.camera.getPosition().x,  this.camera.getPosition().y);

        this.drawAxis(this._context, this.camera.getZoomLevel());

        this.camera.step(deltaTime);

        this.dispatchEvent(new CameraUpdateEvent('cameraupdate', {cameraAngle: this.camera.getRotation(), cameraPosition: this.camera.getPosition(), cameraZoomLevel: this.camera.getZoomLevel()}));

        // everthing should be above this reqestAnimationFrame should be the last call in step
        this.requestRef = window.requestAnimationFrame(this.step);
    }

    registerEventListeners(){
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler.bind(this));
        this._canvas.addEventListener('pointerup', this.pointerUpHandler.bind(this));
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler.bind(this));

        this._canvas.addEventListener('wheel', this.scrollHandler.bind(this));

        this._canvas.addEventListener('touchstart', this.touchstartHandler.bind(this));
        this._canvas.addEventListener('touchend', this.touchendHandler.bind(this));
        this._canvas.addEventListener('touchcancel', this.touchcancelHandler.bind(this));
        this._canvas.addEventListener('touchmove', this.touchmoveHandler.bind(this));
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        if (name == "width"){
            this.width = +newValue;
            this._canvas.width = this.width;
            this.camera.setViewPortWidth(this.width);
        }
        if (name == "height"){
            this.height = +newValue;
            this._canvas.height = this.height;
            this.camera.setViewPortHeight(this.height);
        }
        if (name == "full-screen"){
            if (newValue !== null && newValue !== "false"){
                this.width = window.innerWidth;
                this.height = window.innerHeight;
                this._canvas.width = window.innerWidth;
                this._canvas.height = window.innerHeight;
                this.camera.setViewPortWidth(window.innerWidth);
                this.camera.setViewPortHeight(window.innerHeight);
            }
        }
    }

    pointerDownHandler(e: PointerEvent){
        if(e.pointerType === "mouse" && e.button == 0 && e.metaKey){
            console.log("start dragging");
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    pointerUpHandler(e: PointerEvent){
        if(e.pointerType === "mouse"){
            if (e.button == 0) {
                if (this.isDragging){
                    console.log("end dragging");
                }
                this.isDragging = false;
            }
            this._canvas.style.cursor = "auto";
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if (e.pointerType == "mouse" && this.isDragging){
            this._canvas.style.cursor = "move";
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
            this.camera.moveWithClampInUI(diffInWorld);
            this.dragStartPoint = target;
        }
    }

    scrollHandler(e: WheelEvent){
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSITIVITY;

        if (!e.ctrlKey){
            //NOTE this is panning the camera
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
            this.camera.moveWithClampInUI(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            if (!this.isDragging){
                const cursorPosition = {x: e.clientX, y: e.clientY};
                let cursorWorldPositionPriorToZoom = this.convertWindowPoint2WorldCoord(cursorPosition);
                this.camera.setZoomLevelWithClampInUI(this.camera.getZoomLevel() - zoomAmount * 5);
                let cursorWorldPositionAfterZoom = this.convertWindowPoint2WorldCoord(cursorPosition);
                let diff = PointCal.subVector(cursorWorldPositionAfterZoom, cursorWorldPositionPriorToZoom);
                diff = PointCal.multiplyVectorByScalar(diff, -1);
                this.camera.moveWithClampInUI(diff);
            }
        }
    }

    touchstartHandler(e: TouchEvent){
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
        this.touchPoints = [];
    }

    touchendHandler(e: TouchEvent){
        this.touchPoints = [];
    }

    touchmoveHandler(e: TouchEvent){
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
                let midOriginalWorldPos = this.convertWindowPoint2WorldCoord(midPoint);
                let zoomAmount = distDiff * 0.1 * this.camera.getZoomLevel() * this.SCROLL_SENSITIVITY;
                this.camera.setZoomLevelWithClampInUI(this.camera.getZoomLevel() - zoomAmount);
                let midWorldPos = this.convertWindowPoint2WorldCoord(midPoint);
                let posDiff = PointCal.subVector(midOriginalWorldPos, midWorldPos);
                this.camera.moveWithClampInUI(posDiff);
                this.touchPoints = [startPoint, endPoint];
            } else {
                const diff = PointCal.subVector(this.touchPoints[0], startPoint);
                let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.camera.getRotation());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 0.5);
                this.camera.moveWithClampInUI(diffInWorld);
                this.touchPoints = [startPoint, endPoint];
            }
        }
    }

    getInternalCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    getCamera(): vCamera {
        return this.camera;
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }

    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
        return this.camera.convert2WorldSpace(pointInCameraViewPort);
    }

    drawAxis(context: CanvasRenderingContext2D, zoomLevel: number): void{
        context.lineWidth = 1 / zoomLevel;
        // y axis
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(0, -this.maxTransHalfHeight);
        context.stroke();
        
        // x axis
        context.beginPath();
        context.strokeStyle = `rgba(220, 59, 59, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(this.maxTransHalfWidth, 0);
        context.stroke();
    }

    resetCamera(){
        this.camera.resetCameraWithAnimation();
    }

    spinCameraWithAnimation(rotation: number){
        this.camera.spinWithAnimationInUI(rotation);
    }

    setCameraAngle(rotation: number){
        this.camera.spinInUI(rotation);
    }
}

export type CameraDetail = {
    cameraPosition: Point;
    cameraAngle: number;
    cameraZoomLevel: number;
}

export class CameraUpdateEvent extends Event{

    detail: CameraDetail;

    constructor(type: string, detail: CameraDetail, eventInit?: EventInit){
        super(type, eventInit);
        this.detail = detail;
    }
}