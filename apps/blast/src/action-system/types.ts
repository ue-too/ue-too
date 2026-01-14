/**
 * Minimal GameState interface for action system.
 * This is a simplified version that can be replaced with actual implementation later.
 */
export interface GameState {
  entities: Map<string, Entity>;
  activePlayer: string;
  phase: string;
  clone(): GameState;
  getEntity(id: string): Entity | null;
  query(selector: string): Entity[];
}

/**
 * Minimal Entity interface for action system.
 * This is a simplified version that can be replaced with actual implementation later.
 */
export interface Entity {
  id: string;
  get(componentName: string): any | null;
  has(componentName: string): boolean;
}

/**
 * Action type identifier using Symbol for type safety and uniqueness.
 * Use {@link createActionType} or {@link createGlobalActionType} to create action types.
 */
export type ActionType = symbol;

/**
 * Represents a specific instance of a player's intent to perform an action.
 */
export interface Action {
  /** Action type identifier (Symbol) */
  type: ActionType;
  /** EntityId of the actor performing the action */
  actorId: string;
  /** Ordered list of EntityIds being targeted */
  targetIds: string[];
  /** Additional action-specific data */
  parameters: Record<string, any>;
}

/**
 * Bundles all information needed during action validation and execution.
 */
export interface ActionContext {
  /** Current game state (immutable) */
  state: GameState;
  /** The action being executed */
  action: Action;
  /** Resolved actor entity */
  actor: Entity;
  /** Resolved target entities (in order) */
  targets: Entity[];
  /** Copy of action.parameters for convenience */
  parameters: Record<string, any>;
}

/**
 * Represents a single condition that must be true for an action to be valid.
 */
export interface Precondition {
  /**
   * Check if the precondition is satisfied
   * @param context - The action context
   * @returns true if condition is met, false otherwise
   */
  check(context: ActionContext): boolean;

  /**
   * Get human-readable error message when check fails
   * @param context - The action context
   * @returns descriptive error message
   */
  getErrorMessage(context: ActionContext): string;
}

/**
 * Represents a state modification that occurs when an action executes.
 */
export interface Effect {
  /**
   * Apply this effect to the game state
   * @param context - The action context
   * @returns new GameState with effect applied
   */
  apply(context: ActionContext): GameState;

  /**
   * Does this effect generate an event?
   * @returns true if createEvent() should be called
   */
  generatesEvent(): boolean;

  /**
   * Create the event this effect generates (if any)
   * @param context - The action context
   * @returns Event or null
   */
  createEvent(context: ActionContext): Event | null;
}

/**
 * Minimal Event interface for action system.
 */
export interface Event {
  type: string;
  data: Record<string, any>;
}

/**
 * Helper function to create an action type from a string.
 * This creates a unique symbol for the action type.
 * 
 * @param name - The string name for the action type
 * @returns A unique symbol for the action type
 * 
 * @example
 * ```typescript
 * const PlayCard = createActionType('PlayCard');
 * const definition = new ActionDefinitionImpl(PlayCard, 'PlayCard', ...);
 * ```
 * 
 * @category Utilities
 */
export function createActionType(name: string): ActionType {
  return Symbol(name);
}

/**
 * Helper function to create an action type using Symbol.for().
 * This creates a global symbol that can be looked up by string key,
 * which is useful for serialization and cross-module access.
 * 
 * @param key - The string key for the global symbol
 * @returns A global symbol for the action type
 * 
 * @example
 * ```typescript
 * const PlayCard = createGlobalActionType('PlayCard');
 * const definition = new ActionDefinitionImpl(PlayCard, 'PlayCard', ...);
 * // Can be retrieved later with Symbol.for('PlayCard')
 * ```
 * 
 * @category Utilities
 */
export function createGlobalActionType(key: string): ActionType {
  return Symbol.for(key);
}

/**
 * Helper function to get the string description from an action type symbol.
 * Useful for debugging and serialization.
 * 
 * @param actionType - The action type symbol
 * @returns The string description of the symbol
 * 
 * @category Utilities
 */
export function getActionTypeString(actionType: ActionType): string {
  return actionType.description || actionType.toString();
}

/**
 * Template that defines how an action type works.
 */
export interface ActionDefinition {
  /** Unique action type identifier (Symbol) */
  type: ActionType;
  /** Human-readable name for display/logging */
  name: string;
  /** Must all pass for action to be valid */
  preconditions: Precondition[];
  /** Applied before main effects (e.g., pay mana) */
  costs: Effect[];
  /** Main state modifications */
  effects: Effect[];

  /** Optional: Custom targeting logic */
  targetSelector?: (state: GameState, actor: Entity) => Entity[][];

  /** Optional: Custom parameter generation */
  parameterGenerator?: (state: GameState, actor: Entity) => Record<string, any>[];

  /** Optional: Display metadata */
  metadata?: {
    displayName?: string;
    description?: string;
    iconUrl?: string;
  };
}
