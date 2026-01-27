import {
    ComponentSchema,
    Coordinator,
    Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

import { NumberModificationEffect } from '../src/action-system/effect';

describe('NumberModificationEffect - Unified (Schema and Typed)', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const HEALTH_COMPONENT_SCHEMA = createGlobalComponentName(
        'HealthComponentSchema'
    );
    const HEALTH_COMPONENT_TYPED = createGlobalComponentName(
        'HealthComponentTyped'
    );

    type HealthComponent = {
        health: number;
        maxHealth: number;
    };

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('with custom schema components', () => {
        it('should work with schema-based components using old API', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'maxHealth', type: 'number', defaultValue: 100 },
                ],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT_SCHEMA,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT_SCHEMA,
                entity,
                component
            );

            // Old API: (coordinator, amount, componentName, entity, valuePath, operation)
            const effect = new NumberModificationEffect(
                coordinator,
                25,
                HEALTH_COMPONENT_SCHEMA,
                entity,
                'health',
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT_SCHEMA, entity);
            expect(updatedComponent?.health).toBe(75);
            expect(updatedComponent?.maxHealth).toBe(100);
        });

        it('should detect schema automatically and use schema-based approach', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT_SCHEMA,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT_SCHEMA,
                entity,
                component
            );

            // Even with typed API, should detect schema and use schema-based approach
            const effect = new NumberModificationEffect<
                Record<string, unknown>
            >(
                coordinator,
                HEALTH_COMPONENT_SCHEMA,
                entity,
                'health' as keyof Record<string, unknown>,
                25,
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT_SCHEMA, entity);
            expect(updatedComponent?.health).toBe(75);
        });
    });

    describe('with typed components', () => {
        it('should work with typed components using new API', () => {
            coordinator.registerComponent<HealthComponent>(
                HEALTH_COMPONENT_TYPED
            );
            const component: HealthComponent = { health: 100, maxHealth: 100 };
            coordinator.addComponentToEntity(
                HEALTH_COMPONENT_TYPED,
                entity,
                component
            );

            // New API: (coordinator, componentName, entity, valuePath, amount, operation)
            const effect = new NumberModificationEffect<HealthComponent>(
                coordinator,
                HEALTH_COMPONENT_TYPED,
                entity,
                'health',
                25,
                'subtract'
            );
            effect.apply();

            const updatedComponent =
                coordinator.getComponentFromEntity<HealthComponent>(
                    HEALTH_COMPONENT_TYPED,
                    entity
                );
            expect(updatedComponent?.health).toBe(75);
            expect(updatedComponent?.maxHealth).toBe(100);
        });

        it('should provide type safety for typed components', () => {
            coordinator.registerComponent<HealthComponent>(
                HEALTH_COMPONENT_TYPED
            );
            const component: HealthComponent = { health: 100, maxHealth: 100 };
            coordinator.addComponentToEntity(
                HEALTH_COMPONENT_TYPED,
                entity,
                component
            );

            // TypeScript should enforce that valuePath is a key of HealthComponent
            const effect = new NumberModificationEffect<HealthComponent>(
                coordinator,
                HEALTH_COMPONENT_TYPED,
                entity,
                'health',
                10,
                'add'
            );
            effect.apply();

            const updatedComponent =
                coordinator.getComponentFromEntity<HealthComponent>(
                    HEALTH_COMPONENT_TYPED,
                    entity
                );
            expect(updatedComponent?.health).toBe(110);
        });
    });

    describe('automatic detection', () => {
        it('should prefer schema-based approach when both are possible', () => {
            // Register with schema
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT_SCHEMA,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT_SCHEMA,
                entity,
                component
            );

            // Use typed API but should still use schema-based approach
            const effect = new NumberModificationEffect<
                Record<string, unknown>
            >(
                coordinator,
                HEALTH_COMPONENT_SCHEMA,
                entity,
                'health' as keyof Record<string, unknown>,
                20,
                'subtract'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT_SCHEMA, entity);
            expect(updatedComponent?.health).toBe(80);
        });

        it('should fall back to type-based approach when no schema exists', () => {
            // Register without schema (typed component)
            coordinator.registerComponent<HealthComponent>(
                HEALTH_COMPONENT_TYPED
            );
            const component: HealthComponent = { health: 100, maxHealth: 100 };
            coordinator.addComponentToEntity(
                HEALTH_COMPONENT_TYPED,
                entity,
                component
            );

            // Should use type-based approach
            const effect = new NumberModificationEffect<HealthComponent>(
                coordinator,
                HEALTH_COMPONENT_TYPED,
                entity,
                'health',
                30,
                'subtract'
            );
            effect.apply();

            const updatedComponent =
                coordinator.getComponentFromEntity<HealthComponent>(
                    HEALTH_COMPONENT_TYPED,
                    entity
                );
            expect(updatedComponent?.health).toBe(70);
        });
    });

    describe('backward compatibility', () => {
        it('should maintain backward compatibility with old API', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }],
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(
                HEALTH_COMPONENT_SCHEMA,
                { health: 100 }
            );
            coordinator.addComponentToEntityWithSchema(
                HEALTH_COMPONENT_SCHEMA,
                entity,
                component
            );

            // Old API signature should still work
            const effect = new NumberModificationEffect(
                coordinator,
                15,
                HEALTH_COMPONENT_SCHEMA,
                entity,
                'health',
                'add'
            );
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<
                Record<string, unknown>
            >(HEALTH_COMPONENT_SCHEMA, entity);
            expect(updatedComponent?.health).toBe(115);
        });
    });
});
