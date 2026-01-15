/**
 * JSON Schema Types for Declarative Game Definition
 *
 * These types define the structure of JSON game definitions that can be loaded
 * by the GameDefinitionLoader to create playable games without writing code.
 */

import type { Entity } from '@ue-too/ecs';

// ============================================================================
// Expression Types (String-based DSL)
// ============================================================================

/**
 * Entity resolver expression.
 * Examples: "$actor", "$target", "$target.0", "$param.cardId", "$zone.actor.hand"
 */
export type EntityExpression = string;

/**
 * Zone resolver expression.
 * Examples: "$zone.actor.hand", "$zone.opponent.board", "$zone.$param.owner.deck"
 */
export type ZoneExpression = string;

/**
 * Number resolver expression or literal number.
 * Examples: 5, "$param.damage", "$component.$target.Card.cost", "$negate($param.cost)"
 */
export type NumberExpression = number | string;

/**
 * Value resolver expression or literal value.
 * Examples: true, "Creature", "$param.cardType", "$component.$target.Card.cardType"
 */
export type ValueExpression<T = unknown> = T | string;

// ============================================================================
// Component Definitions
// ============================================================================

/**
 * Property type for component definitions.
 */
export type PropertyType = 'string' | 'number' | 'boolean' | 'entity' | 'entityArray' | 'object';

/**
 * Definition of a component property.
 */
export interface PropertyDefinition {
  type: PropertyType;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: unknown[];
  description?: string;
}

/**
 * Definition of a component type.
 */
export interface ComponentDefinition {
  description?: string;
  properties: Record<string, PropertyDefinition>;
}

// ============================================================================
// Zone Definitions
// ============================================================================

/**
 * Visibility of a zone.
 */
export type ZoneVisibility = 'public' | 'private' | 'owner-only';

/**
 * Definition of a zone type.
 *
 * @remarks
 * Zones can be either per-player (each player gets their own instance)
 * or shared (one instance accessible to all players).
 * Shared zones have `owner: null` in the ZoneComponent.
 */
export interface ZoneDefinition {
  visibility?: ZoneVisibility;
  ordered?: boolean;
  maxCapacity?: number;
  description?: string;
  /**
   * If true, this zone is shared among all players (e.g., marketplace, common area).
   * Shared zones have `owner: null` and are referenced via `$zone.shared.zoneName`.
   * If false or undefined, each player gets their own instance of this zone.
   */
  shared?: boolean;
}

// ============================================================================
// Entity Templates
// ============================================================================

/**
 * Component data for an entity template.
 * Values can be literals or expressions.
 */
export type TemplateComponentData = Record<string, ValueExpression>;

/**
 * Definition of an entity template.
 */
export interface EntityTemplateDefinition {
  description?: string;
  components: Record<string, TemplateComponentData>;
}

// ============================================================================
// Targeting
// ============================================================================

/**
 * Query for finding valid target entities.
 */
export interface EntityQuery {
  zone?: string;
  owner?: 'actor' | 'opponent' | 'any';
  hasComponent?: string[];
  filter?: ConditionDefinition;
}

/**
 * Definition of a single target type.
 */
export interface TargetTypeDefinition {
  name?: string;
  description?: string;
  query: EntityQuery;
}

/**
 * Targeting configuration for an action.
 */
export interface TargetingDefinition {
  count?: number | { min?: number; max?: number };
  types?: TargetTypeDefinition[];
  validTargets?: EntityQuery;
}

// ============================================================================
// Conditions (used in preconditions and filters)
// ============================================================================

/**
 * Comparison operators for conditions.
 */
export type ComparisonOperator = '>=' | '>' | '<=' | '<' | '==' | '!=' | 'in' | 'notIn';

/**
 * Base condition definition with type discriminator.
 */
export interface BaseConditionDefinition {
  type: string;
  errorMessage?: string;
}

/**
 * Check if it's the player's turn.
 */
