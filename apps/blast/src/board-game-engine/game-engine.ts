/**
 * GameEngine - Main game engine class that ties all systems together.
 *
 * Provides the top-level API for managing game state, executing actions,
 * processing events, and handling game flow.
 */

import type { Entity } from '@ue-too/ecs';
import type { Action, GameState, Event, ActionDefinition as IActionDefinition, PhaseDefinition, Rule } from './core/types';
import { ActionSystem } from './action-system/action-system';
import { RuleEngine } from './rule-engine/rule-engine';
import { EventProcessor } from './event-system/event-processor';
import { EventQueue } from './event-system/event-queue';
import { PhaseManager } from './phase-system/phase-manager';

/**
 * Game definition configuration.
 */
export interface GameDefinition {
  /** Game name */
  name: string;

  /** Action definitions */
  actions: IActionDefinition[];

  /** Global rules */
  rules: Rule[];

  /** Phase definitions */
  phases: PhaseDefinition[];

  /** Function to create initial game state */
  createInitialState: () => GameState;
}

/**
 * Main game engine that integrates all systems.
 *
 * @example
 * ```typescript
 * const engine = new GameEngine(gameDefinition);
 *
 * // Get valid actions
 * const actions = engine.getValidActions(playerEntity);
 *
 * // Perform action
 * engine.performAction(selectedAction);
 *
 * // Check game state
 * if (engine.isGameOver()) {
 *   console.log('Winner:', engine.getWinner());
 * }
 * ```
 */
export class GameEngine {
  public readonly state: GameState;
  private readonly actionSystem: ActionSystem;
  private readonly ruleEngine: RuleEngine;
  private readonly eventProcessor: EventProcessor;
  private readonly phaseManager: PhaseManager;
  public readonly gameName: string;

  /**
   * Create a new game engine.
   *
   * @param gameDefinition - Game definition
   */
  constructor(gameDefinition: GameDefinition) {
    this.gameName = gameDefinition.name;

    // Initialize systems
    this.actionSystem = new ActionSystem();
    this.ruleEngine = new RuleEngine();
    this.eventProcessor = new EventProcessor(this.ruleEngine);
    this.phaseManager = new PhaseManager();

    // Register actions
    for (const action of gameDefinition.actions) {
      this.actionSystem.registerAction(action as any);
    }

    // Register rules
    for (const rule of gameDefinition.rules) {
      this.ruleEngine.addGlobalRule(rule);
    }

    // Register phases
    for (const phase of gameDefinition.phases) {
      this.phaseManager.registerPhase(phase);
    }

    // Create initial state
    this.state = gameDefinition.createInitialState();
  }

  /**
   * Get all valid actions for the current player.
   *
   * @returns Array of valid actions
   */
  getValidActions(): Action[] {
    if (!this.state.activePlayer) {
      return [];
    }
    return this.actionSystem.getValidActions(this.state, this.state.activePlayer);
  }

  /**
   * Get valid actions for a specific player.
   *
   * @param playerId - Player entity
   * @returns Array of valid actions
   */
  getValidActionsForPlayer(playerId: Entity): Action[] {
    return this.actionSystem.getValidActions(this.state, playerId);
  }

  /**
   * Perform an action.
   *
   * @param action - Action to perform
   */
  performAction(action: Action): void {
    try {
      // 1. Execute action
      const [newState, events] = this.actionSystem.executeAction(this.state, action);

      // 2. Create event queue
      const queue = new EventQueue();
      queue.addMultiple(events);

      // 3. Process all events through rule engine
      this.eventProcessor.processAll(newState, queue);

      // 4. Auto-advance phase if needed
      while (this.phaseManager.canAdvancePhase(this.state)) {
        this.advancePhase();
      }
    } catch (error) {
      console.error('Action execution failed:', error);
      throw error;
    }
  }

  /**
   * Advance to the next phase.
   */
  advancePhase(): void {
    this.phaseManager.advancePhase(this.state);

    // Process phase change events
    const queue = new EventQueue();
    const events = this.state.getEventQueue();
    if (events.length > 0) {
      queue.addMultiple(events);
      this.state.clearEventQueue();
      this.eventProcessor.processAll(this.state, queue);
    }
  }

  /**
   * Get the current phase name.
   *
   * @returns Current phase name
   */
  getCurrentPhase(): string {
    return this.state.currentPhase;
  }

  /**
   * Get the current player.
   *
   * @returns Current player entity or null
   */
  getCurrentPlayer(): Entity | null {
    return this.state.activePlayer;
  }

  /**
   * Get the current turn number.
   *
   * @returns Turn number
   */
  getTurnNumber(): number {
    return this.state.turnNumber;
  }

  /**
   * Check if the game is over.
   *
   * @returns True if game is over
   */
  isGameOver(): boolean {
    // This is a placeholder - actual implementation depends on game-specific logic
    // For the simple card game, we'll check if any player has 0 health
    const players = this.state.getAllPlayers();
    return players.some((player) => {
      const resources = this.state.coordinator.getComponentFromEntity<any>(
        Symbol.for('Resource'),
        player
      );
      return resources && resources.health <= 0;
    });
  }

  /**
   * Get the winner of the game.
   *
   * @returns Winner entity or null if no winner yet
   */
  getWinner(): Entity | null {
    const players = this.state.getAllPlayers();
    for (const player of players) {
      const opponents = this.state.getOpponents(player);
      const allOpponentsDefeated = opponents.every((opp) => {
        const resources = this.state.coordinator.getComponentFromEntity<any>(
          Symbol.for('Resource'),
          opp
        );
        return resources && resources.health <= 0;
      });
      if (allOpponentsDefeated) {
        return player;
      }
    }
    return null;
  }

  /**
   * Get a snapshot of the current game state for a player.
   * Hides hidden information (e.g., opponent's hand).
   *
   * @param playerId - Player entity
   * @returns Game state from player's perspective
   */
  getStateForPlayer(playerId: Entity): GameState {
    // For MVP, return full state
    // In future, implement visibility filtering
    return this.state;
  }

  /**
   * Create a snapshot of the current game state.
   *
   * @returns Game state snapshot
   */
  createSnapshot() {
    return this.state.createSnapshot();
  }

  /**
   * Restore a snapshot.
   *
   * @param snapshot - Snapshot to restore
   */
  restoreSnapshot(snapshot: any) {
    this.state.restoreSnapshot(snapshot);
  }

  /**
   * Serialize the game state to JSON.
   *
   * @returns JSON string
   */
  serialize(): string {
    return JSON.stringify({
      gameName: this.gameName,
      state: this.state.coordinator.serialize(),
      phase: this.state.currentPhase,
      turn: this.state.turnNumber,
      activePlayer: this.state.activePlayer,
    });
  }

  /**
   * Get the action system.
   *
   * @returns Action system
   */
  getActionSystem(): ActionSystem {
    return this.actionSystem;
  }

  /**
   * Get the rule engine.
   *
   * @returns Rule engine
   */
  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }

  /**
   * Get the phase manager.
   *
   * @returns Phase manager
   */
  getPhaseManager(): PhaseManager {
    return this.phaseManager;
  }
}
