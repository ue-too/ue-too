import type { EventReactions, State, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { BoardCamera } from "../../interface";

/**
 * @description The states of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export type RotateControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * @description The payload for the rotate by input event.
 * 
 * @category Input Flow Control
 */
export type RotateByInputEventPayload = {
    diff: number;
};

/**
 * @description The payload for the rotate to input event.
 * 
 * @category Input Flow Control
 */
export type RotateToInputEventPayload = {
    target: number;
};

type EmptyPayload = {};

/**
 * @description The payload mapping for the events of the rotate control state machine.
 *
 * @category Input Flow Control
 */
export type RotateEventPayloadMapping = {
    "userRotateByInput": RotateByInputEventPayload,
    "userRotateToInput": RotateToInputEventPayload,
    "transitionRotateByInput": RotateByInputEventPayload,
    "transitionRotateToInput": RotateToInputEventPayload,
    "lockedOnObjectRotateByInput": RotateByInputEventPayload,
    "lockedOnObjectRotateToInput": RotateToInputEventPayload,
    "unlock": EmptyPayload,
    "initateTransition": EmptyPayload,
};

/**
 * @description Output events from the rotate control state machine.
 * These events represent the rotate operations that should be executed.
 *
 * @category Input Flow Control
 */
export type RotateControlOutputEvent =
    | { type: "rotateBy", delta: number }
    | { type: "rotateTo", target: number }
    | { type: "none" };

/**
 * @description Output mapping for rotate control events.
 *
 * @category Input Flow Control
 */
export type RotateControlOutputMapping = {
    "userRotateByInput": RotateControlOutputEvent,
    "userRotateToInput": RotateControlOutputEvent,
    "transitionRotateByInput": RotateControlOutputEvent,
    "transitionRotateToInput": RotateControlOutputEvent,
    "lockedOnObjectRotateByInput": RotateControlOutputEvent,
    "lockedOnObjectRotateToInput": RotateControlOutputEvent,
};

/**
 * @description The pan control state machine.
 * It's not created directly using the TemplateStateMachine class.
 * A few helper functions are in place to make it easier to use. (user don't have to memorize the event names)
 * 
 * @category Input Flow Control
 */
export class RotateControlStateMachine extends TemplateStateMachine<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(states: Record<RotateControlStates, State<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping>>, initialState: RotateControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    /**
     * @description Notify the pan input event.
     * 
     * @category Input Flow Control
     */
    notifyRotateByInput(diff: number) {
        return this.happens("userRotateByInput", {diff: diff});
    }

    /**
     * @description Notify the rotate to animation input event.
     * 
     * @category Input Flow Control
     */
    notifyRotateToAnimationInput(target: number) {
        return this.happens("transitionRotateToInput", {target: target});
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
 * @description The accepting user input state of the rotate control state machine.
 * 
 * @category Input Flow Control
 */
export class RotationAcceptingUserInputState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    }

    userRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    userRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * @description The transition state of the rotate control state machine.
 * 
 * @category Input Flow Control
 */
export class RotationTransitionState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionRotateByInput: {action: this.transitionRotateByInputHandler, defaultTargetState: "TRANSITION"},
        transitionRotateToInput: {action: this.transitionRotateToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    userRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    transitionRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    transitionRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * @description The locked on object state of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export class RotationLockedOnObjectState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        unlock: {action: NO_OP, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * @description Create the object containing the default pan control states.
 * 
 * @category Input Flow Control
 */
export function createDefaultRotateControlStates(): Record<RotateControlStates, State<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping>> {
    return {
        ACCEPTING_USER_INPUT: new RotationAcceptingUserInputState(),
        TRANSITION: new RotationTransitionState(),
        LOCKED_ON_OBJECT: new RotationLockedOnObjectState(),
    }
}

/**
 * @description Create the default rotate control state machine.
 * 
 * @category Input Flow Control
 */
export function createDefaultRotateControlStateMachine(context: BaseContext): RotateControlStateMachine {
    return new RotateControlStateMachine(createDefaultRotateControlStates(), "ACCEPTING_USER_INPUT", context);
}