export interface IsPlayerTurnCondition extends BaseConditionDefinition {
  type: 'isPlayerTurn';
}

/**
 * Check if current phase matches.
 */
export interface PhaseCheckCondition extends BaseConditionDefinition {
  type: 'phaseCheck';
  phases: string[];
}

/**
 * Check a numeric resource value.
 */
export interface ResourceCheckCondition extends BaseConditionDefinition {
  type: 'resourceCheck';
  entity: EntityExpression;
  component: string;
  property: string;
  operator: ComparisonOperator;
  value: NumberExpression;
}

/**
 * Check if entity is in a zone.
 */
export interface EntityInZoneCondition extends BaseConditionDefinition {
  type: 'entityInZone';
  entity: EntityExpression;
  zone: ZoneExpression | ZoneExpression[];
}

/**
 * Check a component property value.
 */
export interface ComponentValueCheckCondition extends BaseConditionDefinition {
  type: 'componentValueCheck';
  entity: EntityExpression;
  component: string;
  property: string;
  value?: ValueExpression;
  operator?: ComparisonOperator;
}

/**
 * Check entity ownership.
 */
export interface OwnerCheckCondition extends BaseConditionDefinition {
  type: 'ownerCheck';
  entity: EntityExpression;
  expectedOwner: EntityExpression;
  invert?: boolean;
}

/**
 * Check target count.
 */
export interface TargetCountCondition extends BaseConditionDefinition {
  type: 'targetCount';
  exact?: number;
  min?: number;
  max?: number;
}

/**
 * Check if entity exists.
 */
export interface EntityExistsCondition extends BaseConditionDefinition {
  type: 'entityExists';
  entity: EntityExpression;
  requiredComponent?: string;
}

/**
 * Check zone entity count.
 */
export interface ZoneHasEntitiesCondition extends BaseConditionDefinition {
  type: 'zoneHasEntities';
  zone: ZoneExpression;
  minCount?: number;
  maxCount?: number;
  filter?: ConditionDefinition;
}

/**
 * Check if entity has a component.
 */
export interface HasComponentCondition extends BaseConditionDefinition {
  type: 'hasComponent';
  entity: EntityExpression;
  component: string;
}

/**
 * Logical AND of conditions.
 */
export interface AndCondition extends BaseConditionDefinition {
  type: 'and';
  conditions: ConditionDefinition[];
}

/**
 * Logical OR of conditions.
 */
export interface OrCondition extends BaseConditionDefinition {
  type: 'or';
  conditions: ConditionDefinition[];
}

/**
 * Logical NOT of a condition.
 */
export interface NotCondition extends BaseConditionDefinition {
  type: 'not';
  condition: ConditionDefinition;
}

/**
 * Union of all condition types.
 */
export type ConditionDefinition =
  | IsPlayerTurnCondition
  | PhaseCheckCondition
  | ResourceCheckCondition
  | EntityInZoneCondition
  | ComponentValueCheckCondition
  | OwnerCheckCondition
  | TargetCountCondition
  | EntityExistsCondition
  | ZoneHasEntitiesCondition
  | HasComponentCondition
  | AndCondition
  | OrCondition
  | NotCondition;

// ============================================================================
// Effects
// ============================================================================

/**
 * Base effect definition with type discriminator.
 */
export interface BaseEffectDefinition {
  type: string;
  eventType?: string;
  eventData?: Record<string, ValueExpression>;
}

/**
 * Move an entity between zones.
 */
export interface MoveEntityEffectDefinition extends BaseEffectDefinition {
  type: 'moveEntity';
  entity: EntityExpression;
  fromZone?: ZoneExpression;
  toZone: ZoneExpression;
}

/**
 * Modify a numeric resource.
 */
export interface ModifyResourceEffectDefinition extends BaseEffectDefinition {
  type: 'modifyResource';
  entity: EntityExpression;
  component: string;
  property: string;
  amount: NumberExpression;
  min?: number;
  max?: number;
  maxProperty?: string;
}

