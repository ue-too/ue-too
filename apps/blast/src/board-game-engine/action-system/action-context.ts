/**
 * ActionContext - Bridges actions and ECS operations.
 *
 * Provides convenient access to game state, resolved entities, and helper
 * methods for getting/setting components during action execution.
 */

import type { Entity, ComponentName } from '@ue-too/ecs';
import type { Action, ActionContext as IActionContext, GameState } from '../core/types';

/**
 * Implementation of ActionContext that bundles all information needed
 * during action validation and execution.
 *
 * @example
 * ```typescript
 * const context = new ActionContext(state, action, actorEntity, targetEntities, params);
 *
 * // Get component from entity
 * const health = context.getComponent<HealthComponent>(HEALTH_COMPONENT, entity);
 *
 * // Set component on entity
 * context.setComponent(HEALTH_COMPONENT, entity, { health: 10, maxHealth: 10 });
 * ```
 */
export class ActionContext implements IActionContext {
  constructor(
    public readonly state: GameState,
    public readonly action: Action,
    public readonly actor: Entity,
    public readonly targets: Entity[],
    public readonly parameters: Record<string, any>
  ) {}

  /**
   * Get a component from an entity.
   * Convenience wrapper around coordinator.getComponentFromEntity.
   *
   * @param name - Component name
   * @param entity - Entity to get component from
   * @returns Component data or null if not found
   */
  getComponent<T>(name: ComponentName, entity: Entity): T | null {
    return this.state.coordinator.getComponentFromEntity<T>(name, entity);
  }

  /**
   * Set a component on an entity.
   * Convenience wrapper around coordinator.addComponentToEntity.
   *
   * @param name - Component name
   * @param entity - Entity to set component on
   * @param data - Component data
   */
  setComponent<T>(name: ComponentName, entity: Entity, data: T): void {
    this.state.coordinator.addComponentToEntity<T>(name, entity, data);
  }

  /**
   * Remove a component from an entity.
   * Convenience wrapper around coordinator.removeComponentFromEntity.
   *
   * @param name - Component name
   * @param entity - Entity to remove component from
   */
  removeComponent<T>(name: ComponentName, entity: Entity): void {
    this.state.coordinator.removeComponentFromEntity<T>(name, entity);
  }

  /**
   * Get all entities.
   * Convenience wrapper around coordinator.getAllEntities.
   *
   * @returns Array of all entities
   */
  getAllEntities(): Entity[] {
    return this.state.coordinator.getAllEntities();
  }

  /**
   * Create a new entity.
   * Convenience wrapper around coordinator.createEntity.
   *
   * @returns New entity ID
   */
  createEntity(): Entity {
    return this.state.coordinator.createEntity();
  }

  /**
   * Destroy an entity.
   * Convenience wrapper around coordinator.destroyEntity.
   *
   * @param entity - Entity to destroy
   */
  destroyEntity(entity: Entity): void {
    this.state.coordinator.destroyEntity(entity);
  }
}
