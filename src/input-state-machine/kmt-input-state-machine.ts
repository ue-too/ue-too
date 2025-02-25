import { BaseContext, EventAction, EventGuards, Guard, State, StateMachine, TemplateState, TemplateStateMachine } from "../being/interfaces";
import { Point } from "../index";
import { PointCal } from "point2point";
import { KmtInputContext } from "./kmt-input-context";


export type KmtInputStates = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL" | "PAN" | "INITIAL_PAN" | "PAN_VIA_SCROLL_WHEEL";

export type PointerEventPayload = {
    x: number;
    y: number;
}

export type SpaceBarEventPayload = {

}

export type CursorStatusUpdateEventPayload = {

}

export type ScrollEventPayload = {
    deltaX: number;
    deltaY: number;
}

export type ScrollWithCtrlEventPayload = {
    deltaX: number;
    deltaY: number;
    x: number;
    y: number;
}

export type KmtInputEventMapping = {
    leftPointerDown: PointerEventPayload;
    leftPointerUp: PointerEventPayload;
    leftPointerMove: PointerEventPayload;
    spacebarDown: SpaceBarEventPayload;
    spacebarUp: SpaceBarEventPayload;
    stayIdle: CursorStatusUpdateEventPayload;
    cursorOnElement: CursorStatusUpdateEventPayload;
    scroll: ScrollEventPayload;
    scrollWithCtrl: ScrollWithCtrlEventPayload;
    middlePointerDown: PointerEventPayload;
    middlePointerUp: PointerEventPayload;
    middlePointerMove: PointerEventPayload;
}

export interface World {
    processPoint(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, point: Point): boolean;
}

export function convertFromWindow2ViewPort(point: Point, canvas: HTMLCanvasElement): Point {
    const canvasBoundingRect = canvas.getBoundingClientRect();
    const cameraCenterInWindow = {x: canvasBoundingRect.left + (canvasBoundingRect.right - canvasBoundingRect.left) / 2, y: canvasBoundingRect.top + (canvasBoundingRect.bottom - canvasBoundingRect.top) / 2};
    return PointCal.subVector(point, cameraCenterInWindow);
}

type KmtIdleStatePossibleTargetStates = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL";

export class KmtIdleState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates> {

    constructor() {
        super();
    }

    protected _guards: Guard<KmtInputContext, "isIdle"> = {
        isIdle: () => true,
    }

