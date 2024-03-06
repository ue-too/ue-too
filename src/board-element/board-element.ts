import BoardCamera from "../board-camera";
import { Point } from "..";
import { PointCal } from "point2point";
import {BoardTouchStrategy, TwoFingerPanZoom} from "../touch-strategy/touch-strategy";
import { BoardTrackpadStrategy, TwoFingerPanPinchZoomLimitEntireView} from "../trackpad-strategy/trackpad-strategy";
import { DefaultBoardElementKMStrategy, BoardKMStrategy } from "../km-strategy/km-strategy";
import * as AttributeChangeCommands from "../attribute-change-command";
import { CameraObserver, CameraState, CameraEventMapping} from "../camera-change-command/camera-observer";
import { CameraListener } from "../camera-change-command/camera-observer";

import { calculateOrderOfMagnitude } from "../util";

export interface RotationComponent {
    setRotation(rotation: number): void;
}
export default class BoardElement extends HTMLElement{
    
    private _canvasWidth: number; // this is the reference width for when clearing the canvas in the step function
    private _canvasHeight: number; // this is the reference height for when clearing the canvas in the step function
    private _fullScreenFlag: boolean = false;

    static observedAttributes = ["width", "height", "full-screen", "control-step", 
                                "restrict-x-translation", "restrict-y-translation", "restrict-translation", 
                                "restrict-rotation", "restrict-zoom", "restrict-relative-x-translation", "restrict-relative-y-translation",
                                "max-half-trans-width", "max-half-trans-height", "debug-mode", "ruler", "grid", "vertical-grid-size", "horizontal-grid-size"];

    private _canvas: HTMLCanvasElement; 
    private _context: CanvasRenderingContext2D;

    private _camera: BoardCamera;
    private _cameraObserver: CameraObserver;

    private attributeCommands: Map<string, AttributeChangeCommands.AttributeChangeCommand>;

    private requestRef: number;
    private _handOverStepControl: boolean = true;
    private lastUpdateTime: number;

    private windowsResizeObserver: ResizeObserver;

    private _touchStrategy: BoardTouchStrategy;
    private _trackpadStrategy: BoardTrackpadStrategy;
    private _keyboardMouseStrategy: BoardKMStrategy;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    private _verticalGridSize: number = 0;
    private _horizontalGridSize: number = 0;

    private _displayGrid: boolean = false;
    private _displayRuler: boolean = false;

    constructor(){
        super();

        this._canvas = document.createElement('canvas');
        this._canvas.width = 300;
        this._canvas.height = 300;
        this._camera = new BoardCamera();
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
        this._keyboardMouseStrategy = new DefaultBoardElementKMStrategy(this, this._cameraObserver);

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

    get camera(): BoardCamera{
        return this._camera;
    }

    set touchStrategy(strategy: BoardTouchStrategy){
        this._touchStrategy = strategy;
    }

    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    set trackpadStrategy(strategy: BoardTrackpadStrategy){
        this._trackpadStrategy = strategy;
    }

    get trackpadStrategy(): BoardTrackpadStrategy{
        return this._trackpadStrategy;
    }

    set keyboardMouseStrategy(strategy: BoardKMStrategy){
        this._keyboardMouseStrategy = strategy;
    }

    get keyboardMouseStrategy(): BoardKMStrategy{
        return this._keyboardMouseStrategy;
    }

    set verticalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._verticalGridSize = value;
    }

    get verticalGridSize(): number{
        return this._verticalGridSize;
    }

