/**
 * Generic Preconditions Library
 *
 * Provides reusable, configurable preconditions for building board games without writing custom code.
 * These preconditions work with any game type and can be configured via constructor parameters.
 *
 * @module generic-preconditions
 */

import type { Entity, ComponentName } from '@ue-too/ecs';
import type { ActionContext } from '../../core/types';
import { BasePrecondition } from './base';
import type { EntityResolver, NumberResolver, ValueResolver } from '../resolvers';

// Re-export resolver types and helpers for convenience
export type { EntityResolver, NumberResolver, ValueResolver };
export { EntityResolvers, NumberResolvers, resolveEntity, resolveNumber } from '../resolvers';

// ============================================================================
// ResourceCheck Precondition
// ============================================================================

/**
 * Comparison operators for resource checks.
 */
export type ComparisonOperator = '>=' | '>' | '<=' | '<' | '==' | '!=';

/**
 * Configuration for ResourceCheck precondition.
 */
export interface ResourceCheckConfig {
  /** Entity to check */
  entity: EntityResolver | Entity;

  /** Component containing the resource */
  componentName: ComponentName;

  /** Property to check */
  property: string;

  /** Comparison operator */
  operator: ComparisonOperator;

  /** Value to compare against */
  value: NumberResolver | number;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if a numeric resource value meets a condition.
 *
 * @example
 * ```typescript
 * // Check if actor has at least 3 mana
 * const precondition = new ResourceCheck({
 *   entity: EntityResolvers.actor,
 *   componentName: RESOURCE_COMPONENT,
 *   property: 'mana',
 *   operator: '>=',
 *   value: 3,
 *   errorMessage: 'Not enough mana'
 * });
 * ```
 */
export class ResourceCheck extends BasePrecondition {
  private config: ResourceCheckConfig;

  constructor(config: ResourceCheckConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return false;

    const component = context.state.coordinator.getComponentFromEntity<Record<string, any>>(
      this.config.componentName,
      entity
    );
    if (!component) return false;

    const currentValue = component[this.config.property];
    if (typeof currentValue !== 'number') return false;

    const targetValue = this.resolveNumber(this.config.value, context);

    switch (this.config.operator) {
      case '>=':
        return currentValue >= targetValue;
      case '>':
        return currentValue > targetValue;
      case '<=':
        return currentValue <= targetValue;
      case '<':
        return currentValue < targetValue;
      case '==':
        return currentValue === targetValue;
      case '!=':
        return currentValue !== targetValue;
      default:
        return false;
    }
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    const entity = this.resolveEntity(this.config.entity, context);
    const component = entity
      ? context.state.coordinator.getComponentFromEntity<Record<string, any>>(
          this.config.componentName,
          entity
        )
      : null;
    const currentValue = component ? component[this.config.property] : 'N/A';
    const targetValue = this.resolveNumber(this.config.value, context);

    return `${this.config.property} must be ${this.config.operator} ${targetValue} (current: ${currentValue})`;
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }

