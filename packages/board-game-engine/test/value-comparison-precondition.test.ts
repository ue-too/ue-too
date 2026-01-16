import { Coordinator, Entity, createGlobalComponentName, ComponentSchema } from "@ue-too/ecs";
import { ValueComparisonPrecondition } from "../src/action-system/precondition";

describe('ValueComparisonPrecondition', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const HEALTH_COMPONENT_SCHEMA = createGlobalComponentName('HealthComponentSchema');
    const HEALTH_COMPONENT_TYPED = createGlobalComponentName('HealthComponentTyped');

    type HealthComponent = {
        health: number;
        maxHealth: number;
    };

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('with custom schema components', () => {
        beforeEach(() => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'maxHealth', type: 'number', defaultValue: 100 }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT_SCHEMA, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT_SCHEMA, entity, component);
        });

        it('should check greater than using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                50, '>', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check less than using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                150, '<', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check greater than or equal using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                100, '>=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check less than or equal using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                100, '<=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check equality using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                100, '==', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check inequality using old API', () => {
            const precondition = new ValueComparisonPrecondition(
                50, '!=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when comparison fails', () => {
            const precondition = new ValueComparisonPrecondition(
                150, '>', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when component does not exist', () => {
            const otherEntity = coordinator.createEntity();
            const precondition = new ValueComparisonPrecondition(
                100, '>', coordinator, HEALTH_COMPONENT_SCHEMA, otherEntity, 'health'
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when field does not exist', () => {
            const precondition = new ValueComparisonPrecondition(
                100, '>', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'nonExistentField'
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when field value is not a number', () => {
            const schema: ComponentSchema = {
                componentName: createGlobalComponentName('TestComponent'),
                fields: [
                    { name: 'name', type: 'string', defaultValue: 'Test' }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(schema.componentName, { name: 'Test' });
            coordinator.addComponentToEntityWithSchema(schema.componentName, entity, component);

            const precondition = new ValueComparisonPrecondition(
                100, '>', coordinator, schema.componentName, entity, 'name'
            );
            expect(precondition.check()).toBe(false);
        });
    });

    describe('with typed components', () => {
        beforeEach(() => {
            coordinator.registerComponent<HealthComponent>(HEALTH_COMPONENT_TYPED);
            const component: HealthComponent = { health: 100, maxHealth: 100 };
            coordinator.addComponentToEntity(HEALTH_COMPONENT_TYPED, entity, component);
        });

        it('should check greater than using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 50, '>'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check less than using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 150, '<'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check greater than or equal using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 100, '>='
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check less than or equal using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 100, '<='
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check equality using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 100, '=='
            );
            expect(precondition.check()).toBe(true);
        });

        it('should check inequality using new typed API', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 50, '!='
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when comparison fails', () => {
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 150, '>'
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when component does not exist', () => {
            const otherEntity = coordinator.createEntity();
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, otherEntity, 'health', 100, '>'
            );
            expect(precondition.check()).toBe(false);
        });

        it('should provide type safety for typed components', () => {
            // TypeScript should enforce that valuePath is a key of HealthComponent
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'maxHealth', 50, '>'
            );
            expect(precondition.check()).toBe(true);
        });
    });

    describe('unified effect behavior', () => {
        it('should use schema-based approach when schema exists', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT_SCHEMA, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT_SCHEMA, entity, component);

            // Even with typed API, should detect schema and use schema-based approach
            const precondition = new ValueComparisonPrecondition<Record<string, unknown>>(
                coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health' as keyof Record<string, unknown>, 50, '>'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should use type-based approach when no schema exists', () => {
            coordinator.registerComponent<HealthComponent>(HEALTH_COMPONENT_TYPED);
            const component: HealthComponent = { health: 100, maxHealth: 100 };
            coordinator.addComponentToEntity(HEALTH_COMPONENT_TYPED, entity, component);

            // Should use type-based approach
            const precondition = new ValueComparisonPrecondition<HealthComponent>(
                coordinator, HEALTH_COMPONENT_TYPED, entity, 'health', 50, '>'
            );
            expect(precondition.check()).toBe(true);
        });

        it('should handle zero values correctly', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 0 }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT_SCHEMA, { health: 0 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT_SCHEMA, entity, component);

            const precondition = new ValueComparisonPrecondition(
                0, '==', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health'
            );
            expect(precondition.check()).toBe(true);
        });
    });

    describe('all operators', () => {
        beforeEach(() => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT_SCHEMA,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT_SCHEMA, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT_SCHEMA, entity, component);
        });

        it('should work with > operator', () => {
            const precondition = new ValueComparisonPrecondition(50, '>', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(150, '>', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(false);
        });

        it('should work with < operator', () => {
            const precondition = new ValueComparisonPrecondition(150, '<', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(50, '<', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(false);
        });

        it('should work with >= operator', () => {
            const precondition = new ValueComparisonPrecondition(100, '>=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(50, '>=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(true);
            const precondition3 = new ValueComparisonPrecondition(150, '>=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition3.check()).toBe(false);
        });

        it('should work with <= operator', () => {
            const precondition = new ValueComparisonPrecondition(100, '<=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(150, '<=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(true);
            const precondition3 = new ValueComparisonPrecondition(50, '<=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition3.check()).toBe(false);
        });

        it('should work with == operator', () => {
            const precondition = new ValueComparisonPrecondition(100, '==', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(50, '==', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(false);
        });

        it('should work with != operator', () => {
            const precondition = new ValueComparisonPrecondition(50, '!=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition.check()).toBe(true);
            const precondition2 = new ValueComparisonPrecondition(100, '!=', coordinator, HEALTH_COMPONENT_SCHEMA, entity, 'health');
            expect(precondition2.check()).toBe(false);
        });
    });
});
