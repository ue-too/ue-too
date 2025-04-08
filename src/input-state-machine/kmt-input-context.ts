import { Point } from "src/util/misc";
import { BaseContext } from "src/being";
import { RawUserInputPublisher } from "src/raw-input-publisher/raw-input-publisher";
import { CanvasPositionDimensionPublisher } from "src/boardify/utils/canvas-position-dimension";
import { Observer } from "src/util/observable";
import { SubscriptionOptions } from "src/util/observable";

export interface CanvasOperator {
    width: number;
    height: number;
    position: Point;
    setCursor: (style: "grab" | "default" | "grabbing") => void;
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
export class CanvasProxyWorkerRelay {

    private _webWorker: Worker;

    constructor(canvas: HTMLCanvasElement, webWorker: Worker, canvasDiemsionPublisher: CanvasPositionDimensionPublisher){
        const boundingRect = canvas.getBoundingClientRect();
        this._webWorker = webWorker;
        this._webWorker.postMessage({type: "setCanvasDimensions", width: boundingRect.width, height: boundingRect.height, position: {x: boundingRect.left, y: boundingRect.top}});
        canvasDiemsionPublisher.onPositionUpdate((rect)=>{
            this._webWorker.postMessage({type: "updateCanvasDimensions", width: rect.width, height: rect.height, position: {x: rect.left, y: rect.top}});
        });
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

/**
 * @description The observable input tracker.
 * This is used as the context for the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class ObservableInputTracker implements KmtInputContext {

    private _alignCoordinateSystem: boolean;
    private _canvasOperator: CanvasOperator;
    private _inputPublisher: RawUserInputPublisher;
    private _initialCursorPosition: Point;

    constructor(canvasOperator: CanvasOperator, inputPublisher: RawUserInputPublisher){
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
