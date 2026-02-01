import {
    ComponentSchema,
    Coordinator,
    Entity,
    SerializedComponentSchema,
    createComponentName,
    createGlobalComponentName,
    deserializeComponentSchema,
} from '@ue-too/ecs';
import { readFileSync } from 'fs';
import { join } from 'path';

import { NumberModificationEffect } from '../src/action-system/effect';

describe('NumberModificationEffect', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const HEALTH_COMPONENT = createGlobalComponentName('HealthComponent');
    const STATS_COMPONENT = createGlobalComponentName('StatsComponent');

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('apply', () => {
        it('should deduct the specified amount from a number field', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'maxHealth', type: 'number', defaultValue: 100 },
                ],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                25,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(75);
        });

        it('should deduct multiple times when applied repeatedly', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                10,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();
            effect.apply();
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(70);
        });

        it('should handle negative deductions (adding to the value)', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 50 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 50 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                -20,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(70);
        });

        it('should not modify the value if the schema does not exist', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const nonExistentComponent = createComponentName(
                'NonExistentComponent'
            );
            const effect = new NumberModificationEffect(
                coordinator,
                25,
                nonExistentComponent,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the component does not exist on the entity', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const otherEntity = coordinator.createEntity();
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                otherEntity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                25,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, otherEntity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the field does not exist in the schema', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                25,
                HEALTH_COMPONENT,
                entity,
                'nonExistentField',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the field value is not a number', () => {
            const schema: ComponentSchema = {
                componentName: STATS_COMPONENT,
                fields: [
                    { name: 'name', type: 'string', defaultValue: 'Player' },
                    { name: 'level', type: 'number', defaultValue: 1 },
                ],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                STATS_COMPONENT,
                { name: 'Player', level: 5 }
            );
            coordinator.addComponentToEntityWithSchema(
                STATS_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                1,
                STATS_COMPONENT,
                entity,
                'name',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(STATS_COMPONENT, entity);
            expect(updatedComponent?.name).toBe('Player');
            expect(updatedComponent?.level).toBe(5);
        });

        it('should not modify the value if the field value is undefined', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', optional: true }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                {}
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                25,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBeUndefined();
        });

        it('should only modify the specified field, leaving other fields unchanged', () => {
            const schema: ComponentSchema = {
                componentName: STATS_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'mana', type: 'number', defaultValue: 50 },
                    { name: 'stamina', type: 'number', defaultValue: 75 },
                ],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                STATS_COMPONENT,
                {
                    health: 100,
                    mana: 50,
                    stamina: 75,
                }
            );
            coordinator.addComponentToEntityWithSchema(
                STATS_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                20,
                STATS_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(STATS_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(80);
            expect(updatedComponent?.mana).toBe(50);
            expect(updatedComponent?.stamina).toBe(75);
        });

        it('should handle zero deduction amount', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            const effect = new NumberModificationEffect(
                coordinator,
                0,
                HEALTH_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should handle zero as a valid field value', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 0 },
                    { name: 'score', type: 'number', defaultValue: 0 },
                ],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT,
                { health: 0, score: 0 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT,
                entity,
                component
            );

            // Add to zero value
            const addEffect = new NumberModificationEffect(
                coordinator,
                50,
                HEALTH_COMPONENT,
                entity,
                'health',
                'add'
            );
            addEffect.apply();

            // Subtract from zero value (should go negative)
            const subtractEffect = new NumberModificationEffect(
                coordinator,
                10,
                HEALTH_COMPONENT,
                entity,
                'score',
                'subtract'
            );
            subtractEffect.apply();

            // Set to zero
            const setEffect = new NumberModificationEffect(
                coordinator,
                0,
                HEALTH_COMPONENT,
                entity,
                'health',
                'set'
            );
            setEffect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(0); // Set to 0
            expect(updatedComponent?.score).toBe(-10); // 0 - 10
        });

        it('should work with schema loaded from JSON file', () => {
            // Read schema from JSON file
            const schemaPath = join(
                __dirname,
                'fixtures',
                'player-stats-schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const serializedSchema: SerializedComponentSchema =
                JSON.parse(schemaJson);

            // Deserialize the schema
            const schema = deserializeComponentSchema(serializedSchema);
            const PLAYER_STATS_COMPONENT = schema.componentName;

            // Register the schema with coordinator
            coordinator.registerComponentWithSchema(schema);

            // Create component from schema with initial values
            const component = coordinator.createComponentFromSchema(
                PLAYER_STATS_COMPONENT,
                {
                    health: 100,
                    maxHealth: 100,
                    mana: 50,
                    level: 5,
                    experience: 250,
                }
            );
            coordinator.addComponentToEntityWithSchema(
                PLAYER_STATS_COMPONENT,
                entity,
                component
            );

            // Test subtract operation on health
            const healthEffect = new NumberModificationEffect(
                coordinator,
                25,
                PLAYER_STATS_COMPONENT,
                entity,
                'health',
                'subtract'
            );
            healthEffect.apply();

            // Test add operation on mana
            const manaEffect = new NumberModificationEffect(
                coordinator,
                10,
                PLAYER_STATS_COMPONENT,
                entity,
                'mana',
                'add'
            );
            manaEffect.apply();

            // Test set operation on experience
            const expEffect = new NumberModificationEffect(
                coordinator,
                500,
                PLAYER_STATS_COMPONENT,
                entity,
                'experience',
                'set'
            );
            expEffect.apply();

            // Verify all modifications
            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(PLAYER_STATS_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(75); // 100 - 25
            expect(updatedComponent?.maxHealth).toBe(100); // unchanged
            expect(updatedComponent?.mana).toBe(60); // 50 + 10
            expect(updatedComponent?.level).toBe(5); // unchanged
            expect(updatedComponent?.experience).toBe(500); // set to 500
        });

        it('should work with schema loaded from JSON file using multiple operations', () => {
            // Read schema from JSON file
            const schemaPath = join(
                __dirname,
                'fixtures',
                'player-stats-schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const serializedSchema: SerializedComponentSchema =
                JSON.parse(schemaJson);

            // Deserialize the schema
            const schema = deserializeComponentSchema(serializedSchema);
            const PLAYER_STATS_COMPONENT = schema.componentName;

            // Register the schema with coordinator
            coordinator.registerComponentWithSchema(schema);

            // Create component from schema
            // Test that 0 is a valid value for numbers (previously this would fail due to falsy check)
            const component = coordinator.createComponentFromSchema(
                PLAYER_STATS_COMPONENT,
                {
                    health: 100,
                    maxHealth: 100,
                    mana: 50,
                    level: 1,
                    experience: 0,
                }
            );
            coordinator.addComponentToEntityWithSchema(
                PLAYER_STATS_COMPONENT,
                entity,
                component
            );

            // Apply multiple effects in sequence
            const effects = [
                new NumberModificationEffect(
                    coordinator,
                    20,
                    PLAYER_STATS_COMPONENT,
                    entity,
                    'health',
                    'subtract'
                ),
                new NumberModificationEffect(
                    coordinator,
                    15,
                    PLAYER_STATS_COMPONENT,
                    entity,
                    'health',
                    'subtract'
                ),
                new NumberModificationEffect(
                    coordinator,
                    5,
                    PLAYER_STATS_COMPONENT,
                    entity,
                    'mana',
                    'add'
                ),
                new NumberModificationEffect(
                    coordinator,
                    100,
                    PLAYER_STATS_COMPONENT,
                    entity,
                    'experience',
                    'add'
                ),
                new NumberModificationEffect(
                    coordinator,
                    1,
                    PLAYER_STATS_COMPONENT,
                    entity,
                    'level',
                    'add'
                ),
            ];

            effects.forEach(effect => effect.apply());

            // Verify cumulative changes
            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(PLAYER_STATS_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(65); // 100 - 20 - 15
            expect(updatedComponent?.maxHealth).toBe(100); // unchanged
            expect(updatedComponent?.mana).toBe(55); // 50 + 5
            expect(updatedComponent?.level).toBe(2); // 1 + 1
            expect(updatedComponent?.experience).toBe(100); // 0 + 100 (0 is now a valid value)
        });
    });
});
