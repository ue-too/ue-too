import DefaultBoardCamera, { ObservableBoardCamera } from 'src/board-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf, boundariesFullyDefined, } from 'src/board-camera/utils/position';
import { BoardKMTStrategy, DefaultBoardKMTStrategy, EventTargetWithPointerEvents } from 'src/kmt-strategy';
import { BoardTouchStrategy, DefaultTouchStrategy } from 'src/touch-strategy';
import { Point } from 'src/index';
import { PointCal } from 'point2point';

import { CameraEventMap, CameraState, UnSubscribe } from 'src/camera-observer';
import { minZoomLevelBaseOnDimensions, minZoomLevelBaseOnHeight, minZoomLevelBaseOnWidth, zoomLevelBoundariesShouldUpdate } from 'src/boardify/utils';
import { BoardStateObserver } from 'src/boardify/board-state-observer';
import { InputObserver, UnsubscribeToUserRawInput, RawUserInputEventMap, RawUserInputObservable } from 'src/input-observer';

import { InputControlCenter, RelayControlCenter, CameraRig, createDefaultPanControlStateMachine, createDefaultZoomControlStateMachine } from 'src/control-center';

import { SelectionBox } from 'src/drawing-engine';
import { SelectionInputObserver } from 'src/selection-box';

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
 * @description Alternatively you can import the board class as from a subdirectory; this shaves the bundle size a bit but not a lot though. As the board is the overall entry point for the library.
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
    private boardInputObserver: RawUserInputObservable;

    private lastUpdateTime: number = 0;

    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;
    
    constructor(canvas: HTMLCanvasElement, eventTarget: EventTargetWithPointerEvents = canvas){
        this._canvas = canvas;
        this.boardStateObserver = new BoardStateObserver(new DefaultBoardCamera());
        this.boardStateObserver.camera.viewPortHeight = canvas.height;
        this.boardStateObserver.camera.viewPortWidth = canvas.width;
        this.boardStateObserver.camera.boundaries = {min: {x: -5000, y: -5000}, max: {x: 5000, y: 5000}};
        let context = canvas.getContext('2d');
        if(context == null){
            throw new Error("Canvas 2d context is null");
        }

        this._context = context;

        this.bindFunctions();

        this.attributeObserver = new MutationObserver(this.attributeCallBack);
        this.attributeObserver.observe(this._canvas, {attributes: true});

        this.windowResizeObserver = new ResizeObserver(this.windowResizeHandler);
        this.windowResizeObserver.observe(document.body);

        const stateMachineContext = new CameraRig({
            limitEntireViewPort: true,
            restrictRelativeXTranslation: false,
            restrictRelativeYTranslation: false,
            restrictXTranslation: false,
            restrictYTranslation: false,
            restrictZoom: false,
        }, this.boardStateObserver.camera);

        const panStateMachine = createDefaultPanControlStateMachine(stateMachineContext);
        const zoomStateMachine = createDefaultZoomControlStateMachine(stateMachineContext);
        const relayControlCenter = new RelayControlCenter(panStateMachine, zoomStateMachine);
        const selectionInputObserver = new SelectionInputObserver(this.boardStateObserver.camera, new SelectionBox(this._context));

        this.boardInputObserver = new RawUserInputObservable(relayControlCenter);

        this._kmtStrategy = new DefaultBoardKMTStrategy(canvas, eventTarget, this.boardInputObserver, selectionInputObserver, false);

        this._touchStrategy = new DefaultTouchStrategy(this._canvas, this.boardInputObserver);
        
        // NOTE: device pixel ratio
        this._canvas.style.width = this._canvas.width + "px";
        this._canvas.style.height = this._canvas.height + "px";
        this._canvas.width = window.devicePixelRatio * this._canvas.width;
        this._canvas.height = window.devicePixelRatio * this._canvas.height;
        // NOTE: device pixel ratio
        
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
     * @description This is in sync with the canvas width and the camera view port width. This is not the board's width.
     * If the `limitEntireViewPort` is set to true, the min zoom level is updated based on the width of the canvas.
     * 
     */
    set width(width: number){
        this._canvas.width = width * window.devicePixelRatio;
        this._canvas.style.width = width + "px";
        this.boardStateObserver.camera.viewPortWidth = width;
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this._canvas.width / window.devicePixelRatio, this._canvas.height / window.devicePixelRatio, this.boardStateObserver.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get width(): number {
        return this._canvas.width / window.devicePixelRatio;
    }

    /**
     * @translationBlock This is in sync with the canvas height and the camera view port height. This is not the board's height.
     * If the limitEntireViewPort is set to true, the min zoom level is updated based on the height.
     */
    set height(height: number){
        this._canvas.height = height * window.devicePixelRatio;
        this._canvas.style.height = height + "px";
        this.boardStateObserver.camera.viewPortHeight = height;
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.boardStateObserver.camera.boundaries, this._canvas.width / window.devicePixelRatio, this._canvas.height / window.devicePixelRatio, this.boardStateObserver.camera.rotation);
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
        this.boardInputObserver.controlCenter.limitEntireViewPort = value;
        if(value){
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(this.boardStateObserver.camera.boundaries, this._canvas.width, this._canvas.height, this.boardStateObserver.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get limitEntireViewPort(): boolean{
        return this.boardInputObserver.controlCenter.limitEntireViewPort;
    }

    /**
     * @translationBlock The strategy used to handle the keyboard, mouse events. The default strategy is the DefaultBoardKMTStrategy. 
     * You can implement your own strategy by implementing the BoardKMTStrategy interface.
     */
    set kmtStrategy(strategy: BoardKMTStrategy){
        this._kmtStrategy.tearDown();
        strategy.setUp();
        this._kmtStrategy = strategy;
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
        strategy.setUp();
        this._touchStrategy = strategy;
    }

    get touchStrategy(): BoardTouchStrategy{
        return this._touchStrategy;
    }

    /**
     * @translationBlock The underlying camera of the board. The camera of the board can be switched.
     * The boundaries are based on camera. Meaning you can have camera with different boundaries, and you can switch between them during runtime.
     */
    get camera(): ObservableBoardCamera{
        return this.boardStateObserver.camera;
    }

    set camera(camera: ObservableBoardCamera){
        camera.viewPortHeight = this._canvas.height;
        camera.viewPortWidth = this._canvas.width;
        this.boardStateObserver.camera = camera;
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

        const transfromMatrix = this.boardStateObserver.camera.getTransform(window.devicePixelRatio, this._alignCoordinateSystem);
        this._context.setTransform(transfromMatrix.a, transfromMatrix.b, transfromMatrix.c, transfromMatrix.d, transfromMatrix.e, transfromMatrix.f);
    }

    /**
     * @translationBlock Converts a point from window coordinates to world coordinates.
     * @param clickPointInWindow The point in window coordinates to convert.
     * @returns The converted point in world coordinates.
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const boundingRect = this._canvas.getBoundingClientRect();
        const cameraCenterInWindow = {x: boundingRect.left + (boundingRect.right - boundingRect.left) / 2, y: boundingRect.top + (boundingRect.bottom - boundingRect.top) / 2};
        const pointInViewPort = PointCal.subVector(clickPointInWindow, cameraCenterInWindow);
        if(!this._alignCoordinateSystem){
            pointInViewPort.y = -pointInViewPort.y;
        }
        return this.boardStateObserver.camera.convertFromViewPort2WorldSpace(pointInViewPort);
    }

    /**
     * @translationBlock Add an camera movement event listener. The events are "pan", "zoom", and "rotate".
     * @param eventName The event name to listen for. The events are "pan", "zoom", and "rotate".
     * @param callback The callback function to call when the event is triggered. The event provided to the callback is different for the different events.
     * @returns The converted point in world coordinates.
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void): UnSubscribe {
        return this.boardStateObserver.camera.on(eventName, callback);
    }

    /**
     * @translationBlock Add an input event listener. The events are "pan", "zoom", and "rotate". This is different from the camera event listener as this is for input events. 
     * Input event does not necesarily mean that the camera will move. The input event is the event that is triggered when the user interacts with the board.
     * @param eventName 
     * @param callback 
     * @returns 
     */
    onInput<K extends keyof RawUserInputEventMap>(eventName: K, callback: (event: RawUserInputEventMap[K])=> void): UnsubscribeToUserRawInput {
        return this.boardInputObserver.on(eventName, callback);
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
                    this.boardStateObserver.camera.viewPortWidth = parseFloat(this._canvas.style.width);
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this.boardStateObserver.camera.viewPortWidth, this.boardStateObserver.camera.viewPortHeight, this.boardStateObserver.camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                            this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
                        }
                    }
                } else if(mutation.attributeName === "height"){
                    this.boardStateObserver.camera.viewPortHeight = parseFloat(this._canvas.style.height);
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.boardStateObserver.camera.boundaries, this.boardStateObserver.camera.viewPortWidth, this.boardStateObserver.camera.viewPortHeight, this.boardStateObserver.camera.rotation);
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
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.boardStateObserver.camera.boundaries, this.boardStateObserver.camera.viewPortWidth, this.boardStateObserver.camera.viewPortHeight, this.boardStateObserver.camera.rotation);
            if(zoomLevelBoundariesShouldUpdate(this.boardStateObserver.camera.zoomBoundaries, targetMinZoomLevel)){
                this.boardStateObserver.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get selectionBox(): SelectionBox {
        return this._kmtStrategy.selectionInputObserver.selectionBox;
    }
}
