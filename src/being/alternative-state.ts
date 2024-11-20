
export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States;
}

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

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE'> { 
    happens<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States;
}

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

export class UserInputIdleState implements State<EventPayloadMapping, StateContext, UserInputState> {

    constructor(){}

    happens<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, StateContext, UserInputState>, event: K, payload: EventPayloadMapping[K], context: StateContext): UserInputState {
        switch(event) {
            case "leftPointerDown":
                return this.handleLeftPointerDown(stateMachine, payload, context);
        }
        return "IDLE";
    }

    handleLeftPointerDown(stateMachine: StateMachine<EventPayloadMapping, StateContext, UserInputState>, payload: EventPayloadMapping["leftPointerDown"], context: StateContext): UserInputState {
        return "READY_TO_PAN";
    }
}

export class UserInputReadyToPanState implements State<EventPayloadMapping, StateContext, UserInputState> {

    constructor(){}

    happens<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, StateContext, UserInputState>, event: K, payload: EventPayloadMapping[K], context: StateContext): UserInputState {
        switch(event) {
            case "leftPointerDown":
                return this.handleLeftPointerDown(stateMachine, payload, context);
        }
        return "IDLE";
    }

    handleLeftPointerDown(stateMachine: StateMachine<EventPayloadMapping, StateContext, UserInputState>, payload: EventPayloadMapping["leftPointerDown"], context: StateContext): UserInputState {
        return "READY_TO_PAN";
    }
}

const userInputStateMachine = new GenericStateMachine<EventPayloadMapping, StateContext, UserInputState>({
    IDLE: new UserInputIdleState(),
    READY_TO_PAN: new UserInputReadyToPanState(),
}, "IDLE");




