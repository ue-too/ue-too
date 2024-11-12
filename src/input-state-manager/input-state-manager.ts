import { PointCal } from "point2point";
import { Point } from "src";

export type InputStateManagerEventMap = {
    pointerDownHandler: PointerEvent;
    pointerMoveHandler: PointerEvent;
    pointerUpHandler: PointerEvent;
    scrollHandler: WheelEvent;
    keypressHandler: KeyboardEvent;
    keyupHandler: KeyboardEvent;
}

export type Dragging = {
    active: true;
    delta: Point;
    draggingStartPoint: Point;
    startWithSpacebar: boolean;
}

export type DraggingIdle = {
    active: false;
}

export type ScrollIdle = {
    active: false;
}

export type Scrolling = {
    active: true;
    withControlKey: boolean;
    delta: Point;
}

export type InputStateObject = {
    dragging: Dragging | DraggingIdle;
    keyPressed: Map<string, boolean>;
    scroll: Scrolling | ScrollIdle;
}

export type PanConfig = {
    type: "pan";
    trackPadMode: boolean;
}

export type ZoomConfig = {
    type: "zoom";
    trackPadMode: boolean;
}

export type Config = {
    "pan": PanConfig;
    "zoom": ZoomConfig;
}

export type InputStateInterpretationConfig = PanConfig | ZoomConfig;

export type InputStateInterpretation<K extends keyof Config> = (inputState: InputStateObject, config: Config[K]) => boolean;

export function keyboardMousePanningInterpretation(inputState: InputStateObject, config: Config["pan"]){
    if(inputState.dragging.active && inputState.dragging.startWithSpacebar && inputState.keyPressed.get(" ")){
        console.log("panning with spacebar and left button");
        return true;
    }
    return false;
}

export function trackpadPanningInterpretation(inputState: InputStateObject, config: Config["pan"]){
    if(inputState.scroll.active && !inputState.scroll.withControlKey && config.trackPadMode){
        return true;
    }
    return false;
}

export function keyboardMouseZoomInterpretation(inputState: InputStateObject, config: Config["zoom"]){
    if(inputState.scroll.active && inputState.scroll.withControlKey){
        return true;
    }
    return false;
}

export function trackpadZoomInterpretation(inputState: InputStateObject, config: Config["zoom"]){
    if(inputState.scroll.active && !inputState.scroll.withControlKey && config.trackPadMode){
        return true;
    }
    return false;
}

export function keyboardMouseSelectionInterpretation(inputState: InputStateObject, config: Config["pan"]){
    if(inputState.dragging.active && !inputState.dragging.startWithSpacebar && inputState.keyPressed.get(" ")){
        console.log("spacebar is pressed during selection");
        return true;
    }
    if(inputState.dragging.active && !inputState.dragging.startWithSpacebar){
        console.log("selection");
        return true;
    }
    return false;
}

// Overload signature
export function inputStateInterpretationPipelineWithAllInterpretationMet<K extends keyof Config>(steps: InputStateInterpretation<K>[]): InputStateInterpretation<K>;
// Rest parameters overload
export function inputStateInterpretationPipelineWithAllInterpretationMet<K extends keyof Config>(...steps: InputStateInterpretation<K>[]): (inputState: InputStateObject, config: Config[K]) => boolean;
// Implementation
export function inputStateInterpretationPipelineWithAllInterpretationMet<K extends keyof Config>(
    ...steps: InputStateInterpretation<K>[] | [InputStateInterpretation<K>[]]
): (inputState: InputStateObject, config: Config[K]) => boolean {
    // Normalize the arguments to handle both array and rest parameters
    const normalizedSteps = Array.isArray(steps[0]) ? steps[0] : steps as InputStateInterpretation<K>[];
    
    return function(initialInputState: InputStateObject, config: Config[K]): boolean {
        return normalizedSteps.reduce((acc, step) => acc || step(initialInputState, config), false);
    }
}

// Overload signature
export function inputStateInterpretationPipelineWithOneInterpretationMet<K extends keyof Config>(steps: InputStateInterpretation<K>[]): InputStateInterpretation<K>;
// Rest parameters overload
export function inputStateInterpretationPipelineWithOneInterpretationMet<K extends keyof Config>(...steps: InputStateInterpretation<K>[]): (inputState: InputStateObject, config: Config[K]) => boolean;
// Implementation
export function inputStateInterpretationPipelineWithOneInterpretationMet<K extends keyof Config>(
    ...steps: InputStateInterpretation<K>[] | [InputStateInterpretation<K>[]]
): (inputState: InputStateObject, config: Config[K]) => boolean {
    // Normalize the arguments to handle both array and rest parameters
    const normalizedSteps = Array.isArray(steps[0]) ? steps[0] : steps as InputStateInterpretation<K>[];
    
    return function(initialInputState: InputStateObject, config: Config[K]): boolean {
        return normalizedSteps.reduce((acc, step) => acc || step(initialInputState, config), false);
    }
}


