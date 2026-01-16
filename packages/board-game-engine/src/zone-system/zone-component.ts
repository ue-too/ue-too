import { ComponentName, Coordinator, createGlobalComponentName, Entity, System } from "@ue-too/ecs";

export const ZONE_COMPONENT: ComponentName = createGlobalComponentName("ZoneComponent");
export const LOCATION_COMPONENT: ComponentName = createGlobalComponentName("LocationComponent");

export type LocationComponent = {
    location: Entity;
    sortIndex: number;
}

export type ZoneComponent = {
    zone: string;
    owner: Entity | null;
    visibility: 'public' | 'private' | 'owner-only';
    ordered: boolean;
}

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
        
        // Register LocationComponent if not already registered
        let locationComponentType = this.coordinator.getComponentType(LOCATION_COMPONENT);
        if (locationComponentType === null || locationComponentType === undefined) {
            this.coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
            locationComponentType = this.coordinator.getComponentType(LOCATION_COMPONENT);
        }
        
        if (locationComponentType === null || locationComponentType === undefined) {
            throw new Error('LocationComponent not registered');
        }
        
        // Register this system with the coordinator
        this.coordinator.registerSystem('locationSystem', this);
        
        // Set system signature to require LocationComponent
        this.coordinator.setSystemSignature('locationSystem', 1 << locationComponentType);
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