import { ComponentArray, EntityManager, ComponentManager, System, SystemManager, Coordinator, Entity } from "../src";

type MockComponent = {
    name: string;
    age: number;
}

describe('EntityManager', () => {

    it('should be able to create an entity', () => {
        const entityManager = new EntityManager();
        const entity = entityManager.createEntity();
        expect(entity).toBeDefined();
        expect(entity).toBe(0);
    });

    it('should be able to create multiple entities', () => {
        const entityManager = new EntityManager();
        const entity1 = entityManager.createEntity();
        const entity2 = entityManager.createEntity();
        expect(entity1).toBe(0);
        expect(entity2).toBe(1);
    });

    it('should be able to destroy an entity', () => {
        const entityManager = new EntityManager();
        const entity1 = entityManager.createEntity();
        entityManager.setSignature(entity1, 2);
        const entity2 = entityManager.createEntity();
        entityManager.destroyEntity(entity1);
        const signature = entityManager.getSignature(entity1);
        expect(signature).toBe(0);
    });

});

describe('ComponentArray', () => {

    it('should be able to insert data into a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const data = {name: 'John', age: 30};
        componentArray.insertData(entity, data);
        expect(componentArray.getData(entity)).toEqual(data);
    });

    it('should be able to remove data from a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const entity2 = 1;
        const data = {name: 'John', age: 30};
        const data2 = {name: 'Jane', age: 25};
        componentArray.insertData(entity, data);
        componentArray.insertData(entity2, data2);
        componentArray.removeData(entity);
        expect(componentArray.getData(entity)).toBeNull();
        expect(componentArray.getData(entity2)).toEqual(data2);
    });
});

describe('ComponentManager', () => {

    it('should be able to register a component', () => {
        const componentManager = new ComponentManager();
        componentManager.registerComponent<MockComponent>('MockComponent');
        expect(componentManager.getComponentType('MockComponent')).toBe(0);
    });

});

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
        coordinator.registerComponent<MockComponent>('MockComponent');
        expect(coordinator.getComponentType('MockComponent')).toBe(0);
    });

    it('should be able to add a component to an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>('MockComponent');
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity('MockComponent', entity, component);
        expect(coordinator.getComponentFromEntity('MockComponent', entity)).toEqual(component);
    });

    it('should be able to remove a component from an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>('MockComponent');
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity('MockComponent', entity, component);
        coordinator.removeComponentFromEntity('MockComponent', entity);
        expect(coordinator.getComponentFromEntity('MockComponent', entity)).toBeNull();
    });

    it('should be able to set a system signature and update the system entities', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>('MockComponent');
        const mockSystem = {entities: new Set<Entity>()};
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity('MockComponent', entity, {name: 'John', age: 30});
        coordinator.setSystemSignature('MockSystem', 1);
        expect(mockSystem.entities.size).toBe(1);
        expect(mockSystem.entities.has(entity)).toBe(true);
    });

    it('should be able to let system iterate over its entities based on the system signature', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>('MockComponent');
        const mockSystem = {entities: new Set<Entity>()};
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
        const entity = coordinator.createEntity();
        coordinator.createEntity();
        const entity3 = coordinator.createEntity();

        coordinator.addComponentToEntity('MockComponent', entity, {name: 'John', age: 30});
        coordinator.addComponentToEntity('MockComponent', entity3, {name: 'Jim', age: 35});

        const entities = Array.from(mockSystem.entities);
        expect(entities.length).toBe(2);
        expect(entities[0]).toBe(entity);
        expect(entities[1]).toBe(entity3);
    });

});