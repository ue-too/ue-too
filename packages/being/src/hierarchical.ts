/**
 * Hierarchical State Machine POC
 *
 * @remarks
 * This module provides support for hierarchical (nested) state machines where
 * states can contain child state machines. This enables modeling complex
 * stateful behavior with parent-child relationships.
 *
 * ## Key Features
 *
 * - **Composite States**: States that contain their own internal state machine
 * - **Event Propagation**: Events bubble from child to parent if unhandled
 * - **Default Child States**: Automatic entry into default child state
 * - **History States**: Remember last active child state (optional)
 * - **State Path Tracking**: Full hierarchical path (e.g., "PARENT.CHILD")
 *
 * @category Hierarchical State Machines
 */

import {
  BaseContext,
  StateMachine,
  TemplateStateMachine,
  TemplateState,
  State,
  EventResult,
  DefaultOutputMapping,
  EventArgs,
} from "./interface";

/**
 * Represents a hierarchical state path using dot notation.
 * Example: "PARENT.CHILD" means we're in CHILD state within PARENT state.
 */
export type HierarchicalStatePath<ParentStates extends string, ChildStates extends string> =
  | ParentStates
  | `${ParentStates}.${ChildStates}`;

/**
 * Configuration for a composite state's child state machine.
 *
 * @typeParam EventPayloadMapping - Event payload mapping
 * @typeParam Context - Context type
 * @typeParam ChildStates - Child state names
 * @typeParam EventOutputMapping - Event output mapping
 */
export interface ChildStateMachineConfig<
  EventPayloadMapping = any,
  Context extends BaseContext = BaseContext,
  ChildStates extends string = string,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> {
  /** The child state machine instance */
  stateMachine: StateMachine<EventPayloadMapping, Context, ChildStates, EventOutputMapping>;
  /** Default child state to enter when parent state is entered */
  defaultChildState: ChildStates;
  /** Whether to remember the last active child state (history state) */
  rememberHistory?: boolean;
}

/**
 * Composite state that contains a child state machine.
 *
 * @remarks
 * A composite state is a state that contains its own internal state machine.
 * When the composite state is active, its child state machine is also active.
 * Events are first handled by the child state machine, and if unhandled,
 * they bubble up to the parent state machine.
 *
 * @typeParam EventPayloadMapping - Event payload mapping
 * @typeParam Context - Context type
 * @typeParam ParentStates - Parent state names
 * @typeParam ChildStates - Child state names
 * @typeParam EventOutputMapping - Event output mapping
 *
 * @example
 * ```typescript
 * type ParentStates = "IDLE" | "ACTIVE";
 * type ChildStates = "LOADING" | "READY" | "ERROR";
 *
 * class ActiveState extends CompositeState<Events, Context, ParentStates, ChildStates> {
 *   eventReactions = {
 *     stop: {
 *       action: () => console.log("Stopping..."),
 *       defaultTargetState: "IDLE"
 *     }
 *   };
 *
 *   getChildStateMachine() {
 *     return {
 *       stateMachine: new TemplateStateMachine(...),
 *       defaultChildState: "LOADING",
 *       rememberHistory: true
 *     };
 *   }
 * }
 * ```
 */
