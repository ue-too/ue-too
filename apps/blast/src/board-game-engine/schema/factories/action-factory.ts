/**
 * Action Factory
 *
 * Converts JSON action definitions into ActionDefinition instances.
 */

import { type Entity, type ComponentName, createGlobalComponentName } from '@ue-too/ecs';
import { ActionDefinition } from '../../action-system/action-definition';
import type { ActionDefinitionSchema, EntityQuery, ResolverContext } from '../types';
import { EffectFactory } from './effect-factory';
import { PreconditionFactory } from './precondition-factory';
import { ExpressionResolver } from '../expression-resolver';
import type { GameState } from '../../core/types';

/**
 * Factory for creating ActionDefinition instances from JSON definitions.
 */
export class ActionFactory {
  private effectFactory: EffectFactory;
  private preconditionFactory: PreconditionFactory;
  private resolver: ExpressionResolver;
  private componentNames: Map<string, ComponentName>;

  constructor(componentNames: Map<string, ComponentName> = new Map()) {
    this.componentNames = componentNames;
    this.effectFactory = new EffectFactory(componentNames);
    this.preconditionFactory = new PreconditionFactory(componentNames);
    this.resolver = new ExpressionResolver(componentNames);
  }

  /**
   * Get a component name symbol from a string name.
   */
  private getComponentName(name: string): ComponentName {
    const existing = this.componentNames.get(name);
    if (existing) return existing;
    const componentName = createGlobalComponentName(name);
    this.componentNames.set(name, componentName);
    return componentName;
  }

  /**
   * Create an ActionDefinition from a JSON definition.
   */
  createAction(definition: ActionDefinitionSchema): ActionDefinition {
    const preconditions = definition.preconditions
      ? this.preconditionFactory.createPreconditions(definition.preconditions)
      : [];

    const costs = definition.costs
      ? this.effectFactory.createEffects(definition.costs)
      : [];

    const effects = this.effectFactory.createEffects(definition.effects);

    return new ActionDefinition({
      name: definition.name,
      preconditions,
      costs,
      effects,
      targetSelector: this.createTargetSelector(definition),
      parameterGenerator: this.createParameterGenerator(definition),
      metadata: {
        displayName: definition.displayName ?? definition.name,
        description: definition.description,
        iconUrl: definition.iconUrl,
      },
    });
  }

