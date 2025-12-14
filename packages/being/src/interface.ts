export interface BaseContext {
    setup(): void;
    cleanup(): void;
}

type NOOP = () => void;

type IsEmptyObject<T> = T extends {} ? {} extends T ? true : false : false;

/**
 * @description Utility type to derive a string literal union from a readonly array of string literals.
 * 
 * Example:
 * ```ts
 * const TEST_STATES = ["one", "two", "three"] as const;
 * type TestStates = CreateStateType<typeof TEST_STATES>; // "one" | "two" | "three"
 * ```
 */
export type CreateStateType<ArrayLiteral extends readonly string[]> = ArrayLiteral[number];

export type EventArgs<EventPayloadMapping, K> = 
  K extends keyof EventPayloadMapping
    ? IsEmptyObject<EventPayloadMapping[K]> extends true
      ? [event: K] // No payload needed
      : [event: K, payload: EventPayloadMapping[K]] // Payload required
    : [event: K, payload?: unknown]; // Unknown events

export const NO_OP: NOOP = ()=>{};

export type EventNotHandled = {
    handled: false;
}

/**
 * @description The result when an event is handled by a state.
 * 
 * Generic parameters:
 * - States: All of the possible states that the state machine can be in.
 * - Output: The output type for this event. Defaults to void.
 * 
 * @category being
 */
export type EventHandled<States extends string, Output = void> = {
    handled: true;
    nextState?: States;
    output?: Output;
}

/**
 * @description The result of handling an event. Either handled (with optional output) or not handled.
 * 
 * @category being
 */
export type EventHandledResult<States extends string, Output = void> = EventNotHandled | EventHandled<States, Output>;

/**
 * @description A default output mapping that maps all events to void.
 * Used as default when no output mapping is provided.
 * 
 * @category being
 */
export type DefaultOutputMapping<EventPayloadMapping> = {
    [K in keyof EventPayloadMapping]: void;
};

/**
 * @description This is the interface for the state machine. The interface takes in a few generic parameters.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * - EventOutputMapping: A mapping of events to their output types. Defaults to void for all events.
 * 
 * You can probably get by using the TemplateStateMachine class.
 * The naming is that an event would "happen" and the state of the state machine would "handle" it.
 *
 * @see {@link TemplateStateMachine}
 * @see {@link KmtInputStateMachine}
 * 
 * @category being
 */
