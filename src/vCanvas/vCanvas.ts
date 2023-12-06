import { vCamera } from "../vCamera";
import { Point } from "..";
import { PointCal } from "point2point";

export class vCanvas extends HTMLElement {
    
    private canvasWidth: number;
    private canvasHeight: number;
    private fullScreenFlag: boolean = false;
    private maxTransHalfHeight: number;
    private maxTransHalfWidth: number;

    static observedAttributes = ["width", "height", "full-screen", "style", "tap-step", "restrict-x-translation", "restrict-y-translation", "restrict-translation", "restrict-rotation", "restrict-zoom"];

    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    private _context: CanvasRenderingContext2D;

    private camera: vCamera;
    
    private restrictXTranslationFromGesture: boolean = false;
    private restrictYTranslationFromGesture: boolean = false;
    private restrictRotationFromGesture: boolean = false;
    private restrictZoomFromGesture: boolean = false;

    private scrollFactor: number = 0.1;
    private SCROLL_SENSITIVITY: number = 0.005;

    private isDragging: boolean = false;
    private dragStartPoint: Point;

    private touchPoints: Point[];
    private dragStartDist: number;

    private requestRef: number;
    private handOverStepControl: boolean = false;
    private lastUpdateTime: number;

    private windowsResizeObserver: ResizeObserver;

    private UIComponentList: UIComponent[];

    constructor(){
        super();
        this.canvasWidth = this._canvas.width;
        this.canvasHeight = this._canvas.height;
        this.maxTransHalfHeight = 25000;
        this.maxTransHalfWidth = 25000;
        this.style.display = "inline-block";
        
        this.camera = new vCamera();
        this.camera.setHorizontalBoundaries(-this.maxTransHalfWidth, this.maxTransHalfWidth);
        this.camera.setVerticalBoundaries(-this.maxTransHalfHeight, this.maxTransHalfHeight);
        this.camera.setMaxZoomLevel(5);
        this.camera.setMinZoomLevel(0.01);
        this.camera.setViewPortWidth(this.canvasWidth);
        this.camera.setViewPortHeight(this.canvasHeight);

        this._context = this._canvas.getContext("2d");
        this.attachShadow({mode: "open"});
        this.bindFunctions();
        this.touchPoints = [];

        this.UIComponentList = [];

        this.windowsResizeObserver = new ResizeObserver(this.windowResizeHandler.bind(this));
    }

    bindFunctions(){
        this.step = this.step.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    connectedCallback(){
        this.shadowRoot.appendChild(this._canvas);
        this.registerEventListeners();
        this.lastUpdateTime = 0;
        this.windowsResizeObserver.observe(document.body);
        if(!this.handOverStepControl){
            this.requestRef = requestAnimationFrame(this.step);
        }
    }

    disconnectedCallback(){
        if(!this.handOverStepControl){
            cancelAnimationFrame(this.requestRef);
        }
        this.windowsResizeObserver.unobserve(document.body);
        this.removeEventListeners();
    }

    private step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._canvas.width = this.canvasWidth;
        this._canvas.height = this.canvasHeight;

        this._context.translate( this.canvasWidth / 2, this.canvasHeight / 2 );
        this._context.scale(this.camera.getZoomLevel(), this.camera.getZoomLevel());
        this._context.rotate(this.camera.getRotation());
        this._context.translate(-this.camera.getPosition().x,  this.camera.getPosition().y);

        this.drawReferenceCircle(this._context, {x: 30, y: 20});

        this.drawAxis(this._context, this.camera.getZoomLevel());

        this.camera.step(deltaTime);

        this.dispatchEvent(new CameraUpdateEvent('cameraupdate', {cameraAngle: this.camera.getRotation(), cameraPosition: this.camera.getPosition(), cameraZoomLevel: this.camera.getZoomLevel()}));

        this.UIComponentList.forEach((uiComponent)=>{
            uiComponent.draw(this._context, this.camera.getZoomLevel());
        });

        // everthing should be above this reqestAnimationFrame should be the last call in step
        if(!this.handOverStepControl){
            this.requestRef = window.requestAnimationFrame(this.step);
        }
    }

    registerEventListeners(){
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this._canvas.addEventListener('pointerup', this.pointerUpHandler);
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler);

        this._canvas.addEventListener('wheel', this.scrollHandler);

