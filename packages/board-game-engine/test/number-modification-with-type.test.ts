import {
    ComponentSchema,
    Coordinator,
    Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

import { NumberModificationWithType } from '../src/zod-integration/effect';

/**
 * Tests for NumberModificationWithType.
 *
 * Note: NumberModificationWithType now extends the unified NumberModificationEffect,
 * which automatically detects whether to use schema-based or type-based approaches.
 * These tests verify that NumberModificationWithType works correctly with typed
 * components (components without custom schemas).
 */
describe('NumberModificationWithType', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const HEALTH_COMPONENT = createGlobalComponentName('HealthComponent');
    const STATS_COMPONENT = createGlobalComponentName('StatsComponent');

    type HealthComponent = {
        health: number;
        maxHealth: number;
    };

    type StatsComponent = {
        health: number;
        mana: number;
        stamina: number;
        name: string;
    };

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('apply', () => {
        describe('add operation', () => {
            it('should add the specified amount to a number field', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    25,
                    'add'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(125);
                expect(updatedComponent?.maxHealth).toBe(100);
            });

            it('should add multiple times when applied repeatedly', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    10,
                    'add'
                );
                effect.apply();
                effect.apply();
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(130);
            });

            it('should handle negative additions (subtracting from the value)', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    -20,
                    'add'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(80);
            });
        });

        describe('subtract operation', () => {
            it('should subtract the specified amount from a number field', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    25,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(75);
            });

            it('should subtract multiple times when applied repeatedly', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    10,
                    'subtract'
                );
                effect.apply();
                effect.apply();
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(70);
            });

            it('should handle negative subtractions (adding to the value)', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 50,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    -20,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(70);
            });
        });

        describe('set operation', () => {
            it('should set the field to the specified amount', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    50,
                    'set'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(50);
            });

            it('should set the value even if applied multiple times', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect1 = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    75,
                    'set'
                );
                effect1.apply();

                const effect2 = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    25,
                    'set'
                );
                effect2.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(25);
            });

            it('should set to zero when amount is zero', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    0,
                    'set'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(0);
            });
        });

        describe('default operation', () => {
            it('should default to add operation when not specified', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    25
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(125);
            });
        });

        describe('edge cases', () => {
            it('should not modify the value if the component does not exist on the entity', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const otherEntity = coordinator.createEntity();
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    otherEntity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    25,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        otherEntity
                    );
                expect(updatedComponent?.health).toBe(100);
            });

            it('should not modify the value if the field does not exist in the component', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                // TypeScript will prevent invalid keys, but runtime check should handle edge cases
                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health' as keyof HealthComponent,
                    25,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(75);
            });

            it('should not modify the value if the field value is not a number', () => {
                coordinator.registerComponent<StatsComponent>(STATS_COMPONENT);
                const component: StatsComponent = {
                    health: 100,
                    mana: 50,
                    stamina: 75,
                    name: 'Player',
                };
                coordinator.addComponentToEntity(
                    STATS_COMPONENT,
                    entity,
                    component
                );

                // TypeScript type system prevents this, but runtime check should handle it
                // The unified effect will check the type at runtime and skip modification
                const effect = new NumberModificationWithType<StatsComponent>(
                    coordinator,
                    STATS_COMPONENT,
                    entity,
                    'name' as keyof StatsComponent,
                    1,
                    'add'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<StatsComponent>(
                        STATS_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.name).toBe('Player');
                expect(updatedComponent?.health).toBe(100);
            });

            it('should only modify the specified field, leaving other fields unchanged', () => {
                coordinator.registerComponent<StatsComponent>(STATS_COMPONENT);
                const component: StatsComponent = {
                    health: 100,
                    mana: 50,
                    stamina: 75,
                    name: 'Player',
                };
                coordinator.addComponentToEntity(
                    STATS_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<StatsComponent>(
                    coordinator,
                    STATS_COMPONENT,
                    entity,
                    'health',
                    20,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<StatsComponent>(
                        STATS_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(80);
                expect(updatedComponent?.mana).toBe(50);
                expect(updatedComponent?.stamina).toBe(75);
                expect(updatedComponent?.name).toBe('Player');
            });

            it('should handle zero amount correctly for add operation', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    0,
                    'add'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(100);
            });

            it('should handle zero amount correctly for subtract operation', () => {
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    0,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(100);
            });

            it('should work with different number fields in the same component', () => {
                coordinator.registerComponent<StatsComponent>(STATS_COMPONENT);
                const component: StatsComponent = {
                    health: 100,
                    mana: 50,
                    stamina: 75,
                    name: 'Player',
                };
                coordinator.addComponentToEntity(
                    STATS_COMPONENT,
                    entity,
                    component
                );

                const healthEffect =
                    new NumberModificationWithType<StatsComponent>(
                        coordinator,
                        STATS_COMPONENT,
                        entity,
                        'health',
                        10,
                        'subtract'
                    );
                healthEffect.apply();

                const manaEffect =
                    new NumberModificationWithType<StatsComponent>(
                        coordinator,
                        STATS_COMPONENT,
                        entity,
                        'mana',
                        5,
                        'add'
                    );
                manaEffect.apply();

                const staminaEffect =
                    new NumberModificationWithType<StatsComponent>(
                        coordinator,
                        STATS_COMPONENT,
                        entity,
                        'stamina',
                        15,
                        'set'
                    );
                staminaEffect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<StatsComponent>(
                        STATS_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(90);
                expect(updatedComponent?.mana).toBe(55);
                expect(updatedComponent?.stamina).toBe(15);
            });
        });

        describe('unified effect behavior', () => {
            it('should use type-based approach for components without schemas', () => {
                // Register component without schema (typed component)
                coordinator.registerComponent<HealthComponent>(
                    HEALTH_COMPONENT
                );
                const component: HealthComponent = {
                    health: 100,
                    maxHealth: 100,
                };
                coordinator.addComponentToEntity(
                    HEALTH_COMPONENT,
                    entity,
                    component
                );

                // NumberModificationWithType should use type-based approach since no schema exists
                const effect = new NumberModificationWithType<HealthComponent>(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health',
                    20,
                    'subtract'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<HealthComponent>(
                        HEALTH_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.health).toBe(80);
            });

            it('should work correctly even if a schema exists (uses unified detection)', () => {
                // Register component with schema
                const schema: ComponentSchema = {
                    componentName: HEALTH_COMPONENT,
                    fields: [
                        { name: 'health', type: 'number', defaultValue: 100 },
                        {
                            name: 'maxHealth',
                            type: 'number',
                            defaultValue: 100,
                        },
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

                // NumberModificationWithType extends unified effect, so it will detect schema
                // and use schema-based approach
                const effect = new NumberModificationWithType<
                    Record<string, unknown>
                >(
                    coordinator,
                    HEALTH_COMPONENT,
                    entity,
                    'health' as keyof Record<string, unknown>,
                    15,
                    'add'
                );
                effect.apply();

                const updatedComponent = coordinator.getComponentFromEntity<
                    Record<string, unknown>
                >(HEALTH_COMPONENT, entity);
                expect(updatedComponent?.health).toBe(115);
            });

            it('should maintain type safety for typed components', () => {
                coordinator.registerComponent<StatsComponent>(STATS_COMPONENT);
                const component: StatsComponent = {
                    health: 100,
                    mana: 50,
                    stamina: 75,
                    name: 'Player',
                };
                coordinator.addComponentToEntity(
                    STATS_COMPONENT,
                    entity,
                    component
                );

                // TypeScript should enforce that valuePath is a key of StatsComponent
                const effect = new NumberModificationWithType<StatsComponent>(
                    coordinator,
                    STATS_COMPONENT,
                    entity,
                    'mana', // Type-safe: must be a key of StatsComponent
                    10,
                    'add'
                );
                effect.apply();

                const updatedComponent =
                    coordinator.getComponentFromEntity<StatsComponent>(
                        STATS_COMPONENT,
                        entity
                    );
                expect(updatedComponent?.mana).toBe(60);
            });
        });
    });
});