export interface StateMachine<
    EventPayloadMapping, 
    Context extends BaseContext, 
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> {
    switchTo(state: States): void;
    // Overload for known events - provides IntelliSense with typed output
    happens<K extends keyof EventPayloadMapping>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventHandledResult<States, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void>;
    // Overload for unknown events - maintains backward compatibility
    happens<K extends string>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventHandledResult<States, unknown>;
    setContext(context: Context): void;
    states: Record<States, State<EventPayloadMapping, Context, string extends States ? string : States, EventOutputMapping>>;
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
 * - EventOutputMapping: A mapping of events to their output types. Defaults to void for all events.
 * 
 * A state's all possible states can be only a subset of the possible states of the state machine. (a state only needs to know what states it can transition to)
 * This allows for a state to be reusable across different state machines.
 *
 * @see {@link TemplateState}
 * 
 * @category being
 */
export interface State<
    EventPayloadMapping, 
    Context extends BaseContext, 
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> { 
    uponEnter(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>, from: States): void;
    beforeExit(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>, to: States): void;
    handles<K extends (keyof EventPayloadMapping | string)>(args: EventArgs<EventPayloadMapping, K>, context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>): EventHandledResult<States, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void>;
    eventReactions: EventReactions<EventPayloadMapping, Context, States, EventOutputMapping>;
    guards: Guard<Context>;
    eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
    delay: Delay<Context, EventPayloadMapping, States, EventOutputMapping> | undefined;
}

/**
 * @description This is the type for the event reactions of a state.
 * 
 * Generic parameters:
 * - EventPayloadMapping: A mapping of events to their payloads.
 * - Context: The context of the state machine. (which can be used by each state to do calculations that would persist across states)
 * - States: All of the possible states that the state machine can be in. e.g. a string literal union like "IDLE" | "SELECTING" | "PAN" | "ZOOM"
 * - EventOutputMapping: A mapping of events to their output types. Defaults to void for all events.
 * 
 * The action function can now return an output value that will be included in the EventHandledResult.
 * 
 * @category being
 */
export type EventReactions<
    EventPayloadMapping, 
    Context extends BaseContext, 
    States extends string,
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> = {
    [K in keyof Partial<EventPayloadMapping>]: { 
        action: (
            context: Context, 
            event: EventPayloadMapping[K], 
            stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>
        ) => K extends keyof EventOutputMapping ? (EventOutputMapping[K] | void) : void;
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

export type Action<
    Context extends BaseContext, 
    EventPayloadMapping, 
    States extends string,
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>,
    Output = void
> = {
    action: (context: Context, event: EventPayloadMapping[keyof EventPayloadMapping], stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>) => Output | void;
    defaultTargetState?: States;
}

export type Delay<
    Context extends BaseContext, 
    EventPayloadMapping, 
    States extends string,
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> = {
    time: number;
    action: Action<Context, EventPayloadMapping, States, EventOutputMapping>;
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
export class TemplateStateMachine<
    EventPayloadMapping, 
    Context extends BaseContext, 
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> implements StateMachine<EventPayloadMapping, Context, States, EventOutputMapping> {

    protected _currentState: States;
    protected _states: Record<States, State<EventPayloadMapping, Context, States, EventOutputMapping>>;
    protected _context: Context;
    protected _statesArray: States[];
    protected _stateChangeCallbacks: StateChangeCallback<States>[];
    protected _happensCallbacks: ((args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>, context: Context) => void)[];
    protected _timeouts: ReturnType<typeof setTimeout> | undefined = undefined;

    constructor(states: Record<States, State<EventPayloadMapping, Context, States, EventOutputMapping>>, initialState: States, context: Context){
        this._states = states;
        this._currentState = initialState;
        this._context = context;
        this._statesArray = Object.keys(states) as States[];
        this._stateChangeCallbacks = [];
        this._happensCallbacks = [];
        this._states[initialState].uponEnter(context, this, initialState);
    }

    switchTo(state: States): void {
        this._currentState = state;
    }
    
    // Implementation signature - matches both overloads
    happens<K extends keyof EventPayloadMapping>(...args: EventArgs<EventPayloadMapping, K>): EventHandledResult<States, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void>;
    happens<K extends string>(...args: EventArgs<EventPayloadMapping, K>): EventHandledResult<States, unknown>;
    happens<K extends keyof EventPayloadMapping | string>(...args: EventArgs<EventPayloadMapping, K>): EventHandledResult<States, unknown> {
        if(this._timeouts){
            clearTimeout(this._timeouts);
        }
        this._happensCallbacks.forEach(callback => callback(args, this._context));
        const result = this._states[this._currentState].handles(args, this._context, this);
        if(result.handled && result.nextState !== undefined && result.nextState !== this._currentState){ // TODO: whether or not to transition to the same state (currently no) (uponEnter and beforeExit will still be called if the state is the same)
            const originalState = this._currentState;
            this._states[this._currentState].beforeExit(this._context, this, result.nextState);
            this.switchTo(result.nextState);
            this._states[this._currentState].uponEnter(this._context, this, originalState);
            this._stateChangeCallbacks.forEach(callback => callback(originalState, this._currentState));
        }
        return result;
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

    get states(): Record<States, State<EventPayloadMapping, Context, States, EventOutputMapping>> {
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
export abstract class TemplateState<
    EventPayloadMapping, 
    Context extends BaseContext, 
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> implements State<EventPayloadMapping, Context, States, EventOutputMapping> {

    public abstract eventReactions: EventReactions<EventPayloadMapping, Context, States, EventOutputMapping>;
    protected _guards: Guard<Context> = {} as Guard<Context>;
    protected _eventGuards: Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> = {} as Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>>;
    protected _delay: Delay<Context, EventPayloadMapping, States, EventOutputMapping> | undefined = undefined;

    get guards(): Guard<Context> {
        return this._guards;
    }

    get eventGuards(): Partial<EventGuards<EventPayloadMapping, States, Context, Guard<Context>>> {
        return this._eventGuards;
    }

    get delay(): Delay<Context, EventPayloadMapping, States, EventOutputMapping> | undefined {
        return this._delay;
    }

    uponEnter(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>, from: States): void {
        // console.log("enter");
    }

    beforeExit(context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>, to: States): void {
        // console.log('leave');
    }

    handles<K extends (keyof EventPayloadMapping | string)>(args: EventArgs<EventPayloadMapping, K>, context: Context, stateMachine: StateMachine<EventPayloadMapping, Context, States, EventOutputMapping>): EventHandledResult<States, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void>{
        const eventKey = args[0] as keyof EventPayloadMapping;
        const eventPayload = args[1] as EventPayloadMapping[keyof EventPayloadMapping];
        if (this.eventReactions[eventKey]) {
            // Capture the output from the action
            const output = this.eventReactions[eventKey].action(context, eventPayload, stateMachine);
            const targetState = this.eventReactions[eventKey].defaultTargetState;
            const guardToEvaluate = this._eventGuards[eventKey];
            if(guardToEvaluate){
                const target = guardToEvaluate.find((guard)=>{
                    if(this.guards[guard.guard]){
                        return this.guards[guard.guard](context);
                    }
                    return false;
                });
                return target 
                    ? {handled: true, nextState: target.target, output: output as any} 
                    : {handled: true, nextState: targetState, output: output as any};
            }
            return {handled: true, nextState: targetState, output: output as any};
        }
        return {handled: false};
    }
}


/**
 * Example usage
 * ```ts
 type TestSubStates = "subOne" | "subTwo" | "subThree";
 const TEST_STATES = ["one", "two", "three"] as const;
 type TestStates = CreateStateType<typeof TEST_STATES>;
 type AllStates = TestStates | TestSubStates;

 const isTestState = createStateGuard(TEST_STATES);

function test(s: AllStates) {
	if (isTestState(s)) {
		// s: TestStates
    }
}
 * ```

 * @param set 
 * @returns 
 */

export function createStateGuard<T extends string>(set: readonly T[]) {
    return (s: string): s is T => set.includes(s as T);
}
