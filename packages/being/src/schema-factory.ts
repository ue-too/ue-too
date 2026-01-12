/**
 * Schema-based state machine factory for runtime creation.
 *
 * @remarks
 * This module provides utilities for creating state machines from JSON-like schemas,
 * enabling dynamic state machine creation at runtime. This is useful for GUI builders
 * or configuration-driven state machines.
 *
 * @category Runtime Factory
 */

import {
  BaseContext,
  TemplateState,
  TemplateStateMachine,
  StateMachine,
  EventResult,
  NO_OP,
  DefaultOutputMapping,
} from "./interface";

/**
 * Payload type definition for an event in the schema.
 * Can be an empty object (no payload) or an object with typed fields.
 */
export type EventPayloadSchema = Record<string, string> | {};

/**
 * Action function that can be executed when an event is handled.
 * Receives context, event payload, and the state machine instance.
 * Can return a value that will be included in the event result.
 * 
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventName - The specific event name this action handles
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 */
export type ActionFunction<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventName extends keyof EventPayloadMapping = keyof EventPayloadMapping,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> = (
  context: Context,
  payload: EventPayloadMapping[EventName],
  stateMachine: StateMachine<EventPayloadMapping, Context, any, EventOutputMapping>
) => EventName extends keyof EventOutputMapping ? (EventOutputMapping[EventName] | void) : void | unknown;

/**
 * Guard function that evaluates whether a transition should occur.
 * Returns true if the guard condition is met.
 */
export type GuardFunction<Context extends BaseContext = BaseContext> = (
  context: Context
) => boolean;

/**
 * Definition of a single state transition.
 * 
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventName - The specific event name for this transition
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 */
export interface TransitionDefinition<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventName extends keyof EventPayloadMapping = keyof EventPayloadMapping,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> {
  /** The event that triggers this transition */
  event: EventName;
  /** The target state after this transition */
  targetState: string;
  /** Optional action to execute when this transition occurs. Can return a value that will be included in the event result. */
  action?: ActionFunction<Context, EventPayloadMapping, EventName, EventOutputMapping>;
  /** 
   * Optional guard conditions (evaluated in order, first true guard wins).
   * Guards can be either:
   * - A guard function defined inline
   * - A string reference to a guard defined in the state's `guards` section
   */
  guards?: Array<{
    /** Guard function to evaluate, or name of a guard defined in the state's guards section */
    guard: GuardFunction<Context> | string;
    /** Target state if this guard evaluates to true */
    targetState: string;
  }>;
}

/**
 * Union type of all possible transition definitions for a given event payload mapping.
 * This ensures each transition's action payload is typed based on its specific event.
 * 
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 */
export type TransitionDefinitionUnion<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> = {
  [K in keyof EventPayloadMapping]: TransitionDefinition<Context, EventPayloadMapping, K, EventOutputMapping>
}[keyof EventPayloadMapping];

/**
 * Definition of a single state in the state machine.
 * 
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 * 
 * @example
 * ```typescript
 * {
 *   name: "PAYING",
 *   guards: {
 *     hasEnoughBalance: (context) => context.balance >= context.itemPrice,
 *     hasInsufficientBalance: (context) => context.balance < context.itemPrice,
 *   },
 *   transitions: [
 *     {
 *       event: "pay",
 *       targetState: "SELECTING",
 *       guards: [
 *         { guard: "hasEnoughBalance", targetState: "CONFIRMED" },
 *         { guard: "hasInsufficientBalance", targetState: "PAYING" },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */
export interface StateDefinition<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> {
  /** Name of this state */
  name: string;
  /** Transitions available from this state */
  transitions: TransitionDefinitionUnion<Context, EventPayloadMapping, EventOutputMapping>[];
  /** 
   * Optional mapping of guard names to guard functions.
   * Guards defined here can be reused across multiple transitions within this state
   * by referencing them by name in the transition's guards array.
   * 
   * The guard functions receive the context parameter typed with the Context type parameter,
   * not BaseContext, so you get full type safety for your context properties.
   */
  guards?: Record<string, GuardFunction<Context>>;
  /** Optional callback when entering this state */
  onEnter?: (context: Context, fromState: string) => void;
  /** Optional callback when exiting this state */
  onExit?: (context: Context, toState: string) => void;
}

