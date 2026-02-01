import {
    ComponentName,
    ComponentType,
    Coordinator,
    Entity,
    System,
    SystemName,
    createGlobalComponentName,
    createGlobalSystemName,
} from '@ue-too/ecs';

export const ZONE_COMPONENT: ComponentName =
    createGlobalComponentName('ZoneComponent');
export const ZONE_SYSTEM: SystemName = createGlobalSystemName('ZoneSystem');

export type ZoneComponent = {
    zone: string;
};

export class ZoneController implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;
    private zones: Set<string>;

    constructor(coordinator: Coordinator) {
        this.entities = new Set<Entity>();
        this.zones = new Set<string>();
        this.coordinator = coordinator;
        let componentType = this.coordinator.getComponentType(ZONE_COMPONENT);
        if (componentType === undefined) {
            this.coordinator.registerComponent(ZONE_COMPONENT);
            componentType = this.coordinator.getComponentType(ZONE_COMPONENT);
        }
        if (componentType === null) {
            throw new Error('ZoneComponent not registered');
        }
        this.coordinator.registerSystem(ZONE_SYSTEM, this);
        this.coordinator.setSystemSignature(ZONE_SYSTEM, 1 << componentType);
    }

    addZone(zone: string): void {
        this.zones.add(zone);
    }

    moveEntityToZone(entity: Entity, zone: string): void {}
}
