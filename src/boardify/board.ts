import DefaultBoardCamera, { ObservableBoardCamera } from 'src/board-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf, boundariesFullyDefined, } from 'src/board-camera/utils/position';
import { KMTEventParser, DefaultKMTEventParser, EventTargetWithPointerEvents } from 'src/kmt-event-parser';
import { TouchEventParser, DefaultTouchEventParser } from 'src/touch-event-parser';
import { Point } from 'src/index';
import { PointCal } from 'point2point';

import { CameraEventMap, CameraState, UnSubscribe } from 'src/camera-observer';
import { minZoomLevelBaseOnDimensions, minZoomLevelBaseOnHeight, minZoomLevelBaseOnWidth, zoomLevelBoundariesShouldUpdate } from 'src/boardify/utils';
import { UnsubscribeToUserRawInput, RawUserInputEventMap, RawUserInputObservable } from 'src/input-observer';

import { InputFlowControl, CameraRig, createDefaultRelayControlCenterWithCameraRig } from 'src/input-flow-control';


const methodsToFlip: Record<string, number[]> = {
    fillRect: [1],        // [yIndex] - indices of y-coordinates to flip
    strokeRect: [1],
    fillText: [1],
    strokeText: [1],
    lineTo: [1],
    moveTo: [1],
    quadraticCurveTo: [1, 3],
    bezierCurveTo: [1, 3, 5],
    arc: [1]
};

/**
 * @category Board
 * 
 * @description Usage
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
 * Alternatively you can import the board class as from a subdirectory; this shaves the bundle size a bit but not a lot though. As the board is the overall entry point for the library.
 * 
 * ```typescript
 * import { Board } from "@niuee/board/boardify";
 * ```
 */
export default class Board {
    
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;

    private _kmtStrategy: KMTEventParser;
    private _touchStrategy: TouchEventParser;

    private _alignCoordinateSystem: boolean = true;
    private _fullScreen: boolean = false;

    private cameraRig: CameraRig;
    private boardInputObserver: RawUserInputObservable;

    private lastUpdateTime: number = 0;

    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;
    
