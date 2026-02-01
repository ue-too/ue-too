/**
 * Example: Runtime Component Schema Definition
 *
 * This example demonstrates how to define component types at runtime,
 * which is useful for GUI-based component editors or dynamic game systems.
 */
import {
    ArrayElementType,
    ComponentFieldDefinition,
    ComponentFieldType,
    ComponentName,
    ComponentSchema,
    Coordinator,
    createGlobalComponentName,
    deserializeComponentSchema,
    serializeComponentSchema,
} from '../src';

// Example: GUI-defined component schema
// In a real GUI, this would be constructed from user input
function createComponentSchemaFromGUI(
    componentName: ComponentName,
    fields: Array<{
        name: string;
        type: ComponentFieldType;
        arrayElementType?: ArrayElementType;
        optional?: boolean;
        defaultValue?: unknown;
    }>
): ComponentSchema {
    return {
        componentName,
        fields: fields.map(f => {
            const baseField = {
                name: f.name,
                optional: f.optional ?? false,
                defaultValue: f.defaultValue,
            };

            if (f.type === 'array') {
                if (!f.arrayElementType) {
                    throw new Error(
                        `Array field "${f.name}" must specify arrayElementType`
                    );
                }
                return {
                    ...baseField,
                    type: 'array' as const,
                    arrayElementType: f.arrayElementType,
                } as ComponentFieldDefinition;
            } else {
                return {
                    ...baseField,
                    type: f.type,
                } as ComponentFieldDefinition;
            }
        }),
    };
}

// Example usage
const coordinator = new Coordinator();

// Create component names using global symbols (for serialization support)
const PLAYER_STATS = createGlobalComponentName('PlayerStats');

// User defines a component through GUI:
// - Component name: "PlayerStats"
// - Fields:
//   - health: number, default: 100
//   - name: string, default: "Player"
//   - level: number, default: 1
//   - inventory: array of strings, default: []
//   - ownedEntities: array of entities, default: []
//   - metadata: object, optional: true

const playerStatsSchema = createComponentSchemaFromGUI(PLAYER_STATS, [
    { name: 'health', type: 'number', defaultValue: 100 },
    { name: 'name', type: 'string', defaultValue: 'Player' },
    { name: 'level', type: 'number', defaultValue: 1 },
    {
        name: 'inventory',
        type: 'array',
        arrayElementType: { kind: 'builtin', type: 'string' },
        defaultValue: [],
    },
    {
        name: 'ownedEntities',
        type: 'array',
        arrayElementType: { kind: 'builtin', type: 'entity' },
        defaultValue: [],
    },
    { name: 'metadata', type: 'object', optional: true },
]);

// Register the schema
coordinator.registerComponentWithSchema(playerStatsSchema);

// Create entities with the component
const player1 = coordinator.createEntity();
const player1Component = coordinator.createComponentFromSchema(PLAYER_STATS, {
    name: 'Alice',
    health: 150,
});
coordinator.addComponentToEntityWithSchema(
    PLAYER_STATS,
    player1,
    player1Component
);

const player2 = coordinator.createEntity();
const player2Component = coordinator.createComponentFromSchema(PLAYER_STATS, {
    name: 'Bob',
    level: 5,
});
coordinator.addComponentToEntityWithSchema(
    PLAYER_STATS,
    player2,
    player2Component
);

// Retrieve components
const p1Stats = coordinator.getComponentFromEntity<Record<string, unknown>>(
    PLAYER_STATS,
    player1
);
const p2Stats = coordinator.getComponentFromEntity<Record<string, unknown>>(
    PLAYER_STATS,
    player2
);

console.log('Player 1:', p1Stats);
// Output: { health: 150, name: 'Alice', level: 1, inventory: [] }

console.log('Player 2:', p2Stats);
// Output: { health: 100, name: 'Bob', level: 5, inventory: [] }

// Example: Serialize/deserialize schemas for persistence
// Save schema to storage (e.g., localStorage, database)
const serialized = serializeComponentSchema(playerStatsSchema);
const schemaJson = JSON.stringify(serialized);
console.log('Serialized schema:', schemaJson);

