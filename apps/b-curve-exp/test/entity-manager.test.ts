import { EntityManager } from '../src/utils';

describe('EntityManager', () => {
    let entityManager: EntityManager<string>;
    
    beforeEach(() => {
        entityManager = new EntityManager<string>(3);
    });
    
    describe('constructor', () => {
        it('should initialize with correct initial state', () => {
            expect(entityManager['_maxEntities']).toBe(3);
            expect(entityManager['_livingEntityCount']).toBe(0);
            expect(entityManager['_availableEntities']).toEqual([0, 1, 2]);
            expect(entityManager['_entities']).toEqual([null, null, null]);
        });
        
        it('should handle zero initial count', () => {
            const zeroManager = new EntityManager<string>(0);
            expect(zeroManager['_maxEntities']).toBe(0);
            expect(zeroManager['_availableEntities']).toEqual([]);
            expect(zeroManager['_entities']).toEqual([]);
        });
    });
    
    describe('createEntity', () => {
        it('should create an entity and return its ID', () => {
            const entityId = entityManager.createEntity('test-entity');
            
            expect(entityId).toBe(0);
            expect(entityManager['_entities'][0]).toBe('test-entity');
            expect(entityManager['_livingEntityCount']).toBe(1);
            expect(entityManager['_availableEntities']).toEqual([1, 2]);
        });
        
        it('should create multiple entities in sequence', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            const id3 = entityManager.createEntity('entity-3');
            
            expect(id1).toBe(0);
            expect(id2).toBe(1);
            expect(id3).toBe(2);
            expect(entityManager['_livingEntityCount']).toBe(3);
            expect(entityManager['_availableEntities']).toEqual([]);
            expect(entityManager['_entities']).toEqual(['entity-1', 'entity-2', 'entity-3']);
        });
        
        it('should expand capacity when max entities reached', () => {
            // Fill up the initial capacity
            entityManager.createEntity('entity-1');
            entityManager.createEntity('entity-2');
            entityManager.createEntity('entity-3');
            
            // This should trigger expansion
            const id4 = entityManager.createEntity('entity-4');
            
            expect(id4).toBe(3);
            expect(entityManager['_maxEntities']).toBe(6); // Doubled from 3
            expect(entityManager['_livingEntityCount']).toBe(4);
            expect(entityManager['_entities'][3]).toBe('entity-4');
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
            expect(entityManager['_maxEntities']).toBe(12); // Doubled from 6
            expect(entityManager['_livingEntityCount']).toBe(7);
        });
        
        it('should reuse available entity IDs after destruction', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            
            entityManager.destroyEntity(id1);
            
            const id3 = entityManager.createEntity('entity-3');
            
            expect(id3).toBe(2); // Should reuse the next available ID (2, since 0 was destroyed and added to end)
            expect(entityManager['_entities'][id3]).toBe('entity-3');
            expect(entityManager['_livingEntityCount']).toBe(2);
        });
    });
    
    describe('destroyEntity', () => {
        it('should destroy an existing entity', () => {
            const entityId = entityManager.createEntity('test-entity');
            entityManager.destroyEntity(entityId);
            
            expect(entityManager['_entities'][entityId]).toBe(null);
            expect(entityManager['_livingEntityCount']).toBe(0);
            expect(entityManager['_availableEntities']).toContain(entityId);
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
            
            expect(entityManager['_livingEntityCount']).toBe(1);
            expect(entityManager['_entities'][id1]).toBe(null);
            expect(entityManager['_entities'][id3]).toBe(null);
            expect(entityManager['_entities'][id2]).toBe('entity-2');
            expect(entityManager['_availableEntities']).toContain(id1);
            expect(entityManager['_availableEntities']).toContain(id3);
        });
        
        it('should maintain correct available entities order', () => {
            const id1 = entityManager.createEntity('entity-1');
            const id2 = entityManager.createEntity('entity-2');
            
            entityManager.destroyEntity(id1);
            entityManager.destroyEntity(id2);
            
            // Available entities should be in order: [2, 0, 1] since 2 was never used, 0 was destroyed first, then 1
            expect(entityManager['_availableEntities']).toEqual([2, 0, 1]);
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
            
            expect(entityManager['_livingEntityCount']).toBe(0);
            expect(entityManager['_maxEntities']).toBeGreaterThanOrEqual(10);
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
            expect(entityManager['_livingEntityCount']).toBe(1);
            expect(entityManager['_entities'][newId]).toBe('new-entity');
        });
        
        it('should handle generic types correctly', () => {
            interface TestEntity {
                name: string;
                value: number;
            }
            
            const typedManager = new EntityManager<TestEntity>(2);
            const entity: TestEntity = { name: 'test', value: 42 };
            
            const id = typedManager.createEntity(entity);
            expect(id).toBe(0);
        });
    });
    
    describe('state consistency', () => {
        it('should maintain consistent state across operations', () => {
            // Initial state
            expect(entityManager['_availableEntities'].length + entityManager['_livingEntityCount']).toBe(entityManager['_maxEntities']);
            
            // After creating entity
            const id = entityManager.createEntity('test');
            expect(entityManager['_availableEntities'].length + entityManager['_livingEntityCount']).toBe(entityManager['_maxEntities']);
            
            // After destroying entity
            entityManager.destroyEntity(id);
            expect(entityManager['_availableEntities'].length + entityManager['_livingEntityCount']).toBe(entityManager['_maxEntities']);
        });
        
        it('should not have duplicate IDs in available entities', () => {
            const id = entityManager.createEntity('test');
            entityManager.destroyEntity(id);
            
            const availableSet = new Set(entityManager['_availableEntities']);
            expect(availableSet.size).toBe(entityManager['_availableEntities'].length);
        });
    });
});