/**
 * Set a component value.
 */
export interface SetComponentValueEffectDefinition extends BaseEffectDefinition {
  type: 'setComponentValue';
  entity: EntityExpression;
  component: string;
  property?: string;
  value?: ValueExpression;
  values?: Record<string, ValueExpression>;
  createIfMissing?: boolean;
}

/**
 * Create a new entity.
 */
export interface CreateEntityEffectDefinition extends BaseEffectDefinition {
  type: 'createEntity';
  template?: string;
  components?: Record<string, TemplateComponentData>;
  zone?: ZoneExpression;
  storeAs?: string;
}

/**
 * Destroy an entity.
 */
export interface DestroyEntityEffectDefinition extends BaseEffectDefinition {
  type: 'destroyEntity';
  entity: EntityExpression;
  discardZone?: ZoneExpression;
}

/**
 * Shuffle a zone.
 */
export interface ShuffleZoneEffectDefinition extends BaseEffectDefinition {
  type: 'shuffleZone';
  zone: ZoneExpression;
}

/**
 * Transfer multiple entities between zones.
 */
export interface TransferMultipleEffectDefinition extends BaseEffectDefinition {
  type: 'transferMultiple';
  fromZone: ZoneExpression;
  toZone: ZoneExpression;
  count: NumberExpression;
  selection: 'top' | 'bottom' | 'random';
  filter?: ConditionDefinition;
}

/**
 * Conditional effect.
 */
export interface ConditionalEffectDefinition extends BaseEffectDefinition {
  type: 'conditional';
  condition: ConditionDefinition;
  then: EffectDefinition[];
  else?: EffectDefinition[];
}

/**
 * Repeat an effect.
 */
export interface RepeatEffectDefinition extends BaseEffectDefinition {
  type: 'repeat';
  times: NumberExpression;
  effect?: EffectDefinition;
  effects?: EffectDefinition[];
}

/**
 * Emit an event.
 */
export interface EmitEventEffectDefinition extends BaseEffectDefinition {
  type: 'emitEvent';
  eventType: string;
  data?: Record<string, ValueExpression>;
}

/**
 * Composite effect (sequence of effects).
 */
export interface CompositeEffectDefinition extends BaseEffectDefinition {
  type: 'composite';
  effects: EffectDefinition[];
}

/**
 * Switch the active player to the next player.
 */
export interface SwitchActivePlayerEffectDefinition extends BaseEffectDefinition {
  type: 'switchActivePlayer';
}

/**
 * Union of all effect types.
 */
export type EffectDefinition =
  | MoveEntityEffectDefinition
  | ModifyResourceEffectDefinition
  | SetComponentValueEffectDefinition
  | CreateEntityEffectDefinition
  | DestroyEntityEffectDefinition
  | ShuffleZoneEffectDefinition
  | TransferMultipleEffectDefinition
  | ConditionalEffectDefinition
  | RepeatEffectDefinition
  | EmitEventEffectDefinition
  | CompositeEffectDefinition
  | SwitchActivePlayerEffectDefinition;

// ============================================================================
// Actions
// ============================================================================

/**
 * Definition of an action.
 */
export interface ActionDefinitionSchema {
  name: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  targeting?: TargetingDefinition;
  parameters?: Record<string, PropertyDefinition>;
  preconditions?: ConditionDefinition[];
  costs?: EffectDefinition[];
  effects: EffectDefinition[];
}

// ============================================================================
// Phases
// ============================================================================

/**
 * Conditional next phase.
 */
export interface ConditionalNextPhase {
  conditions: Array<{
    condition: ConditionDefinition;
    phase: string;
  }>;
  default: string;
}

/**
 * Definition of a game phase.
 */
