import { Application, FederatedPointerEvent, Rectangle, Matrix, Graphics } from "pixi.js";
import { BoardCamera, InputOrchestrator, KmtInputEventMapping, KmtInputStateMachine } from "@ue-too/board";
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
    private _camera: BoardCamera;
    private _hitAreaDebugGraphics: Graphics | null = null;

    constructor(app: Application, kmtInputStateMachine: KmtInputStateMachine, inputOrchestrator: InputOrchestrator, camera: BoardCamera){
        this._app = app;
        this._stage = app.stage;
        this._canvas = app.canvas;
        this._kmtInputStateMachine = kmtInputStateMachine;
        this._inputOrchestrator = inputOrchestrator;
        this._keyfirstPressed = new Map();
        this.bindFunctions();
        this._abortController = new AbortController();
        this._camera = camera;
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
        // Set hitArea to cover entire canvas so events work even in empty areas
        this.updateHitArea();
        
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

    /**
     * Updates the stage's hitArea to cover the entire viewport in stage local coordinates.
     * 
     * @remarks
     * This must be called whenever the stage transformation changes (pan, zoom, rotate)
     * or when the canvas size changes. The hitArea is defined in the stage's local
     * coordinate space. When the stage transforms, the hitArea moves with it, so we
     * need to update it to cover the viewport rectangle transformed into stage local space.
     * 
     * Uses the stage's toLocal method to convert viewport corners from screen space
     * to stage local space, then creates a bounding box for the hitArea.
     */
    updateHitArea(){
        // Get the viewport rectangle in screen space
        const width = this._app.screen.width;
        const height = this._app.screen.height;

        const topLeft = this._camera.convertFromViewPort2WorldSpace({x: -width / 2, y: -height / 2});
        const topRight = this._camera.convertFromViewPort2WorldSpace({x: width / 2, y: -height / 2});
        const bottomLeft = this._camera.convertFromViewPort2WorldSpace({x: -width / 2, y: height / 2});
        const bottomRight = this._camera.convertFromViewPort2WorldSpace({x: width / 2, y: height / 2});
        
        this._stage.hitArea = new Rectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
        
        // Update debug visualization if enabled
        if (this._hitAreaDebugGraphics) {
            this._drawHitAreaDebug();
        }
    }

    /**
     * Draws a visual representation of the hitArea for debugging purposes.
     * 
     * @remarks
     * This creates a Graphics object that outlines the current hitArea in red.
     * The debug graphics are added to the stage so you can see what area is
     * actually being used for hit detection.
     * 
     * Call `showHitAreaDebug()` to enable and `hideHitAreaDebug()` to disable.
     */
    private _drawHitAreaDebug(){
        if (!this._hitAreaDebugGraphics || !this._stage.hitArea) {
            return;
        }
        
        const hitArea = this._stage.hitArea;
        
        // Only draw if hitArea is a Rectangle
        if (!(hitArea instanceof Rectangle)) {
            return;
        }
        
        // Clear previous drawing
        this._hitAreaDebugGraphics.clear();
        
        // Draw the hitArea rectangle in red with semi-transparent fill
        this._hitAreaDebugGraphics.rect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
        this._hitAreaDebugGraphics.fill({ color: 0xff0000, alpha: 0.2 });
        this._hitAreaDebugGraphics.stroke({ color: 0xff0000, width: 2 });
    }

    /**
     * Shows a visual debug overlay of the hitArea.
     * 
     * @remarks
     * This creates a red rectangle that shows the current hitArea boundaries.
     * Useful for debugging hit detection issues. The debug graphics are
     * automatically updated when `updateHitArea()` is called.
     */
    showHitAreaDebug(){
        if (this._hitAreaDebugGraphics) {
            return; // Already showing
        }
        
        this._hitAreaDebugGraphics = new Graphics();
        this._stage.addChild(this._hitAreaDebugGraphics);
        this._drawHitAreaDebug();
    }

    /**
     * Hides the hitArea debug visualization.
     */
    hideHitAreaDebug(){
        if (this._hitAreaDebugGraphics) {
            this._stage.removeChild(this._hitAreaDebugGraphics);
            this._hitAreaDebugGraphics.destroy();
            this._hitAreaDebugGraphics = null;
        }
    }

    tearDown(){
        this._stage.off("pointerdown", this.pointerDownHandler);
        this._stage.off("pointerup", this.pointerUpHandler);
        this._stage.off("pointermove", this.pointerMoveHandler);
        this._canvas.removeEventListener("wheel", this.scrollHandler);
        this.hideHitAreaDebug(); // Clean up debug graphics
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