/**
 * Complete schema definition for a state machine.
 * 
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 */
export interface StateMachineSchema<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> {
  /** Array of all possible state names */
  states: string[];
  /** Mapping of event names to their payload types */
  events: EventPayloadMapping;
  /** Array of state definitions */
  stateDefinitions: StateDefinition<Context, EventPayloadMapping, EventOutputMapping>[];
  /** Initial state name */
  initialState: string;
}

/**
 * Creates a state machine from a schema definition.
 *
 * @remarks
 * This factory function takes a schema and creates a fully functional state machine
 * at runtime. The resulting state machine uses type erasure (`any` types) but maintains
 * full runtime functionality.
 *
 * Actions can return values that will be included in the event result. To enable
 * typed outputs, provide an EventOutputMapping type parameter that maps event names
 * to their output types.
 *
 * @typeParam Context - The context type
 * @typeParam EventPayloadMapping - Mapping of event names to their payload types
 * @typeParam EventOutputMapping - Optional mapping of events to their output types
 *
 * @param schema - The schema definition for the state machine
 * @param context - The context instance to use for the state machine
 * @returns A fully configured state machine instance
 *
 * @example
 * Basic state machine without outputs
 * ```typescript
 * const schema: StateMachineSchema = {
 *   states: ["IDLE", "RUNNING", "PAUSED"],
 *   events: {
 *     start: {},
 *     stop: {},
 *     pause: {},
 *     resume: {}
 *   },
 *   initialState: "IDLE",
 *   stateDefinitions: [
 *     {
 *       name: "IDLE",
 *       transitions: [
 *         {
 *           event: "start",
 *           targetState: "RUNNING",
 *           action: (context) => console.log("Starting...")
 *         }
 *       ]
 *     }
 *   ]
 * };
 *
 * const machine = createStateMachineFromSchema(schema, context);
 * machine.happens("start");
 * ```
 *
 * @example
 * State machine with typed outputs
 * ```typescript
 * type Events = { calculate: { value: number }; getResult: {} };
 * type Outputs = { calculate: number; getResult: number };
 *
 * const schema: StateMachineSchema<MyContext, Events, Outputs> = {
 *   states: ["READY"],
 *   events: { calculate: { value: 0 }, getResult: {} },
 *   initialState: "READY",
 *   stateDefinitions: [
 *     {
 *       name: "READY",
 *       transitions: [
 *         {
 *           event: "calculate",
 *           targetState: "READY",
 *           action: (context, payload) => {
 *             context.total += payload.value;
 *             return context.total; // Return value included in result
 *           }
 *         },
 *         {
 *           event: "getResult",
 *           targetState: "READY",
 *           action: (context) => context.total // Return current total
 *         }
 *       ]
 *     }
 *   ]
 * };
 *
 * const machine = createStateMachineFromSchema<MyContext, Events, Outputs>(schema, context);
 * const result = machine.happens("calculate", { value: 10 });
 * if (result.handled && "output" in result) {
 *   console.log(result.output); // Typed as number
 * }
 * ```
 *
 * @category Runtime Factory
 */
export function createStateMachineFromSchema<
  Context extends BaseContext = BaseContext,
  EventPayloadMapping = any,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