  private resolveNumber(resolver: NumberResolver | number, context: ActionContext): number {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// ZoneHasEntities Precondition
// ============================================================================

/**
 * Configuration for ZoneHasEntities precondition.
 */
export interface ZoneHasEntitiesConfig {
  /** Zone entity to check */
  zone: EntityResolver | Entity;

  /** Component containing the entity list */
  zoneListComponent: ComponentName;

  /** Minimum number of entities required */
  minCount?: number;

  /** Maximum number of entities allowed */
  maxCount?: number;

  /** Optional filter function */
  filter?: (entity: Entity, context: ActionContext) => boolean;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if a zone has a certain number of entities.
 *
 * @example
 * ```typescript
 * // Check if deck has at least 1 card
 * const precondition = new ZoneHasEntities({
 *   zone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'deck'),
 *   zoneListComponent: DECK_COMPONENT,
 *   minCount: 1,
 *   errorMessage: 'Deck is empty'
 * });
 * ```
 */
export class ZoneHasEntities extends BasePrecondition {
  private config: ZoneHasEntitiesConfig;

  constructor(config: ZoneHasEntitiesConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const zone = this.resolveEntity(this.config.zone, context);
    if (zone === null) return false;

    const zoneList = context.state.coordinator.getComponentFromEntity<{
      cached: { entities: Entity[] };
    }>(this.config.zoneListComponent, zone);
    if (!zoneList) return false;

    let entities = zoneList.cached.entities;

    // Apply filter if provided
    if (this.config.filter) {
      entities = entities.filter((e) => this.config.filter!(e, context));
    }

    const count = entities.length;

    // Check min
    if (this.config.minCount !== undefined && count < this.config.minCount) {
      return false;
    }

    // Check max
    if (this.config.maxCount !== undefined && count > this.config.maxCount) {
      return false;
    }

    return true;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    const zone = this.resolveEntity(this.config.zone, context);
    const zoneList = zone
      ? context.state.coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
          this.config.zoneListComponent,
          zone
        )
      : null;
    const count = zoneList?.cached.entities.length ?? 0;

    if (this.config.minCount !== undefined && count < this.config.minCount) {
      return `Zone needs at least ${this.config.minCount} entities (has ${count})`;
    }
    if (this.config.maxCount !== undefined && count > this.config.maxCount) {
      return `Zone can have at most ${this.config.maxCount} entities (has ${count})`;
    }

    return 'Zone entity count check failed';
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// EntityInZone Precondition
// ============================================================================

/**
 * Configuration for EntityInZone precondition.
 */
export interface EntityInZoneConfig {
  /** Entity to check */
  entity: EntityResolver | Entity;

  /** Expected zone (or zones) */
  zone: EntityResolver | Entity | (EntityResolver | Entity)[];

  /** Location component on the entity */
  locationComponent: ComponentName;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if an entity is in a specific zone.
 *
 * @example
 * ```typescript
 * // Check if target card is in actor's hand
 * const precondition = new EntityInZone({
 *   entity: EntityResolvers.target,
 *   zone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'hand'),
 *   locationComponent: LOCATION_COMPONENT,
 *   errorMessage: 'Card must be in your hand'
 * });
 * ```
 */
export class EntityInZone extends BasePrecondition {
  private config: EntityInZoneConfig;

  constructor(config: EntityInZoneConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return false;

    const locationComp = context.state.coordinator.getComponentFromEntity<{ location: Entity }>(
      this.config.locationComponent,
      entity
    );
    if (!locationComp) return false;

    const currentZone = locationComp.location;

    // Handle multiple allowed zones
    const zones = Array.isArray(this.config.zone) ? this.config.zone : [this.config.zone];

    for (const zoneResolver of zones) {
      const expectedZone = this.resolveEntity(zoneResolver, context);
      if (expectedZone !== null && currentZone === expectedZone) {
        return true;
      }
    }

    return false;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;
    return 'Entity is not in the required zone';
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// ComponentValueCheck Precondition
// ============================================================================

/**
 * Configuration for ComponentValueCheck precondition.
 */
export interface ComponentValueCheckConfig {
  /** Entity to check */
  entity: EntityResolver | Entity;

  /** Component name */
  componentName: ComponentName;

  /** Property to check */
  property: string;

  /** Expected value (or predicate function) */
  value: any | ((value: any, context: ActionContext) => boolean);

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if a component property has a specific value.
 *
 * @example
 * ```typescript
 * // Check if creature is not tapped
 * const precondition = new ComponentValueCheck({
 *   entity: EntityResolvers.target,
 *   componentName: CARD_STATE_COMPONENT,
 *   property: 'tapped',
 *   value: false,
 *   errorMessage: 'Creature is tapped'
 * });
 *
 * // Check with predicate
 * const precondition = new ComponentValueCheck({
 *   entity: EntityResolvers.target,
 *   componentName: CARD_COMPONENT,
 *   property: 'cardType',
 *   value: (type) => type === 'Creature' || type === 'Artifact',
 *   errorMessage: 'Must be a creature or artifact'
 * });
 * ```
 */
export class ComponentValueCheck extends BasePrecondition {
  private config: ComponentValueCheckConfig;

  constructor(config: ComponentValueCheckConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return false;

    const component = context.state.coordinator.getComponentFromEntity<Record<string, any>>(
      this.config.componentName,
      entity
    );
    if (!component) return false;

    const currentValue = component[this.config.property];

    // If value is a predicate function, call it
    if (typeof this.config.value === 'function') {
      return this.config.value(currentValue, context);
    }

    // Otherwise, compare directly
    return currentValue === this.config.value;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    const entity = this.resolveEntity(this.config.entity, context);
    const component = entity
      ? context.state.coordinator.getComponentFromEntity<Record<string, any>>(
          this.config.componentName,
          entity
        )
      : null;
    const currentValue = component ? component[this.config.property] : 'N/A';

    return `${this.config.property} check failed (current: ${currentValue})`;
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// OwnerCheck Precondition
// ============================================================================

/**
 * Configuration for OwnerCheck precondition.
 */
export interface OwnerCheckConfig {
  /** Entity to check ownership of */
  entity: EntityResolver | Entity;

  /** Expected owner (usually the actor) */
  expectedOwner: EntityResolver | Entity;

  /** Owner component name */
  ownerComponent: ComponentName;

  /** Property name on owner component that holds the owner entity */
  ownerProperty?: string;

  /** Whether to check that entity is NOT owned by the expected owner */
  invert?: boolean;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if an entity is owned by a specific player.
 *
 * @example
 * ```typescript
 * // Check if target is owned by actor
 * const precondition = new OwnerCheck({
 *   entity: EntityResolvers.target,
 *   expectedOwner: EntityResolvers.actor,
 *   ownerComponent: OWNER_COMPONENT,
 *   ownerProperty: 'owner',
 *   errorMessage: 'You must own this card'
 * });
 *
 * // Check if target is NOT owned by actor (enemy check)
 * const precondition = new OwnerCheck({
 *   entity: EntityResolvers.target,
 *   expectedOwner: EntityResolvers.actor,
 *   ownerComponent: OWNER_COMPONENT,
 *   ownerProperty: 'owner',
 *   invert: true,
 *   errorMessage: 'Target must be an enemy'
 * });
 * ```
 */
export class OwnerCheck extends BasePrecondition {
  private config: OwnerCheckConfig;

  constructor(config: OwnerCheckConfig) {
    super();
    this.config = {
      ownerProperty: 'owner',
      invert: false,
      ...config,
    };
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return false;

    const expectedOwner = this.resolveEntity(this.config.expectedOwner, context);
    if (expectedOwner === null) return false;

    const ownerComp = context.state.coordinator.getComponentFromEntity<Record<string, any>>(
      this.config.ownerComponent,
      entity
    );
    if (!ownerComp) return false;

    const actualOwner = ownerComp[this.config.ownerProperty!];
    const isOwned = actualOwner === expectedOwner;

    return this.config.invert ? !isOwned : isOwned;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    if (this.config.invert) {
      return 'Entity must not be owned by you';
    }
    return 'You must own this entity';
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// TargetCount Precondition
// ============================================================================

/**
 * Configuration for TargetCount precondition.
 */
export interface TargetCountConfig {
  /** Exact number of targets required */
  exact?: number;

  /** Minimum number of targets */
  min?: number;

  /** Maximum number of targets */
  max?: number;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if the action has the correct number of targets.
 *
 * @example
 * ```typescript
 * // Require exactly 2 targets
 * const precondition = new TargetCount({
 *   exact: 2,
 *   errorMessage: 'Must select exactly 2 targets'
 * });
 *
 * // Require 1-3 targets
 * const precondition = new TargetCount({
 *   min: 1,
 *   max: 3
 * });
 * ```
 */
export class TargetCount extends BasePrecondition {
  private config: TargetCountConfig;

  constructor(config: TargetCountConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const count = context.targets.length;

    if (this.config.exact !== undefined) {
      return count === this.config.exact;
    }

    if (this.config.min !== undefined && count < this.config.min) {
      return false;
    }

    if (this.config.max !== undefined && count > this.config.max) {
      return false;
    }

    return true;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    const count = context.targets.length;

    if (this.config.exact !== undefined) {
      return `Requires exactly ${this.config.exact} targets (got ${count})`;
    }

    if (this.config.min !== undefined && count < this.config.min) {
      return `Requires at least ${this.config.min} targets (got ${count})`;
    }

    if (this.config.max !== undefined && count > this.config.max) {
      return `Requires at most ${this.config.max} targets (got ${count})`;
    }

    return 'Invalid target count';
  }
}

// ============================================================================
// EntityExists Precondition
// ============================================================================

/**
 * Configuration for EntityExists precondition.
 */
export interface EntityExistsConfig {
  /** Entity to check */
  entity: EntityResolver | Entity;

  /** Required component (entity must have this component to be considered "existing") */
  requiredComponent?: ComponentName;

  /** Custom error message (optional) */
  errorMessage?: string;
}

/**
 * Checks if an entity exists and optionally has a specific component.
 *
 * @example
 * ```typescript
 * // Check if target exists and is a card
 * const precondition = new EntityExists({
 *   entity: EntityResolvers.target,
 *   requiredComponent: CARD_COMPONENT,
 *   errorMessage: 'Target must be a valid card'
 * });
 * ```
 */
export class EntityExists extends BasePrecondition {
  private config: EntityExistsConfig;

  constructor(config: EntityExistsConfig) {
    super();
    this.config = config;
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return false;

    // If required component is specified, check for it
    if (this.config.requiredComponent) {
      const component = context.state.coordinator.getComponentFromEntity(
        this.config.requiredComponent,
        entity
      );
      return component !== null;
    }

    return true;
  }

  getErrorMessage(context: ActionContext): string {
    if (this.config.errorMessage) return this.config.errorMessage;

    if (this.config.requiredComponent) {
      return 'Entity does not exist or is missing required component';
    }
    return 'Entity does not exist';
  }

  private resolveEntity(resolver: EntityResolver | Entity, context: ActionContext): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}
