import {
    INPUT_COMPONENT,
    InputComponent,
    PHYSICS_COMPONENT,
    PhysicsComponent,
} from '@ue-too/dynamics';
import { Coordinator, Entity, System } from '@ue-too/ecs';

export class InputSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator) {
        this.coordinator = coordinator;
        this.entities = new Set<Entity>();
        let physicsComponentType =
            this.coordinator.getComponentType(PHYSICS_COMPONENT);
        if (physicsComponentType === undefined) {
            console.info('PhysicsComponent not registered; registering it now');
            this.coordinator.registerComponent(PHYSICS_COMPONENT);
            physicsComponentType =
                this.coordinator.getComponentType(PHYSICS_COMPONENT);
        }
        let inputComponentType =
            this.coordinator.getComponentType(INPUT_COMPONENT);
        if (inputComponentType === undefined) {
            console.info('InputComponent not registered; registering it now');
            this.coordinator.registerComponent(INPUT_COMPONENT);
            inputComponentType =
                this.coordinator.getComponentType(INPUT_COMPONENT);
        }
        this.coordinator.registerSystem('inputSystem', this);
        this.coordinator.setSystemSignature(
            'inputSystem',
            (1 << physicsComponentType) | (1 << inputComponentType)
        );
    }

    update(deltaTime: number): void {
        const forceScalar = 100;
        for (const entity of this.entities) {
            const inputComponent =
                this.coordinator.getComponentFromEntity<InputComponent>(
                    INPUT_COMPONENT,
                    entity
                );
            const physicsComponent =
                this.coordinator.getComponentFromEntity<PhysicsComponent>(
                    PHYSICS_COMPONENT,
                    entity
                );
            switch (inputComponent.direction) {
                case 'up':
                    physicsComponent.force = { x: 0, y: -forceScalar };
                    break;
                case 'down':
                    physicsComponent.force = { x: 0, y: forceScalar };
                    break;
                case 'left':
                    physicsComponent.force = { x: -forceScalar, y: 0 };
                    break;
                case 'right':
                    physicsComponent.force = { x: forceScalar, y: 0 };
                    break;
            }
        }
    }
}
