import { Point } from "src/index";
import type { EventAction, StateMachine, State } from "src/being";
import { TemplateState, TemplateStateMachine } from "src/being";
import { BoardCamera } from "src/board-camera";

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
    camera: BoardCamera;
    limitEntireViewPort: boolean;
    notifyPanInput: (delta: Point) => void;
};

export class PanControlStateMachine extends TemplateStateMachine<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(states: Record<PanControlStates, State<PanEventPayloadMapping, PanContext, PanControlStates>>, initialState: PanControlStates, context: PanContext){
        super(states, initialState, context);
    }

    notifyPanInput(diff: Point): void{
        this.happens("userPanByInput", {diff: diff}, this._context);
    }

    notifyZoomInput(deltaZoomAmount: number, anchorPoint: Point): void{
        console.error("Zoom input is not implemented");
    }

    notifyRotationInput(delta: number): void{
        console.error("Rotation input is not implemented");
    }

    set limitEntireViewPort(limit: boolean){
        this._context.limitEntireViewPort = limit;
    }

    get limitEntireViewPort(): boolean {
        return this._context.limitEntireViewPort;
    }
}

export class AcceptingUserInputState extends TemplateState<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){
        super();
    }

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionPanByInput: {action: this.transitionPanByInputHandler, defaultTargetState: "TRANSITION"},
        transitionPanToInput: {action: this.transitionPanToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "ACCEPTING_USER_INPUT";
    }

    transitionPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "TRANSITION";
    }

    transitionPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "LOCKED_ON_OBJECT";
    }

}

export class TransitionState extends TemplateState<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){
        super();
    }

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionPanByInput: {action: this.transitionPanByInputHandler, defaultTargetState: "TRANSITION"},
        transitionPanToInput: {action: this.transitionPanToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "ACCEPTING_USER_INPUT";
    }

    transitionPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "TRANSITION";
    }

    transitionPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
        return "LOCKED_ON_OBJECT";
    }

}

export class LockedOnObjectState extends TemplateState<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){
        super();
    }

    eventReactions: Partial<EventAction<PanEventPayloadMapping, PanContext, PanControlStates>> = {
        unlock: {action: this.unlockHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectPanByInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(stateMachine: StateMachine<PanEventPayloadMapping, PanContext, PanControlStates>, context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.notifyPanInput(payload.target);
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