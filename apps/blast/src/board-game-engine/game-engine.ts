/**
 * GameEngine - Main game engine class that ties all systems together.
 *
 * Provides the top-level API for managing game state, executing actions,
 * processing events, and handling game flow.
 */
import type { Entity } from '@ue-too/ecs';
import { createGlobalComponentName } from '@ue-too/ecs';

import { ActionSystem } from './action-system/action-system';
import {
    GAME_MANAGER_COMPONENT,
    GAME_STATUS_COMPONENT,
} from './core/game-state';
import type {
    GameManagerComponent,
    GameStatusComponent,
} from './core/game-state';
import type {
    Action,
    Event,
    GameState,
    ActionDefinition as IActionDefinition,
    PhaseDefinition,
    Rule,
} from './core/types';
import { EventProcessor } from './event-system/event-processor';
import { EventQueue } from './event-system/event-queue';
import { PhaseManager } from './phase-system/phase-manager';
import { RuleEngine } from './rule-engine/rule-engine';
import { ExpressionResolver } from './schema/expression-resolver';
import type { WinCondition } from './schema/factories/win-condition-factory';
import { WinConditionEvaluator } from './win-condition-system/win-condition-evaluator';

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

    /** Win conditions */
    winConditions?: WinCondition[];

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
    private readonly winConditions: WinCondition[];
    private readonly winConditionEvaluator: WinConditionEvaluator;
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

        // Register phases first (needed for action system)
        for (const phase of gameDefinition.phases) {
            this.phaseManager.registerPhase(phase);
        }

        // Connect phase manager to action system for phase-based restrictions
        this.actionSystem.setPhaseManager(this.phaseManager);

        // Register actions
        for (const action of gameDefinition.actions) {
            this.actionSystem.registerAction(action as any);
        }

        // Register rules
        for (const rule of gameDefinition.rules) {
            this.ruleEngine.addGlobalRule(rule);
        }

        // Store win conditions
        this.winConditions = gameDefinition.winConditions ?? [];

        // Create win condition evaluator
        const resolver = new ExpressionResolver();
        this.winConditionEvaluator = new WinConditionEvaluator(resolver);

        // Create initial state
        this.state = gameDefinition.createInitialState();

        // Initialize GameStatusComponent if not present
        this.ensureGameStatusComponent();
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
        return this.actionSystem.getValidActions(
            this.state,
            this.state.activePlayer
        );
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
            const [newState, events] = this.actionSystem.executeAction(
                this.state,
                action
            );

            // 2. Create event queue
            const queue = new EventQueue();
            queue.addMultiple(events);

            // 3. Process all events through rule engine
            this.eventProcessor.processAll(newState, queue);

            // 4. Auto-advance phase if needed (with safety limit to prevent infinite loops)
            const MAX_PHASE_ADVANCES = 10; // Safety limit
            let advanceCount = 0;
            const visitedPhases = new Set<string>();

            while (
                this.phaseManager.canAdvancePhase(this.state) &&
                advanceCount < MAX_PHASE_ADVANCES
            ) {
                const currentPhase = this.state.currentPhase;

                // Detect cycles: if we've visited this phase before in this advancement cycle, stop
                if (visitedPhases.has(currentPhase)) {
                    console.warn(
                        `Phase advancement cycle detected at phase: ${currentPhase}. Stopping to prevent infinite loop.`
                    );
                    break;
                }

                visitedPhases.add(currentPhase);
                this.advancePhase();
                advanceCount++;
            }

            if (advanceCount >= MAX_PHASE_ADVANCES) {
                console.warn(
                    `Phase advancement limit reached (${MAX_PHASE_ADVANCES}). Stopping to prevent infinite loop.`
                );
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

        // Process phase change events (but don't auto-advance phases again to avoid recursion)
        const queue = new EventQueue();
        const events = this.state.getEventQueue();
        if (events.length > 0) {
            queue.addMultiple(events);
            this.state.clearEventQueue();
            this.eventProcessor.processAll(this.state, queue);
            // Note: We don't check for phase advancement here to avoid infinite recursion.
            // Phase advancement is only checked once per action in performAction().
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
     * Uses lazy evaluation: checks GameStatusComponent first, then evaluates win conditions if needed.
     *
     * @returns True if game is over
     */
    isGameOver(): boolean {
        // Check GameStatusComponent first
        const gameStatus = this.getGameStatusComponent();
        if (gameStatus && gameStatus.isGameOver) {
            return true;
        }

        // If not set, evaluate win conditions
        if (this.winConditions.length > 0) {
            this.checkWinConditions();
            const updatedStatus = this.getGameStatusComponent();
            return updatedStatus?.isGameOver ?? false;
        }

        // Fallback to old behavior if no win conditions defined
        // Check if any player has health <= 0
        const players = this.state.getAllPlayers();
        const gameOver = players.some(player => {
            // Try common resource component names
            const resourceComponentNames = [
                createGlobalComponentName('Resource'),
                Symbol.for('Resource'),
            ];

            for (const componentName of resourceComponentNames) {
                try {
                    const resources =
                        this.state.coordinator.getComponentFromEntity<any>(
                            componentName,
                            player
                        );
                    if (
                        resources &&
                        typeof resources.health === 'number' &&
                        resources.health <= 0
                    ) {
                        return true;
                    }
                } catch {
                    // Component not found, try next
                }
            }
            return false;
        });

        // Update GameStatusComponent if game is over
        if (gameOver) {
            // Ensure component exists
            this.ensureGameStatusComponent();
            const gameStatus = this.getGameStatusComponent();
            if (gameStatus) {
                gameStatus.isGameOver = true;
                // Determine winner (player with health > 0)
                const winner =
                    players.find(player => {
                        const resourceComponentNames = [
                            createGlobalComponentName('Resource'),
                            Symbol.for('Resource'),
                        ];
                        for (const componentName of resourceComponentNames) {
                            try {
                                const resources =
                                    this.state.coordinator.getComponentFromEntity<any>(
                                        componentName,
                                        player
                                    );
                                if (
                                    resources &&
                                    typeof resources.health === 'number' &&
                                    resources.health > 0
                                ) {
                                    return true;
                                }
                            } catch {
                                // Component not found, try next
                            }
                        }
                        return false;
                    }) ?? null;
                gameStatus.winner = winner;
            }
        }

        return gameOver;
    }

    /**
     * Get the winner of the game.
     * Uses lazy evaluation: checks GameStatusComponent first, then evaluates win conditions if needed.
     *
     * @returns Winner entity or null if no winner yet
     */
    getWinner(): Entity | null {
        // Check GameStatusComponent first
        const gameStatus = this.getGameStatusComponent();
        if (gameStatus && gameStatus.isGameOver) {
            return gameStatus.winner;
        }

        // If not set, evaluate win conditions
        if (this.winConditions.length > 0) {
            this.checkWinConditions();
            const updatedStatus = this.getGameStatusComponent();
            return updatedStatus?.winner ?? null;
        }

        // Fallback to old behavior if no win conditions defined
        const players = this.state.getAllPlayers();
        for (const player of players) {
            const opponents = this.state.getOpponents(player);
            const allOpponentsDefeated = opponents.every(opp => {
                // Try common resource component names
                const resourceComponentNames = [
                    createGlobalComponentName('Resource'),
                    Symbol.for('Resource'),
                ];

                for (const componentName of resourceComponentNames) {
                    try {
                        const resources =
                            this.state.coordinator.getComponentFromEntity<any>(
                                componentName,
                                opp
                            );
                        if (resources && typeof resources.health === 'number') {
                            return resources.health <= 0;
                        }
                    } catch {
                        // Component not found, try next
                    }
                }
                return false;
            });
            if (allOpponentsDefeated) {
                // Update GameStatusComponent
                this.ensureGameStatusComponent();
                const gameStatus = this.getGameStatusComponent();
                if (gameStatus) {
                    gameStatus.isGameOver = true;
                    gameStatus.winner = player;
                }
                return player;
            }
        }
        return null;
    }

    /**
     * Check win conditions and update GameStatusComponent.
     * This is called lazily when isGameOver() or getWinner() is called.
     */
    private checkWinConditions(): void {
        if (this.winConditions.length === 0) {
            return;
        }

        // Create resolver context for evaluation
        const context = {
            state: this.state,
            actor: this.state.activePlayer,
            targets: [],
            parameters: {},
            candidate: undefined,
            eachPlayer: undefined,
        };

        // Evaluate win conditions
        const result = this.winConditionEvaluator.evaluateWinConditions(
            this.state,
            this.winConditions,
            context
        );

        // Update GameStatusComponent
        const gameStatus = this.getGameStatusComponent();
        if (gameStatus) {
            if (result) {
                gameStatus.isGameOver = true;
                gameStatus.winner = result.winner;
                gameStatus.endReason = result.endReason;
            } else {
                // Ensure it's marked as not over if no condition matches
                gameStatus.isGameOver = false;
                gameStatus.winner = null;
            }
        }
    }

    /**
     * Get the GameStatusComponent from the game manager entity.
     */
    private getGameStatusComponent(): GameStatusComponent | null {
        // Find game manager entity
        const allEntities = this.state.coordinator.getAllEntities();

        const gameManagerEntity = allEntities.find(entity => {
            return (
                this.state.coordinator.getComponentFromEntity<GameManagerComponent>(
                    GAME_MANAGER_COMPONENT,
                    entity
                ) !== null
            );
        });

        if (gameManagerEntity === undefined) {
            return null;
        }

        // Get GameStatusComponent
        return this.state.coordinator.getComponentFromEntity<GameStatusComponent>(
            GAME_STATUS_COMPONENT,
            gameManagerEntity
        );
    }

    /**
     * Ensure GameStatusComponent exists on the game manager entity.
     */
    private ensureGameStatusComponent(): void {
        const existing = this.getGameStatusComponent();
        if (existing) {
            return; // Already exists
        }

        // Find game manager entity
        const allEntities = this.state.coordinator.getAllEntities();

        const gameManagerEntity = allEntities.find(entity => {
            return (
                this.state.coordinator.getComponentFromEntity<GameManagerComponent>(
                    GAME_MANAGER_COMPONENT,
                    entity
                ) !== null
            );
        });

        if (gameManagerEntity === undefined) {
            return;
        }

        // Register component if needed
        try {
            this.state.coordinator.registerComponent<GameStatusComponent>(
                GAME_STATUS_COMPONENT
            );
        } catch (e) {
            // Component already registered, ignore
        }

        // Add component to game manager entity
        this.state.coordinator.addComponentToEntity<GameStatusComponent>(
            GAME_STATUS_COMPONENT,
            gameManagerEntity,
            {
                isGameOver: false,
                winner: null,
            }
        );
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
