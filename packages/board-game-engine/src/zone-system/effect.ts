import { Coordinator, Entity } from "@ue-too/ecs";
import { Effect } from "../action-system/effect";
import { LOCATION_COMPONENT, LocationComponent, LocationSystem, ZONE_COMPONENT, ZoneComponent } from "./zone-component";

export class MoveEntityToZoneEffect implements Effect {
    private _coordinator: Coordinator;
    private _entity: Entity;
    private _zoneEntity: Entity;

    constructor(coordinator: Coordinator, entity: Entity, zoneEntity: Entity) {
        this._coordinator = coordinator;
        this._entity = entity;
        this._zoneEntity = zoneEntity;
    }

    apply(): void {
        const zoneEntityIsZone = this._coordinator.getComponentFromEntity<ZoneComponent>(ZONE_COMPONENT, this._zoneEntity);
        if(!zoneEntityIsZone) {
            return;
        }
        const entityIsInZone = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, this._entity);
        if(!entityIsInZone || entityIsInZone.location === this._zoneEntity) {
            return;
        }

        entityIsInZone.location = this._zoneEntity;
    }
}

export class ShuffleZoneEffect implements Effect {
    constructor(private _locationSystem: LocationSystem, private _zoneEntity: Entity) {}

    apply(): void {
        this._locationSystem.shuffleZone(this._zoneEntity);
    }
}
