import { ObservableBoardCamera } from '../camera/interface';
import DefaultBoardCamera from '../camera/default-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf } from '../camera/utils/position';
import { KMTEventParser, VanillaKMTEventParser } from '../input-interpretation/raw-input-parser';
import { TouchEventParser, VanillaTouchEventParser } from '../input-interpretation/raw-input-parser';
import { Point } from '@ue-too/math';
import { reverseYAxis } from '../utils';
import { PointCal } from '@ue-too/math';

import { CameraEventMap, CameraState, UnSubscribe } from '../camera/update-publisher';
import { minZoomLevelBaseOnDimensions, minZoomLevelBaseOnWidth, zoomLevelBoundariesShouldUpdate } from '../utils';
import { UnsubscribeToUserRawInput, RawUserInputEventMap, RawUserInputPublisher } from '../input-interpretation/raw-input-publisher';

import { CameraMux, createCameraMuxWithAnimationAndLockWithCameraRig } from '../camera/camera-mux';
import { CameraRig, DefaultCameraRig } from '../camera/camera-rig';
import { CanvasDimensions, CanvasProxy, createKmtInputStateMachine, createTouchInputStateMachine, ObservableInputTracker, TouchInputTracker } from '../input-interpretation/input-state-machine';
import { EdgeAutoCameraInput } from '../camera/camera-edge-auto-input';

/**
 * Usage
 * ```typescript
 * const canvasElement = document.querySelector("canvas") as HTMLCanvasElement;
 * const board = new Board(canvasElement);
 * 
 * function draw(timestamp: number) {
 *   board.step(timestamp);
 * 
 *   // because board can be initialized without a canvas element, the context can be undefined until the canvas is attached
 *   if(board.context == undefined) {
 *     return;
 *   }
 * 
 *   // draw after the board has stepped
 *   // the coordinate system is the same as before; just that (0, 0) is at the center of the canvas when the camera position is at (0, 0)
 *   board.context.beginPath();
 *   board.context.rect(0, 0, 100, 100);
 *   board.context.fill();
 * 
 *   requestAnimationFrame(draw);
 * }
 * 
 * ```
 * @category Board
 * 
 */
export default class Board {
    
    private _context?: CanvasRenderingContext2D;
    private _reversedContext?: CanvasRenderingContext2D;
    private _canvasProxy: CanvasProxy;

    private _kmtParser: KMTEventParser;
    private _touchParser: TouchEventParser;

    private _alignCoordinateSystem: boolean = true;
    private _fullScreen: boolean = false;
    
    private cameraRig: CameraRig;
    private boardInputPublisher: RawUserInputPublisher;
    private _edgeAutoCameraInput: EdgeAutoCameraInput;
    private _observableInputTracker: ObservableInputTracker;
    private _touchInputTracker: TouchInputTracker;

    private _canvasSizeUpdateQueue: CanvasDimensions | undefined = undefined;

    private lastUpdateTime: number = 0;

    constructor(canvas?: HTMLCanvasElement, debug: boolean = false){
        const camera = new DefaultBoardCamera();
        const bound = 50000;
        camera.boundaries = {min: {x: -bound, y: -bound}, max: {x: bound, y: bound}};

        this.bindFunctions();

        this._canvasProxy = new CanvasProxy(canvas);

        this._canvasProxy.subscribe((canvasDimensions)=>{
            this._canvasSizeUpdateQueue = canvasDimensions;
        });

        this.cameraRig = new DefaultCameraRig({
            limitEntireViewPort: true,
            restrictRelativeXTranslation: false,
            restrictRelativeYTranslation: false,
            restrictXTranslation: false,
            restrictYTranslation: false,
            restrictZoom: false,
            clampTranslation: true,
            clampZoom: true,
        }, camera);

        this.boardInputPublisher = new RawUserInputPublisher(createCameraMuxWithAnimationAndLockWithCameraRig(this.cameraRig));

        this._edgeAutoCameraInput = new EdgeAutoCameraInput(this.boardInputPublisher.cameraMux);
        this._observableInputTracker = new ObservableInputTracker(this._canvasProxy, this.boardInputPublisher, this._edgeAutoCameraInput);
        this._touchInputTracker = new TouchInputTracker(this._canvasProxy, this.boardInputPublisher);

        const kmtInputStateMachine = createKmtInputStateMachine(this._observableInputTracker);
        const touchInputStateMachine = createTouchInputStateMachine(this._touchInputTracker);

        
        this._kmtParser = new VanillaKMTEventParser(kmtInputStateMachine, canvas);
        this._touchParser = new VanillaTouchEventParser(touchInputStateMachine, canvas);

        if(canvas != undefined){
            console.log('canvas exists on creation of board');
            this.attach(canvas, debug);
            this.syncViewPortDimensions({width: canvas.width, height: canvas.height});
        }
    }

