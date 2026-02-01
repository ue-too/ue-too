import { GenericEntityManager } from '../src/utils';

describe('GenericEntityManager', () => {
    let entityManager: GenericEntityManager<string>;

    beforeEach(() => {
        entityManager = new GenericEntityManager<string>(3);
    });

    describe('constructor', () => {
        it('should initialize with correct initial state', () => {
            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);
            expect(entityManager.getLivingEntitesIndex()).toEqual([]);
        });

        it('should handle zero initial count', () => {
            const zeroManager = new GenericEntityManager<string>(0);
            expect(zeroManager.getLivingEntityCount()).toBe(0);
            expect(zeroManager.getLivingEntities()).toEqual([]);
            expect(zeroManager.getLivingEntitesIndex()).toEqual([]);
        });
    });

    describe('createEntity', () => {
        it('should create an entity and return its ID', () => {
            const entityId = entityManager.createEntity('test-entity');

            expect(entityId).toBe(0);
            expect(entityManager.getEntity(0)).toBe('test-entity');
            expect(entityManager.getLivingEntityCount()).toBe(1);
            expect(entityManager.getLivingEntities()).toEqual(['test-entity']);
            expect(entityManager.getLivingEntitesIndex()).toEqual([0]);
        });

        it('should create multiple entities in sequence', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            const id3 = entityManager.createEntity('entity-3');

            expect(id1).toBe(0);
            expect(id2).toBe(1);
            expect(id3).toBe(2);
            expect(entityManager.getLivingEntityCount()).toBe(3);
            expect(entityManager.getLivingEntities()).toEqual([
                'entity-1',
                'entity-2',
                'entity-3',
            ]);
            expect(entityManager.getLivingEntitesIndex()).toEqual([0, 1, 2]);
        });

        it('should expand capacity when max entities reached', () => {
            // Fill up the initial capacity
            entityManager.createEntity('entity-1');
            entityManager.createEntity('entity-2');
            entityManager.createEntity('entity-3');

            // This should trigger expansion
            const id4 = entityManager.createEntity('entity-4');

            expect(id4).toBe(3);
            expect(entityManager.getLivingEntityCount()).toBe(4);
            expect(entityManager.getEntity(3)).toBe('entity-4');
            expect(entityManager.getLivingEntities()).toContain('entity-4');
        });

        it('should handle multiple expansions', () => {
            // Fill up initial capacity
            entityManager.createEntity('entity-1');
            entityManager.createEntity('entity-2');
            entityManager.createEntity('entity-3');

            // First expansion
            entityManager.createEntity('entity-4');
            entityManager.createEntity('entity-5');
            entityManager.createEntity('entity-6');

            // Second expansion
            const id7 = entityManager.createEntity('entity-7');

            expect(id7).toBe(6);
            expect(entityManager.getLivingEntityCount()).toBe(7);
            expect(entityManager.getEntity(6)).toBe('entity-7');
            expect(entityManager.getLivingEntities()).toContain('entity-7');
        });

        it('should reuse available entity IDs after destruction', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');

            entityManager.destroyEntity(id1);

            const id3 = entityManager.createEntity('entity-3');

            expect(id3).toBe(2); // Should reuse the next available ID (2, since 0 was destroyed and added to end)
            expect(entityManager.getEntity(id3)).toBe('entity-3');
            expect(entityManager.getLivingEntityCount()).toBe(2);
            expect(entityManager.getLivingEntities()).toContain('entity-3');
        });
    });

    describe('destroyEntity', () => {
        it('should destroy an existing entity', () => {
            const entityId = entityManager.createEntity('test-entity');
            entityManager.destroyEntity(entityId);

            expect(entityManager.getEntity(entityId)).toBe(null);
            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);
            expect(entityManager.getLivingEntitesIndex()).toEqual([]);
        });

        it('should throw error for invalid entity ID (negative)', () => {
            expect(() => {
                entityManager.destroyEntity(-1);
            }).toThrow('Invalid entity out of range');
        });

        it('should throw error for invalid entity ID (out of range)', () => {
            expect(() => {
                entityManager.destroyEntity(5);
            }).toThrow('Invalid entity out of range');
        });

        it('should handle destroying multiple entities', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            const id3 = entityManager.createEntity('entity-3');

            entityManager.destroyEntity(id1);
            entityManager.destroyEntity(id3);

            expect(entityManager.getLivingEntityCount()).toBe(1);
            expect(entityManager.getEntity(id1)).toBe(null);
            expect(entityManager.getEntity(id3)).toBe(null);
            expect(entityManager.getEntity(id2)).toBe('entity-2');
            expect(entityManager.getLivingEntities()).toEqual(['entity-2']);
            expect(entityManager.getLivingEntitesIndex()).toEqual([id2]);
        });

        it('should maintain correct available entities order', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');

            entityManager.destroyEntity(id1);
            entityManager.destroyEntity(id2);

            // After destroying both entities, all should be available for reuse
            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);
            expect(entityManager.getLivingEntitesIndex()).toEqual([]);

            // Verify entities are destroyed
            expect(entityManager.getEntity(id1)).toBe(null);
            expect(entityManager.getEntity(id2)).toBe(null);
        });
    });

    describe('edge cases and stress testing', () => {
        it('should handle rapid create/destroy cycles', () => {
            const ids: number[] = [];

            // Create entities
            for (let i = 0; i < 10; i++) {
                ids.push(entityManager.createEntity(`entity-${i}`));
            }

            // Destroy them in reverse order
            for (let i = ids.length - 1; i >= 0; i--) {
                entityManager.destroyEntity(ids[i]);
            }

            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);
            expect(entityManager.getLivingEntitesIndex()).toEqual([]);
        });

        it('should handle creating entity after all are destroyed', () => {
            // Create and destroy all initial entities
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            const id3 = entityManager.createEntity('entity-3');

            entityManager.destroyEntity(id1);
            entityManager.destroyEntity(id2);
            entityManager.destroyEntity(id3);

            // Create a new entity - should reuse an available ID
            const newId = entityManager.createEntity('new-entity');

            expect(newId).toBe(0); // Should reuse the first available ID (0, since it was destroyed first)
            expect(entityManager.getLivingEntityCount()).toBe(1);
            expect(entityManager.getEntity(newId)).toBe('new-entity');
            expect(entityManager.getLivingEntities()).toEqual(['new-entity']);
            expect(entityManager.getLivingEntitesIndex()).toEqual([0]);
        });

        it('should handle generic types correctly', () => {
            interface TestEntity {
                name: string;
                value: number;
            }

            const typedManager = new GenericEntityManager<TestEntity>(2);
            const entity: TestEntity = { name: 'test', value: 42 };

            const id = typedManager.createEntity(entity);
            expect(id).toBe(0);
            expect(typedManager.getEntity(id)).toEqual(entity);
            expect(typedManager.getLivingEntityCount()).toBe(1);
            expect(typedManager.getLivingEntities()).toEqual([entity]);
        });
    });

    describe('state consistency', () => {
        it('should maintain consistent state across operations', () => {
            // Initial state
            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);

            // After creating entity
            const id = entityManager.createEntity('test');
            expect(entityManager.getLivingEntityCount()).toBe(1);
            expect(entityManager.getLivingEntities()).toEqual(['test']);
            expect(entityManager.getEntity(id)).toBe('test');

            // After destroying entity
            entityManager.destroyEntity(id);
            expect(entityManager.getLivingEntityCount()).toBe(0);
            expect(entityManager.getLivingEntities()).toEqual([]);
            expect(entityManager.getEntity(id)).toBe(null);
        });

        it('should not have duplicate IDs in living entities', () => {
            const id = entityManager.createEntity('test');
            entityManager.destroyEntity(id);

            // Create multiple entities and verify no duplicates in living entities
            const id1 = entityManager.createEntity('test1');
            const id2 = entityManager.createEntity('test2');

            const livingEntities = entityManager.getLivingEntities();
            const livingIndices = entityManager.getLivingEntitesIndex();

            const entitySet = new Set(livingEntities);
            const indexSet = new Set(livingIndices);

            expect(entitySet.size).toBe(livingEntities.length);
            expect(indexSet.size).toBe(livingIndices.length);
            expect(entityManager.getLivingEntityCount()).toBe(2);
        });
    });
});
