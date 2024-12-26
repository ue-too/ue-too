export interface StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    setContext(context: Context): void;
    states: Record<States, State<EventPayloadMapping, Context, States>>;
    onStateChange(callback: StateChangeCallback<EventPayloadMapping, Context, States>): void;
    possibleStates: States[];
    onHappens(callback: (event: keyof EventPayloadMapping, payload: EventPayloadMapping[keyof EventPayloadMapping], context: Context) => void): void;
}

export type StateChangeCallback<EventPayloadMapping, Context, States extends string = 'IDLE'> = (currentState: States, nextState: States) => void;

export interface State<EventPayloadMapping, Context, States extends string = 'IDLE'> { 
    uponEnter(stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context): void;
    uponLeave(stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context): void;
    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    eventReactions: Partial<EventAction<EventPayloadMapping, Context, States>>;
    guards: Guard<Context>;
    eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
}

export type EventAction<EventPayloadMapping, Context, States extends string> = {
    [K in keyof EventPayloadMapping]: { 
        action: (stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context, event: EventPayloadMapping[K]) => States; 
        defaultTargetState: States;
    };
};

export type GuardEvaluation<Context> = (context: Context) => boolean;

export type Guard<Context, K extends string = string> = {
    [P in K]: GuardEvaluation<Context>;
}

export type GuardMapping<Context, G, States extends string> = {
    guard: G extends Guard<Context, infer K> ? K : never;
    target: States;
}

export type EventGuards<EventPayloadMapping, States extends string, Context, T extends Guard<Context>> = {
    [K in keyof EventPayloadMapping]: GuardMapping<Context, T, States>[];
}

export abstract class TemplateStateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States>>;
    protected _context: Context;
    protected _statesArray: States[];
    protected _stateChangeCallbacks: StateChangeCallback<EventPayloadMapping, Context, States>[];
    protected _happensCallbacks: ((event: keyof EventPayloadMapping, payload: EventPayloadMapping[keyof EventPayloadMapping], context: Context) => void)[];

    constructor(states: Record<States, State<EventPayloadMapping, Context, States>>, initialState: States, context: Context){
        this._states = states;
        this._currentState = initialState;
        this._context = context;
        this._statesArray = Object.keys(states) as States[];
        this._stateChangeCallbacks = [];
        this._happensCallbacks = [];
    }

    switchTo(state: States): void {
        this._currentState = state;
    }
    
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        this._happensCallbacks.forEach(callback => callback(event, payload, this._context));
        const nextState = this._states[this._currentState].handles(this, event, payload, this._context);
        if(nextState !== undefined && nextState !== this._currentState){
            const originalState = this._currentState;
            this.switchTo(nextState);
            this._stateChangeCallbacks.forEach(callback => callback(originalState, this._currentState));
        }
        return nextState;
    }

    onStateChange(callback: StateChangeCallback<EventPayloadMapping, Context, States>): void {
        this._stateChangeCallbacks.push(callback);
    }

    onHappens(callback: (event: keyof EventPayloadMapping, payload: EventPayloadMapping[keyof EventPayloadMapping], context: Context) => void): void {
        this._happensCallbacks.push(callback);
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

type EventReactions<EventPayloadMapping, Context, States extends string> = Partial<EventAction<EventPayloadMapping, Context, States>>;


export abstract class TemplateState<EventPayloadMapping, Context, States extends string = 'IDLE'> implements State<EventPayloadMapping, Context, States> {

    abstract eventReactions: EventReactions<EventPayloadMapping, Context, States>;
    protected _guards: Guard<Context> = {};
    protected _eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> = {};

    get guards(): Guard<Context> {
        return this._guards;
    }

    get eventGuards(): Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> {
        return this._eventGuards;
    }

    uponEnter(stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context): void {
        console.log("enter");
    }

    uponLeave(stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context): void {
        console.log('leave');
    }

    handles<K extends keyof EventPayloadMapping>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        if (this.eventReactions[event]) {
            this.eventReactions[event].action(stateMachine, context, payload);
            const targetState = this.eventReactions[event].defaultTargetState;
            const guardToEvaluate = this._eventGuards[event];
            if(guardToEvaluate){
                console.log("guardToEvaluate", guardToEvaluate);
                const target = guardToEvaluate.find((guard)=>{
                    return this.guards[guard.guard](context);
                });
                console.log("target", target);
                return target ? target.target : undefined;
            }
            return targetState;
        }
        return undefined;
    }
}
