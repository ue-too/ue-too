import {
    SerializedComponentSchema,
    deserializeComponentSchema,
} from '@ue-too/ecs';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Simple validation function for component schemas.
 * This validates the structure matches SerializedComponentSchema requirements.
 */
function validateComponentSchemaStructure(data: unknown): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, errors: ['Root must be an object'] };
    }

    const obj = data as Record<string, unknown>;

    // Check componentName
    if (!obj.componentName || typeof obj.componentName !== 'string') {
        errors.push('componentName is required and must be a string');
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(obj.componentName)) {
        errors.push('componentName must be a valid identifier');
    }

    // Check fields
    if (!obj.fields) {
        errors.push('fields is required');
    } else if (!Array.isArray(obj.fields)) {
        errors.push('fields must be an array');
    } else {
        const fieldNames = new Set<string>();
        obj.fields.forEach((field: unknown, index: number) => {
            if (!field || typeof field !== 'object' || Array.isArray(field)) {
                errors.push(`fields[${index}] must be an object`);
                return;
            }

            const fieldObj = field as Record<string, unknown>;

            // Check name
            if (!fieldObj.name || typeof fieldObj.name !== 'string') {
                errors.push(
                    `fields[${index}].name is required and must be a string`
                );
            } else {
                if (fieldNames.has(fieldObj.name)) {
                    errors.push(`Duplicate field name: ${fieldObj.name}`);
                }
                fieldNames.add(fieldObj.name);
            }

            // Check type
            if (!fieldObj.type || typeof fieldObj.type !== 'string') {
                errors.push(
                    `fields[${index}].type is required and must be a string`
                );
            } else {
                const validTypes = [
                    'string',
                    'number',
                    'boolean',
                    'object',
                    'entity',
                    'array',
                ];
                if (!validTypes.includes(fieldObj.type)) {
                    errors.push(
                        `fields[${index}].type must be one of: ${validTypes.join(', ')}`
                    );
                }

                // If type is array, check arrayElementType
                if (fieldObj.type === 'array') {
                    if (
                        !fieldObj.arrayElementType ||
                        typeof fieldObj.arrayElementType !== 'object'
                    ) {
                        errors.push(
                            `fields[${index}].arrayElementType is required for array fields`
                        );
                    } else {
                        const elementType = fieldObj.arrayElementType as Record<
                            string,
                            unknown
                        >;
                        if (
                            !elementType.kind ||
                            typeof elementType.kind !== 'string'
                        ) {
                            errors.push(
                                `fields[${index}].arrayElementType.kind is required`
                            );
                        } else if (elementType.kind === 'builtin') {
                            if (
                                !elementType.type ||
                                typeof elementType.type !== 'string'
                            ) {
                                errors.push(
                                    `fields[${index}].arrayElementType.type is required for builtin type`
                                );
                            }
                        } else if (elementType.kind === 'custom') {
                            if (
                                !elementType.typeName ||
                                typeof elementType.typeName !== 'string'
                            ) {
                                errors.push(
                                    `fields[${index}].arrayElementType.typeName is required for custom type`
                                );
                            }
                        } else {
                            errors.push(
                                `fields[${index}].arrayElementType.kind must be 'builtin' or 'custom'`
                            );
                        }
                    }
                }
            }

            // Check optional (optional field)
            if (
                fieldObj.optional !== undefined &&
                typeof fieldObj.optional !== 'boolean'
            ) {
                errors.push(
                    `fields[${index}].optional must be a boolean if provided`
                );
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

describe('Component Schema JSON Validation', () => {
    describe('player-stats-schema.json', () => {
        it('should be valid JSON', () => {
            const schemaPath = join(
                __dirname,
                'fixtures',
                'player-stats-schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');

            expect(() => JSON.parse(schemaJson)).not.toThrow();
        });

        it('should match SerializedComponentSchema structure', () => {
            const schemaPath = join(
                __dirname,
                'fixtures',
                'player-stats-schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const schemaData: unknown = JSON.parse(schemaJson);

            const validation = validateComponentSchemaStructure(schemaData);
            expect(validation.valid).toBe(true);
            if (!validation.valid) {
                console.error('Validation errors:', validation.errors);
            }
        });

        it('should deserialize correctly', () => {
            const schemaPath = join(
                __dirname,
                'fixtures',
                'player-stats-schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const serializedSchema: SerializedComponentSchema =
                JSON.parse(schemaJson);

            expect(() =>
                deserializeComponentSchema(serializedSchema)
            ).not.toThrow();

            const schema = deserializeComponentSchema(serializedSchema);
            expect(schema.componentName).toBeDefined();
            expect(schema.fields).toHaveLength(5);
            expect(schema.fields.map(f => f.name)).toEqual([
                'health',
                'maxHealth',
                'mana',
                'level',
                'experience',
            ]);
        });
    });

    describe('component-schema.schema.json', () => {
        it('should be valid JSON', () => {
            const schemaPath = join(
                __dirname,
                'fixtures',
                'component-schema.schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');

            expect(() => JSON.parse(schemaJson)).not.toThrow();
        });

        it('should be a valid JSON Schema', () => {
            const schemaPath = join(
                __dirname,
                'fixtures',
                'component-schema.schema.json'
            );
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const schemaData = JSON.parse(schemaJson);

            // Basic JSON Schema structure checks
            expect(schemaData.$schema).toBeDefined();
            expect(schemaData.type).toBe('object');
            expect(schemaData.required).toContain('componentName');
            expect(schemaData.required).toContain('fields');
            expect(schemaData.definitions).toBeDefined();
        });
    });

    describe('validation function', () => {
        it('should reject invalid structures', () => {
            const invalidCases = [
                null,
                undefined,
                'string',
                123,
                [],
                {},
                { componentName: 123 },
                { fields: 'not-array' },
                { componentName: 'Test', fields: [{ name: 123 }] },
                { componentName: 'Test', fields: [{ type: 'number' }] },
                {
                    componentName: 'Test',
                    fields: [{ name: 'test', type: 'invalid' }],
                },
                {
                    componentName: 'Test',
                    fields: [{ name: 'test', type: 'array' }],
                }, // missing arrayElementType
            ];

            invalidCases.forEach((invalid, index) => {
                const result = validateComponentSchemaStructure(invalid);
                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        it('should accept valid structures', () => {
            const validCases = [
                {
                    componentName: 'TestComponent',
                    fields: [
                        { name: 'health', type: 'number', defaultValue: 100 },
                    ],
                },
                {
                    componentName: 'TestComponent',
                    fields: [
                        {
                            name: 'tags',
                            type: 'array',
                            arrayElementType: {
                                kind: 'builtin',
                                type: 'string',
                            },
                        },
                    ],
                },
                {
                    componentName: 'TestComponent',
                    fields: [
                        {
                            name: 'items',
                            type: 'array',
                            arrayElementType: {
                                kind: 'custom',
                                typeName: 'ItemComponent',
                            },
                        },
                    ],
                },
            ];

            validCases.forEach(valid => {
                const result = validateComponentSchemaStructure(valid);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });

        it('should detect duplicate field names', () => {
            const schema = {
                componentName: 'TestComponent',
                fields: [
                    { name: 'health', type: 'number' },
                    { name: 'health', type: 'number' }, // duplicate
                ],
            };

            const result = validateComponentSchemaStructure(schema);
            expect(result.valid).toBe(false);
            expect(
                result.errors.some(e => e.includes('Duplicate field name'))
            ).toBe(true);
        });
    });
});
