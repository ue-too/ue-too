import React, { useState, useCallback } from 'react';
import type {
  ComponentDefinition,
  ZoneDefinition,
  EntityTemplateDefinition,
  ActionDefinitionSchema,
  PhaseDefinitionSchema,
  SetupDefinitionSchema,
  PropertyDefinition,
  PropertyType,
} from '../../board-game-engine/schema/types';

// Extended metadata that includes fields from the JSON schema but not in TypeScript types
interface ExtendedMetadata {
  author?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  estimatedDuration?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  tags?: string[];
}

// Extended game definition that includes all fields for the builder
interface BuilderGameDefinition {
  $schema?: string;
  name: string;
  version: string;
  metadata?: ExtendedMetadata;
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  entityTemplates: Record<string, EntityTemplateDefinition>;
  actions: ActionDefinitionSchema[];
  phases: PhaseDefinitionSchema[];
  rules?: unknown[];
  setup: SetupDefinitionSchema;
  winConditions?: unknown[];
}

// Tab sections
type Tab = 'metadata' | 'components' | 'zones' | 'templates' | 'actions' | 'phases' | 'setup';

// Default empty game definition
const createEmptyGameDefinition = (): BuilderGameDefinition => ({
  name: 'New Game',
  version: '1.0.0',
  metadata: {
    author: '',
    description: '',
    minPlayers: 2,
    maxPlayers: 2,
    complexity: 'simple',
    tags: [],
  },
  components: {},
  zones: {},
  entityTemplates: {},
  actions: [],
  phases: [],
  rules: [],
  setup: {
    playerCount: { min: 2, max: 2 },
    initialPhase: 'Main',
    perPlayer: {
      template: 'Player',
      zones: [],
      startingEntities: [],
    },
    setupEffects: [],
  },
  winConditions: [],
});

// Shared styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: 'calc(100vh - 100px)',
    maxWidth: '1800px',
    margin: '0 auto',
    padding: '0 20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: '#f3f4f6',
    padding: '4px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  tab: (active: boolean) => ({
    padding: '10px 16px',
    background: active ? 'white' : 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    color: active ? '#667eea' : '#666',
    fontSize: '0.9em',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  }),
  splitPanel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  editorPanel: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'auto',
  },
  previewPanel: {
    background: '#1e293b',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  previewContent: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '15px',
    fontFamily: 'monospace',
    fontSize: '0.85em',
    flex: 1,
    overflow: 'auto',
    whiteSpace: 'pre-wrap' as const,
    color: '#e2e8f0',
    wordBreak: 'break-word' as const,
  },
  button: {
    padding: '8px 16px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  dangerButton: {
    padding: '8px 16px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  successButton: {
    padding: '8px 16px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9em',
    width: '100%',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9em',
    width: '100%',
    background: 'white',
  },
  label: {
    display: 'block',
    fontSize: '0.85em',
    fontWeight: 600,
    marginBottom: '4px',
    color: '#374151',
  },
  fieldGroup: {
    marginBottom: '16px',
  },
  card: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '1.1em',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#1f2937',
  },
};

