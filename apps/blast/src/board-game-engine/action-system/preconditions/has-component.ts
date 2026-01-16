/**
 * HasComponent precondition - checks if an entity has a specific component.
 */

import { BasePrecondition } from './base';
import type { ActionContext } from '../../core/types';
import type { Entity, ComponentName } from '@ue-too/ecs';

/**
 * Target selector type for HasComponent precondition.
 */
export type TargetSelector = 'actor' | `target${number}`;

/**
 * Precondition that checks if a specified entity has a component.
 *
 * @example
 * ```typescript
 * // Check if actor has CardComponent
 * const precondition = new HasComponent(CARD_COMPONENT, 'actor');
 *
 * // Check if first target has HealthComponent
 * const precondition = new HasComponent(HEALTH_COMPONENT, 'target0');
 * ```
 */
export class HasComponent extends BasePrecondition {
  constructor(
    private componentType: ComponentName,
    private target: TargetSelector = 'actor'
  ) {
    super();
  }

  /**
   * Resolve the entity from the target selector.
   *
   * @param context - Action context
   * @returns The resolved entity
   */
  private resolveEntity(context: ActionContext): Entity | null {
    if (this.target === 'actor') {
      return context.actor;
    }
    // Parse target index (e.g., 'target0' -> 0)
    const match = this.target.match(/^target(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      return context.targets[index] ?? null;
    }
    return null;
  }

  check(context: ActionContext): boolean {
    const entity = this.resolveEntity(context);
    if (entity === null) return false;

    return context.getComponent(this.componentType, entity) !== null;
  }

  getErrorMessage(context: ActionContext): string {
    const entity = this.resolveEntity(context);
    return `Entity ${entity} (${this.target}) does not have required component`;
  }
}
