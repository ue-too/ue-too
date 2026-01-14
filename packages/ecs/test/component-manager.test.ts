import { ComponentManager, createComponentName } from "../src";

type MockComponent = {
    name: string;
    age: number;
}

const MOCK_COMPONENT = createComponentName('MockComponent');

describe('ComponentManager', () => {

    it('should be able to register a component', () => {
        const componentManager = new ComponentManager();
        componentManager.registerComponent<MockComponent>(MOCK_COMPONENT);
        expect(componentManager.getComponentType(MOCK_COMPONENT)).toBe(0);
    });

    it('should get all entities with a specific component', () => {
        const componentManager = new ComponentManager();
        componentManager.registerComponent<MockComponent>(MOCK_COMPONENT);
        
        const entity1 = 0;
        const entity2 = 1;
        const entity3 = 2;
        
        componentManager.addComponentToEntity(MOCK_COMPONENT, entity1, {name: 'John', age: 30});
        componentManager.addComponentToEntity(MOCK_COMPONENT, entity2, {name: 'Jane', age: 25});
        componentManager.addComponentToEntity(MOCK_COMPONENT, entity3, {name: 'Bob', age: 35});
        
        const entities = componentManager.getAllEntitiesWithComponent(MOCK_COMPONENT);
        expect(entities.length).toBe(3);
        expect(entities).toContain(entity1);
        expect(entities).toContain(entity2);
        expect(entities).toContain(entity3);
    });

    it('should return empty array for unregistered component', () => {
        const componentManager = new ComponentManager();
        const UNREGISTERED = createComponentName('Unregistered');
        const entities = componentManager.getAllEntitiesWithComponent(UNREGISTERED);
        expect(entities).toEqual([]);
    });

});
