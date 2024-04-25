import { BoardCamera, BoardCameraV2 } from 'src/board-camera';
import { halfTranslationHeightOf, halfTranslationWidthOf } from 'src/board-camera/utils/position';
import { PanRig, PanController } from 'src/board-camera/pan';
import { ZoomRig, ZoomController } from 'src/board-camera/zoom';
import { BoardKMTStrategyV2, DefaultBoardKMTStrategyV2 } from 'src/kmt-strategy';
import { BoardTouchStrategyV2, DefaultTouchStrategy } from 'src/touch-strategy';
import { Point } from 'src';
import { PointCal } from 'point2point';

import { CameraEvent, CameraState } from 'src/camera-observer';
import { minZoomLevelBaseOnDimensions, minZoomLevelBaseOnHeight, minZoomLevelBaseOnWidth, zoomLevelBoundariesShouldUpdate } from 'src/boardify/utils';
import { drawReferenceCircle } from 'src/boardify/utils';
export class BoardV2 {
    
    private _camera: BoardCamera;
    private _panHandler: PanController;
    private _zoomHandler: ZoomController;
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;

    private _kmtStrategy: BoardKMTStrategyV2;
    private _touchStrategy: BoardTouchStrategyV2;

    private _alignCoordinateSystem: boolean = true;
    private _fullScreen: boolean = false;

    private lastUpdateTime: number = 0;

    private attributeObserver: MutationObserver;
    private windowResizeObserver: ResizeObserver;
    
    constructor(canvas: HTMLCanvasElement){
        this._canvas = canvas;
        this._camera = new BoardCameraV2();
        this._camera.viewPortWidth = canvas.width;
        this._camera.viewPortHeight = canvas.height;
        this._camera.boundaries = {min: {x: -5000, y: -5000}, max: {x: 5000, y: 5000}};
        // this._camera.zoomBoundaries = {min: 0.1, max: 10};
        this._context = canvas.getContext('2d') as CanvasRenderingContext2D;

        this._panHandler = new PanRig(this._camera);
        this._zoomHandler = new ZoomRig(this._camera, this._panHandler);

        this.bindFunctions();

        this.attributeObserver = new MutationObserver(this.attributeCallBack);
        this.attributeObserver.observe(this._canvas, {attributes: true});

        this.windowResizeObserver = new ResizeObserver(this.windowResizeHandler);
        this.windowResizeObserver.observe(document.body);

        this._kmtStrategy = new DefaultBoardKMTStrategyV2(this._canvas, this._camera, this._panHandler, this._zoomHandler);
        this._touchStrategy = new DefaultTouchStrategy(this._canvas, this._camera, this._panHandler, this._zoomHandler);
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
        this._camera.viewPortWidth = width;
    }

    get width(): number {
        return this._canvas.width;
    }

    set height(height: number){
        this._canvas.height = height;
        this._camera.viewPortHeight = height;
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

    set limitEntireViewPort(value: boolean){
        this._panHandler.limitEntireViewPort = value;
        if(value){
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(this._camera.boundaries, this._canvas.width, this._canvas.height, this._camera.rotation);
            if(targetMinZoomLevel != undefined && zoomLevelBoundariesShouldUpdate(this._camera.zoomBoundaries, targetMinZoomLevel)){
                this._camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get limitEntireViewPort(): boolean{
        return this._panHandler.limitEntireViewPort;
    }

    set kmtStrategy(strategy: BoardKMTStrategyV2){
        this._kmtStrategy.tearDown();
        strategy.setUp();
        this._kmtStrategy = strategy;
    }

    get camera(): BoardCamera{
        return this._camera;
    }

    public step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        const curBoundaries = this._camera.boundaries;
        this._context.clearRect(curBoundaries.min.x, -curBoundaries.min.y, curBoundaries.max.x - curBoundaries.min.x, -(curBoundaries.max.y - curBoundaries.min.y));

        this._context.translate( this._canvas.width / 2, this._canvas.height / 2 );
        this._context.scale(this._camera.zoomLevel, this._camera.zoomLevel);
        if (this._alignCoordinateSystem){
            this._context.rotate(-this._camera.rotation);
            this._context.translate(-this._camera.position.x,  -this._camera.position.y);
        } else {
            this._context.rotate(this._camera.rotation);
            this._context.translate(-this._camera.position.x,  this._camera.position.y);
        }

        drawReferenceCircle(this._context, {x: 30, y: 20}, this._alignCoordinateSystem);
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
            return this._camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        } else {
            const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
            return this._camera.convertFromViewPort2WorldSpace(pointInCameraViewPort);
        }
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): void {
        this._camera.on(eventName, callback);
    }

    get maxHalfTransHeight(): number | undefined{
        return halfTranslationHeightOf(this._camera.boundaries);
    }

    get maxHalfTransWidth(): number | undefined{
        return halfTranslationWidthOf(this._camera.boundaries);
    }

    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    // console.log("width changed");
                    this._camera.viewPortWidth = this._canvas.width;
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnWidth(this._camera.boundaries, this._canvas.width, this._canvas.height, this._camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this._camera.zoomBoundaries, targetMinZoomLevel)){
                            this._camera.setMinZoomLevel(targetMinZoomLevel);
                        }
                    }
                } else if(mutation.attributeName === "height"){
                    // console.log("height changed");
                    this._camera.viewPortHeight = this._canvas.height;
                    if(this.limitEntireViewPort){
                        const targetMinZoomLevel = minZoomLevelBaseOnHeight(this._camera.boundaries, this._canvas.width, this._canvas.height, this._camera.rotation);
                        if(zoomLevelBoundariesShouldUpdate(this._camera.zoomBoundaries, targetMinZoomLevel)){
                            this._camera.setMinZoomLevel(targetMinZoomLevel);
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
        const curBoundaries = this._camera.boundaries;
        const curMin = curBoundaries == undefined ? undefined: curBoundaries.min;
        const curHorizontalMin = curMin == undefined ? undefined: curMin.x;
        if(curHorizontalMin == undefined){
            this._camera.setHorizontalBoundaries(-value, value);
        } else {
            this._camera.setHorizontalBoundaries(curHorizontalMin, curHorizontalMin + value * 2);
        }
        if(this.limitEntireViewPort){
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(this._camera.boundaries, this._canvas.width, this._canvas.height, this._camera.rotation);
            if(zoomLevelBoundariesShouldUpdate(this._camera.zoomBoundaries, targetMinZoomLevel)){
                this._camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }
}
