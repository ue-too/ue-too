import BoardCameraV2, { BoardCamera } from 'src/board-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf, boundariesFullyDefined, } from 'src/board-camera/utils/position';
import { PanRig, PanController } from 'src/board-camera/pan';
import { ZoomRig, ZoomController } from 'src/board-camera/zoom';
import { RotationRig, RotationController } from 'src/board-camera/rotation';
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
 * @translationBlock This is the overall board class that is used to manage the canvas and the camera. 
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
        // this._camera.zoomBoundaries = {min: 0.1, max: 10};
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

    set alignCoordinateSystem(align: boolean){
        this._alignCoordinateSystem = align;
        this._kmtStrategy.alignCoordinateSystem = align;
        this._touchStrategy.alignCoordinateSystem = align;
    }

    get alignCoordinateSystem(): boolean{
        return this._alignCoordinateSystem;
    }

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

    get context(): CanvasRenderingContext2D{
        return this._context;
    }

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

    get camera(): BoardCamera{
        return this.boardStateObserver.camera;
    }

    set camera(camera: BoardCamera){
        camera.viewPortHeight = this._canvas.height;
        camera.viewPortWidth = this._canvas.width;
        this.boardStateObserver.camera = camera;
    }

    set panHandler(handler: PanController){
        this.boardInputObserver.controlCenter.panController = handler;
    }

    get panHandler(): PanController{
        return this.boardInputObserver.controlCenter.panController;
    }

    set zoomHandler(handler: ZoomController){
        this.boardStateObserver.zoomHandler = handler;
    }

    get zoomHandler(): ZoomController{
        return this.boardStateObserver.zoomHandler;
    }

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

    public step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        const curBoundaries = this.boardStateObserver.camera.boundaries;
        if (!boundariesFullyDefined(curBoundaries)){
            throw new Error("Boundaries are not fully defined");
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

    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        if(this._alignCoordinateSystem){
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this.boardStateObserver.camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        } else {
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this.boardStateObserver.camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        }
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe {
        return this.boardStateObserver.camera.on(eventName, callback);
    }

    onInput<K extends keyof BoardInputEvent>(eventName: K, callback: (event: BoardInputEvent[K])=> void): UnsubscribeToInput {
        return this.boardInputObserver.onInput(eventName, callback);
    }

    get maxHalfTransHeight(): number | undefined{
        return halfTranslationHeightOf(this.boardStateObserver.camera.boundaries);
    }

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
