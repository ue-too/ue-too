import { ComponentArray } from '../src';

type MockComponent = {
    name: string;
    age: number;
};

describe('ComponentArray', () => {
    it('should be able to insert data into a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const data = { name: 'John', age: 30 };
        componentArray.insertData(entity, data);
        expect(componentArray.getData(entity)).toEqual(data);
    });

    it('should be able to remove data from a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const entity2 = 1;
        const data = { name: 'John', age: 30 };
        const data2 = { name: 'Jane', age: 25 };
        componentArray.insertData(entity, data);
        componentArray.insertData(entity2, data2);
        componentArray.removeData(entity);
        expect(componentArray.getData(entity)).toBeNull();
        expect(componentArray.getData(entity2)).toEqual(data2);
    });

    it('should get all entities that have this component', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity1 = 0;
        const entity2 = 1;
        const entity3 = 2;
        const data1 = { name: 'John', age: 30 };
        const data2 = { name: 'Jane', age: 25 };
        const data3 = { name: 'Bob', age: 35 };

        componentArray.insertData(entity1, data1);
        componentArray.insertData(entity2, data2);
        componentArray.insertData(entity3, data3);

        const entities = componentArray.getAllEntities();
        expect(entities.length).toBe(3);
        expect(entities).toContain(entity1);
        expect(entities).toContain(entity2);
        expect(entities).toContain(entity3);

        componentArray.removeData(entity2);
        const remainingEntities = componentArray.getAllEntities();
        expect(remainingEntities.length).toBe(2);
        expect(remainingEntities).toContain(entity1);
        expect(remainingEntities).toContain(entity3);
        expect(remainingEntities).not.toContain(entity2);
    });

    it('should get the count of entities with this component', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        expect(componentArray.getCount()).toBe(0);

        componentArray.insertData(0, { name: 'John', age: 30 });
        expect(componentArray.getCount()).toBe(1);

        componentArray.insertData(1, { name: 'Jane', age: 25 });
        expect(componentArray.getCount()).toBe(2);

        componentArray.removeData(0);
        expect(componentArray.getCount()).toBe(1);
    });
});
