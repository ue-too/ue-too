import { ComponentType, Coordinator, Entity, System, createGlobalComponentName, ComponentName } from "@ue-too/ecs";

export type OwnershipComponent = {
    owner: Entity | null;
};

export const OWNERSHIP_COMPONENT: ComponentName = createGlobalComponentName("OwnershipComponent");

export function setOwner(entity: Entity, owner: Entity, coordinator: Coordinator): void {
    const ownershipComponent = coordinator.getComponentFromEntity<OwnershipComponent>(OWNERSHIP_COMPONENT, entity);
    if(!ownershipComponent) {
        throw new Error(entity + " does not have a ownership component; it cannot be owned");
    }
    ownershipComponent.owner = owner;
}

export function removeFromOwner(entity: Entity, owner: Entity, coordinator: Coordinator): void {
    const ownershipComponent = coordinator.getComponentFromEntity<OwnershipComponent>(OWNERSHIP_COMPONENT, entity);
    if(!ownershipComponent) {
        return;
    }
    if(ownershipComponent.owner !== owner) {
        return;
    }
    ownershipComponent.owner = null;
}

export class OwnershipSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator){
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        let ownershipComponentType = this.coordinator.getComponentType(OWNERSHIP_COMPONENT);
        if(ownershipComponentType == undefined){
            this.coordinator.registerComponent<OwnershipComponent>(OWNERSHIP_COMPONENT);
            ownershipComponentType = this.coordinator.getComponentType(OWNERSHIP_COMPONENT)!;
        }
        if(ownershipComponentType == undefined){
            throw new Error('OwnershipComponent cannot be registered');
        }
        this.coordinator.registerSystem("ownershipSystem", this);
        this.coordinator.setSystemSignature("ownershipSystem", 1 << ownershipComponentType);
    }

    getOwnerShipComponentOf(entity: Entity): OwnershipComponent | null {
        const ownershipComponent = this.coordinator.getComponentFromEntity<OwnershipComponent>(OWNERSHIP_COMPONENT, entity);
        if(!ownershipComponent) {
            return null;
        }
        return ownershipComponent;
    }

    getOwnerOf(entity: Entity): Entity | null {
        const ownershipComponent = this.getOwnerShipComponentOf(entity);
        if(!ownershipComponent) {
            return null;
        }
        return ownershipComponent.owner;
    }

    getOwnerEntities(owner: Entity): Entity[] {
        return Array.from(this.entities).filter((entity) => this.getOwnerOf(entity) === owner);
    }

    countEntitiesWithComponentByOwner(componentName: ComponentName, owner: Entity): number {
        const entities = this.getOwnerEntities(owner);
        let count = 0;
        for(const entity of entities){
            const component = this.coordinator.getComponentFromEntity<unknown>(componentName, entity);
            if(component != undefined  && typeof component === 'object' && 'value' in component){
                count++;
            }
        }
        return count;
    }

    removeAllFromOwner(owner: Entity): void {
        for(const entity of this.entities){
            const ownershipComponent = this.getOwnerShipComponentOf(entity);
            if(!ownershipComponent) {
                continue;
            }
            if(ownershipComponent.owner === owner){
                ownershipComponent.owner = null;
            }
        }
    }
}
