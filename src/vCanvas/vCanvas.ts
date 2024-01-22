import { CameraLockableObject } from "../vCamera";
import vCamera from "../vCamera";
import { Point, UIComponent, InteractiveUIComponent } from "..";
import { PointCal } from "point2point";
import {CanvasTouchStrategy, TwoFingerPanZoom, OneFingerPanTwoFingerZoom} from "./CanvasTouchStrategy";
import { CanvasTrackpadStrategy, TwoFingerPanPinchZoom, TwoFingerPanPinchZoomLimitEntireView } from "./CanvasTrackpadStrategy";
import * as AttributeChangeCommands from "./attributeChangCommand";


export interface RotationComponent {
    setRotation(rotation: number): void;
}
export class vCanvas extends HTMLElement {
    
    private _canvasWidth: number; // this is the reference width for when clearing the canvas in the step function
    private _canvasHeight: number; // this is the reference height for when clearing the canvas in the step function
    private _fullScreenFlag: boolean = false;

    static observedAttributes = ["width", "height", "full-screen", "control-step", 
                                "restrict-x-translation", "restrict-y-translation", "restrict-translation", 
                                "restrict-rotation", "restrict-zoom", "restrict-relative-x-translation", "restrict-relative-y-translation",
                                "max-half-trans-width", "max-half-trans-height", "debug-mode"];

    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    private _context: CanvasRenderingContext2D;

    private _camera: vCamera;

    private attributeCommands: Map<string, AttributeChangeCommands.AttributeChangeCommand>;

    private isDragging: boolean = false;
    private dragStartPoint: Point;

    private requestRef: number;
    private _handOverStepControl: boolean = false;
    private lastUpdateTime: number;

    private windowsResizeObserver: ResizeObserver;

    private touchStrategy: CanvasTouchStrategy;
    private trackpadStrategy: CanvasTrackpadStrategy;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    constructor(){
        super();
        this._canvasWidth = this._canvas.width;
        this._canvasHeight = this._canvas.height;

        this._canvas.style.display = "block";
        this.style.display = "block";
        
        this._camera = new vCamera();
        this.maxTransHalfHeight = 40075000 / 2;
        this.maxTransHalfWidth = 40075000 / 2;
        this._camera.setMaxZoomLevel(5);
        this._camera.setMinZoomLevel(0.01);
        this._camera.setViewPortWidth(this._canvasWidth);
        this._camera.setViewPortHeight(this._canvasHeight);

        this._context = this._canvas.getContext("2d");
        this.attachShadow({mode: "open"});
        this.bindFunctions();

        this.touchStrategy = new OneFingerPanTwoFingerZoom(this._camera);
        this.trackpadStrategy = new TwoFingerPanPinchZoomLimitEntireView();

        this.windowsResizeObserver = new ResizeObserver(this.windowResizeHandler.bind(this));

        this._debugMode = false;

        this.setCommands();
    }

    get fullScreenFlag(): boolean {
        return this._fullScreenFlag;
    }

    set fullScreenFlag(value: boolean) {
        this._fullScreenFlag = value;
    }

    get width(): number {
        return this._canvasWidth;
    }

    set width(value: number) {
        this._canvasWidth = value;
        this._canvas.width = value;
        this._camera.setViewPortWidth(value);
    }

    get height(): number {
        return this._canvasHeight;
    }

    set height(value: number) {
        this._canvasHeight = value;
        this._canvas.height = value;
        this._camera.setViewPortHeight(value);
    }

    set stepControl(value: boolean){
        this._handOverStepControl = value;
    }

    get stepControl(): boolean{ 
        return this._handOverStepControl;
    }

    get restrictXTranslation(): boolean{ 
        return this._camera.restrictXTranslationFromGesture;
    }
    
    set restrictXTranslation(value: boolean){
        if(value){
            this._camera.lockXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnXTranslationFromGesture();
        }
    }

    get restrictYTranslation(): boolean{
        return this._camera.restrictYTranslationFromGesture;
    }

    set restrictYTranslation(value: boolean){
        if(value){
            this._camera.lockYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnYTranslationFromGesture();
        }
    }

    get restrictRotation(): boolean{
        return this._camera.restrictRotationFromGesture;
    }

    set restrictRotation(value: boolean){
        if(value){
            this._camera.lockRotationFromGesture();
        } else {
            this._camera.releaseLockOnRotationFromGesture();
        }
    }

    get restrictZoom(): boolean{
        return this._camera.restrictZoomFromGesture;
    }

    set restrictZoom(value: boolean){
        if(value){
            this._camera.lockZoomFromGesture();
        } else {
            this._camera.releaseLockOnZoomFromGesture();
        }
    }

    get restrictRelativeXTranslation(): boolean{
        return this._camera.restrictRelativeXTranslationFromGesture;
    }

