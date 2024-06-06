import BoardCameraV2, { BoardCamera } from 'src/board-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf, boundariesFullyDefined, } from 'src/board-camera/utils/position';
import { PanRig, PanController } from 'src/board-camera/pan';
import { ZoomRig, ZoomController } from 'src/board-camera/zoom';
import { RotationRig } from 'src/board-camera/rotation';
import { BoardKMTStrategy, DefaultBoardKMTStrategy } from 'src/kmt-strategy';
import { BoardTouchStrategy, DefaultTouchStrategy } from 'src/touch-strategy';
import { BoardInputEvent, Point } from 'src/index';
import { PointCal } from 'point2point';

import { CameraEvent, CameraState, UnSubscribe } from 'src/camera-observer';
import { minZoomLevelBaseOnDimensions, minZoomLevelBaseOnHeight, minZoomLevelBaseOnWidth, zoomLevelBoundariesShouldUpdate } from 'src/boardify/utils';
import { BoardStateObserver } from 'src/boardify/board-state-observer';
import { InputObserver, UnsubscribeToInput } from 'src/input-observer';

import { InputControlCenter, SimpleRelay } from 'src/control-center';

/**
 * @category Board
 * @translationBlock Usage
 * ```typescript
 * import { Board } from "@niuee/board";
 * 
 * // however you prefer to get a canvas element that is already in the DOM
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
 * @translationBlock Alternatively you can import the board class as from a subdirectory; this shaves the bundle size a bit but not a lot though. As the board is the overall entry point for the library.
 * 
 * ```typescript
 * import {Board} from "@niuee/board/boardify";
 * ```
 */
export default class Board {
    
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;

    private _kmtStrategy: BoardKMTStrategy;
    private _touchStrategy: BoardTouchStrategy;

    private _alignCoordinateSystem: boolean = true;
    private _fullScreen: boolean = false;

    private boardStateObserver: BoardStateObserver;
    private boardInputObserver: InputObserver;

    private lastUpdateTime: number = 0;

    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;
    
    constructor(canvas: HTMLCanvasElement){
        this._canvas = canvas;
        this.boardStateObserver = new BoardStateObserver(new BoardCameraV2());
        this.boardStateObserver.camera.viewPortHeight = canvas.height;
        this.boardStateObserver.camera.viewPortWidth = canvas.width;
        this.boardStateObserver.camera.boundaries = {min: {x: -5000, y: -5000}, max: {x: 5000, y: 5000}};
        let context = canvas.getContext('2d');
        if(context == null){
            throw new Error("Canvas 2d context is null");
        }

        this._context = context;

        let panHandler = new PanRig();
        let zoomHandler = new ZoomRig(panHandler);
        let rotationHandler = new RotationRig();

        this.bindFunctions();

        this.attributeObserver = new MutationObserver(this.attributeCallBack);
        this.attributeObserver.observe(this._canvas, {attributes: true});

        this.windowResizeObserver = new ResizeObserver(this.windowResizeHandler);
        this.windowResizeObserver.observe(document.body);

        this.boardInputObserver = new InputObserver(new SimpleRelay(panHandler, zoomHandler, rotationHandler));

        this._kmtStrategy = new DefaultBoardKMTStrategy(this._canvas, this.boardStateObserver.camera, this.boardInputObserver);
        this.boardStateObserver.subscribeToCamera(this._kmtStrategy);

        this._touchStrategy = new DefaultTouchStrategy(this._canvas, this.boardStateObserver.camera, this.boardInputObserver);
        this.boardStateObserver.subscribeToCamera(this._touchStrategy);
        this.registerEventListeners();
    }

    private registerEventListeners(){
        this._kmtStrategy.setUp();
        this._touchStrategy.setUp();
    }

    private removeEventListeners(){
        this._touchStrategy.tearDown();
        this._kmtStrategy.tearDown();
    }

    /**
     * @group LifeCycle
     * @translationBlock This function is used to set up the board. It adds all the event listeners and starts the resize observer and the attribute observer.
     */
    setup(){
        this.registerEventListeners();
        this.windowResizeObserver.observe(document.body);
        this.attributeObserver.observe(this._canvas, {attributes: true});
    }

    /**
     * @group LifeCycle
     * @translationBlock This function is used to clean up the board. It removes all the event listeners and disconnects the resize observer and the attribute observer. 
     */
    tearDown(){
        this.removeEventListeners();
        this.windowResizeObserver.disconnect();
        this.attributeObserver.disconnect();
    }

    private bindFunctions(){
        this.step = this.step.bind(this);
        this.attributeCallBack = this.attributeCallBack.bind(this);
        this.windowResizeHandler = this.windowResizeHandler.bind(this);
    }

