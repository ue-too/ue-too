import BoardCamera from "src/board-camera";
import { Point } from "src";
import { PointCal } from "point2point";
import { BoardTouchStrategy, OneFingerPanTwoFingerZoom } from "src/touch-strategy";
import { BoardKMTStrategy, DefaultBoardKMTStrategy } from "src/kmt-strategy";
import { CameraState, CameraEventMapping } from "src/camera-observer";

import { calculateOrderOfMagnitude } from "src/util";

/**
 * @category Board
 * @translationBlock Usage
 * ```typescript
 * import { Board } from "@niuee/board";
 * 
 * // or however you prefer to get a canvas element that is already in the DOM
 * const canvasElement = document.querySelector("canvas") as HTMLCanvasElement;
 * const board = new Board(canvasElement);
 * 
 * const stepFn = board.getStepFunction(); 
 * const context = board.getContext();
 * 
 * function step(timestamp: number){
 *    stepFn(timestamp);
 * // do other stuff after the board has stepped
 * //.
 * //.
 * //.
 * }
 * ```
 * @translationBlock Alternatively you can import the board class as from a subdirectory; this shaves the bundle size a bit but not a lot though.
 * 
 * ```typescript
 * import {Board} from "@niuee/board/boardify";
 * ```
 */
export default class BoardStaticContext {
    
    private _fullScreenFlag: boolean = false;

    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;

    private _camera: BoardCamera;

    private requestRef: number;
    private _handOverStepControl: boolean = true;
    private lastUpdateTime: number;

    private _touchStrategy: BoardTouchStrategy;
    private _keyboardMouseTrackpadStrategy: BoardKMTStrategy;

    private _limitEntireViewPort: boolean = true;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    private _verticalGridSize: number = 0;
    private _horizontalGridSize: number = 0;

    private _displayGrid: boolean = false;
    private _displayRuler: boolean = false;
    private _alignCoordinateSystem: boolean = true;

    /**
     * @translation The observer mainly for the width and height of the canvas element
     */
    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;

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

        this.bindFunctions();

        this._touchStrategy = new OneFingerPanTwoFingerZoom(this._canvas, this._camera, this._limitEntireViewPort, this._alignCoordinateSystem);
        this._keyboardMouseTrackpadStrategy = new DefaultBoardKMTStrategy(this._canvas, this._camera, this._limitEntireViewPort, this._alignCoordinateSystem);

        this._debugMode = false;

