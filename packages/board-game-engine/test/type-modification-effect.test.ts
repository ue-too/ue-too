import { Coordinator, Entity, createComponentName, ComponentSchema } from "@ue-too/ecs";
import { TypeModificationEffect } from "../src/action-system/effect";

describe('TypeModificationEffect', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const CARD_COMPONENT = createComponentName('CardComponent');
    const ITEM_COMPONENT = createComponentName('ItemComponent');
    const MIXED_COMPONENT = createComponentName('MixedComponent');

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('apply', () => {
        it('should set a string field to the new type value', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' },
                    { name: 'name', type: 'string', defaultValue: 'Fireball' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell', name: 'Fireball' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('creature');
            expect(updatedComponent?.name).toBe('Fireball');
        });

        it('should update the type value when applied multiple times', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect1 = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect1.apply();

            const effect2 = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'artifact');
            effect2.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('artifact');
        });

        it('should not modify the value if the schema does not exist', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const nonExistentComponent = createComponentName('NonExistentComponent');
            const effect = new TypeModificationEffect(coordinator, nonExistentComponent, entity, 'type', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('spell');
        });

        it('should not modify the value if the component does not exist on the entity', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const otherEntity = coordinator.createEntity();
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, otherEntity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, otherEntity);
            expect(updatedComponent?.type).toBe('spell');
        });

        it('should not modify the value if the field does not exist in the schema', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'nonExistentField', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('spell');
        });

        it('should not modify the value if the field value is not a string', () => {
            const schema: ComponentSchema = {
                componentName: MIXED_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'item' },
                    { name: 'value', type: 'number', defaultValue: 100 },
                    { name: 'isActive', type: 'boolean', defaultValue: true }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(MIXED_COMPONENT, { 
                type: 'item', 
                value: 100, 
                isActive: true 
            });
            coordinator.addComponentToEntityWithSchema(MIXED_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, MIXED_COMPONENT, entity, 'value', 'newValue');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(MIXED_COMPONENT, entity);
            expect(updatedComponent?.value).toBe(100);
            expect(updatedComponent?.type).toBe('item');
            expect(updatedComponent?.isActive).toBe(true);
        });

        it('should not modify the value if the field value is undefined', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', optional: true }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, {});
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBeUndefined();
        });

        it('should only modify the specified field, leaving other fields unchanged', () => {
            const schema: ComponentSchema = {
                componentName: ITEM_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'weapon' },
                    { name: 'name', type: 'string', defaultValue: 'Sword' },
                    { name: 'rarity', type: 'string', defaultValue: 'common' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(ITEM_COMPONENT, { 
                type: 'weapon', 
                name: 'Sword', 
                rarity: 'common' 
            });
            coordinator.addComponentToEntityWithSchema(ITEM_COMPONENT, entity, component);

            const effect = new TypeModificationEffect<"armor" | "weapon" | "artifact" | "spell" | "creature">(coordinator, ITEM_COMPONENT, entity, 'type', 'armor');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(ITEM_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('armor');
            expect(updatedComponent?.name).toBe('Sword');
            expect(updatedComponent?.rarity).toBe('common');
        });

        it('should handle empty string as a valid type value', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', '');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('');
        });

        it('should handle setting the same value multiple times', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect.apply();
            effect.apply();
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('creature');
        });

        it('should handle long string values', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            const longTypeValue = 'very-long-type-name-with-many-characters';
            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', longTypeValue);
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe(longTypeValue);
        });

        it('should not modify the value if the field type is not string', () => {
            const schema: ComponentSchema = {
                componentName: MIXED_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'item' },
                    { name: 'value', type: 'number', defaultValue: 100 }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(MIXED_COMPONENT, { 
                type: 'item', 
                value: 100 
            });
            coordinator.addComponentToEntityWithSchema(MIXED_COMPONENT, entity, component);

            // Try to modify a number field - should fail because field type is not 'string'
            const effect = new TypeModificationEffect(coordinator, MIXED_COMPONENT, entity, 'value', 'newValue');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(MIXED_COMPONENT, entity);
            expect(updatedComponent?.value).toBe(100);
            expect(updatedComponent?.type).toBe('item');
        });

        it('should validate against allowed values when provided', () => {
            const allowedTypes = ['weapon', 'armor', 'artifact'] as const;
            const schema: ComponentSchema = {
                componentName: ITEM_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'weapon' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(ITEM_COMPONENT, { type: 'weapon' });
            coordinator.addComponentToEntityWithSchema(ITEM_COMPONENT, entity, component);

            // Valid value - should work
            const validEffect = new TypeModificationEffect(coordinator, ITEM_COMPONENT, entity, 'type', 'armor', allowedTypes);
            validEffect.apply();

            let updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(ITEM_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('armor');

            // Invalid value - should not modify
            const invalidEffect = new TypeModificationEffect(coordinator, ITEM_COMPONENT, entity, 'type', 'spell', allowedTypes);
            invalidEffect.apply();

            updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(ITEM_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('armor'); // Should remain unchanged
        });

        it('should work without allowed values (backward compatible)', () => {
            const schema: ComponentSchema = {
                componentName: CARD_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'spell' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(CARD_COMPONENT, { type: 'spell' });
            coordinator.addComponentToEntityWithSchema(CARD_COMPONENT, entity, component);

            // Should work without allowedValues parameter
            const effect = new TypeModificationEffect(coordinator, CARD_COMPONENT, entity, 'type', 'creature');
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(CARD_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('creature');
        });

        it('should validate string literal types with allowed values', () => {
            type ItemType = 'weapon' | 'armor' | 'artifact' | 'spell' | 'creature';
            const allowedTypes: readonly ItemType[] = ['weapon', 'armor', 'artifact', 'spell', 'creature'] as const;
            
            const schema: ComponentSchema = {
                componentName: ITEM_COMPONENT,
                fields: [
                    { name: 'type', type: 'string', defaultValue: 'weapon' }
                ]
            };

            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(ITEM_COMPONENT, { type: 'weapon' });
            coordinator.addComponentToEntityWithSchema(ITEM_COMPONENT, entity, component);

            // Valid string literal value
            const effect = new TypeModificationEffect<ItemType>(coordinator, ITEM_COMPONENT, entity, 'type', 'armor', allowedTypes);
            effect.apply();

            const updatedComponent = coordinator.getComponentFromEntity<Record<string, unknown>>(ITEM_COMPONENT, entity);
            expect(updatedComponent?.type).toBe('armor');
        });
    });
});
