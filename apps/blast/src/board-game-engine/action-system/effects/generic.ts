/**
 * Generic Effects Library
 *
 * Provides reusable, configurable effects for building board games without writing custom code.
 * These effects work with any game type and can be configured via constructor parameters.
 *
 * @module generic-effects
 */

import type { Entity, ComponentName } from '@ue-too/ecs';
import type { Effect, ActionContext, Event } from '../../core/types';
import { ECSEffect, BaseEffect } from './base';
import { generateEventId } from '../../event-system/event-utils';
import type { EntityResolver, ZoneResolver, NumberResolver, ValueResolver } from '../resolvers';

// Re-export resolver types and helpers for convenience
export type { EntityResolver, ZoneResolver, NumberResolver, ValueResolver };
export { EntityResolvers, NumberResolvers, resolveEntity, resolveNumber, resolveValue } from '../resolvers';

// ============================================================================
// MoveEntity Effect
// ============================================================================

/**
 * Configuration for MoveEntity effect.
 */
export interface MoveEntityConfig {
  /** Entity to move (resolver or fixed entity) */
  entity: EntityResolver | Entity;

  /** Source zone (for validation, optional) */
  fromZone?: ZoneResolver | Entity;

  /** Destination zone */
  toZone: ZoneResolver | Entity;

  /** Component name for location tracking */
  locationComponent: ComponentName;

  /** Component name for zone entity lists (optional, for caching) */
  zoneListComponent?: ComponentName;

  /** Event type to emit (optional) */
  eventType?: string;

  /** Additional event data generator (optional) */
  eventDataGenerator?: (context: ActionContext, entity: Entity) => Record<string, any>;
}

/**
 * Moves an entity from one zone to another.
 * Updates the entity's location component and optionally zone caches.
 *
 * @example
 * ```typescript
 * // Move first target to actor's board zone
 * const effect = new MoveEntity({
 *   entity: EntityResolvers.target,
 *   toZone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'board'),
 *   locationComponent: LOCATION_COMPONENT,
 *   eventType: 'EntityMoved'
 * });
 * ```
 */
export class MoveEntity extends ECSEffect {
  private config: MoveEntityConfig;

  constructor(config: MoveEntityConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve entity
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return;

    // Resolve destination zone
    const toZone = this.resolveEntity(this.config.toZone, context);
    if (toZone === null) return;

    // Get current location for removal from source zone cache
    const locationComp = coordinator.getComponentFromEntity<{ location: Entity }>(
      this.config.locationComponent,
      entity
    );

    // Remove from source zone cache if configured
    if (this.config.zoneListComponent && locationComp) {
      const sourceZone = locationComp.location;
      const sourceZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
        this.config.zoneListComponent,
        sourceZone
      );
      if (sourceZoneList) {
        const idx = sourceZoneList.cached.entities.indexOf(entity);
        if (idx !== -1) {
          sourceZoneList.cached.entities.splice(idx, 1);
        }
      }
    }

    // Update entity location
    if (locationComp) {
      locationComp.location = toZone;
    } else {
      coordinator.addComponentToEntity(this.config.locationComponent, entity, {
        location: toZone,
        sortIndex: 0,
      });
    }

    // Add to destination zone cache if configured
    if (this.config.zoneListComponent) {
      const destZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
        this.config.zoneListComponent,
        toZone
      );
      if (destZoneList) {
        destZoneList.cached.entities.push(entity);
      }
    }
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const entity = this.resolveEntity(this.config.entity, context);
    const toZone = this.resolveEntity(this.config.toZone, context);

    const baseData = {
      entityId: entity,
      toZoneId: toZone,
      actorId: context.actor,
    };

    const additionalData = this.config.eventDataGenerator
      ? this.config.eventDataGenerator(context, entity!)
      : {};

    return {
      type: this.config.eventType,
      data: { ...baseData, ...additionalData },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: EntityResolver | Entity,
    context: ActionContext
  ): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// ModifyResource Effect
