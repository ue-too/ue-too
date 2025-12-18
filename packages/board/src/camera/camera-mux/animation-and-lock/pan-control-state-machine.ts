import { Point } from "@ue-too/math";
import type { EventReactions, State, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { BoardCamera } from "../../interface";

/**
 * @description The states of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export type PanControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * @description The payload for the pan by input event.
 * 
 * @category Input Flow Control
 */
export type PanByInputEventPayload = {
    diff: Point;
};

/**
 * @description The payload for the pan to input event.
 * 
 * @category Input Flow Control
 */
export type PanToInputEventPayload = {
    target: Point;
};

type EmptyPayload = {};

/**
 * @description The payload mapping for the events of the pan control state machine.
 *
 * @category Input Flow Control
 */
export type PanEventPayloadMapping = {
    "userPanByInput": PanByInputEventPayload,
    "userPanToInput": PanToInputEventPayload,
    "transitionPanByInput": PanByInputEventPayload,
    "transitionPanToInput": PanToInputEventPayload,
    "lockedOnObjectPanByInput": PanByInputEventPayload,
    "lockedOnObjectPanToInput": PanToInputEventPayload,
    "unlock": EmptyPayload,
    "initateTransition": EmptyPayload,
};

/**
 * @description Output events from the pan control state machine.
 * These events represent the pan operations that should be executed.
 *
 * @category Input Flow Control
 */
export type PanControlOutputEvent =
    | { type: "panByViewPort", delta: Point }
    | { type: "panToWorld", target: Point }
    | { type: "none" };

/**
 * @description Output mapping for pan control events.
 *
 * @category Input Flow Control
 */
export type PanControlOutputMapping = {
    "userPanByInput": PanControlOutputEvent,
    "userPanToInput": PanControlOutputEvent,
    "transitionPanByInput": PanControlOutputEvent,
    "transitionPanToInput": PanControlOutputEvent,
    "lockedOnObjectPanByInput": PanControlOutputEvent,
    "lockedOnObjectPanToInput": PanControlOutputEvent,
};


/**
 * @description The pan control state machine.
 * It's not created directly using the TemplateStateMachine class.
 * A few helper functions are in place to make it easier to use. (user don't have to memorize the event names)
 * 
 * @category Input Flow Control
 */
export class PanControlStateMachine extends TemplateStateMachine<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(states: Record<PanControlStates, State<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping>>, initialState: PanControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    /**
     * @description Notify the pan input event.
     * 
     * @category Input Flow Control
     */
    notifyPanInput(diff: Point) {
        return this.happens("userPanByInput", {diff: diff});
    }

    /**
     * @description Notify the pan to animation input event.
     * 
     * @category Input Flow Control
     */
    notifyPanToAnimationInput(target: Point) {
        return this.happens("transitionPanToInput", {target: target});
    }

    /**
     * @description Initate the transition.
     * 
     * @category Input Flow Control
     */
    initateTransition(): void{
        this.happens("initateTransition");
    }
}

/**
 * @description The accepting user input state of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export class AcceptingUserInputState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    }

    userPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    userPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * @description The transition state of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export class TransitionState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionPanByInput: {action: this.transitionPanByInputHandler, defaultTargetState: "TRANSITION"},
        transitionPanToInput: {action: this.transitionPanToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent  {
        return { type: "panByViewPort", delta: payload.diff };
    }

    userPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    transitionPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    transitionPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * @description The locked on object state of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export class LockedOnObjectState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        unlock: {action: NO_OP, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * @description Create the object containing the default pan control states.
 * 
 * @category Input Flow Control
 */
export function createDefaultPanControlStates(): Record<PanControlStates, State<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping>> {
    return {
        ACCEPTING_USER_INPUT: new AcceptingUserInputState(),
        TRANSITION: new TransitionState(),
        LOCKED_ON_OBJECT: new LockedOnObjectState(),
    }
}

/**
 * @description Create the default pan control state machine.
 * 
 * @category Input Flow Control
 */
export function createDefaultPanControlStateMachine(context: BaseContext): PanControlStateMachine {
    return new PanControlStateMachine(createDefaultPanControlStates(), "ACCEPTING_USER_INPUT", context);
}
