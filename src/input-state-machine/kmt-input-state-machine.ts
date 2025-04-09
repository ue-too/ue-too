import { EventReactions, EventGuards, Guard, TemplateState, TemplateStateMachine } from "../being/interfaces";
import { Point } from "src/util/misc";
import { PointCal } from "point2point";
import { CanvasOperator, DummyKmtInputContext, KmtInputContext } from "./kmt-input-context";

/**
 * @description The possible states of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export type KmtInputStates = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL" | "PAN" | "INITIAL_PAN" | "PAN_VIA_SCROLL_WHEEL";

/**
 * @description The payload for the pointer event.
 * 
 * @category Input State Machine
 */
export type PointerEventPayload = {
    x: number;
    y: number;
}

type EmptyPayload = {};

/**
 * @description The payload for the scroll event.
 * 
 * @category Input State Machine
 */
export type ScrollEventPayload = {
    deltaX: number;
    deltaY: number;
}

/**
 * @description The payload for the scroll with ctrl event.
 * 
 * @category Input State Machine
 */
export type ScrollWithCtrlEventPayload = {
    deltaX: number;
    deltaY: number;
    x: number;
    y: number;
}

/**
 * @description The payload mapping for the events of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export type KmtInputEventMapping = {
    leftPointerDown: PointerEventPayload;
    leftPointerUp: PointerEventPayload;
    leftPointerMove: PointerEventPayload;
    spacebarDown: EmptyPayload;
    spacebarUp: EmptyPayload;
    stayIdle: EmptyPayload;
    cursorOnElement: EmptyPayload;
    scroll: ScrollEventPayload;
    scrollWithCtrl: ScrollWithCtrlEventPayload;
    middlePointerDown: PointerEventPayload;
    middlePointerUp: PointerEventPayload;
    middlePointerMove: PointerEventPayload;
}

/**
 * @description Converts the point from window coordinates(browser) to view port coordinates.
 * 
 * @category Input State Machine
 */
export function convertFromWindow2ViewPort(point: Point, canvas: HTMLCanvasElement): Point {
    const canvasBoundingRect = canvas.getBoundingClientRect();
    const cameraCenterInWindow = {x: canvasBoundingRect.left + (canvasBoundingRect.right - canvasBoundingRect.left) / 2, y: canvasBoundingRect.top + (canvasBoundingRect.bottom - canvasBoundingRect.top) / 2};
    return PointCal.subVector(point, cameraCenterInWindow);
}

export function convertFromWindow2ViewPortWithCanvasOperator(point: Point, canvasOperator: CanvasOperator): Point {
    const cameraCenterInWindow = {x: canvasOperator.position.x + (canvasOperator.width / 2), y: canvasOperator.position.y + (canvasOperator.height / 2)};
    return PointCal.subVector(point, cameraCenterInWindow);
}

export function convertFromWindow2ViewPortCanvasOperator(point: Point, canvasOperator: CanvasOperator): Point {
    const cameraCenterInWindow = {x: canvasOperator.position.x + (canvasOperator.width / 2), y: canvasOperator.position.y + (canvasOperator.height / 2)};
    return PointCal.subVector(point, cameraCenterInWindow);
}

/**
 * @description The possible target states of the idle state.
 * 
 * @category Input State Machine
 */
export type KmtIdleStatePossibleTargetStates = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL";

/**
 * @description The idle state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class KmtIdleState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates> {

    constructor() {
        super();
    }

    protected _guards: Guard<KmtInputContext, "isIdle"> = {
        isIdle: () => true,
    }

    protected _eventGuards: Partial<EventGuards<KmtInputEventMapping, KmtIdleStatePossibleTargetStates, KmtInputContext, Guard<KmtInputContext>>> = {
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates> {
        return this._eventReactions;
    }

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates> = {
        spacebarDown: {
            action: this.spacebarDownHandler,
            defaultTargetState: "READY_TO_PAN_VIA_SPACEBAR",
        },
        scroll: {
            action: this.scrollHandler,
            defaultTargetState: "IDLE",
        },
        scrollWithCtrl: {
            action: this.scrollWithCtrlHandler,
            defaultTargetState: "IDLE",
        },
        middlePointerDown: {
            action: this.middlePointerDownHandler,
            defaultTargetState: "READY_TO_PAN_VIA_SCROLL_WHEEL",
        },
    }

    scrollHandler(context: KmtInputContext, payload: ScrollEventPayload): void {
        const delta = {...payload}
        if(!context.alignCoordinateSystem){
            delta.deltaY = -delta.deltaY;
        }
        context.notifyOnPan({x: delta.deltaX, y: delta.deltaY});
    }

    scrollWithCtrlHandler(context: KmtInputContext, payload: ScrollWithCtrlEventPayload): void {
        let scrollSensitivity = 0.005;
        if(Math.abs(payload.deltaY) > 100){
            scrollSensitivity = 0.0005;
        }
        const zoomAmount = payload.deltaY * scrollSensitivity;
        const cursorPosition = {x: payload.x, y: payload.y};
        const anchorPoint = convertFromWindow2ViewPortCanvasOperator(cursorPosition, context.canvas);
        if(!context.alignCoordinateSystem){
            anchorPoint.y = -anchorPoint.y;
        }
        context.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
    }

    spacebarDownHandler(context: KmtInputContext, payload: EmptyPayload): void {
        context.canvas.setCursor("grab");
    }

    middlePointerDownHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.setCursor("grabbing");
    }
}

/**
 * @description The possible target states of the ready to select state.
 * 
 * @category Input State Machine
 */
