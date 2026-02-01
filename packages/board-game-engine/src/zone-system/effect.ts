import { Coordinator, Entity } from '@ue-too/ecs';

import { Effect } from '../action-system/effect';
import {
    LOCATION_COMPONENT,
    LOCATION_SYSTEM,
    LocationComponent,
    LocationSystem,
    ZONE_COMPONENT,
    ZoneComponent,
} from './zone-component';

export class MoveEntityToZoneEffect implements Effect {
    private _coordinator: Coordinator;
    private _entity: Entity;
    private _zoneEntity: Entity;
    private _addToIfZoneOrdered: 'top' | 'bottom' = 'top';

    constructor(
        coordinator: Coordinator,
        entity: Entity,
        zoneEntity: Entity,
        addToIfZoneOrdered: 'top' | 'bottom' = 'top'
    ) {
        this._coordinator = coordinator;
        this._entity = entity;
        this._zoneEntity = zoneEntity;
        this._addToIfZoneOrdered = addToIfZoneOrdered;
    }

    apply(): void {
        const locationSystem =
            this._coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if (!locationSystem) {
            return;
        }
        locationSystem.addEntityToZone(
            this._zoneEntity,
            this._entity,
            this._addToIfZoneOrdered
        );
    }
}

export class ShuffleZoneEffect implements Effect {
    constructor(
        private _locationSystem: LocationSystem,
        private _zoneEntity: Entity
    ) {}

    apply(): void {
        this._locationSystem.shuffleZone(this._zoneEntity);
    }
}
