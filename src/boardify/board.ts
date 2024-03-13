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
 * @translation Default Export of the @niuee/board package 
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

    /**
     * @translation The observer mainly for the width and height of the canvas element
     */
    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;

    /**
     * @translation Board constructor
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
     * @translation Responsible for when the width and height of the canvas changes updating the camera's view port width and height (syncing the two) 
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
     * @group Attribute
     * @translation get the flag indicating if the board is in full screen mode
     */
    get fullScreen(): boolean {
        return this._fullScreenFlag;
    }

    /**
     * @translation set the flag indicating if the board is in full screen mode; this will also effect the width and height of the canvas
     */
    set fullScreen(value: boolean) {
        this._fullScreenFlag = value;
        if(this._fullScreenFlag){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }

    /**
     * @group Attribute
     * @translation get the width of the canvas element the board is attached to
     */
    get width(): number {
        return this._canvas.width;
    }

    /**
     * 
     * @translation set the width of the canvas element the board is attached to; if the width cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated
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
     * @group Attribute
     * @translation get the height of the canvas element the board is attached to
     */
    get height(): number {
        return this._canvas.height;
    }

    /**
     * @translation set the height of the canvas element the board is attached to; if the height cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated
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
     * 
     * @translation get the flag indicating if the board is handing over the control of the step function
     */
    set stepControl(value: boolean){
        this._handOverStepControl = value;
    }

    /**
     * @translation set the flag indicating if the board is handing over the control of the step function
     */
    get stepControl(): boolean{ 
        return this._handOverStepControl;
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the x translation
     */
    get restrictXTranslation(): boolean{ 
        return this._camera.restrictXTranslationFromGesture;
    }
    
    /**
     * 
     * @translation set the flag indicating if the board is restricting the x translation
     */
    set restrictXTranslation(value: boolean){
        if(value){
            this._camera.lockXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnXTranslationFromGesture();
        }
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the y translation
     */
    get restrictYTranslation(): boolean{
        return this._camera.restrictYTranslationFromGesture;
    }

    /**
     * @group Restriction
     * @translation set the flag indicating if the board is restricting the y translation
     */
    set restrictYTranslation(value: boolean){
        if(value){
            this._camera.lockYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnYTranslationFromGesture();
        }
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the rotation
     */
    get restrictRotation(): boolean{
        return this._camera.restrictRotationFromGesture;
    }

    /**
     * @translation set the flag indicating if the board is restricting the rotation
     */
    set restrictRotation(value: boolean){
        if(value){
            this._camera.lockRotationFromGesture();
        } else {
            this._camera.releaseLockOnRotationFromGesture();
        }
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the zoom
     */
    get restrictZoom(): boolean{
        return this._camera.restrictZoomFromGesture;
    }

    /**
     * @translation set the flag indicating if the board is restricting the zoom
     */
    set restrictZoom(value: boolean){
        if(value){
            this._camera.lockZoomFromGesture();
        } else {
            this._camera.releaseLockOnZoomFromGesture();
        }
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the relative x translation
     */
    get restrictRelativeXTranslation(): boolean{
        return this._camera.restrictRelativeXTranslationFromGesture;
    }

    /**
     * @translation set the flag indicating if the board is restricting the relative x translation
     */
    set restrictRelativeXTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeXTranslationFromGesture();
        }
    }

    /**
     * @group Restriction
     * @translation get the flag indicating if the board is restricting the relative y translation
     */
    get restrictRelativeYTranslation(): boolean{
        return this._camera.restrictRelativeYTranslationFromGesture;
    }

    /**
     * @translation set the flag indicating if the board is restricting the relative y translation
     */
    set restrictRelativeYTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeYTranslationFromGesture();
        }
    }

    /**
     * @group Attribute
     * @translation get the half of the maximum translation height the board is allowing for the camera to move
     */
    get maxHalfTransHeight(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.y != undefined && boundaries.max.y != undefined){
            return (boundaries.max.y - boundaries.min.y) / 2;
        }
        return undefined;
    }

    /**
     * @translation set the half of the maximum translation height the board is allowing for the camera to move
     */
    set maxHalfTransHeight(value: number){
        this._camera.setVerticalBoundaries(-value, value);
    }

    /**
     * @group Attribute
     * @translation get the half of the maximum translation width the board is allowing for the camera to move
     */
    get maxHalfTransWidth(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.x != undefined && boundaries.max.x != undefined){
            return (boundaries.max.x - boundaries.min.x) / 2;
        }
        return undefined;
    }
    
    /**
     * @translation set the half of the maximum translation width the board is allowing for the camera to move
     */
    set maxHalfTransWidth(value: number){
        this._camera.setHorizontalBoundaries(-value, value);
    }

    /**
     * @group Debug Tools
     * @translation Get the flag indicating if the board is in debug mode
     */
    get debugMode(): boolean{
        return this._debugMode;
    }

    /**
     * @translation Set the flag indicating if the board is in debug mode
     */
    set debugMode(value: boolean){
        this._debugMode = value;
    }

    /**
     * @translation Get the internal camera the board is using
     */
    get camera(): BoardCamera{
        return this._camera;
    }

    /**
     * @group Control Strategy
     * @translation Set the current strategy the board is using for touch events 
     */ 
    set touchStrategy(strategy: BoardTouchStrategy){
        this._touchStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._touchStrategy = strategy;
        this._touchStrategy.setUp();
    }

    /**
     * @translation Get the current strategy the board is using for touch events 
     */
    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    /**
     * @group Control Strategy
     * @translation Set the current strategy the board is using for trackpad events
     */
    set trackpadStrategy(strategy: BoardTrackpadStrategy){
        this._trackpadStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._trackpadStrategy = strategy;
        this._trackpadStrategy.setUp();
    }

    /**
     * @group Control Strategy
     * @translation Get the current strategy the board is using for trackpad events
     */
    get trackpadStrategy(): BoardTrackpadStrategy{
        return this._trackpadStrategy;
    }

    /**
     * @translation Set the current strategy the board is using for keyboard and mouse events
     */
    set keyboardMouseStrategy(strategy: BoardKMStrategy){
        this._keyboardMouseStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._keyboardMouseStrategy = strategy;
        this._keyboardMouseStrategy.setUp();
    }

    /**
     * @group Control Strategy
     * @translation Get the current strategy the board is using for keyboard and mouse events
     */
    get keyboardMouseStrategy(): BoardKMStrategy{
        return this._keyboardMouseStrategy;
    }

    /**
     * @translation Set the current strategy the board is using for camera events; currently this has no effect
     */
    set verticalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._verticalGridSize = value;
    }

    /**
     * @group Debug Tools
     * @translation Get the current strategy the board is using for camera events; currently this property has no effect
     */
    get verticalGridSize(): number{
        return this._verticalGridSize;
    }

    /**
     * @group Debug Tools
     * @translation Set the current strategy the board is using for camera events; currently this property has no effect
     */
    set horizontalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._horizontalGridSize = value;
    }

    /**
     * @group Debug Tools
     * @translation Get the current strategy the board is using for camera events; currently this property has no effect
     */
    get horizontalGridSize(): number{
        return this._horizontalGridSize;
    }

    /**
     * @group Debug Tools
     * @translation Set the flag indicating if the board is displaying the grid
     */
    get displayGrid(): boolean{
        return this._displayGrid;
    }

    /**
     * @translation Get the flag indicating if the board is displaying the grid
     */
    set displayGrid(value: boolean){
        this._displayGrid = value;
    }

    /**
     * @group Debug Tools
     * @translation Get the flag indicating if the board is displaying the ruler
     */
    get displayRuler(): boolean{
        return this._displayRuler;
    }

    /**
     * @translation Set the flag indicating if the board is displaying the ruler
     */
    set displayRuler(value: boolean){
        this._displayRuler = value;
    }

    /**
     * @group Attribute
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
     * @translation Get the flag indicating if the board is limiting the entire view port
     */
    get limitEntireViewPort(): boolean{
        return this._limitEntireViewPort;
    }

    /**
     * @translation Bind the function to the class (mainly the event listensers and the step function; those used as the callback for the event listeners and requestAnimationFrame)
     */
    bindFunctions(){
        this.step = this.step.bind(this);
        this.windowResizeHandler = this.windowResizeHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
    }

    /**
     * @group Zoom Level
     * @translation The callback function for the window resize event
     */
    adjustZoomLevelBaseOnDimensions(){
        const minZoomLevelHeight = this._canvas.height / (this.maxHalfTransHeight * 2);
        const minZoomLevelWidth = this._canvas.width / (this.maxHalfTransWidth * 2);
        const minZoomLevel = Math.min(minZoomLevelHeight, minZoomLevelWidth);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    /**
     * @group Zoom Level
     * @translation Adjust the zoom level bounds based on the width of the canvas
     */
    adjustZoomLevelBoundsBaseOnWidth(){
        const minZoomLevel = this._canvas.width / (this.maxHalfTransWidth * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    /**
     * @group Zoom Level
     * @translation Adjust the zoom level bounds based on the height of the canvas
     */
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
     * @translation This function can be passed directly to the requestAnimationFrame to enable the extra functionalities of a board. (Or be called to step the board in a custom step function)
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

    /**
     * @translation Register the event listeners this is called in the constructor; This is also where the board setup the control input strategies
     * */
    registerEventListeners(){
        this._trackpadStrategy.setUp();
        this._touchStrategy.setUp();
        this._keyboardMouseStrategy.setUp();
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler);
    }

    /**
     * @translation Remove the event listeners; This is called in the disconnectedCallback; this is for easier clean up if you're using frontend frameworks
     * that maange the lifecycle of the component
     */
    removeEventListeners(){
        this._trackpadStrategy.tearDown();
        this._touchStrategy.tearDown();
        this._keyboardMouseStrategy.tearDown();
        this._canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this._canvas.removeEventListener('pointerdown', this.pointerDownHandler);
    }

    /**
     * @translation This is only for demonstration purposes.
     * @param e 
     * @listens pointermove
     */
    pointerMoveHandler(e: PointerEvent){
        this.mousePos = {x: e.clientX, y: e.clientY}; 
    }

    /**
     * @translation This is only for demonstration purposes.
     * @param e 
     */
    pointerDownHandler(e: PointerEvent) {
        console.log("clicked at", this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY}));
    }

    /**
     * @translation This was used in the legacy way to handle inputs from user for the panning, zooming and rotating to work.
     * @param bottomLeftCorner 
     * @returns 
     */
    getCoordinateConversionFn(bottomLeftCorner: Point): (interestPoint: Point)=>Point{
        const conversionFn =  (interestPoint: Point)=>{
            const viewPortPoint = PointCal.flipYAxis(PointCal.subVector(interestPoint, bottomLeftCorner));
            return viewPortPoint;
        }
        return conversionFn;
    }

    /**
     * @group Internal Attributes
     * @translation Get the internal canvas element this board is attached to.
     * @returns the internal canvas element
     */
    getInternalCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    /**
     * @group Internal Attributes 
     * @translation Get the internal camera
     */
    getCamera(): BoardCamera {
        return this._camera;
    }

    /**
     * @translation This is to convert a point in a window coordinate to view port coordinate
     * @param bottomLeftCornerOfCanvas 
     * @param clickPointInWindow 
     * @returns 
     */
    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }

    /**
     * @translation This is to convert a point in a window coordinate (directly returned by the mouse event top left corner is (0, 0)) to world coordinate
     * @param clickPointInWindow 
     * @returns 
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
        return this._camera.convert2WorldSpace(pointInCameraViewPort);
    }

    /**
     * @group Debug Tools
     * @translation Draw the X and Y axis starting from the origin to the max translation height and width
     * @param context 
     * @param zoomLevel 
     */
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

    /**
     * @group Debug Tools
     * @translation Draw a green circle at the given position
     * @param context 
     * @param pos 
     */
    drawReferenceCircle(context: CanvasRenderingContext2D, pos: Point): void {
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        // context.moveTo(pos.x, -pos.y);
        context.arc(pos.x, -pos.y, 5, 0, 2 * Math.PI);
        context.stroke();
    }

    /**
     * @group Debug Tools
     * @translation Draw a blue bounding box at the max translation height and width
     * @param context 
     */
    drawBoundingBox(context: CanvasRenderingContext2D): void{
        context.beginPath();
        context.strokeStyle = "blue";
        context.lineWidth = 100;
        context.roundRect(-this.maxHalfTransWidth, -this.maxHalfTransHeight, this.maxHalfTransWidth * 2, this.maxHalfTransHeight * 2, 5);
        context.stroke();
        context.lineWidth = 3;
    }

    /**
     * @group Debug Tools
     * @translation Draw a cross hair at the given position
     * @param context 
     * @param pos 
     * @param size 
     * @param color 
     */
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

    /**
     * @group Debug Tools
     * @translation Draw a cross hair at the center of the camera (which is the center of the view port aka the canvas element)
     */
    drawCameraCenterWithCrossHair(context: CanvasRenderingContext2D, size: number): void{
        let pos = this._camera.getPosition();
        this.drawCrossHair(context, pos, size, "teal");
        this.drawPositionText(context, pos, 20, "teal");
    }

    /**
     * @group Debug Tools
     * @translation Draw a grid on to the canvas with dynamic width and height
     */
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

    /**
     * @group Debug Tools
     * @translation Draw rulers in both the horizontal and vertical direction marking the cooridnates; the width and height are aligned with the grid.
     * @param context 
     */
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

    /**
     * @group Debug Tools
     * @translation Draw a position text at the given position
     * @param context 
     * @param pos 
     * @param offset 
     * @param color 
     */
    drawPositionText(context: CanvasRenderingContext2D, pos: Point, offset: number, color: string="red"): void{
        offset = offset / this._camera.getZoomLevel();
        context.font = `${20 / this._camera.getZoomLevel()}px Arial`;
        context.fillStyle = color;
        context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + offset, -pos.y - offset);
    }

    /**
     * @group Camera Control
     * @translation Reset the camera to the default position and zoom level. This is soon to be deprecated
     */
    resetCamera(){
        this._camera.resetCameraWithAnimation();
    }

    /**
     * @group Camera Control
     * @translation Spin camera to a certain angle with animation. This is soon to be deprecated.
     */
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

    /**
     * @group Camera Control
     * @translation Subscribe to the camera update event. The events fire only when the camera is actually move not the when the command is issued.
     * @param eventName 
     * @param callback 
     */
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
