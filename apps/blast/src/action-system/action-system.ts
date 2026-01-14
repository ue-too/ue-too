import type { Action, ActionDefinition, Event, GameState, ActionType } from './types';
import { ActionDefinitionImpl } from './action-definition';
import { getActionTypeString } from './types';

/**
 * Central manager for all actions. Handles registration, validation, and execution.
 */
export class ActionSystem {
  private actionDefinitions: Map<ActionType, ActionDefinition> = new Map();

  /**
   * Register a new action type
   * @param definition - Action definition to register
   * @throws if type already exists
   */
  registerAction(definition: ActionDefinition): void {
    if (this.actionDefinitions.has(definition.type)) {
      throw new Error(`Action type "${getActionTypeString(definition.type)}" is already registered`);
    }
    this.actionDefinitions.set(definition.type, definition);
  }

  /**
   * Unregister an action type
   * @param actionType - Action type to unregister
   */
  unregisterAction(actionType: ActionType): void {
    this.actionDefinitions.delete(actionType);
  }

  /**
   * Get definition for an action type
   * @param actionType - Action type identifier
   * @returns ActionDefinition or null if not found
   */
  getDefinition(actionType: ActionType): ActionDefinition | null {
    return this.actionDefinitions.get(actionType) ?? null;
  }

  /**
   * Get all valid actions for a player
   * @param state - Current game state
   * @param playerId - Player entity ID
   * @returns Array of valid actions
   */
  getValidActions(state: GameState, playerId: string): Action[] {
    const validActions: Action[] = [];
    const player = state.getEntity(playerId);

    if (!player) {
      return validActions;
    }

    // Iterate through all registered action definitions
    for (const definition of this.actionDefinitions.values()) {
      // Generate target combinations
      const targetCombinations = definition.targetSelector
        ? definition.targetSelector(state, player)
        : [[]]; // No targets

      // Generate parameter combinations
      const parameterCombinations = definition.parameterGenerator
        ? definition.parameterGenerator(state, player)
        : [{}]; // No parameters

      // For each (targets, parameters) pair, create and validate action
      for (const targets of targetCombinations) {
        for (const parameters of parameterCombinations) {
          const action: Action = {
            type: definition.type,
            actorId: playerId,
            targetIds: targets.map((t: any) => t.id),
            parameters
          };

          // Check if action is valid
          const [isValid] = this.validateAction(state, action);
          if (isValid) {
            validActions.push(action);
          }
        }
      }
    }

    return validActions;
  }

  /**
   * Execute an action
   * @param state - Current game state
   * @param action - Action to execute
   * @returns [newState, generatedEvents]
   * @throws if action is invalid
   */
  executeAction(state: GameState, action: Action): [GameState, Event[]] {
    const definition = this.actionDefinitions.get(action.type);
    if (!definition) {
      throw new Error(`Unknown action type: ${getActionTypeString(action.type)}`);
    }

    // Validate action
    const [isValid, errorMessage] = this.validateAction(state, action);
    if (!isValid) {
      throw new Error(`Invalid action: ${errorMessage}`);
    }

    // Execute action
    const newState = definition instanceof ActionDefinitionImpl
      ? definition.execute(state, action)
      : (definition as any).execute(state, action);

    // Get generated events
    const events = definition instanceof ActionDefinitionImpl
      ? definition.getGeneratedEvents(state, action)
      : (definition as any).getGeneratedEvents(state, action);

    return [newState, events];
  }

  /**
   * Check if an action is valid without executing
   * @param state - Current game state
   * @param action - Action to validate
   * @returns [isValid, errorMessage]
   */
  validateAction(state: GameState, action: Action): [boolean, string | null] {
    const definition = this.actionDefinitions.get(action.type);
    if (!definition) {
      return [false, `Unknown action type: ${getActionTypeString(action.type)}`];
    }

    if (definition instanceof ActionDefinitionImpl) {
      return definition.canExecute(state, action);
    }

    // Fallback for custom implementations
    try {
      const [isValid, errorMessage] = (definition as any).canExecute(state, action);
      return [isValid, errorMessage];
    } catch (error) {
      return [false, `Validation error: ${error instanceof Error ? error.message : String(error)}`];
    }
  }
}