        this.attributeObserver = new MutationObserver(this.attributeCallBack);
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
                    if(this._limitEntireViewPort && this.maxHalfTransHeight != undefined){
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
     * @accessorDescription Toggle full screen mode.
     * 
     * what happen to second line.
     * ```typescript
     * const board = new Board(canvasElement);
     * ```
     */
    get fullScreen(): boolean {
        return this._fullScreenFlag;
    }

    set fullScreen(value: boolean) {
        this._fullScreenFlag = value;
        if(this._fullScreenFlag){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }

    /**
     * @group Attribute
     * @accessorDescription Align the coordinate system to the canvas element; this is useful when you want to draw on the canvas element directly.
     * The default is true.
     */
    get alignCoordinateSystem(): boolean{
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean){
        this._alignCoordinateSystem = value;
        this._keyboardMouseTrackpadStrategy.alignCoordinateSystem = value;
    }

    /**
     * @group Attribute
     * @accessorDescription The width of the canvas element the board is attached to. This stay in sync with the view port width of the camera.
     */
    get width(): number {
        return this._canvas.width;
    }

    /**
     * @translation If the width cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated.
     */
    set width(value: number) {
        this._canvas.width = value;
        this._camera.setViewPortWidth(value);
        if(this._limitEntireViewPort){
            this.adjustZoomLevelBaseOnDimensions();
        }
    }

    /**
     * @group Attribute
     * @accessorDescription The height of the canvas element the board is attached to. This stay in sync with the view port height of the camera. 
     */
    get height(): number {
        return this._canvas.height;
    }

    /**
     * @translation If the height cause the min zoom level to be greater than the current min zoom level, the min zoom level will be updated.
     */
    set height(value: number) {
        this._canvas.height = value;
        this._camera.setViewPortHeight(value);
        if(this._limitEntireViewPort){
            this.adjustZoomLevelBaseOnDimensions();
        }
    }

    /**
     * @accessorDescription The flag for step control handover. If this is set to true, the board will not call requestAnimationFrame by itself.
     * The default is false.
     */
    set stepControl(value: boolean){
        this._handOverStepControl = value;
    }

    get stepControl(): boolean{ 
        return this._handOverStepControl;
    }

    /**
     * @group Restriction
     * @accessorDescription The flag indicating if the board is restricting the x translation.
     */
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

    /**
     * @group Restriction
     * @accessorDescription The flag indicating if the board is restricting the y translation.
     */
    get restrictYTranslation(): boolean{
        return this._camera.restrictYTranslationFromGesture;
    }

    /**
     * @group Restriction
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
     * @accessorDescription The flag indicating if the board is restricting the rotation.
     */
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

    /**
     * @group Restriction
     * @accessorDescription The flag indicating if the board is restricting the zoom.
     */
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

    /**
     * @group Restriction
     * @accessorDescription The flag indicating if the board is restricting the relative x translation.
     */
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

    /**
     * @group Restriction
     * @accessorDescription The flag indicating if the board is restricting the relative y translation.
     */
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

    /**
     * @group Attribute
     * @accessorDescription The half of the maximum translation height the board is allowing for the camera to move.
     */
    get maxHalfTransHeight(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.y != undefined && boundaries.max.y != undefined){
            return (boundaries.max.y - boundaries.min.y) / 2;
        }
        return undefined;
    }

    set maxHalfTransHeight(value: number){
        this._camera.setVerticalBoundaries(-value, value);
        if(this._limitEntireViewPort){
            this.adjustZoomLevelBoundsBaseOnHeight();
        }
    }

    setMaxTransHeightAlignedMax(value: number){
        const curBoundaries = this._camera.getBoundaries();
        const curMax = curBoundaries == undefined ? undefined: curBoundaries.max;
        const curVerticalMax = curMax == undefined ? undefined: curMax.y;
        if(curVerticalMax == undefined){
            this._camera.setVerticalBoundaries(-value, value);
        } else {
            this._camera.setVerticalBoundaries(curVerticalMax - value * 2, curVerticalMax);
        }
        this.adjustZoomLevelBoundsBaseOnHeight();
    }

    setMaxTransHeightAlignedMin(value: number){
        const curBoundaries = this._camera.getBoundaries();
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curVerticalMin = curMin == undefined ? undefined: curMin.y;
        if(curVerticalMin == undefined){
            this._camera.setVerticalBoundaries(-value, value);
        } else {
            this._camera.setVerticalBoundaries(curVerticalMin, curVerticalMin + value * 2);
        }
        this.adjustZoomLevelBoundsBaseOnHeight();
    }

    setMaxTransWidthAlignedMax(value: number){
        const curBoundaries = this._camera.getBoundaries();
        const curMax = curBoundaries == undefined ? undefined: curBoundaries.max;
        const curHorizontalMax = curMax == undefined ? undefined: curMax.x;
        if(curHorizontalMax == undefined){
            this._camera.setHorizontalBoundaries(-value, value);
        } else {
            this._camera.setHorizontalBoundaries(curHorizontalMax - value * 2, curHorizontalMax);
        }
        this.adjustZoomLevelBoundsBaseOnWidth();
    }

    setMaxTransWidthAlignedMin(value: number){
        const curBoundaries = this._camera.getBoundaries();
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curHorizontalMin = curMin == undefined ? undefined: curMin.x;
        if(curHorizontalMin == undefined){
            this._camera.setHorizontalBoundaries(-value, value);
        } else {
            this._camera.setHorizontalBoundaries(curHorizontalMin, curHorizontalMin + value * 2);
        }
        this.adjustZoomLevelBoundsBaseOnWidth();
    }

    /**
     * @group Attribute
     * @accessorDescription The half of the maximum translation width the board is allowing for the camera to move.
     */
    get maxHalfTransWidth(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.x != undefined && boundaries.max.x != undefined){
            return (boundaries.max.x - boundaries.min.x) / 2;
        }
        return undefined;
    }
    
    set maxHalfTransWidth(value: number){
        this._camera.setHorizontalBoundaries(-value, value);
    }

    /**
     * @group Debug Tools
     * @accessorDescription The flag indicating if the board is in debug mode.
     */
    get debugMode(): boolean{
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
        this._keyboardMouseTrackpadStrategy.debugMode = value;
    }

    /**
     * @accessorDescription The camera for the board
     */
    get camera(): BoardCamera{
        return this._camera;
    }

