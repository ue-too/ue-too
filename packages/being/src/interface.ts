export interface BaseContext {
    setup(): void;
    cleanup(): void;
}

type NOOP = () => void;

type IsEmptyObject<T> = T extends {} ? {} extends T ? true : false : false;

export type EventArgs<EventPayloadMapping, K> = 
  K extends keyof EventPayloadMapping
    ? IsEmptyObject<EventPayloadMapping[K]> extends true
      ? [event: K] // No payload needed
      : [event: K, payload: EventPayloadMapping[K]] // Payload required
    : [event: K, payload?: unknown]; // Unknown events

export const NO_OP: NOOP = ()=>{};

/**
 * @description This is the interface for the state machine. The interface takes in a few generic parameters.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * 
 * You can probably get by using the TemplateStateMachine class.
 * The naming is that an event would "happen" and the state of the state machine would "handle" it.
 *
 * @see {@link TemplateStateMachine}
 * @see {@link KmtInputStateMachine}
 * 
 * @category being
 */
export interface StateMachine<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> {
    switchTo(state: States): void;
    happens<K extends (keyof EventPayloadMapping)>(
        ...args: EventArgs<EventPayloadMapping, K>
      ): States | undefined;
    setContext(context: Context): void;
    states: Record<States, State<EventPayloadMapping, Context, string extends States ? string : States>>;
    onStateChange(callback: StateChangeCallback<States>): void;
    possibleStates: States[];
    onHappens(callback: (args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>, context: Context) => void): void;
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
    uponEnter(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>, from: States): void;
    beforeExit(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>, to: States): void;
    handles<K extends keyof EventPayloadMapping | string>(args: EventArgs<EventPayloadMapping, K>, context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>): States | undefined;
    eventReactions: EventReactions<EventPayloadMapping, Context, States>;
    guards: Guard<Context>;
    eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
    delay: Delay<Context, EventPayloadMapping, States> | undefined;
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
        action: (context: Context, event: EventPayloadMapping[K], stateMachine: StateMachine<EventPayloadMapping, Context, States>) => void;
        defaultTargetState?: States;
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
 * K is optional but if it is not provided, typescript won't be able to type guard in the EventGuards type.
 * 
 * @category being
 */
export type Guard<Context extends BaseContext, K extends string = string> = {
    [P in K]: GuardEvaluation<Context>;
}

export type Action<Context extends BaseContext, EventPayloadMapping, States extends string> = {
    action: (context: Context, event: EventPayloadMapping[keyof EventPayloadMapping], stateMachine: StateMachine<EventPayloadMapping, Context, States>) => void;
    defaultTargetState?: States;
}

export type Delay<Context extends BaseContext, EventPayloadMapping, States extends string> = {
    time: number;
    action: Action<Context, EventPayloadMapping, States>;
}

/**
 * @description This is a mapping of a guard to a target state.
 * 
 * Generic parameters:
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - G: The guard type.
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * 
 * You probably don't need to use this type directly.
 * 
 * @see {@link TemplateState['eventGuards']}
 * 
 * @category being
 */
export type GuardMapping<Context extends BaseContext, G, States extends string> = {
    guard: G extends Guard<Context, infer K> ? K : never;
    target: States;
}

/**
 * @description This is a mapping of an event to a guard evaluation.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - T: The guard type.
 * 
 * You probably don't need to use this type directly.
 * This is a mapping of an event to a guard evaluation.
 * 
 * @see {@link TemplateState['eventGuards']}
 * 
 * @category being
 */
export type EventGuards<EventPayloadMapping, States extends string, Context extends BaseContext, T extends Guard<Context>> = {
    [K in keyof EventPayloadMapping]: GuardMapping<Context, T, States>[];
}

/**
 * @description This is the template for the state machine.
 * 
 * You can use this class to create a state machine. Usually this is all you need for the state machine. Unless you need extra functionality.
 * To create a state machine, just instantiate this class and pass in the states, initial state and context.
 * 
 * @see {@link createKmtInputStateMachine} for an example of how to create a state machine.
 * 
 * @category being
 */
export class TemplateStateMachine<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> implements StateMachine<EventPayloadMapping, Context, States> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States>>;
    protected _context: Context;
    protected _statesArray: States[];
    protected _stateChangeCallbacks: StateChangeCallback<States>[];
    protected _happensCallbacks: ((args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>, context: Context) => void)[];
    protected _timeouts: ReturnType<typeof setTimeout> | undefined = undefined;

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
    
    happens<K extends (keyof EventPayloadMapping)>(...args: EventArgs<EventPayloadMapping, K>): States | undefined {
        if(this._timeouts){
            clearTimeout(this._timeouts);
        }
        this._happensCallbacks.forEach(callback => callback(args, this._context));
        const nextState = this._states[this._currentState].handles(args, this._context, this);
        if(nextState !== undefined && nextState !== this._currentState){
            const originalState = this._currentState;
            this._states[this._currentState].beforeExit(this._context, this, nextState);
            this.switchTo(nextState);
            this._states[this._currentState].uponEnter(this._context, this, originalState);
            this._stateChangeCallbacks.forEach(callback => callback(originalState, this._currentState));
        }
        return nextState;
    }

    onStateChange(callback: StateChangeCallback<States>): void {
        this._stateChangeCallbacks.push(callback);
    }

    onHappens(callback: (args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>, context: Context) => void): void {
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
/**
 * @description This is the template for the state.
 * 
 * This is a base template that you can extend to create a state.
 * Unlike the TemplateStateMachine, this class is abstract. You need to implement the specific methods that you need.
 * The core part off the state is the event reactions in which you would define how to handle each event in a state.
 * You can define an eventReactions object that maps only the events that you need. If this state does not need to handle a specific event, you can just not define it in the eventReactions object.
 * 
 * @category being
 */
export abstract class TemplateState<EventPayloadMapping, Context extends BaseContext, States extends string = 'IDLE'> implements State<EventPayloadMapping, Context, States> {

    public abstract eventReactions: EventReactions<EventPayloadMapping, Context, States>;
    protected _guards: Guard<Context> = {} as Guard<Context>;
    protected _eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> = {} as Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
    protected _delay: Delay<Context, EventPayloadMapping, States> | undefined = undefined;

    get guards(): Guard<Context> {
        return this._guards;
    }

    get eventGuards(): Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> {
        return this._eventGuards;
    }

    get delay(): Delay<Context, EventPayloadMapping, States> | undefined {
        return this._delay;
    }

    uponEnter(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>, from: States): void {
        // console.log("enter");
    }

    beforeExit(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>, to: States): void {
        // console.log('leave');
    }

    handles<K extends keyof EventPayloadMapping | string>(args: EventArgs<EventPayloadMapping, K>, context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States>): States | undefined{
        const eventKey = args[0] as keyof EventPayloadMapping;
        const eventPayload = args[1] as EventPayloadMapping[keyof EventPayloadMapping];
        if (this.eventReactions[eventKey]) {
            this.eventReactions[eventKey].action(context, eventPayload, stateMachine);
            const targetState = this.eventReactions[eventKey].defaultTargetState;
            const guardToEvaluate = this._eventGuards[eventKey];
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

export function placeHolder(){
    return "placeholder";
};
