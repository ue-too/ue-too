/**
 * Core type definitions for the Board Game Rule Engine.
 *
 * This module defines all fundamental interfaces and types used throughout the engine.
 * The engine integrates with @ue-too/ecs, using Entity as the primary game object identifier.
 */

import type { Entity, ComponentName, Coordinator } from '@ue-too/ecs';

// Re-export ECS types for convenience
export type { Entity, ComponentName, Coordinator };

// ============================================================================
// Action System Types
// ============================================================================

/**
 * Represents a specific instance of a player's intent to perform an action.
 *
 * @example
 * ```typescript
 * const action: Action = {
 *   type: 'PlayCard',
 *   actorId: playerEntity,
 *   targetIds: [enemyEntity],
 *   parameters: { cardSlot: 0 }
 * };
 * ```
 */
export interface Action {
  /** Action type identifier (must match a registered ActionDefinition name) */
  type: string;

  /** Entity performing the action */
  actorId: Entity;

  /** Ordered list of target entities */
  targetIds: Entity[];

  /** Additional action-specific data */
  parameters: Record<string, any>;
}

/**
 * Bundles all information needed during action validation and execution.
 * Provides convenient access to resolved entities and helper methods for ECS operations.
 */
export interface ActionContext {
  /** Current game state */
  state: GameState;

  /** The action being executed */
  action: Action;

  /** Resolved actor entity */
  actor: Entity;

  /** Resolved target entities (in order) */
  targets: Entity[];

  /** Copy of action.parameters for convenience */
  parameters: Record<string, any>;

  /** Get component from entity */
  getComponent<T>(name: ComponentName, entity: Entity): T | null;

  /** Set component on entity */
  setComponent<T>(name: ComponentName, entity: Entity, data: T): void;
}

/**
 * Represents a single condition that must be true for an action to be valid.
 */
export interface Precondition {
  /** Check if the precondition is satisfied */
  check(context: ActionContext): boolean;

  /** Get error message when precondition fails */
  getErrorMessage(context: ActionContext): string;
}

/**
 * Represents a state modification that occurs when an action executes.
 * Effects must be deterministic and should generate events for the rule engine.
 */
export interface Effect {
  /** Apply the effect to the game state (mutates ECS state) */
  apply(context: ActionContext): void;

  /** Whether this effect generates an event */
  generatesEvent(): boolean;

  /** Create event if this effect generates one */
  createEvent(context: ActionContext): Event | null;
}

/**
 * Function type for generating valid target combinations for an action.
 * Returns an array of target arrays, where each inner array represents one valid target combination.
 *
 * @example
 * ```typescript
 * // Single target (card in hand)
 * const selector: TargetSelector = (state, actor) => {
 *   const hand = state.getEntitiesInZone('hand', actor);
 *   return hand.map(card => [card]); // [[card1], [card2], ...]
 * };
 *
 * // Two targets (attacker + defender)
 * const selector: TargetSelector = (state, actor) => {
 *   const myCreatures = state.getEntitiesInZone('board', actor);
 *   const enemies = state.getEnemyEntitiesInZone('board', actor);
 *   const combinations: Entity[][] = [];
 *   for (const attacker of myCreatures) {
 *     for (const defender of enemies) {
 *       combinations.push([attacker, defender]);
 *     }
 *   }
 *   return combinations;
 * };
 * ```
 */
export type TargetSelector = (state: GameState, actor: Entity) => Entity[][];

/**
 * Function type for generating valid parameter sets for an action.
 * Returns an array of parameter objects, where each object represents one valid parameter combination.
 *
 * @example
 * ```typescript
 * const generator: ParameterGenerator = (state, actor) => {
 *   return [
 *     { bidAmount: 1 },
 *     { bidAmount: 2 },
 *     { bidAmount: 3 }
 *   ];
 * };
 * ```
 */
export type ParameterGenerator = (state: GameState, actor: Entity) => Record<string, any>[];

/**
 * Template that defines how an action type works.
 * Combines preconditions, costs, effects, and target/parameter generation.
 */
export interface ActionDefinition {
  /** Unique action type identifier */
  name: string;

  /** All must pass for action to be valid */
  preconditions: Precondition[];

  /** Effects applied before main effects (e.g., pay mana) */
  costs: Effect[];

  /** Main state modifications */
  effects: Effect[];

  /** Optional function to generate valid target combinations */
  targetSelector?: TargetSelector;

