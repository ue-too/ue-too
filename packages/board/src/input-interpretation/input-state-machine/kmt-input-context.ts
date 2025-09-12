import { Point } from "@ue-too/math";
import { BaseContext, NO_OP } from "@ue-too/being";
import { UserInputPublisher } from "../raw-input-publisher";
import { CanvasPositionDimensionPublisher, getTrueRect, Observable, Observer, SubscriptionOptions, SynchronousObservable } from "../../utils";

export enum CursorStyle {
    GRAB = "grab",
    DEFAULT = "default",
    GRABBING = "grabbing"
}

/**
 * @description A proxy for the canvas so that client code that needs to access 
 * the canvas dimensions and position does not need to access the DOM directly.
 */
export interface Canvas {
    width: number;
    height: number;
    position: Point;
    setCursor: (style: CursorStyle) => void;
    dimensions: CanvasDimensions;
    detached: boolean;
}

export type CanvasDimensions = {width: number, height: number, position: Point};

/**
 * @description A dummy implementation of the CanvasOperator interface. 
 * This is specifically for the case where a input state machine that is for the relay of the input events to the web worker.
 * The input state machine needs a canvas operator in its context, but this context does not have any functionality.
 * @see DummyKmtInputContext
 */
export class DummyCanvas implements Canvas {
    width: number = 0;
    height: number = 0;
    position: Point = {x: 0, y: 0};
    setCursor: (style: CursorStyle) => void = NO_OP;
    dimensions: {width: number, height: number, position: Point} = {width: 0, height: 0, position: {x: 0, y: 0}};
    detached: boolean = false;
}

export class CanvasCacheInWebWorker implements Canvas {

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

    get dimensions(): {width: number, height: number, position: Point} {
        return {width: this._width, height: this._height, position: this._position};
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

    get detached(): boolean {
        return false;
    }
}

export class CanvasProxy implements Canvas, Observable<[CanvasDimensions]> {

    private _width: number = 0;
    private _height: number = 0;
    private _position: Point = {x: 0, y: 0};
    private _canvasPositionDimensionPublisher: CanvasPositionDimensionPublisher;
    private _canvas: HTMLCanvasElement | undefined;
    private _internalSizeUpdateObservable: Observable<[CanvasDimensions]>;

    constructor(canvas?: HTMLCanvasElement) {
        this._internalSizeUpdateObservable = new SynchronousObservable<[CanvasDimensions]>();

        if(canvas){
            const boundingRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(boundingRect, window.getComputedStyle(canvas));
            this._width = trueRect.width;
            this._height = trueRect.height;
            this._position = {x: trueRect.left, y: trueRect.top};
            this._canvas = canvas;
        }

        this._canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);
        this._canvasPositionDimensionPublisher.onPositionUpdate((rect)=>{
            // the rect is the canvas dimension in the DOM (the width and height attribute would need to multiply by the device pixel ratio)
            if(this._canvas == undefined){
                console.log('is not attached to any canvas should not have getting any updates');
                return;
            }

            this._width = rect.width;
            this._height = rect.height;
            this._position = {x: rect.left, y: rect.top};

            // console.log('syncing canvas dimension to adjust for high dpi display');
            this._canvas.style.width = rect.width + "px";
            this._canvas.style.height = rect.height + "px";
            this._canvas.width = rect.width * window.devicePixelRatio;
            this._canvas.height = rect.height * window.devicePixelRatio;

            this._internalSizeUpdateObservable.notify({
                width: this._width,
                height: this._height,
                position: this._position
            });
        });
    }

    subscribe(observer: Observer<[CanvasDimensions]>, options?: SubscriptionOptions): () => void {
        return this._internalSizeUpdateObservable.subscribe(observer, options);
    }

    notify(...data: [CanvasDimensions]): void {
        this._internalSizeUpdateObservable.notify(...data);
    }

    get detached(): boolean {
        return this._canvas === undefined;
    }

    get dimensions(): {width: number, height: number, position: Point} {
        return {width: this._width, height: this._height, position: this._position};
    }

    get width(): number {
        return this._width;
    }

    /**
     * set the width of the canvas
     * the width is synonymous with the canvas style width not the canvas width
     */
    setWidth(width: number){
        if(this._canvas){
            this._canvas.style.width = width + "px";
        }
    }

    /**
     * set the height of the canvas
     * the height is synonymous with the canvas style height not the canvas height
     */
    setHeight(height: number){
        if(this._canvas){
            this._canvas.style.height = height + "px";
        }
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: "grab" | "default" | "grabbing"): void {
        if(this._canvas){
            this._canvas.style.cursor = style;
        }
    }

    attach(canvas: HTMLCanvasElement){
        this._canvasPositionDimensionPublisher.attach(canvas);
        this._canvas = canvas;
        const boundingRect = canvas.getBoundingClientRect();
        const trueRect = getTrueRect(boundingRect, window.getComputedStyle(canvas));
        this._width = trueRect.width;
        this._height = trueRect.height;
        this._position = {x: trueRect.left, y: trueRect.top};
        this._internalSizeUpdateObservable.notify({
            width: this._width,
            height: this._height,
            position: this._position
        });
    }
}

/**
 * @description A proxy for the canvas that is used to communicate with the web worker.
 * The primary purpose of this class is to cache the canvas dimensions and position in the DOM to reduce the calling of the getBoundingClientRect method.
 * This class only serves as a relay of the updated canvas dimensions and position to the web worker.
 * 
 */
export class WorkerRelayCanvas implements Canvas {

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

    get dimensions(): {width: number, height: number, position: Point} {
        return {width: this._width, height: this._height, position: this._position};
    }

    get detached(): boolean {
        return false;
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
    canvas: Canvas;
    notifyOnPan: (delta: Point) => void;
    notifyOnZoom: (zoomAmount: number, anchorPoint: Point) => void;
    notifyOnRotate: (deltaRotation: number) => void;
    setInitialCursorPosition: (position: Point) => void;
    cancelCurrentAction: () => void;
    initialCursorPosition: Point;
}

/**
 * @description A dummy implementation of the KmtInputContext interface.
 * This is specifically for the case where a input state machine that is for the relay of the input events to the web worker.
 * The input state machine needs a context, but this context does not have any functionality.
 */
export class DummyKmtInputContext implements KmtInputContext {

    public alignCoordinateSystem: boolean = false;
    public canvas: Canvas = new DummyCanvas();
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

    cancelCurrentAction(): void {
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
    private _canvasOperator: Canvas;
    private _inputPublisher: UserInputPublisher;
    private _initialCursorPosition: Point;

    constructor(canvasOperator: Canvas, inputPublisher: UserInputPublisher){
        this._alignCoordinateSystem = true;
        this._canvasOperator = canvasOperator;
        this._inputPublisher = inputPublisher;
        this._initialCursorPosition = {x: 0, y: 0};
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    get canvas(): Canvas {
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

    cancelCurrentAction(): void {
        this._initialCursorPosition = {x: 0, y: 0};
    }

    setInitialCursorPosition(position: Point): void {
        this._initialCursorPosition = position;
    }

    cleanup(): void {
    }

    setup(): void {
    }
}
