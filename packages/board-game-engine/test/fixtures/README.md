# Component Schema JSON Fixtures

This directory contains JSON fixtures for component schemas used in tests.

## Schema Definition

Component schemas follow the `SerializedComponentSchema` format from `@ue-too/ecs`. A JSON schema definition is available in `component-schema.schema.json` that can be used to validate component schema JSON files.

## Structure

A component schema JSON file must have the following structure:

```json
{
  "componentName": "ComponentName",
  "fields": [
    {
      "name": "fieldName",
      "type": "string" | "number" | "boolean" | "object" | "entity" | "array",
      "optional": false,  // optional, defaults to false
      "defaultValue": <value>  // optional
    }
  ]
}
```

### Field Types

#### Primitive Fields

For non-array fields, use one of these types:
- `"string"` - String values
- `"number"` - Numeric values
- `"boolean"` - Boolean values
- `"object"` - Object values
- `"entity"` - Entity references

Example:
```json
{
  "name": "health",
  "type": "number",
  "defaultValue": 100
}
```

#### Array Fields

For array fields, you must specify `"type": "array"` and provide an `arrayElementType`:

**Built-in array element types:**
```json
{
  "name": "tags",
  "type": "array",
  "arrayElementType": {
    "kind": "builtin",
    "type": "string"
  },
  "defaultValue": []
}
```

**Custom component array element types:**
```json
{
  "name": "inventory",
  "type": "array",
  "arrayElementType": {
    "kind": "custom",
    "typeName": "ItemComponent"
  },
  "defaultValue": []
}
```

## Validation

You can validate component schema JSON files against the JSON schema definition using any JSON Schema validator (e.g., ajv, jsonschema, etc.):

```typescript
import Ajv from 'ajv';
import schema from './component-schema.schema.json';
import componentSchema from './player-stats-schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);
const valid = validate(componentSchema);

if (!valid) {
  console.error(validate.errors);
}
```

## Examples

- `player-stats-schema.json` - Example component schema with multiple primitive number fields
