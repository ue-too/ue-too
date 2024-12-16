export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    setContext(context: Context): void;
    states: Record<States, State<EventPayloadMapping, Context, States>>;
}

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE'> { 
    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    eventReactions: Partial<EventAction<EventPayloadMapping, Context, States>>;
}

export type EventAction<EventPayloadMapping, Context, States extends string> = {
    [K in keyof EventPayloadMapping]: (stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context, event: EventPayloadMapping[K]) => States;
};

export abstract class TemplateStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States>>;
    protected _context: Context;
    protected _statesArray: States[];

    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context){
        this._states = states;
        this._currentState = initialState;
        this._context = context;
        this._statesArray = Object.keys(states) as States[];
    }

    switchTo(state: States): void {
        this._currentState = state;
    }
    
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        const nextState = this._states[this._currentState].handles(this, event, payload, this._context);
        if(nextState !== undefined && nextState !== this._currentState){
            console.log(this._currentState, "->", nextState);
            this.switchTo(nextState);
        }
        return nextState;
    }

    get currentState(): States {
        return this._currentState;
    }

    setContext(context: Context): void {
        this._context = context;
    }

    get possibleStates(): States[] {
        return this._statesArray;
    }

    get states(): Record<States, State<EventPayloadMapping, Context, States>> {
        return this._states;
    }
}

export abstract class TemplateState<EventPayloadMapping, Context, States extends string = 'IDLE'> implements State<EventPayloadMapping, Context, States> {
    abstract eventReactions: Partial<EventAction<EventPayloadMapping, Context, States>>;

    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        if(this.eventReactions[event]) {
            return this.eventReactions[event](stateMachine, context, payload);
        }
        return undefined;
    }
}

export class UserInputStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    private _states: Record<States, State<EventPayloadMapping, Context, States>>;
    private _currentState: States;
    private _context: Context;
    private _statesArray: States[];


    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context) {
        this._states = states;
        this._currentState = initialState;
        this._context = context;
        this._statesArray = Object.keys(states) as States[];
    }

    switchTo(state: States): void {
        this._currentState = state;
    }

    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K]): States | undefined {
        const nextState = this.states[this._currentState].handles(this, event, payload, this._context);
            if(nextState !== undefined && nextState !== this._currentState){
            // console.log(this.currentState, "->", nextState);
            this.switchTo(nextState);
        }
        return nextState;
    }

    setContext(context: Context): void {
        this._context = context;
    }

    get possibleStates(): States[] {
        return this._statesArray;
    }

    get states(): Record<States, State<EventPayloadMapping, Context, States>> {
        return this._states;
    }
}
