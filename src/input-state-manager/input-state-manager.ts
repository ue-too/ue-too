import { PointCal } from "point2point";
import { Point, pointIsInViewPort } from "src";

export type InputStateManagerEventMap = {
    pointerDownHandler: PointerEvent;
    pointerMoveHandler: PointerEvent;
    pointerUpHandler: PointerEvent;
    scrollHandler: WheelEvent;
    keypressHandler: KeyboardEvent;
    keyupHandler: KeyboardEvent;
}

export class DefaultInputStateManager {

    private _leftClicked: boolean = false;
    private _lastLeftClickedInPoint: Point | undefined;
    private _currentCursorPosition: Point | undefined;
    public dragging: {active: boolean, delta: Point | undefined, draggingStartPoint: Point | undefined} = {active: false, delta: undefined, draggingStartPoint: undefined};
    private _canvas: HTMLCanvasElement;
    public keyController: Map<string, boolean>;

    constructor(canvas: HTMLCanvasElement, initialHandlers?: Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>) {
        this._handlerMap = initialHandlers || {};
        this._canvas = canvas;
        this.keyController = new Map<string, boolean>();
        this.keyController.set(" ", true);
    }
    
    set leftClick(value: {clicked: boolean, pointInViewPort: Point | undefined}){
        this._leftClicked = value.clicked;
        this._lastLeftClickedInPoint = value.pointInViewPort;
    }

    get leftClick(): {clicked: boolean, pointInViewPort: Point | undefined}{
        return {clicked: this._leftClicked, pointInViewPort: this._lastLeftClickedInPoint};
    }

    set currentCursorPosition(value: Point){
        this._currentCursorPosition = value;
    }

    get boundingRect(): DOMRect {
        return this._canvas.getBoundingClientRect();
    }

    private _handlerMap: Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>;


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
        }
    }
}

export interface InputStateUpdater<T extends keyof InputStateManagerEventMap> {
    execute(event: InputStateManagerEventMap[T], inputStateManager: DefaultInputStateManager): void;
}

export class PointerDownUpdater implements InputStateUpdater<'pointerDownHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(event.pointerType === "mouse" && event.button === 1){
            const cursorPosition = {x: event.clientX, y: event.clientY};
            const boundingRect = inputStateManager.boundingRect;
            const cameraPositionInBrowser = {x: boundingRect.x + boundingRect.width / 2, y: boundingRect.y + boundingRect.height / 2};
            inputStateManager.leftClick = {clicked: true, pointInViewPort: PointCal.subVector(cursorPosition, cameraPositionInBrowser)};
        }
    }
}

export class PointerMoveUpdater implements InputStateUpdater<'pointerMoveHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(!inputStateManager.leftClick.clicked){
            inputStateManager.dragging = {active: false, delta: undefined, draggingStartPoint: undefined};
            return;
        }
        if(event.pointerType === "mouse"){
            const cursorPosition = {x: event.clientX, y: event.clientY};
            const boundingRect = inputStateManager.boundingRect;
            const cameraPositionInBrowser = {x: boundingRect.x + boundingRect.width / 2, y: boundingRect.y + boundingRect.height / 2};
            if(inputStateManager.leftClick.clicked){
                // Fixed line
                const draggingStartPoint = (inputStateManager.dragging.active ? inputStateManager.dragging.draggingStartPoint : inputStateManager.leftClick.pointInViewPort) || PointCal.subVector(cursorPosition, cameraPositionInBrowser);
                inputStateManager.dragging = {
                    draggingStartPoint: draggingStartPoint,
                    active: true, 
                    delta: PointCal.subVector(PointCal.subVector(cursorPosition, cameraPositionInBrowser), draggingStartPoint)
                };
            }
        }
    }
}

export class PointerUpUpdater implements InputStateUpdater<'pointerUpHandler'> {

    constructor(){

    }

    execute(event: PointerEvent, inputStateManager: DefaultInputStateManager): void {
        if(event.pointerType === "mouse" && event.button === 1){
            inputStateManager.leftClick = {clicked: false, pointInViewPort: undefined};
        }
    }
}

export class ScrollUpdater implements InputStateUpdater<"scrollHandler"> {

    constructor(){

    }

    execute(event: WheelEvent, inputStateManager: DefaultInputStateManager): void {
    }
}

export class KeypressUpdater implements InputStateUpdater<"keypressHandler"> {
    constructor(){}

    execute(event: KeyboardEvent, inputStateManager: DefaultInputStateManager): void {
        if(inputStateManager.keyController.has(event.key) && inputStateManager.keyController.get(event.key) == false){
            event.preventDefault();
            inputStateManager.keyController.set(event.key, true);
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
    const pointerdown = new PointerDownUpdater();
    const pointermove = new PointerMoveUpdater();
    const pointerup = new PointerUpUpdater();

    const handerMap:Partial<{
        [K in keyof InputStateManagerEventMap]: InputStateUpdater<K>
    }>  = {
        "pointerDownHandler": pointerdown,
        "pointerMoveHandler": pointermove,
        "pointerUpHandler": pointerup,
        "keypressHandler": new KeypressUpdater(),
        "keyupHandler": new KeyUpUpdater(),
    }


    return new DefaultInputStateManager(canvas, handerMap);
}
