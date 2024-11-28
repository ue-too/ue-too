import { EventAction, GenericStateMachine, State, StateMachine } from "./interfaces";
import { Point } from "../index";
import { PointCal } from "point2point";


export type BoardStates = "IDLE" | "READY_TO_SELECT" | "SELECTING" | "READY_TO_PAN_VIA_SPACEBAR" | "PAN" | "INITIAL_PAN";

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

export type BoardContext = {
    initialX: number;
    initialY: number;
}

export type BoardEventMapping = {
    leftPointerDown: PointerEventPayload;
    leftPointerUp: PointerEventPayload;
    leftPointerMove: PointerEventPayload;
    spacebarDown: SpaceBarEventPayload;
    spacebarUp: SpaceBarEventPayload;
    stayIdle: CursorStatusUpdateEventPayload;
    cursorOnElement: CursorStatusUpdateEventPayload;
    scroll: ScrollEventPayload;
    scrollWithCtrl: ScrollWithCtrlEventPayload;
}

export interface World {
    processPoint(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, point: Point): boolean;
}

export class BoardIdleState implements State<BoardEventMapping, BoardContext, BoardStates> {

    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        leftPointerDown: () => "READY_TO_SELECT",
        spacebarDown: () => "READY_TO_PAN_VIA_SPACEBAR",
        leftPointerMove: (stateMachine, context, payload) => this.leftPointerMoveHandler(stateMachine, context, payload),
        scroll: this.scrollHandler,
        scrollWithCtrl: this.scrollWithCtrlHandler,
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "IDLE";
    }

    leftPointerMoveHandler(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: PointerEventPayload): BoardStates {
        this.world.processPoint(stateMachine, {x: payload.x, y: payload.y});
        return "IDLE";
    }

    scrollHandler(stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: ScrollEventPayload): BoardStates {
        stateMachine.inputObserver.notifyOnPan({x: payload.deltaX, y: payload.deltaY});
        return "IDLE";
    }

    scrollWithCtrlHandler(stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: ScrollWithCtrlEventPayload): BoardStates {
        const zoomAmount = payload.deltaY * 0.005;
        const cursorPosition = {x: payload.x, y: payload.y};
        const canvasBoundingRect = stateMachine.canvas.getBoundingClientRect();
        const cameraCenterInWindow = {x: canvasBoundingRect.left + (canvasBoundingRect.right - canvasBoundingRect.left) / 2, y: canvasBoundingRect.top + (canvasBoundingRect.bottom - canvasBoundingRect.top) / 2};
        const anchorPoint = PointCal.subVector(cursorPosition, cameraCenterInWindow);
        stateMachine.inputObserver.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
        return "IDLE";
    }
}

export class ReadyToSelectState implements State<BoardEventMapping, BoardContext, BoardStates> {

    constructor() {
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        leftPointerUp: () => "IDLE",
        leftPointerMove: () => "SELECTING",
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "READY_TO_SELECT";
    }
}

export class SelectingState implements State<BoardEventMapping, BoardContext, BoardStates> {


    constructor() {
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        leftPointerUp: () => "IDLE",
        leftPointerMove: () => "SELECTING",
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "SELECTING";
    }

}

export class ReadyToPanViaSpaceBarState implements State<BoardEventMapping, BoardContext, BoardStates> {
    constructor() {
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        spacebarUp: () => "IDLE",
        leftPointerDown: this.leftPointerDownHandler,
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "READY_TO_PAN_VIA_SPACEBAR";
    }

    leftPointerDownHandler(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: PointerEventPayload): BoardStates {
        stateMachine.setContext({
            initialX: payload.x,
            initialY: payload.y,
        });
        return "INITIAL_PAN";
    }
}

export class InitialPanState implements State<BoardEventMapping, BoardContext, BoardStates> {

    constructor() {
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        leftPointerUp: () => "READY_TO_PAN_VIA_SPACEBAR",
        leftPointerMove: this.leftPointerMoveHandler,
        spacebarUp: () => "IDLE",
        leftPointerDown: () => "PAN",
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "INITIAL_PAN";
    }

    leftPointerMoveHandler(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: PointerEventPayload): BoardStates {
        return "PAN";
    }
}

export class PanState implements State<BoardEventMapping, BoardContext, BoardStates> {

    constructor() {
    }

    private _eventReactions: Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> = {
        leftPointerUp: () => "READY_TO_PAN_VIA_SPACEBAR",
        leftPointerMove: this.leftPointerMoveHandler,
        spacebarUp: () => "IDLE",
    }

    get eventReactions(): Partial<EventAction<BoardEventMapping, BoardContext, BoardStates>> {
        return this._eventReactions;
    }

    handles<K extends keyof BoardEventMapping>(stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>, event: K, payload: BoardEventMapping[K], context: BoardContext): BoardStates {
        if(this._eventReactions[event]){
            return this._eventReactions[event](stateMachine, context, payload);
        }
        return "PAN";
    }

    leftPointerMoveHandler(stateMachine: GenericStateMachine<BoardEventMapping, BoardContext, BoardStates>, context: BoardContext, payload: PointerEventPayload): BoardStates {
        const delta = {
            x: context.initialX - payload.x,
            y: context.initialY - payload.y,
        };
        stateMachine.inputObserver.notifyOnPan(delta);
        stateMachine.setContext({
            initialX: payload.x,
            initialY: payload.y,
        });
        return "PAN";
    }
}

export class BoardWorld implements World {
    processPoint(stateMachine: StateMachine<BoardEventMapping, BoardContext, BoardStates>, point: Point): boolean {
        // console.log("Processing point", point);
        return false;
    }
}


const world = new BoardWorld();


