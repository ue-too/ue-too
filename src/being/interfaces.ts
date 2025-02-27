export interface BaseContext {
    setup(): void;
    cleanup(): void;
}

type NOOP = () => void;

export const NO_OP: NOOP = ()=>{};

/**
 * @description This is the interface for the state machine. The interface takes in a few generic parameters:
 * You can probably get by using the TemplateStateMachine class.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 *
 * @see {@link TemplateStateMachine}
 * @see {@link KmtInputStateMachine}
 * 
 * @category being
 */
export interface StateMachine<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    setContext(context: Context): void;
    states: Record<States, State<EventPayloadMapping, Context, string extends States ? string : States>>;
    onStateChange(callback: StateChangeCallback<States>): void;
    possibleStates: States[];
    onHappens(callback: (event: keyof EventPayloadMapping, payload: EventPayloadMapping[keyof EventPayloadMapping], context: Context) => void): void;
}

/**
 * @description This is the type for the callback that is called when the state changes.
 *
 * @category being
 */
export type StateChangeCallback<States extends string = 'IDLE'> = (currentState: States, nextState: States) => void;

/**
 * @description This is the interface for the state. The interface takes in a few generic parameters:
 * You can probably get by extending the TemplateState class. 
 *
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * 
 * A state's all possible states can be only a subset of the possible states of the state machine. (a state only needs to know what states it can transition to)
 * This allows for a state to be reusable across different state machines.
 *
 * @see {@link TemplateState}
 * 
 * @category being
 */
export interface State<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> { 
    uponEnter(context: Context): void;
    uponLeave(context: Context): void;
    handles<K extends keyof Partial<EventPayloadMapping>>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined;
    eventReactions: EventReactions<EventPayloadMapping, Context, States>;
    guards: Guard<Context>;
    eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
}

/**
 * @description This is the type for the event reactions of a state.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * 
 * @category being
 */
export type EventReactions<EventPayloadMapping, Context extends BaseContext, States extends string> = {
    [K in keyof Partial<EventPayloadMapping>]: { 
        action: (context: Context, event: EventPayloadMapping[K]) => void; 
        defaultTargetState: States;
    };
};

/**
 * @description This is the type for the guard evaluation when a state transition is happening.
 * 
 * Guard evaluations are evaluated after the state has handled the event with the action.
 * Guard evaluations can be defined in an array and the first guard that evaluates to true will be used to determine the next state.
 * 
 * Generic parameters:
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * 
 * @category being
 */
export type GuardEvaluation<Context extends BaseContext> = (context: Context) => boolean;

/**
 * @description This is the type for the guard of a state.
 * 
 * guard is an object that maps a key to a guard evaluation.
 * K is all the possible keys that can be used to evaluate the guard.
 * 
 * @category being
 */
export type Guard<Context extends BaseContext, K extends string = string> = {
    [P in K]: GuardEvaluation<Context>;
}

export type GuardMapping<Context extends BaseContext, G, States extends string> = {
    guard: G extends Guard<Context, infer K> ? K : never;
    target: States;
}

export type EventGuards<EventPayloadMapping, States extends string, Context extends BaseContext, T extends Guard<Context>> = {
    [K in keyof EventPayloadMapping]: GuardMapping<Context, T, States>[];
}

export class TemplateStateMachine<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States>>;
    protected _context: Context;
    protected _statesArray: States[];
    protected _stateChangeCallbacks: StateChangeCallback<States>[];
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
        const nextState = this._states[this._currentState].handles(event, payload, this._context);
        if(nextState !== undefined && nextState !== this._currentState){
            const originalState = this._currentState;
            this._states[this._currentState].uponLeave(this._context);
            this.switchTo(nextState);
            this._states[this._currentState].uponEnter(this._context);
            this._stateChangeCallbacks.forEach(callback => callback(originalState, this._currentState));
        }
        return nextState;
    }

    onStateChange(callback: StateChangeCallback<States>): void {
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

export abstract class TemplateState<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> implements State<EventPayloadMapping, Context, States> {

    abstract eventReactions: EventReactions<EventPayloadMapping, Context, States>;
    protected _guards: Guard<Context> = {};
    protected _eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> = {};

    get guards(): Guard<Context> {
        return this._guards;
    }

    get eventGuards(): Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> {
        return this._eventGuards;
    }

    uponEnter(context: Context): void {
        // console.log("enter");
    }

    uponLeave(context: Context): void {
        // console.log('leave');
    }

    handles<K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context): States | undefined {
        if (this.eventReactions[event]) {
            this.eventReactions[event].action(context, payload);
            const targetState = this.eventReactions[event].defaultTargetState;
            const guardToEvaluate = this._eventGuards[event];
            if(guardToEvaluate){
                const target = guardToEvaluate.find((guard)=>{
                    if(this.guards[guard.guard]){
                        return this.guards[guard.guard](context);
                    }
                    return false;
                });
                return target ? target.target : targetState;
            }
            return targetState;
        }
        return undefined;
    }
}
