import { BoardCamera, BoardCameraV2, PanRig, ZoomRig } from 'src/board-camera';
import { BoardKMTStrategyV2, DefaultBoardKMTStrategyV2 } from 'src/kmt-strategy';
import { BoardTouchStrategyV2, DefaultTouchStrategy } from 'src/touch-strategy';
import { Point } from 'src';
import { PointCal } from 'point2point';

export class BoardV2 {
    
    private _camera: BoardCamera;
    private _panHandler: PanRig;
    private _zoomHandler: ZoomRig;
    private _canvas: HTMLCanvasElement;
    private _context: CanvasRenderingContext2D;

    private _kmtStrategy: BoardKMTStrategyV2;
    private _touchStrategy: BoardTouchStrategyV2;

    private _alignCoordinateSystem: boolean = true;

    private lastUpdateTime: number = 0;
    
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

        this._kmtStrategy = new DefaultBoardKMTStrategyV2(this._canvas, this._camera, this._panHandler, this._zoomHandler);
        this._touchStrategy = new DefaultTouchStrategy(this._canvas, this._camera, this._panHandler, this._zoomHandler);
        this.setUp();
    }

    private setUp(){
        this._kmtStrategy.setUp();
        this._touchStrategy.setUp();

        this.bindFunctions();
    }

    private bindFunctions(){
        this.step = this.step.bind(this);
    }

    set alignCoordinateSystem(align: boolean){
        this._alignCoordinateSystem = align;
        this._kmtStrategy.alignCoordinateSystem = align;
        this._touchStrategy.alignCoordinateSystem = align;
    }

    get alignCoordinateSystem(): boolean{
        return this._alignCoordinateSystem;
    }

    set limitEntireViewPort(limit: boolean){
        this._panHandler.limitEntireViewPort = limit;
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

        this.drawReferenceCircle(this._context, {x: 30, y: 20});
    }

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

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
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

}