  /**
   * Create multiple actions from definitions.
   */
  createActions(definitions: ActionDefinitionSchema[]): ActionDefinition[] {
    return definitions.map((def) => this.createAction(def));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createTargetSelector(
    definition: ActionDefinitionSchema
  ): (state: GameState, actor: Entity) => Entity[][] {
    const targeting = definition.targeting;

    // No targeting required
    if (!targeting || targeting.count === 0) {
      return () => [[]];
    }

    // Single target type with query
    if (targeting.types && targeting.types.length > 0) {
      return (state, actor) => {
        const results: Entity[][] = [];

        // For single target, find all valid entities
        if (typeof targeting.count === 'number' && targeting.count === 1) {
          const validEntities = this.findValidTargets(state, actor, targeting.types![0].query);
          for (const entity of validEntities) {
            results.push([entity]);
          }
          return results;
        }

        // For multiple targets with multiple types
        if (targeting.types!.length > 1) {
          // Each type generates one target slot
          const targetSets: Entity[][] = targeting.types!.map((type) =>
            this.findValidTargets(state, actor, type.query)
          );

          // Generate all combinations
          return this.generateCombinations(targetSets);
        }

        // Multiple targets of same type
        const validEntities = this.findValidTargets(state, actor, targeting.types![0].query);

        if (typeof targeting.count === 'number') {
          // Exact count
          return this.generateCombinationsOfSize(validEntities, targeting.count);
        }

        // Range
        const min = targeting.count?.min ?? 0;
        const max = targeting.count?.max ?? validEntities.length;

        for (let size = min; size <= max; size++) {
          results.push(...this.generateCombinationsOfSize(validEntities, size));
        }

        return results;
      };
    }

    // Simple validTargets query
    if (targeting.validTargets) {
      return (state, actor) => {
        const validEntities = this.findValidTargets(state, actor, targeting.validTargets!);

        if (typeof targeting.count === 'number') {
          return this.generateCombinationsOfSize(validEntities, targeting.count);
        }

        const min = targeting.count?.min ?? 0;
        const max = targeting.count?.max ?? validEntities.length;
        const results: Entity[][] = [];

        for (let size = min; size <= max; size++) {
          results.push(...this.generateCombinationsOfSize(validEntities, size));
        }

        return results;
      };
    }

    return () => [[]];
  }

  private createParameterGenerator(
    _definition: ActionDefinitionSchema
  ): () => Record<string, unknown>[] {
    // For now, actions don't have dynamic parameters from JSON
    // This could be extended later for more complex parameter generation
    return () => [{}];
  }

  private findValidTargets(
    state: GameState,
    actor: Entity,
    query: EntityQuery
  ): Entity[] {
    const results: Entity[] = [];
    const coordinator = state.coordinator;

    // Create resolver context for filter evaluation
    const baseContext: ResolverContext = {
      state: {
        coordinator,
        activePlayer: state.activePlayer,
        getAllPlayers: () => state.getAllPlayers(),
        getZone: (zoneName, owner) => state.getZone(zoneName, owner),
      },
      actor,
      targets: [],
      parameters: {},
    };

    // Determine which entities to check based on zone
    let candidateEntities: Entity[] = [];

    if (query.zone) {
      // Get entities from specific zone(s)
      const players = state.getAllPlayers();
      const owners: Entity[] = [];

      switch (query.owner) {
        case 'actor':
          owners.push(actor);
          break;
        case 'opponent':
          owners.push(...players.filter((p) => p !== actor));
          break;
        case 'any':
        default:
          owners.push(...players);
          break;
      }

      for (const owner of owners) {
        const zone = state.getZone(query.zone, owner);
        if (zone) {
          const deckComponent = coordinator.getComponentFromEntity(
            this.getComponentName('DeckList'),
            zone
          ) as { cached: { entities: Entity[] } } | null;

          if (deckComponent?.cached?.entities) {
            candidateEntities.push(...deckComponent.cached.entities);
          }
        }
      }
    } else {
      // Get all entities (expensive, should be avoided)
      candidateEntities = coordinator.getAllEntities();
    }

    // Filter by required components
    if (query.hasComponent && query.hasComponent.length > 0) {
      candidateEntities = candidateEntities.filter((entity) => {
        return query.hasComponent!.every((compName) => {
          const globalName = this.getComponentName(compName);
          try {
            const comp = coordinator.getComponentFromEntity(globalName, entity);
            return comp !== null && comp !== undefined;
          } catch {
            return false;
          }
        });
      });
    }

    // Apply filter condition
    if (query.filter) {
      candidateEntities = candidateEntities.filter((entity) => {
        const context: ResolverContext = {
          ...baseContext,
          candidate: entity,
        };
        return this.resolver.evaluateCondition(query.filter!, context);
      });
    }

    return candidateEntities;
  }

  private generateCombinations(sets: Entity[][]): Entity[][] {
    if (sets.length === 0) return [[]];
    if (sets.length === 1) return sets[0].map((e) => [e]);

    const results: Entity[][] = [];
    const [first, ...rest] = sets;
    const restCombinations = this.generateCombinations(rest);

    for (const entity of first) {
      for (const combo of restCombinations) {
        results.push([entity, ...combo]);
      }
    }

    return results;
  }

  private generateCombinationsOfSize(entities: Entity[], size: number): Entity[][] {
    if (size === 0) return [[]];
    if (size > entities.length) return [];
    if (size === entities.length) return [entities.slice()];

    const results: Entity[][] = [];

    const combine = (start: number, current: Entity[]) => {
      if (current.length === size) {
        results.push(current.slice());
        return;
      }

      for (let i = start; i < entities.length; i++) {
        current.push(entities[i]);
        combine(i + 1, current);
        current.pop();
      }
    };

    combine(0, []);
    return results;
  }
}