    constructor(canvas: HTMLCanvasElement, eventTarget: EventTargetWithPointerEvents = canvas){
        this._canvas = canvas;
        const camera = new DefaultBoardCamera();
        camera.viewPortHeight = canvas.height;
        camera.viewPortWidth = canvas.width;
        camera.boundaries = {min: {x: -5000, y: -5000}, max: {x: 5000, y: 5000}};
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

        this.cameraRig = new CameraRig({
            limitEntireViewPort: true,
            restrictRelativeXTranslation: false,
            restrictRelativeYTranslation: false,
            restrictXTranslation: false,
            restrictYTranslation: false,
            restrictZoom: false,
        }, camera);

        this.boardInputObserver = new RawUserInputObservable(createDefaultRelayControlCenterWithCameraRig(this.cameraRig));

        this._kmtStrategy = new DefaultKMTEventParser(canvas, eventTarget, this.boardInputObserver, false);

        this._touchStrategy = new DefaultTouchEventParser(this._canvas, this.boardInputObserver);
        
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
     * @description This function is used to set up the board. It adds all the event listeners and starts the resize observer and the attribute observer.
     */
    setup(){
        this.registerEventListeners();
        this.windowResizeObserver.observe(document.body);
        this.attributeObserver.observe(this._canvas, {attributes: true});
    }

    /**
     * @group LifeCycle
     * @description This function is used to clean up the board. It removes all the event listeners and disconnects the resize observer and the attribute observer. 
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
        this.camera.viewPortWidth = width;
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.camera.boundaries, this._canvas.width / window.devicePixelRatio, this._canvas.height / window.devicePixelRatio, this.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get width(): number {
        return this._canvas.width / window.devicePixelRatio;
    }

    /**
     * @description This is in sync with the canvas height and the camera view port height. This is not the board's height.
     * If the limitEntireViewPort is set to true, the min zoom level is updated based on the height.
     */
    set height(height: number){
        this._canvas.height = height * window.devicePixelRatio;
        this._canvas.style.height = height + "px";
        this.camera.viewPortHeight = height;
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.camera.boundaries, this._canvas.width / window.devicePixelRatio, this._canvas.height / window.devicePixelRatio, this.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get height(): number {
        return this._canvas.height;
    }

    /**
     * @description This is an attribute that determines if the coordinate system should be aligned with the one of the HTML canvas element. The default is true.
     * If you set this to true, the coordinate system will be aligned with the one of the HTML canvas element.
     * If you change this value during runtime, you should update the context to be aligned with the new coordinate system. (just call board.context again)
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
     * @description Determines if the board should be full screen. If this is set to true, the width and height of the board will be set to the window's inner width and inner height respectively, 
     * and the width and height of the board will resize with the window.
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
     * @description The context used to draw on the canvas.
     * If alignCoordinateSystem is false, this returns a proxy that automatically
     * negates y-coordinates for relevant drawing methods.
     */
    get context(): CanvasRenderingContext2D {
        if (!this._alignCoordinateSystem) {
            return new Proxy(this._context, {
                get(target: CanvasRenderingContext2D, prop: string | symbol, receiver: any): any {
                    const value = Reflect.get(target, prop, target);
                    
                    // Check if this is a method that needs y-coordinate flipping
                    if (typeof prop === 'string' && prop in methodsToFlip && typeof value === 'function') {
                        return function(...args: any[]) {
                            // Create a copy of the arguments
                            const newArgs = [...args];
                            
                            // Flip the y-coordinates based on methodsToFlip configuration
                            const yIndices = methodsToFlip[prop];
                            for (const index of yIndices) {
                                if (index < newArgs.length) {
                                    newArgs[index] = -newArgs[index];
                                }
                            }
                            
                            // Call the original method with the modified arguments
                            return value.apply(target, newArgs);
                        };
                    }
                    
                    // Return the original value for properties and methods that don't need modification
                    if (typeof value === 'function') {
                        return function(...args: any[]) {
                            return value.apply(target, args);
                        };
                    }
                    
                    return value;
                },
                set(target, prop, value): boolean {
                    return Reflect.set(target, prop, value);
                }
            });
        }
        return this._context;
    }

    /**
     * @description Determines the behavior of the camera when the camera is at the edge of the boundaries. If set to true, the entire view port would not move beyond the boundaries.
     * If set to false, only the center of the camera is bounded by the boundaries.
     */
    set limitEntireViewPort(value: boolean){
        this.boardInputObserver.controlCenter.limitEntireViewPort = value;
        if(value){
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(this.camera.boundaries, this._canvas.width, this._canvas.height, this.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get limitEntireViewPort(): boolean{
        return this.boardInputObserver.controlCenter.limitEntireViewPort;
    }

    /**
     * @description The strategy used to handle the keyboard, mouse events. The default strategy is the DefaultBoardKMTStrategy. 
     * You can implement your own strategy by implementing the BoardKMTStrategy interface.
     */
    set kmtStrategy(strategy: KMTEventParser){
        this._kmtStrategy.tearDown();
        strategy.setUp();
        this._kmtStrategy = strategy;
    }

    get kmtStrategy(): KMTEventParser{
        return this._kmtStrategy;
    }

    /**
     * @description The strategy used to handle touch events. The default strategy is the DefaultTouchStrategy.
     * You can implement your own strategy by implementing the BoardTouchStrategy interface.
     */
    set touchStrategy(strategy: TouchEventParser){
        this._touchStrategy.tearDown();
        strategy.setUp();
        this._touchStrategy = strategy;
    }

    get touchStrategy(): TouchEventParser{
        return this._touchStrategy;
    }

    /**
     * @description The underlying camera of the board. The camera of the board can be switched.
     * The boundaries are based on camera. Meaning you can have camera with different boundaries, and you can switch between them during runtime.
     */
    get camera(): ObservableBoardCamera{
        return this.cameraRig.camera;
    }

    set camera(camera: ObservableBoardCamera){
        camera.viewPortHeight = this._canvas.height / window.devicePixelRatio;
        camera.viewPortWidth = this._canvas.width / window.devicePixelRatio;
        this.camera = camera;
    }

    get controlCenter(): InputFlowControl{
        return this.boardInputObserver.controlCenter;
    }

    /**
     * @description This is the step function that is called in the animation frame. This function is responsible for updating the canvas context and the camera state.
     * @param timestamp 
     */
    public step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        const curBoundaries = this.camera.boundaries;
        if (!boundariesFullyDefined(curBoundaries)){
            throw new Error("Boundaries are not fully defined; not able to clear the canvas under the current implementation");
        }
        this._context.clearRect(curBoundaries.min.x, -curBoundaries.min.y, curBoundaries.max.x - curBoundaries.min.x, -(curBoundaries.max.y - curBoundaries.min.y));

        const transfromMatrix = this.camera.getTransform(window.devicePixelRatio, this._alignCoordinateSystem);
        this._context.setTransform(transfromMatrix.a, transfromMatrix.b, transfromMatrix.c, transfromMatrix.d, transfromMatrix.e, transfromMatrix.f);
    }

    /**
     * @description Converts a point from window coordinates to world coordinates.
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
        return this.camera.convertFromViewPort2WorldSpace(pointInViewPort);
    }

    /**
     * @description Add an camera movement event listener. The events are "pan", "zoom", and "rotate".
     * @param eventName The event name to listen for. The events are "pan", "zoom", and "rotate".
     * @param callback The callback function to call when the event is triggered. The event provided to the callback is different for the different events.
     * @returns The converted point in world coordinates.
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void): UnSubscribe {
        return this.camera.on(eventName, callback);
    }

    /**
     * @description Add an input event listener. The events are "pan", "zoom", and "rotate". This is different from the camera event listener as this is for input events. 
     * Input event does not necesarily mean that the camera will move. The input event is the event that is triggered when the user interacts with the board.
     * @param eventName 
     * @param callback 
     * @returns 
     */
    onInput<K extends keyof RawUserInputEventMap>(eventName: K, callback: (event: RawUserInputEventMap[K])=> void): UnsubscribeToUserRawInput {
        return this.boardInputObserver.on(eventName, callback);
    }

    /**
     * @description The max translation height of the camera. This is the maximum distance the camera can move in the vertical direction.
     */
    get maxHalfTransHeight(): number | undefined{
        return halfTranslationHeightOf(this.camera.boundaries);
    }

    /**
     * @description The max translation width of the camera. This is the maximum distance the camera can move in the horizontal direction.
     */
    get maxHalfTransWidth(): number | undefined{
        return halfTranslationWidthOf(this.camera.boundaries);
    }

    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    this.camera.viewPortWidth = parseFloat(this._canvas.style.width);
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.camera.boundaries, this.camera.viewPortWidth, this.camera.viewPortHeight, this.camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                            this.camera.setMinZoomLevel(targetMinZoomLevel);
                        }
                    }
                } else if(mutation.attributeName === "height"){
                    this.camera.viewPortHeight = parseFloat(this._canvas.style.height);
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnHeight(this.camera.boundaries, this.camera.viewPortWidth, this.camera.viewPortHeight, this.camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                            this.camera.setMinZoomLevel(targetMinZoomLevel);
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
        const curBoundaries = this.camera.boundaries;
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curHorizontalMin = curMin == undefined ? undefined: curMin.x;
        if(curHorizontalMin == undefined){
            this.camera.setHorizontalBoundaries(-value, value);
        } else {
            this.camera.setHorizontalBoundaries(curHorizontalMin, curHorizontalMin + value * 2);
        }
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.camera.boundaries, this.camera.viewPortWidth, this.camera.viewPortHeight, this.camera.rotation);
            if(zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }
}
