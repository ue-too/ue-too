import vCamera from "../vCamera";
import { Point } from "..";
import { PointCal } from "point2point";
import {CanvasTouchStrategy, TwoFingerPanZoom} from "./CanvasTouchStrategy";
import { CanvasTrackpadStrategy, TwoFingerPanPinchZoomLimitEntireView} from "./CanvasTrackpadStrategy";
import { DefaultCanvasKMStrategy, CanvasKMStrategy } from "./CanvasKMStrategy";
import * as AttributeChangeCommands from "./attributeChangCommand";
import { CameraObserver, CameraState, CameraEventMapping} from "./cameraChangeCommand/cameraObserver";
import { CameraListener } from "./cameraChangeCommand/cameraObserver";

export interface RotationComponent {
    setRotation(rotation: number): void;
}
export default class vCanvas extends HTMLElement{
    
    private _canvasWidth: number; // this is the reference width for when clearing the canvas in the step function
    private _canvasHeight: number; // this is the reference height for when clearing the canvas in the step function
    private _fullScreenFlag: boolean = false;

    static observedAttributes = ["width", "height", "full-screen", "control-step", 
                                "restrict-x-translation", "restrict-y-translation", "restrict-translation", 
                                "restrict-rotation", "restrict-zoom", "restrict-relative-x-translation", "restrict-relative-y-translation",
                                "max-half-trans-width", "max-half-trans-height", "debug-mode"];

    private _canvas: HTMLCanvasElement; 
    private _context: CanvasRenderingContext2D;

    private _camera: vCamera;
    private _cameraObserver: CameraObserver;

    private attributeCommands: Map<string, AttributeChangeCommands.AttributeChangeCommand>;

    private requestRef: number;
    private _handOverStepControl: boolean = true;
    private lastUpdateTime: number;

    private windowsResizeObserver: ResizeObserver;

