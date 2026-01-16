import { ComponentName, Coordinator, Entity } from "@ue-too/ecs";

export interface Effect {
    apply(): void;
}

/**
 * Unified number modification effect that works with both custom schema components
 * and typed components. Automatically detects which approach to use based on whether
 * the component has a registered schema.
 * 
 * @example
 * ```typescript
 * // With custom schema component
 * const effect1 = new NumberModificationEffect(
 *     coordinator, 25, HEALTH_COMPONENT, entity, 'health', 'subtract'
 * );
 * 
 * // With typed component (type-safe)
 * type HealthComponent = { health: number; maxHealth: number };
 * const effect2 = new NumberModificationEffect<HealthComponent>(
 *     coordinator, HEALTH_COMPONENT, entity, 'health', 25, 'subtract'
 * );
 * ```
 */
export class NumberModificationEffect<T = Record<string, unknown>> implements Effect {
    private _coordinator: Coordinator;
    private _amount: number;
    private _componentName: ComponentName;
    private _entity: Entity;
    private _valuePath: string | keyof T;
    private _operation: 'add' | 'subtract' | 'set';
    private _isTyped: boolean;

    // Overload for typed components (type-safe)
    constructor(coordinator: Coordinator, componentName: ComponentName, entity: Entity, valuePath: keyof T, amount: number, operation?: 'add' | 'subtract' | 'set');
    // Overload for schema-based components (backward compatible)
    constructor(coordinator: Coordinator, amount: number, componentName: ComponentName, entity: Entity, valuePath: string, operation?: 'add' | 'subtract' | 'set');
    // Implementation
    constructor(
        coordinator: Coordinator,
        amountOrComponentName: number | ComponentName,
        componentNameOrEntity: ComponentName | Entity,
        entityOrValuePath: Entity | keyof T,
        valuePathOrAmount: string | number,
        operationOrValuePath?: 'add' | 'subtract' | 'set' | string,
        operation?: 'add' | 'subtract' | 'set'
    ) {
        this._coordinator = coordinator;
        
        // Detect which overload was used by checking if first param is a number
        if (typeof amountOrComponentName === 'number') {
            // Schema-based constructor: (coordinator, amount, componentName, entity, valuePath, operation?)
            this._amount = amountOrComponentName;
            this._componentName = componentNameOrEntity as ComponentName;
            this._entity = entityOrValuePath as Entity;
            this._valuePath = valuePathOrAmount as string;
            this._operation = (operationOrValuePath as 'add' | 'subtract' | 'set') || 'add';
            this._isTyped = false;
        } else {
            // Typed constructor: (coordinator, componentName, entity, valuePath, amount, operation?)
            this._componentName = amountOrComponentName as ComponentName;
            this._entity = componentNameOrEntity as Entity;
            this._valuePath = entityOrValuePath as keyof T;
            this._amount = valuePathOrAmount as number;
            this._operation = (operationOrValuePath as 'add' | 'subtract' | 'set') || 'add';
            this._isTyped = true;
        }
    }

    apply(): void {
        const schema = this._coordinator.getComponentSchema(this._componentName);
        const hasCustomSchema = schema !== null;

        if (hasCustomSchema) {
            // Use schema-based approach
            const field = schema!.fields.find(field => {
                return field.name === this._valuePath;
            });
            const component = this._coordinator.getComponentFromEntity<Record<string, unknown>>(this._componentName, this._entity);

            if (!component || !field) {
                return;
            }

            // Check if the field value is a number (including 0, which is a valid number)
            if (typeof component[field.name] === 'number') {
                if (this._operation === 'add') {
                    component[field.name] = (component[field.name] as number) + this._amount;
                } else if (this._operation === 'subtract') {
                    component[field.name] = (component[field.name] as number) - this._amount;
                } else if (this._operation === 'set') {
                    component[field.name] = this._amount;
                }
            }
        } else {
            // Use type-based approach
            const component = this._coordinator.getComponentFromEntity<T>(this._componentName, this._entity);
            if (!component) {
                return;
            }
            if (typeof component !== "object" || !(this._valuePath in component)) {
                return;
            }
            const value = component[this._valuePath as keyof T];
            if (typeof value !== "number") {
                return;
            }
            // Cast to mutable type for assignment
            const mutableComponent = component as unknown as Record<string, unknown>;
            const fieldName = String(this._valuePath);
            if (this._operation === 'add') {
                mutableComponent[fieldName] = (value as number) + this._amount;
            } else if (this._operation === 'subtract') {
                mutableComponent[fieldName] = (value as number) - this._amount;
            } else if (this._operation === 'set') {
                mutableComponent[fieldName] = this._amount;
            }
        }
    }
}

export class TypeModificationEffect<T extends string> implements Effect {
    private _coordinator: Coordinator;
    private _componentName: ComponentName;
    private _entity: Entity;
    private _valuePath: string;
    private _newType: T;
    private _allowedValues?: readonly T[];
    
    constructor(coordinator: Coordinator, componentName: ComponentName, entity: Entity, valuePath: string, newType: T, allowedValues?: readonly T[]) {
        this._coordinator = coordinator;
        this._componentName = componentName;
        this._entity = entity;
        this._valuePath = valuePath;
        this._newType = newType;
        this._allowedValues = allowedValues;
    }

    apply(): void {
        const schema = this._coordinator.getComponentSchema(this._componentName);
        if(!schema) {
            return;
        }
        const field = schema.fields.find(field => {
            return field.name == this._valuePath;
        });
        
        // Check that the field exists and is a string type (required for string literal types)
        if(!field || field.type !== 'string') {
            return;
        }
        
        // Validate that the new type is in the allowed values if provided
        if(this._allowedValues && !this._allowedValues.includes(this._newType)) {
            return;
        }
        
        const component = this._coordinator.getComponentFromEntity<Record<string, unknown>>(this._componentName, this._entity);
        if(!component) {
            return;
        }
        
        if(typeof component[field.name] === 'string'){
            component[field.name] = this._newType as string;
        } else {
            return;
        }
    }
}

export class EntityFieldModificationEffect implements Effect {
    private _coordinator: Coordinator;
    private _componentName: ComponentName;
    private _entity: Entity;
    private _valuePath: string;
    private _newEntityValue: Entity;


    constructor(coordinator: Coordinator, componentName: ComponentName, entity: Entity, valuePath: string, newEntityValue: Entity) {
        this._coordinator = coordinator;
        this._componentName = componentName;
        this._entity = entity;
        this._valuePath = valuePath;
        this._newEntityValue = newEntityValue;
    }

    apply(): void {
        if(!this._coordinator.entityExists(this._newEntityValue)) {
            return;
        }
        const schema = this._coordinator.getComponentSchema(this._componentName);
        if(!schema) {
            return;
        }
        const field = schema.fields.find(field => {
            return field.name == this._valuePath;
        });
        if(!field) {
            return;
        }
        const component = this._coordinator.getComponentFromEntity<Record<string, unknown>>(this._componentName, this._entity);
        if(!component) {
            return;
        }
        if(typeof component[field.name] === 'number'){
            component[field.name] = (component[field.name] as number) + this._newEntityValue;
        } else {
            return;
        }
    }
}


