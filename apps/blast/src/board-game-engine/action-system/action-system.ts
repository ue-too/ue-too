/**
 * ActionSystem - Central manager for all actions.
 *
 * Manages action registration, validation, and execution.
 */
import type { Entity } from '@ue-too/ecs';

import type { Action, Event, GameState } from '../core/types';
import { ActionValidationError } from '../core/types';
import type { PhaseManager } from '../phase-system/phase-manager';
import { ActionDefinition } from './action-definition';

/**
 * Central action system that manages all action definitions.
 *
 * @example
 * ```typescript
 * const actionSystem = new ActionSystem();
 *
 * // Register action
 * actionSystem.registerAction(drawCardAction);
 *
 * // Get valid actions for player
 * const actions = actionSystem.getValidActions(state, playerEntity);
 *
 * // Execute action
 * const [newState, events] = actionSystem.executeAction(state, selectedAction);
 * ```
 */
export class ActionSystem {
    private actionDefinitions: Map<string, ActionDefinition> = new Map();
    private phaseManager: PhaseManager | null = null;

    /**
     * Set the phase manager for phase-based action restrictions.
     *
     * @param phaseManager - Phase manager instance
     */
    setPhaseManager(phaseManager: PhaseManager): void {
        this.phaseManager = phaseManager;
    }

    /**
     * Register an action definition.
     *
     * @param definition - Action definition to register
     */
    registerAction(definition: ActionDefinition): void {
        this.actionDefinitions.set(definition.name, definition);
    }

    /**
     * Unregister an action definition.
     *
     * @param actionType - Action type name to unregister
     * @returns True if action was found and removed
     */
    unregisterAction(actionType: string): boolean {
        return this.actionDefinitions.delete(actionType);
    }

    /**
     * Get an action definition by name.
     *
     * @param actionType - Action type name
     * @returns Action definition or null if not found
     */
    getDefinition(actionType: string): ActionDefinition | null {
        return this.actionDefinitions.get(actionType) ?? null;
    }

    /**
     * Get all valid actions for a player.
     *
     * @param state - Current game state
     * @param playerId - Player entity to generate actions for
     * @returns Array of valid actions
     */
    getValidActions(state: GameState, playerId: Entity): Action[] {
        const validActions: Action[] = [];

        // For each registered action definition
        for (const definition of this.actionDefinitions.values()) {
            // Generate target combinations
            const targetCombinations = definition.targetSelector
                ? definition.targetSelector(state, playerId)
                : [[]];

            // Generate parameter combinations
            const parameterSets = definition.parameterGenerator
                ? definition.parameterGenerator(state, playerId)
                : [{}];

            // For each (targets, parameters) pair
            for (const targets of targetCombinations) {
                for (const parameters of parameterSets) {
                    // Create action
                    const action: Action = {
                        type: definition.name,
                        actorId: playerId,
                        targetIds: targets,
                        parameters,
                    };

                    // Check if valid (including preconditions)
                    const [isValid] = definition.canExecute(state, action);
                    if (!isValid) {
                        continue;
                    }

                    // Check phase restrictions if phase manager is available
                    if (
                        this.phaseManager &&
                        !this.phaseManager.canPerformAction(
                            state,
                            definition.name
                        )
                    ) {
                        continue;
                    }

                    validActions.push(action);
                }
            }
        }

        return validActions;
    }

    /**
     * Validate an action without executing it.
     *
     * @param state - Game state
     * @param action - Action to validate
     * @returns [isValid, errorMessage]
     */
    validateAction(state: GameState, action: Action): [boolean, string | null] {
        const definition = this.getDefinition(action.type);
        if (!definition) {
            return [false, `Unknown action type: ${action.type}`];
        }

        // Check preconditions
        const [isValid, errorMessage] = definition.canExecute(state, action);
        if (!isValid) {
            return [false, errorMessage];
        }

        // Check phase restrictions if phase manager is available
        if (
            this.phaseManager &&
            !this.phaseManager.canPerformAction(state, action.type)
        ) {
            const currentPhase = state.currentPhase;
            return [
                false,
                `Action '${action.type}' is not allowed in phase '${currentPhase}'`,
            ];
        }

        return [true, null];
    }

    /**
     * Execute an action.
     *
     * @param state - Game state (will be mutated)
     * @param action - Action to execute
     * @returns [finalState, generatedEvents]
     * @throws ActionValidationError if action is invalid
     */
    executeAction(state: GameState, action: Action): [GameState, Event[]] {
        // Get definition
        const definition = this.getDefinition(action.type);
        if (!definition) {
            throw new ActionValidationError(
                action,
                null,
                `Unknown action type: ${action.type}`
            );
        }

        // Validate
        const [isValid, errorMessage] = definition.canExecute(state, action);
        if (!isValid) {
            throw new ActionValidationError(
                action,
                null,
                errorMessage ?? 'Action validation failed'
            );
        }

        // Execute
        const newState = definition.execute(state, action);

        // Collect generated events
        const events = definition.getGeneratedEvents(newState, action);

        return [newState, events];
    }

    /**
     * Get all registered action types.
     *
     * @returns Array of action type names
     */
    getActionTypes(): string[] {
        return Array.from(this.actionDefinitions.keys());
    }

    /**
     * Get the number of registered actions.
     *
     * @returns Count of registered actions
     */
    getActionCount(): number {
        return this.actionDefinitions.size;
    }

    /**
     * Clear all registered actions.
     */
    clearAll(): void {
        this.actionDefinitions.clear();
    }
}
