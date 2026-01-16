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

});
