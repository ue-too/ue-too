import type { KmtInputStateMachine } from "src/input-state-machine";

/**
 * @category Event Parser
 */

export interface KMTEventParser {
    disabled: boolean;
    stateMachine: KmtInputStateMachine;
    setUp(): void;
    tearDown(): void;
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

    private _eventTarget: EventTargetWithPointerEvents;

    constructor(eventTarget: EventTargetWithPointerEvents, stateMachine: KmtInputStateMachine){
        this.bindFunctions();
        this._stateMachine = stateMachine;
        this._keyfirstPressed = new Map();
        this._eventTarget = eventTarget;
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
        if((e.buttons & 1) === 1 && e.pointerType === "mouse"){
            this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY});
            return;
        }
        if((e.buttons & 4) === 4 && e.pointerType === "mouse"){
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
        if(this._keyfirstPressed.has(e.key)){
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if(e.key === " "){
            e.preventDefault();
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