export interface PhaseDefinitionSchema {
  name: string;
  displayName?: string;
  description?: string;
  allowedActions: string[];
  autoAdvance?: boolean;
  autoAdvanceCondition?: ConditionDefinition;
  nextPhase?: string | ConditionalNextPhase;
  onEnter?: EffectDefinition[];
  onExit?: EffectDefinition[];
  subPhases?: PhaseDefinitionSchema[];
}

// ============================================================================
// Rules
// ============================================================================

/**
 * Event pattern for rule triggers.
 */
export interface EventPatternSchema {
  eventType: string;
  filters?: Record<string, ValueExpression>;
}

/**
 * Definition of a rule.
 */
export interface RuleDefinitionSchema {
  id: string;
  name?: string;
  description?: string;
  trigger: EventPatternSchema;
  conditions?: ConditionDefinition[];
  effects: EffectDefinition[];
  priority?: number;
  source?: EntityExpression;
}

// ============================================================================
// Setup
// ============================================================================

/**
 * Starting entity configuration.
 */
export interface StartingEntityConfig {
  template: string;
  zone: string;
  count?: number;
}

/**
 * Per-player setup configuration.
 */
export interface PerPlayerSetup {
  template: string;
  zones: string[];
  startingEntities?: StartingEntityConfig[];
}

/**
 * Initial draw configuration.
 */
export interface InitialDrawConfig {
  count: number;
  fromZone: string;
  toZone: string;
}

/**
 * Shared zone starting entities configuration.
 */
export interface SharedZoneEntityConfig {
  template: string;
  zone: string;
  count?: number;
}

/**
 * Game setup definition.
 */
export interface SetupDefinitionSchema {
  playerCount: {
    min: number;
    max?: number;
  };
  perPlayer: PerPlayerSetup;
  /**
   * Starting entities for shared zones.
   * These are created once (not per-player) in zones with shared: true.
   */
  sharedZoneEntities?: SharedZoneEntityConfig[];
  globalEntities?: Array<{
    template: string;
    zone?: string;
  }>;
  initialPhase: string;
  startingPlayer?: 'first' | 'random' | 'choice';
  initialDraw?: InitialDrawConfig;
  setupEffects?: EffectDefinition[];
}

// ============================================================================
// Win Conditions
// ============================================================================

/**
 * Win condition definition.
 */
export interface WinConditionSchema {
  id: string;
  name?: string;
  description?: string;
  trigger?: EventPatternSchema;
  condition: ConditionDefinition;
  winner?: EntityExpression;
  loser?: EntityExpression;
}

// ============================================================================
// Game Definition (Root Schema)
// ============================================================================

/**
 * Metadata about the game.
 */
export interface GameMetadataSchema {
  author?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  estimatedDuration?: string;
}

/**
 * Complete game definition schema.
 */
export interface GameDefinitionSchema {
  $schema?: string;
  name: string;
  version: string;
  metadata?: GameMetadataSchema;

  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  entityTemplates: Record<string, EntityTemplateDefinition>;
  actions: ActionDefinitionSchema[];
  phases: PhaseDefinitionSchema[];
  rules?: RuleDefinitionSchema[];
  setup: SetupDefinitionSchema;
  winConditions?: WinConditionSchema[];
}

// ============================================================================
// Resolver Context (Runtime)
// ============================================================================

/**
 * Context available during expression resolution.
 */
export interface ResolverContext {
  state: {
    coordinator: unknown;
    activePlayer: Entity | null;
    getAllPlayers: () => Entity[];
    getZone: (zoneName: string, owner: Entity | null) => Entity | null;
  };
  actor: Entity | null;
  targets: Entity[];
  parameters: Record<string, unknown>;
  event?: {
    type: string;
    data: Record<string, unknown>;
  };
  effectContext?: Record<string, unknown>;
  /** For $candidate in filter contexts */
  candidate?: Entity;
  /** For $eachPlayer in setup effects */
  eachPlayer?: Entity;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error.
 */
export interface ValidationError {
  code: string;
  message: string;
  path: string[];
  severity: 'error' | 'warning';
  suggestion?: string;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
