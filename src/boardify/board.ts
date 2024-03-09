import BoardCamera from "../board-camera";
import { Point } from "..";
import { PointCal } from "point2point";
import {BoardTouchStrategy, TwoFingerPanZoomForBoard} from "../touch-strategy";
import { BoardTrackpadStrategy, DefaultBoardTrackpadStrategy} from "../trackpad-strategy";
import { BoardKMStrategy, DefaultBoardKMStrategy } from "../km-strategy";
import { CameraObserver, CameraState, CameraEventMapping} from "../camera-change-command/camera-observer";
import { CameraListener } from "../camera-change-command/camera-observer";

import { calculateOrderOfMagnitude } from "../util";

/**
 * Class representing a Board
 * @category Board
 */
export default class Board {
    
    private _fullScreenFlag: boolean = false;

    private _canvas: HTMLCanvasElement; 
    private _context: CanvasRenderingContext2D;

    private _camera: BoardCamera;
    private _cameraObserver: CameraObserver;

    private requestRef: number;
    private _handOverStepControl: boolean = true;
    private lastUpdateTime: number;

    private _touchStrategy: BoardTouchStrategy;
    private _trackpadStrategy: BoardTrackpadStrategy;
    private _keyboardMouseStrategy: BoardKMStrategy;

    private _limitEntireViewPort: boolean = true;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    private _verticalGridSize: number = 0;
    private _horizontalGridSize: number = 0;

    private _displayGrid: boolean = false;
    private _displayRuler: boolean = false;

    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;

    /**
     * Board constructor
     * @constructor
     * @param {HTMLCanvasElement} canvas - The canvas element for the board to extend its capabilities
     */
    constructor(canvas: HTMLCanvasElement){
        this._canvas = canvas;
        this._context = canvas.getContext("2d");
        this._camera = new BoardCamera();
        this._camera.setMaxZoomLevel(5);
        this._camera.setMinZoomLevel(0.01);
        this._camera.setViewPortWidth(this._canvas.width);
        this._camera.setViewPortHeight(this._canvas.height);
        this.maxHalfTransHeight = 5000;
        this.maxHalfTransWidth = 5000;
        this.adjustZoomLevelBaseOnDimensions();
        // let minZoomLevel = this._canvas.width / (this.maxHalfTransWidth * 2);
        // if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
        //     this._camera.setMinZoomLevel(minZoomLevel);
        // }
        // minZoomLevel = this._canvas.height / (this.maxHalfTransHeight * 2);
        // if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
        //     this._camera.setMinZoomLevel(minZoomLevel);
        // }

        this._cameraObserver = new CameraObserver(this._camera);

        this.bindFunctions();

        this._touchStrategy = new TwoFingerPanZoomForBoard(this._canvas, this, this._cameraObserver, this._limitEntireViewPort);
        this._trackpadStrategy = new DefaultBoardTrackpadStrategy(this._canvas, this, this._cameraObserver, this._limitEntireViewPort);
        this._keyboardMouseStrategy = new DefaultBoardKMStrategy(this._canvas, this, this._cameraObserver, this._limitEntireViewPort);

        this._debugMode = false;

        this.attributeObserver = new MutationObserver(this.attributeCallBack.bind(this));
        this.windowResizeObserver = new ResizeObserver(this.windowResizeHandler);
        this.windowResizeObserver.observe(document.body);
        this.attributeObserver.observe(this._canvas, {attributes: true});

        this.registerEventListeners();
        this.lastUpdateTime = 0;
        if(!this._handOverStepControl){
            this.requestRef = requestAnimationFrame(this.step);
        }
    }

