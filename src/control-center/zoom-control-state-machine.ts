import { BaseZoomHandlerConfig, Point } from "src/index";
import { TemplateStateMachine, TemplateState } from "src/being";
import type { State, StateMachine, EventAction } from "src/being";

export type ZoomControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";


export type ZoomByAtInputPayload = {
    deltaZoom: number;
    anchorPoint: Point;
}

export type ZoomToAtInputPayload = {
    targetZoom: number;
    anchorPoint: Point;
}

export type ZoomByPayload = {
    deltaZoom: number;
}

export type ZoomToPayload = {
    targetZoom: number;
}

export type ZoomEventPayloadMapping = {
    "userZoomByAtInput": ZoomByAtInputPayload,
    "userZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtInput": ZoomByAtInputPayload,
    "transitionZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtCenterInput": ZoomByPayload,
    "transitionZoomToAtCenterInput": ZoomToAtInputPayload,
    "lockedOnObjectZoomByAtInput": ZoomByAtInputPayload,
    "lockedOnObjectZoomToAtInput": ZoomToAtInputPayload,
    "unlock": {},
    "initiateTransition": {},
};

export type ZoomContext = {
    config: BaseZoomHandlerConfig;
    notifyZoomByAtInput: (delta: number, at: Point) => void;
    notifyZoomByAtCenterInput: (delta: number) => void;
    notifyZoomToAtCenterInput: (targetZoom: number) => void;
    // this at anchor is in the world space
    experimentalZoomToAtWorld: (targetZoom: number, at: Point) => void;
    // notifyZoomToAtInput: (to: number, at: Point) => void;
};

export class ZoomAcceptingUserInputState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    private _eventReactions: Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        initiateTransition: {action: this.initiateTransition, defaultTargetState: "TRANSITION"},
    };

    get eventReactions(): Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    userZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlStates {
        context.notifyZoomByAtInput(payload.deltaZoom, payload.anchorPoint);
        return "ACCEPTING_USER_INPUT";
    }

    userZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlStates {
        // context.notifyZoomToAtInput(payload.targetZoom, payload.anchorPoint);
        return "ACCEPTING_USER_INPUT";
    }

    initiateTransition(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["initiateTransition"]): ZoomControlStates {
        return "TRANSITION";
    }
}

export class ZoomTransitionState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(){
        super();
    }

    private _eventReactions: Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        transitionZoomByAtInput: {action: this.transitionZoomByAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtInput: {action: this.transitionZoomToAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtCenterInput: {action: this.transitionZoomToAtCenterInput, defaultTargetState: "TRANSITION"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    userZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlStates {
        context.notifyZoomByAtInput(payload.deltaZoom, payload.anchorPoint);
        return "ACCEPTING_USER_INPUT";
    }

    userZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlStates {
        return "ACCEPTING_USER_INPUT";
    }

    transitionZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomByAtInput"]): ZoomControlStates {
        return "TRANSITION";
    }

    transitionZoomByAtCenterInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomByAtCenterInput"]): ZoomControlStates {
        context.notifyZoomByAtCenterInput(payload.deltaZoom);
        return "TRANSITION";
    }

    transitionZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomToAtInput"]): ZoomControlStates {
        return "TRANSITION";
    }

    transitionZoomToAtCenterInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["transitionZoomToAtCenterInput"]): ZoomControlStates {
        // context.notifyZoomToAtCenterInput(payload.targetZoom);
        context.experimentalZoomToAtWorld(payload.targetZoom, payload.anchorPoint);
        return "TRANSITION";
    }

}

export class ZoomLockedOnObjectState extends TemplateState<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(){
        super();
    }

    private _eventReactions: Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    get eventReactions(): Partial<EventAction<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> {
        return this._eventReactions;
    }

    lockedOnObjectZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    lockedOnObjectZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlStates {
        return "LOCKED_ON_OBJECT";
    }

    userZoomByAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlStates {
        context.notifyZoomByAtInput(payload.deltaZoom, payload.anchorPoint);
        return "ACCEPTING_USER_INPUT";
    }

    userZoomToAtInput(stateMachine: StateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>, context: ZoomContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlStates {
        // context.notifyZoomToAtInput(payload.targetZoom, payload.anchorPoint);
        return "ACCEPTING_USER_INPUT";
    }
}

export class ZoomControlStateMachine extends TemplateStateMachine<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates> {

    constructor(states: Record<ZoomControlStates, State<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>>, initialState: ZoomControlStates, context: ZoomContext){
        super(states, initialState, context);
    }

    notifyZoomByAtInput(delta: number, at: Point): void {
        this.happens("userZoomByAtInput", {deltaZoom: delta, anchorPoint: at}, this._context);
    }

    notifyZoomByAtInputAnimation(delta: number, at: Point): void {
        this.happens("transitionZoomByAtInput", {deltaZoom: delta, anchorPoint: at}, this._context);
    }

    notifyZoomToAtCenterInput(targetZoom: number, at: Point): void {
        this.happens("transitionZoomToAtCenterInput", {targetZoom: targetZoom, anchorPoint: at}, this._context);
    }

    initateTransition(): void {
        this.happens("initiateTransition", {}, this._context);
    }
}


export function createDefaultZoomControlStates(): Record<ZoomControlStates, State<ZoomEventPayloadMapping, ZoomContext, ZoomControlStates>> {
    return {
        ACCEPTING_USER_INPUT: new ZoomAcceptingUserInputState(),
        TRANSITION: new ZoomTransitionState(),
        LOCKED_ON_OBJECT: new ZoomLockedOnObjectState(),
    }
}

export function createDefaultZoomControlStateMachine(context: ZoomContext): ZoomControlStateMachine {
    return new ZoomControlStateMachine(createDefaultZoomControlStates(), "ACCEPTING_USER_INPUT", context);
}