    private _touchStrategy: CanvasTouchStrategy;
    private _trackpadStrategy: CanvasTrackpadStrategy;
    private _keyboardMouseStrategy: CanvasKMStrategy;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    constructor(){
        super();

        this._canvas = document.createElement('canvas');

        this._camera = new vCamera();
        this._camera.setMaxZoomLevel(5);
        this._camera.setMinZoomLevel(0.01);
        this._camera.setViewPortWidth(this._canvasWidth);
        this._camera.setViewPortHeight(this._canvasHeight);
        
        this.maxTransHalfHeight = 5000;
        this.maxTransHalfWidth = 5000;

        this._cameraObserver = new CameraObserver(this._camera);

        this.attachShadow({mode: "open"});
        this.bindFunctions();

        this._touchStrategy = new TwoFingerPanZoom(this, this._cameraObserver);
        this._trackpadStrategy = new TwoFingerPanPinchZoomLimitEntireView(this, this._cameraObserver);
        this._keyboardMouseStrategy = new DefaultCanvasKMStrategy(this, this._cameraObserver);

        this.windowsResizeObserver = new ResizeObserver(this.windowResizeHandler.bind(this));

        this._debugMode = false;

        this.setAttributeCommands();
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
        const minZoomLevel = value / (this.maxTransHalfWidth * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            console.log("set");
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    get height(): number {
        return this._canvasHeight;
    }

    set height(value: number) {
        this._canvasHeight = value;
        this._canvas.height = value;
        this._camera.setViewPortHeight(value);
        const minZoomLevel = value / (this.maxTransHalfHeight * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            console.log("set");
            this._camera.setMinZoomLevel(minZoomLevel);
        }
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

    get camera(): vCamera{
        return this._camera;
    }

    set touchStrategy(strategy: CanvasTouchStrategy){
        this._touchStrategy = strategy;
    }

    get touchStrategy(): CanvasTouchStrategy{
        return this._touchStrategy;
    }

    set trackpadStrategy(strategy: CanvasTrackpadStrategy){
        this._trackpadStrategy = strategy;
    }

    get trackpadStrategy(): CanvasTrackpadStrategy{
        return this._trackpadStrategy;
    }

    set keyboardMouseStrategy(strategy: CanvasKMStrategy){
        this._keyboardMouseStrategy = strategy;
    }

    get keyboardMouseStrategy(): CanvasKMStrategy{
        return this._keyboardMouseStrategy;
    }

    bindFunctions(){
        this.step = this.step.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
    }

    connectedCallback(){
        this._canvasWidth = this._canvas.width; // need to keep this in order to clear the canvas
        this._canvasHeight = this._canvas.height; // need to keep this in order to clear the canvas
        this.shadowRoot.appendChild(this._canvas)
        this._context = this._canvas.getContext("2d");
        this._canvas.style.display = "block";
        this.style.display = "inline-block";
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

        this._camera.step(deltaTime);

        if(this._debugMode){
            let mouseInWorld = this.convertWindowPoint2WorldCoord(this.mousePos);
            this.drawCrossHair(this._context, mouseInWorld, 50);
            this.drawPositionText(this._context, mouseInWorld, 20);
            this.drawReferenceCircle(this._context, {x: 30, y: 20});
            this.drawBoundingBox(this._context);
            this.drawAxis(this._context, this._camera.getZoomLevel());
        }

        // everthing should be above this reqestAnimationFrame should be the last call in step
        if(!this._handOverStepControl){
            this.requestRef = window.requestAnimationFrame(this.step);
        }
    }

    registerEventListeners(){
        this._trackpadStrategy.setUp();
        this._touchStrategy.setUp();
        this._keyboardMouseStrategy.setUp();
        this.addEventListener("pointermove", this.pointerMoveHandler);
        this.addEventListener("pointerdown", this.pointerDownHandler);
    }

    removeEventListeners(){
        this._trackpadStrategy.tearDown();
        this._touchStrategy.tearDown();
        this._keyboardMouseStrategy.tearDown();
        this.removeEventListener("pointermove", this.pointerMoveHandler);
        this.removeEventListener("pointerdown", this.pointerDownHandler);
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

    pointerMoveHandler(e: PointerEvent){
        this.mousePos = {x: e.clientX, y: e.clientY}; 
    }

    pointerDownHandler(e: PointerEvent) {
        console.log("clicked at", this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY}));
    }

    getCoordinateConversionFn(bottomLeftCorner: Point): (interestPoint: Point)=>Point{
        const conversionFn =  (interestPoint: Point)=>{
            const viewPortPoint = PointCal.flipYAxis(PointCal.subVector(interestPoint, bottomLeftCorner));
            return viewPortPoint;
        }
        return conversionFn;
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
        } else {
            this._canvas.width = this._canvasWidth;
            this._canvas.height = this._canvasHeight;
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

    drawCrossHair(context: CanvasRenderingContext2D, pos: Point, size: number): void{
        // size is the pixel shown in the viewport 
        let halfSize = size / 2;
        halfSize = halfSize / this._camera.getZoomLevel();
        context.beginPath();
        context.strokeStyle = "red";
        context.lineWidth = 2 / this._camera.getZoomLevel();
        context.moveTo(pos.x - halfSize, -pos.y);
        context.lineTo(pos.x + halfSize, -pos.y);
        context.moveTo(pos.x, -pos.y - halfSize);
        context.lineTo(pos.x, -pos.y + halfSize);
        context.stroke();
        context.lineWidth = 3;
    }

    drawPositionText(context: CanvasRenderingContext2D, pos: Point, offset: number): void{
        offset = offset / this._camera.getZoomLevel();
        context.font = `${20 / this._camera.getZoomLevel()}px Arial`;
        context.fillStyle = "red";
        context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + offset, -pos.y - offset);
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

    setAttributeCommands(){
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

    subscribeToCameraUpdate(listener: CameraListener){
        this._cameraObserver.subscribe(listener);
    }

    unsubscribeToCameraUpdate(listener: CameraListener){
        this._cameraObserver.unsubscribe(listener);
    }

    on<K extends keyof CameraEventMapping>(eventName: K, callback: (event: CameraEventMapping[K], cameraState: CameraState)=>void): void {
        this._cameraObserver.on(eventName, callback);
    }

    clearCameraUpdateCallbacks(){
        this._cameraObserver.clearCallbacks();
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