import { Coordinator, Entity } from "@ue-too/ecs";
import { Precondition } from "../action-system/precondition";
import { LOCATION_COMPONENT, LOCATION_SYSTEM, LocationComponent, LocationSystem } from "./zone-component";

export class ZoneHasEntitiesPrecondition implements Precondition {

    constructor(private _coordinator: Coordinator, private _zoneEntity: Entity, private _entity: Entity) {}

    check(): boolean {
        const locationComponent = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, this._entity);
        if(!locationComponent) {
            return false;
        }
        return locationComponent.location === this._zoneEntity;
    }
}

export class ZoneHasEntitiesNumberPrecondition implements Precondition {

    constructor(private _coordinator: Coordinator, private _zoneEntity: Entity, private _minCount: number) {}

    check(): boolean {
        const system = this._coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if (!system) {
            return false;
        }
        const entities = system.getEntitiesInZone(this._zoneEntity);
        return entities.length >= this._minCount;
    }
}

export class ZoneHasEntitiesNumberRangePrecondition implements Precondition {

    constructor(private _coordinator: Coordinator, private _zoneEntity: Entity, private _minCount: number, private _maxCount: number) {}

    check(): boolean {
        const system = this._coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if (!system) {
            return false;
        }
        const entities = system.getEntitiesInZone(this._zoneEntity);
        return entities.length >= this._minCount && entities.length <= this._maxCount;
    }
}

export class ZoneHasEntityIndexPrecondition implements Precondition {

    constructor(private _coordinator: Coordinator, private _zoneEntity: Entity, private _entity: Entity, private _index: number) {}

    check(): boolean {
        const system = this._coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if (!system) {
            return false;
        }
        const entities = system.getEntitiesInZone(this._zoneEntity);
        return entities[this._index] === this._entity;
    }
}