  /** Optional function to generate valid parameter sets */
  parameterGenerator?: ParameterGenerator;

  /** Optional metadata for UI display */
  metadata?: {
    displayName?: string;
    description?: string;
    iconUrl?: string;
  };
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * Immutable record of something that happened in the game.
 * Events are the communication layer between actions and rules.
 *
 * @example
 * ```typescript
 * const event: Event = {
 *   type: 'CardPlayed',
 *   data: { cardId: entity, playerId: playerEntity, cardType: 'Spell' },
 *   timestamp: Date.now(),
 *   id: crypto.randomUUID()
 * };
 * ```
 */
export interface Event {
  /** Event type (e.g., "CardPlayed", "EntityDestroyed") */
  type: string;

  /** Event-specific payload */
  data: Record<string, any>;

  /** When the event occurred (monotonically increasing) */
  timestamp: number;

  /** Unique identifier for this event instance */
  id: string;
}

/**
 * Pattern for matching events (used by rules to "listen" for specific events).
 *
 * @example
 * ```typescript
 * // Match any CardPlayed event
 * const pattern: EventPattern = { eventType: 'CardPlayed', filters: {} };
 *
 * // Match CardPlayed events for specific player
 * const pattern: EventPattern = {
 *   eventType: 'CardPlayed',
 *   filters: { playerId: playerEntity }
 * };
 *
 * // Match CardPlayed events with predicate
 * const pattern: EventPattern = {
 *   eventType: 'CardPlayed',
 *   filters: {
 *     cardType: (type) => type === 'Spell'
 *   }
 * };
 * ```
 */
export interface EventPattern {
  /** Event type to match (use "*" for wildcard) */
  eventType: string;

  /** Additional constraints (value or predicate function) */
  filters: Record<string, any | ((value: any) => boolean)>;
}

// ============================================================================
// Rule Engine Types
// ============================================================================

/**
 * Represents a game rule that responds to events.
 * Rules are the core game logic that triggers based on event patterns.
 *
 * @example
 * ```typescript
 * const rule: Rule = {
 *   id: 'draw-on-spell',
 *   trigger: { eventType: 'CardPlayed', filters: { cardType: 'Spell' } },
 *   conditions: [],
 *   effects: [new DrawCardEffect()],
 *   priority: 100,
 *   source: null // Global rule
 * };
 * ```
 */
export interface Rule {
  /** Unique identifier */
  id: string;

  /** Event pattern that activates this rule */
  trigger: EventPattern;

  /** Additional checks that must pass (beyond event matching) */
  conditions: Condition[];

  /** State modifications to apply (reuses Effect from Action System) */
  effects: Effect[];

  /** Resolution order (higher = first) */
  priority: number;

  /** Optional entity ID if rule is attached to specific entity */
  source?: Entity | null;
}

/**
 * A check that must pass before rule effects execute.
 * Similar to Precondition but operates in the context of a rule.
 */
export interface Condition {
  /** Evaluate if the condition is satisfied */
  evaluate(state: GameState, context: RuleContext): boolean;
}

/**
 * Bundles information needed during rule evaluation.
 */
export interface RuleContext {
  /** Current game state */
  state: GameState;

  /** The event that triggered this rule */
  event: Event;

  /** The rule being evaluated */
  rule: Rule;

  /** Entities from event pattern matching */
  matchedEntities: Entity[];
}

// ============================================================================
// Phase System Types
// ============================================================================

/**
 * Represents the current state of game flow.
 *
 * @example
 * ```typescript
 * const phase: Phase = {
 *   name: 'Main',
 *   activePlayer: playerEntity,
 *   allowedActionTypes: new Set(['PlayCard', 'ActivateAbility']),
 *   autoAdvance: false
 * };
 * ```
 */
export interface Phase {
  /** Phase identifier */
  name: string;

  /** Who can act (null for simultaneous phases) */
  activePlayer?: Entity | null;

  /** What actions are legal in this phase */
  allowedActionTypes: Set<string>;

  /** Should phase auto-advance? */
  autoAdvance: boolean;

  /** Optional function to check if ready to advance */
  autoAdvanceCondition?: (state: GameState) => boolean;

  /** For nested phases */
  subPhase?: Phase;

  /** Phase-specific data */
  metadata?: Record<string, any>;
}

/**
 * Template defining phase behavior.
 */
export interface PhaseDefinition {
  /** Unique phase identifier */
  name: string;

