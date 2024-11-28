import { InputObserver } from "src/input-observer/input-observer";
import { GenericStateMachine } from "src/being/interfaces";
import type { BoardEventMapping, BoardContext, BoardStates } from "src/being/input-state-machine";
import { BoardIdleState, BoardWorld, InitialPanState, PanState, ReadyToPanViaSpaceBarState, ReadyToSelectState, SelectingState } from "src/being/input-state-machine";

/**
 * @category Input Strategy
 */

const boardWorld = new BoardWorld();
export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    canvas: HTMLCanvasElement;
    inputObserver: InputObserver;
    stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>;
    setUp(): void;
    tearDown(): void;
}

export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;

    private _inputObserver: InputObserver;

    private _stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>;

    private _keyfirstPressed: Map<string, boolean>;
    private leftPointerDown: boolean;

    constructor(canvas: HTMLCanvasElement, inputObserver: InputObserver, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this._inputObserver = inputObserver;
        this._stateMachine =  new GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>(
            {
                IDLE: new BoardIdleState(boardWorld),
                READY_TO_SELECT: new ReadyToSelectState(),
                SELECTING: new SelectingState(),
                READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
                INITIAL_PAN: new InitialPanState(),
                PAN: new PanState(),
            },
            "IDLE",
            {
                initialX: 0,
                initialY: 0,
            },
            inputObserver,
            canvas
        );
        this._keyfirstPressed = new Map();
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

    get stateMachine(): GenericStateMachine<BoardEventMapping, BoardContext, BoardStates> {
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
        if(e.button === 0){
            this.leftPointerDown = true;
            this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY});
        }
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0){
            this.leftPointerDown = false;
            this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY});
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(this.leftPointerDown){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY});
        }
    }

    scrollHandler(e: WheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.ctrlKey){
            this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY});
        } else {
            this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY});
        }
    }

    keypressHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if(e.key === " "){
            this.stateMachine.happens("spacebarDown", {});
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            this._keyfirstPressed.delete(e.key);
        }
        if(e.key === " "){
            this.stateMachine.happens("spacebarUp", {});
        }
    }

}
