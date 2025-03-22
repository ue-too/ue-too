import { Point } from "src/util/misc";
import { BaseContext } from "src/being";
import { RawUserInputPublisher } from "src/raw-input-publisher/raw-input-publisher";
import { CanvasPositionDimensionPublisher } from "src/boardify/utils/canvas-position-dimension";

export interface CanvasOperator {
    width: number;
    height: number;
    position: Point;
    setCursor: (style: "grab" | "default" | "grabbing") => void;
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