  /** Action types allowed in this phase */
  allowedActionTypes: string[];

  /** Called when entering phase */
  onEnter?: (state: GameState) => void;

  /** Called when leaving phase */
  onExit?: (state: GameState) => void;

  /** Whether phase automatically advances */
  autoAdvance?: boolean;

  /** Optional function to check if ready to advance */
  autoAdvanceCondition?: (state: GameState) => boolean;

  /** Next phase name or function to determine it */
  nextPhase?: string | ((state: GameState) => string);

  /** Sub-phases for complex phases */
  subPhases?: PhaseDefinition[];
}

// ============================================================================
// Game State Types
// ============================================================================

/**
 * Game metadata stored in GameManagerComponent on a global entity.
 */
export interface GameMetadata {
  /** Current phase name */
  currentPhase: string;

  /** Turn counter */
  turnNumber: number;

  /** Currently active player entity */
  activePlayer: Entity | null;

  /** Event queue for processing */
  eventQueue: Event[];
}

/**
 * Main game state interface.
 * Wraps the ECS Coordinator and provides game-specific methods.
 */
export interface GameState {
  /** The ECS coordinator managing all entities and components */
  readonly coordinator: Coordinator;

  // Metadata accessors
  readonly currentPhase: string;
  readonly turnNumber: number;
  readonly activePlayer: Entity | null;

  // Metadata setters
  setCurrentPhase(phase: string): void;
  setTurnNumber(turn: number): void;
  setActivePlayer(player: Entity | null): void;

  // Event queue methods
  getEventQueue(): Event[];
  addEvent(event: Event): void;
  clearEventQueue(): void;

  // Snapshot methods for immutability
  createSnapshot(): GameStateSnapshot;
  restoreSnapshot(snapshot: GameStateSnapshot): void;

  // Helper methods
  getEntitiesInZone(zoneName: string, owner?: Entity): Entity[];
  getAllPlayers(): Entity[];
  getOpponents(playerId: Entity): Entity[];
}

/**
 * Snapshot of game state for immutability and undo/redo.
 * Captures entity-component state at a specific point in time.
 */
export interface GameStateSnapshot {
  /** Metadata at time of snapshot (readonly) */
  readonly metadata: GameMetadata;

  /** Timestamp of snapshot (readonly) */
  readonly timestamp: number;

  /** Restore this snapshot to the coordinator */
  restore(coordinator: Coordinator): void;

  /** Get a deep copy of the metadata from this snapshot */
  getMetadata(): GameMetadata;

  /** Get the timestamp of when this snapshot was created */
  getTimestamp(): number;

  /** Create a JSON representation of this snapshot for persistence */
  toJSON(): { ecsState: any; metadata: GameMetadata; timestamp: number };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error class for game engine errors.
 */
export class GameEngineError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = 'GameEngineError';
  }
}

/**
 * Error thrown when action validation fails.
 */
export class ActionValidationError extends GameEngineError {
  constructor(
    public action: Action,
    public failedPrecondition: Precondition | null,
    message: string
  ) {
    super(message, { action });
    this.name = 'ActionValidationError';
  }
}

/**
 * Error thrown when action execution fails.
 */
export class ActionExecutionError extends GameEngineError {
  constructor(
    public action: Action,
    public failedAt: 'precondition' | 'cost' | 'effect',
    cause: Error
  ) {
    super(`Action execution failed at ${failedAt}: ${cause.message}`, {
      action,
      cause,
    });
    this.name = 'ActionExecutionError';
  }
}

/**
 * Error thrown when rule execution fails.
 */
export class RuleExecutionError extends GameEngineError {
  constructor(public rule: Rule, public event: Event, cause: Error) {
    super(`Rule execution failed: ${cause.message}`, { rule, event, cause });
    this.name = 'RuleExecutionError';
  }
}

/**
 * Error thrown when infinite loop detected in event processing.
 */
export class InfiniteLoopError extends GameEngineError {
  constructor(
    public eventSignature: string,
    public iterationCount: number
  ) {
    super(`Infinite loop detected: ${eventSignature}`, {
      eventSignature,
      iterationCount,
    });
    this.name = 'InfiniteLoopError';
  }
}

/**
 * Error thrown when game state is invalid.
 */
export class InvalidStateError extends GameEngineError {
  constructor(message: string, public state: GameState) {
    super(message, { state });
    this.name = 'InvalidStateError';
  }
}
