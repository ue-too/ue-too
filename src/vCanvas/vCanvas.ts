import { vCamera, CameraLockableObject } from "../vCamera";
import { Point, UIComponent, InteractiveUIComponent } from "..";
import { PointCal } from "point2point";
import {CanvasTouchStrategy, TwoFingerPanZoom, OneFingerPanTwoFingerZoom} from "./CanvasTouchStrategy";
import { CanvasTrackpadStrategy, TwoFingerPanPinchZoom, TwoFingerPanPinchZoomLimitEntireView } from "./CanvasTrackpadStrategy";
import * as AttributeChangeCommands from "./attributeChangCommand";

export class vCanvas extends HTMLElement {
    
    private canvasWidth: number; // this is the reference width for when clearing the canvas in the step function
    private canvasHeight: number; // this is the reference height for when clearing the canvas in the step function
    private fullScreenFlag: boolean = false;
    private maxTransHalfHeight: number;
    private maxTransHalfWidth: number;

    static observedAttributes = ["width", "height", "full-screen", "style", "tap-step", 
                                "restrict-x-translation", "restrict-y-translation", "restrict-translation", 
                                "restrict-rotation", "restrict-zoom", "restrict-relative-x-translation", "restrict-relative-y-translation",
                                "max-half-trans-width", "max-half-trans-height"]
                                ;

    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    private _context: CanvasRenderingContext2D;

    private camera: vCamera;

    private attributeCommands: Map<string, AttributeChangeCommands.AttributeChangeCommand>;
    
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

    private touchStrategy: CanvasTouchStrategy;
    private trackpadStrategy: CanvasTrackpadStrategy;

