import { Coordinator, Entity, createComponentName, ComponentSchema } from "@ue-too/ecs";
import { NumberModificationEffect } from "../src/action-system/effect";

describe('NumberModificationEffect', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const HEALTH_COMPONENT = createComponentName('HealthComponent');
    const STATS_COMPONENT = createComponentName('StatsComponent');

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
                    { name: 'maxHealth', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 25, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(75);
        });

        it('should deduct multiple times when applied repeatedly', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 10, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();
            effect.apply();
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(70);
        });

        it('should handle negative deductions (adding to the value)', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 50 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 50 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, -20, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(70);
        });

        it('should not modify the value if the schema does not exist', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const nonExistentComponent = createComponentName('NonExistentComponent');
            const effect = new NumberModificationEffect(coordinator, 25, nonExistentComponent, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the component does not exist on the entity', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const otherEntity = coordinator.createEntity();
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, otherEntity, component);

            const effect = new NumberModificationEffect(coordinator, 25, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, otherEntity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the field does not exist in the schema', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 25, HEALTH_COMPONENT, entity, 'nonExistentField', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });

        it('should not modify the value if the field value is not a number', () => {
            const schema: ComponentSchema = {
                componentName: STATS_COMPONENT,
                fields: [
                    { name: 'name', type: 'string', defaultValue: 'Player' },
                    { name: 'level', type: 'number', defaultValue: 1 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(STATS_COMPONENT, { name: 'Player', level: 5 });
            coordinator.addComponentToEntityWithSchema(STATS_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 1, STATS_COMPONENT, entity, 'name', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(STATS_COMPONENT, entity);
            expect(updatedComponent?.name).toBe('Player');
            expect(updatedComponent?.level).toBe(5);
        });

        it('should not modify the value if the field value is undefined', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', optional: true }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, {});
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 25, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBeUndefined();
        });

        it('should only modify the specified field, leaving other fields unchanged', () => {
            const schema: ComponentSchema = {
                componentName: STATS_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'mana', type: 'number', defaultValue: 50 },
                    { name: 'stamina', type: 'number', defaultValue: 75 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(STATS_COMPONENT, { 
                health: 100, 
                mana: 50, 
                stamina: 75 
            });
            coordinator.addComponentToEntityWithSchema(STATS_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 20, STATS_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(STATS_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(80);
            expect(updatedComponent?.mana).toBe(50);
            expect(updatedComponent?.stamina).toBe(75);
        });

        it('should handle zero deduction amount', () => {
            const schema: ComponentSchema = {
                componentName: HEALTH_COMPONENT,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(HEALTH_COMPONENT, { health: 100 });
            coordinator.addComponentToEntityWithSchema(HEALTH_COMPONENT, entity, component);

            const effect = new NumberModificationEffect(coordinator, 0, HEALTH_COMPONENT, entity, 'health', 'subtract');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(HEALTH_COMPONENT, entity);
            expect(updatedComponent?.health).toBe(100);
        });
    });
});
