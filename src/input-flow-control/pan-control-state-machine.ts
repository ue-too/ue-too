import { Point } from "src/index";
import type { EventAction, StateMachine, State, BaseContext } from "src/being";
import { TemplateState, TemplateStateMachine } from "src/being";
import { BoardCamera, PanHandlerConfig } from "src/board-camera";

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
    "initateTransition": {},
};

export interface PanContext extends BaseContext {
    camera: BoardCamera;
    limitEntireViewPort: boolean;
    panBy: (delta: Point) => void;
    panTo: (target: Point) => void;
};

export class PanControlStateMachine extends TemplateStateMachine<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(states: Record<PanControlStates, State<PanEventPayloadMapping, PanContext, PanControlStates>>, initialState: PanControlStates, context: PanContext){
        super(states, initialState, context);
    }

    notifyPanInput(diff: Point): void{
        this.happens("userPanByInput", {diff: diff}, this._context);
    }

    notifyPanToAnimationInput(target: Point): void{
        this.happens("transitionPanToInput", {target: target}, this._context);
    }

    initateTransition(): void{
        this.happens("initateTransition", {}, this._context);
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

    eventReactions: EventAction<PanEventPayloadMapping, PanContext, PanControlStates> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: this.initateTransitionHandler, defaultTargetState: "TRANSITION"},
    }

    userPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "ACCEPTING_USER_INPUT";
    }

    initateTransitionHandler(context: PanContext, payload: {}): PanControlStates {
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "LOCKED_ON_OBJECT";
    }

}

export class TransitionState extends TemplateState<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){
        super();
    }

    eventReactions: EventAction<PanEventPayloadMapping, PanContext, PanControlStates> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionPanByInput: {action: this.transitionPanByInputHandler, defaultTargetState: "TRANSITION"},
        transitionPanToInput: {action: this.transitionPanToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "ACCEPTING_USER_INPUT";
    }

    userPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "ACCEPTING_USER_INPUT";
    }

    transitionPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "TRANSITION";
    }

    transitionPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "TRANSITION";
    }

    lockedOnObjectPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "LOCKED_ON_OBJECT";
    }

}

export class LockedOnObjectState extends TemplateState<PanEventPayloadMapping, PanContext, PanControlStates> {

    constructor(){
        super();
    }

    eventReactions: EventAction<PanEventPayloadMapping, PanContext, PanControlStates> = {
        unlock: {action: this.unlockHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectPanByInputHandler(context: PanContext, payload: PanByInputEventPayload): PanControlStates {
        context.panBy(payload.diff);
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectPanToInputHandler(context: PanContext, payload: PanToInputEventPayload): PanControlStates {
        context.panTo(payload.target);
        return "LOCKED_ON_OBJECT";
    }

    unlockHandler(context: PanContext, payload: {}): PanControlStates {
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
