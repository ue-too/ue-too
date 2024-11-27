import { StateMachine, State, EventAction, StateWithExternalEvents } from "./alternative-state";

export type EventPayloadMapping = {
    leftPointerDown: {
        x: number;
        y: number;
    };
    leftPointerMove: {
        x: number;
        y: number;
    };
    leftPointerUp: {
        x: number;
        y: number;
    };
    spacebarDown: {};
    spacebarUp: {};
    cursorOnTopOfElement: {
    };
    stayIdle: {};
}

export type StateContext = {

}

export type States = "IDLE" | "READY_TO_PAN_VIA_SPACEBAR" | "PAN" | "INITIAL_PAN" | "READY_TO_SELECT" | "SELECT" | "IDLE_ON_ELEMENT" | "CALCULATING_POINTER_POSITION";

export class IdleState implements StateWithExternalEvents<EventPayloadMapping, EventPayloadMapping, StateContext, States, "CLAMP"> {

    externalEvents: Partial<EventAction<EventPayloadMapping, StateContext, "CLAMP">> = {
        leftPointerDown: (context, event) => "CLAMP",
        spacebarDown: (context, event) => "CLAMP",
        spacebarUp(context, event) {
            return "CLAMP";
        },
    }

}
