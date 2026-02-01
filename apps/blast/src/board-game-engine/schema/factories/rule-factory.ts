/**
 * Rule Factory
 *
 * Converts JSON rule definitions into Rule instances.
 */
import type { Entity } from '@ue-too/ecs';
import type { ComponentName } from '@ue-too/ecs';

import type { Condition, EventPattern, Rule } from '../../core/types';
import { ExpressionResolver } from '../expression-resolver';
import type {
    ConditionDefinition,
    EventPatternSchema,
    ResolverContext,
    RuleDefinitionSchema,
} from '../types';
import { EffectFactory } from './effect-factory';
import { PreconditionFactory } from './precondition-factory';

/**
 * Factory for creating Rule instances from JSON definitions.
 */
export class RuleFactory {
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
     * Create an EventPattern from a JSON definition.
     */
    private createEventPattern(def: EventPatternSchema): EventPattern {
        const filters: Record<string, any | ((value: any) => boolean)> = {};

        if (def.filters) {
            for (const [key, value] of Object.entries(def.filters)) {
                // If it's a function expression, we'll need to evaluate it at runtime
                // For now, treat all filters as value comparisons
                filters[key] = value;
            }
        }

        return {
            eventType: def.eventType,
            filters,
        };
    }

    /**
     * Convert ConditionDefinition to Condition.
     * Conditions in rules use the same structure as preconditions but evaluate in RuleContext.
     */
    private createCondition(def: ConditionDefinition): Condition {
        return {
            evaluate: (state, context) => {
                // Create a ResolverContext from RuleContext for condition evaluation
                const resolverContext: ResolverContext = {
                    state: {
                        coordinator: state.coordinator,
                        activePlayer: state.activePlayer,
                        getAllPlayers: () => state.getAllPlayers(),
                        getZone: (zoneName: string, owner: Entity | null) =>
                            state.getZone(zoneName, owner),
                    },
                    actor: (context.event.data.playerId as Entity) || null,
                    targets: [],
                    parameters: {},
                    event: {
                        type: context.event.type,
                        data: context.event.data,
                    },
                };

                // Use ExpressionResolver to evaluate the condition
                return this.resolver.evaluateCondition(def, resolverContext);
            },
        };
    }

    /**
     * Create a Rule from a JSON definition.
     */
    createRule(definition: RuleDefinitionSchema): Rule {
        const trigger = this.createEventPattern(definition.trigger);

        const conditions = definition.conditions
            ? definition.conditions.map(c => this.createCondition(c))
            : [];

        const effects = this.effectFactory.createEffects(definition.effects);

        // Resolve source entity if provided
        let source: Entity | null = null;
        if (definition.source) {
            // For now, we can't resolve entity expressions without a context
            // Rules with source entities will need to be resolved at runtime
            // This is a limitation - we'll need to handle this differently
            source = null; // TODO: Implement entity expression resolution for rule sources
        }

        return {
            id: definition.id,
            trigger,
            conditions,
            effects,
            priority: definition.priority ?? 100,
            source: source ?? null,
        };
    }

    /**
     * Create multiple rules from definitions.
     */
    createRules(definitions: RuleDefinitionSchema[]): Rule[] {
        return definitions.map(def => this.createRule(def));
    }
}
