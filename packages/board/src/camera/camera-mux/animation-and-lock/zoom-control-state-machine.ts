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
 * @description Output events from the zoom control state machine.
 * These events represent the zoom operations that should be executed.
 *
 * @category Input Flow Control
 */
export type ZoomControlOutputEvent =
    | { type: "zoomByAt", deltaZoom: number, anchorPoint: Point }
    | { type: "zoomToAt", targetZoom: number, anchorPoint: Point }
    | { type: "zoomBy", deltaZoom: number }
    | { type: "zoomTo", targetZoom: number }
    | { type: "zoomByAtWorld", deltaZoom: number, anchorPoint: Point }
    | { type: "zoomToAtWorld", targetZoom: number, anchorPoint: Point }
    | { type: "none" };

/**
 * @description Output mapping for zoom control events.
 *
 * @category Input Flow Control
 */
export type ZoomControlOutputMapping = {
    "userZoomByAtInput": ZoomControlOutputEvent,
    "userZoomToAtInput": ZoomControlOutputEvent,
    "transitionZoomByAtInput": ZoomControlOutputEvent,
    "transitionZoomToAtInput": ZoomControlOutputEvent,
    "transitionZoomByAtCenterInput": ZoomControlOutputEvent,
    "transitionZoomToAtCenterInput": ZoomControlOutputEvent,
    "transitionZoomToAtWorldInput": ZoomControlOutputEvent,
    "lockedOnObjectZoomByAtInput": ZoomControlOutputEvent,
    "lockedOnObjectZoomToAtInput": ZoomControlOutputEvent,
};

/**
 * @description The accepting user input state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomAcceptingUserInputState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        initiateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    };

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {
        return this._eventReactions;
    }

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * @description The transition state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomTransitionState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(){
        super();
    }

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        transitionZoomByAtInput: {action: this.transitionZoomByAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtInput: {action: this.transitionZoomToAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtCenterInput: {action: this.transitionZoomToAtCenterInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtWorldInput: {action: this.transitionZoomToAtWorldInput, defaultTargetState: "TRANSITION"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomBy", deltaZoom: payload.deltaZoom };
    }

    lockedOnObjectZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomTo", targetZoom: payload.targetZoom };
    }

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomByAtCenterInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomByAtCenterInput"]): ZoomControlOutputEvent {
        return { type: "zoomBy", deltaZoom: payload.deltaZoom };
    }

    transitionZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomToAtCenterInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtCenterInput"]): ZoomControlOutputEvent {
        return { type: "zoomTo", targetZoom: payload.targetZoom };
    }

    transitionZoomToAtWorldInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtWorldInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAtWorld", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * @description The locked on object state of the zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomLockedOnObjectState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(){
        super();
    }

    private _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    lockedOnObjectZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * @description The zoom control state machine.
 * 
 * @category Input Flow Control
 */
export class ZoomControlStateMachine extends TemplateStateMachine<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(states: Record<ZoomControlStates, State<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping>>, initialState: ZoomControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    notifyZoomByAtInput(delta: number, at: Point) {
        return this.happens("userZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    notifyZoomByAtInputAnimation(delta: number, at: Point) {
        return this.happens("transitionZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    notifyZoomToAtCenterInput(targetZoom: number, at: Point) {
        return this.happens("transitionZoomToAtCenterInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    notifyZoomToAtWorldInput(targetZoom: number, at: Point) {
        return this.happens("transitionZoomToAtWorldInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    initateTransition() {
        return this.happens("initiateTransition");
    }
}

/**
 * @description Create the object containing the default zoom control states.
 * 
 * @category Input Flow Control
 */
export function createDefaultZoomControlStates(): Record<ZoomControlStates, State<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping>> {
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
export function createDefaultZoomControlStateMachine(context: BaseContext): ZoomControlStateMachine {
    return new ZoomControlStateMachine(createDefaultZoomControlStates(), "ACCEPTING_USER_INPUT", context);
}
