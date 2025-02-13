import { InputObserver, RawUserInputObservable } from "src/input-observer/input-observer";
import { UserInputStateMachine } from "src/input-state-machine";
import type { BoardEventMapping, BoardContext, BoardStates } from "src/input-state-machine";
import { BoardIdleState, InitialPanState, PanState, PanViaScrollWheelState, ReadyToPanViaScrollWheelState, ReadyToPanViaSpaceBarState, ReadyToSelectState, SelectingState } from "src/input-state-machine";
import { Point } from "src";
import { SelectionInputObserver } from "src/selection-box";

/**
 * @category Input Strategy
 */

export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    canvas: HTMLCanvasElement;
    inputObserver: RawUserInputObservable;
    selectionInputObserver: SelectionInputObserver;
    stateMachine: UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates>;
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

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;

    private _inputObserver: RawUserInputObservable;
    private _selectionInputObserver: SelectionInputObserver;
    private _stateMachine: UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates>;

    private _keyfirstPressed: Map<string, boolean>;
    private leftPointerDown: boolean;
    private middlePointerDown: boolean;
    private _initialCursorPosition: Point;

    private _eventTarget: EventTargetWithPointerEvents;

    constructor(canvas: HTMLCanvasElement, eventTarget: EventTargetWithPointerEvents, inputObserver: RawUserInputObservable, selectionInputObserver: SelectionInputObserver, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this._inputObserver = inputObserver;
        this._selectionInputObserver = selectionInputObserver;
        this._stateMachine =  new UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates>(
            {
                IDLE: new BoardIdleState(),
                READY_TO_SELECT: new ReadyToSelectState(),
                SELECTING: new SelectingState(),
                READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
                INITIAL_PAN: new InitialPanState(),
                PAN: new PanState(),
                READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
                PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
            },
            "IDLE",
            this
        );
        this._keyfirstPressed = new Map();
        this._eventTarget = eventTarget;
    }

    toggleSelectionBox(value: boolean){
        this._selectionInputObserver.toggleSelectionBox(value);
    }

    setSelectionEndPoint(point: Point){
        this._selectionInputObserver.notifySelectionEndPoint(point);
    }

    setSelectionStartPoint(point: Point){
        this._selectionInputObserver.notifySelectionStartPoint(point);
    }

    notifyOnPan(delta: Point){
        this._inputObserver.notifyPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point){
        this._inputObserver.notifyZoom(zoomAmount, anchorPoint);
    }

    setInitialCursorPosition(position: Point){
        this._initialCursorPosition = position;
    }

    get initialCursorPosition(): Point {
        return this._initialCursorPosition;
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

    get inputObserver(): RawUserInputObservable {
        return this._inputObserver;
    }

    get stateMachine(): UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates> {
        return this._stateMachine;
    }

    get selectionInputObserver(): SelectionInputObserver {
        return this._selectionInputObserver;
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
            this.leftPointerDown = true;
            this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.middlePointerDown = true;
            this.stateMachine.happens("middlePointerDown", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    pointerUpHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.leftPointerDown = false;
            this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.middlePointerDown = false;
            this.stateMachine.happens("middlePointerUp", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    pointerMoveHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.buttons === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(e.buttons === 4 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerMove", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    scrollHandler(e: MinimumWheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.ctrlKey){
            this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY}, this);
        } else {
            this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY}, this);
        }
    }

    keypressHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if(e.key === " "){
            e.preventDefault();
            this.stateMachine.happens("spacebarDown", {}, this);
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            this._keyfirstPressed.delete(e.key);
        }
        if(e.key === " "){
            this.stateMachine.happens("spacebarUp", {}, this);
        }
    }

}

export class DefaultBoardKMTStrategyWithoutSelection implements BoardKMTStrategy {

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;

    private _inputObserver: RawUserInputObservable;
    private _selectionInputObserver: SelectionInputObserver;
    private _stateMachine: UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates>;

    private _keyfirstPressed: Map<string, boolean>;
    private leftPointerDown: boolean;
    private middlePointerDown: boolean;
    private _initialCursorPosition: Point;

    private _eventTarget: EventTargetWithPointerEvents;

    constructor(canvas: HTMLCanvasElement, eventTarget: EventTargetWithPointerEvents, inputObserver: RawUserInputObservable, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this._inputObserver = inputObserver;
        this._stateMachine =  new UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates>(
            {
                IDLE: new BoardIdleState(),
                READY_TO_SELECT: new ReadyToSelectState(),
                SELECTING: new SelectingState(),
                READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
                INITIAL_PAN: new InitialPanState(),
                PAN: new PanState(),
                READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
                PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
            },
            "IDLE",
            this
        );
        this._keyfirstPressed = new Map();
        this._eventTarget = eventTarget;
    }

    toggleSelectionBox(value: boolean){
        this._selectionInputObserver.toggleSelectionBox(value);
    }

    setSelectionEndPoint(point: Point){
        this._selectionInputObserver.notifySelectionEndPoint(point);
    }

    setSelectionStartPoint(point: Point){
        this._selectionInputObserver.notifySelectionStartPoint(point);
    }

    notifyOnPan(delta: Point){
        this._inputObserver.notifyPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point){
        this._inputObserver.notifyZoom(zoomAmount, anchorPoint);
    }

    setInitialCursorPosition(position: Point){
        this._initialCursorPosition = position;
    }

    get initialCursorPosition(): Point {
        return this._initialCursorPosition;
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

    get inputObserver(): RawUserInputObservable {
        return this._inputObserver;
    }

    get stateMachine(): UserInputStateMachine<BoardEventMapping, BoardContext, BoardStates> {
        return this._stateMachine;
    }

    get selectionInputObserver(): SelectionInputObserver {
        return this._selectionInputObserver;
    }

    setUp(): void {
        this.addEventListeners(this._eventTarget);
    }

    addEventListeners(eventTarget: EventTargetWithPointerEvents){
        eventTarget.addEventListener('pointerdown', this.pointerDownHandler, {passive: false});
        eventTarget.addEventListener('pointerup', this.pointerUpHandler, {passive: false});
        eventTarget.addEventListener('pointermove', this.pointerMoveHandler, {passive: false});
        eventTarget.addEventListener('wheel', this.scrollHandler, {passive: false});
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
        console.log("pointerDownHandler", e);
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.leftPointerDown = true;
            this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.middlePointerDown = true;
            this.stateMachine.happens("middlePointerDown", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    pointerUpHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.leftPointerDown = false;
            this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.middlePointerDown = false;
            this.stateMachine.happens("middlePointerUp", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    pointerMoveHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(this.leftPointerDown && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY}, this);
            return;
        }
        if(this.middlePointerDown && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerMove", {x: e.clientX, y: e.clientY}, this);
            return;
        }
    }

    scrollHandler(e: MinimumWheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.ctrlKey){
            this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY}, this);
        } else {
            this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY}, this);
        }
    }

    keypressHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if(e.key === " "){
            e.preventDefault();
            this.stateMachine.happens("spacebarDown", {}, this);
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            this._keyfirstPressed.delete(e.key);
        }
        if(e.key === " "){
            this.stateMachine.happens("spacebarUp", {}, this);
        }
    }

}
