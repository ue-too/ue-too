import { Coordinator, Entity } from "@ue-too/ecs";
import { Effect } from "../action-system/effect";
import { LOCATION_COMPONENT, LOCATION_SYSTEM, LocationComponent, LocationSystem, ZONE_COMPONENT, ZoneComponent } from "./zone-component";

export class MoveEntityToZoneEffect implements Effect {
    private _coordinator: Coordinator;
    private _entity: Entity;
    private _zoneEntity: Entity;
    private _addToIfZoneOrdered: "top" | "bottom" = "top";

    constructor(coordinator: Coordinator, entity: Entity, zoneEntity: Entity, addToIfZoneOrdered: "top" | "bottom" = "top") {
        this._coordinator = coordinator;
        this._entity = entity;
        this._zoneEntity = zoneEntity;
        this._addToIfZoneOrdered = addToIfZoneOrdered;
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
        if(!zoneEntityIsZone.ordered) {
            entityIsInZone.location = this._zoneEntity;
            entityIsInZone.sortIndex = 0;
            return;
        }
        const locationSystem = this._coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if(!locationSystem) {
            return;
        }
        const lastSortIndex = locationSystem.organizeZoneSortIndex(this._zoneEntity);
        entityIsInZone.location = this._zoneEntity;
        if(this._addToIfZoneOrdered === "top") {
            locationSystem.offsetZoneSortIndex(this._zoneEntity, 1);
            entityIsInZone.sortIndex = 0;
        } else {
            entityIsInZone.sortIndex = lastSortIndex;
        }
    }
}

export class ShuffleZoneEffect implements Effect {
    constructor(private _locationSystem: LocationSystem, private _zoneEntity: Entity) {}

    apply(): void {
        this._locationSystem.shuffleZone(this._zoneEntity);
    }
}