    set restrictRelativeXTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeXTranslationFromGesture();
        }
    }

    get restrictRelativeYTranslation(): boolean{
        return this._camera.restrictRelativeYTranslationFromGesture;
    }

    set restrictRelativeYTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeYTranslationFromGesture();
        }
    }

    get maxTransHalfHeight(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.y != undefined && boundaries.max.y != undefined){
            return (boundaries.max.y - boundaries.min.y) / 2;
        }
        return undefined;
    }

    set maxTransHalfHeight(value: number){
        this._camera.setVerticalBoundaries(-value, value);
    }

    get maxTransHalfWidth(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.x != undefined && boundaries.max.x != undefined){
            return (boundaries.max.x - boundaries.min.x) / 2;
        }
        return undefined;
    }
    
    set maxTransHalfWidth(value: number){
        this._camera.setHorizontalBoundaries(-value, value);
    }

    get debugMode(): boolean{
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
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
        if(!this._handOverStepControl){
            this.requestRef = requestAnimationFrame(this.step);
        }
    }

    disconnectedCallback(){
        if(!this._handOverStepControl){
            cancelAnimationFrame(this.requestRef);
        }
        this.windowsResizeObserver.unobserve(document.body);
        this.removeEventListeners();
    }

    private step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._canvas.width = this._canvasWidth;
        this._canvas.height = this._canvasHeight;

        this._context.translate( this._canvasWidth / 2, this._canvasHeight / 2 );
        this._context.scale(this._camera.getZoomLevel(), this._camera.getZoomLevel());
        this._context.rotate(this._camera.getRotation());
        this._context.translate(-this._camera.getPosition().x,  this._camera.getPosition().y);

        if(this._debugMode){
            // this.drawCrossHeir(this._context, this.mousePos);
            // this.drawPositionText(this._context, this.mousePos);
            this.drawReferenceCircle(this._context, {x: 30, y: 20});
            this.drawBoundingBox(this._context);
            this.drawAxis(this._context, this._camera.getZoomLevel());
        }

        this.dispatchEvent(new CameraUpdateEvent('cameraupdate', {cameraAngle: this._camera.getRotation(), cameraPosition: this._camera.getPosition(), cameraZoomLevel: this._camera.getZoomLevel()}));

        this._camera.step(deltaTime);

        // everthing should be above this reqestAnimationFrame should be the last call in step
        if(!this._handOverStepControl){
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
        this.mousePos = this._camera.convert2WorldSpace(this.convertWindowPoint2ViewPortPoint({x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom}, {x: e.clientX, y: e.clientY}));
        if (e.pointerType == "mouse" && this.isDragging){
            this._canvas.style.cursor = "move";
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this._camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this._camera.getZoomLevel());
            this._camera.moveWithClampFromGesture(diffInWorld);
            this.dragStartPoint = target;
        }
    }

    scrollHandler(e: WheelEvent){
        e.preventDefault();
        this.trackpadStrategy.scrollHandler(e, this._camera, this.getCoordinateConversionFn({x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().bottom}));
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
        return this._camera;
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }

    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
        return this._camera.convert2WorldSpace(pointInCameraViewPort);
    }

    windowResizeHandler(){
        if(this.fullScreenFlag){
            this._canvasWidth = window.innerWidth;
            this._canvasHeight = window.innerHeight;
            this._canvas.width = this._canvasWidth;
            this._canvas.height = this._canvasHeight;
            this._camera.setViewPortWidth(window.innerWidth);
            this._camera.setViewPortHeight(window.innerHeight);
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

    drawCrossHeir(context: CanvasRenderingContext2D, pos: Point): void{
        context.beginPath();
        context.strokeStyle = "red";
        context.lineWidth = 2;
        context.moveTo(pos.x - 10, -pos.y);
        context.lineTo(pos.x + 10, -pos.y);
        context.moveTo(pos.x, -pos.y - 10);
        context.lineTo(pos.x, -pos.y + 10);
        context.stroke();
        context.lineWidth = 3;
    }

    drawPositionText(context: CanvasRenderingContext2D, pos: Point): void{
        context.font = `${20 / this._camera.getZoomLevel()}px Arial`;
        context.fillStyle = "red";
        context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + 10, -pos.y - 10);
    }

    resetCamera(){
        this._camera.resetCameraWithAnimation();
    }

    spinCameraWithAnimation(rotation: number){
        this._camera.spinWithAnimationFromGesture(rotation);
    }

    setCameraAngle(rotation: number){
        this._camera.spinFromGesture(rotation);
    }

    getStepFunction(): (timestamp: number)=>void{
        if (this._handOverStepControl){
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
        this.attributeCommands.set("control-step", new AttributeChangeCommands.ToggleStepFunctionCommand(this));
        this.attributeCommands.set("restrict-x-translation", new AttributeChangeCommands.RestrictXTranslationCommand(this));
        this.attributeCommands.set("restrict-y-translation", new AttributeChangeCommands.RestrictYTranslationCommand(this));
        this.attributeCommands.set("restrict-translation", new AttributeChangeCommands.RestrictTranslationCommand(this));
        this.attributeCommands.set("restrict-rotation", new AttributeChangeCommands.RestrictRotationCommand(this));
        this.attributeCommands.set("restrict-zoom", new AttributeChangeCommands.RestrictZoomCommand(this));
        this.attributeCommands.set("restrict-relative-x-translation", new AttributeChangeCommands.RestrictRelativeXTranslationCommand(this));
        this.attributeCommands.set("restrict-relative-y-translation", new AttributeChangeCommands.RestrictRelativeYTranslationCommand(this));
        this.attributeCommands.set("debug-mode", new AttributeChangeCommands.SetDebugModeCommand(this));
        this.attributeCommands.set("max-half-trans-width", new AttributeChangeCommands.SetMaxHalfTransWidthCommand(this));
        this.attributeCommands.set("max-half-trans-height", new AttributeChangeCommands.SetMaxHalfTransHeightCommand(this));
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