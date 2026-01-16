import { Coordinator, System, Entity, createComponentName, createSystemName } from "../src";

type MockComponent = {
    name: string;
    age: number;
}

const MOCK_COMPONENT = createComponentName('MockComponent');

describe('Coordinator', () => {

    it('should be able to create an entity', () => {
        const coordinator = new Coordinator();
        const entity = coordinator.createEntity();
        expect(entity).toBeDefined();
        // the first entity
        expect(entity).toBe(0);
    });

    it('should be able to register a component', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        expect(coordinator.getComponentType(MOCK_COMPONENT)).toBe(0);
    });

    it('should be able to add a component to an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, component);
        expect(coordinator.getComponentFromEntity(MOCK_COMPONENT, entity)).toEqual(component);
    });

    it('should be able to remove a component from an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, component);
        coordinator.removeComponentFromEntity(MOCK_COMPONENT, entity);
        expect(coordinator.getComponentFromEntity(MOCK_COMPONENT, entity)).toBeNull();
    });

    it('should be able to set a system signature and update the system entities', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const mockSystem = {entities: new Set<Entity>()};
        const MOCK_SYSTEM = createSystemName('MockSystem');
        coordinator.registerSystem(MOCK_SYSTEM, mockSystem);
        coordinator.setSystemSignature(MOCK_SYSTEM, 1);
        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, {name: 'John', age: 30});
        coordinator.setSystemSignature(MOCK_SYSTEM, 1);
        expect(mockSystem.entities.size).toBe(1);
        expect(mockSystem.entities.has(entity)).toBe(true);
    });

    it('should be able to let system iterate over its entities based on the system signature', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const mockSystem = {entities: new Set<Entity>()};
        const MOCK_SYSTEM = createSystemName('MockSystem');
        coordinator.registerSystem(MOCK_SYSTEM, mockSystem);
        coordinator.setSystemSignature(MOCK_SYSTEM, 1);
        const entity = coordinator.createEntity();
        coordinator.createEntity();
        const entity3 = coordinator.createEntity();

        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, {name: 'John', age: 30});
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity3, {name: 'Jim', age: 35});

        const entities = Array.from(mockSystem.entities);
        expect(entities.length).toBe(2);
        expect(entities[0]).toBe(entity);
        expect(entities[1]).toBe(entity3);
    });

    it('should correctly check if an entity exists', () => {
        const coordinator = new Coordinator();
        
        // Initially no entities exist
        expect(coordinator.entityExists(0)).toBe(false);
        expect(coordinator.entityExists(999)).toBe(false);
        
        // Create an entity
        const entity = coordinator.createEntity();
        expect(coordinator.entityExists(entity)).toBe(true);
        
        // Create another entity
        const entity2 = coordinator.createEntity();
        expect(coordinator.entityExists(entity2)).toBe(true);
        expect(coordinator.entityExists(entity)).toBe(true); // First entity still exists
        
        // Destroy an entity
        coordinator.destroyEntity(entity);
        expect(coordinator.entityExists(entity)).toBe(false);
        expect(coordinator.entityExists(entity2)).toBe(true); // Second entity still exists
        
        // Destroy the second entity
        coordinator.destroyEntity(entity2);
        expect(coordinator.entityExists(entity2)).toBe(false);
    });

    it('should return false for out-of-range entity IDs', () => {
        const coordinator = new Coordinator();
        
        // Negative entity ID
        expect(coordinator.entityExists(-1)).toBe(false);
        
        // Entity ID beyond max entities
        expect(coordinator.entityExists(10001)).toBe(false);
    });

    it('should only include entities with all required components in system entities', () => {
        const coordinator = new Coordinator();
        
        // Define component types
        type Position = { x: number; y: number };
        type Velocity = { x: number; y: number };
        type Health = { value: number };
        
        const Position = createComponentName('Position');
        const Velocity = createComponentName('Velocity');
        const Health = createComponentName('Health');
        
        // Register components
        coordinator.registerComponent<Position>(Position);
        coordinator.registerComponent<Velocity>(Velocity);
        coordinator.registerComponent<Health>(Health);
        
        // Get component types for signature calculation
        const posType = coordinator.getComponentType(Position)!;
        const velType = coordinator.getComponentType(Velocity)!;
        const healthType = coordinator.getComponentType(Health)!;
        
        // Create a system that requires Position AND Velocity
        const movementSystem: System = { entities: new Set<Entity>() };
        const MOVEMENT_SYSTEM = createSystemName('MovementSystem');
        coordinator.registerSystem(MOVEMENT_SYSTEM, movementSystem);
        
        // Set system signature: requires Position (bit 0) AND Velocity (bit 1)
        const requiredSignature = (1 << posType) | (1 << velType);
        coordinator.setSystemSignature(MOVEMENT_SYSTEM, requiredSignature);
        
        // Initially, system should have no entities
        expect(movementSystem.entities.size).toBe(0);
        
        // Create entities with different component combinations
        const entityWithOnlyPosition = coordinator.createEntity();
        coordinator.addComponentToEntity(Position, entityWithOnlyPosition, { x: 0, y: 0 });
        
        const entityWithOnlyVelocity = coordinator.createEntity();
        coordinator.addComponentToEntity(Velocity, entityWithOnlyVelocity, { x: 1, y: 1 });
        
        const entityWithPositionAndVelocity = coordinator.createEntity();
        coordinator.addComponentToEntity(Position, entityWithPositionAndVelocity, { x: 10, y: 10 });
        coordinator.addComponentToEntity(Velocity, entityWithPositionAndVelocity, { x: 1, y: 1 });
        
        const entityWithAllComponents = coordinator.createEntity();
        coordinator.addComponentToEntity(Position, entityWithAllComponents, { x: 20, y: 20 });
        coordinator.addComponentToEntity(Velocity, entityWithAllComponents, { x: 2, y: 2 });
        coordinator.addComponentToEntity(Health, entityWithAllComponents, { value: 100 });
        
        const entityWithNoComponents = coordinator.createEntity();
        
        // Verify system only contains entities with BOTH Position AND Velocity
        expect(movementSystem.entities.size).toBe(2);
        expect(movementSystem.entities.has(entityWithOnlyPosition)).toBe(false);
        expect(movementSystem.entities.has(entityWithOnlyVelocity)).toBe(false);
        expect(movementSystem.entities.has(entityWithPositionAndVelocity)).toBe(true);
        expect(movementSystem.entities.has(entityWithAllComponents)).toBe(true);
        expect(movementSystem.entities.has(entityWithNoComponents)).toBe(false);
        
        // Test removing a required component removes entity from system
        coordinator.removeComponentFromEntity(Velocity, entityWithPositionAndVelocity);
        expect(movementSystem.entities.has(entityWithPositionAndVelocity)).toBe(false);
        expect(movementSystem.entities.size).toBe(1);
        
        // Test adding a required component adds entity to system
        coordinator.addComponentToEntity(Velocity, entityWithOnlyPosition, { x: 1, y: 1 });
        expect(movementSystem.entities.has(entityWithOnlyPosition)).toBe(true);
        expect(movementSystem.entities.size).toBe(2);
        
        // Test removing a non-required component doesn't remove entity from system
        coordinator.removeComponentFromEntity(Health, entityWithAllComponents);
        expect(movementSystem.entities.has(entityWithAllComponents)).toBe(true);
        expect(movementSystem.entities.size).toBe(2);
    });

});