>(
  schema: StateMachineSchema<Context, EventPayloadMapping, EventOutputMapping>,
  context: Context
): StateMachine<EventPayloadMapping, Context, any, EventOutputMapping> {
  // Validate schema
  if (!schema.states.includes(schema.initialState)) {
    throw new Error(
      `Initial state "${schema.initialState}" must be in the states array`
    );
  }

  // Validate all state definitions reference valid states
  for (const stateDef of schema.stateDefinitions) {
    if (!schema.states.includes(stateDef.name)) {
      throw new Error(
        `State definition "${stateDef.name}" is not in the states array`
      );
    }

    for (const transition of stateDef.transitions) {
      const eventsRecord = schema.events as Record<string, any>;
      if (!(String(transition.event) in eventsRecord)) {
        throw new Error(
          `Event "${String(transition.event)}" in state "${stateDef.name}" is not defined in events`
        );
      }
      if (!schema.states.includes(transition.targetState)) {
        throw new Error(
          `Target state "${transition.targetState}" in transition from "${stateDef.name}" is not in the states array`
        );
      }

      if (transition.guards) {
        for (const guard of transition.guards) {
          if (!schema.states.includes(guard.targetState)) {
            throw new Error(
              `Guard target state "${guard.targetState}" is not in the states array`
            );
          }
          // Validate guard references (if guard is a string, it must exist in state's guards)
          if (typeof guard.guard === 'string') {
            if (!stateDef.guards || !(guard.guard in stateDef.guards)) {
              throw new Error(
                `Guard "${guard.guard}" referenced in state "${stateDef.name}" for event "${String(transition.event)}" is not defined in the state's guards section`
              );
            }
          }
        }
      }
    }
  }

  // Create dynamic state classes
  const stateInstances: Record<string, TemplateState<any, Context, any>> = {};

  for (const stateDef of schema.stateDefinitions) {
    // Build event reactions from transitions
    const eventReactions: any = {};
    const allGuards: Record<string, GuardFunction<Context>> = {};
    const eventGuards: any = {};

    // First, collect state-level guard definitions
    if (stateDef.guards) {
      for (const [guardName, guardFunction] of Object.entries(stateDef.guards)) {
        allGuards[guardName] = guardFunction;
      }
    }

    // Then, collect guards from transitions and event reactions
    for (const transition of stateDef.transitions) {
      const eventName = transition.event;

      // Build event reaction
      eventReactions[eventName] = {
        action: transition.action || NO_OP,
        defaultTargetState: transition.targetState,
      };

      // Build guards for this event if they exist
      if (transition.guards && transition.guards.length > 0) {
        const guardMappings: any[] = [];
        transition.guards.forEach((guardDef, index) => {
          let guardKey: string;
          
          // Check if guard is a string (reference to state-level guard) or a function
          if (typeof guardDef.guard === 'string') {
            // Reference to a state-level guard
            guardKey = guardDef.guard;
            // Validate that the guard exists
            if (!allGuards[guardKey]) {
              throw new Error(
                `Guard "${guardKey}" referenced in state "${stateDef.name}" for event "${String(eventName)}" is not defined in the state's guards section`
              );
            }
          } else {
            // Inline guard function - create a unique key
            guardKey = `guard_${stateDef.name}_${String(eventName)}_${index}`;
            allGuards[guardKey] = guardDef.guard;
          }
          
          guardMappings.push({
            guard: guardKey,
            target: guardDef.targetState,
          });
        });
        eventGuards[eventName] = guardMappings;
      }
    }

    // Create state instance with all guards and reactions
    class DynamicState extends TemplateState<any, Context, any> {
      eventReactions = eventReactions;
      protected _guards = allGuards as any;
      protected _eventGuards = eventGuards as any;
    }

    const stateInstance = new DynamicState();
    
    // Add lifecycle hooks
    if (stateDef.onEnter) {
      const originalOnEnter = stateInstance.uponEnter.bind(stateInstance);
      stateInstance.uponEnter = (ctx, sm, from) => {
        originalOnEnter(ctx, sm, from);
        stateDef.onEnter!(ctx, from);
      };
    }
    if (stateDef.onExit) {
      const originalOnExit = stateInstance.beforeExit.bind(stateInstance);
      stateInstance.beforeExit = (ctx, sm, to) => {
        originalOnExit(ctx, sm, to);
        stateDef.onExit!(ctx, to);
      };
    }
    
    stateInstances[stateDef.name] = stateInstance;
  }

  // Ensure all states have instances (create empty states for states without definitions)
  for (const stateName of schema.states) {
    if (!stateInstances[stateName]) {
      class EmptyState extends TemplateState<any, Context, any> {
        eventReactions = {};
      }
      stateInstances[stateName] = new EmptyState();
    }
  }

  // Create and return the state machine
  return new TemplateStateMachine<EventPayloadMapping, Context, any, EventOutputMapping>(
    stateInstances as any,
    schema.initialState as any,
    context,
    true
  ) as StateMachine<EventPayloadMapping, Context, any, EventOutputMapping>;
}