    /**
     * @translationBlock This is in sync with the canvas width and the camera view port width. This is not the board's width.
     * If the limitEntireViewPort is set to true, the min zoom level is updated based on the width of the canvas.
     */
    set width(width: number){
        this._canvas.width = width;
        this.boardStateObserver.camera.viewPortWidth = width;
        // console.log("changed the width of the canvas");
        // console.log("limit entire view port", this.boardStateObserver.panHandler.limitEntireViewPort);
        if(this.boardInputObserver.controlCenter.panController.limitEntireViewPort){
            // console.log("change the min zoom level due to the limit entire view port");
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                // console.log("setting min zoom level in width");
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get width(): number {
        return this._canvas.width;
    }

    /**
     * @translationBlock This is in sync with the canvas height and the camera view port height. This is not the board's height.
     * If the limitEntireViewPort is set to true, the min zoom level is updated based on the height.
     */
    set height(height: number){
        this._canvas.height = height;
        this.boardStateObserver.camera.viewPortHeight = height;
        if(this.boardInputObserver.controlCenter.panController.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get height(): number {
        return this._canvas.height;
    }

    /**
     * @translationBlock This is an attribute that determines if the coordinate system should be aligned with the one of the HTML canvas element. The default is true.
     */
    set alignCoordinateSystem(align: boolean){
        this._alignCoordinateSystem = align;
        this._kmtStrategy.alignCoordinateSystem = align;
        this._touchStrategy.alignCoordinateSystem = align;
    }

    get alignCoordinateSystem(): boolean{
        return this._alignCoordinateSystem;
    }

    /**
     * @translationBlock Determines if the board should be full screen. If this is set to true, the width and height of the board will be set to the window's inner width and inner height respectively.
     * If set to true the width and height of the board will resize with the window.
     */
    get fullScreen(): boolean {
        return this._fullScreen;
    }

    set fullScreen(value: boolean) {
        this._fullScreen = value;
        if(this._fullScreen){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }

    /**
     * @translationBlock The context used to draw stuff on the canvas.
     */
    get context(): CanvasRenderingContext2D{
        return this._context;
    }

    /**
     * @translationBlock Determines the behavior of the camera when the camera is at the edge of the boundaries. If set to true, the entire view port would not move beyond the boundaries.
     * If set to false, only the center of the camera is bounded by the boundaries.
     */
    set limitEntireViewPort(value: boolean){
        this.boardInputObserver.controlCenter.panController.limitEntireViewPort = value;
        if(value){
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get limitEntireViewPort(): boolean{
        return this.boardInputObserver.controlCenter.panController.limitEntireViewPort;
    }

    /**
     * @translationBlock The strategy used to handle the keyboard, mouse events. The default strategy is the DefaultBoardKMTStrategy. 
     * You can implement your own strategy by implementing the BoardKMTStrategy interface.
     */
    set kmtStrategy(strategy: BoardKMTStrategy){
        this._kmtStrategy.tearDown();
        this.boardStateObserver.unsubscribeToCamera(this._kmtStrategy);
        strategy.setUp();
        this._kmtStrategy = strategy;
        this.boardStateObserver.subscribeToCamera(this._kmtStrategy);
        this._kmtStrategy.camera = this.boardStateObserver.camera;
    }

    get kmtStrategy(): BoardKMTStrategy{
        return this._kmtStrategy;
    }

    /**
     * @translationBlock The strategy used to handle touch events. The default strategy is the DefaultTouchStrategy.
     * You can implement your own strategy by implementing the BoardTouchStrategy interface.
     */
    set touchStrategy(strategy: BoardTouchStrategy){
        this._touchStrategy.tearDown();
        this.boardStateObserver.unsubscribeToCamera(this._touchStrategy);
        strategy.setUp();
        this._touchStrategy = strategy;
        this.boardStateObserver.subscribeToCamera(this._touchStrategy);
        this._touchStrategy.camera = this.boardStateObserver.camera;
    }

    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    /**
     * @translationBlock The underlying camera of the board. The camera of the board can be switched.
     * The boundaries are based on camera. Meaning you can have camera with different boundaries, and you can switch between them during runtime.
     */
    get camera(): BoardCamera{
        return this.boardStateObserver.camera;
    }

    set camera(camera: BoardCamera){
        camera.viewPortHeight = this._canvas.height;
        camera.viewPortWidth = this._canvas.width;
        this.boardStateObserver.camera = camera;
    }

    /**
     * @translationBlock The pan handler of the board. The pan handler is responsible for handling the pan events issued to the camera.
     * It has the final say on how the camera should move. Restrictions and clamping behavior are implemented in the pan handler.
     */
    set panHandler(handler: PanController){
        this.boardInputObserver.controlCenter.panController = handler;
    }

    get panHandler(): PanController{
        return this.boardInputObserver.controlCenter.panController;
    }

    /**
     * @translationBlock The zoom handler of the board. The zoom handler is responsible for handling the zoom events issued to the camera.
     * It has the final say on how the camera should zoom. Restrictions and clamping behavior are implemented in the zoom handler.
     */
    set zoomHandler(handler: ZoomController){
        this.boardStateObserver.zoomHandler = handler;
    }

    get zoomHandler(): ZoomController{
        return this.boardStateObserver.zoomHandler;
    }

    /**
     * @translationBlock The control center of the board. The control center is responsible for handling the input events and dispatch the events to the pan, zoom, and rotation handlers.
     * This exists to decouple the input events from the camera. The control center is the middle man. The default control center is just a simple relay. You can implement a control center
     * that takes in other inputs. For example, an input to start camera animations.
     */
    set controlCenter(controlCenter: InputControlCenter){
        let tempPanHandler = this.boardInputObserver.controlCenter.panController;
        let tempZoomHandler = this.boardInputObserver.controlCenter.zoomController;
        let tempRotationHandler = this.boardInputObserver.controlCenter.rotationController;
        controlCenter.panController = tempPanHandler;
        controlCenter.zoomController = tempZoomHandler;
        controlCenter.rotationController = tempRotationHandler;
        this.boardInputObserver.controlCenter = controlCenter;
    }

    get controlCenter(): InputControlCenter{
        return this.boardInputObserver.controlCenter;
    }

    /**
     * @translationBlock This is the step function that is called in the animation frame. This function is responsible for updating the canvas context and the camera state.
     * @param timestamp 
     */
    public step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        const curBoundaries = this.boardStateObserver.camera.boundaries;
        if (!boundariesFullyDefined(curBoundaries)){
            throw new Error("Boundaries are not fully defined; not able to clear the canvas under the current implementation");
        }
        this._context.clearRect(curBoundaries.min.x, -curBoundaries.min.y, curBoundaries.max.x - curBoundaries.min.x, -(curBoundaries.max.y - curBoundaries.min.y));

        this._context.translate( this._canvas.width / 2, this._canvas.height / 2 );
        this._context.scale(this.boardStateObserver.camera.zoomLevel, this.boardStateObserver.camera.zoomLevel);
        if (this._alignCoordinateSystem){
            this._context.rotate(-this.boardStateObserver.camera.rotation);
            this._context.translate(-this.boardStateObserver.camera.position.x,  -this.boardStateObserver.camera.position.y);
        } else {
            this._context.rotate(this.boardStateObserver.camera.rotation);
            this._context.translate(-this.boardStateObserver.camera.position.x,  this.boardStateObserver.camera.position.y);
        }
    }

    private convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        if(this._alignCoordinateSystem) {
            return {x: res.x, y: res.y};
        } else {
            return {x: res.x, y: -res.y};
        }
    }

    /**
     * @translationBlock Converts a point from window coordinates to world coordinates.
     * @param clickPointInWindow The point in window coordinates to convert.
     * @returns The converted point in world coordinates.
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        if(this._alignCoordinateSystem){
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this.boardStateObserver.camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        } else {
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this.boardStateObserver.camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        }
    }

    /**
     * @translationBlock Add an camera movement event listener. The events are "pan", "zoom", and "rotate".
     * @param eventName The event name to listen for. The events are "pan", "zoom", and "rotate".
     * @param callback The callback function to call when the event is triggered. The event provided to the callback is different for the different events.
     * @returns The converted point in world coordinates.
     */
    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe {
        return this.boardStateObserver.camera.on(eventName, callback);
    }

    /**
     * @translationBlock Add an input event listener. The events are "pan", "zoom", and "rotate". This is different from the camera event listener as this is for input events. 
     * Input event does not necesarily mean that the camera will move. The input event is the event that is triggered when the user interacts with the board.
     * @param eventName 
     * @param callback 
     * @returns 
     */
    onInput<K extends keyof BoardInputEvent>(eventName: K, callback: (event: BoardInputEvent[K])=> void): UnsubscribeToInput {
        return this.boardInputObserver.onInput(eventName, callback);
    }

    /**
     * @translationBlock The max translation height of the camera. This is the maximum distance the camera can move in the vertical direction.
     */
    get maxHalfTransHeight(): number | undefined{
        return halfTranslationHeightOf(this.boardStateObserver.camera.boundaries);
    }

    /**
     * @translationBlock The max translation width of the camera. This is the maximum distance the camera can move in the horizontal direction.
     */
    get maxHalfTransWidth(): number | undefined{
        return halfTranslationWidthOf(this.boardStateObserver.camera.boundaries);
    }

    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    // console.log("width changed");
                    this.boardStateObserver.camera.viewPortWidth = this._canvas.width;
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                            this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
                        }
                    }
                } else if(mutation.attributeName === "height"){
                    // console.log("height changed");
                    this.boardStateObserver.camera.viewPortHeight = this._canvas.height;
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                            this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
                        }
                    }
                }
            }
        }
    }

    private windowResizeHandler(){
        if(this._fullScreen){
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }
    }

    setMaxTransWidthAlignedMin(value: number){
        const curBoundaries = this.boardStateObserver.camera.boundaries;
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curHorizontalMin = curMin == undefined ? undefined: curMin.x;
        if(curHorizontalMin == undefined){
            this.boardStateObserver.camera.setHorizontalBoundaries(-value, value);
        } else {
            this.boardStateObserver.camera.setHorizontalBoundaries(curHorizontalMin, curHorizontalMin + value * 2);
        }
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
            if(zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }
}
