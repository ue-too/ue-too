import { Application, FederatedPointerEvent } from "pixi.js";
import { InputOrchestrator, KmtInputEventMapping, KmtInputStateMachine } from "@ue-too/board";
import { EventArgs } from "@ue-too/being";

export class PixiInputParser {
    private _app: Application;
    private _stage: Application["stage"];
    private _canvas: HTMLCanvasElement;
    private _kmtInputStateMachine: KmtInputStateMachine;
    private _inputOrchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    private _disabled: boolean = false;

    constructor(app: Application, kmtInputStateMachine: KmtInputStateMachine, inputOrchestrator: InputOrchestrator){
        this._app = app;
        this._stage = app.stage;
        this._canvas = app.canvas;
        this._kmtInputStateMachine = kmtInputStateMachine;
        this._inputOrchestrator = inputOrchestrator;
        this._keyfirstPressed = new Map();
        this.bindFunctions();
        this._abortController = new AbortController();
    }

    bindFunctions(){
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
    }

    setUp(){
        // Enable interaction on stage
        this._stage.eventMode = 'static';
        
        // Pointer events on stage
        this._stage.on("pointerdown", this.pointerDownHandler);
        this._stage.on("pointerup", this.pointerUpHandler);
        this._stage.on("pointermove", this.pointerMoveHandler);
        
        // Wheel events on canvas (stage doesn't emit wheel events)
        this._canvas.addEventListener("wheel", this.scrollHandler, {signal: this._abortController.signal});
        
        // Keyboard events on window
        window.addEventListener("keydown", this.keydownHandler, {signal: this._abortController.signal});
        window.addEventListener("keyup", this.keyupHandler, {signal: this._abortController.signal});
    }

    tearDown(){
        this._stage.off("pointerdown", this.pointerDownHandler);
        this._stage.off("pointerup", this.pointerUpHandler);
        this._stage.off("pointermove", this.pointerMoveHandler);
        this._canvas.removeEventListener("wheel", this.scrollHandler);
        this._abortController.abort();
        this._abortController = new AbortController();
    }

    private processEvent<K extends keyof KmtInputEventMapping>(
        ...args: EventArgs<KmtInputEventMapping, K>
    ): void {
        const result = this._kmtInputStateMachine.happens(...args);
        if (result.handled && "output" in result) {
            this._inputOrchestrator.processInputEventOutput(result.output);
        }
    }

    pointerDownHandler(event: FederatedPointerEvent){
        if(this._disabled){
            return;
        }
        if(event.button === 0 && event.pointerType === "mouse"){
            this.processEvent("leftPointerDown", {x: event.clientX, y: event.clientY});
            return;
        }
        if(event.button === 1 && event.pointerType === "mouse"){
            this.processEvent("middlePointerDown", {x: event.clientX, y: event.clientY});
            return;
        }
    }

    pointerUpHandler(event: FederatedPointerEvent){
        if(this._disabled){
            return;
        }
        if(event.button === 0 && event.pointerType === "mouse"){
            this.processEvent("leftPointerUp", {x: event.clientX, y: event.clientY});
            return;
        }
        if(event.button === 1 && event.pointerType === "mouse"){
            this.processEvent("middlePointerUp", {x: event.clientX, y: event.clientY});
            return;
        }
    }

    pointerMoveHandler(event: FederatedPointerEvent){
        if(this._disabled){
            return;
        }
        if((event.buttons === 1) && event.pointerType === "mouse"){
            this.processEvent("leftPointerMove", {x: event.clientX, y: event.clientY});
            return;
        }
        if((event.buttons === 4) && event.pointerType === "mouse"){
            this.processEvent("middlePointerMove", {x: event.clientX, y: event.clientY});
            return;
        }
        this.processEvent("pointerMove", {x: event.clientX, y: event.clientY});
    }

    scrollHandler(event: WheelEvent){
        if(this._disabled){
            return;
        }
        if(event.ctrlKey){
            this.processEvent("scrollWithCtrl", {x: event.clientX, y: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY});
        } else {
            this.processEvent("scroll", {x: event.clientX, y: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY});
        }
    }

    keydownHandler(event: KeyboardEvent){
        if(this._disabled){
            return;
        }
        if(this._keyfirstPressed.has(event.key)){
            return;
        }
        this._keyfirstPressed.set(event.key, true);
        if(event.key === " "){
            this.processEvent("spacebarDown");
        }
    }

    keyupHandler(event: KeyboardEvent){
        if(this._disabled){
            return;
        }
        if(this._keyfirstPressed.has(event.key)){
            this._keyfirstPressed.delete(event.key);
        }
        if(event.key === " "){
            this.processEvent("spacebarUp");
        }
    }

    disable(){
        this._disabled = true;
    }

    enable(){
        this._disabled = false;
    }

    get disabled(): boolean {
        return this._disabled;
    }
}