export function createDefaultPanningInterpretation(){
    const steps = [keyboardMousePanningInterpretation, trackpadPanningInterpretation];
    return inputStateInterpretationPipelineWithOneInterpretationMet<"pan">(steps);
}

export function createDefaultZoomingInterpretation(){
    const steps = [keyboardMouseZoomInterpretation, trackpadZoomInterpretation];
    return inputStateInterpretationPipelineWithOneInterpretationMet<"zoom">(steps);
}

export const defaultPanningInterpretation = createDefaultPanningInterpretation();
export const defaultZoomingInterpretation = createDefaultZoomingInterpretation();

export class DefaultInputStateManager {

    private _leftClicked: boolean = false;
    private _lastLeftClickedInPoint: Point | undefined;
    private _spacebarPressed: boolean = false;
    public dragging: Dragging | DraggingIdle = { active: false };
    private _canvas: HTMLCanvasElement;
    public keyController: Map<string, boolean>;
    public trackpadPan: {active: boolean, delta: Point | undefined} = { active: false, delta: undefined };
    public scroll: Scrolling | ScrollIdle = { active: false };

    constructor(canvas: HTMLCanvasElement, initialHandlers?: Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>) {
        this._handlerMap = initialHandlers || {};
        this._canvas = canvas;
        this.keyController = new Map<string, boolean>();
        this.keyController.set(" ", false);
    }
    
    set leftClick(value: {clicked: boolean, pointInViewPort: Point | undefined, spacebarPressed?: boolean}){
        this._leftClicked = value.clicked;
        this._lastLeftClickedInPoint = value.pointInViewPort;
        this._spacebarPressed = value.spacebarPressed || false;
    }

    get leftClick(): {clicked: boolean, pointInViewPort: Point | undefined, spacebarPressed: boolean}{
        return {clicked: this._leftClicked, pointInViewPort: this._lastLeftClickedInPoint, spacebarPressed: this._spacebarPressed};
    }

    get boundingRect(): DOMRect {
        return this._canvas.getBoundingClientRect();
    }

    private _handlerMap: Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>;

    determine(): void{
        const inputState: InputStateObject = {
            scroll: this.scroll,
            dragging: this.dragging,
            keyPressed: this.keyController,
        }
        this.bundleInterpretation(inputState);
        this.cleanUp();
    }

    bundleInterpretation(inputState: InputStateObject){
        if(defaultPanningInterpretation(inputState, {type: "pan", trackPadMode: true})){
            // panning
            // console.log("panning");
            // this.dragging = {active: false};
            return;
        }

        if(keyboardMouseSelectionInterpretation(inputState, {type: "pan", trackPadMode: true})){
            // selection
            return;
        }

        if(defaultZoomingInterpretation(inputState, {type: "zoom", trackPadMode: true})){
            // zooming
            console.log("zooming");
            return;
        }
    }

    setHandlerMap(newHandlerMap: Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>) {
        this._handlerMap = newHandlerMap;
    }

    getHandlerMap(): Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }> {
        return { ...this._handlerMap };
    }

    update<T extends keyof InputStateManagerEventMap>(
        type: T,
        event: InputStateManagerEventMap[T]
    ) {
        const handler = this._handlerMap[type];
        if (handler) {
            handler.execute(event, this);
            this.determine();
        }
    }

    cleanUp(){
        this.scroll = {active: false};
        this.dragging = {active: false};
    }
}

export interface InputStateUpdater<T extends keyof InputStateManagerEventMap> {
    execute(event: InputStateManagerEventMap[T], inputStateManager: DefaultInputStateManager): void;
}

export class PointerDownUpdater implements InputStateUpdater<'pointerDownHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(event.pointerType === "mouse" && (event.button === 1 || event.button === 0)){
            const cursorPosition = {x: event.clientX, y: event.clientY};
            const boundingRect = inputStateManager.boundingRect;
            const cameraPositionInBrowser = {x: boundingRect.x + boundingRect.width / 2, y: boundingRect.y + boundingRect.height / 2};
            inputStateManager.leftClick = {clicked: true, pointInViewPort: PointCal.subVector(cursorPosition, cameraPositionInBrowser), spacebarPressed: inputStateManager.keyController.get(" ")};
        }
    }
}