    constructor(){
        super();
        this.canvasWidth = this._canvas.width;
        this.canvasHeight = this._canvas.height;

        this._canvas.style.display = "block";
        this.maxTransHalfHeight = 40075000 / 2;
        this.maxTransHalfWidth = 40075000 / 2;
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

        this.touchStrategy = new OneFingerPanTwoFingerZoom(this.camera);
        this.trackpadStrategy = new TwoFingerPanPinchZoomLimitEntireView();

        this.windowsResizeObserver = new ResizeObserver(this.windowResizeHandler.bind(this));

        this.setCommands();
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
        this.drawBoundingBox(this._context);

        this.drawAxis(this._context, this.camera.getZoomLevel());


        this.dispatchEvent(new CameraUpdateEvent('cameraupdate', {cameraAngle: this.camera.getRotation(), cameraPosition: this.camera.getPosition(), cameraZoomLevel: this.camera.getZoomLevel()}));

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

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if(newValue == null){
            return;
        }
        const command = this.attributeCommands.get(name);
        if(command){
            if(newValue == ""){
                newValue = "true";
            }
            command.execute(newValue);
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

    drawReferenceCircle(context: CanvasRenderingContext2D, pos: Point): void {
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        // context.moveTo(pos.x, -pos.y);
        context.arc(pos.x, -pos.y, 5, 0, 2 * Math.PI);
        context.stroke();
    }

    drawBoundingBox(context: CanvasRenderingContext2D): void{
        context.beginPath();
        context.strokeStyle = "blue";
        context.lineWidth = 100;
        context.roundRect(-this.maxTransHalfWidth, -this.maxTransHalfHeight, this.maxTransHalfWidth * 2, this.maxTransHalfHeight * 2, 5);
        context.stroke();
        context.lineWidth = 3;
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

    setCommands(){
        this.attributeCommands = new Map<string, AttributeChangeCommands.AttributeChangeCommand>();
        this.attributeCommands.set("width", new AttributeChangeCommands.SetWidthCommand(this));
        this.attributeCommands.set("height", new AttributeChangeCommands.SetHeightCommand(this));
        this.attributeCommands.set("full-screen", new AttributeChangeCommands.ToggleFullScreenCommand(this));
        this.attributeCommands.set("tap-step", new AttributeChangeCommands.ToggleStepFunctionCommand(this));
        this.attributeCommands.set("restrict-x-translation", new AttributeChangeCommands.RestrictXTranslationCommand(this));
        this.attributeCommands.set("restrict-y-translation", new AttributeChangeCommands.RestrictYTranslationCommand(this));
        this.attributeCommands.set("restrict-translation", new AttributeChangeCommands.RestrictTranslationCommand(this));
        this.attributeCommands.set("restrict-rotation", new AttributeChangeCommands.RestrictRotationCommand(this));
        this.attributeCommands.set("restrict-zoom", new AttributeChangeCommands.RestrictZoomCommand(this));
        this.attributeCommands.set("restrict-relative-x-translation", new AttributeChangeCommands.RestrictRelativeXTranslationCommand(this));
        this.attributeCommands.set("restrict-relative-y-translation", new AttributeChangeCommands.RestrictRelativeYTranslationCommand(this));
    }

    setCanvasWidth(width: number){
        this.canvasWidth = width;
        this._canvas.width = width;
        this.camera.setViewPortWidth(this.canvasWidth);
    }

    setCanvasHeight(height: number){
        this.canvasHeight = height;
        this._canvas.height = height;
        this.camera.setViewPortHeight(this.canvasHeight);
    }

    toggleFullScreen(fullscreen: boolean){
        if(fullscreen){
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

    toggleStepFunction(tapStep: boolean){
        if(tapStep){
            this.handOverStepControl = true;
        } else {
            this.handOverStepControl = false;
        }
    }

    toggleXTranslationRestriction(restrictXTranslation: boolean){
        if(restrictXTranslation){
            this.restrictXTranslationFromGesture = true;
            this.camera.lockXTranslationFromGesture();
        } else {
            this.restrictXTranslationFromGesture = false;
            this.camera.releaseLockOnXTranslationFromGesture();
        }
    }

    toggleYTranslationRestriction(restrictYTranslation: boolean){
        if(restrictYTranslation){
            this.restrictYTranslationFromGesture = true;
            this.camera.lockYTranslationFromGesture();
        } else {
            this.restrictYTranslationFromGesture = false;
            this.camera.releaseLockOnYTranslationFromGesture();
        }
    }

    toggleTranslationRestriction(restrictTranslation: boolean){
        if(restrictTranslation){
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

    toggleRotationRestriction(restrictRotation: boolean){
        if(restrictRotation){
            this.restrictRotationFromGesture = true;
            this.camera.lockRotationFromGesture();
        } else {
            this.restrictRotationFromGesture = false;
            this.camera.releaseLockOnRotationFromGesture();
        }
    }

    toggleZoomRestriction(restrictZoom: boolean){
        if(restrictZoom){
            this.restrictZoomFromGesture = true;
            this.camera.lockZoomFromGesture();
        } else {
            this.restrictZoomFromGesture = false;
            this.camera.releaseLockOnZoomFromGesture();
        }
    }

    toggleRelativeXTranslationRestriction(restrictRelativeXTranslation: boolean){
        if(restrictRelativeXTranslation){
            this.restrictRelativeXTranslationFromGesture = true;
            this.camera.lockRelativeXTranslationFromGesture();
        } else {
            this.restrictRelativeXTranslationFromGesture = false;
            this.camera.releaseLockOnRelativeXTranslationFromGesture();
        }
    }

    toggleRelativeYTranslationRestriction(restrictRelativeYTranslation: boolean){
        if(restrictRelativeYTranslation){
            this.restrictRelativeYTranslationFromGesture = true;
            this.camera.lockRelativeYTranslationFromGesture();
        } else {
            this.restrictRelativeYTranslationFromGesture = false;
            this.camera.releaseLockOnRelativeYTranslationFromGesture();
        }
    }

    setMaxHalfTransWidth(maxHalfTransWidth: number){
        this.maxTransHalfWidth = maxHalfTransWidth;
        this.camera.setHorizontalBoundaries(-this.maxTransHalfWidth, this.maxTransHalfWidth);
    }

    setMaxHalfTransHeight(maxHalfTransHeight: number){
        this.maxTransHalfHeight = maxHalfTransHeight;
        this.camera.setVerticalBoundaries(-this.maxTransHalfHeight, this.maxTransHalfHeight);
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