/**
 * Base context interface for state machines.
 *
 * @remarks
 * The context is shared across all states in a state machine and can be used to store data
 * that persists between state transitions. All custom contexts must extend this interface.
 *
 * The setup and cleanup methods provide lifecycle hooks for resource management:
 * - `setup()`: Called when the context is initialized
 * - `cleanup()`: Called when the context is destroyed
 *
 * @example
 * ```typescript
 * interface MyContext extends BaseContext {
 *   counter: number;
 *   data: string[];
 *   setup() {
 *     this.counter = 0;
 *     this.data = [];
 *   }
 *   cleanup() {
 *     this.data = [];
 *   }
 * }
 * ```
 *
 * @category Core
 */
export interface BaseContext {
    setup(): void;
    cleanup(): void;
}

type NOOP = () => void;

/**
 * Utility type to check if an object type is empty.
 * @internal
 */
type IsEmptyObject<T> = T extends {} ? ({} extends T ? true : false) : false;

/**
 * Utility type to derive a string literal union from a readonly array of string literals.
 *
 * @remarks
 * This helper type extracts the element types from a readonly array to create a union type.
 * Useful for defining state machine states from an array.
 *
 * @example
 * ```typescript
 * const TEST_STATES = ["one", "two", "three"] as const;
 * type TestStates = CreateStateType<typeof TEST_STATES>; // "one" | "two" | "three"
 * ```
 *
 * @category Utilities
 */
export type CreateStateType<ArrayLiteral extends readonly string[]> =
    ArrayLiteral[number];

/**
 * Type for event arguments with conditional payload requirement.
 *
 * @remarks
 * This utility type determines whether an event requires a payload argument based on the
 * event payload mapping. If the payload is an empty object, no payload is required.
 *
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam K - The event key
 *
 * @category Utilities
 */
export type EventArgs<EventPayloadMapping, K> =
    K extends keyof EventPayloadMapping
        ? IsEmptyObject<EventPayloadMapping[K]> extends true
            ? [event: K] // No payload needed
            : [event: K, payload: EventPayloadMapping[K]] // Payload required
        : [event: K, payload?: unknown]; // Unknown events

/**
 * No-operation function constant used as a placeholder for optional actions.
 *
 * @remarks
 * Use this when you need to provide a function but don't want it to do anything,
 * such as for default state transition actions that have no side effects.
 *
 * @category Core
 */
export const NO_OP: NOOP = () => {};

/**
 * Result type indicating an event was not handled by the current state.
 *
 * @remarks
 * When a state doesn't have a handler defined for a particular event, it returns this type.
 * The state machine will not transition and the event is effectively ignored.
 *
 * @category Core
 */
export type EventNotHandled = {
    handled: false;
};

/**
 * Helper type that conditionally includes the output property.
 * @internal
 */
type WithOutput<Output> = Output extends void ? {} : { output?: Output };

/**
 * Result type when an event is successfully handled by a state.
 *
 * @remarks
 * This type represents a successful event handling result. It can optionally include:
 * - `nextState`: The state to transition to (if different from current)
 * - `output`: A return value from the event handler (only present when Output is not void)
 *
 * @typeParam States - Union of all possible state names in the state machine
 * @typeParam Output - The output type for this event (defaults to void)
 *
 * @example
 * ```typescript
 * // Simple transition without output
 * const result: EventHandled<"IDLE" | "ACTIVE"> = {
 *   handled: true,
 *   nextState: "ACTIVE"
 *   // output property does not exist when Output is void
 * };
 *
 * // With output value
 * const resultWithOutput: EventHandled<"IDLE" | "ACTIVE", number> = {
 *   handled: true,
 *   nextState: "IDLE",
 *   output: 42
 * };
 * ```
 *
 * @category Core
 */
export type EventHandled<States extends string, Output = void> = {
    handled: true;
    nextState?: States;
} & WithOutput<Output>;

/**
 * Discriminated union representing the result of event handling.
 *
 * @remarks
 * Every event handler returns an EventResult, which is either:
 * - {@link EventHandled}: The event was processed successfully
 * - {@link EventNotHandled}: The event was not recognized/handled
 *
 * Use the `handled` discriminant to narrow the type in TypeScript.
 *
 * @typeParam States - Union of all possible state names
 * @typeParam Output - The output type for handled events
 *
 * @category Core
 */
export type EventResult<States extends string, Output = void> =
    | EventNotHandled
    | EventHandled<States, Output>;