    private syncViewPortDimensions(canvasDimensions: {width: number, height: number}){
        this.camera.viewPortHeight = canvasDimensions.height;
        this.camera.viewPortWidth = canvasDimensions.width;
    }

    attach(canvas: HTMLCanvasElement, debug: boolean = false){
        const newContext = canvas.getContext('2d', {willReadFrequently: debug});
        if(newContext == null){
            console.error("new canvas context is null");
            return;
        }
        this._kmtParser.attach(canvas);
        this._touchParser.attach(canvas);
        this._canvasProxy.attach(canvas);

        if(this.limitEntireViewPort) {
            this.syncCameraZoomLevel(this._canvasProxy.dimensions);
        }

        this._context = newContext;
        this._reversedContext = reverseYAxis(this._context);
    }

    /**
     * @group LifeCycle
     * @description This function is used to clean up the board. It removes all the event listeners and disconnects the resize observer and the attribute observer. 
     */
    tearDown(){
        this._kmtParser.tearDown();
        this._touchParser.tearDown();
        this._canvasProxy.tearDown();
    }

    private bindFunctions(){
        this.step = this.step.bind(this);
    }

    get width(): number {
        return this._canvasProxy.width;
    }

    get height(): number {
        return this._canvasProxy.height;
    }

    /**
     * @description This is an attribute that determines if the coordinate system should be aligned with the one of the HTML canvas element. The default is true.
     * If you set this to true, the coordinate system will be aligned with the one of the HTML canvas element.
     * If you change this value during runtime, you should update the context to be aligned with the new coordinate system. (just call board.context again)
     */
    set alignCoordinateSystem(align: boolean){
        this._alignCoordinateSystem = align;
        this._observableInputTracker.alignCoordinateSystem = align;
        this._touchInputTracker.alignCoordinateSystem = align;
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
            this._canvasProxy.setWidth(window.innerWidth);
            this._canvasProxy.setHeight(window.innerHeight);
        }
    }

    /**
     * @description The context used to draw on the canvas.
     * If alignCoordinateSystem is false, this returns a proxy that automatically negates y-coordinates for relevant drawing methods.
     */
    get context(): CanvasRenderingContext2D | undefined {
        if (!this._alignCoordinateSystem) {
            return this._reversedContext;
        }
        return this._context;
    }

    /**
     * @description Determines the behavior of the camera when the camera is at the edge of the boundaries. If set to true, the entire view port would not move beyond the boundaries.
     * If set to false, only the center of the camera is bounded by the boundaries.
     */
    set limitEntireViewPort(value: boolean){
        this.cameraRig.limitEntireViewPort = value;
        if(this._canvasProxy.detached){
            return;
        }
        if(value){
            this.syncCameraZoomLevel(this._canvasProxy.dimensions);
        }
    }

    get limitEntireViewPort(): boolean{
        return this.cameraRig.limitEntireViewPort;
    }

    /**
     * @description The strategy used to handle the keyboard, mouse events. The default strategy is the DefaultBoardKMTStrategy. 
     * You can implement your own strategy by implementing the BoardKMTStrategy interface.
     */
    set kmtParser(parser: KMTEventParser){
        this._kmtParser.tearDown();
        parser.setUp();
        this._kmtParser = parser;
    }

    get kmtParser(): KMTEventParser{
        return this._kmtParser;
    }

    /**
     * @description The parser used to handle touch events. The default parser is the DefaultTouchParser.
     * You can have your own parser by implementing the BoardTouchParser interface.
     */
    set touchParser(parser: TouchEventParser){
        this._touchParser.tearDown();
        parser.setUp();
        this._touchParser = parser;
    }

    get touchParser(): TouchEventParser{
        return this._touchParser;
    }

    /**
     * @description The underlying camera of the board. The camera of the board can be switched.
     * The boundaries are based on camera meaning you can have cameras with different boundaries, and you can switch between them during runtime.
     */
    get camera(): ObservableBoardCamera{
        return this.cameraRig.camera;
    }

    set camera(camera: ObservableBoardCamera){
        if(!this._canvasProxy.detached){
            camera.viewPortHeight = this._canvasProxy.height / window.devicePixelRatio;
            camera.viewPortWidth = this._canvasProxy.width / window.devicePixelRatio;
        }
        this.cameraRig.camera = camera;
    }

    get cameraMux(): CameraMux{
        return this.boardInputPublisher.cameraMux;
    }

    set cameraMux(cameraMux: CameraMux){
        this.boardInputPublisher.cameraMux = cameraMux;
    }

    get cameraMovementOnMouseEdge(): EdgeAutoCameraInput{
        return this._edgeAutoCameraInput;
    }

    /**
     * @description This is the step function that is called in the animation frame. This function is responsible for updating the canvas context and the camera state.
     * @param timestamp 
     */
    public step(timestamp: number){
        if(this._canvasProxy.detached || this._context == undefined){
            return;
        }

        this.cameraRig.update();
        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        this._context.clearRect(0, 0, this._canvasProxy.width * window.devicePixelRatio, this._canvasProxy.height * window.devicePixelRatio);

        if(this._fullScreen && (this._canvasProxy.width != window.innerWidth || this._canvasProxy.height != window.innerHeight)){
            this._canvasProxy.setWidth(window.innerWidth);
            this._canvasProxy.setHeight(window.innerHeight);
        }

        if(this._canvasSizeUpdateQueue != undefined){
            this.syncViewPortDimensions(this._canvasSizeUpdateQueue);
            this.syncCameraZoomLevel(this._canvasSizeUpdateQueue);
            this._canvasSizeUpdateQueue = undefined;
        }

        this._edgeAutoCameraInput.update(deltaTime);

        const transfromMatrix = this.camera.getTransform(window.devicePixelRatio, this._alignCoordinateSystem);
        this._context.setTransform(transfromMatrix.a, transfromMatrix.b, transfromMatrix.c, transfromMatrix.d, transfromMatrix.e, transfromMatrix.f);
    }

    /**
     * @description Converts a point from window coordinates to world coordinates.
     * @param clickPointInWindow The point in window coordinates to convert.
     * @returns The converted point in world coordinates.
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const boundingRect = this._canvasProxy.dimensions;
        const cameraCenterInWindow = {x: boundingRect.position.x + boundingRect.width / 2, y: boundingRect.position.y + boundingRect.height / 2};
        const pointInViewPort = PointCal.subVector(clickPointInWindow, cameraCenterInWindow);
        if(!this._alignCoordinateSystem){
            pointInViewPort.y = -pointInViewPort.y;
        }
        return this.camera.convertFromViewPort2WorldSpace(pointInViewPort);
    }

    /**
     * @description Add an camera movement event listener. The events are "pan", "zoom", and "rotate".
     * There's also an "all" event that will be triggered when any of the above events are triggered.
     * @param eventName The event name to listen for. The events are "pan", "zoom", and "rotate".
     * @param callback The callback function to call when the event is triggered. The event provided to the callback is different for the different events.
     * @returns The converted point in world coordinates.
     */
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void): UnSubscribe {
        return this.camera.on(eventName, callback);
    }

    /**
     * @description Add an input event listener. The events are "pan", "zoom", and "rotate". This is different from the camera event listener as this is for input events. 
     * There's also an "all" event that will be triggered when any of the above events are triggered.
     * Input event does not necesarily mean that the camera will move. The input events are the events triggered when the user interacts with the board.
     * @param eventName 
     * @param callback 
     * @returns 
     */
    onInput<K extends keyof RawUserInputEventMap>(eventName: K, callback: (event: RawUserInputEventMap[K])=> void): UnsubscribeToUserRawInput {
        return this.boardInputPublisher.on(eventName, callback);
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

    private syncCameraZoomLevel(canvasDimensions: CanvasDimensions){
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(this.camera.boundaries, canvasDimensions.width, canvasDimensions.height, this.camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }

    }

    /**
     * @group Helper Methods
     * @description This function sets the max translation width of the camera while fixing the minimum x boundary.
     */
    setMaxTransWidthWithFixedMinBoundary(value: number){
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

    /**
     * @group Helper Methods
     * @description This function sets the max translation width of the camera while fixing the minimum x boundary.
     */
    setMaxTransWidthWithFixedMaxBoundary(value: number){
        const curBoundaries = this.camera.boundaries;
        const curMax = curBoundaries == undefined ? undefined: curBoundaries.max;
        const curHorizontalMax = curMax == undefined ? undefined: curMax.x;
        if(curHorizontalMax == undefined){
            this.camera.setHorizontalBoundaries(-value, value);
        } else {
            this.camera.setHorizontalBoundaries(curHorizontalMax - value * 2, curHorizontalMax);
        }
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this.camera.boundaries, this.camera.viewPortWidth, this.camera.viewPortHeight, this.camera.rotation);
            if(zoomLevelBoundariesShouldUpdate(this.camera.zoomBoundaries, targetMinZoomLevel)){
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get restrictRelativeXTranslation(): boolean{
        return this.cameraRig.config.restrictRelativeXTranslation;
    }

    get restrictRelativeYTranslation(): boolean{
        return this.cameraRig.config.restrictRelativeYTranslation;
    }

    get restrictXTranslation(): boolean{
        return this.cameraRig.config.restrictXTranslation;
    }

    get restrictYTranslation(): boolean{
        return this.cameraRig.config.restrictYTranslation;
    }
    
    set restrictRelativeXTranslation(value: boolean){
        this.cameraRig.config.restrictRelativeXTranslation = value;
    }

    set restrictRelativeYTranslation(value: boolean){
        this.cameraRig.configure({restrictRelativeYTranslation: value});
    }

    set restrictXTranslation(value: boolean){
        this.cameraRig.configure({restrictXTranslation: value});
    }
    
    set restrictYTranslation(value: boolean){
        this.cameraRig.configure({restrictYTranslation: value});
    }

    get restrictZoom(): boolean{
        return this.cameraRig.config.restrictZoom;
    }

    set restrictZoom(value: boolean){
        this.cameraRig.configure({restrictZoom: value});
    }

    get restrictRotation(): boolean{
        return this.cameraRig.config.restrictRotation;
    }

    set restrictRotation(value: boolean){
        this.cameraRig.configure({restrictRotation: value});
    }

    get clampTranslation(): boolean{
        return this.cameraRig.config.clampTranslation;
    }

    set clampTranslation(value: boolean){
        this.cameraRig.configure({clampTranslation: value});
    }
    
    get clampZoom(): boolean{
        return this.cameraRig.config.clampZoom;
    }

    set clampZoom(value: boolean){
        this.cameraRig.configure({clampZoom: value});
    }

    get clampRotation(): boolean{
        return this.cameraRig.config.clampRotation;
    }

    set clampRotation(value: boolean){
        this.cameraRig.configure({clampRotation: value});
    }

    getCameraRig(): CameraRig {
        return this.cameraRig;
    }
}