    set horizontalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._horizontalGridSize = value;
    }

    get horizontalGridSize(): number{
        return this._horizontalGridSize;
    }

    get displayGrid(): boolean{
        return this._displayGrid;
    }

    set displayGrid(value: boolean){
        this._displayGrid = value;
    }

    get displayRuler(): boolean{
        return this._displayRuler;
    }

    set displayRuler(value: boolean){
        this._displayRuler = value;
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
            this.drawBoundingBox(this._context);
            this.drawCrossHair(this._context, mouseInWorld, 50);
            this.drawPositionText(this._context, mouseInWorld, 20);
            this.drawReferenceCircle(this._context, {x: 30, y: 20});
            this.drawAxis(this._context, this._camera.getZoomLevel());
            this.drawCameraCenterWithCrossHair(this._context, 50);
        }

        if(this._displayGrid && this._camera.getRotationDeg() == 0){
            this.drawGrid(this._context);
        }

        if(this._displayRuler && this._camera.getRotationDeg() == 0){
            this.drawRuler(this._context);
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
            newValue = "false";
        }
        const command = this.attributeCommands.get(name);
        if(command){
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

    getCamera(): BoardCamera {
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
            this.width = window.innerWidth;
            this.height = window.innerHeight;
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

    drawCrossHair(context: CanvasRenderingContext2D, pos: Point, size: number, color: string = "red"): void{
        // size is the pixel shown in the viewport 
        let halfSize = size / 2;
        halfSize = halfSize / this._camera.getZoomLevel();
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 2 / this._camera.getZoomLevel();
        context.moveTo(pos.x - halfSize, -pos.y);
        context.lineTo(pos.x + halfSize, -pos.y);
        context.moveTo(pos.x, -pos.y - halfSize);
        context.lineTo(pos.x, -pos.y + halfSize);
        context.stroke();
        context.lineWidth = 3;
    }

    drawCameraCenterWithCrossHair(context: CanvasRenderingContext2D, size: number): void{
        let pos = this._camera.getPosition();
        this.drawCrossHair(context, pos, size, "teal");
        this.drawPositionText(context, pos, 20, "teal");
    }

    drawGrid(context: CanvasRenderingContext2D): void{
        let topLeftCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left};
        topLeftCorner = this.convertWindowPoint2WorldCoord(topLeftCorner);
        let topRightCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().right};
        topRightCorner = this.convertWindowPoint2WorldCoord(topRightCorner);
        let bottomLeftCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left};
        bottomLeftCorner = this.convertWindowPoint2WorldCoord(bottomLeftCorner);
        let bottomRightCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().right};
        bottomRightCorner = this.convertWindowPoint2WorldCoord(bottomRightCorner);
        let leftRightDirection = PointCal.unitVectorFromA2B(topLeftCorner, topRightCorner);
        let topDownDirection = PointCal.unitVectorFromA2B(bottomLeftCorner, topLeftCorner);
        let width = PointCal.distanceBetweenPoints(topLeftCorner, topRightCorner);
        let orderOfMagnitude = calculateOrderOfMagnitude(width);
        let divisor = Math.pow(10, orderOfMagnitude);
        let subDivisor = divisor / 10;
        let minHorizontalSmallTick = Math.ceil(topLeftCorner.x / subDivisor) * subDivisor;
        let maxHorizontalSmallTick = Math.floor(topRightCorner.x / subDivisor) * subDivisor;
        let minVerticalSmallTick = Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = Math.floor(topLeftCorner.y / subDivisor) * subDivisor;

        for(let i = minHorizontalSmallTick; i <= maxHorizontalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            context.moveTo(i, -topLeftCorner.y);
            context.lineTo(i, -topLeftCorner.y + this.height / this._camera.getZoomLevel());
            context.stroke();
        }
        for(let i = minVerticalSmallTick; i <= maxVerticalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            context.moveTo(topLeftCorner.x, -i);
            context.lineTo(topLeftCorner.x + this.width / this._camera.getZoomLevel(), -i);
            context.stroke();
        }
    }

    drawRuler(context: CanvasRenderingContext2D): void{
        let topLeftCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left};
        topLeftCorner = this.convertWindowPoint2WorldCoord(topLeftCorner);
        let topRightCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().right};
        topRightCorner = this.convertWindowPoint2WorldCoord(topRightCorner);
        let bottomLeftCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left};
        bottomLeftCorner = this.convertWindowPoint2WorldCoord(bottomLeftCorner);
        let bottomRightCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().right};
        bottomRightCorner = this.convertWindowPoint2WorldCoord(bottomRightCorner);
        let leftRightDirection = PointCal.unitVectorFromA2B(topLeftCorner, topRightCorner);
        let topDownDirection = PointCal.unitVectorFromA2B(bottomLeftCorner, topLeftCorner);
        let width = PointCal.distanceBetweenPoints(topLeftCorner, topRightCorner);
        let orderOfMagnitude = calculateOrderOfMagnitude(width);
        let divisor = Math.pow(10, orderOfMagnitude);
        let halfDivisor = divisor / 2;
        let subDivisor = divisor / 10;
        let minHorizontalLargeTick = Math.ceil(topLeftCorner.x / divisor) * divisor;
        let maxHorizontalLargeTick = Math.floor(topRightCorner.x / divisor) * divisor;
        let minVerticalLargeTick = Math.ceil(bottomLeftCorner.y / divisor) * divisor;
        let maxVerticalLargeTick = Math.floor(topLeftCorner.y / divisor) * divisor;
        let minHorizontalMediumTick = Math.ceil(topLeftCorner.x / halfDivisor) * halfDivisor;
        let maxHorizontalMediumTick = Math.floor(topRightCorner.x / halfDivisor) * halfDivisor;
        let minVerticalMediumTick = Math.ceil(bottomLeftCorner.y / halfDivisor) * halfDivisor;
        let maxVerticalMediumTick = Math.floor(topLeftCorner.y / halfDivisor) * halfDivisor;
        let minHorizontalSmallTick = Math.ceil(topLeftCorner.x / subDivisor) * subDivisor;
        let maxHorizontalSmallTick = Math.floor(topRightCorner.x / subDivisor) * subDivisor;
        let minVerticalSmallTick = Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = Math.floor(topLeftCorner.y / subDivisor) * subDivisor;
        let horizontalLargeTickCrampedness = (maxHorizontalLargeTick - minHorizontalLargeTick) / divisor;
        let verticalLargeTickCrampedness = (maxVerticalLargeTick - minVerticalLargeTick) / divisor;
        let horizontalMediumTickCrampedness = (maxHorizontalMediumTick - minHorizontalMediumTick) / halfDivisor;
        let verticalMediumTickCrampedness = (maxVerticalMediumTick - minVerticalMediumTick) / halfDivisor;

        for(let i = minHorizontalLargeTick; i <= maxHorizontalLargeTick; i += divisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 5 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 50 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -50 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            context.stroke();
        }
        for(let i = minVerticalLargeTick; i <= maxVerticalLargeTick; i += divisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 5 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -50 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 50 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            context.stroke();
        }
        for(let i = minHorizontalMediumTick; i <= maxHorizontalMediumTick; i += halfDivisor){
            if(i % divisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 3 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 25 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -25 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            if(horizontalLargeTickCrampedness < 5) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.font = `${15 / this._camera.getZoomLevel()}px Helvetica`;
                const textDimensions = context.measureText(`${i.toFixed(0)}`);
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            }
            context.stroke();
        }
        for(let i = minVerticalMediumTick; i <= maxVerticalMediumTick; i += halfDivisor){
            if(i % divisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 3 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -25 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 25 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            if(verticalLargeTickCrampedness < 5) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.font = `${18 / this._camera.getZoomLevel()}px Helvetica`;
                const textDimensions = context.measureText(`${i.toFixed(0)}`);
                context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            }
            context.stroke();
        }
        for(let i = minHorizontalSmallTick; i <= maxHorizontalSmallTick; i += subDivisor){
            if(i % divisor == 0 || i % halfDivisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 1 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 12.5 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -12.5 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            if(horizontalMediumTickCrampedness < 10) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.font = `${10 / this._camera.getZoomLevel()}px Helvetica`;
                const textDimensions = context.measureText(`${i.toFixed(0)}`);
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            }
            context.stroke();
        }
        for(let i = minVerticalSmallTick; i <= maxVerticalSmallTick; i += subDivisor){
            if(i % divisor == 0 || i % halfDivisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 1 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -12.5 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 12.5 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            if(verticalMediumTickCrampedness < 10) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.font = `${12 / this._camera.getZoomLevel()}px Helvetica`;
                const textDimensions = context.measureText(`${i.toFixed(0)}`);
                context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            }
            context.stroke();
        }
    }

    drawPositionText(context: CanvasRenderingContext2D, pos: Point, offset: number, color: string="red"): void{
        offset = offset / this._camera.getZoomLevel();
        context.font = `${20 / this._camera.getZoomLevel()}px Arial`;
        context.fillStyle = color;
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
        // if (this._handOverStepControl){
        //     return this.step.bind(this);
        // } else {
        //     return null;
        // }
        return this.step;
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
        this.attributeCommands.set("vertical-grid-size", new AttributeChangeCommands.SetVerticalGridSizeCommand(this));
        this.attributeCommands.set("horizontal-grid-size", new AttributeChangeCommands.SetHorizontalGridSizeCommand(this));
        this.attributeCommands.set("ruler", new AttributeChangeCommands.ToggleRulerCommand(this));
        this.attributeCommands.set("grid", new AttributeChangeCommands.ToggleGridCommand(this));
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