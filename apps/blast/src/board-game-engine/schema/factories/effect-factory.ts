/**
 * Effect Factory
 *
 * Converts JSON effect definitions into Effect instances.
 */
import {
    type ComponentName,
    type Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

import { ActionContext } from '../../action-system/action-context';
import { CompositeEffect, CustomEffect } from '../../action-system/effects';
import { CheckTicTacToeWin } from '../../action-system/effects/check-tic-tac-toe-win';
import { EmitEvent } from '../../action-system/effects/emit-event';
import {
    ConditionalEffect,
    CreateEntity,
    DestroyEntity,
    ModifyResource,
    MoveEntity,
    RepeatEffect,
    SetComponentValue,
    ShuffleZone,
    TransferMultiple,
} from '../../action-system/effects/generic';
import { SwitchActivePlayer } from '../../action-system/effects/switch-active-player';
import type { Effect } from '../../core/types';
import { ExpressionResolver } from '../expression-resolver';
import type {
    CheckTicTacToeWinEffectDefinition,
    CompositeEffectDefinition,
    ConditionalEffectDefinition,
    CreateEntityEffectDefinition,
    DestroyEntityEffectDefinition,
    EffectDefinition,
    EmitEventEffectDefinition,
    ModifyResourceEffectDefinition,
    MoveEntityEffectDefinition,
    RepeatEffectDefinition,
    ResolverContext,
    SetComponentValueEffectDefinition,
    ShuffleZoneEffectDefinition,
    TransferMultipleEffectDefinition,
} from '../types';

/**
 * Factory for creating Effect instances from JSON definitions.
 */
export class EffectFactory {
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
     * Create an Effect from a JSON definition.
     */
    createEffect(definition: EffectDefinition): Effect {
        switch (definition.type) {
            case 'moveEntity':
                return this.createMoveEntityEffect(definition);

            case 'modifyResource':
                return this.createModifyResourceEffect(definition);

            case 'setComponentValue':
                return this.createSetComponentValueEffect(definition);

            case 'createEntity':
                return this.createCreateEntityEffect(definition);

            case 'destroyEntity':
                return this.createDestroyEntityEffect(definition);

            case 'shuffleZone':
                return this.createShuffleZoneEffect(definition);

            case 'transferMultiple':
                return this.createTransferMultipleEffect(definition);

            case 'conditional':
                return this.createConditionalEffect(definition);

            case 'repeat':
                return this.createRepeatEffect(definition);

            case 'emitEvent':
                return this.createEmitEventEffect(definition);

            case 'composite':
                return this.createCompositeEffect(definition);

            case 'switchActivePlayer':
                return new SwitchActivePlayer();

            case 'checkTicTacToeWin': {
                const checkWinDef =
                    definition as CheckTicTacToeWinEffectDefinition;
                return new CheckTicTacToeWin();
            }

            default:
                throw new Error(
                    `Unknown effect type: ${(definition as EffectDefinition).type}`
                );
        }
    }

    /**
     * Create multiple effects from definitions.
     */
    createEffects(definitions: EffectDefinition[]): Effect[] {
        return definitions.map(def => this.createEffect(def));
    }

    // ============================================================================
    // Private Factory Methods
    // ============================================================================

    private createMoveEntityEffect(def: MoveEntityEffectDefinition): Effect {
        const locationComponent = this.getComponentName('Location');
        const zoneListComponent = this.getComponentName('DeckList');

        return new MoveEntity({
            entity: (ctx: ActionContext) =>
                this.resolveEntityFromContext(def.entity, ctx),
            fromZone: def.fromZone
                ? (ctx: ActionContext) =>
                      this.resolveZoneFromContext(def.fromZone!, ctx)
                : undefined,
            toZone: (ctx: ActionContext) =>
                this.resolveZoneFromContext(def.toZone, ctx),
            locationComponent,
            zoneListComponent,
            eventType: def.eventType,
        });
    }

    private createModifyResourceEffect(
        def: ModifyResourceEffectDefinition
    ): Effect {
        const componentName = this.getComponentName(def.component);

        return new ModifyResource({
            entity: (ctx: ActionContext) =>
                this.resolveEntityFromContext(def.entity, ctx),
            componentName,
            property: def.property,
            amount: (ctx: ActionContext) =>
                this.resolveNumberFromContext(def.amount, ctx),
            min: def.min,
            max: def.max,
            maxProperty: def.maxProperty,
            eventType: def.eventType,
        });
    }

    private createSetComponentValueEffect(
        def: SetComponentValueEffectDefinition
    ): Effect {
        const componentName = this.getComponentName(def.component);

        // Handle both single property and multiple values
        if (def.values) {
            // Create a custom effect that sets multiple values
            return new CustomEffect((ctx: ActionContext) => {
                const entity = this.resolveEntityFromContext(def.entity, ctx);
                if (entity === null) return;

                const component = ctx.getComponent(componentName, entity);
                if (!component && !def.createIfMissing) return;

                const targetComponent = component ?? {};
                for (const [key, value] of Object.entries(def.values!)) {
                    (targetComponent as Record<string, unknown>)[key] =
                        this.resolveValueFromContext(value, ctx);
                }

                if (!component && def.createIfMissing) {
                    ctx.setComponent(componentName, entity, targetComponent);
                }
            });
        }

        return new SetComponentValue({
            entity: (ctx: ActionContext) =>
                this.resolveEntityFromContext(def.entity, ctx),
            componentName,
            property: def.property!,
            value: (ctx: ActionContext) =>
                this.resolveValueFromContext(def.value, ctx),
            eventType: def.eventType,
        });
    }

    private createCreateEntityEffect(
        def: CreateEntityEffectDefinition
    ): Effect {
        const locationComponent = this.getComponentName('Location');
        const zoneListComponent = this.getComponentName('DeckList');

        // Build component data
        const components: Array<{
            name: ComponentName;
            data: (ctx: ActionContext) => Record<string, unknown>;
        }> = [];

        if (def.components) {
            for (const [name, data] of Object.entries(def.components)) {
                const compName = this.getComponentName(name);
                components.push({
                    name: compName,
                    data: (ctx: ActionContext) => {
                        const resolved: Record<string, unknown> = {};
                        for (const [key, value] of Object.entries(data)) {
                            resolved[key] = this.resolveValueFromContext(
                                value,
                                ctx
                            );
                        }
                        return resolved;
                    },
                });
            }
        }

        return new CreateEntity({
            components,
            zone: def.zone
                ? (ctx: ActionContext) =>
                      this.resolveZoneFromContext(def.zone!, ctx)
                : undefined,
            locationComponent,
            zoneListComponent,
            storeAs: def.storeAs,
            eventType: def.eventType,
        });
    }

    private createDestroyEntityEffect(
        def: DestroyEntityEffectDefinition
    ): Effect {
        const locationComponent = this.getComponentName('Location');
        const zoneListComponent = this.getComponentName('DeckList');

        return new DestroyEntity({
            entity: (ctx: ActionContext) =>
                this.resolveEntityFromContext(def.entity, ctx),
            discardZone: def.discardZone
                ? (ctx: ActionContext) =>
                      this.resolveZoneFromContext(def.discardZone!, ctx)
                : undefined,
            locationComponent,
            zoneListComponent,
            eventType: def.eventType,
        });
    }

    private createShuffleZoneEffect(def: ShuffleZoneEffectDefinition): Effect {
        const zoneListComponent = this.getComponentName('DeckList');

        return new ShuffleZone({
            zone: (ctx: ActionContext) =>
                this.resolveZoneFromContext(def.zone, ctx),
            zoneListComponent,
            eventType: def.eventType,
        });
    }

    private createTransferMultipleEffect(
        def: TransferMultipleEffectDefinition
    ): Effect {
        const locationComponent = this.getComponentName('Location');
        const zoneListComponent = this.getComponentName('DeckList');

        return new TransferMultiple({
            fromZone: (ctx: ActionContext) =>
                this.resolveZoneFromContext(def.fromZone, ctx),
            toZone: (ctx: ActionContext) =>
                this.resolveZoneFromContext(def.toZone, ctx),
            count: (ctx: ActionContext) =>
                this.resolveNumberFromContext(def.count, ctx),
            selection: def.selection,
            locationComponent,
            zoneListComponent,
            filter: def.filter
                ? (entity: Entity, ctx: ActionContext) => {
                      const resolverContext =
                          this.actionContextToResolverContext(ctx, entity);
                      return this.resolver.evaluateCondition(
                          def.filter!,
                          resolverContext
                      );
                  }
                : undefined,
            eventType: def.eventType,
        });
    }

    private createConditionalEffect(def: ConditionalEffectDefinition): Effect {
        const thenEffects = this.createEffects(def.then);
        const elseEffects = def.else ? this.createEffects(def.else) : undefined;

        return new ConditionalEffect({
            condition: (ctx: ActionContext) => {
                const resolverContext =
                    this.actionContextToResolverContext(ctx);
                return this.resolver.evaluateCondition(
                    def.condition,
                    resolverContext
                );
            },
            thenEffect:
                thenEffects.length === 1
                    ? thenEffects[0]
                    : new CompositeEffect(thenEffects),
            elseEffect: elseEffects
                ? elseEffects.length === 1
                    ? elseEffects[0]
                    : new CompositeEffect(elseEffects)
                : undefined,
        });
    }

    private createRepeatEffect(def: RepeatEffectDefinition): Effect {
        let effect: Effect;
        if (def.effect) {
            effect = this.createEffect(def.effect);
        } else if (def.effects) {
            effect = new CompositeEffect(this.createEffects(def.effects));
        } else {
            throw new Error('RepeatEffect requires either effect or effects');
        }

        return new RepeatEffect({
            effect,
            times: (ctx: ActionContext) =>
                this.resolveNumberFromContext(def.times, ctx),
        });
    }

    private createEmitEventEffect(def: EmitEventEffectDefinition): Effect {
        return new EmitEvent(def.eventType, (ctx: ActionContext) => {
            const data: Record<string, unknown> = {};
            if (def.data) {
                for (const [key, value] of Object.entries(def.data)) {
                    data[key] = this.resolveValueFromContext(value, ctx);
                }
            }
            return data;
        });
    }

    private createCompositeEffect(def: CompositeEffectDefinition): Effect {
        return new CompositeEffect(this.createEffects(def.effects));
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private resolveEntityFromContext(
        expr: string,
        ctx: ActionContext
    ): Entity | null {
        const resolverContext = this.actionContextToResolverContext(ctx);
        return this.resolver.resolveEntity(expr, resolverContext);
    }

    private resolveZoneFromContext(
        expr: string,
        ctx: ActionContext
    ): Entity | null {
        const resolverContext = this.actionContextToResolverContext(ctx);
        return this.resolver.resolveZone(expr, resolverContext);
    }

    private resolveNumberFromContext(
        expr: number | string,
        ctx: ActionContext
    ): number {
        const resolverContext = this.actionContextToResolverContext(ctx);
        return this.resolver.resolveNumber(expr, resolverContext);
    }

    private resolveValueFromContext(
        expr: unknown,
        ctx: ActionContext
    ): unknown {
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
}
