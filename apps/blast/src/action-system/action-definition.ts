import type { Action, ActionContext, ActionDefinition, Event, GameState, Precondition, Effect, ActionType } from './types';
import { getActionTypeString } from './types';

/**
 * Implementation of ActionDefinition with validation and execution logic.
 */
export class ActionDefinitionImpl implements ActionDefinition {
  constructor(
    public type: ActionType,
    public name: string,
    public preconditions: Precondition[],
    public costs: Effect[],
    public effects: Effect[],
    public targetSelector?: (state: GameState, actor: any) => any[][],
    public parameterGenerator?: (state: GameState, actor: any) => Record<string, any>[],
    public metadata?: {
      displayName?: string;
      description?: string;
      iconUrl?: string;
    }
  ) {}

  /**
   * Check if action can be executed
   * @param state - Current game state
   * @param action - Action to validate
   * @returns [canExecute, errorMessage]
   */
  canExecute(state: GameState, action: Action): [boolean, string | null] {
    // Validate actor exists
    const actor = state.getEntity(action.actorId);
    if (!actor) {
      return [false, `Actor entity ${action.actorId} does not exist`];
    }

    // Validate targets exist
    const targets: any[] = [];
    for (const targetId of action.targetIds) {
      const target = state.getEntity(targetId);
      if (!target) {
        return [false, `Target entity ${targetId} does not exist`];
      }
      targets.push(target);
    }

    // Create context
    const context: ActionContext = {
      state,
      action,
      actor,
      targets,
      parameters: action.parameters
    };

    // Check all preconditions (short-circuit on first failure)
    for (const precondition of this.preconditions) {
      if (!precondition.check(context)) {
        return [false, precondition.getErrorMessage(context)];
      }
    }

    return [true, null];
  }

  /**
   * Execute the action
   * @param state - Current game state
   * @param action - Action to execute
   * @returns new GameState after costs and effects applied
   */
  execute(state: GameState, action: Action): GameState {
    // Validate first
    const [canExecute, errorMessage] = this.canExecute(state, action);
    if (!canExecute) {
      throw new Error(`Cannot execute action: ${errorMessage}`);
    }

    // Resolve entities
    const actor = state.getEntity(action.actorId)!;
    const targets: any[] = action.targetIds.map(id => state.getEntity(id)!);

    // Create context
    let context: ActionContext = {
      state,
      action,
      actor,
      targets,
      parameters: action.parameters
    };

    // Apply costs sequentially
    let currentState = state;
    for (const cost of this.costs) {
      const costContext = { ...context, state: currentState };
      currentState = cost.apply(costContext);
      // Update context with new state
      context = { ...context, state: currentState };
    }

    // Apply effects sequentially
    for (const effect of this.effects) {
      const effectContext = { ...context, state: currentState };
      currentState = effect.apply(effectContext);
      // Update context with new state
      context = { ...context, state: currentState };
    }

    return currentState;
  }

  /**
   * Get all events this action generates
   * @param state - Current game state
   * @param action - Action to get events for
   * @returns array of Events to be queued
   */
  getGeneratedEvents(state: GameState, action: Action): Event[] {
    const events: Event[] = [];

    // Resolve entities
    const actor = state.getEntity(action.actorId);
    if (!actor) {
      return events;
    }

    const targets: any[] = action.targetIds
      .map(id => state.getEntity(id))
      .filter((t): t is any => t !== null);

    // Create context
    const context: ActionContext = {
      state,
      action,
      actor,
      targets,
      parameters: action.parameters
    };

    // Collect events from costs
    let currentState = state;
    for (const cost of this.costs) {
      if (cost.generatesEvent()) {
        const costContext = { ...context, state: currentState };
        const event = cost.createEvent(costContext);
        if (event) {
          events.push(event);
        }
      }
      // Apply cost to get state for next iteration
      currentState = cost.apply({ ...context, state: currentState });
    }

    // Collect events from effects
    for (const effect of this.effects) {
      if (effect.generatesEvent()) {
        const effectContext = { ...context, state: currentState };
        const event = effect.createEvent(effectContext);
        if (event) {
          events.push(event);
        }
      }
      // Apply effect to get state for next iteration
      currentState = effect.apply({ ...context, state: currentState });
    }

    // Always include ActionExecuted event
    events.push({
      type: 'ActionExecuted',
      data: {
        actionType: getActionTypeString(action.type),
        actorId: action.actorId,
        targetIds: action.targetIds,
        parameters: action.parameters
      }
    });

    return events;
  }
}
