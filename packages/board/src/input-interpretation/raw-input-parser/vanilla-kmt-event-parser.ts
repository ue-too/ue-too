import type { KmtInputStateMachine } from "../../input-interpretation/input-state-machine";

/**
 * @category Event Parser
 */

export interface KMTEventParser {
    disabled: boolean;
    setUp(): void;
    tearDown(): void;
    attach(canvas: HTMLCanvasElement): void;
}

/**
 * @description The minimum pointer event.
 * This is for the interoperability between the vanilla javascript and the pixijs event system.
 * 
 * @category Event Parser
 */
export type MinimumPointerEvent = {
    button: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    buttons: number;
}

/**
 * @description The minimum wheel event.
 * This is for the interoperability between the vanilla javascript and the pixijs event system.
 * 
 * @category Event Parser
 */
export type MinimumWheelEvent = {
    preventDefault: () => void;
    deltaX: number;
    deltaY: number;
    ctrlKey: boolean;
    clientX: number;
    clientY: number;
}

/**
 * @description The minimum keyboard event.
 * This is for the interoperability between the vanilla javascript and the pixijs event system.
 * 
 * @category Event Parser
 */
export type MinimumKeyboardEvent = {
    preventDefault: () => void;
    key: string;
};

/**
 * @description The event target with pointer events.
 * This is for the interoperability between the vanilla javascript and the pixijs event system.
 * 
 * @category Event Parser
 */
export type EventTargetWithPointerEvents = {
    addEventListener: (type: string, listener: (event: any) => void, options?: {passive: boolean}) => void;
    removeEventListener: (type: string, listener: (event: any) => void) => void;
};


/**
 * @description The vanilla keyboard mouse and trackpad(KMT) event parser.
 * This parser converts the raw events to events that can be used by the input state machine.
 * 
 * @category Event Parser
 */
export class VanillaKMTEventParser implements KMTEventParser {

    private _disabled: boolean;
    private _stateMachine: KmtInputStateMachine;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    private _canvas: HTMLCanvasElement;


    constructor(canvas: HTMLCanvasElement, kmtInputStateMachine: KmtInputStateMachine){
        this._canvas = canvas;
        this.bindFunctions();
        this._abortController = new AbortController();
        this._stateMachine = kmtInputStateMachine;
        this._keyfirstPressed = new Map();
    }

    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean){
        this._disabled = value;
    }

    get stateMachine(): KmtInputStateMachine {
        return this._stateMachine;
    }

    addEventListeners(signal: AbortSignal){
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler, {signal});
        this._canvas.addEventListener('pointerup', this.pointerUpHandler, {signal});
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler, {signal});
        this._canvas.addEventListener('wheel', this.scrollHandler, {signal});
        window.addEventListener('keydown', this.keypressHandler, {signal});
        window.addEventListener('keyup', this.keyupHandler, {signal});
    }
    
    setUp(): void {
        this.addEventListeners(this._abortController.signal);
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
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
            this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY});
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerDown", {x: e.clientX, y: e.clientY});
            return;
        }
    }

    pointerUpHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY});
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerUp", {x: e.clientX, y: e.clientY});
            return;
        }
    }

    pointerMoveHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if((e.buttons === 1) && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY});
            return;
        }
        if((e.buttons  === 4) && e.pointerType === "mouse"){
            this.stateMachine.happens("middlePointerMove", {x: e.clientX, y: e.clientY});
            return;
        }
    }

    scrollHandler(e: MinimumWheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        if(e.ctrlKey){
            this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY});
        } else {
            this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY});
        }
    }

    keypressHandler(e: KeyboardEvent){
        if(e.target !== document.body){
            return;
        }
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

    attach(canvas: HTMLCanvasElement){
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }
}
