import { Point } from "src/index";
import type { InputControlCenter } from "src/control-center/control-center";
import { RawUserInputObservable } from "src/input-observer/input-observer";

export interface KmtInputContext {
    alignCoordinateSystem: boolean;
    canvas: HTMLCanvasElement;
    notifyOnPan: (delta: Point) => void;
    notifyOnZoom: (zoomAmount: number, anchorPoint: Point) => void; 
    notifyOnRotate: (deltaRotation: number) => void;
    setInitialCursorPosition: (position: Point) => void;
    initialCursorPosition: Point;
}

export class ObservableInputTracker implements KmtInputContext {

    private _alignCoordinateSystem: boolean;
    private _canvas: HTMLCanvasElement;
    private _inputObserver: RawUserInputObservable;
    private _initialCursorPosition: Point;

    constructor(canvas: HTMLCanvasElement, controlCenter: InputControlCenter){
        this._alignCoordinateSystem = true;
        this._canvas = canvas;
        this._inputObserver = new RawUserInputObservable(controlCenter);
        this._initialCursorPosition = {x: 0, y: 0};
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    get initialCursorPosition(): Point {
        return this._initialCursorPosition;
    }

    notifyOnPan(delta: Point): void {
        this._inputObserver.notifyPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point): void {
        this._inputObserver.notifyZoom(zoomAmount, anchorPoint);
    }

    notifyOnRotate(deltaRotation: number): void {
        this._inputObserver.notifyRotate(deltaRotation);
    }

    setInitialCursorPosition(position: Point): void {
        this._initialCursorPosition = position;
    }
    
}

