import type { KmtInputStateMachine } from "../../input-interpretation/input-state-machine";
import type { InputOrchestrator } from "../input-orchestrator";

/**
 * @category Event Parser
 */

export interface KMTEventParser {
    disabled: boolean;
    setUp(): void;
    tearDown(): void;
    attach(canvas: HTMLCanvasElement): void;
    stateMachine: KmtInputStateMachine;
    orchestrator: InputOrchestrator;
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
 * The parser has a direct dependency on the state machine and requires an orchestrator to process outputs.
 *
 * @category Event Parser
 */
export class VanillaKMTEventParser implements KMTEventParser {

    private _disabled: boolean = false;
    private _stateMachine: KmtInputStateMachine;
    private _orchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    private _canvas?: HTMLCanvasElement;


    constructor(kmtInputStateMachine: KmtInputStateMachine, orchestrator: InputOrchestrator, canvas?: HTMLCanvasElement){
        this._canvas = canvas;
        this.bindFunctions();
        this._abortController = new AbortController();
        this._stateMachine = kmtInputStateMachine;
        this._orchestrator = orchestrator;
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

    get orchestrator(): InputOrchestrator {
        return this._orchestrator;
    }

    addEventListeners(signal: AbortSignal){
        if(this._canvas == undefined){
            return;
        }
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler, {signal});
        this._canvas.addEventListener('pointerup', this.pointerUpHandler, {signal});
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler, {signal});
        this._canvas.addEventListener('wheel', this.scrollHandler, {signal});
        window.addEventListener('keydown', this.keypressHandler, {signal});
        window.addEventListener('keyup', this.keyupHandler, {signal});
    }
    
    setUp(): void {
        if(this._abortController.signal.aborted){
            this._abortController = new AbortController();
        }
        this.addEventListeners(this._abortController.signal);
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
        this._canvas = undefined;
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
            const result = this.stateMachine.happens("leftPointerDown", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            const result = this.stateMachine.happens("middlePointerDown", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
    }

    pointerUpHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        if(e.button === 0 && e.pointerType === "mouse"){
            const result = this.stateMachine.happens("leftPointerUp", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
        if(e.button === 1 && e.pointerType === "mouse"){
            const result = this.stateMachine.happens("middlePointerUp", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
    }

    pointerMoveHandler(e: MinimumPointerEvent){
        if(this._disabled){
            return;
        }
        let result;
        if((e.buttons === 1) && e.pointerType === "mouse"){
            result = this.stateMachine.happens("leftPointerMove", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
        if((e.buttons  === 4) && e.pointerType === "mouse"){
            result = this.stateMachine.happens("middlePointerMove", {x: e.clientX, y: e.clientY});
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
            return;
        }
        result = this.stateMachine.happens("pointerMove", {x: e.clientX, y: e.clientY});
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
        }
    }

    scrollHandler(e: MinimumWheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        let result;
        if(e.ctrlKey){
            result = this.stateMachine.happens("scrollWithCtrl", {x: e.clientX, y: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY});
        } else {
            result = this.stateMachine.happens("scroll", {deltaX: e.deltaX, deltaY: e.deltaY});
        }
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
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
            const result = this.stateMachine.happens("spacebarDown");
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyfirstPressed.has(e.key)){
            this._keyfirstPressed.delete(e.key);
        }
        if(e.key === " "){
            const result = this.stateMachine.happens("spacebarUp");
            if(result.handled && 'output' in result && result.output){
                this._orchestrator.processOutput(result.output);
            }
        }
    }

    attach(canvas: HTMLCanvasElement){
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }
}
