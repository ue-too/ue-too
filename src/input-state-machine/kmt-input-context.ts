import { Point } from "src/util/misc";
import { BaseContext, NO_OP } from "src/being";
import { UserInputPublisher } from "src/raw-input-publisher/raw-input-publisher";
import { CanvasPositionDimensionPublisher, getTrueRect } from "src/boardify/utils/canvas-position-dimension";

export interface CanvasOperator {
    width: number;
    height: number;
    position: Point;
    setCursor: (style: "grab" | "default" | "grabbing") => void;
}

export class DummyCanvasOperator implements CanvasOperator {
    width: number = 0;
    height: number = 0;
    position: Point = {x: 0, y: 0};
    setCursor: (style: "grab" | "default" | "grabbing") => void = NO_OP;
}

export class CanvasCacheInWebWorker implements CanvasOperator {

    private _width: number;
    private _height: number;
    private _position: Point;
    private _postMessageFunction: typeof postMessage;

    constructor(postMessageFunction: typeof postMessage){
        this._width = 0;
        this._height = 0;
        this._position = {x: 0, y: 0};
        this._postMessageFunction = postMessageFunction;
    }

    set width(width: number){
        this._width = width;
    }

    set height(height: number){
        this._height = height;
    }

    set position(position: Point){
        this._position = position;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: "grab" | "default" | "grabbing"): void {
        this._postMessageFunction({type: "setCursor", style});
    }
}

export class CanvasPositionDimensionWorkerPublisher {

    private _canvasPositionDimensionPublisher: CanvasPositionDimensionPublisher;

    constructor(private _worker: Worker, canvas: HTMLCanvasElement){
        this._canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);
        this._canvasPositionDimensionPublisher.onPositionUpdate(this.notifyWorker.bind(this));
    }

    dispose(): void {
        this._canvasPositionDimensionPublisher.dispose();
    }
    
    private notifyWorker(rect: DOMRect): void {
        this._worker.postMessage({
            type: "canvasPositionDimension",
            payload: rect
        });
    }
}

export class CanvasProxy implements CanvasOperator {

    private _width: number;
    private _height: number;
    private _position: Point;
    private _canvasPositionDimensionPublisher: CanvasPositionDimensionPublisher;
    private _canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement, canvasPositionDimensionPublisher: CanvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas)) {
        const boundingRect = canvas.getBoundingClientRect();
        this._width = boundingRect.width;
        this._height = boundingRect.height;
        this._position = {x: boundingRect.left, y: boundingRect.top};
        this._canvas = canvas;
        this._canvasPositionDimensionPublisher = canvasPositionDimensionPublisher;
        this._canvasPositionDimensionPublisher.onPositionUpdate((rect)=>{
            this._width = rect.width;
            this._height = rect.height;
            this._position = {x: rect.left, y: rect.top};
        });
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: "grab" | "default" | "grabbing"): void {
        this._canvas.style.cursor = style;
    }
}

/**
 * @description A proxy for the canvas that is used to communicate with the web worker.
 * The primary purpose of this class is to cache the canvas dimensions and position in the DOM to reduce the calling of the getBoundingClientRect method.
 * This class only serves as a relay of the updated canvas dimensions and position to the web worker.
 * 
 */
export class CanvasProxyWorkerRelay implements CanvasOperator {

    private _width: number;
    private _height: number;
    private _position: Point;
    private _webWorker: Worker;
    private _canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement, webWorker: Worker, canvasDiemsionPublisher: CanvasPositionDimensionPublisher){
        const boundingRect = canvas.getBoundingClientRect();
        this._canvas = canvas;
        this._webWorker = webWorker;
        const trueRect = getTrueRect(boundingRect, window.getComputedStyle(canvas));
        this._width = trueRect.width;
        this._height = trueRect.height;
        this._position = {x: trueRect.left, y: trueRect.top};
        this._webWorker.postMessage({type: "setCanvasDimensions", width: boundingRect.width, height: boundingRect.height, position: {x: boundingRect.left, y: boundingRect.top}});
        canvasDiemsionPublisher.onPositionUpdate((rect)=>{
            this._width = rect.width;
            this._height = rect.height;
            this._position = {x: rect.left, y: rect.top};
            this._webWorker.postMessage({type: "updateCanvasDimensions", width: rect.width, height: rect.height, position: {x: rect.left, y: rect.top}});
        });
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: "grab" | "default" | "grabbing"): void {
        this._canvas.style.cursor = style;
    }
}

/**
 * @description The context for the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export interface KmtInputContext extends BaseContext {
    alignCoordinateSystem: boolean;
    canvas: CanvasOperator;
    notifyOnPan: (delta: Point) => void;
    notifyOnZoom: (zoomAmount: number, anchorPoint: Point) => void;
    notifyOnRotate: (deltaRotation: number) => void;
    setInitialCursorPosition: (position: Point) => void;
    initialCursorPosition: Point;
}

export class DummyKmtInputContext implements KmtInputContext {

    public alignCoordinateSystem: boolean = false;
    public canvas: CanvasOperator = new DummyCanvasOperator();
    public initialCursorPosition: Point = {x: 0, y: 0};

    constructor(){

    }

    notifyOnPan(delta: Point): void {
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point): void {
    }

    notifyOnRotate(deltaRotation: number): void {
    }
    
    setInitialCursorPosition(position: Point): void {
    }

    cleanup(): void {
    }

    setup(): void {
    }
}

/**
 * @description The observable input tracker.
 * This is used as the context for the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class ObservableInputTracker implements KmtInputContext {

    private _alignCoordinateSystem: boolean;
    private _canvasOperator: CanvasOperator;
    private _inputPublisher: UserInputPublisher;
    private _initialCursorPosition: Point;

    constructor(canvasOperator: CanvasOperator, inputPublisher: UserInputPublisher){
        this._alignCoordinateSystem = true;
        this._canvasOperator = canvasOperator;
        this._inputPublisher = inputPublisher;
        this._initialCursorPosition = {x: 0, y: 0};
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    get canvas(): CanvasOperator {
        return this._canvasOperator;
    }

    get initialCursorPosition(): Point {
        return this._initialCursorPosition;
    }

    set alignCoordinateSystem(value: boolean){
        this._alignCoordinateSystem = value;
    }

    notifyOnPan(delta: Point): void {
        this._inputPublisher.notifyPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point): void {
        this._inputPublisher.notifyZoom(zoomAmount, anchorPoint);
    }

    notifyOnRotate(deltaRotation: number): void {
        this._inputPublisher.notifyRotate(deltaRotation);
    }

    setInitialCursorPosition(position: Point): void {
        this._initialCursorPosition = position;
    }

    cleanup(): void {
    }

    setup(): void {
    }
}
