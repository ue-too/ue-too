import { Coordinator, System, Entity, createComponentName } from "../src";

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
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, {name: 'John', age: 30});
        coordinator.setSystemSignature('MockSystem', 1);
        expect(mockSystem.entities.size).toBe(1);
        expect(mockSystem.entities.has(entity)).toBe(true);
    });

    it('should be able to let system iterate over its entities based on the system signature', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const mockSystem = {entities: new Set<Entity>()};
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
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

});
