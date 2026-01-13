import { ComponentArray, EntityManager, ComponentManager, System, SystemManager, Coordinator, Entity, ComponentSchema, createComponentName } from "../src";

type MockComponent = {
    name: string;
    age: number;
}

// Create component name symbols for tests
const MOCK_COMPONENT = createComponentName('MockComponent');
const PLAYER_STATS = createComponentName('PlayerStats');
const TEST_COMPONENT = createComponentName('TestComponent');
const OPTIONAL_COMPONENT = createComponentName('OptionalComponent');
const MIXED_TYPES = createComponentName('MixedTypes');
const COMPONENT1 = createComponentName('Component1');
const COMPONENT2 = createComponentName('Component2');
const INVALID_COMPONENT = createComponentName('InvalidComponent');
const NUMBER_ARRAY_COMPONENT = createComponentName('NumberArrayComponent');
const STRING_ARRAY_COMPONENT = createComponentName('StringArrayComponent');
const BOOLEAN_ARRAY_COMPONENT = createComponentName('BooleanArrayComponent');
const ENTITY_ARRAY_COMPONENT = createComponentName('EntityArrayComponent');
const OBJECT_ARRAY_COMPONENT = createComponentName('ObjectArrayComponent');
const INVENTORY_COMPONENT = createComponentName('InventoryComponent');
const MULTI_ARRAY_COMPONENT = createComponentName('MultiArrayComponent');
const ITEM = createComponentName('Item');
const INVENTORY = createComponentName('Inventory');
const FUTURE_ITEM = createComponentName('FutureItem');
const ARRAY_COMPONENT = createComponentName('ArrayComponent');
const EMPTY_COMPONENT = createComponentName('EmptyComponent');
const DUPLICATE_FIELDS = createComponentName('DuplicateFields');

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

});

describe('ComponentArray', () => {

    it('should be able to insert data into a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const data = {name: 'John', age: 30};
        componentArray.insertData(entity, data);
        expect(componentArray.getData(entity)).toEqual(data);
    });

    it('should be able to remove data from a component array', () => {
        const componentArray = new ComponentArray<MockComponent>(100);
        const entity = 0;
        const entity2 = 1;
        const data = {name: 'John', age: 30};
        const data2 = {name: 'Jane', age: 25};
        componentArray.insertData(entity, data);
        componentArray.insertData(entity2, data2);
        componentArray.removeData(entity);
        expect(componentArray.getData(entity)).toBeNull();
        expect(componentArray.getData(entity2)).toEqual(data2);
    });
});

describe('ComponentManager', () => {

    it('should be able to register a component', () => {
        const componentManager = new ComponentManager();
        componentManager.registerComponent<MockComponent>(MOCK_COMPONENT);
        expect(componentManager.getComponentType(MOCK_COMPONENT)).toBe(0);
    });

});

