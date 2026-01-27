import { ComponentName, Coordinator, Entity } from '@ue-too/ecs';

export interface Precondition {
    check(): boolean;
}

/**
 * Unified value comparison precondition that works with both custom schema components
 * and typed components. Automatically detects which approach to use based on whether
 * the component has a registered schema.
 *
 * @example
 * ```typescript
 * // With custom schema component
 * const precondition1 = new ValueComparisonPrecondition(
 *     100, '>', coordinator, HEALTH_COMPONENT, entity, 'health'
 * );
 *
 * // With typed component (type-safe)
 * type HealthComponent = { health: number; maxHealth: number };
 * const precondition2 = new ValueComparisonPrecondition<HealthComponent>(
 *     coordinator, HEALTH_COMPONENT, entity, 'health', 100, '>'
 * );
 * ```
 */
export class ValueComparisonPrecondition<
    T = Record<string, unknown>,
> implements Precondition {
    private _coordinator: Coordinator;
    private _value: number;
    private _operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    private _componentName: ComponentName;
    private _entity: Entity;
    private _valuePath: string | keyof T;

    // Overload for typed components (type-safe)
    constructor(
        coordinator: Coordinator,
        componentName: ComponentName,
        entity: Entity,
        valuePath: keyof T,
        value: number,
        operator: '>' | '<' | '>=' | '<=' | '==' | '!='
    );
    // Overload for schema-based components (backward compatible)
    constructor(
        value: number,
        operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
        coordinator: Coordinator,
        componentName: ComponentName,
        entity: Entity,
        valuePath: string
    );
    // Implementation
    constructor(
        valueOrCoordinator: number | Coordinator,
        operatorOrComponentName:
            | '>'
            | '<'
            | '>='
            | '<='
            | '=='
            | '!='
            | ComponentName,
        coordinatorOrEntity: Coordinator | Entity,
        componentNameOrValuePath: ComponentName | keyof T,
        entityOrValue: Entity | number,
        valuePathOrOperator?: string | '>' | '<' | '>=' | '<=' | '==' | '!='
    ) {
        // Detect which overload was used by checking if first param is a number
        if (typeof valueOrCoordinator === 'number') {
            // Schema-based constructor: (value, operator, coordinator, componentName, entity, valuePath)
            this._value = valueOrCoordinator;
            this._operator = operatorOrComponentName as
                | '>'
                | '<'
                | '>='
                | '<='
                | '=='
                | '!=';
            this._coordinator = coordinatorOrEntity as Coordinator;
            this._componentName = componentNameOrValuePath as ComponentName;
            this._entity = entityOrValue as Entity;
            this._valuePath = valuePathOrOperator as string;
        } else {
            // Typed constructor: (coordinator, componentName, entity, valuePath, value, operator)
            this._coordinator = valueOrCoordinator as Coordinator;
            this._componentName = operatorOrComponentName as ComponentName;
            this._entity = coordinatorOrEntity as Entity;
            this._valuePath = componentNameOrValuePath as keyof T;
            this._value = entityOrValue as number;
            this._operator = valuePathOrOperator as
                | '>'
                | '<'
                | '>='
                | '<='
                | '=='
                | '!=';
        }
    }

    check(): boolean {
        const schema = this._coordinator.getComponentSchema(
            this._componentName
        );
        const hasCustomSchema = schema !== null;

        if (hasCustomSchema) {
            // Use schema-based approach
            const field = schema!.fields.find(field => {
                return field.name === this._valuePath;
            });
            const component = this._coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(this._componentName, this._entity);

            if (!component || !field) {
                return false;
            }

            const value = component[field.name];
            if (typeof value !== 'number') {
                return false;
            }

            return this._compare(value);
        } else {
            // Use type-based approach
            const component = this._coordinator.getComponentFromEntity<T>(
                this._componentName,
                this._entity
            );
            if (!component) {
                return false;
            }
            if (
                typeof component !== 'object' ||
                !(this._valuePath in component)
            ) {
                return false;
            }
            const value = component[this._valuePath as keyof T];
            if (typeof value !== 'number') {
                return false;
            }

            return this._compare(value as number);
        }
    }

    private _compare(value: number): boolean {
        switch (this._operator) {
            case '>':
                return value > this._value;
            case '<':
                return value < this._value;
            case '>=':
                return value >= this._value;
            case '<=':
                return value <= this._value;
            case '==':
                return value == this._value;
            case '!=':
                return value != this._value;
            default:
                return false;
        }
    }
}

/**
 * Precondition that checks if a property in a component of an entity equals a certain value.
 * Supports multiple types (number, string, boolean, etc.) and works with both custom schema
 * components and typed components. Automatically detects which approach to use based on whether
 * the component has a registered schema.
 *
 * @example
 * ```typescript
 * // With custom schema component
 * const precondition1 = new PropertyIsPrecondition(
 *     coordinator, HEALTH_COMPONENT, entity, 'status', 'active'
 * );
 *
 * // With typed component (type-safe)
 * type PlayerComponent = { name: string; level: number; isActive: boolean };
 * const precondition2 = new PropertyIsPrecondition<PlayerComponent>(
 *     coordinator, PLAYER_COMPONENT, entity, 'name', 'John'
 * );
 * ```
 */
export class PropertyIsPrecondition<
    T = Record<string, unknown>,
> implements Precondition {
    private _coordinator: Coordinator;
    private _componentName: ComponentName;
    private _entity: Entity;
    private _property: string | keyof T;
    private _value: unknown;

    constructor(
        coordinator: Coordinator,
        componentName: ComponentName,
        entity: Entity,
        property: string | keyof T,
        value: unknown
    ) {
        this._coordinator = coordinator;
        this._componentName = componentName;
        this._entity = entity;
        this._property = property;
        this._value = value;
    }

    check(): boolean {
        const schema = this._coordinator.getComponentSchema(
            this._componentName
        );
        const hasCustomSchema = schema !== null;

        if (hasCustomSchema) {
            // Use schema-based approach
            const field = schema!.fields.find(field => {
                return field.name === this._property;
            });
            const component = this._coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(this._componentName, this._entity);

            if (!component || !field) {
                return false;
            }

            const value = component[field.name];
            return this._compare(value, this._value);
        } else {
            // Use type-based approach
            const component = this._coordinator.getComponentFromEntity<T>(
                this._componentName,
                this._entity
            );
            if (!component) {
                return false;
            }
            if (
                typeof component !== 'object' ||
                !(this._property in component)
            ) {
                return false;
            }
            const value = component[this._property as keyof T];
            return this._compare(value, this._value);
        }
    }

    private _compare(actualValue: unknown, expectedValue: unknown): boolean {
        // Use strict equality for comparison
        // This works for number, string, boolean, null, undefined, and object references
        return actualValue === expectedValue;
    }
}
