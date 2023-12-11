import { vCamera, CameraLockableObject } from "../vCamera";
import { Point, UIComponent, InteractiveUIComponent } from "..";
import { PointCal } from "point2point";
import {CanvasTouchStrategy, TwoFingerPanZoom, OneFingerPanTwoFingerZoom} from "./CanvasTouchStrategy";
import { CanvasTrackpadStrategy, TwoFingerPanPinchZoom } from "./CanvasTrackpadStrategy";

export class vCanvas extends HTMLElement {
    
    private canvasWidth: number;
    private canvasHeight: number;
    private fullScreenFlag: boolean = false;
    private maxTransHalfHeight: number;
    private maxTransHalfWidth: number;

    static observedAttributes = ["width", "height", "full-screen", "style", "tap-step", "restrict-x-translation", "restrict-y-translation", "restrict-translation", "restrict-rotation", "restrict-zoom", "restrict-relative-x-translation", "restrict-relative-y-translation"];

    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    private _context: CanvasRenderingContext2D;

    private camera: vCamera;
    
    private restrictXTranslationFromGesture: boolean = false;
    private restrictYTranslationFromGesture: boolean = false;
    private restrictRotationFromGesture: boolean = false;
    private restrictZoomFromGesture: boolean = false;
    private restrictRelativeXTranslationFromGesture: boolean = false;
    private restrictRelativeYTranslationFromGesture: boolean = false;

    private isDragging: boolean = false;
    private dragStartPoint: Point;

    private requestRef: number;
    private handOverStepControl: boolean = false;
    private lastUpdateTime: number;

    private windowsResizeObserver: ResizeObserver;

    private UIComponentList: InteractiveUIComponent[] = [];

    private touchStrategy: CanvasTouchStrategy;
    private trackpadStrategy: CanvasTrackpadStrategy;

    constructor(){
        super();
        this.canvasWidth = this._canvas.width;
        this.canvasHeight = this._canvas.height;
        this.maxTransHalfHeight = 25000;
        this.maxTransHalfWidth = 25000;
        this.style.display = "block";
        
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

        this.UIComponentList = [];

        this.touchStrategy = new OneFingerPanTwoFingerZoom(this.camera, this.UIComponentList);
        this.trackpadStrategy = new TwoFingerPanPinchZoom();

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


        this.dispatchEvent(new CameraUpdateEvent('cameraupdate', {cameraAngle: this.camera.getRotation(), cameraPosition: this.camera.getPosition(), cameraZoomLevel: this.camera.getZoomLevel()}));

        this.UIComponentList.forEach((uiComponent)=>{
            uiComponent.update(deltaTime);
            uiComponent.draw(this._context, this.camera.getZoomLevel());
        });

        this.camera.step(deltaTime);

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
            console.log("test");
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
        if(name == "restrict-relative-y-translation"){
            if (newValue !== null && newValue !== "false"){
                this.restrictRelativeYTranslationFromGesture = true;
                this.camera.lockRelativeYTranslationFromGesture();
            } else {
                this.restrictRelativeYTranslationFromGesture = false;
                this.camera.releaseLockOnRelativeYTranslationFromGesture();
            }
        }
        if(name == "restrict-relative-x-translation"){
            if (newValue !== null && newValue !== "false"){
                this.restrictRelativeXTranslationFromGesture = true;
                this.camera.lockRelativeXTranslationFromGesture();
            } else {
                this.restrictRelativeXTranslationFromGesture = false;
                this.camera.releaseLockOnRelativeXTranslationFromGesture();
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
            } else {
                this.UIComponentList.forEach((component)=>{
                    component.raycast(this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY}));
                })
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
        this.trackpadStrategy.scrollHandler(e, this.camera, this.getCoordinateConversionFn({x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom}));
    }

    getCoordinateConversionFn(bottomLeftCorner: Point): (interestPoint: Point)=>Point{
        const conversionFn =  (interestPoint: Point)=>{
            const viewPortPoint = PointCal.flipYAxis(PointCal.subVector(interestPoint, bottomLeftCorner));
            return viewPortPoint;
        }
        return conversionFn;
    }

    touchstartHandler(e: TouchEvent){
        this.touchStrategy.touchstartHandler(e, {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom});
    }

    touchcancelHandler(e: TouchEvent){
        this.touchStrategy.touchcancelHandler(e, {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom});
    }

    touchendHandler(e: TouchEvent){
        this.touchStrategy.touchendHandler(e, {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom});
    }

    touchmoveHandler(e: TouchEvent){
        this.touchStrategy.touchmoveHandler(e, {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom});
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

    insertUIComponent(component: InteractiveUIComponent){
        this.UIComponentList.push(component);
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