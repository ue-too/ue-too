import type { State, EventReactions, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";

/**
 * @description The possible states of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export type ZoomControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * @description The payload for the zoom by at input event.
 * 
 * @category Input Flow Control
 */
export type ZoomByAtInputPayload = {
    deltaZoom: number;
    anchorPoint: Point;
}

/**
 * @description The payload for the zoom to at input event.
 * 
 * @category Input Flow Control
 */
export type ZoomToAtInputPayload = {
    targetZoom: number;
    anchorPoint: Point;
}

/**
 * @description The payload for the zoom by payload.
 * 
 * @category Input Flow Control
 */
export type ZoomByPayload = {
    deltaZoom: number;
}

/**
 * @description The payload for the zoom to payload.
 * 
 * @category Input Flow Control
 */
export type ZoomToPayload = {
    targetZoom: number;
}

/**
 * @description The payload mapping for the events of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export type ZoomEventPayloadMapping = {
    "userZoomByAtInput": ZoomByAtInputPayload,
    "userZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtInput": ZoomByAtInputPayload,
    "transitionZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtCenterInput": ZoomByPayload,
    "transitionZoomToAtCenterInput": ZoomToAtInputPayload,
    "transitionZoomToAtWorldInput": ZoomToAtInputPayload,
    "lockedOnObjectZoomByAtInput": ZoomByAtInputPayload,
    "lockedOnObjectZoomToAtInput": ZoomToAtInputPayload,
    "unlock": {},
    "initiateTransition": {},
};

/**
 * @description The context for the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export interface ZoomContext extends BaseContext {
    zoomToAt: (targetZoom: number, at: Point) => void;
    zoomByAt: (delta: number, at: Point) => void;
    zoomTo: (targetZoom: number) => void;
    zoomBy: (delta: number) => void;
    zoomToAtWorld: (targetZoom: number, at: Point) => void;
    zoomByAtWorld: (delta: number, at: Point) => void;
};

/**
 * @description The accepting user input state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomAcceptingUserInputState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> = {
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        initiateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    };

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {
        return this._eventReactions;
    }

    userZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): void {
        context.zoomByAt(payload.deltaZoom, payload.anchorPoint);
    }

    userZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): void {
        context.zoomToAt(payload.targetZoom, payload.anchorPoint);
    }
}

/**
 * @description The transition state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomTransitionState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(){
        super();
    }

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        transitionZoomByAtInput: {action: this.transitionZoomByAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtInput: {action: this.transitionZoomToAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtCenterInput: {action: this.transitionZoomToAtCenterInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtWorldInput: {action: this.transitionZoomToAtWorldInput, defaultTargetState: "TRANSITION"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): void {
        context.zoomBy(payload.deltaZoom);
    }

    lockedOnObjectZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): void {
        context.zoomTo(payload.targetZoom);
    }

    userZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): void {
        context.zoomByAt(payload.deltaZoom, payload.anchorPoint);
    }

    userZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): void {
        context.zoomToAt(payload.targetZoom, payload.anchorPoint);
    }

    transitionZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomByAtInput"]): void {
        context.zoomByAt(payload.deltaZoom, payload.anchorPoint);
    }

    transitionZoomByAtCenterInput(context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomByAtCenterInput"]): void {
        context.zoomBy(payload.deltaZoom);
    }

    transitionZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomToAtInput"]): void {
        context.zoomToAt(payload.targetZoom, payload.anchorPoint);
    }

    transitionZoomToAtCenterInput(context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomToAtCenterInput"]): void {
        context.zoomTo(payload.targetZoom);
    }

    transitionZoomToAtWorldInput(context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomToAtWorldInput"]): void {
        context.zoomToAtWorld(payload.targetZoom, payload.anchorPoint);
    }
}

/**
 * @description The locked on object state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomLockedOnObjectState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(){
        super();
    }

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): void {
        context.zoomByAt(payload.deltaZoom, payload.anchorPoint);
    }

    lockedOnObjectZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): void {
        context.zoomToAt(payload.targetZoom, payload.anchorPoint);
    }

    userZoomByAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): void {
        context.zoomByAt(payload.deltaZoom, payload.anchorPoint);
    }

    userZoomToAtInput(context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): void {
        context.zoomToAt(payload.targetZoom, payload.anchorPoint);
    }
}

/**
 * @description The zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomControlStateMachine extends TemplateStateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(states: Record<ZoomControlStates, State<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>>, initialState: ZoomControlStates, context: ZoomContext){
        super(states, initialState, context);
    }

    notifyZoomByAtInput(delta: number, at: Point): void {
        this.happens("userZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    notifyZoomByAtInputAnimation(delta: number, at: Point): void {
        this.happens("transitionZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    notifyZoomToAtCenterInput(targetZoom: number, at: Point): void {
        this.happens("transitionZoomToAtCenterInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    notifyZoomToAtWorldInput(targetZoom: number, at: Point): void {
        this.happens("transitionZoomToAtWorldInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    initateTransition(): void {
        this.happens("initiateTransition");
    }
}

/**
 * @description Create the object containing the default zoom control states.
 * 
 * @category Input Flow Control
 */
export function createDefaultZoomControlStates(): Record<ZoomControlStates, State<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> {
    return {
        ACCEPTING_USER_INPUT: new ZoomAcceptingUserInputState(),
        TRANSITION: new ZoomTransitionState(),
        LOCKED_ON_OBJECT: new ZoomLockedOnObjectState(),
    }
}

/**
 * @description Create the default zoom control state machine.
 * 
 * @category Input Flow Control
 */
export function createDefaultZoomControlStateMachine(context: ZoomContext): ZoomControlStateMachine {
    return new ZoomControlStateMachine(createDefaultZoomControlStates(), "ACCEPTING_USER_INPUT", context);
}
