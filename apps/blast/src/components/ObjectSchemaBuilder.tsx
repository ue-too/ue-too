import React, { useState, useCallback } from 'react';

interface Field {
  id: number;
  name: string;
  type: string;
  required: boolean;
}

interface SavedSchema {
  name: string;
  fields: Field[];
}

export function ObjectSchemaBuilder() {
  const [schemaName, setSchemaName] = useState('MySchema');
  const [fields, setFields] = useState<Field[]>([]);
  const [savedSchemas, setSavedSchemas] = useState<Record<string, SavedSchema>>({});
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('string');
  const [requiredField, setRequiredField] = useState(false);
  const [schemaOutput, setSchemaOutput] = useState('');

  const addField = useCallback(() => {
    if (!fieldName.trim()) {
      alert('Please enter a field name');
      return;
    }

    const newField: Field = {
      id: Date.now(),
      name: fieldName.trim(),
      type: fieldType,
      required: requiredField,
    };

    setFields([...fields, newField]);
    setFieldName('');
    setRequiredField(false);
    updateOutput();
  }, [fieldName, fieldType, requiredField, fields]);

  const deleteField = useCallback((id: number) => {
    setFields(fields.filter(f => f.id !== id));
    updateOutput();
  }, [fields]);

  const formatType = useCallback((type: string) => {
    const typeMap: Record<string, string> = {
      'string': 'String',
      'number': 'Number',
      'boolean': 'Boolean',
      'date': 'Date',
      'array_string': 'String[]',
      'array_number': 'Number[]',
      'array_boolean': 'Boolean[]',
      'array_date': 'Date[]',
    };
    
    if (type.startsWith('schema_')) {
      return type.replace('schema_', '') + ' (Schema)';
    }
    if (type.startsWith('array_schema_')) {
      return type.replace('array_schema_', '') + '[] (Array)';
    }
    
    return typeMap[type] || type;
  }, []);

  const updateOutput = useCallback(() => {
    const schema = {
      name: schemaName || 'MySchema',
      fields: fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
      })),
    };

    setSchemaOutput(JSON.stringify(schema, null, 2));
  }, [schemaName, fields]);

  const saveAsNestedSchema = useCallback(() => {
    const name = schemaName.trim();
    
    if (!name) {
      alert('Please enter a schema name');
      return;
    }

    if (fields.length === 0) {
      alert('Please add at least one field to the schema');
      return;
    }

    if (savedSchemas[name]) {
      if (!confirm(`Schema "${name}" already exists. Overwrite?`)) {
        return;
      }
    }

    setSavedSchemas({
      ...savedSchemas,
      [name]: {
        name,
        fields: [...fields],
      },
    });

    alert(`Schema "${name}" saved! You can now use it as a field type.`);
  }, [schemaName, fields, savedSchemas]);

  const deleteSchema = useCallback((name: string) => {
    if (!confirm(`Delete schema "${name}"?`)) return;
    
    const newSavedSchemas = { ...savedSchemas };
    delete newSavedSchemas[name];
    setSavedSchemas(newSavedSchemas);

    // Remove any fields using this schema
    setFields(fields.filter(f => 
      f.type !== `schema_${name}` && 
      f.type !== `array_schema_${name}`
    ));
    updateOutput();
  }, [savedSchemas, fields, updateOutput]);

  const copySchema = useCallback(() => {
    if (!schemaOutput || schemaOutput.includes('Add fields')) {
      alert('No schema to copy');
      return;
    }

    navigator.clipboard.writeText(schemaOutput).then(() => {
      alert('Schema copied to clipboard!');
    });
  }, [schemaOutput]);

  const clearAll = useCallback(() => {
    if (!confirm('Clear all fields? This will not delete saved schemas.')) return;
    
    setFields([]);
    updateOutput();
  }, [updateOutput]);

  React.useEffect(() => {
    updateOutput();
  }, [updateOutput]);

  const customSchemaOptions = Object.keys(savedSchemas).map(name => (
    <React.Fragment key={name}>
      <option value={`schema_${name}`}>{name} (Schema)</option>
      <option value={`array_schema_${name}`}>{name}[] (Array)</option>
    </React.Fragment>
  ));

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '30px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2em', marginBottom: '10px' }}>📋 Schema Builder</h1>
        <p style={{ opacity: 0.9, fontSize: '0.95em' }}>Define custom data schemas with primitives, arrays, and nested structures</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
        {/* Builder Panel */}
        <div style={{ padding: '30px', borderRight: '1px solid #e0e0e0' }}>
          <h2 style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '20px', color: '#333' }}>🔧 Schema Definition</h2>
          
          <input
            type="text"
            value={schemaName}
            onChange={(e) => {
              setSchemaName(e.target.value);
              updateOutput();
            }}
            placeholder="Enter schema name (e.g., User, Product)"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1em',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          />

          <div style={{ marginBottom: '20px' }}>
            {fields.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                <div style={{ fontSize: '3em', marginBottom: '10px' }}>📝</div>
                <p>No fields added yet</p>
              </div>
            ) : (
              fields.map(field => {
                const isArray = field.type.startsWith('array_');
                return (
                  <div key={field.id} style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#333', fontSize: '1em' }}>{field.name}</div>
                        {field.required && <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '8px' }}>Required</div>}
                      </div>
                      <span style={{ display: 'inline-block', padding: '4px 10px', background: isArray ? '#f59e0b' : '#667eea', color: 'white', borderRadius: '12px', fontSize: '0.85em' }}>
                        {formatType(field.type)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => deleteField(field.id)}
                        style={{ padding: '6px 12px', fontSize: '0.85em', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, background: '#ef4444', color: 'white' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ background: '#f0f4ff', border: '2px dashed #667eea', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#555', fontSize: '0.9em' }}>Field Name</label>
              <input
                type="text"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addField()}
                placeholder="e.g., username, age, email"
                style={{ width: '100%', padding: '10px', fontSize: '0.95em', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#555', fontSize: '0.9em' }}>Field Type</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '0.95em', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <optgroup label="Primitives">
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                </optgroup>
                <optgroup label="Arrays">
                  <option value="array_string">Array of Strings</option>
                  <option value="array_number">Array of Numbers</option>
                  <option value="array_boolean">Array of Booleans</option>
                  <option value="array_date">Array of Dates</option>
                </optgroup>
                {Object.keys(savedSchemas).length > 0 && (
                  <optgroup label="Custom Schemas">
                    {customSchemaOptions}
                  </optgroup>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', marginBottom: '15px' }}>
              <input
                type="checkbox"
                id="requiredField"
                checked={requiredField}
                onChange={(e) => setRequiredField(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="requiredField" style={{ cursor: 'pointer' }}>Required field</label>
            </div>

            <button
              onClick={addField}
              style={{ padding: '12px 24px', fontSize: '1em', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, width: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
            >
              + Add Field
            </button>
            <button
              onClick={saveAsNestedSchema}
              style={{ padding: '12px 24px', fontSize: '1em', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, width: '100%', marginTop: '10px', background: '#6b7280', color: 'white' }}
            >
              💾 Save as Reusable Schema
            </button>
          </div>

          {Object.keys(savedSchemas).length > 0 && (
            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e0e0e0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '15px', color: '#333' }}>📦 Saved Schemas</div>
              {Object.values(savedSchemas).map(schema => (
                <div key={schema.name} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '10px 15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0369a1' }}>{schema.name}</div>
                    <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px' }}>{schema.fields.length} fields</div>
                  </div>
                  <button
                    onClick={() => deleteSchema(schema.name)}
                    style={{ padding: '6px 12px', fontSize: '0.85em', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, background: '#ef4444', color: 'white' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div style={{ background: '#1e293b', padding: '30px', color: '#e2e8f0' }}>
          <h2 style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '20px', color: '#e2e8f0' }}>📄 JSON Schema Output</h2>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '20px', fontFamily: "'Courier New', monospace", fontSize: '0.9em', overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', whiteSpace: 'pre', color: '#e2e8f0', marginBottom: '15px' }}>
            {schemaOutput || (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                <div style={{ fontSize: '3em', marginBottom: '10px' }}>📝</div>
                <p>Add fields to see the schema definition</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={copySchema}
              disabled={!schemaOutput || schemaOutput.includes('Add fields')}
              style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: schemaOutput && !schemaOutput.includes('Add fields') ? 'pointer' : 'not-allowed', opacity: schemaOutput && !schemaOutput.includes('Add fields') ? 1 : 0.5 }}
            >
              📋 Copy Schema
            </button>
            <button
              onClick={clearAll}
              style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              🗑️ Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