export class PointerMoveUpdater implements InputStateUpdater<'pointerMoveHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(!inputStateManager.leftClick.clicked){
            inputStateManager.dragging = {active: false};
            return;
        }
        if(event.pointerType === "mouse"){
            const cursorPosition = {x: event.clientX, y: event.clientY};
            const boundingRect = inputStateManager.boundingRect;
            const cameraPositionInBrowser = {x: boundingRect.x + boundingRect.width / 2, y: boundingRect.y + boundingRect.height / 2};
            if(inputStateManager.leftClick.clicked){
                const draggingStartPoint = (inputStateManager.dragging.active ? inputStateManager.dragging.draggingStartPoint : inputStateManager.leftClick.pointInViewPort) || PointCal.subVector(cursorPosition, cameraPositionInBrowser);
                // console.log("activating dragging");
                inputStateManager.dragging = {
                    draggingStartPoint: draggingStartPoint,
                    active: true, 
                    delta: PointCal.subVector(PointCal.subVector(cursorPosition, cameraPositionInBrowser), draggingStartPoint),
                    startWithSpacebar: inputStateManager.leftClick.spacebarPressed
                };
            }
        }
    }
}

export class PointerUpUpdater implements InputStateUpdater<'pointerUpHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(event.pointerType === "mouse" && (event.button === 1 || event.button === 0)){
            inputStateManager.leftClick = {clicked: false, pointInViewPort: undefined, spacebarPressed: false};
        }
    }
}

export class ScrollUpdater implements InputStateUpdater<"scrollHandler"> {

    constructor(){

    }

    execute(event: WheelEvent, inputStateManager: DefaultInputStateManager): void {
        // console.log("scroll");
        const diff = {x: event.deltaX, y: event.deltaY};
        if(!event.ctrlKey){
            // panning
            // if it's trackpad mode then this kind of panning input would not be accepted
            inputStateManager.trackpadPan = { active: true, delta: diff };
            inputStateManager.scroll = {
                active: true,
                delta: diff,
                withControlKey: false,
            }
            return;
        }
        inputStateManager.scroll = {
            active: true,
            delta: diff,
            withControlKey: true,
        }
    }
}

export class KeypressUpdater implements InputStateUpdater<"keypressHandler"> {

    private currentString: string = "";
    private combo: string = "clockoutontime";
    constructor(){}

    execute(event: KeyboardEvent, inputStateManager: DefaultInputStateManager): void {
        if(inputStateManager.keyController.has(event.key) && inputStateManager.keyController.get(event.key) == false){
            event.preventDefault();
            inputStateManager.keyController.set(event.key, true);
        }
        if(event.key === " "){
            return;
        }
        const result = comboDetect(event.key, this.currentString, this.combo);
        this.currentString = result.nextState;
        console.log("currentString", this.currentString);
        if(result.comboDetected){
            console.log("you should go");
        }
    }
}

export class KeyUpUpdater implements InputStateUpdater<"keyupHandler"> {
    constructor(){}

    execute(event: KeyboardEvent, inputStateManager: DefaultInputStateManager): void {
        if(inputStateManager.keyController.has(event.key) && inputStateManager.keyController.get(event.key) == true){
            event.preventDefault();
            inputStateManager.keyController.set(event.key, false);
        }
    }
}

export function createDefaultInputStateManager(canvas: HTMLCanvasElement) {

    const handerMap:Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>  = {
        "pointerDownHandler": new PointerDownUpdater(),
        "pointerMoveHandler": new PointerMoveUpdater(),
        "pointerUpHandler": new PointerUpUpdater(),
        "scrollHandler": new ScrollUpdater(),
        "keypressHandler": new KeypressUpdater(),
        "keyupHandler": new KeyUpUpdater(),
    }

    return new DefaultInputStateManager(canvas, handerMap);
}


export function comboDetect(inputKey: string, currentString: string, combo: string): {nextState: string, comboDetected: boolean} {
    if(currentString.length > combo.length){
        return {nextState: "", comboDetected: false};
    }
    if(currentString.length === combo.length - 1){
        return {nextState: "", comboDetected: currentString + inputKey === combo};
    }
    if(combo[currentString.length] === inputKey){
        return {nextState: currentString + inputKey, comboDetected: false};
    }
    if(combo.startsWith(currentString.substring(1))){
        return {nextState: currentString.substring(1) + inputKey, comboDetected: false};
    }
    if(combo[0] === inputKey){
        return {nextState: inputKey, comboDetected: false};
    }
    return {nextState: "", comboDetected: false};
}

