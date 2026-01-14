/**
 * PhaseManager - Manages phase transitions and phase-related logic.
 *
 * Controls game flow through different phases and enforces phase restrictions.
 */

import type { Phase, PhaseDefinition, GameState } from '../core/types';
import { generateEventId } from '../event-system/event-utils';

/**
 * Helper to generate event IDs.
 */
function generateEventIdLocal(): string {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Phase manager implementation that handles phase transitions.
 *
 * @example
 * ```typescript
 * const phaseManager = new PhaseManager();
 *
 * // Register phases
 * phaseManager.registerPhase(upkeepPhase);
 * phaseManager.registerPhase(mainPhase);
 *
 * // Advance phase
 * phaseManager.advancePhase(state);
 * ```
 */
export class PhaseManager {
  private phaseDefinitions: Map<string, PhaseDefinition> = new Map();

  /**
   * Register a phase definition.
   *
   * @param definition - Phase definition to register
   */
  registerPhase(definition: PhaseDefinition): void {
    this.phaseDefinitions.set(definition.name, definition);
  }

  /**
   * Get a phase definition by name.
   *
   * @param phaseName - Phase name
   * @returns Phase definition or null if not found
   */
  getPhaseDefinition(phaseName: string): PhaseDefinition | null {
    return this.phaseDefinitions.get(phaseName) ?? null;
  }

  /**
   * Get the current phase from game state.
   *
   * @param state - Game state
   * @returns Current phase object
   */
  getCurrentPhase(state: GameState): Phase {
    const definition = this.phaseDefinitions.get(state.currentPhase);
    if (!definition) {
      throw new Error(`Phase definition not found for phase: ${state.currentPhase}`);
    }

    return {
      name: state.currentPhase,
      activePlayer: state.activePlayer,
      allowedActionTypes: new Set(definition.allowedActionTypes),
      autoAdvance: definition.autoAdvance ?? false,
      autoAdvanceCondition: definition.autoAdvanceCondition,
    };
  }

  /**
   * Check if an action type is allowed in the current phase.
   *
   * @param state - Game state
   * @param actionType - Action type to check
   * @returns True if action is allowed
   */
  canPerformAction(state: GameState, actionType: string): boolean {
    const phase = this.getCurrentPhase(state);
    return phase.allowedActionTypes.has(actionType);
  }

  /**
   * Check if the current phase can advance.
   *
   * @param state - Game state
   * @returns True if phase can advance
   */
  canAdvancePhase(state: GameState): boolean {
    const phase = this.getCurrentPhase(state);

    if (!phase.autoAdvance) {
      return false; // Manual advancement only
    }

    if (phase.autoAdvanceCondition) {
      return phase.autoAdvanceCondition(state);
    }

    return true; // Auto-advance with no condition
  }

  /**
   * Advance to the next phase.
   *
   * @param state - Game state (will be mutated)
   * @returns The new game state
   */
  advancePhase(state: GameState): GameState {
    const currentPhaseName = state.currentPhase;
    const currentDef = this.phaseDefinitions.get(currentPhaseName);

    if (!currentDef) {
      throw new Error(`Current phase definition not found: ${currentPhaseName}`);
    }

    // Execute onExit for current phase
    if (currentDef.onExit) {
      currentDef.onExit(state);
    }

    // Determine next phase
    const nextPhaseName = this.getNextPhase(state, currentDef);
    const nextDef = this.phaseDefinitions.get(nextPhaseName);

    if (!nextDef) {
      throw new Error(`Next phase definition not found: ${nextPhaseName}`);
    }

    // Update state
    state.setCurrentPhase(nextPhaseName);

    // Execute onEnter for new phase
    if (nextDef.onEnter) {
      nextDef.onEnter(state);
    }

    // Emit PhaseChanged event
    state.addEvent({
      type: 'PhaseChanged',
      data: {
        fromPhase: currentPhaseName,
        toPhase: nextPhaseName,
        activePlayer: state.activePlayer,
      },
      timestamp: Date.now(),
      id: generateEventIdLocal(),
    });

    return state;
  }

  /**
   * Get the next phase name.
   *
   * @param state - Game state
   * @param currentDef - Current phase definition
   * @returns Next phase name
   */
  private getNextPhase(state: GameState, currentDef: PhaseDefinition): string {
    if (!currentDef.nextPhase) {
      throw new Error(`No next phase defined for phase: ${currentDef.name}`);
    }

    if (typeof currentDef.nextPhase === 'function') {
      return currentDef.nextPhase(state);
    }

    return currentDef.nextPhase;
  }

  /**
   * Get all registered phase names.
   *
   * @returns Array of phase names
   */
  getPhaseNames(): string[] {
    return Array.from(this.phaseDefinitions.keys());
  }

  /**
   * Clear all registered phases.
   */
  clearAll(): void {
    this.phaseDefinitions.clear();
  }
}
