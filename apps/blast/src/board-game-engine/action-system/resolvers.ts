/**
 * Resolvers for Generic Effects and Preconditions
 *
 * Provides resolver functions and types used to dynamically determine
 * entities, values, and zones in configurable effects and preconditions.
 *
 * @module resolvers
 */

import type { Entity, ComponentName } from '@ue-too/ecs';
import type { ActionContext } from '../core/types';

// ============================================================================
// Resolver Types
// ============================================================================

/**
 * Resolver function that returns an entity from the action context.
 * Used to dynamically determine which entity to operate on.
 */
export type EntityResolver = (context: ActionContext) => Entity | null;

/**
 * Resolver function that returns a zone entity from the action context.
 */
export type ZoneResolver = (context: ActionContext) => Entity | null;

/**
 * Resolver function that returns a numeric value from the action context.
 */
export type NumberResolver = (context: ActionContext) => number;

/**
 * Resolver function that returns any value from the action context.
 */
export type ValueResolver<T> = (context: ActionContext) => T;

// ============================================================================
// Built-in Entity Resolvers
// ============================================================================

/**
 * Resolvers for common entity sources.
 *
 * @example
 * ```typescript
 * // Use the actor (player performing action)
 * const effect = new MoveEntity({
 *   entity: EntityResolvers.actor,
 *   ...
 * });
 *
 * // Use the first target
 * const effect = new MoveEntity({
 *   entity: EntityResolvers.target,
 *   ...
 * });
 * ```
 */
export const EntityResolvers = {
  /** Returns the actor (player performing the action) */
  actor: (ctx: ActionContext) => ctx.actor,

  /** Returns the first target */
  target: (ctx: ActionContext) => ctx.targets[0] ?? null,

  /** Returns target at specific index */
  targetAt: (index: number) => (ctx: ActionContext) => ctx.targets[index] ?? null,

  /** Returns entity from parameters */
  fromParam: (paramName: string) => (ctx: ActionContext) => ctx.parameters[paramName] ?? null,

  /** Returns a fixed entity */
  fixed: (entity: Entity) => (_ctx: ActionContext) => entity,
};

// ============================================================================
// Built-in Number Resolvers
// ============================================================================

/**
 * Resolvers for common numeric values.
 *
 * @example
 * ```typescript
 * // Fixed amount
 * const effect = new ModifyResource({
 *   amount: NumberResolvers.fixed(3),
 *   ...
 * });
 *
 * // From action parameters
 * const effect = new ModifyResource({
 *   amount: NumberResolvers.fromParam('damageAmount'),
 *   ...
 * });
 * ```
 */
export const NumberResolvers = {
  /** Returns a fixed number */
  fixed: (value: number) => (_ctx: ActionContext) => value,

  /** Returns value from parameters */
  fromParam: (paramName: string) => (ctx: ActionContext) => ctx.parameters[paramName] ?? 0,

  /** Returns component value */
  fromComponent: <T>(
    componentName: ComponentName,
    entityResolver: EntityResolver,
    property: keyof T
  ) => (ctx: ActionContext) => {
    const entity = entityResolver(ctx);
    if (!entity) return 0;
    const comp = ctx.state.coordinator.getComponentFromEntity<T>(componentName, entity);
    if (!comp) return 0;
    const value = comp[property];
    return typeof value === 'number' ? value : 0;
  },

  /** Returns negative of another resolver (for subtraction) */
  negate: (resolver: NumberResolver | number) => (ctx: ActionContext) => {
    const value = typeof resolver === 'function' ? resolver(ctx) : resolver;
    return -value;
  },

  /** Adds multiple resolvers together */
  add: (...resolvers: (NumberResolver | number)[]) => (ctx: ActionContext) => {
    return resolvers.reduce((sum: number, r) => {
      const value = typeof r === 'function' ? r(ctx) : r;
      return sum + value;
    }, 0);
  },

  /** Multiplies multiple resolvers together */
  multiply: (...resolvers: (NumberResolver | number)[]) => (ctx: ActionContext) => {
    return resolvers.reduce((product: number, r) => {
      const value = typeof r === 'function' ? r(ctx) : r;
      return product * value;
    }, 1);
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves an entity from either a resolver function or a fixed entity.
 */
export function resolveEntity(
  resolver: EntityResolver | Entity,
  context: ActionContext
): Entity | null {
  if (typeof resolver === 'function') {
    return resolver(context);
  }
  return resolver;
}

/**
 * Resolves a number from either a resolver function or a fixed value.
 */
export function resolveNumber(
  resolver: NumberResolver | number,
  context: ActionContext
): number {
  if (typeof resolver === 'function') {
    return resolver(context);
  }
  return resolver;
}

/**
 * Resolves a value from either a resolver function or a fixed value.
 */
export function resolveValue<T>(
  resolver: ValueResolver<T> | T,
  context: ActionContext
): T {
  if (typeof resolver === 'function') {
    return (resolver as ValueResolver<T>)(context);
  }
  return resolver;
}
