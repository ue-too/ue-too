import { Coordinator, Entity } from "@ue-too/ecs";

export type HealthComponent = {
    health: number;
    maxHeath: number;
};

export const HEALTH_COMPONENT = "HealthComponent";

export function subtractHealth(entity: Entity, amount: number, coordinator: Coordinator): void {
    const healthComponent = coordinator.getComponentFromEntity<HealthComponent>(HEALTH_COMPONENT, entity);
    if(!healthComponent) {
        throw new Error(entity + " does not have a health component");
    }
    healthComponent.health -= amount;
    if(healthComponent.health < 0) {
        healthComponent.health = 0;
    }
    if(healthComponent.health === 0) {
        // someone or something is dead
    }
}

export function addHealth(entity: Entity, amount: number, coordinator: Coordinator): void {
    const healthComponent = coordinator.getComponentFromEntity<HealthComponent>(HEALTH_COMPONENT, entity);
    if(!healthComponent) {
        throw new Error(entity + " does not have a health component");
    }
    healthComponent.health += amount;
    if(healthComponent.health > healthComponent.maxHeath) {
        healthComponent.health = healthComponent.maxHeath;
    }
}

export type NumberComponent = {
    value: number;
}

export function registerNumberComponent(componentName: string, coordinator: Coordinator): void {
    coordinator.registerComponent<NumberComponent>(componentName);
}