describe('Coordinator', () => {

    it('should be able to create an entity', () => {
        const coordinator = new Coordinator();
        const entity = coordinator.createEntity();
        expect(entity).toBeDefined();
        // the first entity
        expect(entity).toBe(0);
    });

    it('should be able to register a component', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        expect(coordinator.getComponentType(MOCK_COMPONENT)).toBe(0);
    });

    it('should be able to add a component to an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, component);
        expect(coordinator.getComponentFromEntity(MOCK_COMPONENT, entity)).toEqual(component);
    });

    it('should be able to remove a component from an entity', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const entity = coordinator.createEntity();
        const component = {name: 'John', age: 30};
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, component);
        coordinator.removeComponentFromEntity(MOCK_COMPONENT, entity);
        expect(coordinator.getComponentFromEntity(MOCK_COMPONENT, entity)).toBeNull();
    });

    it('should be able to set a system signature and update the system entities', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const mockSystem = {entities: new Set<Entity>()};
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
        const entity = coordinator.createEntity();
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, {name: 'John', age: 30});
        coordinator.setSystemSignature('MockSystem', 1);
        expect(mockSystem.entities.size).toBe(1);
        expect(mockSystem.entities.has(entity)).toBe(true);
    });

    it('should be able to let system iterate over its entities based on the system signature', () => {
        const coordinator = new Coordinator();
        coordinator.registerComponent<MockComponent>(MOCK_COMPONENT);
        const mockSystem = {entities: new Set<Entity>()};
        coordinator.registerSystem('MockSystem', mockSystem);
        coordinator.setSystemSignature('MockSystem', 1);
        const entity = coordinator.createEntity();
        coordinator.createEntity();
        const entity3 = coordinator.createEntity();

        coordinator.addComponentToEntity(MOCK_COMPONENT, entity, {name: 'John', age: 30});
        coordinator.addComponentToEntity(MOCK_COMPONENT, entity3, {name: 'Jim', age: 35});

        const entities = Array.from(mockSystem.entities);
        expect(entities.length).toBe(2);
        expect(entities[0]).toBe(entity);
        expect(entities[1]).toBe(entity3);
    });

    describe('Runtime Component Schemas', () => {
        it('should be able to register a component with a schema', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'name', type: 'string', defaultValue: 'Player' },
                    { name: 'isAlive', type: 'boolean', defaultValue: true }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            const retrievedSchema = coordinator.getComponentSchema(PLAYER_STATS);
            expect(retrievedSchema).toEqual(schema);
        });

        // Note: TypeScript now prevents empty component names at compile time with symbols
        // This test is no longer needed as symbols cannot be empty

        it('should throw error when registering schema with no fields', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: EMPTY_COMPONENT,
                fields: []
            };
            
            expect(() => coordinator.registerComponentWithSchema(schema)).toThrow();
        });

        it('should throw error when registering schema with duplicate field names', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: DUPLICATE_FIELDS,
                fields: [
                    { name: 'value', type: 'number' },
                    { name: 'value', type: 'string' }
                ]
            };
            
            expect(() => coordinator.registerComponentWithSchema(schema)).toThrow();
        });

        it('should be able to create a component instance from a schema with defaults', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'name', type: 'string', defaultValue: 'Player' },
                    { name: 'isAlive', type: 'boolean', defaultValue: true }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            const component = coordinator.createComponentFromSchema(PLAYER_STATS);
            expect(component).toEqual({
                health: 100,
                name: 'Player',
                isAlive: true
            });
        });

        it('should be able to create a component instance with overrides', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'name', type: 'string', defaultValue: 'Player' }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            const component = coordinator.createComponentFromSchema(PLAYER_STATS, {
                health: 150,
                name: 'SuperPlayer'
            });
            expect(component).toEqual({
                health: 150,
                name: 'SuperPlayer'
            });
        });

        it('should use type-appropriate defaults for required fields without defaults', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: TEST_COMPONENT,
                fields: [
                    { name: 'str', type: 'string' },
                    { name: 'num', type: 'number' },
                    { name: 'bool', type: 'boolean' },
                    { name: 'obj', type: 'object' },
                    { name: 'arr', type: 'array', arrayElementType: { kind: 'builtin', type: 'string' } },
                    { name: 'entity', type: 'entity' }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            const component = coordinator.createComponentFromSchema(TEST_COMPONENT);
            expect(component).toEqual({
                str: '',
                num: 0,
                bool: false,
                obj: {},
                arr: [],
                entity: null
            });
        });

        it('should omit optional fields without defaults', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: OPTIONAL_COMPONENT,
                fields: [
                    { name: 'required', type: 'string', defaultValue: 'required' },
                    { name: 'optional', type: 'string', optional: true }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            const component = coordinator.createComponentFromSchema(OPTIONAL_COMPONENT);
            expect(component).toEqual({
                required: 'required'
            });
            expect(component).not.toHaveProperty('optional');
        });

        it('should validate component data against schema', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number' },
                    { name: 'name', type: 'string' },
                    { name: 'isAlive', type: 'boolean', optional: true }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            
            // Valid data
            expect(coordinator.validateComponentData(PLAYER_STATS, {
                health: 100,
                name: 'Player'
            })).toBe(true);
            
            // Missing required field
            expect(coordinator.validateComponentData(PLAYER_STATS, {
                health: 100
            })).toBe(false);
            
            // Wrong type
            expect(coordinator.validateComponentData(PLAYER_STATS, {
                health: '100',
                name: 'Player'
            })).toBe(false);
            
            // Valid with optional field
            expect(coordinator.validateComponentData(PLAYER_STATS, {
                health: 100,
                name: 'Player',
                isAlive: true
            })).toBe(true);
        });

        it('should be able to add a component to an entity with schema validation', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number', defaultValue: 100 },
                    { name: 'name', type: 'string', defaultValue: 'Player' }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            const entity = coordinator.createEntity();
            
            // Valid component
            const component = coordinator.createComponentFromSchema(PLAYER_STATS, { health: 150 });
            coordinator.addComponentToEntityWithSchema(PLAYER_STATS, entity, component);
            
            const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(PLAYER_STATS, entity);
            expect(retrieved).toEqual({
                health: 150,
                name: 'Player'
            });
        });

        it('should throw error when adding invalid component data with validation enabled', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number' },
                    { name: 'name', type: 'string' }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            const entity = coordinator.createEntity();
            
            // Invalid component (missing required field)
            expect(() => {
                coordinator.addComponentToEntityWithSchema(PLAYER_STATS, entity, { health: 100 }, true);
            }).toThrow();
        });

        it('should allow invalid component data when validation is disabled', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [
                    { name: 'health', type: 'number' },
                    { name: 'name', type: 'string' }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            const entity = coordinator.createEntity();
            
            // Invalid component but validation disabled
            coordinator.addComponentToEntityWithSchema(PLAYER_STATS, entity, { health: 100 }, false);
            
            const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(PLAYER_STATS, entity);
            expect(retrieved).toEqual({ health: 100 });
        });

        it('should work with different field types', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: MIXED_TYPES,
                fields: [
                    { name: 'str', type: 'string', defaultValue: 'test' },
                    { name: 'num', type: 'number', defaultValue: 42 },
                    { name: 'bool', type: 'boolean', defaultValue: true },
                    { name: 'obj', type: 'object', defaultValue: { x: 1 } },
                    { name: 'arr', type: 'array', arrayElementType: { kind: 'builtin', type: 'number' }, defaultValue: [1, 2, 3] },
                    { name: 'entity', type: 'entity', defaultValue: null }
                ]
            };
            
            coordinator.registerComponentWithSchema(schema);
            const entity = coordinator.createEntity();
            const component = coordinator.createComponentFromSchema(MIXED_TYPES);
            
            expect(coordinator.validateComponentData(MIXED_TYPES, component)).toBe(true);
            
            coordinator.addComponentToEntityWithSchema(MIXED_TYPES, entity, component);
            const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(MIXED_TYPES, entity);
            expect(retrieved).toEqual(component);
        });

        it('should update system signatures when adding schema-based components', () => {
            const coordinator = new Coordinator();
            const schema: ComponentSchema = {
                componentName: PLAYER_STATS,
                fields: [{ name: 'health', type: 'number', defaultValue: 100 }]
            };
            
            coordinator.registerComponentWithSchema(schema);
            const mockSystem = { entities: new Set<Entity>() };
            coordinator.registerSystem('MockSystem', mockSystem);
            
            const componentType = coordinator.getComponentType(PLAYER_STATS)!;
            coordinator.setSystemSignature('MockSystem', 1 << componentType);
            
            const entity = coordinator.createEntity();
            const component = coordinator.createComponentFromSchema(PLAYER_STATS);
            coordinator.addComponentToEntityWithSchema(PLAYER_STATS, entity, component);
            
            expect(mockSystem.entities.has(entity)).toBe(true);
        });

        it('should be able to get all component schemas', () => {
            const coordinator = new Coordinator();
            
            const schema1: ComponentSchema = {
                componentName: COMPONENT1,
                fields: [{ name: 'value', type: 'number' }]
            };
            const schema2: ComponentSchema = {
                componentName: COMPONENT2,
                fields: [{ name: 'name', type: 'string' }]
            };
            
            coordinator.registerComponentWithSchema(schema1);
            coordinator.registerComponentWithSchema(schema2);
            
            const schemas = coordinator.getAllComponentSchemas();
            expect(schemas.length).toBe(2);
            expect(schemas).toContainEqual(schema1);
            expect(schemas).toContainEqual(schema2);
        });

        describe('Typed Arrays', () => {
            // Note: TypeScript now enforces that array fields must have arrayElementType
            // at compile time, so we don't need a runtime test for this.

            // Note: TypeScript now prevents arrayElementType from being used with non-array types
            // at compile time, so we don't need a runtime test for this.

            // Note: TypeScript now prevents empty typeName at compile time with symbols
            // This test is no longer needed as symbols cannot be empty strings

            it('should validate array elements match arrayElementType', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: NUMBER_ARRAY_COMPONENT,
                    fields: [
                        { name: 'numbers', type: 'array', arrayElementType: { kind: 'builtin', type: 'number' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                // Valid: all elements are numbers
                expect(coordinator.validateComponentData(NUMBER_ARRAY_COMPONENT, {
                    numbers: [1, 2, 3, 4, 5]
                })).toBe(true);
                
                // Invalid: contains non-number
                expect(coordinator.validateComponentData(NUMBER_ARRAY_COMPONENT, {
                    numbers: [1, 2, 'three', 4]
                })).toBe(false);
                
                // Valid: empty array
                expect(coordinator.validateComponentData(NUMBER_ARRAY_COMPONENT, {
                    numbers: []
                })).toBe(true);
            });

            it('should validate string arrays', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: STRING_ARRAY_COMPONENT,
                    fields: [
                        { name: 'names', type: 'array', arrayElementType: { kind: 'builtin', type: 'string' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                expect(coordinator.validateComponentData(STRING_ARRAY_COMPONENT, {
                    names: ['Alice', 'Bob', 'Charlie']
                })).toBe(true);
                
                expect(coordinator.validateComponentData(STRING_ARRAY_COMPONENT, {
                    names: ['Alice', 123, 'Charlie']
                })).toBe(false);
            });

            it('should validate boolean arrays', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: BOOLEAN_ARRAY_COMPONENT,
                    fields: [
                        { name: 'flags', type: 'array', arrayElementType: { kind: 'builtin', type: 'boolean' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                expect(coordinator.validateComponentData(BOOLEAN_ARRAY_COMPONENT, {
                    flags: [true, false, true]
                })).toBe(true);
                
                expect(coordinator.validateComponentData(BOOLEAN_ARRAY_COMPONENT, {
                    flags: [true, 'false', true]
                })).toBe(false);
            });

            it('should validate entity arrays', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: ENTITY_ARRAY_COMPONENT,
                    fields: [
                        { name: 'entities', type: 'array', arrayElementType: { kind: 'builtin', type: 'entity' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                expect(coordinator.validateComponentData(ENTITY_ARRAY_COMPONENT, {
                    entities: [1, 2, 3]
                })).toBe(true);
                
                expect(coordinator.validateComponentData(ENTITY_ARRAY_COMPONENT, {
                    entities: [1, null, 3]
                })).toBe(true);
                
                expect(coordinator.validateComponentData(ENTITY_ARRAY_COMPONENT, {
                    entities: [1, '2', 3]
                })).toBe(false);
            });

            it('should validate object arrays', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: OBJECT_ARRAY_COMPONENT,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'builtin', type: 'object' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                expect(coordinator.validateComponentData(OBJECT_ARRAY_COMPONENT, {
                    items: [{ x: 1 }, { y: 2 }]
                })).toBe(true);
                
                expect(coordinator.validateComponentData(OBJECT_ARRAY_COMPONENT, {
                    items: [{ x: 1 }, 'not an object']
                })).toBe(false);
                
                expect(coordinator.validateComponentData(OBJECT_ARRAY_COMPONENT, {
                    items: [{ x: 1 }, [1, 2, 3]] // Array is not an object
                })).toBe(false);
            });

            it('should create component with typed array default', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: INVENTORY_COMPONENT,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'builtin', type: 'string' }, defaultValue: [] }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                const component = coordinator.createComponentFromSchema(INVENTORY_COMPONENT);
                expect(component).toEqual({
                    items: []
                });
            });

            it('should add component with typed array to entity', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: INVENTORY_COMPONENT,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'builtin', type: 'string' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                const entity = coordinator.createEntity();
                
                const component = {
                    items: ['sword', 'shield', 'potion']
                };
                
                coordinator.addComponentToEntityWithSchema(INVENTORY_COMPONENT, entity, component);
                
                const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(INVENTORY_COMPONENT, entity);
                expect(retrieved).toEqual(component);
            });

            it('should throw error when adding component with invalid array element types', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: NUMBER_ARRAY_COMPONENT,
                    fields: [
                        { name: 'numbers', type: 'array', arrayElementType: { kind: 'builtin', type: 'number' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                const entity = coordinator.createEntity();
                
                // Invalid: array contains strings
                expect(() => {
                    coordinator.addComponentToEntityWithSchema(NUMBER_ARRAY_COMPONENT, entity, {
                        numbers: [1, 2, 'three']
                    }, true);
                }).toThrow();
            });

            it('should work with multiple typed arrays in one component', () => {
                const coordinator = new Coordinator();
                const schema: ComponentSchema = {
                    componentName: MULTI_ARRAY_COMPONENT,
                    fields: [
                        { name: 'numbers', type: 'array', arrayElementType: { kind: 'builtin', type: 'number' } },
                        { name: 'strings', type: 'array', arrayElementType: { kind: 'builtin', type: 'string' } },
                        { name: 'entities', type: 'array', arrayElementType: { kind: 'builtin', type: 'entity' } }
                    ]
                };
                
                coordinator.registerComponentWithSchema(schema);
                
                const component = {
                    numbers: [1, 2, 3],
                    strings: ['a', 'b', 'c'],
                    entities: [10, 20, 30]
                };
                
                expect(coordinator.validateComponentData(MULTI_ARRAY_COMPONENT, component)).toBe(true);
                
                const entity = coordinator.createEntity();
                coordinator.addComponentToEntityWithSchema(MULTI_ARRAY_COMPONENT, entity, component);
                
                const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(MULTI_ARRAY_COMPONENT, entity);
                expect(retrieved).toEqual(component);
            });

            it('should support custom types in arrays', () => {
                const coordinator = new Coordinator();
                
                // First, register a custom component type
                const itemSchema: ComponentSchema = {
                    componentName: ITEM,
                    fields: [
                        { name: 'name', type: 'string' },
                        { name: 'value', type: 'number' }
                    ]
                };
                coordinator.registerComponentWithSchema(itemSchema);
                
                // Now create a component that has an array of Items
                const inventorySchema: ComponentSchema = {
                    componentName: INVENTORY,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'custom', typeName: ITEM } }
                    ]
                };
                coordinator.registerComponentWithSchema(inventorySchema);
                
                const entity = coordinator.createEntity();
                const inventory = {
                    items: [
                        { name: 'sword', value: 100 },
                        { name: 'shield', value: 50 }
                    ]
                };
                
                // Should validate successfully
                expect(coordinator.validateComponentData(INVENTORY, inventory)).toBe(true);
                
                coordinator.addComponentToEntityWithSchema(INVENTORY, entity, inventory);
                const retrieved = coordinator.getComponentFromEntity<Record<string, unknown>>(INVENTORY, entity);
                expect(retrieved).toEqual(inventory);
            });

            it('should validate custom type array elements against their schema', () => {
                const coordinator = new Coordinator();
                
                const itemSchema: ComponentSchema = {
                    componentName: ITEM,
                    fields: [
                        { name: 'name', type: 'string' },
                        { name: 'value', type: 'number' }
                    ]
                };
                coordinator.registerComponentWithSchema(itemSchema);
                
                const inventorySchema: ComponentSchema = {
                    componentName: INVENTORY,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'custom', typeName: ITEM } }
                    ]
                };
                coordinator.registerComponentWithSchema(inventorySchema);
                
                // Valid: all items match Item schema
                expect(coordinator.validateComponentData(INVENTORY, {
                    items: [
                        { name: 'sword', value: 100 },
                        { name: 'shield', value: 50 }
                    ]
                })).toBe(true);
                
                // Invalid: item missing required field
                expect(coordinator.validateComponentData(INVENTORY, {
                    items: [
                        { name: 'sword' }, // missing 'value'
                        { name: 'shield', value: 50 }
                    ]
                })).toBe(false);
                
                // Invalid: item has wrong type
                expect(coordinator.validateComponentData(INVENTORY, {
                    items: [
                        { name: 'sword', value: '100' }, // value should be number
                        { name: 'shield', value: 50 }
                    ]
                })).toBe(false);
            });

            it('should handle custom types that are not yet registered (lenient validation)', () => {
                const coordinator = new Coordinator();
                
                // Register a component with custom type that doesn't exist yet
                const inventorySchema: ComponentSchema = {
                    componentName: INVENTORY,
                    fields: [
                        { name: 'items', type: 'array', arrayElementType: { kind: 'custom', typeName: FUTURE_ITEM } }
                    ]
                };
                coordinator.registerComponentWithSchema(inventorySchema);
                
                // Should still validate as objects (lenient mode)
                expect(coordinator.validateComponentData(INVENTORY, {
                    items: [
                        { name: 'sword', value: 100 },
                        { name: 'shield', value: 50 }
                    ]
                })).toBe(true);
                
                // But should reject non-objects
                expect(coordinator.validateComponentData(INVENTORY, {
                    items: ['sword', 'shield'] // Not objects
                })).toBe(false);
            });
        });
    });

});