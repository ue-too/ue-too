import { ComponentName, Coordinator, Entity } from "@ue-too/ecs";

export interface Effect {
    apply(): void;
}


export class NumberModificationEffect implements Effect {
    private _coordinator: Coordinator;
    private _amount: number;
    private _componentName: ComponentName;
    private _entity: Entity;
    private _valuePath: string;
    private _operation: 'add' | 'subtract' | 'set';

    constructor(coordinator: Coordinator, amount: number, componentName: ComponentName, entity: Entity, valuePath: string, operation: 'add' | 'subtract' | 'set' = 'add') {
        this._coordinator = coordinator;
        this._amount = amount;
        this._componentName = componentName;
        this._entity = entity;
        this._valuePath = valuePath;
        this._operation = operation;
    }

    apply(): void {
        const schema = this._coordinator.getComponentSchema(this._componentName);
        if(!schema) {
            return;
        }
        const field = schema.fields.find(field => {
            return field.name == this._valuePath;
        });
        const component = this._coordinator.getComponentFromEntity<Record<string, unknown>>(this._componentName, this._entity);

        if(!component || !field) {
            return;
        }

        if(component[field.name] && typeof component[field.name] === 'number'){
            if(this._operation === 'add'){
                component[field.name] = (component[field.name] as number) + this._amount;
            } else if(this._operation === 'subtract'){
                component[field.name] = (component[field.name] as number) - this._amount;
            } else if(this._operation === 'set'){
                component[field.name] = this._amount;
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