/**
 * @description A default output mapping that maps all events to void.
 * Used as default when no output mapping is provided.
 *
 * @category Types
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
 * @category Types
 */
export interface StateMachine<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> {
    switchTo(state: States): void;
    // Overload for known events - provides IntelliSense with typed output
    happens<K extends keyof EventPayloadMapping>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventResult<
        States,
        K extends keyof EventOutputMapping ? EventOutputMapping[K] : void
    >;
    // Overload for unknown events - maintains backward compatibility
    happens<K extends string>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventResult<States, unknown>;
    setContext(context: Context): void;
    states: Record<
        States,
        State<
            EventPayloadMapping,
            Context,
            string extends States ? string : States,
            EventOutputMapping
        >
    >;
    onStateChange(callback: StateChangeCallback<States>): void;
    possibleStates: States[];
    onHappens(
        callback: (
            args: EventArgs<
                EventPayloadMapping,
                keyof EventPayloadMapping | string
            >,
            context: Context
        ) => void
    ): void;
    reset(): void;
    start(): void;
    wrapup(): void;
}

/**
 * @description This is the type for the callback that is called when the state changes.
 *
 * @category Types
 */
export type StateChangeCallback<States extends string = 'IDLE'> = (
    currentState: States,
    nextState: States
) => void;

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
 * @category Types
 */