export type ReadyToSelectStatePossibleTargetStates = "IDLE" | "SELECTING";

/**
 * @description The context for the ready to select state.
 * 
 * @category Input State Machine
 */
export type SelectionContext = {
    setSelectionEndPoint: (point: Point) => void;
    toggleSelectionBox: (show: boolean) => void;
    cleanup: () => void;
    setup: () => void;
    canvas: HTMLCanvasElement;
}

/**
 * @description The ready to select state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class ReadyToSelectState extends TemplateState<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates> {

    constructor() {
        super();
    }

    leftPointerMove = ((context: SelectionContext, payload: PointerEventPayload): void => {
        const viewportPoint = convertFromWindow2ViewPort({x: payload.x, y: payload.y}, context.canvas);
        context.setSelectionEndPoint(viewportPoint);
        context.toggleSelectionBox(true);
    }).bind(this);

    private _eventReactions: EventReactions<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates> = {
        leftPointerUp: {
            action: () => "IDLE",
            defaultTargetState: "IDLE",
        },
        leftPointerMove: {
            action: this.leftPointerMove,
            defaultTargetState: "SELECTING",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates> {
        return this._eventReactions;
    }

}

/**
 * @description The ready to pan via space bar state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class ReadyToPanViaSpaceBarState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        spacebarUp: {
            action: this.spacebarUpHandler,
            defaultTargetState: "IDLE",
        },
        leftPointerDown: {
            action: this.leftPointerDownHandler,
            defaultTargetState: "INITIAL_PAN",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    leftPointerDownHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.setCursor("grabbing");
    }

    spacebarUpHandler(context: KmtInputContext, payload: EmptyPayload): void {
        context.canvas.setCursor("default");
    }
}

/**
 * @description The initial pan state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class InitialPanState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        leftPointerUp: {
            action: this.leftPointerUpHandler,
            defaultTargetState: "READY_TO_PAN_VIA_SPACEBAR",
        },
        leftPointerMove: {
            action: this.leftPointerMoveHandler,
            defaultTargetState: "PAN",
        },
        spacebarUp: {
            action: () => "IDLE",
            defaultTargetState: "IDLE",
        },
        leftPointerDown: {
            action: () => "PAN",
            defaultTargetState: "PAN",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    leftPointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
    }

    leftPointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.setCursor("grab");
    }
}

/**
 * @description The ready to pan via scroll wheel state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class ReadyToPanViaScrollWheelState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        middlePointerUp: {
            action: this.middlePointerUpHandler,
            defaultTargetState: "IDLE",
        },
        middlePointerMove: {
            action: this.middlePointerMoveHandler,
            defaultTargetState: "PAN_VIA_SCROLL_WHEEL",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    middlePointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.setCursor("grabbing");
    }

    middlePointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.setCursor("default");
    }

}

/**
 * @description The pan state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class PanState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        leftPointerUp: {
            action: this.leftPointerUpHandler,
            defaultTargetState: "READY_TO_PAN_VIA_SPACEBAR",
        },
        leftPointerMove: {
            action: this.leftPointerMoveHandler,
            defaultTargetState: "PAN",
        },
        spacebarUp: {
            action: this.spacebarUpHandler, 
            defaultTargetState: "IDLE",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    leftPointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
    }

    spacebarUpHandler(context: KmtInputContext, payload: EmptyPayload): void {
        context.canvas.setCursor("default");
    }

    leftPointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.setCursor("grab");
    }
}

/**
 * @description The pan via scroll wheel state of the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export class PanViaScrollWheelState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    private _eventReactions: EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        middlePointerUp: {
            action: this.middlePointerUpHandler,
            defaultTargetState: "IDLE",
        },
        middlePointerMove: {
            action: this.middlePointerMoveHandler,
            defaultTargetState: "PAN_VIA_SCROLL_WHEEL",
        },
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    middlePointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
    }

    middlePointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.setCursor("default");
    }
}

export class KmtEmptyState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    get eventReactions(): EventReactions<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return {};
    }
    
}

export type KmtInputStateMachine = TemplateStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>;

/**
 * @description Creates the keyboard mouse and trackpad input state machine.
 * 
 * @category Input State Machine
 */
export function createKmtInputStateMachine(context: KmtInputContext): KmtInputStateMachine {
    const states = {
        IDLE: new KmtIdleState(),
        READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
        INITIAL_PAN: new InitialPanState(),
        PAN: new PanState(),
        READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
        PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
    }
    return new TemplateStateMachine(states, "IDLE", context);
}

export class KmtInputStateMachineWebWorkerProxy extends TemplateStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    private _webworker: Worker;

    constructor(webworker: Worker){
        super({
            "IDLE": new KmtEmptyState(),
            "READY_TO_PAN_VIA_SPACEBAR": new KmtEmptyState(),
            "INITIAL_PAN": new KmtEmptyState(),
            "PAN": new KmtEmptyState(),
            "READY_TO_PAN_VIA_SCROLL_WHEEL": new KmtEmptyState(),
            "PAN_VIA_SCROLL_WHEEL": new KmtEmptyState(),
        }, "IDLE", new DummyKmtInputContext());
        this._webworker = webworker;
    }

    happens(event: keyof KmtInputEventMapping, payload: KmtInputEventMapping[keyof KmtInputEventMapping]): KmtInputStates | undefined {        
        this._webworker.postMessage({
            type: "kmtInputStateMachine",
            event,
            payload,
        });
        return "IDLE";
    }
    
}
