import { ComponentArray, EntityManager } from "../src";

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