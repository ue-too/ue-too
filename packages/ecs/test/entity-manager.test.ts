import { EntityManager } from '../src';

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

    it('should get all living entities', () => {
        const entityManager = new EntityManager();
        const entity1 = entityManager.createEntity();
        const entity2 = entityManager.createEntity();
        const entity3 = entityManager.createEntity();

        const allEntities = entityManager.getAllLivingEntities();
        expect(allEntities.length).toBe(3);
        expect(allEntities).toContain(entity1);
        expect(allEntities).toContain(entity2);
        expect(allEntities).toContain(entity3);

        entityManager.destroyEntity(entity2);
        const remainingEntities = entityManager.getAllLivingEntities();
        expect(remainingEntities.length).toBe(2);
        expect(remainingEntities).toContain(entity1);
        expect(remainingEntities).toContain(entity3);
        expect(remainingEntities).not.toContain(entity2);
    });

    it('should return empty array when no entities exist', () => {
        const entityManager = new EntityManager();
        const allEntities = entityManager.getAllLivingEntities();
        expect(allEntities).toEqual([]);
    });
});
