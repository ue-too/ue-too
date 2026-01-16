import { ComponentName, ComponentSchema, Coordinator, createGlobalComponentName, Entity, System, ComponentFieldDefinition, ArrayElementType, SystemName, createGlobalSystemName } from "@ue-too/ecs";

export const ZONE_COMPONENT: ComponentName = createGlobalComponentName("ZoneComponent");
export const LOCATION_COMPONENT: ComponentName = createGlobalComponentName("LocationComponent");

export const LOCATION_SYSTEM: SystemName = createGlobalSystemName("LocationSystem");

export type LocationComponent = {
    location: Entity;
    sortIndex: number;
}

export const LocationComponentSchema: ComponentSchema = {
    componentName: LOCATION_COMPONENT,
    fields: [
        { name: 'location', type: 'entity' },
        { name: 'sortIndex', type: 'number' }
    ]
};

export type ZoneComponent = {
    zone: string;
    owner: Entity | null;
    visibility: 'public' | 'private' | 'owner-only';
    ordered: boolean;
}

export const ZoneComponentSchema: ComponentSchema = {
    componentName: ZONE_COMPONENT,
    fields: [
        { name: 'zone', type: 'string' },
        { name: 'owner', type: 'entity' },
        { name: 'visibility', type: 'string' },
        { name: 'ordered', type: 'boolean' }
    ]
};

export function shuffle(tokens: number[]): number[] {
    const shuffled = [...tokens];
    for (let i = tokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export class LocationSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator) {
        this.coordinator = coordinator;
        this.entities = new Set();
        
        this.coordinator.registerComponentWithSchema(LocationComponentSchema);

        const locationComponentType = this.coordinator.getComponentType(LOCATION_COMPONENT);
        if(locationComponentType === null) {
            throw new Error('LocationComponent not registered with coordinator');
        }

        this.coordinator.registerSystem(LOCATION_SYSTEM, this);
        this.coordinator.setSystemSignature(LOCATION_SYSTEM, 1 << locationComponentType);
    }

    getEntitiesInZone(zoneEntity: Entity): Entity[] {
        const zoneComponent = this.coordinator.getComponentFromEntity<ZoneComponent>(ZONE_COMPONENT, zoneEntity);
        if(!zoneComponent) {
            return [];
        }
        const tempArray: {entity: Entity, sortIndex: number}[] = [];
        for(const entity of this.entities) {
            const locationComponent = this.coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
            if(!locationComponent) {
                continue;
            }
            if(locationComponent.location === zoneEntity) {
                tempArray.push({entity, sortIndex: locationComponent.sortIndex});
            }
        }
        if(zoneComponent.ordered) {
            tempArray.sort((a, b) => {
                return a.sortIndex - b.sortIndex;
            });
        }
        return tempArray.map(item => item.entity);
    }

    offsetZoneSortIndex(zoneEntity: Entity, offset: number): void {
        this.organizeZoneSortIndex(zoneEntity);
        const entities = this.getEntitiesInZone(zoneEntity);
        for(let i = 0; i < entities.length; i++) {
            const locationComponent = this.coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entities[i]);
            if(!locationComponent) {
                continue;
            }
            locationComponent.sortIndex += offset;
        }
    }

    organizeZoneSortIndex(zoneEntity: Entity): number {
        const entities = this.getEntitiesInZone(zoneEntity);
        let lastSortIndex = 0;
        for(let i = 0; i < entities.length; i++) {
            const locationComponent = this.coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entities[i]);
            if(!locationComponent) {
                continue;
            }
            locationComponent.sortIndex = lastSortIndex;
            lastSortIndex++;
        }
        return lastSortIndex;
    }

    shuffleZone(zoneEntity: Entity): void {
        const zoneComponent = this.coordinator.getComponentFromEntity<ZoneComponent>(ZONE_COMPONENT, zoneEntity);
        if(!zoneComponent) {
            return;
        }
        const entities = this.getEntitiesInZone(zoneEntity);
        const shuffledEntities = shuffle(entities);
        for(let i = 0; i < shuffledEntities.length; i++) {
            const locationComponent = this.coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, shuffledEntities[i]);
            if(!locationComponent) {
                continue;
            }
            locationComponent.sortIndex = i;
        }
    }
}