// Load schema from storage
const loadedSerialized = JSON.parse(schemaJson);
const loadedSchema = deserializeComponentSchema(loadedSerialized);
coordinator.registerComponentWithSchema(loadedSchema);

// Example: GUI component editor helper functions
export function getFieldTypeOptions(): ComponentFieldType[] {
    return ['string', 'number', 'boolean', 'object', 'array', 'entity'];
}

export function createEmptyField(): ComponentFieldDefinition {
    return {
        name: '',
        type: 'string',
        optional: false,
    };
}

// Example: Typed array usage with built-in types
export function exampleTypedArrays() {
    const coordinator = new Coordinator();
    const INVENTORY = createGlobalComponentName('Inventory');

    // Define a component with typed arrays
    const inventorySchema: ComponentSchema = {
        componentName: INVENTORY,
        fields: [
            {
                name: 'items',
                type: 'array',
                arrayElementType: { kind: 'builtin', type: 'string' },
                defaultValue: [],
            },
            {
                name: 'quantities',
                type: 'array',
                arrayElementType: { kind: 'builtin', type: 'number' },
                defaultValue: [],
            },
            {
                name: 'ownedEntities',
                type: 'array',
                arrayElementType: { kind: 'builtin', type: 'entity' },
                defaultValue: [],
            },
        ],
    };

    coordinator.registerComponentWithSchema(inventorySchema);

    const entity = coordinator.createEntity();
    const inventory = {
        items: ['sword', 'shield', 'potion'],
        quantities: [1, 1, 3],
        ownedEntities: [10, 20, 30],
    };

    // This will validate that all array elements match their types
    coordinator.addComponentToEntityWithSchema(INVENTORY, entity, inventory);

    console.log(
        'Inventory component:',
        coordinator.getComponentFromEntity(INVENTORY, entity)
    );
}

// Example: Custom types in arrays
export function exampleCustomTypeArrays() {
    const coordinator = new Coordinator();
    const ITEM = createGlobalComponentName('Item');
    const INVENTORY = createGlobalComponentName('Inventory');

    // First, define a custom component type (Item)
    const itemSchema: ComponentSchema = {
        componentName: ITEM,
        fields: [
            { name: 'name', type: 'string' },
            { name: 'value', type: 'number' },
            { name: 'rarity', type: 'string', optional: true },
        ],
    };
    coordinator.registerComponentWithSchema(itemSchema);

    // Now create an inventory that contains an array of Items
    const inventorySchema: ComponentSchema = {
        componentName: INVENTORY,
        fields: [
            {
                name: 'items',
                type: 'array',
                arrayElementType: { kind: 'custom', typeName: ITEM },
                defaultValue: [],
            },
        ],
    };
    coordinator.registerComponentWithSchema(inventorySchema);

    const entity = coordinator.createEntity();
    const inventory = {
        items: [
            { name: 'Sword of Truth', value: 100, rarity: 'legendary' },
            { name: 'Shield of Protection', value: 50 },
            { name: 'Health Potion', value: 10, rarity: 'common' },
        ],
    };

    // This will validate that each item in the array matches the Item schema
    coordinator.addComponentToEntityWithSchema(INVENTORY, entity, inventory);

    console.log(
        'Inventory with custom types:',
        coordinator.getComponentFromEntity(INVENTORY, entity)
    );
}

export function validateSchema(schema: ComponentSchema): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!schema.componentName) {
        errors.push('Component name is required');
    }

    if (!schema.fields || schema.fields.length === 0) {
        errors.push('At least one field is required');
    }

    const fieldNames = new Set<string>();
    for (const field of schema.fields) {
        if (!field.name || field.name.trim() === '') {
            errors.push('Field name is required');
        }
        if (fieldNames.has(field.name)) {
            errors.push(`Duplicate field name: ${field.name}`);
        }
        fieldNames.add(field.name);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
