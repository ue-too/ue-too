
/**
 * StateMachine would contain states and 
 */
export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States;
}

export type EventAction<EventPayloadMapping, Context, States> = {
    [K in keyof EventPayloadMapping]: (context: Context, event: EventPayloadMapping[K]) => States;
};

export class GenericStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    private states: Record<States, State<EventPayloadMapping, Context, States>>;
    private currentState: State<EventPayloadMapping, Context, States>;

    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States) {
        this.states = states;
        this.currentState = this.states[initialState];
    }

    switchTo(state: States): void {
        this.currentState = this.states[state];
    }

    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States {
        return this.currentState.happens(this, event, payload, context);
    }
}

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE', ExternalStates extends string = 'TEMP'> { 
    happens<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States;
    externalStates: Partial<EventAction<EventPayloadMapping, Context, ExternalStates>>;
}

// Above are interfaces and type definitions for state machine

// Below are experimental state implementations
export interface StateContext {

}

export type UserInputState = "IDLE" | "READY_TO_PAN";

export type EventPayloadMapping = {
    leftPointerDown: {
        x: number;
        y: number;
    },
    mouseMove: {
        x: number;
        y: number;
    }
}