export function GameDefinitionBuilder() {
  const [gameDefinition, setGameDefinition] = useState<BuilderGameDefinition>(createEmptyGameDefinition());
  const [activeTab, setActiveTab] = useState<Tab>('metadata');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update nested property
  const updateDefinition = useCallback(<K extends keyof BuilderGameDefinition>(
    key: K,
    value: BuilderGameDefinition[K]
  ) => {
    setGameDefinition(prev => ({ ...prev, [key]: value }));
  }, []);

  // Load JSON from file
  const loadFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setGameDefinition(json);
        setValidationErrors([]);
      } catch (err) {
        alert('Failed to load file: ' + (err as Error).message);
      }
    };
    input.click();
  }, []);

  // Save JSON to file
  const saveToFile = useCallback(() => {
    const json = JSON.stringify(gameDefinition, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameDefinition.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [gameDefinition]);

  // Copy to clipboard
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(gameDefinition, null, 2));
    alert('Copied to clipboard!');
  }, [gameDefinition]);

  // Validate definition
  const validate = useCallback(() => {
    const errors: string[] = [];
    if (!gameDefinition.name) errors.push('Game name is required');
    if (!gameDefinition.version) errors.push('Version is required');
    if (Object.keys(gameDefinition.components).length === 0) errors.push('At least one component is required');
    if (gameDefinition.phases.length === 0) errors.push('At least one phase is required');
    if (!gameDefinition.setup.perPlayer.template) errors.push('Player template is required');
    setValidationErrors(errors);
    return errors.length === 0;
  }, [gameDefinition]);

  // Load example (simple-card-game)
  const loadExample = useCallback(async () => {
    try {
      const response = await fetch('/src/games/simple-card-game/simple-card-game.json');
      if (response.ok) {
        const json = await response.json();
        setGameDefinition(json as BuilderGameDefinition);
        setValidationErrors([]);
      } else {
        // Try fetching from a different path
        const altResponse = await fetch('/games/simple-card-game/simple-card-game.json');
        if (altResponse.ok) {
          const json = await altResponse.json();
          setGameDefinition(json as BuilderGameDefinition);
          setValidationErrors([]);
        } else {
          alert('Could not load example file. Try using "Load JSON" and selecting the file manually.');
        }
      }
    } catch (err) {
      alert('Failed to load example: ' + (err as Error).message);
    }
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Game Definition Builder</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.button} onClick={loadExample}>Load Example</button>
          <button style={styles.button} onClick={loadFromFile}>Load JSON</button>
          <button style={styles.successButton} onClick={saveToFile}>Save JSON</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['metadata', 'components', 'zones', 'templates', 'actions', 'phases', 'setup'] as Tab[]).map(tab => (
          <button
            key={tab}
            style={styles.tab(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Split Panel */}
      <div style={styles.splitPanel}>
        {/* Editor Panel */}
        <div style={styles.editorPanel}>
          {activeTab === 'metadata' && (
            <MetadataSection
              gameDefinition={gameDefinition}
              updateDefinition={updateDefinition}
            />
          )}
          {activeTab === 'components' && (
            <ComponentsSection
              components={gameDefinition.components}
              onChange={(components) => updateDefinition('components', components)}
            />
          )}
          {activeTab === 'zones' && (
            <ZonesSection
              zones={gameDefinition.zones}
              onChange={(zones) => updateDefinition('zones', zones)}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesSection
              templates={gameDefinition.entityTemplates}
              components={gameDefinition.components}
              onChange={(templates) => updateDefinition('entityTemplates', templates)}
            />
          )}
          {activeTab === 'actions' && (
            <ActionsSection
              actions={gameDefinition.actions}
              components={gameDefinition.components}
              zones={gameDefinition.zones}
              onChange={(actions) => updateDefinition('actions', actions)}
            />
          )}
          {activeTab === 'phases' && (
            <PhasesSection
              phases={gameDefinition.phases}
              actions={gameDefinition.actions}
              onChange={(phases) => updateDefinition('phases', phases)}
            />
          )}
          {activeTab === 'setup' && (
            <SetupSection
              setup={gameDefinition.setup}
              templates={gameDefinition.entityTemplates}
              zones={gameDefinition.zones}
              phases={gameDefinition.phases}
              onChange={(setup) => updateDefinition('setup', setup)}
            />
          )}
        </div>

        {/* Preview Panel */}
        <div style={styles.previewPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#e2e8f0' }}>JSON Preview</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.button} onClick={validate}>Validate</button>
              <button style={styles.successButton} onClick={copyToClipboard}>Copy</button>
            </div>
          </div>
          {validationErrors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
              {validationErrors.map((error, i) => (
                <div key={i} style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>
              ))}
            </div>
          )}
          <div style={styles.previewContent}>
            {JSON.stringify(gameDefinition, null, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Metadata Section
// ============================================================================
interface MetadataSectionProps {
  gameDefinition: BuilderGameDefinition;
  updateDefinition: <K extends keyof BuilderGameDefinition>(key: K, value: BuilderGameDefinition[K]) => void;
}

function MetadataSection({ gameDefinition, updateDefinition }: MetadataSectionProps) {
  const updateMetadata = <K extends keyof ExtendedMetadata>(
    key: K,
    value: ExtendedMetadata[K]
  ) => {
    updateDefinition('metadata', { ...gameDefinition.metadata, [key]: value });
  };

  return (
    <div>
      <h3 style={styles.sectionTitle}>Game Information</h3>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Game Name</label>
        <input
          style={styles.input}
          value={gameDefinition.name}
          onChange={(e) => updateDefinition('name', e.target.value)}
          placeholder="My Card Game"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Version</label>
        <input
          style={styles.input}
          value={gameDefinition.version}
          onChange={(e) => updateDefinition('version', e.target.value)}
          placeholder="1.0.0"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Author</label>
        <input
          style={styles.input}
          value={gameDefinition.metadata?.author || ''}
          onChange={(e) => updateMetadata('author', e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Description</label>
        <textarea
          style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
          value={gameDefinition.metadata?.description || ''}
          onChange={(e) => updateMetadata('description', e.target.value)}
          placeholder="A short description of your game"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Min Players</label>
          <input
            type="number"
            style={styles.input}
            value={gameDefinition.metadata?.minPlayers || 2}
            onChange={(e) => updateMetadata('minPlayers', parseInt(e.target.value) || 2)}
            min={1}
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Max Players</label>
          <input
            type="number"
            style={styles.input}
            value={gameDefinition.metadata?.maxPlayers || 2}
            onChange={(e) => updateMetadata('maxPlayers', parseInt(e.target.value) || 2)}
            min={1}
          />
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Complexity</label>
        <select
          style={styles.select}
          value={gameDefinition.metadata?.complexity || 'simple'}
          onChange={(e) => updateMetadata('complexity', e.target.value as 'simple' | 'medium' | 'complex')}
        >
          <option value="simple">Simple</option>
          <option value="medium">Medium</option>
          <option value="complex">Complex</option>
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Tags (comma-separated)</label>
        <input
          style={styles.input}
          value={gameDefinition.metadata?.tags?.join(', ') || ''}
          onChange={(e) => updateMetadata('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="card-game, strategy, fantasy"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Components Section
// ============================================================================
interface ComponentsSectionProps {
  components: Record<string, ComponentDefinition>;
  onChange: (components: Record<string, ComponentDefinition>) => void;
}

function ComponentsSection({ components, onChange }: ComponentsSectionProps) {
  const addComponent = () => {
    const name = `Component${Object.keys(components).length + 1}`;
    onChange({ ...components, [name]: { properties: {} } });
  };

  const removeComponent = (name: string) => {
    const { [name]: _, ...rest } = components;
    onChange(rest);
  };

  const renameComponent = (oldName: string, newName: string) => {
    if (newName === oldName || !newName.trim()) return;
    if (components[newName]) {
      alert('Component name already exists');
      return;
    }
    const { [oldName]: comp, ...rest } = components;
    onChange({ ...rest, [newName]: comp });
  };

  const addProperty = (compName: string) => {
    const comp = components[compName];
    const propName = `property${Object.keys(comp.properties).length + 1}`;
    const newProp: PropertyDefinition = { type: 'string' };
    onChange({
      ...components,
      [compName]: {
        ...comp,
        properties: { ...comp.properties, [propName]: newProp },
      },
    });
  };

  const removeProperty = (compName: string, propName: string) => {
    const comp = components[compName];
    const { [propName]: _, ...rest } = comp.properties;
    onChange({ ...components, [compName]: { ...comp, properties: rest } });
  };

  const updateProperty = (compName: string, oldPropName: string, newPropName: string, propDef: PropertyDefinition) => {
    const comp = components[compName];
    if (newPropName !== oldPropName && comp.properties[newPropName]) {
      alert('Property name already exists');
      return;
    }
    const { [oldPropName]: _, ...rest } = comp.properties;
    onChange({
      ...components,
      [compName]: {
        ...comp,
        properties: { ...rest, [newPropName]: propDef },
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Component Definitions</h3>
        <button style={styles.successButton} onClick={addComponent}>+ Add Component</button>
      </div>

      {Object.entries(components).map(([name, comp]) => (
        <div key={name} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={name}
              onChange={(e) => renameComponent(name, e.target.value)}
              onBlur={(e) => { if (!e.target.value.trim()) e.target.value = name; }}
            />
            <button style={styles.dangerButton} onClick={() => removeComponent(name)}>Delete</button>
          </div>

          <div style={{ marginLeft: '16px' }}>
            {Object.entries(comp.properties).map(([propName, propDef]) => (
              <div key={propName} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  style={{ ...styles.input, width: '150px' }}
                  value={propName}
                  onChange={(e) => updateProperty(name, propName, e.target.value, propDef)}
                  placeholder="Property name"
                />
                <select
                  style={{ ...styles.select, width: '120px' }}
                  value={propDef.type}
                  onChange={(e) => updateProperty(name, propName, propName, { ...propDef, type: e.target.value as PropertyType })}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="entity">entity</option>
                </select>
                <input
                  style={{ ...styles.input, width: '100px' }}
                  value={propDef.default !== undefined ? String(propDef.default) : ''}
                  onChange={(e) => updateProperty(name, propName, propName, { ...propDef, default: e.target.value })}
                  placeholder="Default"
                />
                <button style={{ ...styles.dangerButton, padding: '6px 10px' }} onClick={() => removeProperty(name, propName)}>x</button>
              </div>
            ))}
            <button style={{ ...styles.button, fontSize: '0.85em' }} onClick={() => addProperty(name)}>+ Add Property</button>
          </div>
        </div>
      ))}

      {Object.keys(components).length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No components defined. Click "Add Component" to create one.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Zones Section
// ============================================================================
interface ZonesSectionProps {
  zones: Record<string, ZoneDefinition>;
  onChange: (zones: Record<string, ZoneDefinition>) => void;
}

function ZonesSection({ zones, onChange }: ZonesSectionProps) {
  const addZone = () => {
    const name = `zone${Object.keys(zones).length + 1}`;
    onChange({ ...zones, [name]: { visibility: 'public', ordered: true } });
  };

  const removeZone = (name: string) => {
    const { [name]: _, ...rest } = zones;
    onChange(rest);
  };

  const renameZone = (oldName: string, newName: string) => {
    if (newName === oldName || !newName.trim()) return;
    if (zones[newName]) {
      alert('Zone name already exists');
      return;
    }
    const { [oldName]: zone, ...rest } = zones;
    onChange({ ...rest, [newName]: zone });
  };

  const updateZone = (name: string, updates: Partial<ZoneDefinition>) => {
    onChange({ ...zones, [name]: { ...zones[name], ...updates } });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Zone Definitions</h3>
        <button style={styles.successButton} onClick={addZone}>+ Add Zone</button>
      </div>

      {Object.entries(zones).map(([name, zone]) => (
        <div key={name} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={name}
              onChange={(e) => renameZone(name, e.target.value)}
              onBlur={(e) => { if (!e.target.value.trim()) e.target.value = name; }}
            />
            <button style={styles.dangerButton} onClick={() => removeZone(name)}>Delete</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={styles.label}>Visibility</label>
              <select
                style={styles.select}
                value={zone.visibility || 'public'}
                onChange={(e) => updateZone(name, { visibility: e.target.value as 'public' | 'private' | 'owner-only' })}
              >
                <option value="public">Public (all can see)</option>
                <option value="owner-only">Owner Only</option>
                <option value="private">Private (hidden)</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Ordered</label>
              <select
                style={styles.select}
                value={zone.ordered ? 'true' : 'false'}
                onChange={(e) => updateZone(name, { ordered: e.target.value === 'true' })}
              >
                <option value="true">Yes (maintains order)</option>
                <option value="false">No (unordered)</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      {Object.keys(zones).length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No zones defined. Common zones: deck, hand, board, discard
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Templates Section
// ============================================================================
interface TemplatesSectionProps {
  templates: Record<string, EntityTemplateDefinition>;
  components: Record<string, ComponentDefinition>;
  onChange: (templates: Record<string, EntityTemplateDefinition>) => void;
}

function TemplatesSection({ templates, components, onChange }: TemplatesSectionProps) {
  const addTemplate = () => {
    const name = `Template${Object.keys(templates).length + 1}`;
    onChange({ ...templates, [name]: { components: {} } });
  };

  const removeTemplate = (name: string) => {
    const { [name]: _, ...rest } = templates;
    onChange(rest);
  };

  const renameTemplate = (oldName: string, newName: string) => {
    if (newName === oldName || !newName.trim()) return;
    if (templates[newName]) {
      alert('Template name already exists');
      return;
    }
    const { [oldName]: template, ...rest } = templates;
    onChange({ ...rest, [newName]: template });
  };

  const addComponentToTemplate = (templateName: string, componentName: string) => {
    const template = templates[templateName];
    if (template.components[componentName]) return;

    // Create default values for component properties
    const comp = components[componentName];
    const defaultValues: Record<string, unknown> = {};
    if (comp) {
      for (const [propName, propDef] of Object.entries(comp.properties)) {
        defaultValues[propName] = propDef.default ?? (propDef.type === 'number' ? 0 : propDef.type === 'boolean' ? false : '');
      }
    }

    onChange({
      ...templates,
      [templateName]: {
        ...template,
        components: { ...template.components, [componentName]: defaultValues },
      },
    });
  };

  const removeComponentFromTemplate = (templateName: string, componentName: string) => {
    const template = templates[templateName];
    const { [componentName]: _, ...rest } = template.components;
    onChange({ ...templates, [templateName]: { ...template, components: rest } });
  };

  const updateComponentValue = (templateName: string, componentName: string, propName: string, value: string) => {
    const template = templates[templateName];
    const compData = template.components[componentName] || {};
    onChange({
      ...templates,
      [templateName]: {
        ...template,
        components: {
          ...template.components,
          [componentName]: { ...compData, [propName]: value },
        },
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Entity Templates</h3>
        <button style={styles.successButton} onClick={addTemplate}>+ Add Template</button>
      </div>

      {Object.entries(templates).map(([name, template]) => (
        <div key={name} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={name}
              onChange={(e) => renameTemplate(name, e.target.value)}
              onBlur={(e) => { if (!e.target.value.trim()) e.target.value = name; }}
            />
            <button style={styles.dangerButton} onClick={() => removeTemplate(name)}>Delete</button>
          </div>

          {/* Component instances */}
          {Object.entries(template.components).map(([compName, compData]) => (
            <div key={compName} style={{ background: 'white', padding: '12px', borderRadius: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#667eea' }}>{compName}</span>
                <button
                  style={{ ...styles.dangerButton, padding: '4px 8px', fontSize: '0.8em' }}
                  onClick={() => removeComponentFromTemplate(name, compName)}
                >
                  Remove
                </button>
              </div>
              {components[compName] && Object.entries(components[compName].properties).map(([propName, propDef]) => (
                <div key={propName} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                  <span style={{ width: '120px', fontSize: '0.85em', color: '#666' }}>{propName}:</span>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={String((compData as Record<string, unknown>)[propName] ?? '')}
                    onChange={(e) => updateComponentValue(name, compName, propName, e.target.value)}
                    placeholder={`${propDef.type}${propDef.default !== undefined ? ` (default: ${propDef.default})` : ''}`}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Add component dropdown */}
          {Object.keys(components).length > 0 && (
            <select
              style={{ ...styles.select, width: 'auto', marginTop: '8px' }}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addComponentToTemplate(name, e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">+ Add Component...</option>
              {Object.keys(components)
                .filter(c => !template.components[c])
                .map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      ))}

      {Object.keys(templates).length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No templates defined. Templates define entity types like Player, Card, etc.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Actions Section (Simplified for initial implementation)
// ============================================================================
interface ActionsSectionProps {
  actions: ActionDefinitionSchema[];
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  onChange: (actions: ActionDefinitionSchema[]) => void;
}

function ActionsSection({ actions, components, zones, onChange }: ActionsSectionProps) {
  const addAction = () => {
    onChange([...actions, {
      name: `Action${actions.length + 1}`,
      displayName: 'New Action',
      description: '',
      preconditions: [],
      effects: [],
      targeting: { count: 0 },
    }]);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<ActionDefinitionSchema>) => {
    onChange(actions.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Action Definitions</h3>
        <button style={styles.successButton} onClick={addAction}>+ Add Action</button>
      </div>

      {actions.map((action, index) => (
        <div key={index} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={action.name}
              onChange={(e) => updateAction(index, { name: e.target.value })}
              placeholder="ActionName"
            />
            <button style={styles.dangerButton} onClick={() => removeAction(index)}>Delete</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={styles.label}>Display Name</label>
              <input
                style={styles.input}
                value={action.displayName || ''}
                onChange={(e) => updateAction(index, { displayName: e.target.value })}
                placeholder="Human readable name"
              />
            </div>
            <div>
              <label style={styles.label}>Target Count</label>
              <input
                type="number"
                style={styles.input}
                value={typeof action.targeting?.count === 'number' ? action.targeting.count : 0}
                onChange={(e) => updateAction(index, { targeting: { ...action.targeting, count: parseInt(e.target.value) || 0 } })}
                min={0}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              style={{ ...styles.input, minHeight: '60px' }}
              value={action.description || ''}
              onChange={(e) => updateAction(index, { description: e.target.value })}
              placeholder="What this action does"
            />
          </div>

          <div style={{ fontSize: '0.85em', color: '#666', marginTop: '8px' }}>
            Preconditions: {action.preconditions?.length || 0} | Effects: {action.effects?.length || 0}
          </div>
          <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '4px' }}>
            (Edit preconditions and effects directly in JSON preview for now)
          </div>
        </div>
      ))}

      {actions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No actions defined. Actions are what players can do (DrawCard, PlayCard, etc.)
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Phases Section
// ============================================================================
interface PhasesSectionProps {
  phases: PhaseDefinitionSchema[];
  actions: ActionDefinitionSchema[];
  onChange: (phases: PhaseDefinitionSchema[]) => void;
}

function PhasesSection({ phases, actions, onChange }: PhasesSectionProps) {
  const addPhase = () => {
    onChange([...phases, {
      name: `Phase${phases.length + 1}`,
      allowedActions: [],
      autoAdvance: false,
      nextPhase: phases[0]?.name || '',
    }]);
  };

  const removePhase = (index: number) => {
    onChange(phases.filter((_, i) => i !== index));
  };

  const updatePhase = (index: number, updates: Partial<PhaseDefinitionSchema>) => {
    onChange(phases.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const toggleAction = (phaseIndex: number, actionName: string) => {
    const phase = phases[phaseIndex];
    const allowed = phase.allowedActions || [];
    const newAllowed = allowed.includes(actionName)
      ? allowed.filter(a => a !== actionName)
      : [...allowed, actionName];
    updatePhase(phaseIndex, { allowedActions: newAllowed });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Phase Definitions</h3>
        <button style={styles.successButton} onClick={addPhase}>+ Add Phase</button>
      </div>

      {phases.map((phase, index) => (
        <div key={index} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={phase.name}
              onChange={(e) => updatePhase(index, { name: e.target.value })}
              placeholder="PhaseName"
            />
            <button style={styles.dangerButton} onClick={() => removePhase(index)}>Delete</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={styles.label}>Next Phase</label>
              <select
                style={styles.select}
                value={typeof phase.nextPhase === 'string' ? phase.nextPhase : ''}
                onChange={(e) => updatePhase(index, { nextPhase: e.target.value })}
              >
                <option value="">Same phase</option>
                {phases.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Auto Advance</label>
              <select
                style={styles.select}
                value={phase.autoAdvance ? 'true' : 'false'}
                onChange={(e) => updatePhase(index, { autoAdvance: e.target.value === 'true' })}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>

          <div>
            <label style={styles.label}>Allowed Actions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {actions.map((action) => (
                <button
                  key={action.name}
                  style={{
                    padding: '6px 12px',
                    background: phase.allowedActions?.includes(action.name) ? '#667eea' : '#e5e7eb',
                    color: phase.allowedActions?.includes(action.name) ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                  }}
                  onClick={() => toggleAction(index, action.name)}
                >
                  {action.name}
                </button>
              ))}
              {actions.length === 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>No actions defined yet</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {phases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No phases defined. Phases control game flow (Setup, Main, Combat, End, etc.)
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Setup Section
// ============================================================================
interface SetupSectionProps {
  setup: SetupDefinitionSchema;
  templates: Record<string, EntityTemplateDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: PhaseDefinitionSchema[];
  onChange: (setup: SetupDefinitionSchema) => void;
}

function SetupSection({ setup, templates, zones, phases, onChange }: SetupSectionProps) {
  const updateSetup = (updates: Partial<SetupDefinitionSchema>) => {
    onChange({ ...setup, ...updates });
  };

  const updatePerPlayer = (updates: Partial<SetupDefinitionSchema['perPlayer']>) => {
    onChange({ ...setup, perPlayer: { ...setup.perPlayer, ...updates } });
  };

  const toggleZone = (zoneName: string) => {
    const currentZones = setup.perPlayer.zones || [];
    const newZones = currentZones.includes(zoneName)
      ? currentZones.filter(z => z !== zoneName)
      : [...currentZones, zoneName];
    updatePerPlayer({ zones: newZones });
  };

  const addStartingEntity = () => {
    const entities = setup.perPlayer.startingEntities || [];
    updatePerPlayer({
      startingEntities: [...entities, { template: Object.keys(templates)[0] || '', zone: Object.keys(zones)[0] || '', count: 1 }],
    });
  };

  const removeStartingEntity = (index: number) => {
    const entities = setup.perPlayer.startingEntities || [];
    updatePerPlayer({ startingEntities: entities.filter((_, i) => i !== index) });
  };

  const updateStartingEntity = (index: number, updates: Partial<{ template: string; zone: string; count: number }>) => {
    const entities = setup.perPlayer.startingEntities || [];
    updatePerPlayer({
      startingEntities: entities.map((e, i) => i === index ? { ...e, ...updates } : e),
    });
  };

  return (
    <div>
      <h3 style={styles.sectionTitle}>Game Setup</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Min Players</label>
          <input
            type="number"
            style={styles.input}
            value={setup.playerCount.min}
            onChange={(e) => updateSetup({ playerCount: { ...setup.playerCount, min: parseInt(e.target.value) || 2 } })}
            min={1}
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Max Players</label>
          <input
            type="number"
            style={styles.input}
            value={setup.playerCount.max}
            onChange={(e) => updateSetup({ playerCount: { ...setup.playerCount, max: parseInt(e.target.value) || 2 } })}
            min={1}
          />
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Initial Phase</label>
        <select
          style={styles.select}
          value={setup.initialPhase}
          onChange={(e) => updateSetup({ initialPhase: e.target.value })}
        >
          <option value="">Select phase...</option>
          {phases.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Player Template</label>
        <select
          style={styles.select}
          value={setup.perPlayer.template}
          onChange={(e) => updatePerPlayer({ template: e.target.value })}
        >
          <option value="">Select template...</option>
          {Object.keys(templates).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Player Zones</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {Object.keys(zones).map((zoneName) => (
            <button
              key={zoneName}
              style={{
                padding: '6px 12px',
                background: setup.perPlayer.zones?.includes(zoneName) ? '#667eea' : '#e5e7eb',
                color: setup.perPlayer.zones?.includes(zoneName) ? 'white' : '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85em',
              }}
              onClick={() => toggleZone(zoneName)}
            >
              {zoneName}
            </button>
          ))}
          {Object.keys(zones).length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>No zones defined yet</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={styles.label}>Starting Entities</label>
          <button style={{ ...styles.button, fontSize: '0.85em' }} onClick={addStartingEntity}>+ Add</button>
        </div>
        {(setup.perPlayer.startingEntities || []).map((entity, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <select
              style={{ ...styles.select, flex: 1 }}
              value={entity.template}
              onChange={(e) => updateStartingEntity(index, { template: e.target.value })}
            >
              <option value="">Template...</option>
              {Object.keys(templates).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              style={{ ...styles.select, width: '120px' }}
              value={entity.zone}
              onChange={(e) => updateStartingEntity(index, { zone: e.target.value })}
            >
              <option value="">Zone...</option>
              {Object.keys(zones).map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <input
              type="number"
              style={{ ...styles.input, width: '60px' }}
              value={entity.count || 1}
              onChange={(e) => updateStartingEntity(index, { count: parseInt(e.target.value) || 1 })}
              min={1}
            />
            <button style={{ ...styles.dangerButton, padding: '6px 10px' }} onClick={() => removeStartingEntity(index)}>x</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameDefinitionBuilder;
