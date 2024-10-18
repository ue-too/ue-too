import { InputObserver } from "src/input-observer/input-observer";
import { StateManager } from "./states";
import { createDefaultInputStateManager, DefaultInputStateManager } from "src/input-state-manager";
/**
 * @category Input Strategy
 */
export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    canvas: HTMLCanvasElement;
    inputObserver: InputObserver;
    setUp(): void;
    tearDown(): void;
}

export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;

    private _inputObserver: InputObserver;
    private _stateManager: StateManager;

    private _experimentalInputStateManager: DefaultInputStateManager;

    constructor(canvas: HTMLCanvasElement, inputObserver: InputObserver, stateManager: StateManager, experimentalInputStateManager: DefaultInputStateManager, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this._inputObserver = inputObserver;
        this._stateManager = stateManager;
        this._experimentalInputStateManager = experimentalInputStateManager;
    }

    get debugMode(): boolean {
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean){
        this._disabled = value;
        this._stateManager.state.resetInternalStates();
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean){
        this._alignCoordinateSystem = value;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    get inputObserver(): InputObserver {
        return this._inputObserver;
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.addEventListener('wheel', this.scrollHandler);
        window.addEventListener('keydown', this.keypressHandler);
        window.addEventListener('keyup', this.keyupHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.removeEventListener('wheel', this.scrollHandler);
        window.removeEventListener('keydown', this.keypressHandler);
        window.removeEventListener('keyup', this.keyupHandler);
    }

    bindFunctions(): void {
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.keypressHandler = this.keypressHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
    }

    pointerDownHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        this._stateManager.state.pointerDownHandler(e);
        this._experimentalInputStateManager.update("pointerDownHandler", e);
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        this._stateManager.state.pointerUpHandler(e);
        this._experimentalInputStateManager.update("pointerUpHandler", e);
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        this._stateManager.state.pointerMoveHandler(e);
        this._experimentalInputStateManager.update("pointerMoveHandler", e);
    }

    scrollHandler(e: WheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        this._stateManager.state.scrollHandler(e);
    }

    keypressHandler(e: KeyboardEvent){
        this._stateManager.state.keypressHandler(e);
        this._experimentalInputStateManager.update("keypressHandler", e);
    }

    keyupHandler(e: KeyboardEvent){
        this._stateManager.state.keyupHandler(e);
        this._experimentalInputStateManager.update("keyupHandler", e);
    }

}
