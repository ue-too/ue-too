import {
    ComponentSchema,
    Coordinator,
    SerializedECSState,
    createComponentName,
    createGlobalComponentName,
} from '../src';

// Use global symbols for serialization tests
const GLOBAL_POSITION = createGlobalComponentName('Position');
const GLOBAL_VELOCITY = createGlobalComponentName('Velocity');
const GLOBAL_HEALTH = createGlobalComponentName('Health');

describe('Coordinator - State Management and Serialization', () => {
    it('should get all living entities', () => {
        const coordinator = new Coordinator();

        const entity1 = coordinator.createEntity();
        const entity2 = coordinator.createEntity();
        const entity3 = coordinator.createEntity();

        const allEntities = coordinator.getAllEntities();
        expect(allEntities.length).toBe(3);
        expect(allEntities).toContain(entity1);
        expect(allEntities).toContain(entity2);
        expect(allEntities).toContain(entity3);

        coordinator.destroyEntity(entity2);
        const remainingEntities = coordinator.getAllEntities();
        expect(remainingEntities.length).toBe(2);
        expect(remainingEntities).toContain(entity1);
        expect(remainingEntities).toContain(entity3);
        expect(remainingEntities).not.toContain(entity2);
    });

    it('should return empty array when no entities exist', () => {
        const coordinator = new Coordinator();
        const allEntities = coordinator.getAllEntities();
        expect(allEntities).toEqual([]);
    });

    it('should get all components for an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        const entity = coordinator.createEntity();
        const position = { x: 10, y: 20 };
        const velocity = { x: 1, y: 2 };
        const health = { current: 100, max: 100 };

        coordinator.addComponentToEntity(GLOBAL_POSITION, entity, position);
        coordinator.addComponentToEntity(GLOBAL_VELOCITY, entity, velocity);
        coordinator.addComponentToEntity(GLOBAL_HEALTH, entity, health);

        const components = coordinator.getEntityComponents(entity);
        expect(components).not.toBeNull();
        expect(components!.size).toBe(3);
        expect(components!.get(GLOBAL_POSITION)).toEqual(position);
        expect(components!.get(GLOBAL_VELOCITY)).toEqual(velocity);
        expect(components!.get(GLOBAL_HEALTH)).toEqual(health);
    });

    it('should return null for entity with no components', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        const entity = coordinator.createEntity();
        const components = coordinator.getEntityComponents(entity);
        expect(components).toBeNull();
    });

    it('should return null for non-existent entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        const components = coordinator.getEntityComponents(999);
        expect(components).toBeNull();
    });

    it('should get full state of ECS', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });
        coordinator.addComponentToEntity(GLOBAL_VELOCITY, entity1, {
            x: 1,
            y: 2,
        });

        const entity2 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });
        coordinator.addComponentToEntity(GLOBAL_HEALTH, entity2, {
            current: 50,
            max: 100,
        });

        const state = coordinator.getFullState();
        expect(state.entities.length).toBe(2);

        const entity1Data = state.entities.find(e => e.entity === entity1);
        expect(entity1Data).toBeDefined();
        expect(entity1Data!.components.size).toBe(2);
        expect(entity1Data!.components.get(GLOBAL_POSITION)).toEqual({
            x: 10,
            y: 20,
        });
        expect(entity1Data!.components.get(GLOBAL_VELOCITY)).toEqual({
            x: 1,
            y: 2,
        });

        const entity2Data = state.entities.find(e => e.entity === entity2);
        expect(entity2Data).toBeDefined();
        expect(entity2Data!.components.size).toBe(2);
        expect(entity2Data!.components.get(GLOBAL_POSITION)).toEqual({
            x: 30,
            y: 40,
        });
        expect(entity2Data!.components.get(GLOBAL_HEALTH)).toEqual({
            current: 50,
            max: 100,
        });
    });

    it('should include all entities in full state even if they have no components', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });

        const entity2 = coordinator.createEntity();
        // entity2 has no components

        const state = coordinator.getFullState();
        // Should include both entities, but entity2 will have empty components map
        expect(state.entities.length).toBe(2);
        const entity1Data = state.entities.find(e => e.entity === entity1);
        const entity2Data = state.entities.find(e => e.entity === entity2);
        expect(entity1Data).toBeDefined();
        expect(entity1Data!.components.size).toBe(1);
        expect(entity2Data).toBeDefined();
        expect(entity2Data!.components.size).toBe(0);
    });

    it('should serialize ECS state to JSON-compatible format', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });
        coordinator.addComponentToEntity(GLOBAL_VELOCITY, entity1, {
            x: 1,
            y: 2,
        });

        const entity2 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });
        coordinator.addComponentToEntity(GLOBAL_HEALTH, entity2, {
            current: 50,
            max: 100,
        });

        const serialized = coordinator.serialize();

        expect(serialized.entities.length).toBe(2);

        const entity1Serialized = serialized.entities.find(
            e => e.entity === entity1
        );
        expect(entity1Serialized).toBeDefined();
        expect(entity1Serialized!.components['Position']).toEqual({
            x: 10,
            y: 20,
        });
        expect(entity1Serialized!.components['Velocity']).toEqual({
            x: 1,
            y: 2,
        });

        const entity2Serialized = serialized.entities.find(
            e => e.entity === entity2
        );
        expect(entity2Serialized).toBeDefined();
        expect(entity2Serialized!.components['Position']).toEqual({
            x: 30,
            y: 40,
        });
        expect(entity2Serialized!.components['Health']).toEqual({
            current: 50,
            max: 100,
        });

        // Should be JSON-serializable
        const json = JSON.stringify(serialized);
        expect(json).toBeDefined();
        const parsed = JSON.parse(json);
        expect(parsed.entities.length).toBe(2);
    });

    it('should throw error when serializing with non-global symbols', () => {
        const coordinator = new Coordinator();
        const LOCAL_COMPONENT = createComponentName('LocalComponent'); // Not global
        coordinator.registerComponent<{ value: number }>(LOCAL_COMPONENT);

        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(LOCAL_COMPONENT, entity, {
            value: 42,
        });

        expect(() => {
            coordinator.serialize();
        }).toThrow(/not a global symbol/);
    });

    it('should serialize empty ECS state', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        const serialized = coordinator.serialize();
        expect(serialized.entities).toEqual([]);
    });

    it('should include schemas in serialized state when available', () => {
        const coordinator = new Coordinator();
        const schema: ComponentSchema = {
            componentName: GLOBAL_HEALTH,
            fields: [
                { name: 'current', type: 'number', defaultValue: 100 },
                { name: 'max', type: 'number', defaultValue: 100 },
            ],
        };

        coordinator.registerComponentWithSchema(schema);
        const entity = coordinator.createEntity();
        const component = coordinator.createComponentFromSchema(GLOBAL_HEALTH);
        coordinator.addComponentToEntityWithSchema(
            GLOBAL_HEALTH,
            entity,
            component
        );

        const serialized = coordinator.serialize();
        expect(serialized.schemas).toBeDefined();
        expect(serialized.schemas!.length).toBe(1);
        expect(serialized.schemas![0].componentName).toBe('Health');
        expect(serialized.schemas![0].fields.length).toBe(2);
    });

    it('should deserialize ECS state', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        // Create initial state
        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });
        coordinator.addComponentToEntity(GLOBAL_VELOCITY, entity1, {
            x: 1,
            y: 2,
        });

        const entity2 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });
        coordinator.addComponentToEntity(GLOBAL_HEALTH, entity2, {
            current: 50,
            max: 100,
        });

        // Serialize
        const serialized = coordinator.serialize();

        // Create new coordinator and deserialize
        const newCoordinator = new Coordinator();
        newCoordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        newCoordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        newCoordinator.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        newCoordinator.deserialize(serialized, { clearExisting: true });

        // Verify deserialized state
        const allEntities = newCoordinator.getAllEntities();
        expect(allEntities.length).toBe(2);

        // Check first entity (may have different ID)
        const newEntity1 = allEntities[0];
        const pos1 = newCoordinator.getComponentFromEntity<{
            x: number;
            y: number;
        }>(GLOBAL_POSITION, newEntity1);
        const vel1 = newCoordinator.getComponentFromEntity<{
            x: number;
            y: number;
        }>(GLOBAL_VELOCITY, newEntity1);

        if (pos1 && vel1) {
            expect(pos1).toEqual({ x: 10, y: 20 });
            expect(vel1).toEqual({ x: 1, y: 2 });
        } else {
            // Check second entity instead
            const newEntity2 = allEntities[1];
            const pos2 = newCoordinator.getComponentFromEntity<{
                x: number;
                y: number;
            }>(GLOBAL_POSITION, newEntity2);
            const health2 = newCoordinator.getComponentFromEntity<{
                current: number;
                max: number;
            }>(GLOBAL_HEALTH, newEntity2);
            expect(pos2).toEqual({ x: 30, y: 40 });
            expect(health2).toEqual({ current: 50, max: 100 });
        }
    });

    it('should throw error when deserializing with unregistered component', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity, {
            x: 10,
            y: 20,
        });

        const serialized = coordinator.serialize();

        const newCoordinator = new Coordinator();
        // Don't register GLOBAL_POSITION

        expect(() => {
            newCoordinator.deserialize(serialized);
        }).toThrow(/not registered/);
    });

    it('should handle deserialization with clearExisting option', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        // Create initial entity
        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });

        // Serialize
        const serialized = coordinator.serialize();

        // Add more entities before deserializing
        const entity2 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });

        // Deserialize with clearExisting: true
        coordinator.deserialize(serialized, { clearExisting: true });

        // Should only have entities from serialized state
        const allEntities = coordinator.getAllEntities();
        expect(allEntities.length).toBe(1);
    });

    it('should handle deserialization without clearExisting option', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );

        // Create initial entity
        const entity1 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });

        // Serialize
        const serialized = coordinator.serialize();

        // Add more entities before deserializing
        const entity2 = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });

        // Deserialize with clearExisting: false (default)
        coordinator.deserialize(serialized, { clearExisting: false });

        // Should have both old and new entities
        const allEntities = coordinator.getAllEntities();
        expect(allEntities.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle round-trip serialization/deserialization', () => {
        const coordinator1 = new Coordinator();
        coordinator1.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator1.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator1.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        const entity1 = coordinator1.createEntity();
        coordinator1.addComponentToEntity(GLOBAL_POSITION, entity1, {
            x: 10,
            y: 20,
        });
        coordinator1.addComponentToEntity(GLOBAL_VELOCITY, entity1, {
            x: 1,
            y: 2,
        });

        const entity2 = coordinator1.createEntity();
        coordinator1.addComponentToEntity(GLOBAL_POSITION, entity2, {
            x: 30,
            y: 40,
        });
        coordinator1.addComponentToEntity(GLOBAL_HEALTH, entity2, {
            current: 50,
            max: 100,
        });

        // Serialize
        const serialized = coordinator1.serialize();
        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json) as SerializedECSState;

        // Deserialize into new coordinator
        const coordinator2 = new Coordinator();
        coordinator2.registerComponent<{ x: number; y: number }>(
            GLOBAL_POSITION
        );
        coordinator2.registerComponent<{ x: number; y: number }>(
            GLOBAL_VELOCITY
        );
        coordinator2.registerComponent<{ current: number; max: number }>(
            GLOBAL_HEALTH
        );

        coordinator2.deserialize(parsed, { clearExisting: true });

        // Verify all entities and components
        const state2 = coordinator2.getFullState();
        expect(state2.entities.length).toBe(2);

        // Verify component data matches
        const allEntities2 = coordinator2.getAllEntities();
        const components1 = coordinator1.getEntityComponents(entity1);
        const components2 = coordinator2.getEntityComponents(allEntities2[0]);

        // Components should match (order may differ)
        expect(components2).not.toBeNull();
        if (components1 && components2) {
            // Check that we have the same number of components
            expect(components2.size).toBe(components1.size);
        }
    });

    it('should handle deserialization with schema-based components', () => {
        const coordinator1 = new Coordinator();
        const schema: ComponentSchema = {
            componentName: GLOBAL_HEALTH,
            fields: [
                { name: 'current', type: 'number', defaultValue: 100 },
                { name: 'max', type: 'number', defaultValue: 100 },
            ],
        };

        coordinator1.registerComponentWithSchema(schema);
        const entity = coordinator1.createEntity();
        const component = coordinator1.createComponentFromSchema(
            GLOBAL_HEALTH,
            { current: 75 }
        );
        coordinator1.addComponentToEntityWithSchema(
            GLOBAL_HEALTH,
            entity,
            component
        );

        // Serialize
        const serialized = coordinator1.serialize();

        // Deserialize into new coordinator
        const coordinator2 = new Coordinator();
        coordinator2.registerComponentWithSchema(schema);
        coordinator2.deserialize(serialized, { clearExisting: true });

        // Verify
        const allEntities = coordinator2.getAllEntities();
        expect(allEntities.length).toBe(1);

        const health = coordinator2.getComponentFromEntity<
            Record<string, unknown>
        >(GLOBAL_HEALTH, allEntities[0]);
        expect(health).toEqual({ current: 75, max: 100 });
    });

    it('should handle complex nested data structures in serialization', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<{ data: { nested: { value: number } } }>(
            GLOBAL_POSITION
        );

        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(GLOBAL_POSITION, entity, {
            data: {
                nested: {
                    value: 42,
                },
            },
        });

        const serialized = coordinator.serialize();
        expect(serialized.entities.length).toBe(1);
        expect(serialized.entities[0].components['Position']).toEqual({
            data: {
                nested: {
                    value: 42,
                },
            },
        });

        // Should be JSON-serializable
        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json);
        expect(
            parsed.entities[0].components['Position'].data.nested.value
        ).toBe(42);
    });
});
