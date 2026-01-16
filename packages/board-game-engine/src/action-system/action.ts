import { Entity } from "@ue-too/ecs";
import { Precondition } from "./precondition";
import { Effect } from "./effect";
import { Event } from "../event-system/event";

export interface Action {
    type: string;
}


export class GenericAction implements Action {
    type: string;
    actor: Entity;
    targets: Entity[];
    parameters: Record<string, unknown>;
    preconditions: Precondition[];
    costs: Effect[] = [];
    effects: Effect[] = [];
    private _events: Event[] = [];

    constructor(type: string, actor: Entity, targets: Entity[], parameters: Record<string, unknown>, preconditions: Precondition[], costs: Effect[], effects: Effect[]) {
        this.type = type;
        this.actor = actor;
        this.targets = targets;
        this.parameters = parameters;
        this.preconditions = preconditions;
        this.costs = costs;
        this.effects = effects;
    }

    canExecute(): boolean{
        return this.preconditions.every(precondition => precondition.check());
    }

    execute(): Event[]{
        this.costs.forEach(cost => cost.apply());
        this.effects.forEach(effect => effect.apply());
        return this._events;
    }
}



