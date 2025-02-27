import { BaseContext, EventReactions, EventGuards, Guard, State, StateMachine, TemplateState, TemplateStateMachine } from "../being/interfaces";
import { Point } from "src/util/misc";
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

export type KmtIdleStatePossibleTargetStates = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL";

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
        const anchorPoint = convertFromWindow2ViewPort(cursorPosition, context.canvas);
        if(!context.alignCoordinateSystem){
            anchorPoint.y = -anchorPoint.y;
        }
        context.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
    }

    spacebarDownHandler(context: KmtInputContext, payload: SpaceBarEventPayload): void {
        context.canvas.style.cursor = "grab";
    }

    middlePointerDownHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.style.cursor = "grabbing";
    }
}

export type ReadyToSelectStatePossibleTargetStates = "IDLE" | "SELECTING";

export type SelectionContext = {
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
        context.canvas.style.cursor = "grabbing";
    }

    spacebarUpHandler(context: KmtInputContext, payload: SpaceBarEventPayload): void {
        context.canvas.style.cursor = "default";
    }
}

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
        context.canvas.style.cursor = "grab";
    }
}

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
        context.canvas.style.cursor = "grabbing";
    }

    middlePointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.style.cursor = "default";
    }

}

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

    spacebarUpHandler(context: KmtInputContext, payload: SpaceBarEventPayload): void {
        context.canvas.style.cursor = "default";
    }

    leftPointerUpHandler(context: KmtInputContext, payload: PointerEventPayload): void {
        context.canvas.style.cursor = "grab";
    }
}

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
        context.canvas.style.cursor = "default";
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
