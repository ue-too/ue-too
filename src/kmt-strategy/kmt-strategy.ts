import { KmtInputStateMachine } from "src/input-state-machine";
import { KmtIdleState, InitialPanState, PanState, PanViaScrollWheelState, ReadyToPanViaScrollWheelState, ReadyToPanViaSpaceBarState, ReadyToSelectState } from "src/input-state-machine";
import { ObservableInputTracker} from "src/input-state-machine/kmt-input-context";
import type { KmtInputEventMapping, KmtInputContext, KmtInputStates } from "src/input-state-machine";
import type { InputFlowControl } from "src/input-flow-control/control-center"
import { RawUserInputObservable } from "src/input-observer/input-observer";

/**
 * @category Input Strategy
 */

export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    stateMachine: KmtInputStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>;
    setUp(): void;
    tearDown(): void;
}

export type MinimumPointerEvent = {
    button: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    buttons: number;
}

export type MinimumWheelEvent = {
    preventDefault: () => void;
    deltaX: number;
    deltaY: number;
    ctrlKey: boolean;
    clientX: number;
    clientY: number;
}

export type MinimumKeyboardEvent = {
    preventDefault: () => void;
    key: string;
};

export type EventTargetWithPointerEvents = {
    addEventListener: (type: string, listener: (event: any) => void, options?: {passive: boolean}) => void;
    removeEventListener: (type: string, listener: (event: any) => void) => void;
};

export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    // private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _debugMode: boolean;

    private _inputTracker: ObservableInputTracker;
    private _stateMachine: KmtInputStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>;

    private _keyfirstPressed: Map<string, boolean>;

    private _eventTarget: EventTargetWithPointerEvents;

    constructor(canvas: HTMLCanvasElement, eventTarget: EventTargetWithPointerEvents, inputPublisher: RawUserInputObservable, debugMode: boolean = false){
        this._debugMode = debugMode;
        this.bindFunctions();
        this._inputTracker = new ObservableInputTracker(canvas, inputPublisher);
        this._stateMachine =  new KmtInputStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>(
            {
                IDLE: new KmtIdleState(),
                READY_TO_SELECT: new ReadyToSelectState(),
                READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
                INITIAL_PAN: new InitialPanState(),
                PAN: new PanState(),
                READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
                PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
            },
            "IDLE",
            this._inputTracker
        );
        this._keyfirstPressed = new Map();
        this._eventTarget = eventTarget;
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

    get inputTracker(): ObservableInputTracker {
        return this._inputTracker;
    }

    get stateMachine(): KmtInputStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._stateMachine;
    }

    set alignCoordinateSystem(value: boolean){
        this._inputTracker.alignCoordinateSystem = value;
    }

    get alignCoordinateSystem(): boolean {
        return this._inputTracker.alignCoordinateSystem;
    }

    setUp(): void {
        this.addEventListeners(this._eventTarget);
    }

    addEventListeners(eventTarget: EventTargetWithPointerEvents){
        eventTarget.addEventListener('pointerdown', this.pointerDownHandler);
        eventTarget.addEventListener('pointerup', this.pointerUpHandler);
        eventTarget.addEventListener('pointermove', this.pointerMoveHandler);
        eventTarget.addEventListener('wheel', this.scrollHandler);
        window.addEventListener('keydown', this.keypressHandler);
        window.addEventListener('keyup', this.keyupHandler);
    }

    tearDown(): void {
        this._eventTarget.removeEventListener('pointerdown', this.pointerDownHandler);
        this._eventTarget.removeEventListener('pointerup', this.pointerUpHandler);
        this._eventTarget.removeEventListener('pointermove', this.pointerMoveHandler);
        this._eventTarget.removeEventListener('wheel', this.scrollHandler);
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

    pointerDownHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerDown", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
    }

    pointerUpHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerUp", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
    }

    pointerMoveHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.buttons === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
        if(e.buttons === 4 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerMove", {x: e.clientX, y: e.clientY}, this._inputTracker);
            return;
        }
    }

    scrollHandler(e: MinimumWheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.ctrlKey){
            this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY}, this._inputTracker);
        } else {
            this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY}, this._inputTracker);
        }
    }

    keypressHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if(e.key === " "){
            e.preventDefault();
            this.stateMachine.happens("spacebarDown", {}, this._inputTracker);
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            this._keyfirstPressed.delete(e.key);
        }
        if(e.key === " "){
            this.stateMachine.happens("spacebarUp", {}, this._inputTracker);
        }
    }

}
