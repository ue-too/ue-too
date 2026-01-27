/**
 * Expression Resolver for JSON Schema DSL
 *
 * Parses and resolves string-based expressions at runtime.
 * Expressions use a $ prefix to indicate dynamic resolution.
 *
 * Entity expressions: $actor, $target, $target.0, $param.cardId, $zone.actor.hand
 * Number expressions: $param.damage, $component.$target.Card.cost, $negate(...), $add(...), $multiply(...)
 * Value expressions: $param.value, $component.$entity.Component.property
 */
import {
    type ComponentName,
    type Coordinator,
    type Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

import { DECK_COMPONENT, ZONE_COMPONENT } from '../core/game-state';
import type {
    ConditionDefinition,
    EntityExpression,
    NumberExpression,
    ResolverContext,
    ValueExpression,
    ZoneExpression,
} from './types';

/**
 * Resolves string-based expressions from JSON game definitions.
 */
export class ExpressionResolver {
    private componentNames: Map<string, ComponentName>;

    constructor(componentNames: Map<string, ComponentName> = new Map()) {
        this.componentNames = componentNames;
    }

    /**
     * Get a component name symbol from a string name.
     * Looks up in the registered map, or creates a global component name.
     */
    getComponentName(name: string): ComponentName {
        const existing = this.componentNames.get(name);
        if (existing) return existing;
        // Create and cache the component name
        const componentName = createGlobalComponentName(name);
        this.componentNames.set(name, componentName);
        return componentName;
    }

    /**
     * Resolve an entity expression to an Entity.
     */
    resolveEntity(
        expr: EntityExpression | Entity,
        context: ResolverContext
    ): Entity | null {
        // If it's already an entity (number), return it
        if (typeof expr === 'number') {
            return expr as Entity;
        }

        // If not a string, return null
        if (typeof expr !== 'string') {
            return null;
        }

        // If doesn't start with $, it's a fixed entity ID
        if (!expr.startsWith('$')) {
            const parsed = parseInt(expr, 10);
            return isNaN(parsed) ? null : (parsed as Entity);
        }

        // Parse the expression
        const parts = expr.substring(1).split('.');

        switch (parts[0]) {
            case 'actor':
                return context.actor;

            case 'target':
                if (parts.length === 1) {
                    return context.targets[0] ?? null;
                }
                const targetIndex = parseInt(parts[1], 10);
                return context.targets[targetIndex] ?? null;

            case 'param':
                if (parts.length < 2) return null;
                const paramValue = context.parameters[parts[1]];
                return typeof paramValue === 'number'
                    ? (paramValue as Entity)
                    : null;

            case 'activePlayer':
                return context.state.activePlayer;

            case 'opponent':
                // Get opponent (player that is not the actor)
                const players = context.state.getAllPlayers();
                return players.find(p => p !== context.actor) ?? null;

            case 'candidate':
                // Used in filter contexts
                return context.candidate ?? null;

            case 'eachPlayer':
                // Used in setup effects
                return context.eachPlayer ?? null;

            case 'context':
                // Get from effect context (e.g., $context.createdEntity)
                if (parts.length < 2 || !context.effectContext) return null;
                const ctxValue = context.effectContext[parts[1]];
                return typeof ctxValue === 'number'
                    ? (ctxValue as Entity)
                    : null;

            case 'event':
                // Get from event data
                if (parts.length < 2 || !context.event) return null;
                const eventValue = context.event.data[parts[1]];
                return typeof eventValue === 'number'
                    ? (eventValue as Entity)
                    : null;

            case 'zone':
                // Zone expression - returns the zone entity
                return this.resolveZone(expr, context);

            case 'component':
                // $component.$entity.Component.property - returns the property value if it's an entity
                return this.resolveComponentValue(
                    parts.slice(1),
                    context
                ) as Entity | null;

            default:
                return null;
        }
    }

    /**
     * Resolve a zone expression to a zone Entity.
     * Format: $zone.owner.zoneName
     * Owner: actor, opponent, target, shared, $param.xxx, $fixed.xxx
     *
     * @remarks
     * - `$zone.actor.hand` - The actor's hand
     * - `$zone.opponent.board` - The opponent's board
     * - `$zone.shared.marketplace` - A shared zone (owner = null)
     */
    resolveZone(
        expr: ZoneExpression | Entity,
        context: ResolverContext
    ): Entity | null {
        if (typeof expr === 'number') {
            return expr as Entity;
        }

        if (typeof expr !== 'string' || !expr.startsWith('$zone.')) {
            return null;
        }

        const parts = expr.substring(6).split('.'); // Remove '$zone.'
        if (parts.length < 2) return null;

        const ownerPart = parts[0];
        const zoneName = parts[1];

        // Special case: shared zones have no owner (owner = null)
        if (ownerPart === 'shared') {
            return context.state.getZone(zoneName, null);
        }

        let owner: Entity | null = null;

        // Resolve owner
        if (ownerPart === 'actor') {
            owner = context.actor;
        } else if (ownerPart === 'opponent') {
            const players = context.state.getAllPlayers();
            owner = players.find(p => p !== context.actor) ?? null;
        } else if (ownerPart === 'target') {
            owner = context.targets[0] ?? null;
        } else if (ownerPart === '$eachPlayer') {
            owner = context.eachPlayer ?? null;
        } else if (ownerPart.startsWith('$param')) {
            const paramName = ownerPart.substring(7); // Remove '$param.'
            const paramValue = context.parameters[paramName];
            owner =
                typeof paramValue === 'number' ? (paramValue as Entity) : null;
        } else if (ownerPart.startsWith('$component')) {
            // Nested component resolution for owner
            owner = this.resolveEntity('$' + ownerPart.substring(1), context);
        }

        if (owner === null) return null;

        // Find the zone
        return context.state.getZone(zoneName, owner);
    }

    /**
     * Resolve a number expression to a number.
     */
    resolveNumber(expr: NumberExpression, context: ResolverContext): number {
        // If already a number, return it
        if (typeof expr === 'number') {
            return expr;
        }

        // If not a string, return 0
        if (typeof expr !== 'string') {
            return 0;
        }

        // If doesn't start with $, try parsing as number
        if (!expr.startsWith('$')) {
            const parsed = parseFloat(expr);
            return isNaN(parsed) ? 0 : parsed;
        }

        // Check for function expressions
        if (expr.startsWith('$negate(')) {
            const inner = this.extractFunctionArg(expr, '$negate(');
            return -this.resolveNumber(inner, context);
        }

        if (expr.startsWith('$add(')) {
            const args = this.extractFunctionArgs(expr, '$add(');
            return args.reduce(
                (sum, arg) => sum + this.resolveNumber(arg.trim(), context),
                0
            );
        }

        if (expr.startsWith('$multiply(')) {
            const args = this.extractFunctionArgs(expr, '$multiply(');
            return args.reduce(
                (product, arg) =>
                    product * this.resolveNumber(arg.trim(), context),
                1
            );
        }

        if (expr.startsWith('$count(')) {
            const inner = this.extractFunctionArg(expr, '$count(');
            return this.resolveCount(inner, context);
        }

        // Parse non-function expressions
        const parts = expr.substring(1).split('.');

        switch (parts[0]) {
            case 'param':
                if (parts.length < 2) return 0;
                const paramValue = context.parameters[parts[1]];
                return typeof paramValue === 'number' ? paramValue : 0;

            case 'component':
                const value = this.resolveComponentValue(
                    parts.slice(1),
                    context
                );
                return typeof value === 'number' ? value : 0;

            case 'event':
                if (parts.length < 2 || !context.event) return 0;
                const eventValue = context.event.data[parts[1]];
                return typeof eventValue === 'number' ? eventValue : 0;

            default:
                return 0;
        }
    }

    /**
     * Resolve a generic value expression.
     */
    resolveValue<T>(expr: ValueExpression<T>, context: ResolverContext): T {
        // If not a string, return as-is
        if (typeof expr !== 'string') {
            return expr as T;
        }

        // If doesn't start with $, return as-is (literal string)
        if (!expr.startsWith('$')) {
            return expr as unknown as T;
        }

        const parts = expr.substring(1).split('.');

        switch (parts[0]) {
            case 'param':
                if (parts.length < 2) return expr as unknown as T;
                return context.parameters[parts[1]] as T;

            case 'component':
                return this.resolveComponentValue(parts.slice(1), context) as T;

            case 'actor':
                return context.actor as unknown as T;

            case 'target':
                if (parts.length === 1) {
                    return (context.targets[0] ?? null) as unknown as T;
                }
                const targetIndex = parseInt(parts[1], 10);
                return (context.targets[targetIndex] ?? null) as unknown as T;

            case 'activePlayer':
                return context.state.activePlayer as unknown as T;

            case 'event':
                if (parts.length < 2 || !context.event)
                    return expr as unknown as T;
                return context.event.data[parts[1]] as T;

            case 'context':
                if (parts.length < 2 || !context.effectContext)
                    return expr as unknown as T;
                return context.effectContext[parts[1]] as T;

            default:
                return expr as unknown as T;
        }
    }

    /**
     * Evaluate a condition definition.
     */
    evaluateCondition(
        condition: ConditionDefinition,
        context: ResolverContext
    ): boolean {
        switch (condition.type) {
            case 'isPlayerTurn':
                return (
                    context.actor !== null &&
                    context.actor === context.state.activePlayer
                );

            case 'phaseCheck':
                // Need to get current phase from game state
                // This requires access to GameState which has getCurrentPhase()
                // For now, we'll need to pass this in context or handle it differently
                return true; // Placeholder - needs game state integration

            case 'resourceCheck':
                return this.evaluateResourceCheck(condition, context);

            case 'entityInZone':
                return this.evaluateEntityInZone(condition, context);

            case 'componentValueCheck':
                return this.evaluateComponentValueCheck(condition, context);

            case 'ownerCheck':
                return this.evaluateOwnerCheck(condition, context);

            case 'targetCount':
                return this.evaluateTargetCount(condition, context);

            case 'entityExists':
                return this.evaluateEntityExists(condition, context);

            case 'zoneHasEntities':
                return this.evaluateZoneHasEntities(condition, context);

            case 'hasComponent':
                return this.evaluateHasComponent(condition, context);

            case 'and':
                return condition.conditions.every(c =>
                    this.evaluateCondition(c, context)
                );

            case 'or':
                return condition.conditions.some(c =>
                    this.evaluateCondition(c, context)
                );

            case 'not':
                return !this.evaluateCondition(condition.condition, context);

            default:
                return false;
        }
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private resolveComponentValue(
        parts: string[],
        context: ResolverContext
    ): unknown {
        // parts: [$entity, ComponentName, property, ...] where $entity may already have $ prefix
        if (parts.length < 3) return null;

        // Only add $ if not already present
        const entityExpr = parts[0].startsWith('$') ? parts[0] : '$' + parts[0];
        const componentName = parts[1];
        const propertyPath = parts.slice(2);

        const entity = this.resolveEntity(entityExpr, context);
        if (entity === null) return null;

        const coordinator = context.state.coordinator as Coordinator;
        const globalComponentName = this.getComponentName(componentName);

        try {
            const component = coordinator.getComponentFromEntity(
                globalComponentName,
                entity
            );
            if (!component) return null;

            // Navigate property path
            let value: unknown = component;
            for (const prop of propertyPath) {
                if (value === null || value === undefined) return null;
                value = (value as Record<string, unknown>)[prop];
            }
            return value;
        } catch {
            return null;
        }
    }

    private extractFunctionArg(expr: string, prefix: string): string {
        // Extract content between prefix and closing )
        const start = prefix.length;
        const end = expr.lastIndexOf(')');
        return expr.substring(start, end);
    }

    private extractFunctionArgs(expr: string, prefix: string): string[] {
        const inner = this.extractFunctionArg(expr, prefix);
        // Simple comma split - doesn't handle nested functions
        // For nested functions, we'd need proper parsing
        return inner.split(',').map(s => s.trim());
    }

    private resolveCount(zoneExpr: string, context: ResolverContext): number {
        const zone = this.resolveZone(zoneExpr, context);
        if (zone === null) return 0;

        const coordinator = context.state.coordinator as Coordinator;
        try {
            const deckComponent = coordinator.getComponentFromEntity(
                DECK_COMPONENT,
                zone
            ) as { cached: { entities: Entity[] } } | null;
            return deckComponent?.cached?.entities?.length ?? 0;
        } catch {
            return 0;
        }
    }

    private evaluateResourceCheck(
        condition: Extract<ConditionDefinition, { type: 'resourceCheck' }>,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        if (entity === null) return false;

        const coordinator = context.state.coordinator as Coordinator;
        const globalComponentName = this.getComponentName(condition.component);

        try {
            const component = coordinator.getComponentFromEntity(
                globalComponentName,
                entity
            ) as Record<string, unknown> | null;
            if (!component) return false;

            const actualValue = component[condition.property];
            if (typeof actualValue !== 'number') return false;

            const expectedValue = this.resolveNumber(condition.value, context);

            return this.compareValues(
                actualValue,
                condition.operator,
                expectedValue
            );
        } catch {
            return false;
        }
    }

    private evaluateEntityInZone(
        condition: Extract<ConditionDefinition, { type: 'entityInZone' }>,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        if (entity === null) return false;

        const coordinator = context.state.coordinator as Coordinator;
        const locationComponentName = this.getComponentName('Location');

        try {
            const location = coordinator.getComponentFromEntity(
                locationComponentName,
                entity
            ) as {
                location: Entity;
            } | null;
            if (!location) return false;

            const zones = Array.isArray(condition.zone)
                ? condition.zone
                : [condition.zone];
            return zones.some(zoneExpr => {
                const zone = this.resolveZone(zoneExpr, context);
                return zone !== null && location.location === zone;
            });
        } catch {
            return false;
        }
    }

    private evaluateComponentValueCheck(
        condition: Extract<
            ConditionDefinition,
            { type: 'componentValueCheck' }
        >,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        if (entity === null) return false;

        const coordinator = context.state.coordinator as Coordinator;
        const globalComponentName = this.getComponentName(condition.component);

        try {
            const component = coordinator.getComponentFromEntity(
                globalComponentName,
                entity
            ) as Record<string, unknown> | null;
            if (!component) return false;

            const actualValue = component[condition.property];
            const expectedValue = this.resolveValue(condition.value, context);

            if (condition.operator) {
                return this.compareValues(
                    actualValue,
                    condition.operator,
                    expectedValue
                );
            }

            return actualValue === expectedValue;
        } catch {
            return false;
        }
    }

    private evaluateOwnerCheck(
        condition: Extract<ConditionDefinition, { type: 'ownerCheck' }>,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        const expectedOwner = this.resolveEntity(
            condition.expectedOwner,
            context
        );
        if (entity === null || expectedOwner === null) return false;

        const coordinator = context.state.coordinator as Coordinator;
        const ownerComponentName = this.getComponentName('Owner');

        try {
            const ownerComp = coordinator.getComponentFromEntity(
                ownerComponentName,
                entity
            ) as {
                owner: Entity;
            } | null;
            if (!ownerComp) return false;

            const matches = ownerComp.owner === expectedOwner;
            return condition.invert ? !matches : matches;
        } catch {
            return false;
        }
    }

    private evaluateTargetCount(
        condition: Extract<ConditionDefinition, { type: 'targetCount' }>,
        context: ResolverContext
    ): boolean {
        const count = context.targets.length;

        if (condition.exact !== undefined) {
            return count === condition.exact;
        }

        if (condition.min !== undefined && count < condition.min) {
            return false;
        }

        if (condition.max !== undefined && count > condition.max) {
            return false;
        }

        return true;
    }

    private evaluateEntityExists(
        condition: Extract<ConditionDefinition, { type: 'entityExists' }>,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        if (entity === null) return false;

        if (condition.requiredComponent) {
            const coordinator = context.state.coordinator as Coordinator;
            const globalComponentName = this.getComponentName(
                condition.requiredComponent
            );

            try {
                const component = coordinator.getComponentFromEntity(
                    globalComponentName,
                    entity
                );
                return component !== null && component !== undefined;
            } catch {
                return false;
            }
        }

        return true;
    }

    private evaluateZoneHasEntities(
        condition: Extract<ConditionDefinition, { type: 'zoneHasEntities' }>,
        context: ResolverContext
    ): boolean {
        const zone = this.resolveZone(condition.zone, context);
        if (zone === null) return false;

        const coordinator = context.state.coordinator as Coordinator;

        try {
            const deckComponent = coordinator.getComponentFromEntity(
                DECK_COMPONENT,
                zone
            ) as { cached: { entities: Entity[] } } | null;
            if (!deckComponent?.cached?.entities) return false;

            let entities = deckComponent.cached.entities;

            // Apply filter if present
            if (condition.filter) {
                entities = entities.filter(entity => {
                    const filterContext = { ...context, candidate: entity };
                    return this.evaluateCondition(
                        condition.filter!,
                        filterContext
                    );
                });
            }

            const count = entities.length;

            if (
                condition.minCount !== undefined &&
                count < condition.minCount
            ) {
                return false;
            }

            if (
                condition.maxCount !== undefined &&
                count > condition.maxCount
            ) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    private evaluateHasComponent(
        condition: Extract<ConditionDefinition, { type: 'hasComponent' }>,
        context: ResolverContext
    ): boolean {
        const entity = this.resolveEntity(condition.entity, context);
        if (entity === null) return false;

        const coordinator = context.state.coordinator as Coordinator;
        const globalComponentName = this.getComponentName(condition.component);

        try {
            const component = coordinator.getComponentFromEntity(
                globalComponentName,
                entity
            );
            return component !== null && component !== undefined;
        } catch {
            return false;
        }
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
