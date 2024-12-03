export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    setContext(context: Context): void;
    // bubblesUp<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States;
}

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE'> { 
    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    eventReactions: Partial<EventAction<EventPayloadMapping, Context, States>>;
    // externalEvents: Partial<EventAction<ExternalEventMapping, Context, ExternalStates>>;
}

export type EventAction<EventPayloadMapping, Context, States extends string> = {
    [K in keyof EventPayloadMapping]: (stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context, event: EventPayloadMapping[K]) => States;
};

export abstract class TemplateStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States>>;
    protected _context: Context;

    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context){
        this._states = states;
        this._currentState = initialState;
        this._context = context;
    }

    switchTo(state: States): void {
        this._currentState = state;
    }
    
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        const nextState = this._states[this._currentState].handles(this, event, payload, this._context);
        if(nextState !== undefined && nextState !== this._currentState){
            // console.log(this._currentState, "->", nextState);
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

    private states: Record<States, State<EventPayloadMapping, Context, States>>;
    private currentState: States;
    private context: Context;


    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context) {
        this.states = states;
        this.currentState = initialState;
        this.context = context;
    }

    switchTo(state: States): void {
        this.currentState = state;
    }

    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K]): States | undefined {
        const nextState = this.states[this.currentState].handles(this, event, payload, this.context);
        if(nextState !== undefined && nextState !== this.currentState){
            console.log(this.currentState, "->", nextState);
            this.switchTo(nextState);
        }
        return nextState;
    }

    setContext(context: Context): void {
        this.context = context;
    }
}
