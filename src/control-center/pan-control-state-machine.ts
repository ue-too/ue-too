import { Point } from "src/index";
import type { EventAction, StateMachine, State } from "src/being";
import { TemplateStateMachine } from "src/being";
export type PanControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

export type PanByInputEventPayload = {
    diff: Point;
};

export type PanToInputEventPayload = {
    target: Point;
};

export type PanEventPayloadMapping = {
    "userPanByInput": PanByInputEventPayload,
    "userPanToInput": PanToInputEventPayload,
    "transitionPanByInput": PanByInputEventPayload,
    "transitionPanToInput": PanToInputEventPayload,
    "lockedOnObjectPanByInput": PanByInputEventPayload,
    "lockedOnObjectPanToInput": PanToInputEventPayload,
    "unlock": {},
};

export type PanContext = {

};

export class PanControlStateMachine extends TemplateStateMachine<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(states: Record<PanControlStates, State<PanEventPayloadMapping, PanContext, PanControlStates>>, initialState: PanControlStates, context: PanContext){
        super(states, initialState, context);
    }

}

export class AcceptingUserInputState implements State<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){

    }

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        userPanByInput: this.userPanByInputHandler,
        userPanToInput: this.userPanToInputHandler,
        transitionPanByInput: this.transitionPanByInputHandler,
        transitionPanToInput: this.transitionPanToInputHandler,
        lockedOnObjectPanByInput: this.lockedOnObjectPanByInputHandler,
        lockedOnObjectPanToInput: this.lockedOnObjectPanToInputHandler,
    }

    handles<K extends keyof PanEventPayloadMapping>(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, event: K, payload: PanEventPayloadMapping[K], context: PanContext): PanControlStates {
        if(this.eventReactions[event]){
            return this.eventReactions[event](stateMachine, context, payload);
        }
        return "ACCEPTING_USER_INPUT";
    }

    userPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "ACCEPTING_USER_INPUT";
    }

    transitionPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "TRANSITION";
    }

    transitionPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

}

export class TransitionState implements State<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){}

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        userPanByInput: this.userPanByInputHandler,
        userPanToInput: this.userPanToInputHandler,
        transitionPanByInput: this.transitionPanByInputHandler,
        transitionPanToInput: this.transitionPanToInputHandler,
        lockedOnObjectPanByInput: this.lockedOnObjectPanByInputHandler,
        lockedOnObjectPanToInput: this.lockedOnObjectPanToInputHandler,
    }

    handles<K extends keyof PanEventPayloadMapping>(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, event: K, payload: PanEventPayloadMapping[K], context: PanContext): PanControlStates {
        if(this.eventReactions[event]){
            return this.eventReactions[event](stateMachine, context, payload);
        }
        return "TRANSITION";
    }

    userPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "ACCEPTING_USER_INPUT";
    }

    transitionPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "TRANSITION";
    }

    transitionPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

}

export class LockedOnObjectState implements State<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){}

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        unlock: this.unlockHandler,
        lockedOnObjectPanByInput: this.lockedOnObjectPanByInputHandler,
        lockedOnObjectPanToInput: this.lockedOnObjectPanToInputHandler,
    }

    handles<K extends keyof PanEventPayloadMapping>(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, event: K, payload: PanEventPayloadMapping[K], context: PanContext): PanControlStates {
        if(this.eventReactions[event]){
            return this.eventReactions[event](stateMachine, context, payload);
        }
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        return "LOCKED_ON_OBJECT";
    }

    unlockHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: {}): PanControlStates {
        return "ACCEPTING_USER_INPUT";
    }

}

export function createDefaultPanControlStates(): Record<PanControlStates, State<PanEventPayloadMapping, PanContext, PanControlStates>> {
    return {
        ACCEPTING_USER_INPUT: new AcceptingUserInputState(),
        TRANSITION: new TransitionState(),
        LOCKED_ON_OBJECT: new LockedOnObjectState(),
    }
}

export function createDefaultPanControlStateMachine(context: PanContext): PanControlStateMachine {
    return new PanControlStateMachine(createDefaultPanControlStates(), "ACCEPTING_USER_INPUT", context);
}