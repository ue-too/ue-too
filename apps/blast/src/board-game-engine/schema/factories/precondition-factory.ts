/**
 * Precondition Factory
 *
 * Converts JSON condition definitions into Precondition instances.
 */

import { type Entity, type ComponentName, createGlobalComponentName } from '@ue-too/ecs';
import type { Precondition } from '../../core/types';
import { ActionContext } from '../../action-system/action-context';
import type { ConditionDefinition, ResolverContext } from '../types';
import { ExpressionResolver } from '../expression-resolver';
import {
  ResourceCheck,
  ZoneHasEntities,
  EntityInZone,
  ComponentValueCheck,
  OwnerCheck,
  TargetCount,
  EntityExists,
} from '../../action-system/preconditions/generic';
import { IsPlayerTurn } from '../../action-system/preconditions/is-player-turn';
import { PhaseCheck } from '../../action-system/preconditions/phase-check';
import {
  AndPrecondition,
  OrPrecondition,
  NotPrecondition,
  CustomPrecondition,
} from '../../action-system/preconditions/base';

/**
 * Factory for creating Precondition instances from JSON definitions.
 */
export class PreconditionFactory {
  private resolver: ExpressionResolver;
  private componentNames: Map<string, ComponentName>;

  constructor(componentNames: Map<string, ComponentName> = new Map()) {
    this.componentNames = componentNames;
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
   * Create a Precondition from a JSON condition definition.
   */
  createPrecondition(definition: ConditionDefinition): Precondition {
    switch (definition.type) {
      case 'isPlayerTurn':
        return new IsPlayerTurn();

      case 'phaseCheck':
        return new PhaseCheck(definition.phases);

      case 'resourceCheck':
        return this.createResourceCheck(definition);

      case 'entityInZone':
        return this.createEntityInZone(definition);

      case 'componentValueCheck':
        return this.createComponentValueCheck(definition);

      case 'ownerCheck':
        return this.createOwnerCheck(definition);

      case 'targetCount':
        return this.createTargetCount(definition);

      case 'entityExists':
        return this.createEntityExists(definition);

      case 'zoneHasEntities':
        return this.createZoneHasEntities(definition);

      case 'hasComponent':
        return this.createHasComponent(definition);

      case 'and':
        return new AndPrecondition(
          definition.conditions.map((c) => this.createPrecondition(c))
        );

      case 'or':
        return new OrPrecondition(
          definition.conditions.map((c) => this.createPrecondition(c))
        );

      case 'not':
        return new NotPrecondition(this.createPrecondition(definition.condition));

      default:
        throw new Error(`Unknown condition type: ${(definition as ConditionDefinition).type}`);
    }
  }

  /**
   * Create multiple preconditions from definitions.
   */
  createPreconditions(definitions: ConditionDefinition[]): Precondition[] {
    return definitions.map((def) => this.createPrecondition(def));
  }

  // ============================================================================
  // Private Factory Methods
  // ============================================================================

  private createResourceCheck(
    def: Extract<ConditionDefinition, { type: 'resourceCheck' }>
  ): Precondition {
    const componentName = this.getComponentName(def.component);

    return new ResourceCheck({
      entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
      componentName,
      property: def.property,
      operator: def.operator as '>=' | '>' | '<=' | '<' | '==' | '!=',
      value: (ctx: ActionContext) => this.resolveNumberFromContext(def.value, ctx),
      errorMessage: def.errorMessage,
    });
  }

  private createEntityInZone(
    def: Extract<ConditionDefinition, { type: 'entityInZone' }>
  ): Precondition {
    const locationComponent = this.getComponentName('Location');
    const zones = Array.isArray(def.zone) ? def.zone : [def.zone];

    return new EntityInZone({
      entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
      zone: zones.map((z) => (ctx: ActionContext) => this.resolveZoneFromContext(z, ctx)),
      locationComponent,
      errorMessage: def.errorMessage,
    });
  }

  private createComponentValueCheck(
    def: Extract<ConditionDefinition, { type: 'componentValueCheck' }>
  ): Precondition {
    const componentName = this.getComponentName(def.component);

    if (def.operator) {
      // Use predicate mode for operators
      return new ComponentValueCheck({
        entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
        componentName,
        property: def.property,
        value: (currentValue: unknown, ctx: ActionContext) => {
          const expectedValue = this.resolveValueFromContext(def.value, ctx);
          return this.compareValues(currentValue, def.operator!, expectedValue);
        },
        errorMessage: def.errorMessage,
      });
    }

    return new ComponentValueCheck({
      entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
      componentName,
      property: def.property,
      value: (currentValue: unknown, ctx: ActionContext) => {
        const expectedValue = this.resolveValueFromContext(def.value, ctx);
        return currentValue === expectedValue;
      },
      errorMessage: def.errorMessage,
    });
  }

  private createOwnerCheck(
    def: Extract<ConditionDefinition, { type: 'ownerCheck' }>
  ): Precondition {
    const ownerComponent = this.getComponentName('Owner');

    return new OwnerCheck({
      entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
      expectedOwner: (ctx: ActionContext) => this.resolveEntityFromContext(def.expectedOwner, ctx),
      ownerComponent,
      ownerProperty: 'owner',
      invert: def.invert,
      errorMessage: def.errorMessage,
    });
  }

  private createTargetCount(
    def: Extract<ConditionDefinition, { type: 'targetCount' }>
  ): Precondition {
    return new TargetCount({
      exact: def.exact,
      min: def.min,
      max: def.max,
      errorMessage: def.errorMessage,
    });
  }

  private createEntityExists(
    def: Extract<ConditionDefinition, { type: 'entityExists' }>
  ): Precondition {
    const requiredComponent = def.requiredComponent
      ? this.getComponentName(def.requiredComponent)
      : undefined;

    return new EntityExists({
      entity: (ctx: ActionContext) => this.resolveEntityFromContext(def.entity, ctx),
      requiredComponent,
      errorMessage: def.errorMessage,
    });
  }

  private createZoneHasEntities(
    def: Extract<ConditionDefinition, { type: 'zoneHasEntities' }>
  ): Precondition {
    const zoneListComponent = this.getComponentName('DeckList');

    return new ZoneHasEntities({
      zone: (ctx: ActionContext) => this.resolveZoneFromContext(def.zone, ctx),
      zoneListComponent,
      minCount: def.minCount,
      maxCount: def.maxCount,
      filter: def.filter
        ? (entity: Entity, ctx: ActionContext) => {
            const resolverContext = this.actionContextToResolverContext(ctx, entity);
            return this.resolver.evaluateCondition(def.filter!, resolverContext);
          }
        : undefined,
      errorMessage: def.errorMessage,
    });
  }

  private createHasComponent(
    def: Extract<ConditionDefinition, { type: 'hasComponent' }>
  ): Precondition {
    const componentName = this.getComponentName(def.component);

    return new CustomPrecondition(
      (ctx: ActionContext) => {
        const entity = this.resolveEntityFromContext(def.entity, ctx);
        if (entity === null) return false;
        const component = ctx.getComponent(componentName, entity);
        return component !== null && component !== undefined;
      },
      def.errorMessage ?? `Entity must have ${def.component} component`
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private resolveEntityFromContext(expr: string, ctx: ActionContext): Entity | null {
    const resolverContext = this.actionContextToResolverContext(ctx);
    return this.resolver.resolveEntity(expr, resolverContext);
  }

  private resolveZoneFromContext(expr: string, ctx: ActionContext): Entity | null {
    const resolverContext = this.actionContextToResolverContext(ctx);
    return this.resolver.resolveZone(expr, resolverContext);
  }

  private resolveNumberFromContext(expr: number | string, ctx: ActionContext): number {
    const resolverContext = this.actionContextToResolverContext(ctx);
    return this.resolver.resolveNumber(expr, resolverContext);
  }

  private resolveValueFromContext(expr: unknown, ctx: ActionContext): unknown {
    const resolverContext = this.actionContextToResolverContext(ctx);
    return this.resolver.resolveValue(expr, resolverContext);
  }

  private actionContextToResolverContext(
    ctx: ActionContext,
    candidate?: Entity
  ): ResolverContext {
    return {
      state: {
        coordinator: ctx.state.coordinator,
        activePlayer: ctx.state.activePlayer,
        getAllPlayers: () => ctx.state.getAllPlayers(),
        getZone: (zoneName: string, owner: Entity | null) =>
          ctx.state.getZone(zoneName, owner),
      },
      actor: ctx.actor,
      targets: ctx.targets,
      parameters: ctx.parameters,
      candidate,
    };
  }

  private compareValues(
    actual: unknown,
    operator: string,
    expected: unknown
  ): boolean {
    switch (operator) {
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case '>=':
        return (actual as number) >= (expected as number);
      case '>':
        return (actual as number) > (expected as number);
      case '<=':
        return (actual as number) <= (expected as number);
      case '<':
        return (actual as number) < (expected as number);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }
}