    protected _eventGuards: Partial<EventGuards<KmtInputEventMapping, KmtIdleStatePossibleTargetStates, KmtInputContext, Guard<KmtInputContext>>> = {
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates>> {
        return this._eventReactions;
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtIdleStatePossibleTargetStates>> = {
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
    }

    scrollHandler(context: KmtInputContext, payload: ScrollEventPayload): KmtIdleStatePossibleTargetStates {
        const delta = {...payload}
        if(!context.alignCoordinateSystem){
            delta.deltaY = -delta.deltaY;
        }
        context.notifyOnPan({x: delta.deltaX, y: delta.deltaY});
        return "IDLE";
    }

    scrollWithCtrlHandler(context: KmtInputContext, payload: ScrollWithCtrlEventPayload): KmtIdleStatePossibleTargetStates {
        let scrollSensitivity = 0.005;
        if(Math.abs(payload.deltaY) > 100){
            scrollSensitivity = 0.0005;
        }
        const zoomAmount = payload.deltaY * scrollSensitivity;
        const cursorPosition = {x: payload.x, y: payload.y};
        const anchorPoint = convertFromWindow2ViewPort(cursorPosition, context.canvas);
        if(!context.alignCoordinateSystem){
            anchorPoint.y = -anchorPoint.y;
        }
        context.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
        return "IDLE";
    }

    spacebarDownHandler(context: KmtInputContext, payload: SpaceBarEventPayload): KmtIdleStatePossibleTargetStates {
        context.canvas.style.cursor = "grab";
        return "READY_TO_PAN_VIA_SPACEBAR";
    }

    middlePointerDownHandler(context: KmtInputContext, payload: PointerEventPayload): KmtIdleStatePossibleTargetStates {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.style.cursor = "grabbing";
        return "READY_TO_PAN_VIA_SCROLL_WHEEL";
    }
}

type ReadyToSelectStatePossibleTargetStates = "IDLE" | "SELECTING";
type SelectionContext = {
    setSelectionEndPoint: (point: Point) => void;
    toggleSelectionBox: (show: boolean) => void;
    cleanup: () => void;
    setup: () => void;
    canvas: HTMLCanvasElement;
}

export class ReadyToSelectState extends TemplateState<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates> {

    constructor() {
        super();
    }

    leftPointerMove = ((context: SelectionContext, payload: PointerEventPayload): ReadyToSelectStatePossibleTargetStates => {
        const viewportPoint = convertFromWindow2ViewPort({x: payload.x, y: payload.y}, context.canvas);
        context.setSelectionEndPoint(viewportPoint);
        context.toggleSelectionBox(true);
        return "SELECTING";
    }).bind(this);

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates>> = {
        leftPointerUp: {
            action: () => "IDLE",
            defaultTargetState: "IDLE",
        },
        leftPointerMove: {
            action: this.leftPointerMove,
            defaultTargetState: "SELECTING",
        },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, SelectionContext, ReadyToSelectStatePossibleTargetStates>> {
        return this._eventReactions;
    }

}

export class ReadyToPanViaSpaceBarState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        spacebarUp: {
            action: this.spacebarUpHandler,
            defaultTargetState: "IDLE",
        },
        leftPointerDown: {
            action: this.leftPointerDownHandler,
            defaultTargetState: "INITIAL_PAN",
        },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    leftPointerDownHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.style.cursor = "grabbing";
        return "INITIAL_PAN";
    }

    spacebarUpHandler(context: KmtInputContext, payload: SpaceBarEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }
}

export class InitialPanState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates> = {
        leftPointerUp: {
            action: this.leftPointerUpHandler,
            defaultTargetState: "IDLE",
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

    get eventReactions(): EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
        return this._eventReactions;
    }

    leftPointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        return "PAN";
    }

    leftPointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "grab";
        return "READY_TO_PAN_VIA_SPACEBAR";
    }
}

export class ReadyToPanViaScrollWheelState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        middlePointerUp: {
            action: this.middlePointerUpHandler,
            defaultTargetState: "IDLE",
        },
        middlePointerMove: {
            action: this.middlePointerMoveHandler,
            defaultTargetState: "PAN_VIA_SCROLL_WHEEL",
        },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    middlePointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "grabbing";
        return "PAN_VIA_SCROLL_WHEEL";
    }

    middlePointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }

}

export class PanState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
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

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    leftPointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        return "PAN";
    }

    spacebarUpHandler(context: KmtInputContext, payload: SpaceBarEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }

    leftPointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "grab";
        return "READY_TO_PAN_VIA_SPACEBAR";
    }
}

export class PanViaScrollWheelState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        middlePointerUp: {
            action: this.middlePointerUpHandler,
            defaultTargetState: "IDLE",
        },
        middlePointerMove: {
            action: this.middlePointerMoveHandler,
            defaultTargetState: "PAN_VIA_SCROLL_WHEEL",
        },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    middlePointerMoveHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if(!context.alignCoordinateSystem){
            delta.y = -delta.y;
        }
        context.notifyOnPan(delta);
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        return "PAN_VIA_SCROLL_WHEEL";
    }

    middlePointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }
}

export class BoardWorld implements World {
    processPoint(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, point: Point): boolean {
        // console.log("Processing point", point);
        return false;
    }
}

export class KmtInputStateMachine<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> extends TemplateStateMachine<EventPayloadMapping, Context, States> {


    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context) {
        super(states, initialState, context);
    }

    setContext(context: Context): void {
        this._context = context;
    }

    get possibleStates(): States[] {
        return this._statesArray;
    }

    get states(): Record<States, State<EventPayloadMapping, Context, States>> {
        return this._states;
    }
}

export function createKmtInputStateMachine(context: KmtInputContext): TemplateStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
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
