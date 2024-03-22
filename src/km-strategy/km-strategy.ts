import { PointCal } from "point2point";
import { Point } from "..";
import BoardElement from "../board-element";
import Board from "../boardify";
import BoardCamera from "../board-camera/board-camera";

/**
 * @category Keyboard-Mouse Strategy
 */
export interface BoardKMStrategy {
    limitEntireViewPort: boolean;
    disabled: boolean;
    debugMode: boolean;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
}


export class DefaultBoardElementKMStrategy implements BoardKMStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: BoardElement;
    private camera: BoardCamera;
    private _disabled: boolean;
    private _limitEntireViewPort: boolean;
    private _debugMode: boolean;

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }

    get debugMode(): boolean {
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
    }

    constructor(canvas: BoardElement, camera: BoardCamera, limitEntireViewPort: boolean = true, debugMode: boolean = false){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this.canvas = canvas;
        this.camera = camera;
        this._limitEntireViewPort = limitEntireViewPort;
        this._debugMode = debugMode;
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    }

    pointerDownHandler(e: PointerEvent){
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey)){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    disableStrategy(): void {
        this.dragStartPoint = {x: 0, y: 0};
        this.isDragging = false;
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse"){
            if (this.isDragging) {
                this.isDragging = false;
            }
            if (!this.canvas.debugMode) {
                this.canvas.getInternalCanvas().style.cursor = "auto";
            } else {
                this.canvas.getInternalCanvas().style.cursor = "none";
            }
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if (e.pointerType == "mouse" && this.isDragging){
            this.canvas.getInternalCanvas().style.cursor = "grabbing";
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            if(this._limitEntireViewPort){
                this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
            } else {
                this.camera.moveWithClampFromGesture(diffInWorld);
            }
            this.dragStartPoint = target;
        }
    }
    get disabled(): boolean {
        return this._disabled;
    }
}

export class DefaultBoardKMStrategy implements BoardKMStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: HTMLCanvasElement;
    private camera: BoardCamera;
    private _disabled: boolean;
    private _limitEntireViewPort: boolean;
    private _debugMode: boolean;

    constructor(canvas: HTMLCanvasElement, camera:BoardCamera, limitEntireViewPort: boolean = true, debugMode: boolean = false){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this.canvas = canvas;
        this.camera = camera;
        this._limitEntireViewPort = limitEntireViewPort;
        this._debugMode = debugMode;
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }

    get debugMode(): boolean {
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    }

    pointerDownHandler(e: PointerEvent){
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey)){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse"){
            if (this.isDragging) {
                this.isDragging = false;
            }
            if (!this._debugMode) {
                this.canvas.style.cursor = "auto";
            } else {
                this.canvas.style.cursor = "none";
            }
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if (e.pointerType == "mouse" && this.isDragging){
            this.canvas.style.cursor = "grabbing";
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
            if(this._limitEntireViewPort){
                this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
            } else {
                this.camera.moveWithClampFromGesture(diffInWorld);
            }
            this.dragStartPoint = target;
        }
    }
    get disabled(): boolean {
        return this._disabled;
    }
}