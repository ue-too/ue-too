import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import Ajv from "ajv";
import { deserializeComponentSchema, SerializedComponentSchema } from "@ue-too/ecs";

/**
 * Creates an ajv validator instance with the component schema loaded.
 */
function createValidator(schemaPath: string) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    
    const schemaJson = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaJson);
    
    return ajv.compile(schema);
}

describe('Fixture JSON Schema Validation', () => {
    const fixturesDir = join(__dirname, 'fixtures');
    const schemaPath = join(fixturesDir, 'component-schema.schema.json');

    describe('JSON Schema file', () => {
        it('should be valid JSON', () => {
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            expect(() => JSON.parse(schemaJson)).not.toThrow();
        });

        it('should have required JSON Schema properties', () => {
            const schemaJson = readFileSync(schemaPath, 'utf-8');
            const schema = JSON.parse(schemaJson);

            expect(schema.$schema).toBeDefined();
            expect(schema.type).toBe('object');
            expect(schema.required).toContain('componentName');
            expect(schema.required).toContain('fields');
            expect(schema.definitions).toBeDefined();
        });
    });

    describe('Component schema fixtures', () => {
        // Get all JSON files in fixtures directory (excluding the schema file itself)
        const fixtureFiles = readdirSync(fixturesDir)
            .filter(file => file.endsWith('.json') && file !== 'component-schema.schema.json')
            .map(file => join(fixturesDir, file));

        it('should have at least one component schema fixture', () => {
            expect(fixtureFiles.length).toBeGreaterThan(0);
        });

        fixtureFiles.forEach((fixturePath) => {
            const fixtureName = fixturePath.split('/').pop() || fixturePath.split('\\').pop();

            describe(fixtureName || 'unknown', () => {
                it('should be valid JSON', () => {
                    const json = readFileSync(fixturePath, 'utf-8');
                    expect(() => JSON.parse(json)).not.toThrow();
                });

                it('should match SerializedComponentSchema structure', () => {
                    const json = readFileSync(fixturePath, 'utf-8');
                    const data: unknown = JSON.parse(json);

                    // Basic structure validation
                    if (!data || typeof data !== 'object' || Array.isArray(data)) {
                        throw new Error('Root must be an object');
                    }

                    const obj = data as Record<string, unknown>;
                    expect(obj.componentName).toBeDefined();
                    expect(typeof obj.componentName).toBe('string');
                    expect(obj.fields).toBeDefined();
                    expect(Array.isArray(obj.fields)).toBe(true);
                });

                it('should validate against component-schema.schema.json using ajv', () => {
                    const json = readFileSync(fixturePath, 'utf-8');
                    const data: unknown = JSON.parse(json);

                    const validate = createValidator(schemaPath);
                    const valid = validate(data);
                    
                    expect(valid).toBe(true);
                    if (!valid && validate.errors) {
                        const errorMessages = validate.errors.map(err => 
                            `${err.instancePath || 'root'} ${err.message}`
                        ).join('\n');
                        console.error(`Validation errors for ${fixtureName}:\n`, errorMessages);
                    }
                });

                it('should deserialize correctly', () => {
                    const json = readFileSync(fixturePath, 'utf-8');
                    const serializedSchema: SerializedComponentSchema = JSON.parse(json);

                    expect(() => deserializeComponentSchema(serializedSchema)).not.toThrow();
                    
                    const schema = deserializeComponentSchema(serializedSchema);
                    expect(schema.componentName).toBeDefined();
                    expect(Array.isArray(schema.fields)).toBe(true);
                    expect(schema.fields.length).toBeGreaterThan(0);

                    // Verify all fields have required properties
                    schema.fields.forEach((field, index) => {
                        expect(field.name).toBeDefined();
                        expect(typeof field.name).toBe('string');
                        expect(field.type).toBeDefined();
                        
                        if (field.type === 'array') {
                            expect('arrayElementType' in field).toBe(true);
                            const arrayField = field as { arrayElementType: { kind: string; type?: string; typeName?: string } };
                            expect(['builtin', 'custom']).toContain(arrayField.arrayElementType.kind);
                            if (arrayField.arrayElementType.kind === 'builtin') {
                                expect(arrayField.arrayElementType.type).toBeDefined();
                            } else {
                                expect(arrayField.arrayElementType.typeName).toBeDefined();
                            }
                        }
                    });
                });

                it('should have unique field names', () => {
                    const json = readFileSync(fixturePath, 'utf-8');
                    const data = JSON.parse(json) as SerializedComponentSchema;

                    const fieldNames = new Set<string>();
                    data.fields.forEach((field) => {
                        expect(fieldNames.has(field.name)).toBe(false);
                        fieldNames.add(field.name);
                    });
                });
            });
        });
    });
});