export interface State<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> {
    uponEnter(
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        from: States | 'INITIAL'
    ): void;
    beforeExit(
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        to: States | 'TERMINAL'
    ): void;
    handles<K extends keyof EventPayloadMapping | string>(
        args: EventArgs<EventPayloadMapping, K>,
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >
    ): EventResult<
        States,
        K extends keyof EventOutputMapping ? EventOutputMapping[K] : void
    >;
    // eventReactions: EventReactions<EventPayloadMapping, Context, States, EventOutputMapping>;
    guards: Guard<Context>;
    eventGuards: Partial<
        EventGuards<EventPayloadMapping, States, Context, Guard<Context>>
    >;
    delay:
        | Delay<Context, EventPayloadMapping, States, EventOutputMapping>
        | undefined;
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
 * @category Types
 */
export type EventReactions<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string,
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> = {
    [K in keyof Partial<EventPayloadMapping>]: {
        action: (
            context: Context,
            event: EventPayloadMapping[K],
            stateMachine: StateMachine<
                EventPayloadMapping,
                Context,
                States,
                EventOutputMapping
            >
        ) => K extends keyof EventOutputMapping
            ? EventOutputMapping[K] | void
            : void;
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
 * @category Types
 */
export type GuardEvaluation<Context extends BaseContext> = (
    context: Context
) => boolean;

/**
 * @description This is the type for the guard of a state.
 *
 * guard is an object that maps a key to a guard evaluation.
 * K is all the possible keys that can be used to evaluate the guard.
 * K is optional but if it is not provided, typescript won't be able to type guard in the EventGuards type.
 *
 * @category Types
 */
export type Guard<Context extends BaseContext, K extends string = string> = {
    [P in K]: GuardEvaluation<Context>;
};

export type Action<
    Context extends BaseContext,
    EventPayloadMapping,
    States extends string,
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
    Output = void,
> = {
    action: (
        context: Context,
        event: EventPayloadMapping[keyof EventPayloadMapping],
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >
    ) => Output | void;
    defaultTargetState?: States;
};

export type Delay<
    Context extends BaseContext,
    EventPayloadMapping,
    States extends string,
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> = {
    time: number;
    action: Action<Context, EventPayloadMapping, States, EventOutputMapping>;
};

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
 * @category Types
 */
export type GuardMapping<
    Context extends BaseContext,
    G,
    States extends string,
> = {
    guard: G extends Guard<Context, infer K> ? K : never;
    target: States;
};

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
 * @category Types
 */
export type EventGuards<
    EventPayloadMapping,
    States extends string,
    Context extends BaseContext,
    T extends Guard<Context>,
> = {
    [K in keyof EventPayloadMapping]: GuardMapping<Context, T, States>[];
};

/**
 * Concrete implementation of a finite state machine.
 *
 * @remarks
 * This class provides a complete, ready-to-use state machine implementation. It's generic enough
 * to handle most use cases without requiring custom extensions.
 *
 * ## Features
 *
 * - **Type-safe events**: Events and their payloads are fully typed via the EventPayloadMapping
 * - **State transitions**: Automatic state transitions based on event handlers
 * - **Event outputs**: Handlers can return values that are included in the result
 * - **Lifecycle hooks**: States can define `uponEnter` and `beforeExit` callbacks
 * - **State change listeners**: Subscribe to state transitions
 * - **Shared context**: All states access the same context object for persistent data
 *
 * ## Usage Pattern
 *
 * 1. Define your event payload mapping type
 * 2. Define your states as a string union type
 * 3. Create state classes extending {@link TemplateState}
 * 4. Instantiate TemplateStateMachine with your states and initial state
 *
 * @typeParam EventPayloadMapping - Object mapping event names to their payload types
 * @typeParam Context - Context type shared across all states
 * @typeParam States - Union of all possible state names (string literals)
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 *
 * @example
 * Basic vending machine state machine
 * ```typescript
 * type Events = {
 *   insertCoin: { amount: number };
 *   selectItem: { itemId: string };
 *   cancel: {};
 * };
 *
 * type States = "IDLE" | "PAYMENT" | "DISPENSING";
 *
 * interface VendingContext extends BaseContext {
 *   balance: number;
 *   setup() { this.balance = 0; }
 *   cleanup() {}
 * }
 *
 * const context: VendingContext = {
 *   balance: 0,
 *   setup() { this.balance = 0; },
 *   cleanup() {}
 * };
 *
 * const machine = new TemplateStateMachine<Events, VendingContext, States>(
 *   {
 *     IDLE: new IdleState(),
 *     PAYMENT: new PaymentState(),
 *     DISPENSING: new DispensingState()
 *   },
 *   "IDLE",
 *   context
 * );
 *
 * // Trigger events
 * machine.happens("insertCoin", { amount: 100 });
 * machine.happens("selectItem", { itemId: "A1" });
 * ```
 *
 * @category State Machine Core
 * @see {@link TemplateState} for creating state implementations
 * @see {@link StateMachine} for the interface definition
 */
export class TemplateStateMachine<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> implements StateMachine<
    EventPayloadMapping,
    Context,
    States,
    EventOutputMapping
> {
    protected _currentState: States | 'INITIAL' | 'TERMINAL';
    protected _states: Record<
        States,
        State<EventPayloadMapping, Context, States, EventOutputMapping>
    >;
    protected _context: Context;
    protected _statesArray: States[];
    protected _stateChangeCallbacks: StateChangeCallback<States>[];
    protected _happensCallbacks: ((
        args: EventArgs<
            EventPayloadMapping,
            keyof EventPayloadMapping | string
        >,
        context: Context
    ) => void)[];
    protected _timeouts: ReturnType<typeof setTimeout> | undefined = undefined;
    protected _initialState: States;

    constructor(
        states: Record<
            States,
            State<EventPayloadMapping, Context, States, EventOutputMapping>
        >,
        initialState: States,
        context: Context,
        autoStart: boolean = true
    ) {
        this._states = states;
        this._currentState = 'INITIAL';
        this._initialState = initialState;
        this._context = context;
        this._statesArray = Object.keys(states) as States[];
        this._stateChangeCallbacks = [];
        this._happensCallbacks = [];
        if (autoStart) {
            this.start();
        }
    }

    reset(): void {
        this.wrapup();
        this.switchTo('INITIAL');
        this.start();
    }

    start(): void {
        if (this.currentState !== 'INITIAL') {
            return;
        }
        this._context.setup();
        this.switchTo(this._initialState);
        this._states[this._initialState].uponEnter(
            this._context,
            this,
            this._initialState
        );
    }

    wrapup(): void {
        if (this._currentState === 'TERMINAL') {
            return;
        }
        const originalState = this._currentState;
        if (originalState !== 'INITIAL') {
            this._states[originalState].beforeExit(
                this._context,
                this,
                'TERMINAL'
            );
        }
        this._context.cleanup();
        this.switchTo('TERMINAL');
    }

    switchTo(state: States | 'INITIAL' | 'TERMINAL'): void {
        this._currentState = state;
    }

    // Implementation signature - matches both overloads
    happens<K extends keyof EventPayloadMapping>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventResult<
        States,
        K extends keyof EventOutputMapping ? EventOutputMapping[K] : void
    >;
    happens<K extends string>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventResult<States, unknown>;
    happens<K extends keyof EventPayloadMapping | string>(
        ...args: EventArgs<EventPayloadMapping, K>
    ): EventResult<States, unknown> {
        if (this._timeouts) {
            clearTimeout(this._timeouts);
        }
        if (
            this._currentState === 'INITIAL' ||
            this._currentState === 'TERMINAL'
        ) {
            return { handled: false };
        }
        this._happensCallbacks.forEach(callback =>
            callback(args, this._context)
        );
        const result = this._states[this._currentState].handles(
            args,
            this._context,
            this
        );
        if (
            result.handled &&
            result.nextState !== undefined &&
            result.nextState !== this._currentState
        ) {
            // TODO: whether or not to transition to the same state (currently no, uponEnter and beforeExit will not be called if the state is the same)
            const originalState = this._currentState;
            this._states[this._currentState].beforeExit(
                this._context,
                this,
                result.nextState
            );
            this.switchTo(result.nextState);
            this._states[this._currentState].uponEnter(
                this._context,
                this,
                originalState
            );
            for (const callback of this._stateChangeCallbacks) {
                callback(originalState, this._currentState);
            }
        }
        return result;
    }

    onStateChange(callback: StateChangeCallback<States>): void {
        this._stateChangeCallbacks.push(callback);
    }

    onHappens(
        callback: (
            args: EventArgs<
                EventPayloadMapping,
                keyof EventPayloadMapping | string
            >,
            context: Context
        ) => void
    ): void {
        this._happensCallbacks.push(callback);
    }

    get currentState(): States | 'INITIAL' | 'TERMINAL' {
        return this._currentState;
    }

    setContext(context: Context): void {
        this._context = context;
    }

    get possibleStates(): States[] {
        return this._statesArray;
    }

    get states(): Record<
        States,
        State<EventPayloadMapping, Context, States, EventOutputMapping>
    > {
        return this._states;
    }
}
/**
 * Abstract base class for state machine states.
 *
 * @remarks
 * This abstract class provides the foundation for implementing individual states in a state machine.
 * Each state defines how it responds to events through the `eventReactions` object.
 *
 * ## Key Concepts
 *
 * - **Event Reactions**: Define handlers for events this state cares about. Unhandled events are ignored.
 * - **Guards**: Conditional logic that determines which state to transition to based on context
 * - **Lifecycle Hooks**: `uponEnter` and `beforeExit` callbacks for state transition side effects
 * - **Selective Handling**: Only define reactions for events relevant to this state
 *
 * ## Implementation Pattern
 *
 * 1. Extend this class for each state in your state machine
 * 2. Implement the `eventReactions` property with handlers for relevant events
 * 3. Optionally override `uponEnter` and `beforeExit` for lifecycle logic
 * 4. Optionally define `guards` and `eventGuards` for conditional transitions
 *
 * @typeParam EventPayloadMapping - Object mapping event names to their payload types
 * @typeParam Context - Context type shared across all states
 * @typeParam States - Union of all possible state names (string literals)
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 *
 * @example
 * Simple state implementation
 * ```typescript
 * class IdleState extends TemplateState<MyEvents, MyContext, MyStates> {
 *   eventReactions = {
 *     start: {
 *       action: (context, event) => {
 *         console.log('Starting...');
 *         context.startTime = Date.now();
 *       },
 *       defaultTargetState: "ACTIVE"
 *     },
 *     reset: {
 *       action: (context, event) => {
 *         context.counter = 0;
 *       }
 *       // No state transition - stays in IDLE
 *     }
 *   };
 *
 *   uponEnter(context, stateMachine, fromState) {
 *     console.log(`Entered IDLE from ${fromState}`);
 *   }
 * }
 * ```
 *
 * @example
 * State with guards for conditional transitions
 * ```typescript
 * class PaymentState extends TemplateState<Events, VendingContext, States> {
 *   guards = {
 *     hasEnoughMoney: (context) => context.balance >= context.itemPrice,
 *     needsChange: (context) => context.balance > context.itemPrice
 *   };
 *
 *   eventReactions = {
 *     selectItem: {
 *       action: (context, event) => {
 *         context.selectedItem = event.itemId;
 *         context.itemPrice = getPrice(event.itemId);
 *       },
 *       defaultTargetState: "IDLE" // Fallback if no guard matches
 *     }
 *   };
 *
 *   eventGuards = {
 *     selectItem: [
 *       { guard: 'hasEnoughMoney', target: 'DISPENSING' },
 *       // If hasEnoughMoney is false, uses defaultTargetState (IDLE)
 *     ]
 *   };
 * }
 * ```
 *
 * @category State Machine Core
 * @see {@link TemplateStateMachine} for the state machine implementation
 * @see {@link EventReactions} for defining event handlers
 */
export abstract class TemplateState<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string = 'IDLE',
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> implements State<EventPayloadMapping, Context, States, EventOutputMapping> {
    protected _eventReactions: EventReactions<
        EventPayloadMapping,
        Context,
        States,
        EventOutputMapping
    > = {} as EventReactions<
        EventPayloadMapping,
        Context,
        States,
        EventOutputMapping
    >;
    protected _guards: Guard<Context> = {} as Guard<Context>;
    protected _eventGuards: Partial<
        EventGuards<EventPayloadMapping, States, Context, Guard<Context>>
    > = {} as Partial<
        EventGuards<EventPayloadMapping, States, Context, Guard<Context>>
    >;
    protected _delay:
        | Delay<Context, EventPayloadMapping, States, EventOutputMapping>
        | undefined = undefined;

    get handlingEvents(): (keyof EventPayloadMapping)[] {
        return Object.keys(
            this._eventReactions
        ) as (keyof EventPayloadMapping)[];
    }

    get guards(): Guard<Context> {
        return this._guards;
    }

    get eventGuards(): Partial<
        EventGuards<EventPayloadMapping, States, Context, Guard<Context>>
    > {
        return this._eventGuards;
    }

    get delay():
        | Delay<Context, EventPayloadMapping, States, EventOutputMapping>
        | undefined {
        return this._delay;
    }

    uponEnter(
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        from: States | 'INITIAL'
    ): void {
        // console.log("enter");
    }

    beforeExit(
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        to: States | 'TERMINAL'
    ): void {
        // console.log('leave');
    }

    handles<K extends keyof EventPayloadMapping | string>(
        args: EventArgs<EventPayloadMapping, K>,
        context: Context,
        stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >
    ): EventResult<
        States,
        K extends keyof EventOutputMapping ? EventOutputMapping[K] : void
    > {
        const eventKey = args[0] as keyof EventPayloadMapping;
        const eventPayload =
            args[1] as EventPayloadMapping[keyof EventPayloadMapping];
        if (this._eventReactions[eventKey]) {
            // Capture the output from the action
            const output = this._eventReactions[eventKey].action(
                context,
                eventPayload,
                stateMachine
            );
            const targetState =
                this._eventReactions[eventKey].defaultTargetState;
            const guardsToEvaluate = this._eventGuards[eventKey];
            const baseResult = {
                handled: true as const,
                nextState: targetState,
            };
            const resultWithOutput =
                output !== undefined ? { ...baseResult, output } : baseResult;

            if (guardsToEvaluate) {
                const target = guardsToEvaluate.find(guard => {
                    if (this._guards[guard.guard]) {
                        return this._guards[guard.guard](context);
                    }
                    return false;
                });
                const finalResult = target
                    ? { ...resultWithOutput, nextState: target.target }
                    : resultWithOutput;
                return finalResult as EventResult<
                    States,
                    K extends keyof EventOutputMapping
                        ? EventOutputMapping[K]
                        : void
                >;
            }
            return resultWithOutput as EventResult<
                States,
                K extends keyof EventOutputMapping
                    ? EventOutputMapping[K]
                    : void
            >;
        }
        return { handled: false };
    }
}

/**
 * Creates a type guard function for checking if a value belongs to a specific set of states.
 *
 * @remarks
 * This utility function generates a TypeScript type guard that narrows a string type
 * to a specific union of string literals. Useful when you have multiple state types
 * and need to distinguish between them at runtime.
 *
 * @typeParam T - String literal type to guard for
 * @param set - Readonly array of string literals defining the valid states
 * @returns A type guard function that checks if a string is in the set
 *
 * @example
 * Creating state guards for hierarchical state machines
 * ```typescript
 * type MainStates = "idle" | "active" | "paused";
 * type SubStates = "loading" | "processing" | "complete";
 * type AllStates = MainStates | SubStates;
 *
 * const MAIN_STATES = ["idle", "active", "paused"] as const;
 * const isMainState = createStateGuard(MAIN_STATES);
 *
 * function handleState(state: AllStates) {
 *   if (isMainState(state)) {
 *     // TypeScript knows state is MainStates here
 *     console.log('Main state:', state);
 *   } else {
 *     // TypeScript knows state is SubStates here
 *     console.log('Sub state:', state);
 *   }
 * }
 * ```
 *
 * @category Utilities
 */
export function createStateGuard<T extends string>(set: readonly T[]) {
    return (s: string): s is T => set.includes(s as T);
}
