import { NumberManager } from '../src/utils';

describe('NumberManager', () => {
    let numberManager: NumberManager;
    
    beforeEach(() => {
        numberManager = new NumberManager(3);
    });
    
    describe('constructor', () => {
        it('should initialize with correct initial state', () => {
            expect(numberManager['_maxEntities']).toBe(3);
            expect(numberManager['_livingEntityCount']).toBe(0);
            expect(numberManager['_availableEntities']).toEqual([0, 1, 2]);
        });
        
        it('should handle zero initial count', () => {
            const zeroManager = new NumberManager(0);
            expect(zeroManager['_maxEntities']).toBe(0);
            expect(zeroManager['_availableEntities']).toEqual([]);
        });
    });
    
    describe('createEntity', () => {
        it('should create an entity and return its ID', () => {
            const entityId = numberManager.createEntity();
            
            expect(entityId).toBe(0);
            expect(numberManager['_livingEntityCount']).toBe(1);
            expect(numberManager['_availableEntities']).toEqual([1, 2]);
        });
        
        it('should create multiple entities in sequence', () => {
            const id1 = numberManager.createEntity();
            const id2 = numberManager.createEntity();
            const id3 = numberManager.createEntity();
            
            expect(id1).toBe(0);
            expect(id2).toBe(1);
            expect(id3).toBe(2);
            expect(numberManager['_livingEntityCount']).toBe(3);
            expect(numberManager['_availableEntities']).toEqual([]);
        });
        
        it('should expand capacity when max entities reached', () => {
            // Fill up the initial capacity
            numberManager.createEntity();
            numberManager.createEntity();
            numberManager.createEntity();
            
            // This should trigger expansion
            const id4 = numberManager.createEntity();
            
            expect(id4).toBe(3);
            expect(numberManager['_maxEntities']).toBe(6); // Doubled from 3
            expect(numberManager['_livingEntityCount']).toBe(4);
        });
        
        it('should handle multiple expansions', () => {
            // Fill up initial capacity
            numberManager.createEntity();
            numberManager.createEntity();
            numberManager.createEntity();
            
            // First expansion
            numberManager.createEntity();
            numberManager.createEntity();
            numberManager.createEntity();
            
            // Second expansion
            const id7 = numberManager.createEntity();
            
            expect(id7).toBe(6);
            expect(numberManager['_maxEntities']).toBe(12); // Doubled from 6
            expect(numberManager['_livingEntityCount']).toBe(7);
        });
        
        it('should reuse available entity IDs after destruction', () => {
            const id1 = numberManager.createEntity();
            const id2 = numberManager.createEntity();
            
            numberManager.destroyEntity(id1);
            
            const id3 = numberManager.createEntity();
            
            expect(id3).toBe(2); // Should reuse the next available ID (2, since 0 was destroyed and added to end)
            expect(numberManager['_livingEntityCount']).toBe(2);
        });
    });
    
    describe('destroyEntity', () => {
        it('should destroy an existing entity', () => {
            const entityId = numberManager.createEntity();
            numberManager.destroyEntity(entityId);
            
            expect(numberManager['_livingEntityCount']).toBe(0);
            expect(numberManager['_availableEntities']).toContain(entityId);
        });
        
        it('should throw error for invalid entity ID (negative)', () => {
            expect(() => {
                numberManager.destroyEntity(-1);
            }).toThrow('Invalid entity out of range');
        });
        
        it('should throw error for invalid entity ID (out of range)', () => {
            expect(() => {
                numberManager.destroyEntity(5);
            }).toThrow('Invalid entity out of range');
        });
        
        it('should handle destroying multiple entities', () => {
            const id1 = numberManager.createEntity();
            const id2 = numberManager.createEntity();
            const id3 = numberManager.createEntity();
            
            numberManager.destroyEntity(id1);
            numberManager.destroyEntity(id3);
            
            expect(numberManager['_livingEntityCount']).toBe(1);
            expect(numberManager['_availableEntities']).toContain(id1);
            expect(numberManager['_availableEntities']).toContain(id3);
        });
        
        it('should maintain correct available entities order', () => {
            const id1 = numberManager.createEntity();
            const id2 = numberManager.createEntity();
            
            numberManager.destroyEntity(id1);
            numberManager.destroyEntity(id2);
            
            // Available entities should be in order: [2, 0, 1] since 2 was never used, 0 was destroyed first, then 1
            expect(numberManager['_availableEntities']).toEqual([2, 0, 1]);
        });
    });
    
    describe('edge cases and stress testing', () => {
        it('should handle rapid create/destroy cycles', () => {
            const ids: number[] = [];
            
            // Create entities
            for (let i = 0; i < 10; i++) {
                ids.push(numberManager.createEntity());
            }
            
            // Destroy them in reverse order
            for (let i = ids.length - 1; i >= 0; i--) {
                numberManager.destroyEntity(ids[i]);
            }
            
            expect(numberManager['_livingEntityCount']).toBe(0);
            expect(numberManager['_maxEntities']).toBeGreaterThanOrEqual(10);
        });
        
        it('should handle creating entity after all are destroyed', () => {
            // Create and destroy all initial entities
            const id1 = numberManager.createEntity();
            const id2 = numberManager.createEntity();
            const id3 = numberManager.createEntity();
            
            numberManager.destroyEntity(id1);
            numberManager.destroyEntity(id2);
            numberManager.destroyEntity(id3);
            
            // Create a new entity - should reuse an available ID
            const newId = numberManager.createEntity();
            
            expect(newId).toBe(0); // Should reuse the first available ID (0, since it was destroyed first)
            expect(numberManager['_livingEntityCount']).toBe(1);
        });
        
        it('should handle very large initial counts', () => {
            const largeManager = new NumberManager(1000);
            expect(largeManager['_maxEntities']).toBe(1000);
            expect(largeManager['_availableEntities'].length).toBe(1000);
        });
    });
    
    describe('state consistency', () => {
        it('should maintain consistent state across operations', () => {
            // Initial state
            expect(numberManager['_availableEntities'].length + numberManager['_livingEntityCount']).toBe(numberManager['_maxEntities']);
            
            // After creating entity
            const id = numberManager.createEntity();
            expect(numberManager['_availableEntities'].length + numberManager['_livingEntityCount']).toBe(numberManager['_maxEntities']);
            
            // After destroying entity
            numberManager.destroyEntity(id);
            expect(numberManager['_availableEntities'].length + numberManager['_livingEntityCount']).toBe(numberManager['_maxEntities']);
        });
        
        it('should not have duplicate IDs in available entities', () => {
            const id = numberManager.createEntity();
            numberManager.destroyEntity(id);
            
            const availableSet = new Set(numberManager['_availableEntities']);
            expect(availableSet.size).toBe(numberManager['_availableEntities'].length);
        });
        
        it('should maintain unique IDs across all operations', () => {
            const createdIds = new Set<number>();
            const destroyedIds = new Set<number>();
            
            // Create multiple entities
            for (let i = 0; i < 5; i++) {
                const id = numberManager.createEntity();
                createdIds.add(id);
            }
            
            // Destroy some entities
            for (const id of createdIds) {
                if (id % 2 === 0) { // Destroy even IDs
                    numberManager.destroyEntity(id);
                    destroyedIds.add(id);
                }
            }
            
            // Create new entities (should reuse destroyed IDs)
            for (let i = 0; i < 3; i++) {
                const newId = numberManager.createEntity();
                // New IDs should not conflict with existing ones
                expect(createdIds.has(newId) && !destroyedIds.has(newId)).toBe(false);
            }
        });
    });
    
    describe('comparison with EntityManager', () => {
        it('should behave similarly to EntityManager for ID management', () => {
            const entityManager = new (require('../src/utils').EntityManager)(3);
            const numberManager = new NumberManager(3);
            
            // Both should start with same available IDs
            expect(entityManager['_availableEntities']).toEqual(numberManager['_availableEntities']);
            
            // Both should create entities with same IDs
            const entityId = entityManager.createEntity('test');
            const numberId = numberManager.createEntity();
            
            expect(entityId).toBe(numberId);
            expect(entityManager['_livingEntityCount']).toBe(numberManager['_livingEntityCount']);
        });
        
        it('should have same expansion behavior', () => {
            const entityManager = new (require('../src/utils').EntityManager)(3);
            const numberManager = new NumberManager(3);
            
            // Fill both to capacity
            for (let i = 0; i < 3; i++) {
                entityManager.createEntity('test');
                numberManager.createEntity();
            }
            
            // Both should expand
            entityManager.createEntity('test');
            numberManager.createEntity();
            
            expect(entityManager['_maxEntities']).toBe(numberManager['_maxEntities']);
            expect(entityManager['_livingEntityCount']).toBe(numberManager['_livingEntityCount']);
        });
    });
});