        this._canvas.addEventListener('touchstart', this.touchstartHandler);
        this._canvas.addEventListener('touchend', this.touchendHandler);
        this._canvas.addEventListener('touchcancel', this.touchcancelHandler);
        this._canvas.addEventListener('touchmove', this.touchmoveHandler);
    }

    removeEventListeners(){
        this._canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this._canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this._canvas.removeEventListener('pointermove', this.pointerMoveHandler);

        this._canvas.removeEventListener('wheel', this.scrollHandler);

        this._canvas.removeEventListener('touchstart', this.touchstartHandler);
        this._canvas.removeEventListener('touchend', this.touchendHandler);
        this._canvas.removeEventListener('touchcancel', this.touchcancelHandler);
        this._canvas.removeEventListener('touchmove', this.touchmoveHandler);

    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        if (name == "width"){
            this.canvasWidth = +newValue;
            this._canvas.width = this.canvasWidth;
            this.camera.setViewPortWidth(this.canvasWidth);
        }
        if (name == "height"){
            this.canvasHeight = +newValue;
            this._canvas.height = this.canvasHeight;
            this.camera.setViewPortHeight(this.canvasHeight);
        }
        if (name == "full-screen"){
            if (newValue !== null && newValue !== "false"){
                this.fullScreenFlag = true;
                this.canvasWidth = window.innerWidth;
                this.canvasHeight = window.innerHeight;
                this._canvas.width = window.innerWidth;
                this._canvas.height = window.innerHeight;
                this.camera.setViewPortWidth(window.innerWidth);
                this.camera.setViewPortHeight(window.innerHeight);
            } else {
                this.fullScreenFlag = false;
            }
        }
        if (name == "tap-step"){
            if (newValue !== null && newValue !== "false"){
                this.handOverStepControl = true;
            } else {
                this.handOverStepControl = false;
            }
        }
        if(name == "restrict-x-translation"){
            if (newValue !== null && newValue !== "false"){
                this.restrictXTranslationFromGesture = true;
                this.camera.lockXTranslationFromGesture();
            } else {
                this.restrictXTranslationFromGesture = false;
                this.camera.releaseLockOnXTranslationFromGesture();
            }
        }
        if(name == "restrict-y-translation"){
            if (newValue !== null && newValue !== "false"){
                this.restrictYTranslationFromGesture = true;
                this.camera.lockYTranslationFromGesture();
            } else {
                this.restrictYTranslationFromGesture = false;
                this.camera.releaseLockOnYTranslationFromGesture();
            }
        }
        if(name == "restrict-translation"){
            if (newValue !== null && newValue !== "false"){
                this.restrictYTranslationFromGesture = true;
                this.camera.lockYTranslationFromGesture();
                this.restrictXTranslationFromGesture = true;
                this.camera.lockXTranslationFromGesture();
            } else {
                this.restrictYTranslationFromGesture = false;
                this.camera.releaseLockOnYTranslationFromGesture();
                this.restrictXTranslationFromGesture = false;
                this.camera.releaseLockOnXTranslationFromGesture();
            }
        }
        if(name == "restrict-rotation"){
            console.log("test");
            if (newValue !== null && newValue !== "false"){
                this.restrictRotationFromGesture = true;
                this.camera.lockRotationFromGesture();
            } else {
                this.restrictRotationFromGesture = false;
                this.camera.releaseLockOnRotationFromGesture();
            }
        }
        if(name == "restrict-zoom"){
            if (newValue !== null && newValue !== "false"){
                this.restrictZoomFromGesture = true;
                this.camera.lockZoomFromGesture();
            } else {
                this.restrictZoomFromGesture = false;
                this.camera.releaseLockOnZoomFromGesture();
            }
        }

    }

    pointerDownHandler(e: PointerEvent){
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey)){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    pointerUpHandler(e: PointerEvent){
        if(e.pointerType === "mouse"){
            if (this.isDragging) {
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
            this.camera.moveWithClampFromGesture(diffInWorld);
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
            this.camera.moveWithClampFromGesture(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            if (!this.isDragging){
                const cursorPosition = {x: e.clientX, y: e.clientY};
                let cursorWorldPositionPriorToZoom = this.convertWindowPoint2WorldCoord(cursorPosition);
                this.camera.setZoomLevelWithClampFromGesture(this.camera.getZoomLevel() - zoomAmount * 5);
                let cursorWorldPositionAfterZoom = this.convertWindowPoint2WorldCoord(cursorPosition);
                let diff = PointCal.subVector(cursorWorldPositionAfterZoom, cursorWorldPositionPriorToZoom);
                diff = PointCal.multiplyVectorByScalar(diff, -1);
                this.camera.moveWithClampFromGesture(diff);
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
                this.camera.setZoomLevelWithClampFromGesture(this.camera.getZoomLevel() - zoomAmount);
                let midWorldPos = this.convertWindowPoint2WorldCoord(midPoint);
                let posDiff = PointCal.subVector(midOriginalWorldPos, midWorldPos);
                this.camera.moveWithClampFromGesture(posDiff);
                this.touchPoints = [startPoint, endPoint];
            } else {
                const diff = PointCal.subVector(this.touchPoints[0], startPoint);
                let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.camera.getRotation());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
                diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 0.5);
                this.camera.moveWithClampFromGesture(diffInWorld);
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

    windowResizeHandler(){
        if(this.fullScreenFlag){
            this.canvasWidth = window.innerWidth;
            this.canvasHeight = window.innerHeight;
            this._canvas.width = this.canvasWidth;
            this._canvas.height = this.canvasHeight;
            this.camera.setViewPortWidth(window.innerWidth);
            this.camera.setViewPortHeight(window.innerHeight);
        }
    }

    drawAxis(context: CanvasRenderingContext2D, zoomLevel: number): void{
        // context.lineWidth = 1 / zoomLevel;
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

    drawReferenceCircle(context: CanvasRenderingContext2D, pos: Point): void {
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        // context.moveTo(pos.x, -pos.y);
        context.arc(pos.x, -pos.y, 5, 0, 2 * Math.PI);
        context.stroke();
    }

    resetCamera(){
        this.camera.resetCameraWithAnimation();
    }

    spinCameraWithAnimation(rotation: number){
        this.camera.spinWithAnimationFromGesture(rotation);
    }

    setCameraAngle(rotation: number){
        this.camera.spinFromGesture(rotation);
    }

    getStepFunction(): (timestamp: number)=>void{
        if (this.handOverStepControl){
            return this.step.bind(this);
        } else {
            return null;
        }
    }

    getContext(): CanvasRenderingContext2D{
        return this._context;
    }

    insertUIComponent(component: UIComponent){
        this.UIComponentList.push(component);
    }
}

export interface UIComponent{
    draw(context: CanvasRenderingContext2D, zoomLevel: number): void;
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