import { InputObserver } from "src/input-observer";

export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States;
    setContext(context: Context): void;
    // bubblesUp<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States;
}

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE'> { 
    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States;
    eventReactions: Partial<EventAction<EventPayloadMapping, Context, States>>;
    // externalEvents: Partial<EventAction<ExternalEventMapping, Context, ExternalStates>>;
}

export type EventAction<EventPayloadMapping, Context, States extends string> = {
    [K in keyof EventPayloadMapping]: (stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context, event: EventPayloadMapping[K]) => States;
};

export class GenericStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    private states: Record<States, State<EventPayloadMapping, Context, States>>;
    private currentState: States;
    private context: Context;
    private _inputObserver: InputObserver;
    private _canvas: HTMLCanvasElement;

    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context, inputObserver: InputObserver, canvas: HTMLCanvasElement) {
        this.states = states;
        this.currentState = initialState;
        this.context = context;
        this._inputObserver = inputObserver;
        this._canvas = canvas;
    }

    switchTo(state: States): void {
        this.currentState = state;
    }

    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K]): States {
        const nextState = this.states[this.currentState].handles(this, event, payload, this.context);
        if(nextState !== this.currentState){
            console.log(this.currentState, "->", nextState);
            this.switchTo(nextState);
        }
        return;
    }

    setContext(context: Context): void {
        this.context = context;
    }

    get inputObserver(): InputObserver {
        return this._inputObserver;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }
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
