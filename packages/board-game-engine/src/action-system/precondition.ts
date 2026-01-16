import { ComponentName, Coordinator, Entity } from "@ue-too/ecs";
export interface Precondition {
    check(): boolean;
}

export class ValueComparisonPrecondition implements Precondition {
    constructor(private _value: number, private _operator: '>' | '<' | '>=' | '<=' | '==' | '!=', private _coordinator: Coordinator, private _componentName: ComponentName, private _entity: Entity, private _valuePath: string) {}

    check(): boolean {
        const component = this._coordinator.getComponentFromEntity<Record<string, unknown>>(this._componentName, this._entity);
        if(!component) {
            return false;
        }
        const value = component[this._valuePath];
        if(typeof value !== 'number') {
            return false;
        }
        switch(this._operator) {
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

