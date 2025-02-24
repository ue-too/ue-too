import { EventAction, EventGuards, Guard, State, StateMachine, TemplateState, TemplateStateMachine } from "../being/interfaces";
import { Point } from "../index";
import { PointCal } from "point2point";
import { KmtInputContext } from "./kmt-input-context";


export type KmtInputStates = "IDLE" | "READY_TO_SELECT" | "SELECTING" | "READY_TO_PAN_VIA_SPACEBAR" | "READY_TO_PAN_VIA_SCROLL_WHEEL" | "PAN" | "INITIAL_PAN" | "PAN_VIA_SCROLL_WHEEL";

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

export class KmtIdleState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    private world: World;

    constructor(world: World | undefined = new BoardWorld()) {
        super();
        this.world = world;
    }

    protected _guards: Guard<KmtInputContext, "isIdle"> = {
        isIdle: () => true,
    }

    protected _eventGuards: Partial<EventGuards<KmtInputEventMapping, KmtInputStates, KmtInputContext, Guard<KmtInputContext>>> = {
    }


    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    // leftPointerDownHandler = (stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates => {
    //     const viewportPoint = convertFromWindow2ViewPort({x: payload.x, y: payload.y}, context.canvas);
    //     context.setSelectionStartPoint(viewportPoint);
    //     context.toggleSelectionBox(true);
    //     return "READY_TO_SELECT";
    // }

    leftPointerMoveHandler = (stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates => {
        this.world.processPoint(stateMachine, {x: payload.x, y: payload.y});
        return "IDLE";
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        // leftPointerDown: {
        //     action: this.leftPointerDownHandler,
        //     defaultTargetState: "READY_TO_SELECT",
        // },
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


    scrollHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: ScrollEventPayload): KmtInputStates {
        context.notifyOnPan({x: payload.deltaX, y: payload.deltaY});
        return "IDLE";
    }

    scrollWithCtrlHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: ScrollWithCtrlEventPayload): KmtInputStates {
        // console.log("raw deltaY", payload.deltaY);
        let scrollSensitivity = 0.005;
        if(Math.abs(payload.deltaY) > 100){
            scrollSensitivity = 0.0005;
        }
        const zoomAmount = payload.deltaY * scrollSensitivity;
        const cursorPosition = {x: payload.x, y: payload.y};
        const anchorPoint = convertFromWindow2ViewPort(cursorPosition, context.canvas);
        context.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
        return "IDLE";
    }

    spacebarDownHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: SpaceBarEventPayload): KmtInputStates {
        context.canvas.style.cursor = "grab";
        return "READY_TO_PAN_VIA_SPACEBAR";
    }

    middlePointerDownHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.style.cursor = "grabbing";
        return "READY_TO_PAN_VIA_SCROLL_WHEEL";
    }
}

export class ReadyToSelectState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    // leftPointerMove = ((stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates => {
    //     const viewportPoint = convertFromWindow2ViewPort({x: payload.x, y: payload.y}, context.canvas);
    //     context.setSelectionEndPoint(viewportPoint);
    //     context.toggleSelectionBox(true);
    //     return "SELECTING";
    // }).bind(this);

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        leftPointerUp: {
            action: () => "IDLE",
            defaultTargetState: "IDLE",
        },
        // leftPointerMove: {
        //     action: this.leftPointerMove,
        //     defaultTargetState: "SELECTING",
        // },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

}

export class SelectingState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {


    constructor() {
        super();
    }

    // leftPointerMoveHandler = ((stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates => {
    //     const viewportPoint = convertFromWindow2ViewPort({x: payload.x, y: payload.y}, context.canvas);
    //     context.setSelectionEndPoint(viewportPoint);
    //     return "SELECTING";
    // }).bind(this);

    // leftPointerUpHandler = ((stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates => {
    //     context.toggleSelectionBox(false);
    //     return "IDLE";
    // }).bind(this);

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
        // leftPointerUp: {
        //     action: this.leftPointerUpHandler,
        //     defaultTargetState: "IDLE",
        // },
        // leftPointerMove: {
        //     action: this.leftPointerMoveHandler,
        //     defaultTargetState: "SELECTING",
        // },
    }

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
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

    leftPointerDownHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.setInitialCursorPosition({x: payload.x, y: payload.y});
        context.canvas.style.cursor = "grabbing";
        return "INITIAL_PAN";
    }

    spacebarUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: SpaceBarEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }
}

export class InitialPanState extends TemplateState<KmtInputEventMapping, KmtInputContext, KmtInputStates> {

    constructor() {
        super();
    }

    private _eventReactions: Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> = {
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

    get eventReactions(): Partial<EventAction<KmtInputEventMapping, KmtInputContext, KmtInputStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof KmtInputEventMapping>(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, event: K, payload: KmtInputEventMapping[K], context: KmtInputContext): KmtInputStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event].action(stateMachine, context, payload);
        }
        return "INITIAL_PAN";
    }

    leftPointerMoveHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

    leftPointerUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

    middlePointerMoveHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
        context.canvas.style.cursor = "grabbing";
        return "PAN_VIA_SCROLL_WHEEL";
    }

    middlePointerUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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
            defaultTargetState: "IDLE",
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

    handles<K extends keyof KmtInputEventMapping>(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, event: K, payload: KmtInputEventMapping[K], context: KmtInputContext): KmtInputStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event].action(stateMachine, context, payload);
        }
        return "PAN";
    }

    leftPointerMoveHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

    spacebarUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: SpaceBarEventPayload): KmtInputStates {
        context.canvas.style.cursor = "default";
        return "IDLE";
    }

    leftPointerUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

    middlePointerMoveHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

    middlePointerUpHandler(stateMachine: StateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates>, context: KmtInputContext, payload: PointerEventPayload): KmtInputStates {
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

export class KmtInputStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> extends TemplateStateMachine<EventPayloadMapping, Context, States> {


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

export function createKmtInputStateMachine(context: KmtInputContext): KmtInputStateMachine<KmtInputEventMapping, KmtInputContext, KmtInputStates> {
    const states = {
        IDLE: new KmtIdleState(),
        READY_TO_SELECT: new ReadyToSelectState(),
        SELECTING: new SelectingState(),
        READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
        INITIAL_PAN: new InitialPanState(),
        PAN: new PanState(),
        READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
        PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
    }
    return new KmtInputStateMachine(states, "IDLE", context);
}
