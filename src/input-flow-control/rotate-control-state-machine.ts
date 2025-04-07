import { Point } from "src/util/misc";
import type { EventReactions, State, BaseContext } from "src/being";
import { NO_OP } from "src/being";
import { TemplateState, TemplateStateMachine } from "src/being";
import { BoardCamera, CameraRig } from "src/board-camera";

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
 * @description The context for the rotate control state machine.
 * 
 * @category Input Flow Control
 */
export interface RotateContext extends BaseContext {
    camera: BoardCamera;
    rotateBy: (delta: number) => void;
    rotateTo: (target: number) => void;
};

/**
 * @description The pan control state machine.
 * It's not created directly using the TemplateStateMachine class.
 * A few helper functions are in place to make it easier to use. (user don't have to memorize the event names)
 * 
 * @category Input Flow Control
 */
export class RotateControlStateMachine extends TemplateStateMachine<RotateEventPayloadMapping, RotateContext, RotateControlStates> {

    constructor(states: Record<RotateControlStates, State<RotateEventPayloadMapping, RotateContext, RotateControlStates>>, initialState: RotateControlStates, context: RotateContext){
        super(states, initialState, context);
    }

    /**
     * @description Notify the pan input event.
     * 
     * @category Input Flow Control
     */
    notifyRotateInput(diff: number): void{
        this.happens("userRotateByInput", {diff: diff});
    }

    /**
     * @description Notify the rotate to animation input event.
     * 
     * @category Input Flow Control
     */
    notifyRotateToAnimationInput(target: number): void{
        this.happens("transitionRotateToInput", {target: target});
    }

    /**
     * @description Initate the transition.
     * 
     * @category Input Flow Control
     */
    initateTransition(): void{
        this.happens("initateTransition", {});
    }

}

/**
 * @description The accepting user input state of the rotate control state machine.
 * 
 * @category Input Flow Control
 */
export class AcceptingUserInputState extends TemplateState<RotateEventPayloadMapping, RotateContext, RotateControlStates> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, RotateContext, RotateControlStates> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    }

    userRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): void {
        context.rotateBy(payload.diff);
    }

    userRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): void {
        context.rotateTo(payload.target);
    }

    lockedOnObjectRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): void {
        context.rotateBy(payload.diff);
    }

    lockedOnObjectRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): void {
        context.rotateTo(payload.target);
    }

}

/**
 * @description The transition state of the rotate control state machine.
 * 
 * @category Input Flow Control
 */
export class TransitionState extends TemplateState<RotateEventPayloadMapping, RotateContext, RotateControlStates> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, RotateContext, RotateControlStates> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionRotateByInput: {action: this.transitionRotateByInputHandler, defaultTargetState: "TRANSITION"},
        transitionRotateToInput: {action: this.transitionRotateToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): RotateControlStates {
        context.rotateBy(payload.diff);
        return "ACCEPTING_USER_INPUT";
    }

    userRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): RotateControlStates {
        context.rotateTo(payload.target);
        return "ACCEPTING_USER_INPUT";
    }

    transitionRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): RotateControlStates {
        context.rotateBy(payload.diff);
        return "TRANSITION";
    }

    transitionRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): RotateControlStates {
        context.rotateTo(payload.target);
        return "TRANSITION";
    }

    lockedOnObjectRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): RotateControlStates {
        context.rotateBy(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): RotateControlStates {
        context.rotateTo(payload.target);
        return "LOCKED_ON_OBJECT";
    }

}

/**
 * @description The locked on object state of the pan control state machine.
 * 
 * @category Input Flow Control
 */
export class LockedOnObjectState extends TemplateState<RotateEventPayloadMapping, RotateContext, RotateControlStates> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, RotateContext, RotateControlStates> = {
        unlock: {action: NO_OP, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectRotateByInputHandler(context: RotateContext, payload: RotateByInputEventPayload): void {
        context.rotateBy(payload.diff);
    }

    lockedOnObjectRotateToInputHandler(context: RotateContext, payload: RotateToInputEventPayload): void {
        context.rotateTo(payload.target);
    }

}

/**
 * @description Create the object containing the default pan control states.
 * 
 * @category Input Flow Control
 */
export function createDefaultRotateControlStates(): Record<RotateControlStates, State<RotateEventPayloadMapping, RotateContext, RotateControlStates>> {
    return {
        ACCEPTING_USER_INPUT: new AcceptingUserInputState(),
        TRANSITION: new TransitionState(),
        LOCKED_ON_OBJECT: new LockedOnObjectState(),
    }
}

/**
 * @description Create the default rotate control state machine.
 * 
 * @category Input Flow Control
 */
export function createDefaultRotateControlStateMachine(context: RotateContext): RotateControlStateMachine {
    return new RotateControlStateMachine(createDefaultRotateControlStates(), "ACCEPTING_USER_INPUT", context);
}