    /**
     * @group Control Strategy
     * @accessorDescription The current strategy the board is using for touch events 
     */ 
    set touchStrategy(strategy: BoardTouchStrategy){
        this._touchStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._touchStrategy = strategy;
        this._touchStrategy.setUp();
    }

    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    /**
     * @group Control Strategy
     * @accessorDescription The current strategy the board is using for keyboard and mouse events
     */
    set keyboardMouseTrackpadStrategy(strategy: BoardKMTStrategy){
        this._keyboardMouseTrackpadStrategy.tearDown();
        strategy.limitEntireViewPort = this._limitEntireViewPort;
        this._keyboardMouseTrackpadStrategy = strategy;
        this._keyboardMouseTrackpadStrategy.setUp();
    }

    get keyboardMouseTrackpadStrategy(): BoardKMTStrategy{
        return this._keyboardMouseTrackpadStrategy;
    }

    /**
     * @group Debug Tools
     * @accessorDescription The gap size between the horizontal lines of the grid. Currently has no effect.
     */
    set verticalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._verticalGridSize = value;
    }

    get verticalGridSize(): number{
        return this._verticalGridSize;
    }

    /**
     * @group Debug Tools
     * @accessorDescription The gap size between the vertical lines of the grid. Currently has no effect.
     */
    set horizontalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._horizontalGridSize = value;
    }

    get horizontalGridSize(): number{
        return this._horizontalGridSize;
    }

    /**
     * @group Debug Tools
     * @accessorDescription The flag indicating if the board is displaying the grid
     */
    get displayGrid(): boolean{
        return this._displayGrid;
    }

    set displayGrid(value: boolean){
        this._displayGrid = value;
    }

    /**
     * @group Debug Tools
     * @accessorDescription The flag indicating if the board is displaying the ruler
     */
    get displayRuler(): boolean{
        return this._displayRuler;
    }

    set displayRuler(value: boolean){
        this._displayRuler = value;
    }

    /**
     * @group Attribute
     * @accessorDescription The flag indicating if the board is limiting the entire view port; this will set the input strategy's limitEntireViewPort property as well
     */
    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
        this._touchStrategy.limitEntireViewPort = value;
        this._keyboardMouseTrackpadStrategy.limitEntireViewPort = value;
        if(value){
            this.adjustZoomLevelBaseOnDimensions();
        }
    }

    get limitEntireViewPort(): boolean{
        return this._limitEntireViewPort;
    }

    /**
     * @translation Bind the function to the class (mainly the event listensers and the step function; those used as the callback for the event listeners and requestAnimationFrame)
     */
    bindFunctions(){
        this.step = this.step.bind(this);
        this.windowResizeHandler = this.windowResizeHandler.bind(this);
        this.attributeCallBack = this.attributeCallBack.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
    }

    /**
     * @group Zoom Level
     * @translation The callback function for the window resize event
     */
    adjustZoomLevelBaseOnDimensions(){
        const width = this.maxHalfTransWidth * 2;
        const height = this.maxHalfTransHeight * 2;
        const widthWidthProjection = Math.abs(width * Math.cos(this._camera.getRotation()));
        const heightWidthProjection = Math.abs(height * Math.cos(this._camera.getRotation()));
        const widthHeightProjection = Math.abs(width * Math.sin(this._camera.getRotation()));
        const heightHeightProjection = Math.abs(height * Math.sin(this._camera.getRotation()));
        const minZoomLevelWidthWidth = this._canvas.width / widthWidthProjection;
        const minZoomLevelHeightWidth = this._canvas.width / heightWidthProjection;
        const minZoomLevelWidthHeight = this._canvas.height / widthHeightProjection;
        const minZoomLevelHeightHeight = this._canvas.height / heightHeightProjection;

        const minZoomLevelHeight = this._canvas.height / (this.maxHalfTransHeight * 2);
        const minZoomLevelWidth = this._canvas.width / (this.maxHalfTransWidth * 2);
        const minZoomLevel = Math.max(minZoomLevelHeight, minZoomLevelWidth, minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
            console.log("min zoom level set to", this._camera.getZoomLevelLimits().min);
        }
    }

    /**
     * @group Zoom Level
     * @translation Adjust the zoom level bounds based on the width of the canvas
     */
    adjustZoomLevelBoundsBaseOnWidth(){
        if(this.maxHalfTransWidth == undefined){
            console.log("due to maxHalfTransWidth not being set, the zoom level bounds cannot be adjusted based on the width of the canvas");
            return;
        }
        const widthWidthProjection = Math.abs(this.maxHalfTransWidth * 2 * Math.cos(this._camera.getRotation()));
        const widthHeightProjection = Math.abs(this.maxHalfTransWidth * 2 * Math.sin(this._camera.getRotation()));
        const minZoomLevel = Math.max(this._canvas.width / widthWidthProjection, this._canvas.height / widthHeightProjection);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    /**
     * @group Zoom Level
     * @translation Adjust the zoom level bounds based on the height of the canvas
     */
    adjustZoomLevelBoundsBaseOnHeight(){
        if(this.maxHalfTransHeight == undefined){
            return;
        }
        const heightWidthProjection = Math.abs(this.maxHalfTransHeight * 2 * Math.cos(this._camera.getRotation()));
        const heightHeightProjection = Math.abs(this.maxHalfTransHeight * 2 * Math.sin(this._camera.getRotation()));
        const minZoomLevelHeightWidth = this._canvas.width / heightWidthProjection;
        const minZoomLevelHeightHeight = this._canvas.height / heightHeightProjection;
        const minZoomLevel = Math.max(minZoomLevelHeightWidth, minZoomLevelHeightHeight);

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
        this.windowResizeObserver.disconnect();
        this.attributeObserver.disconnect();
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
        this._context.reset();
        const curBoundaries = this._camera.getBoundaries();
        this._context.clearRect(curBoundaries.min.x, -curBoundaries.min.y, this.maxHalfTransWidth * 2, -this.maxHalfTransHeight * 2);

        this._context.translate( this._canvas.width / 2, this._canvas.height / 2 );
        this._context.scale(this._camera.getZoomLevel(), this._camera.getZoomLevel());
        if (this._alignCoordinateSystem){
            this._context.rotate(-this._camera.getRotation());
            this._context.translate(-this._camera.getPosition().x,  -this._camera.getPosition().y);
        } else {
            this._context.rotate(this._camera.getRotation());
            this._context.translate(-this._camera.getPosition().x,  this._camera.getPosition().y);
        }

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
        this._touchStrategy.setUp();
        this._keyboardMouseTrackpadStrategy.setUp();
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler);
    }

    /**
     * @translation Remove the event listeners; This is called in the disconnectedCallback; this is for easier clean up if you're using frontend frameworks
     * that maange the lifecycle of the component
     */
    removeEventListeners(){
        this._touchStrategy.tearDown();
        this._keyboardMouseTrackpadStrategy.tearDown();
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
        console.log("clicked at", PointCal.flipYAxis(this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY})));
        console.log("camera boundaries", this._camera.getBoundaries());
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
        if(this._alignCoordinateSystem) {
            return {x: res.x, y: res.y};
        } else {
            return {x: res.x, y: -res.y};
        }
    }

    /**
     * @translation This is to convert a point in a window coordinate (directly returned by the mouse event top left corner is (0, 0)) to world coordinate
     * @param clickPointInWindow 
     * @returns 
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        if(this._alignCoordinateSystem){
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this._camera.convert2WorldSpace(pointInCameraViewPort);
        } else {
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this._camera.convert2WorldSpace(pointInCameraViewPort);
        }
    }

    /**
     * @group Debug Tools
     * @translation Draw the X and Y axis starting from the origin to the max translation height and width
     * @param context 
     * @param zoomLevel 
     */
    drawAxis(context: CanvasRenderingContext2D, zoomLevel: number): void{
        const curBoundaries = this._camera.getBoundaries();
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curMinX = curMin == undefined ? undefined: curMin.x;
        const curMinY = curMin == undefined ? undefined: curMin.y;
        if(curMinX == undefined || curMinY == undefined || this.maxHalfTransHeight == undefined || this.maxHalfTransWidth == undefined){
            return;
        }
        context.lineWidth = 1 / zoomLevel;
        // y axis
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        context.moveTo(0, 0);
        if(this._alignCoordinateSystem){
            context.lineTo(0, curMinY + (this.maxHalfTransHeight * 2));
        } else {
            context.lineTo(0, -curMinY - (this.maxHalfTransHeight * 2));
        }
        context.stroke();
        
        // x axis
        context.beginPath();
        context.strokeStyle = `rgba(220, 59, 59, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(curMinX + this.maxHalfTransWidth * 2, 0);
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
        if(this._alignCoordinateSystem){
            context.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
        } else {
            context.arc(pos.x, -pos.y, 5, 0, 2 * Math.PI);
        }
        context.stroke();
    }

    /**
     * @group Debug Tools
     * @translation Draw a blue bounding box at the max translation height and width
     * @param context 
     */
    drawBoundingBox(context: CanvasRenderingContext2D): void{
        const curBoundaries = this._camera.getBoundaries();
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curMinX = curMin == undefined ? undefined: curMin.x;
        const curMinY = curMin == undefined ? undefined: curMin.y;
        if(curMinX == undefined || curMinY == undefined || this.maxHalfTransHeight == undefined || this.maxHalfTransWidth == undefined){
            return;
        }
        context.beginPath();
        context.strokeStyle = "blue";
        context.lineWidth = 100;
        if(this._alignCoordinateSystem){
            context.roundRect(curMinX, curMinY, this.maxHalfTransWidth * 2, this.maxHalfTransHeight * 2, 5);
        } else {
            context.roundRect(curMinX, -curMinY, this.maxHalfTransWidth * 2, -this.maxHalfTransHeight * 2, 5);
        }
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
        if(this._alignCoordinateSystem){
            context.moveTo(pos.x - halfSize, pos.y);
            context.lineTo(pos.x + halfSize, pos.y);
            context.moveTo(pos.x, pos.y - halfSize);
            context.lineTo(pos.x, pos.y + halfSize);
        } else {
            context.moveTo(pos.x - halfSize, -pos.y);
            context.lineTo(pos.x + halfSize, -pos.y);
            context.moveTo(pos.x, -pos.y - halfSize);
            context.lineTo(pos.x, -pos.y + halfSize);
        }
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
        let minVerticalSmallTick = this._alignCoordinateSystem ? Math.floor(topLeftCorner.y / subDivisor) * subDivisor : Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = this._alignCoordinateSystem ? Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor : Math.floor(topLeftCorner.y / subDivisor) * subDivisor;;

        for(let i = minHorizontalSmallTick; i <= maxHorizontalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            if(this._alignCoordinateSystem){
                context.moveTo(i, topLeftCorner.y);
                context.lineTo(i, topLeftCorner.y + this.height / this._camera.getZoomLevel());
            } else {
                context.moveTo(i, -topLeftCorner.y);
                context.lineTo(i, -topLeftCorner.y + this.height / this._camera.getZoomLevel());
            }
            context.stroke();
        }
        for(let i = minVerticalSmallTick; i <= maxVerticalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            if(!this._alignCoordinateSystem){
                context.moveTo(topLeftCorner.x, -i);
                context.lineTo(topLeftCorner.x + this.width / this._camera.getZoomLevel(), -i);
            } else {
                context.moveTo(topLeftCorner.x, i);
                context.lineTo(topLeftCorner.x + this.width / this._camera.getZoomLevel(), i);
            }
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
        let minVerticalLargeTick = this._alignCoordinateSystem ? Math.ceil(topLeftCorner.y / divisor) * divisor : Math.floor(bottomLeftCorner.y / divisor) * divisor;
        let maxVerticalLargeTick = this._alignCoordinateSystem ? Math.floor(bottomLeftCorner.y / divisor) * divisor : Math.ceil(topLeftCorner.y / divisor) * divisor;
        let minHorizontalMediumTick = Math.ceil(topLeftCorner.x / halfDivisor) * halfDivisor;
        let maxHorizontalMediumTick = Math.floor(topRightCorner.x / halfDivisor) * halfDivisor;
        let minVerticalMediumTick = this._alignCoordinateSystem ? Math.ceil(topLeftCorner.y / halfDivisor) * halfDivisor : Math.floor(bottomLeftCorner.y / halfDivisor) * halfDivisor;
        let maxVerticalMediumTick = this._alignCoordinateSystem ? Math.floor(bottomLeftCorner.y / halfDivisor) * halfDivisor : Math.ceil(topLeftCorner.y / halfDivisor) * halfDivisor;
        let minHorizontalSmallTick = Math.ceil(topLeftCorner.x / subDivisor) * subDivisor;
        let maxHorizontalSmallTick = Math.floor(topRightCorner.x / subDivisor) * subDivisor;
        let minVerticalSmallTick = this._alignCoordinateSystem ? Math.ceil(topLeftCorner.y / subDivisor) * subDivisor : Math.floor(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = this._alignCoordinateSystem ? Math.floor(bottomLeftCorner.y / subDivisor) * subDivisor : Math.ceil(topLeftCorner.y / subDivisor) * subDivisor;
       
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
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -50 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(!this._alignCoordinateSystem){
                resPoint = PointCal.addVector(resPoint, {x: 0, y: -height / 2 - height * 0.2})
                context.fillText(`${i.toFixed(0)}`, resPoint.x , -resPoint.y);
            } else {
                resPoint = PointCal.addVector(resPoint, {x: 0, y: height / 2 + height * 0.2})
                context.fillText(`${i.toFixed(0)}`, resPoint.x , resPoint.y);
            }
            context.stroke();
        }
        for(let i = minVerticalLargeTick; i <= maxVerticalLargeTick; i += divisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 5 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -50 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 50 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            resPoint = PointCal.addVector(resPoint, {x: textDimensions.width / 2 + textDimensions.width * 0.3, y: 0});
            if(!this._alignCoordinateSystem){
                context.fillText(`${i.toFixed(0)}`, resPoint.x, -resPoint.y);
            } else {
                context.fillText(`${i.toFixed(0)}`, resPoint.x, resPoint.y);
            }
            context.stroke();
        }
        for(let i = minHorizontalMediumTick; i <= maxHorizontalMediumTick; i += halfDivisor){
            if(i % divisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 3 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 25 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -25 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.font = `${15 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(halfDivisorInActualPixel > midBaseLineTextDimensions.width * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                if(!this._alignCoordinateSystem){
                    resPoint = PointCal.addVector(resPoint, {x: 0, y: -height / 2 - height * 0.2});
                    resPoint = PointCal.flipYAxis(resPoint);
                } else {
                    resPoint = PointCal.addVector(resPoint, {x: 0, y: height / 2 + height * 0.2});
                }
                context.fillText(`${i.toFixed(0)}`, resPoint.x , resPoint.y);
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
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 25 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.font = `${18 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(halfDivisorInActualPixel > midBaseLineHeight * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                resPoint = PointCal.addVector(resPoint, {x: textDimensions.width / 2 + textDimensions.width * 0.3, y: 0});
                if(!this._alignCoordinateSystem){
                    resPoint = PointCal.flipYAxis(resPoint);
                }
                context.fillText(`${i.toFixed(0)}`, resPoint.x, resPoint.y );
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
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -12.5 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.font = `${10 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(subDivisorInActualPixel > subBaseLineTextDimensions.width * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                if(!this._alignCoordinateSystem){
                    resPoint = PointCal.addVector(resPoint, {x: 0, y: -height / 2 - height * 0.2});
                    resPoint = PointCal.flipYAxis(resPoint);
                } else {
                    resPoint = PointCal.addVector(resPoint, {x: 0, y: height / 2 + height * 0.2});
                }
                context.fillText(`${i.toFixed(0)}`, resPoint.x , resPoint.y);
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
            if(!this._alignCoordinateSystem){
                context.moveTo(resPoint.x, -resPoint.y);
            } else {
                context.moveTo(resPoint.x, resPoint.y);
            }
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 12.5 / this._camera.getZoomLevel()));
            if(!this._alignCoordinateSystem){
                context.lineTo(resPoint.x, -resPoint.y);
            } else {
                context.lineTo(resPoint.x, resPoint.y);
            }
            context.font = `${12 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(subDivisorInActualPixel > subBaseLineHeight * 2) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                resPoint = PointCal.addVector(resPoint, {x: textDimensions.width / 2 + textDimensions.width * 0.3, y: 0});
                if(!this._alignCoordinateSystem){
                    resPoint = PointCal.flipYAxis(resPoint);
                }
                context.fillText(`${i.toFixed(0)}`, resPoint.x, resPoint.y );
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
        if(this._alignCoordinateSystem){
            context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + offset, pos.y + offset);
        } else {
            context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + offset, -pos.y - offset);
        }
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

    /**
     * @group Camera Control
     * @translation Subscribe to the camera update event. The events fire only when the camera is actually move not the when the command is issued.
     * @param eventName 
     * @param callback 
     */
    on<K extends keyof CameraEventMapping>(eventName: K, callback: (event: CameraEventMapping[K], cameraState: CameraState)=>void): void {
        this.camera.on(eventName, callback);
    }

    windowResizeHandler(){
        if(this._fullScreenFlag){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }
}