export abstract class CompositeState<
  EventPayloadMapping = any,
  Context extends BaseContext = BaseContext,
  ParentStates extends string = string,
  ChildStates extends string = string,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> extends TemplateState<EventPayloadMapping, Context, ParentStates, EventOutputMapping> {
  protected _childStateMachineConfig: ChildStateMachineConfig<EventPayloadMapping, Context, ChildStates, EventOutputMapping> | null = null;
  protected _historyState: ChildStates | null = null;
  protected _context: Context | null = null;

  /**
   * Returns the configuration for the child state machine.
   * Override this method to provide child state machine setup.
   */
  protected abstract getChildStateMachine(): ChildStateMachineConfig<EventPayloadMapping, Context, ChildStates, EventOutputMapping>;

  /**
   * Gets the current child state, or null if no child state machine is active.
   */
  getCurrentChildState(): ChildStates | null {
    if (!this._childStateMachineConfig) {
      return null;
    }
    // Access currentState through TemplateStateMachine's getter
    const stateMachine = this._childStateMachineConfig.stateMachine as TemplateStateMachine<EventPayloadMapping, Context, ChildStates, EventOutputMapping>;
    const current = stateMachine.currentState;
    return current === "INITIAL" || current === "TERMINAL" ? null : current as ChildStates;
  }

  /**
   * Gets the full hierarchical path of the current state.
   */
  getStatePath(parentState: ParentStates): HierarchicalStatePath<ParentStates, ChildStates> {
    const childState = this.getCurrentChildState();
    if (childState === null) {
      return parentState;
    }
    return `${parentState}.${childState}` as HierarchicalStatePath<ParentStates, ChildStates>;
  }

  override uponEnter(
    context: Context,
    stateMachine: StateMachine<EventPayloadMapping, Context, ParentStates, EventOutputMapping>,
    from: ParentStates | "INITIAL"
  ): void {
    super.uponEnter(context, stateMachine, from);

    // Set context for child state machine creation
    this._context = context;

    // Initialize child state machine
    const config = this.getChildStateMachine();
    this._childStateMachineConfig = config;

    // Determine which child state to enter
    const childStateToEnter = config.rememberHistory && this._historyState
      ? this._historyState
      : config.defaultChildState;

    // Start child state machine and transition to the appropriate child state
    const childMachine = config.stateMachine as TemplateStateMachine<EventPayloadMapping, Context, ChildStates, EventOutputMapping>;
    if (childMachine.currentState === "INITIAL") {
      childMachine.start();
    }
    childMachine.switchTo(childStateToEnter);
    const childState = childMachine.states[childStateToEnter];
    childState.uponEnter(context, childMachine, "INITIAL");
  }

  override beforeExit(
    context: Context,
    stateMachine: StateMachine<EventPayloadMapping, Context, ParentStates, EventOutputMapping>,
    to: ParentStates | "TERMINAL"
  ): void {
    // Save current child state if history is enabled
    if (this._childStateMachineConfig?.rememberHistory) {
      const currentChild = this.getCurrentChildState();
      if (currentChild !== null) {
        this._historyState = currentChild;
      }
    }

    // Exit child state machine
    if (this._childStateMachineConfig) {
      const currentChild = this.getCurrentChildState();
      if (currentChild !== null) {
        const childState = this._childStateMachineConfig.stateMachine.states[currentChild];
        childState.beforeExit(context, this._childStateMachineConfig.stateMachine, "TERMINAL");
      }
      this._childStateMachineConfig.stateMachine.wrapup();
    }

    super.beforeExit(context, stateMachine, to);
  }

  override handles<K extends keyof EventPayloadMapping | string>(
    args: EventArgs<EventPayloadMapping, K>,
    context: Context,
    stateMachine: StateMachine<EventPayloadMapping, Context, ParentStates, EventOutputMapping>
  ): EventResult<ParentStates, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void> {
    // First, try to handle in child state machine
    if (this._childStateMachineConfig) {
      // Use type assertion to call happens with the args
      const childMachine = this._childStateMachineConfig.stateMachine;
      const childResult = (childMachine.happens as any)(...args);
      if (childResult.handled) {
        // Event was handled by child - check if child state transition occurred
        // If child transitioned, we might need to propagate that information
        // For now, we'll return that it was handled but don't change parent state
        return {
          handled: true,
          // Don't transition parent state, child handled it
        } as EventResult<ParentStates, K extends keyof EventOutputMapping ? EventOutputMapping[K] : void>;
      }
    }

    // If child didn't handle it, try parent state
    return super.handles(args, context, stateMachine);
  }
}

/**
 * Extended state machine that supports hierarchical state paths.
 *
 * @remarks
 * This class extends TemplateStateMachine to track and expose hierarchical
 * state paths when composite states are used.
 *
 * @typeParam EventPayloadMapping - Event payload mapping
 * @typeParam Context - Context type
 * @typeParam States - State names
 * @typeParam EventOutputMapping - Event output mapping
 */
export class HierarchicalStateMachine<
  EventPayloadMapping = any,
  Context extends BaseContext = BaseContext,
  States extends string = string,
  EventOutputMapping extends Partial<Record<keyof EventPayloadMapping, unknown>> = DefaultOutputMapping<EventPayloadMapping>
> extends TemplateStateMachine<EventPayloadMapping, Context, States, EventOutputMapping> {
  /**
   * Gets the current hierarchical state path.
   * Returns a simple state name for non-composite states,
   * or a dot-notation path for composite states (e.g., "PARENT.CHILD").
   */
  getCurrentStatePath(): string {
    const currentState = this.currentState;
    if (currentState === "INITIAL" || currentState === "TERMINAL") {
      return currentState;
    }

    const state = this.states[currentState];
    if (state instanceof CompositeState) {
      return state.getStatePath(currentState);
    }

    return currentState;
  }

  /**
   * Gets all active states in the hierarchy.
   * Returns an array where the first element is the top-level state,
   * and subsequent elements are nested child states.
   */
  getActiveStatePath(): string[] {
    const currentState = this.currentState;
    if (currentState === "INITIAL" || currentState === "TERMINAL") {
      return [currentState];
    }

    const path: string[] = [currentState];
    const state = this.states[currentState];

    if (state instanceof CompositeState) {
      const childState = state.getCurrentChildState();
      if (childState !== null) {
        path.push(childState);
      }
    }

    return path;
  }

  /**
   * Checks if the state machine is currently in a specific hierarchical path.
   * Supports both simple state names and dot-notation paths.
   *
   * @param path - State path to check (e.g., "PARENT" or "PARENT.CHILD")
   */
  isInStatePath(path: string): boolean {
    const currentPath = this.getCurrentStatePath();
    return currentPath === path || currentPath.startsWith(path + ".");
  }
}
