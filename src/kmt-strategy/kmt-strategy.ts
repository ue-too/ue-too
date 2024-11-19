import { InputObserver } from "src/input-observer/input-observer";
import { StateManager } from "./states";
import { createDefaultInputStateManager, DefaultInputStateManager } from "src/input-state-manager";
import { userInputStateMachine } from "src/being/state";

/**
 * @category Input Strategy
 */
export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    canvas: HTMLCanvasElement;
    inputObserver: InputObserver;
    stateMachine: typeof userInputStateMachine;
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
    private _stateMachine: typeof userInputStateMachine;

    constructor(canvas: HTMLCanvasElement, inputObserver: InputObserver, stateManager: StateManager, experimentalInputStateManager: DefaultInputStateManager, debugMode: boolean = false, alignCoordinateSystem: boolean = true, stateMachine: typeof userInputStateMachine = userInputStateMachine){
        this._canvas = canvas;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this._inputObserver = inputObserver;
        this._stateManager = stateManager;
        this._experimentalInputStateManager = experimentalInputStateManager;
        this._stateMachine = stateMachine;
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

    get stateMachine(): typeof userInputStateMachine {
        return this._stateMachine;
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
        if(e.button === 0){
            userInputStateMachine.happens("leftPointerDown", {position: {x: e.clientX, y: e.clientY}});
            return;
        }
        // if(e.button === 1){
        //     userInputStateMachine.happens("middlePointerDown", {position: {x: e.clientX, y: e.clientY}});
        //     return;
        // }
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        this._stateManager.state.pointerUpHandler(e);
        this._experimentalInputStateManager.update("pointerUpHandler", e);
        if(e.button === 0){
            userInputStateMachine.happens("leftPointerUp", {position: {x: e.clientX, y: e.clientY}});
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        this._stateManager.state.pointerMoveHandler(e);
        this._experimentalInputStateManager.update("pointerMoveHandler", e);
        userInputStateMachine.happens("pointerMove", {position: {x: e.clientX, y: e.clientY}});
    }

    scrollHandler(e: WheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        this._stateManager.state.scrollHandler(e);
        this._experimentalInputStateManager.update("scrollHandler", e);
    }

    keypressHandler(e: KeyboardEvent){
        this._stateManager.state.keypressHandler(e);
        this._experimentalInputStateManager.update("keypressHandler", e);
        if(e.key === " "){
            userInputStateMachine.happens("spacebarDown", {});
        }
    }

    keyupHandler(e: KeyboardEvent){
        this._stateManager.state.keyupHandler(e);
        this._experimentalInputStateManager.update("keyupHandler", e);
        if(e.key === " "){
            userInputStateMachine.happens("spacebarUp", {});
        }
    }

}
