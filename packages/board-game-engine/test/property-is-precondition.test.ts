import { Coordinator, Entity, createGlobalComponentName, ComponentSchema } from "@ue-too/ecs";
import { PropertyIsPrecondition } from "../src/action-system/precondition";

describe('PropertyIsPrecondition', () => {
    let coordinator: Coordinator;
    let entity: Entity;
    const PLAYER_COMPONENT_SCHEMA = createGlobalComponentName('PlayerComponentSchema');
    const PLAYER_COMPONENT_TYPED = createGlobalComponentName('PlayerComponentTyped');

    type PlayerComponent = {
        name: string;
        level: number;
        isActive: boolean;
        status: string | null;
    };

    beforeEach(() => {
        coordinator = new Coordinator();
        entity = coordinator.createEntity();
    });

    describe('with custom schema components', () => {
        describe('number values', () => {
            beforeEach(() => {
                const schema: ComponentSchema = {
                    componentName: PLAYER_COMPONENT_SCHEMA,
                    fields: [
                        { name: 'level', type: 'number', defaultValue: 10 },
                        { name: 'health', type: 'number', defaultValue: 100 }
                    ]
                };
                coordinator.registerComponentWithSchema(schema);
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { level: 10, health: 100 });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
            });

            it('should return true when number property matches', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', 10
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when number property does not match', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', 20
                );
                expect(precondition.check()).toBe(false);
            });

            it('should handle zero values correctly', () => {
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { level: 0 });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', 0
                );
                expect(precondition.check()).toBe(true);
            });
        });

        describe('string values', () => {
            beforeEach(() => {
                const schema: ComponentSchema = {
                    componentName: PLAYER_COMPONENT_SCHEMA,
                    fields: [
                        { name: 'name', type: 'string', defaultValue: 'Player1' },
                        { name: 'status', type: 'string', defaultValue: 'active' }
                    ]
                };
                coordinator.registerComponentWithSchema(schema);
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { name: 'Player1', status: 'active' });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
            });

            it('should return true when string property matches', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'name', 'Player1'
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when string property does not match', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'name', 'Player2'
                );
                expect(precondition.check()).toBe(false);
            });

            it('should handle empty strings', () => {
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { name: '' });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'name', ''
                );
                expect(precondition.check()).toBe(true);
            });
        });

        describe('boolean values', () => {
            beforeEach(() => {
                const schema: ComponentSchema = {
                    componentName: PLAYER_COMPONENT_SCHEMA,
                    fields: [
                        { name: 'isActive', type: 'boolean', defaultValue: true },
                        { name: 'isOnline', type: 'boolean', defaultValue: false }
                    ]
                };
                coordinator.registerComponentWithSchema(schema);
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { isActive: true, isOnline: false });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
            });

            it('should return true when boolean property matches (true)', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'isActive', true
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return true when boolean property matches (false)', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'isOnline', false
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when boolean property does not match', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'isActive', false
                );
                expect(precondition.check()).toBe(false);
            });
        });

        describe('edge cases', () => {
            beforeEach(() => {
                const schema: ComponentSchema = {
                    componentName: PLAYER_COMPONENT_SCHEMA,
                    fields: [
                        { name: 'level', type: 'number', defaultValue: 10 },
                        { name: 'name', type: 'string', defaultValue: 'Player1' }
                    ]
                };
                coordinator.registerComponentWithSchema(schema);
                const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { level: 10, name: 'Player1' });
                coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);
            });

            it('should return false when component does not exist', () => {
                const otherEntity = coordinator.createEntity();
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, otherEntity, 'level', 10
                );
                expect(precondition.check()).toBe(false);
            });

            it('should return false when property does not exist', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'nonExistentField', 10
                );
                expect(precondition.check()).toBe(false);
            });

            it('should return false when value type does not match', () => {
                const precondition = new PropertyIsPrecondition(
                    coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', '10' // string instead of number
                );
                expect(precondition.check()).toBe(false);
            });
        });
    });

    describe('with typed components', () => {
        beforeEach(() => {
            coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT_TYPED);
            const component: PlayerComponent = { 
                name: 'John', 
                level: 5, 
                isActive: true,
                status: 'online'
            };
            coordinator.addComponentToEntity(PLAYER_COMPONENT_TYPED, entity, component);
        });

        describe('number values', () => {
            it('should return true when number property matches', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'level', 5
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when number property does not match', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'level', 10
                );
                expect(precondition.check()).toBe(false);
            });
        });

        describe('string values', () => {
            it('should return true when string property matches', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'name', 'John'
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when string property does not match', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'name', 'Jane'
                );
                expect(precondition.check()).toBe(false);
            });

            it('should handle status property correctly', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'status', 'online'
                );
                expect(precondition.check()).toBe(true);
            });
        });

        describe('boolean values', () => {
            it('should return true when boolean property matches', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'isActive', true
                );
                expect(precondition.check()).toBe(true);
            });

            it('should return false when boolean property does not match', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'isActive', false
                );
                expect(precondition.check()).toBe(false);
            });
        });

        describe('type safety', () => {
            it('should provide type safety for typed components', () => {
                // TypeScript should enforce that property is a key of PlayerComponent
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'level', 5
                );
                expect(precondition.check()).toBe(true);
            });
        });

        describe('edge cases', () => {
            it('should return false when component does not exist', () => {
                const otherEntity = coordinator.createEntity();
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, otherEntity, 'name', 'John'
                );
                expect(precondition.check()).toBe(false);
            });

            it('should return false when property does not exist', () => {
                const precondition = new PropertyIsPrecondition<PlayerComponent>(
                    coordinator, PLAYER_COMPONENT_TYPED, entity, 'nonExistentField' as keyof PlayerComponent, 'value'
                );
                expect(precondition.check()).toBe(false);
            });
        });
    });

    describe('unified behavior', () => {
        it('should use schema-based approach when schema exists', () => {
            const schema: ComponentSchema = {
                componentName: PLAYER_COMPONENT_SCHEMA,
                fields: [
                    { name: 'level', type: 'number', defaultValue: 10 }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { level: 10 });
            coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);

            // Even with typed API, should detect schema and use schema-based approach
            const precondition = new PropertyIsPrecondition<Record<string, unknown>>(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level' as keyof Record<string, unknown>, 10
            );
            expect(precondition.check()).toBe(true);
        });

        it('should use type-based approach when no schema exists', () => {
            coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT_TYPED);
            const component: PlayerComponent = { 
                name: 'John', 
                level: 5, 
                isActive: true,
                status: 'online'
            };
            coordinator.addComponentToEntity(PLAYER_COMPONENT_TYPED, entity, component);

            // Should use type-based approach
            const precondition = new PropertyIsPrecondition<PlayerComponent>(
                coordinator, PLAYER_COMPONENT_TYPED, entity, 'name', 'John'
            );
            expect(precondition.check()).toBe(true);
        });
    });

    describe('mixed type scenarios', () => {
        it('should handle component with multiple types correctly', () => {
            const schema: ComponentSchema = {
                componentName: PLAYER_COMPONENT_SCHEMA,
                fields: [
                    { name: 'name', type: 'string', defaultValue: 'Player1' },
                    { name: 'level', type: 'number', defaultValue: 10 },
                    { name: 'isActive', type: 'boolean', defaultValue: true }
                ]
            };
            coordinator.registerComponentWithSchema(schema);
            const component = coordinator.createComponentFromSchema(PLAYER_COMPONENT_SCHEMA, { 
                name: 'Player1', 
                level: 10, 
                isActive: true 
            });
            coordinator.addComponentToEntityWithSchema(PLAYER_COMPONENT_SCHEMA, entity, component);

            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'name', 'Player1'
            ).check()).toBe(true);

            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', 10
            ).check()).toBe(true);

            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'isActive', true
            ).check()).toBe(true);

            // Verify they don't match wrong values
            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'name', 'Player2'
            ).check()).toBe(false);

            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'level', 20
            ).check()).toBe(false);

            expect(new PropertyIsPrecondition(
                coordinator, PLAYER_COMPONENT_SCHEMA, entity, 'isActive', false
            ).check()).toBe(false);
        });
    });
});