// ============================================================================

/**
 * Configuration for ModifyResource effect.
 */
export interface ModifyResourceConfig {
  /** Entity whose resource to modify */
  entity: EntityResolver | Entity;

  /** Component containing the resource */
  componentName: ComponentName;

  /** Property name to modify */
  property: string;

  /** Amount to add (negative for subtract) */
  amount: NumberResolver | number;

  /** Optional minimum value (clamp) */
  min?: number;

  /** Optional maximum value (clamp) */
  max?: number;

  /** Optional max property name (e.g., 'maxMana' for clamping 'mana') */
  maxProperty?: string;

  /** Event type to emit (optional) */
  eventType?: string;
}

/**
 * Modifies a numeric resource value on an entity's component.
 * Supports clamping to min/max values.
 *
 * @example
 * ```typescript
 * // Subtract 3 mana from actor
 * const effect = new ModifyResource({
 *   entity: EntityResolvers.actor,
 *   componentName: RESOURCE_COMPONENT,
 *   property: 'mana',
 *   amount: -3,
 *   min: 0,
 *   eventType: 'ResourceChanged'
 * });
 * ```
 */
export class ModifyResource extends ECSEffect {
  private config: ModifyResourceConfig;

  constructor(config: ModifyResourceConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve entity
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return;

    // Get component
    const component = coordinator.getComponentFromEntity<Record<string, any>>(
      this.config.componentName,
      entity
    );
    if (!component) return;

    // Resolve amount
    const amount = this.resolveNumber(this.config.amount, context);

    // Get current value
    const currentValue = component[this.config.property];
    if (typeof currentValue !== 'number') return;

    // Calculate new value
    let newValue = currentValue + amount;

    // Apply min clamp
    if (this.config.min !== undefined) {
      newValue = Math.max(newValue, this.config.min);
    }

    // Apply max clamp (from config or from another property)
    if (this.config.max !== undefined) {
      newValue = Math.min(newValue, this.config.max);
    } else if (this.config.maxProperty && component[this.config.maxProperty] !== undefined) {
      newValue = Math.min(newValue, component[this.config.maxProperty]);
    }

    // Apply change
    component[this.config.property] = newValue;
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const entity = this.resolveEntity(this.config.entity, context);
    const amount = this.resolveNumber(this.config.amount, context);

    return {
      type: this.config.eventType,
      data: {
        entityId: entity,
        property: this.config.property,
        amount: amount,
        actorId: context.actor,
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: EntityResolver | Entity,
    context: ActionContext
  ): Entity | null {
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
// SetComponentValue Effect
// ============================================================================

/**
 * Configuration for SetComponentValue effect.
 */
export interface SetComponentValueConfig {
  /** Entity to modify */
  entity: EntityResolver | Entity;

  /** Component name */
  componentName: ComponentName;

  /** Property to set */
  property: string;

  /** Value to set (resolver or fixed value) */
  value: ValueResolver<any> | any;

  /** Event type to emit (optional) */
  eventType?: string;
}

/**
 * Sets a specific property on an entity's component to a value.
 *
 * @example
 * ```typescript
 * // Set creature's tapped state to true
 * const effect = new SetComponentValue({
 *   entity: EntityResolvers.target,
 *   componentName: CARD_STATE_COMPONENT,
 *   property: 'tapped',
 *   value: true
 * });
 * ```
 */
export class SetComponentValue extends ECSEffect {
  private config: SetComponentValueConfig;

  constructor(config: SetComponentValueConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve entity
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return;

    // Get component
    const component = coordinator.getComponentFromEntity<Record<string, any>>(
      this.config.componentName,
      entity
    );
    if (!component) return;

    // Resolve value
    const value = this.resolveValue(this.config.value, context);

    // Set property
    component[this.config.property] = value;
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const entity = this.resolveEntity(this.config.entity, context);
    const value = this.resolveValue(this.config.value, context);

    return {
      type: this.config.eventType,
      data: {
        entityId: entity,
        property: this.config.property,
        value: value,
        actorId: context.actor,
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: EntityResolver | Entity,
    context: ActionContext
  ): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }

  private resolveValue<T>(resolver: ValueResolver<T> | T, context: ActionContext): T {
    if (typeof resolver === 'function') {
      return (resolver as ValueResolver<T>)(context);
    }
    return resolver;
  }
}

// ============================================================================
// DestroyEntity Effect
// ============================================================================

/**
 * Configuration for DestroyEntity effect.
 */
export interface DestroyEntityConfig {
  /** Entity to destroy */
  entity: EntityResolver | Entity;

  /** Optional: Move to discard zone instead of destroying */
  discardZone?: ZoneResolver | Entity;

  /** Location component (required if using discardZone) */
  locationComponent?: ComponentName;

  /** Zone list component (for cache cleanup) */
  zoneListComponent?: ComponentName;

  /** Event type to emit (optional) */
  eventType?: string;

  /** Additional event data generator (optional) */
  eventDataGenerator?: (context: ActionContext, entity: Entity) => Record<string, any>;
}

/**
 * Destroys an entity or moves it to a discard zone.
 *
 * @example
 * ```typescript
 * // Destroy target entity, moving to discard zone
 * const effect = new DestroyEntity({
 *   entity: EntityResolvers.target,
 *   discardZone: (ctx) => getPlayerZone(ctx.state, getOwner(ctx.targets[0]), 'discard'),
 *   locationComponent: LOCATION_COMPONENT,
 *   zoneListComponent: DECK_COMPONENT,
 *   eventType: 'EntityDestroyed'
 * });
 * ```
 */
export class DestroyEntity extends ECSEffect {
  private config: DestroyEntityConfig;

  constructor(config: DestroyEntityConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve entity
    const entity = this.resolveEntity(this.config.entity, context);
    if (entity === null) return;

    // Remove from current zone cache
    if (this.config.zoneListComponent && this.config.locationComponent) {
      const locationComp = coordinator.getComponentFromEntity<{ location: Entity }>(
        this.config.locationComponent,
        entity
      );
      if (locationComp) {
        const sourceZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
          this.config.zoneListComponent,
          locationComp.location
        );
        if (sourceZoneList) {
          const idx = sourceZoneList.cached.entities.indexOf(entity);
          if (idx !== -1) {
            sourceZoneList.cached.entities.splice(idx, 1);
          }
        }
      }
    }

    // Move to discard zone or destroy
    if (this.config.discardZone && this.config.locationComponent) {
      const discardZone = this.resolveEntity(this.config.discardZone, context);
      if (discardZone) {
        // Update location
        const locationComp = coordinator.getComponentFromEntity<{ location: Entity }>(
          this.config.locationComponent,
          entity
        );
        if (locationComp) {
          locationComp.location = discardZone;
        }

        // Add to discard zone cache
        if (this.config.zoneListComponent) {
          const discardZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
            this.config.zoneListComponent,
            discardZone
          );
          if (discardZoneList) {
            discardZoneList.cached.entities.push(entity);
          }
        }
      }
    } else {
      // Actually destroy the entity
      coordinator.destroyEntity(entity);
    }
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const entity = this.resolveEntity(this.config.entity, context);

    const baseData = {
      entityId: entity,
      actorId: context.actor,
    };

    const additionalData = this.config.eventDataGenerator
      ? this.config.eventDataGenerator(context, entity!)
      : {};

    return {
      type: this.config.eventType,
      data: { ...baseData, ...additionalData },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: EntityResolver | Entity | undefined,
    context: ActionContext
  ): Entity | null {
    if (resolver === undefined) return null;
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// CreateEntity Effect
// ============================================================================

/**
 * Component data to add to a created entity.
 */
export interface ComponentData {
  /** Component name */
  name: ComponentName;

  /** Component data (resolver or fixed value) */
  data: ValueResolver<Record<string, any>> | Record<string, any>;
}

/**
 * Configuration for CreateEntity effect.
 */
export interface CreateEntityConfig {
  /** Components to add to the new entity */
  components: ComponentData[];

  /** Zone to place the entity in */
  zone?: ZoneResolver | Entity;

  /** Location component (required if zone is specified) */
  locationComponent?: ComponentName;

  /** Zone list component (for cache) */
  zoneListComponent?: ComponentName;

  /** Store created entity ID in context parameters under this key */
  storeAs?: string;

  /** Event type to emit (optional) */
  eventType?: string;
}

/**
 * Creates a new entity with specified components.
 *
 * @example
 * ```typescript
 * // Create a token creature on the board
 * const effect = new CreateEntity({
 *   components: [
 *     { name: CARD_COMPONENT, data: { name: 'Token', cardType: 'Creature', power: 1, toughness: 1 } },
 *     { name: OWNER_COMPONENT, data: (ctx) => ({ owner: ctx.actor }) }
 *   ],
 *   zone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'board'),
 *   locationComponent: LOCATION_COMPONENT,
 *   zoneListComponent: DECK_COMPONENT,
 *   eventType: 'EntityCreated'
 * });
 * ```
 */
export class CreateEntity extends ECSEffect {
  private config: CreateEntityConfig;

  constructor(config: CreateEntityConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Create entity
    const entity = coordinator.createEntity();

    // Add components
    for (const compData of this.config.components) {
      const data = this.resolveValue(compData.data, context);
      coordinator.addComponentToEntity(compData.name, entity, data);
    }

    // Place in zone if specified
    if (this.config.zone && this.config.locationComponent) {
      const zone = this.resolveEntity(this.config.zone, context);
      if (zone) {
        coordinator.addComponentToEntity(this.config.locationComponent, entity, {
          location: zone,
          sortIndex: 0,
        });

        // Add to zone cache
        if (this.config.zoneListComponent) {
          const zoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
            this.config.zoneListComponent,
            zone
          );
          if (zoneList) {
            zoneList.cached.entities.push(entity);
          }
        }
      }
    }

    // Store entity ID in parameters for later use
    if (this.config.storeAs) {
      context.parameters[this.config.storeAs] = entity;
    }
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const createdEntity = this.config.storeAs ? context.parameters[this.config.storeAs] : null;

    return {
      type: this.config.eventType,
      data: {
        entityId: createdEntity,
        actorId: context.actor,
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: ZoneResolver | Entity,
    context: ActionContext
  ): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }

  private resolveValue<T>(resolver: ValueResolver<T> | T, context: ActionContext): T {
    if (typeof resolver === 'function') {
      return (resolver as ValueResolver<T>)(context);
    }
    return resolver;
  }
}

// ============================================================================
// ShuffleZone Effect
// ============================================================================

/**
 * Configuration for ShuffleZone effect.
 */
export interface ShuffleZoneConfig {
  /** Zone to shuffle */
  zone: ZoneResolver | Entity;

  /** Zone list component containing entities */
  zoneListComponent: ComponentName;

  /** Optional random seed for deterministic shuffling */
  seed?: number;

  /** Event type to emit (optional) */
  eventType?: string;
}

/**
 * Shuffles entities in a zone (Fisher-Yates algorithm).
 *
 * @example
 * ```typescript
 * // Shuffle the deck
 * const effect = new ShuffleZone({
 *   zone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'deck'),
 *   zoneListComponent: DECK_COMPONENT,
 *   eventType: 'ZoneShuffled'
 * });
 * ```
 */
export class ShuffleZone extends ECSEffect {
  private config: ShuffleZoneConfig;

  constructor(config: ShuffleZoneConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve zone
    const zone = this.resolveEntity(this.config.zone, context);
    if (zone === null) return;

    // Get zone list
    const zoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      this.config.zoneListComponent,
      zone
    );
    if (!zoneList) return;

    // Fisher-Yates shuffle
    const entities = zoneList.cached.entities;
    for (let i = entities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entities[i], entities[j]] = [entities[j], entities[i]];
    }
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const zone = this.resolveEntity(this.config.zone, context);

    return {
      type: this.config.eventType,
      data: {
        zoneId: zone,
        actorId: context.actor,
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: ZoneResolver | Entity,
    context: ActionContext
  ): Entity | null {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}

// ============================================================================
// TransferMultiple Effect
// ============================================================================

/**
 * Configuration for TransferMultiple effect.
 */
export interface TransferMultipleConfig {
  /** Source zone */
  fromZone: ZoneResolver | Entity;

  /** Destination zone */
  toZone: ZoneResolver | Entity;

  /** Number of entities to transfer */
  count: NumberResolver | number;

  /** 'top' = last in array (like drawing), 'bottom' = first, 'random' = random selection */
  selection: 'top' | 'bottom' | 'random';

  /** Location component */
  locationComponent: ComponentName;

  /** Zone list component */
  zoneListComponent: ComponentName;

  /** Optional filter function to select specific entities */
  filter?: (entity: Entity, context: ActionContext) => boolean;

  /** Event type to emit (optional) */
  eventType?: string;
}

/**
 * Transfers multiple entities from one zone to another.
 * Useful for drawing multiple cards, discarding, etc.
 *
 * @example
 * ```typescript
 * // Draw 3 cards from deck to hand
 * const effect = new TransferMultiple({
 *   fromZone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'deck'),
 *   toZone: (ctx) => getPlayerZone(ctx.state, ctx.actor, 'hand'),
 *   count: 3,
 *   selection: 'top',
 *   locationComponent: LOCATION_COMPONENT,
 *   zoneListComponent: DECK_COMPONENT,
 *   eventType: 'CardsDrawn'
 * });
 * ```
 */
export class TransferMultiple extends ECSEffect {
  private config: TransferMultipleConfig;

  constructor(config: TransferMultipleConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const coordinator = this.getCoordinator(context);

    // Resolve zones
    const fromZone = this.resolveEntity(this.config.fromZone, context);
    const toZone = this.resolveEntity(this.config.toZone, context);
    if (!fromZone || !toZone) return;

    // Resolve count
    const count = this.resolveNumber(this.config.count, context);

    // Get source zone list
    const fromZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      this.config.zoneListComponent,
      fromZone
    );
    if (!fromZoneList) return;

    // Get destination zone list
    const toZoneList = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      this.config.zoneListComponent,
      toZone
    );
    if (!toZoneList) return;

    // Get available entities (optionally filtered)
    let available = [...fromZoneList.cached.entities];
    if (this.config.filter) {
      available = available.filter((e) => this.config.filter!(e, context));
    }

    // Select entities to transfer
    const toTransfer: Entity[] = [];
    const actualCount = Math.min(count, available.length);

    for (let i = 0; i < actualCount; i++) {
      let entity: Entity;

      switch (this.config.selection) {
        case 'top':
          entity = available.pop()!;
          break;
        case 'bottom':
          entity = available.shift()!;
          break;
        case 'random':
          const idx = Math.floor(Math.random() * available.length);
          entity = available.splice(idx, 1)[0];
          break;
      }

      toTransfer.push(entity);
    }

    // Transfer entities
    for (const entity of toTransfer) {
      // Remove from source
      const sourceIdx = fromZoneList.cached.entities.indexOf(entity);
      if (sourceIdx !== -1) {
        fromZoneList.cached.entities.splice(sourceIdx, 1);
      }

      // Update location
      const locationComp = coordinator.getComponentFromEntity<{ location: Entity }>(
        this.config.locationComponent,
        entity
      );
      if (locationComp) {
        locationComp.location = toZone;
      }

      // Add to destination
      toZoneList.cached.entities.push(entity);
    }
  }

  generatesEvent(): boolean {
    return this.config.eventType !== undefined;
  }

  createEvent(context: ActionContext): Event | null {
    if (!this.config.eventType) return null;

    const fromZone = this.resolveEntity(this.config.fromZone, context);
    const toZone = this.resolveEntity(this.config.toZone, context);
    const count = this.resolveNumber(this.config.count, context);

    return {
      type: this.config.eventType,
      data: {
        fromZoneId: fromZone,
        toZoneId: toZone,
        count: count,
        actorId: context.actor,
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }

  private resolveEntity(
    resolver: ZoneResolver | Entity,
    context: ActionContext
  ): Entity | null {
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
// ConditionalEffect
// ============================================================================

/**
 * Configuration for ConditionalEffect.
 */
export interface ConditionalEffectConfig {
  /** Condition that must be true for effect to apply */
  condition: (context: ActionContext) => boolean;

  /** Effect to apply if condition is true */
  thenEffect: Effect;

  /** Optional effect to apply if condition is false */
  elseEffect?: Effect;
}

/**
 * Applies an effect only if a condition is met.
 *
 * @example
 * ```typescript
 * // Deal extra damage if target is wounded
 * const effect = new ConditionalEffect({
 *   condition: (ctx) => {
 *     const health = ctx.getComponent(RESOURCE_COMPONENT, ctx.targets[0]);
 *     return health && health.health < health.maxHealth;
 *   },
 *   thenEffect: new ModifyResource({ ... amount: -2 }),
 *   elseEffect: new ModifyResource({ ... amount: -1 })
 * });
 * ```
 */
export class ConditionalEffect extends BaseEffect {
  private config: ConditionalEffectConfig;

  constructor(config: ConditionalEffectConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    if (this.config.condition(context)) {
      this.config.thenEffect.apply(context);
    } else if (this.config.elseEffect) {
      this.config.elseEffect.apply(context);
    }
  }

  generatesEvent(): boolean {
    return (
      this.config.thenEffect.generatesEvent() ||
      (this.config.elseEffect?.generatesEvent() ?? false)
    );
  }

  createEvent(context: ActionContext): Event | null {
    if (this.config.condition(context)) {
      return this.config.thenEffect.createEvent(context);
    } else if (this.config.elseEffect) {
      return this.config.elseEffect.createEvent(context);
    }
    return null;
  }
}

// ============================================================================
// RepeatEffect
// ============================================================================

/**
 * Configuration for RepeatEffect.
 */
export interface RepeatEffectConfig {
  /** Effect to repeat */
  effect: Effect;

  /** Number of times to repeat */
  times: NumberResolver | number;
}

/**
 * Repeats an effect multiple times.
 *
 * @example
 * ```typescript
 * // Deal 1 damage 3 times (for separate triggers)
 * const effect = new RepeatEffect({
 *   effect: new ModifyResource({ ... amount: -1, eventType: 'DamageDealt' }),
 *   times: 3
 * });
 * ```
 */
export class RepeatEffect extends BaseEffect {
  private config: RepeatEffectConfig;

  constructor(config: RepeatEffectConfig) {
    super();
    this.config = config;
  }

  apply(context: ActionContext): void {
    const times = this.resolveNumber(this.config.times, context);

    for (let i = 0; i < times; i++) {
      this.config.effect.apply(context);
    }
  }

  generatesEvent(): boolean {
    return this.config.effect.generatesEvent();
  }

  createEvent(context: ActionContext): Event | null {
    // Only returns one event (the first iteration)
    return this.config.effect.createEvent(context);
  }

  private resolveNumber(resolver: NumberResolver | number, context: ActionContext): number {
    if (typeof resolver === 'function') {
      return resolver(context);
    }
    return resolver;
  }
}