    /**
     * Responsible for when the width and height of the canvas changes updating the camera's view port width and height (syncing the two) 
     * @param mutationsList 
     * @param observer 
     */
    attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    // console.log("width changed");
                    this._camera.setViewPortWidth(this._canvas.width);
                    if(this._limitEntireViewPort){
                        const minZoomLevel = this._canvas.width / (this.maxHalfTransWidth * 2);
                        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                            this._camera.setMinZoomLevel(minZoomLevel);
                        }
                    }
                } else if(mutation.attributeName === "height"){
                    // console.log("height changed");
                    this._camera.setViewPortHeight(this._canvas.height);
                    if(this._limitEntireViewPort){
                        const minZoomLevel = this._canvas.height / (this.maxHalfTransHeight * 2);
                        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                            this._camera.setMinZoomLevel(minZoomLevel);
                        }
                    }
                }
            }
        }
    }

    /**
     * get the flag indicating if the board is in full screen mode
     */
    get fullScreen(): boolean {
        return this._fullScreenFlag;
    }

    /**
     * set the flag indicating if the board is in full screen mode; this will also effect the width and height of the canvas
     */
    set fullScreen(value: boolean) {
        this._fullScreenFlag = value;
        if(this._fullScreenFlag){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }

    /**
     * get the width of the canvas element the board is attached to
     */
    get width(): number {
        return this._canvas.width;
    }

    /**
     * set the width of the canvas element the board is attached to; if the width cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated
     */
    set width(value: number) {
        this._canvas.width = value;
        this._camera.setViewPortWidth(value);
        if(this._limitEntireViewPort){
            const minZoomLevel = value / (this.maxHalfTransWidth * 2);
            if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                this._camera.setMinZoomLevel(minZoomLevel);
            }
        }
    }

    /**
     * get the height of the canvas element the board is attached to
     */
    get height(): number {
        return this._canvas.height;
    }

    /**
     * set the height of the canvas element the board is attached to; if the height cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated
     */
    set height(value: number) {
        console.log("set height value", value);
        this._canvas.height = value;
        this._camera.setViewPortHeight(value);
        if(this._limitEntireViewPort){
            const minZoomLevel = value / (this.maxHalfTransHeight * 2);
            if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                this._camera.setMinZoomLevel(minZoomLevel);
            }
        }
    }

    /**
     * get the flag indicating if the board is handing over the control of the step function
     */
    set stepControl(value: boolean){
        this._handOverStepControl = value;
    }

    /**
     * set the flag indicating if the board is handing over the control of the step function
     */
    get stepControl(): boolean{ 
        return this._handOverStepControl;
    }

    /**
     * get the flag indicating if the board is restricting the x translation
     */
    get restrictXTranslation(): boolean{ 
        return this._camera.restrictXTranslationFromGesture;
    }
    
    /**
     * set the flag indicating if the board is restricting the x translation
     */
    set restrictXTranslation(value: boolean){
        if(value){
            this._camera.lockXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnXTranslationFromGesture();
        }
    }

    /**
     * get the flag indicating if the board is restricting the y translation
     */
    get restrictYTranslation(): boolean{
        return this._camera.restrictYTranslationFromGesture;
    }

    /**
     * set the flag indicating if the board is restricting the y translation
     */
    set restrictYTranslation(value: boolean){
        if(value){
            this._camera.lockYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnYTranslationFromGesture();
        }
    }

    /**
     * get the flag indicating if the board is restricting the rotation
     */
    get restrictRotation(): boolean{
        return this._camera.restrictRotationFromGesture;
    }

    /**
     * set the flag indicating if the board is restricting the rotation
     */
    set restrictRotation(value: boolean){
        if(value){
            this._camera.lockRotationFromGesture();
        } else {
            this._camera.releaseLockOnRotationFromGesture();
        }
    }

    /**
     * get the flag indicating if the board is restricting the zoom
     */
    get restrictZoom(): boolean{
        return this._camera.restrictZoomFromGesture;
    }

    /**
     * set the flag indicating if the board is restricting the zoom
     */
    set restrictZoom(value: boolean){
        if(value){
            this._camera.lockZoomFromGesture();
        } else {
            this._camera.releaseLockOnZoomFromGesture();
        }
    }

    /**
     * get the flag indicating if the board is restricting the relative x translation
     */
    get restrictRelativeXTranslation(): boolean{
        return this._camera.restrictRelativeXTranslationFromGesture;
    }

    /**
     * set the flag indicating if the board is restricting the relative x translation
     */
    set restrictRelativeXTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeXTranslationFromGesture();
        }
    }

    /**
     * get the flag indicating if the board is restricting the relative y translation
     */
    get restrictRelativeYTranslation(): boolean{
        return this._camera.restrictRelativeYTranslationFromGesture;
    }

    /**
     * set the flag indicating if the board is restricting the relative y translation
     */
    set restrictRelativeYTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeYTranslationFromGesture();
        }
    }

    /**
     * get the half of the maximum translation height the board is allowing for the camera to move
     */
    get maxHalfTransHeight(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.y != undefined && boundaries.max.y != undefined){
            return (boundaries.max.y - boundaries.min.y) / 2;
        }
        return undefined;
    }

    /**
     * set the half of the maximum translation height the board is allowing for the camera to move
     */
    set maxHalfTransHeight(value: number){
        this._camera.setVerticalBoundaries(-value, value);
    }

    /**
     * get the half of the maximum translation width the board is allowing for the camera to move
     */
    get maxHalfTransWidth(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.x != undefined && boundaries.max.x != undefined){
            return (boundaries.max.x - boundaries.min.x) / 2;
        }
        return undefined;
    }
    
    /**
     * set the half of the maximum translation width the board is allowing for the camera to move
     */
    set maxHalfTransWidth(value: number){
        this._camera.setHorizontalBoundaries(-value, value);
    }

    /**
     * Get the flag indicating if the board is in debug mode
     */
    get debugMode(): boolean{
        return this._debugMode;
    }

    /**
     * Set the flag indicating if the board is in debug mode
     */
    set debugMode(value: boolean){
        this._debugMode = value;
    }

    /**
     * Get the internal camera the board is using
     */
    get camera(): BoardCamera{
        return this._camera;
    }

    /**
     * Set the current strategy the board is using for touch events 
     */ 
    set touchStrategy(strategy: BoardTouchStrategy){
        this._touchStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._touchStrategy = strategy;
        this._touchStrategy.setUp();
    }

    /**
     * Get the current strategy the board is using for touch events 
     */
    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    /**
     * Set the current strategy the board is using for trackpad events
     */
    set trackpadStrategy(strategy: BoardTrackpadStrategy){
        this._trackpadStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._trackpadStrategy = strategy;
        this._trackpadStrategy.setUp();
    }

    /**
     * Get the current strategy the board is using for trackpad events
     */
    get trackpadStrategy(): BoardTrackpadStrategy{
        return this._trackpadStrategy;
    }

    /**
     * Set the current strategy the board is using for keyboard and mouse events
     */
    set keyboardMouseStrategy(strategy: BoardKMStrategy){
        this._keyboardMouseStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._keyboardMouseStrategy = strategy;
        this._keyboardMouseStrategy.setUp();
    }

    /**
     * Get the current strategy the board is using for keyboard and mouse events
     */
    get keyboardMouseStrategy(): BoardKMStrategy{
        return this._keyboardMouseStrategy;
    }

    /**
     * Set the current strategy the board is using for camera events; currently this has no effect
     */
    set verticalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._verticalGridSize = value;
    }

    /**
     * Get the current strategy the board is using for camera events; currently this property has no effect
     */
    get verticalGridSize(): number{
        return this._verticalGridSize;
    }

    /**
     * Set the current strategy the board is using for camera events; currently this property has no effect
     */
    set horizontalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._horizontalGridSize = value;
    }

    /**
     * Get the current strategy the board is using for camera events; currently this property has no effect
     */
    get horizontalGridSize(): number{
        return this._horizontalGridSize;
    }

    /**
     * Set the flag indicating if the board is displaying the grid
     */
    get displayGrid(): boolean{
        return this._displayGrid;
    }

    /**
     * Get the flag indicating if the board is displaying the grid
     */
    set displayGrid(value: boolean){
        this._displayGrid = value;
    }

    /**
     * Get the flag indicating if the board is displaying the ruler
     */
    get displayRuler(): boolean{
        return this._displayRuler;
    }

    /**
     * Set the flag indicating if the board is displaying the ruler
     */
    set displayRuler(value: boolean){
        this._displayRuler = value;
    }

    /**
     * @translation Set the flag indicating if the board is limiting the entire view port; this will set the input strategy's limitEntireViewPort property as well
     */
    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
        this._trackpadStrategy.limitEntireViewPort = value;
        this._touchStrategy.limitEntireViewPort = value;
        this._keyboardMouseStrategy.limitEntireViewPort = value;
        if(value){
            this.adjustZoomLevelBaseOnDimensions();
        }
    }

    /**
     * Get the flag indicating if the board is limiting the entire view port
     */
    get limitEntireViewPort(): boolean{
        return this._limitEntireViewPort;
    }

    /**
     * Bind the function to the class (mainly the event listensers and the step function; those used as the callback for the event listeners and requestAnimationFrame)
     */
    bindFunctions(){
        this.step = this.step.bind(this);
        this.windowResizeHandler = this.windowResizeHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
    }

    adjustZoomLevelBaseOnDimensions(){
        const minZoomLevelHeight = this._canvas.height / (this.maxHalfTransHeight * 2);
        const minZoomLevelWidth = this._canvas.width / (this.maxHalfTransWidth * 2);
        const minZoomLevel = Math.min(minZoomLevelHeight, minZoomLevelWidth);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    adjustZoomLevelBoundsBaseOnWidth(){
        const minZoomLevel = this._canvas.width / (this.maxHalfTransWidth * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    adjustZoomLevelBoundsBaseOnHeight(){
        const minZoomLevel = this._canvas.height / (this.maxHalfTransHeight * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    /**
     * @deprecated This is a residue function after migrating from the custom web component to the board class
     */
    disconnectedCallback(){
        if(!this._handOverStepControl){
            cancelAnimationFrame(this.requestRef);
        }
        this.removeEventListeners();
    }

    /**
     * This function can be passed directly to the requestAnimationFrame to enable the extra functionalities of a board. (Or be called to step the board in a custom step function)
     * @param timestamp the time stamp from the requestAnimationFrame
     */
    private step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        // this._canvas.width = this._canvas.width;
        // this._canvas.height = this._canvas.height;
        this._context.resetTransform();
        this._context.clearRect(-this.maxHalfTransWidth, -this.maxHalfTransHeight, this.maxHalfTransWidth * 2, this.maxHalfTransHeight * 2);

        this._context.translate( this._canvas.width / 2, this._canvas.height / 2 );
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
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler);
    }

    removeEventListeners(){
        this._trackpadStrategy.tearDown();
        this._touchStrategy.tearDown();
        this._keyboardMouseStrategy.tearDown();
        this._canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this._canvas.removeEventListener('pointerdown', this.pointerDownHandler);
    }

    /**
     * 
     * @param e 
     * @listens pointermove
     */
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

    drawAxis(context: CanvasRenderingContext2D, zoomLevel: number): void{
        context.lineWidth = 1 / zoomLevel;
        // y axis
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(0, -this.maxHalfTransHeight);
        context.stroke();
        
        // x axis
        context.beginPath();
        context.strokeStyle = `rgba(220, 59, 59, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(this.maxHalfTransWidth, 0);
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
        context.roundRect(-this.maxHalfTransWidth, -this.maxHalfTransHeight, this.maxHalfTransWidth * 2, this.maxHalfTransHeight * 2, 5);
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
       
        let divisorInActualPixel = divisor * this._camera.getZoomLevel();
        let halfDivisorInActualPixel = halfDivisor * this._camera.getZoomLevel();
        let subDivisorInActualPixel = subDivisor * this._camera.getZoomLevel();

        
        context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
        const midBaseLineTextDimensions = context.measureText(`${-(halfDivisor + minHorizontalMediumTick)}`);
        const midBaseLineHeight =  midBaseLineTextDimensions.fontBoundingBoxAscent + midBaseLineTextDimensions.fontBoundingBoxDescent;
        const subBaseLineTextDimensions = context.measureText(`${-(subDivisor + minHorizontalSmallTick)}`);
        const subBaseLineHeight = subBaseLineTextDimensions.fontBoundingBoxAscent + subBaseLineTextDimensions.fontBoundingBoxDescent;

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
            context.font = `${15 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(halfDivisorInActualPixel > midBaseLineTextDimensions.width * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
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
            context.font = `${18 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(halfDivisorInActualPixel > midBaseLineHeight * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
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
            context.font = `${10 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(subDivisorInActualPixel > subBaseLineTextDimensions.width * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
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
            context.font = `${12 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(subDivisorInActualPixel > subBaseLineHeight * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
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
        if (this._handOverStepControl){
            return this.step.bind(this);
        } else {
            return null;
        }
    }

    getContext(): CanvasRenderingContext2D{
        return this._context;
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

    windowResizeHandler(){
        if(this._fullScreenFlag){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }
}
