import React, { useState, useCallback } from 'react';
import type {
  ComponentDefinition,
  ZoneDefinition,
  EntityTemplateDefinition,
  ActionDefinitionSchema,
  PhaseDefinitionSchema,
  SetupDefinitionSchema,
  RuleDefinitionSchema,
  EventPatternSchema,
  PropertyDefinition,
  PropertyType,
} from '../../board-game-engine/schema/types';

// Import example game definition directly (Vite supports JSON imports)
import simpleCardGameJson from '../../games/simple-card-game/simple-card-game.json';

// Import GamePreview for the Play tab
import { GamePreview } from './GamePreview';

// Import shared types
import type { BuilderGameDefinition, ExtendedMetadata } from './types';

// Re-export for other components that might need it
export type { BuilderGameDefinition } from './types';

// Tab sections
type Tab = 'metadata' | 'components' | 'zones' | 'templates' | 'actions' | 'phases' | 'rules' | 'setup' | 'play';

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
  const loadExample = useCallback(() => {
    // Use double assertion since JSON import type doesn't exactly match BuilderGameDefinition
    setGameDefinition(simpleCardGameJson as unknown as BuilderGameDefinition);
    setValidationErrors([]);
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
        {(['metadata', 'components', 'zones', 'templates', 'actions', 'phases', 'rules', 'setup', 'play'] as Tab[]).map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tab(activeTab === tab),
              ...(tab === 'play' ? { backgroundColor: activeTab === tab ? '#10b981' : 'transparent', color: activeTab === tab ? 'white' : '#10b981' } : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'play' ? '▶ Play' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Play Tab - Full Width */}
      {activeTab === 'play' && (
        <div style={{ ...styles.editorPanel, flex: 1, overflow: 'auto' }}>
          <GamePreview gameDefinition={gameDefinition} />
        </div>
      )}

      {/* Split Panel - For other tabs */}
      {activeTab !== 'play' && (
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
              phases={gameDefinition.phases.map(p => p.name)}
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
          {activeTab === 'rules' && (
            <RulesSection
              rules={gameDefinition.rules || []}
              components={gameDefinition.components}
              zones={gameDefinition.zones}
              phases={gameDefinition.phases.map(p => p.name)}
              actions={gameDefinition.actions}
              onChange={(rules) => updateDefinition('rules', rules)}
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
      )}
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
    onChange({ ...zones, [name]: { visibility: 'public', ordered: true, shared: false } });
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

  // Separate zones into per-player and shared
  const perPlayerZones = Object.entries(zones).filter(([_, z]) => !z.shared);
  const sharedZones = Object.entries(zones).filter(([_, z]) => z.shared);

  const renderZoneCard = (name: string, zone: ZoneDefinition) => (
    <div key={name} style={{
      ...styles.card,
      borderLeft: zone.shared ? '4px solid #10b981' : '4px solid #667eea',
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <input
          style={{ ...styles.input, flex: 1, fontWeight: 600 }}
          value={name}
          onChange={(e) => renameZone(name, e.target.value)}
          onBlur={(e) => { if (!e.target.value.trim()) e.target.value = name; }}
        />
        {zone.shared && (
          <span style={{
            fontSize: '10px',
            padding: '2px 6px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '4px',
          }}>
            Shared
          </span>
        )}
        <button style={styles.dangerButton} onClick={() => removeZone(name)}>Delete</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label style={styles.label}>Ownership</label>
          <select
            style={styles.select}
            value={zone.shared ? 'shared' : 'per-player'}
            onChange={(e) => updateZone(name, { shared: e.target.value === 'shared' })}
          >
            <option value="per-player">Per Player</option>
            <option value="shared">Shared (all players)</option>
          </select>
        </div>
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

      {zone.shared && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
          Reference: <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>$zone.shared.{name}</code>
        </div>
      )}
      {!zone.shared && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
          Reference: <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>$zone.actor.{name}</code> or <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>$zone.opponent.{name}</code>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Zone Definitions</h3>
        <button style={styles.successButton} onClick={addZone}>+ Add Zone</button>
      </div>

      {/* Per-Player Zones */}
      {perPlayerZones.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', color: '#667eea', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#667eea', borderRadius: '2px' }}></span>
            Per-Player Zones
            <span style={{ fontWeight: 'normal', color: '#999' }}>({perPlayerZones.length})</span>
          </h4>
          {perPlayerZones.map(([name, zone]) => renderZoneCard(name, zone))}
        </div>
      )}

      {/* Shared Zones */}
      {sharedZones.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></span>
            Shared Zones
            <span style={{ fontWeight: 'normal', color: '#999' }}>({sharedZones.length})</span>
          </h4>
          {sharedZones.map(([name, zone]) => renderZoneCard(name, zone))}
        </div>
      )}

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
// Condition Builder
// ============================================================================

type ConditionType = 'isPlayerTurn' | 'phaseCheck' | 'resourceCheck' | 'entityInZone' |
  'componentValueCheck' | 'ownerCheck' | 'targetCount' | 'entityExists' |
  'zoneHasEntities' | 'hasComponent' | 'and' | 'or' | 'not';

const CONDITION_TYPES: { value: ConditionType; label: string; description: string }[] = [
  { value: 'isPlayerTurn', label: 'Is Player Turn', description: 'Check if it\'s the actor\'s turn' },
  { value: 'phaseCheck', label: 'Phase Check', description: 'Check current game phase' },
  { value: 'resourceCheck', label: 'Resource Check', description: 'Check numeric resource value' },
  { value: 'entityInZone', label: 'Entity In Zone', description: 'Check if entity is in a zone' },
  { value: 'componentValueCheck', label: 'Component Value', description: 'Check component property value' },
  { value: 'ownerCheck', label: 'Owner Check', description: 'Check entity ownership' },
  { value: 'hasComponent', label: 'Has Component', description: 'Check if entity has component' },
  { value: 'zoneHasEntities', label: 'Zone Has Entities', description: 'Check zone entity count' },
  { value: 'targetCount', label: 'Target Count', description: 'Check number of targets' },
  { value: 'entityExists', label: 'Entity Exists', description: 'Check if entity exists' },
  { value: 'and', label: 'AND', description: 'All conditions must be true' },
  { value: 'or', label: 'OR', description: 'At least one condition must be true' },
  { value: 'not', label: 'NOT', description: 'Negate a condition' },
];

const ENTITY_EXPRESSIONS = ['$actor', '$target', '$target.0', '$target.1', '$activePlayer'];

/**
 * Get filtered entity expressions based on target count.
 * If targetCount is undefined, returns all expressions.
 */
function getEntityExpressions(targetCount?: number): string[] {
  if (targetCount === undefined) {
    return ENTITY_EXPRESSIONS;
  }
  
  // Always include non-target expressions
  const baseExpressions = ['$actor', '$activePlayer'];
  
  // Add target expressions based on count
  if (targetCount === 0) {
    return baseExpressions;
  }
  
  // Include $target (shorthand for $target.0) if count >= 1
  const targetExpressions = ['$target'];
  
  // Add specific target indices up to targetCount - 1
  for (let i = 0; i < targetCount; i++) {
    targetExpressions.push(`$target.${i}`);
  }
  
  return [...baseExpressions, ...targetExpressions];
}
const ZONE_EXPRESSIONS = ['$zone.actor.hand', '$zone.actor.deck', '$zone.actor.board', '$zone.actor.discard',
  '$zone.opponent.hand', '$zone.opponent.deck', '$zone.opponent.board', '$zone.opponent.discard'];
const OPERATORS: { value: string; label: string }[] = [
  { value: '>=', label: '>= (greater or equal)' },
  { value: '>', label: '> (greater than)' },
  { value: '<=', label: '<= (less or equal)' },
  { value: '<', label: '< (less than)' },
  { value: '==', label: '== (equal)' },
  { value: '!=', label: '!= (not equal)' },
];

interface ConditionBuilderProps {
  condition: ConditionDefinition | null;
  onChange: (condition: ConditionDefinition | null) => void;
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: string[];
  depth?: number;
  targetCount?: number; // Optional: number of targets for the action
}

function ConditionBuilder({ condition, onChange, components, zones, phases, depth = 0, targetCount }: ConditionBuilderProps) {
  const maxDepth = 3;

  const createDefaultCondition = (type: ConditionType): ConditionDefinition => {
    switch (type) {
      case 'isPlayerTurn':
        return { type: 'isPlayerTurn' };
      case 'phaseCheck':
        return { type: 'phaseCheck', phases: phases.length > 0 ? [phases[0]] : ['Main'] };
      case 'resourceCheck':
        return { type: 'resourceCheck', entity: '$actor', component: 'Resource', property: 'mana', operator: '>=', value: 1 };
      case 'entityInZone':
        return { type: 'entityInZone', entity: '$target', zone: '$zone.actor.hand' };
      case 'componentValueCheck':
        return { type: 'componentValueCheck', entity: '$target', component: '', property: '', value: '' };
      case 'ownerCheck':
        return { type: 'ownerCheck', entity: '$target', expectedOwner: '$actor' };
      case 'hasComponent':
        return { type: 'hasComponent', entity: '$target', component: '' };
      case 'zoneHasEntities':
        return { type: 'zoneHasEntities', zone: '$zone.actor.deck', minCount: 1 };
      case 'targetCount':
        return { type: 'targetCount', exact: 1 };
      case 'entityExists':
        return { type: 'entityExists', entity: '$target' };
      case 'and':
        return { type: 'and', conditions: [] };
      case 'or':
        return { type: 'or', conditions: [] };
      case 'not':
        return { type: 'not', condition: { type: 'isPlayerTurn' } };
      default:
        return { type: 'isPlayerTurn' };
    }
  };

  const updateCondition = (updates: Partial<ConditionDefinition>) => {
    if (!condition) return;
    onChange({ ...condition, ...updates } as ConditionDefinition);
  };

  if (!condition) {
    return (
      <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
        <select
          style={{ ...styles.select, width: 'auto' }}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onChange(createDefaultCondition(e.target.value as ConditionType));
            }
          }}
        >
          <option value="">+ Add Condition...</option>
          {CONDITION_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const conditionStyle = {
    padding: '12px',
    background: depth === 0 ? '#f0f9ff' : depth === 1 ? '#fefce8' : '#fdf2f8',
    borderRadius: '6px',
    border: '1px solid ' + (depth === 0 ? '#bae6fd' : depth === 1 ? '#fef08a' : '#fbcfe8'),
    marginBottom: '8px',
  };

  const renderConditionFields = () => {
    switch (condition.type) {
      case 'isPlayerTurn':
        return <div style={{ fontSize: '0.85em', color: '#666' }}>Checks if it's the actor's turn</div>;

      case 'phaseCheck':
        return (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Allowed Phases</label>
            <input
              style={styles.input}
              value={(condition as PhaseCheckCondition).phases?.join(', ') || ''}
              onChange={(e) => updateCondition({ phases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Main, Combat, End"
            />
            <div style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: '4px' }}>
              Available: {phases.join(', ') || 'None defined'}
            </div>
          </div>
        );

      case 'resourceCheck':
        const rc = condition as ResourceCheckCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={rc.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Component</label>
              <select style={styles.select} value={rc.component} onChange={(e) => updateCondition({ component: e.target.value })}>
                <option value="">Select...</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Property</label>
              <input style={styles.input} value={rc.property} onChange={(e) => updateCondition({ property: e.target.value })} placeholder="mana" />
            </div>
            <div>
              <label style={styles.label}>Operator</label>
              <select style={styles.select} value={rc.operator} onChange={(e) => updateCondition({ operator: e.target.value as ComparisonOperator })}>
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>Value (number or expression like $component.$target.Card.cost)</label>
              <input style={styles.input} value={String(rc.value)} onChange={(e) => {
                const num = parseFloat(e.target.value);
                updateCondition({ value: isNaN(num) ? e.target.value : num });
              }} placeholder="5 or $component.$target.Card.cost" />
            </div>
          </div>
        );

      case 'entityInZone':
        const eiz = condition as EntityInZoneCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={eiz.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Zone</label>
              <select style={styles.select} value={Array.isArray(eiz.zone) ? eiz.zone[0] : eiz.zone} onChange={(e) => updateCondition({ zone: e.target.value })}>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
        );

      case 'componentValueCheck':
        const cvc = condition as ComponentValueCheckCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={cvc.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Component</label>
              <select style={styles.select} value={cvc.component} onChange={(e) => updateCondition({ component: e.target.value })}>
                <option value="">Select...</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Property</label>
              <input style={styles.input} value={cvc.property} onChange={(e) => updateCondition({ property: e.target.value })} placeholder="cardType" />
            </div>
            <div>
              <label style={styles.label}>Expected Value</label>
              <input style={styles.input} value={String(cvc.value ?? '')} onChange={(e) => updateCondition({ value: e.target.value })} placeholder="Creature" />
            </div>
          </div>
        );

      case 'ownerCheck':
        const oc = condition as OwnerCheckCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={oc.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Expected Owner</label>
              <select style={styles.select} value={oc.expectedOwner} onChange={(e) => updateCondition({ expectedOwner: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Invert</label>
              <select style={styles.select} value={oc.invert ? 'true' : 'false'} onChange={(e) => updateCondition({ invert: e.target.value === 'true' })}>
                <option value="false">No (must match)</option>
                <option value="true">Yes (must NOT match)</option>
              </select>
            </div>
          </div>
        );

      case 'hasComponent':
        const hc = condition as HasComponentCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={hc.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Component</label>
              <select style={styles.select} value={hc.component} onChange={(e) => updateCondition({ component: e.target.value })}>
                <option value="">Select...</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        );

      case 'zoneHasEntities':
        const zhe = condition as ZoneHasEntitiesCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Zone</label>
              <select style={styles.select} value={zhe.zone} onChange={(e) => updateCondition({ zone: e.target.value })}>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Min Count</label>
              <input type="number" style={styles.input} value={zhe.minCount ?? ''} onChange={(e) => updateCondition({ minCount: parseInt(e.target.value) || undefined })} placeholder="1" />
            </div>
            <div>
              <label style={styles.label}>Max Count</label>
              <input type="number" style={styles.input} value={zhe.maxCount ?? ''} onChange={(e) => updateCondition({ maxCount: parseInt(e.target.value) || undefined })} placeholder="" />
            </div>
          </div>
        );

      case 'targetCount':
        const tc = condition as TargetCountCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Exact</label>
              <input type="number" style={styles.input} value={tc.exact ?? ''} onChange={(e) => updateCondition({ exact: parseInt(e.target.value) || undefined })} />
            </div>
            <div>
              <label style={styles.label}>Min</label>
              <input type="number" style={styles.input} value={tc.min ?? ''} onChange={(e) => updateCondition({ min: parseInt(e.target.value) || undefined })} />
            </div>
            <div>
              <label style={styles.label}>Max</label>
              <input type="number" style={styles.input} value={tc.max ?? ''} onChange={(e) => updateCondition({ max: parseInt(e.target.value) || undefined })} />
            </div>
          </div>
        );

      case 'entityExists':
        const ee = condition as EntityExistsCondition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={ee.entity} onChange={(e) => updateCondition({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Required Component (optional)</label>
              <select style={styles.select} value={ee.requiredComponent ?? ''} onChange={(e) => updateCondition({ requiredComponent: e.target.value || undefined })}>
                <option value="">Any</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        );

      case 'and':
      case 'or':
        if (depth >= maxDepth) {
          return <div style={{ color: '#ef4444', fontSize: '0.85em' }}>Max nesting depth reached</div>;
        }
        const logical = condition as AndCondition | OrCondition;
        return (
          <div>
            <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>
              {condition.type === 'and' ? 'All conditions must be true' : 'At least one condition must be true'}
            </div>
            {logical.conditions.map((cond, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <ConditionBuilder
                    condition={cond}
                    onChange={(newCond) => {
                      const newConditions = [...logical.conditions];
                      if (newCond) {
                        newConditions[i] = newCond;
                      } else {
                        newConditions.splice(i, 1);
                      }
                      updateCondition({ conditions: newConditions });
                    }}
                    components={components}
                    zones={zones}
                    phases={phases}
                    depth={depth + 1}
                    targetCount={targetCount}
                  />
                </div>
                <button
                  style={{ ...styles.dangerButton, padding: '4px 8px', fontSize: '0.8em' }}
                  onClick={() => {
                    const newConditions = logical.conditions.filter((_, idx) => idx !== i);
                    updateCondition({ conditions: newConditions });
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              style={{ ...styles.button, fontSize: '0.8em', padding: '6px 12px' }}
              onClick={() => updateCondition({ conditions: [...logical.conditions, { type: 'isPlayerTurn' }] })}
            >
              + Add Condition
            </button>
          </div>
        );

      case 'not':
        if (depth >= maxDepth) {
          return <div style={{ color: '#ef4444', fontSize: '0.85em' }}>Max nesting depth reached</div>;
        }
        const notCond = condition as NotCondition;
        return (
          <div>
            <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>Negates the following condition</div>
            <ConditionBuilder
              condition={notCond.condition}
              onChange={(newCond) => {
                if (newCond) {
                  updateCondition({ condition: newCond });
                }
              }}
              components={components}
              zones={zones}
              phases={phases}
              depth={depth + 1}
              targetCount={targetCount}
            />
          </div>
        );

      default:
        return <div style={{ color: '#9ca3af' }}>Unknown condition type</div>;
    }
  };

  return (
    <div style={conditionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <select
          style={{ ...styles.select, width: 'auto', fontWeight: 600 }}
          value={condition.type}
          onChange={(e) => onChange(createDefaultCondition(e.target.value as ConditionType))}
        >
          {CONDITION_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
        <button
          style={{ ...styles.dangerButton, padding: '4px 8px', fontSize: '0.8em' }}
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>
      {renderConditionFields()}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Error Message (optional)</label>
        <input
          style={styles.input}
          value={condition.errorMessage || ''}
          onChange={(e) => updateCondition({ errorMessage: e.target.value || undefined })}
          placeholder="Custom error message when condition fails"
        />
      </div>
    </div>
  );
}

// Import condition types for type guards
import type {
  ComparisonOperator,
  PhaseCheckCondition,
  ResourceCheckCondition,
  EntityInZoneCondition,
  ComponentValueCheckCondition,
  OwnerCheckCondition,
  HasComponentCondition,
  ZoneHasEntitiesCondition,
  TargetCountCondition,
  EntityExistsCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  ConditionDefinition,
  EffectDefinition,
  MoveEntityEffectDefinition,
  ModifyResourceEffectDefinition,
  SetComponentValueEffectDefinition,
  ShuffleZoneEffectDefinition,
  TransferMultipleEffectDefinition,
  EmitEventEffectDefinition,
  ConditionalEffectDefinition,
} from '../../board-game-engine/schema/types';

// ============================================================================
// Effect Builder
// ============================================================================

type EffectType = 'moveEntity' | 'modifyResource' | 'setComponentValue' | 'shuffleZone' |
  'transferMultiple' | 'emitEvent' | 'conditional' | 'composite';

const EFFECT_TYPES: { value: EffectType; label: string; description: string }[] = [
  { value: 'moveEntity', label: 'Move Entity', description: 'Move an entity between zones' },
  { value: 'modifyResource', label: 'Modify Resource', description: 'Add/subtract numeric resource' },
  { value: 'setComponentValue', label: 'Set Component Value', description: 'Set a component property' },
  { value: 'shuffleZone', label: 'Shuffle Zone', description: 'Shuffle entities in a zone' },
  { value: 'transferMultiple', label: 'Transfer Multiple', description: 'Move multiple entities between zones' },
  { value: 'emitEvent', label: 'Emit Event', description: 'Emit a game event' },
  { value: 'conditional', label: 'Conditional', description: 'Execute effects based on condition' },
];

interface EffectBuilderProps {
  effect: EffectDefinition | null;
  onChange: (effect: EffectDefinition | null) => void;
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: string[];
  depth?: number;
  targetCount?: number; // Optional: number of targets for the action
}

function EffectBuilder({ effect, onChange, components, zones, phases, depth = 0, targetCount }: EffectBuilderProps) {
  const maxDepth = 2;

  const createDefaultEffect = (type: EffectType): EffectDefinition => {
    switch (type) {
      case 'moveEntity':
        return { type: 'moveEntity', entity: '$target', toZone: '$zone.actor.board' };
      case 'modifyResource':
        return { type: 'modifyResource', entity: '$actor', component: 'Resource', property: 'mana', amount: -1 };
      case 'setComponentValue':
        return { type: 'setComponentValue', entity: '$target', component: '', property: '', value: '' };
      case 'shuffleZone':
        return { type: 'shuffleZone', zone: '$zone.actor.deck' };
      case 'transferMultiple':
        return { type: 'transferMultiple', fromZone: '$zone.actor.deck', toZone: '$zone.actor.hand', count: 1, selection: 'top' };
      case 'emitEvent':
        return { type: 'emitEvent', eventType: 'CustomEvent', data: {} };
      case 'conditional':
        return { type: 'conditional', condition: { type: 'isPlayerTurn' }, then: [] };
      default:
        return { type: 'emitEvent', eventType: 'CustomEvent' };
    }
  };

  const updateEffect = (updates: Partial<EffectDefinition>) => {
    if (!effect) return;
    onChange({ ...effect, ...updates } as EffectDefinition);
  };

  if (!effect) {
    return (
      <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
        <select
          style={{ ...styles.select, width: 'auto' }}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onChange(createDefaultEffect(e.target.value as EffectType));
            }
          }}
        >
          <option value="">+ Add Effect...</option>
          {EFFECT_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const effectStyle = {
    padding: '12px',
    background: depth === 0 ? '#f0fdf4' : '#fefce8',
    borderRadius: '6px',
    border: '1px solid ' + (depth === 0 ? '#bbf7d0' : '#fef08a'),
    marginBottom: '8px',
  };

  const renderEffectFields = () => {
    switch (effect.type) {
      case 'moveEntity':
        const me = effect as MoveEntityEffectDefinition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={me.entity} onChange={(e) => updateEffect({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>From Zone (optional)</label>
              <select style={styles.select} value={me.fromZone ?? ''} onChange={(e) => updateEffect({ fromZone: e.target.value || undefined })}>
                <option value="">Auto-detect</option>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>To Zone</label>
              <select style={styles.select} value={me.toZone} onChange={(e) => updateEffect({ toZone: e.target.value })}>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
        );

      case 'modifyResource':
        const mr = effect as ModifyResourceEffectDefinition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={mr.entity} onChange={(e) => updateEffect({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Component</label>
              <select style={styles.select} value={mr.component} onChange={(e) => updateEffect({ component: e.target.value })}>
                <option value="">Select...</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Property</label>
              <input style={styles.input} value={mr.property} onChange={(e) => updateEffect({ property: e.target.value })} placeholder="mana" />
            </div>
            <div>
              <label style={styles.label}>Amount (use negative for subtract)</label>
              <input style={styles.input} value={String(mr.amount)} onChange={(e) => {
                const num = parseFloat(e.target.value);
                updateEffect({ amount: isNaN(num) ? e.target.value : num });
              }} placeholder="-3 or $negate($component.$target.Card.cost)" />
            </div>
          </div>
        );

      case 'setComponentValue':
        const scv = effect as SetComponentValueEffectDefinition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Entity</label>
              <select style={styles.select} value={scv.entity} onChange={(e) => updateEffect({ entity: e.target.value })}>
                {getEntityExpressions(targetCount).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Component</label>
              <select style={styles.select} value={scv.component} onChange={(e) => updateEffect({ component: e.target.value })}>
                <option value="">Select...</option>
                {Object.keys(components).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Property</label>
              <input style={styles.input} value={scv.property ?? ''} onChange={(e) => updateEffect({ property: e.target.value })} placeholder="tapped" />
            </div>
            <div>
              <label style={styles.label}>Value</label>
              <input style={styles.input} value={String(scv.value ?? '')} onChange={(e) => {
                let val: unknown = e.target.value;
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
                else if (!isNaN(parseFloat(e.target.value))) val = parseFloat(e.target.value);
                updateEffect({ value: val });
              }} placeholder="true, false, or a value" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={scv.createIfMissing ?? false}
                  onChange={(e) => updateEffect({ createIfMissing: e.target.checked })}
                />
                Create component if missing
              </label>
            </div>
          </div>
        );

      case 'shuffleZone':
        const sz = effect as ShuffleZoneEffectDefinition;
        return (
          <div>
            <label style={styles.label}>Zone</label>
            <select style={styles.select} value={sz.zone} onChange={(e) => updateEffect({ zone: e.target.value })}>
              {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        );

      case 'transferMultiple':
        const tm = effect as TransferMultipleEffectDefinition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>From Zone</label>
              <select style={styles.select} value={tm.fromZone} onChange={(e) => updateEffect({ fromZone: e.target.value })}>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>To Zone</label>
              <select style={styles.select} value={tm.toZone} onChange={(e) => updateEffect({ toZone: e.target.value })}>
                {ZONE_EXPRESSIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Count</label>
              <input type="number" style={styles.input} value={typeof tm.count === 'number' ? tm.count : ''} onChange={(e) => updateEffect({ count: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label style={styles.label}>Selection</label>
              <select style={styles.select} value={tm.selection} onChange={(e) => updateEffect({ selection: e.target.value as 'top' | 'bottom' | 'random' })}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="random">Random</option>
              </select>
            </div>
          </div>
        );

      case 'emitEvent':
        const ee = effect as EmitEventEffectDefinition;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div>
              <label style={styles.label}>Event Type</label>
              <input style={styles.input} value={ee.eventType} onChange={(e) => updateEffect({ eventType: e.target.value })} placeholder="CardPlayed" />
            </div>
            <div>
              <label style={styles.label}>Event Data (JSON)</label>
              <textarea
                style={{ ...styles.input, minHeight: '60px', fontFamily: 'monospace' }}
                value={JSON.stringify(ee.data || {}, null, 2)}
                onChange={(e) => {
                  try {
                    updateEffect({ data: JSON.parse(e.target.value) });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"playerId": "$actor"}'
              />
            </div>
          </div>
        );

      case 'conditional':
        if (depth >= maxDepth) {
          return <div style={{ color: '#ef4444', fontSize: '0.85em' }}>Max nesting depth reached</div>;
        }
        const ce = effect as ConditionalEffectDefinition;
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>Condition</label>
              <ConditionBuilder
                condition={ce.condition}
                onChange={(cond) => cond && updateEffect({ condition: cond })}
                components={components}
                zones={zones}
                phases={phases}
                depth={depth + 1}
                targetCount={targetCount}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={styles.label}>Then (effects if condition is true)</label>
              <EffectListBuilder
                effects={ce.then}
                onChange={(effects) => updateEffect({ then: effects })}
                components={components}
                zones={zones}
                phases={phases}
                depth={depth + 1}
              />
            </div>
            <div>
              <label style={styles.label}>Else (effects if condition is false)</label>
              <EffectListBuilder
                effects={ce.else || []}
                onChange={(effects) => updateEffect({ else: effects.length > 0 ? effects : undefined })}
                components={components}
                zones={zones}
                phases={phases}
                depth={depth + 1}
              />
            </div>
          </div>
        );

      default:
        return <div style={{ color: '#9ca3af' }}>Unknown effect type: {effect.type}</div>;
    }
  };

  return (
    <div style={effectStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <select
          style={{ ...styles.select, width: 'auto', fontWeight: 600 }}
          value={effect.type}
          onChange={(e) => onChange(createDefaultEffect(e.target.value as EffectType))}
        >
          {EFFECT_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
        <button
          style={{ ...styles.dangerButton, padding: '4px 8px', fontSize: '0.8em' }}
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>
      {renderEffectFields()}
    </div>
  );
}

// Helper component for lists of effects
interface EffectListBuilderProps {
  effects: EffectDefinition[];
  onChange: (effects: EffectDefinition[]) => void;
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: string[];
  depth?: number;
  targetCount?: number; // Optional: number of targets for the action
}

function EffectListBuilder({ effects, onChange, components, zones, phases, depth = 0, targetCount }: EffectListBuilderProps) {
  return (
    <div>
      {effects.map((effect, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <EffectBuilder
              effect={effect}
              onChange={(newEffect) => {
                const newEffects = [...effects];
                if (newEffect) {
                  newEffects[i] = newEffect;
                } else {
                  newEffects.splice(i, 1);
                }
                onChange(newEffects);
              }}
              components={components}
              zones={zones}
              phases={phases}
              depth={depth}
              targetCount={targetCount}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {i > 0 && (
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '0.75em' }}
                onClick={() => {
                  const newEffects = [...effects];
                  [newEffects[i - 1], newEffects[i]] = [newEffects[i], newEffects[i - 1]];
                  onChange(newEffects);
                }}
                title="Move up"
              >
                ↑
              </button>
            )}
            {i < effects.length - 1 && (
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '0.75em' }}
                onClick={() => {
                  const newEffects = [...effects];
                  [newEffects[i], newEffects[i + 1]] = [newEffects[i + 1], newEffects[i]];
                  onChange(newEffects);
                }}
                title="Move down"
              >
                ↓
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        style={{ ...styles.button, fontSize: '0.85em' }}
        onClick={() => onChange([...effects, { type: 'emitEvent', eventType: 'CustomEvent' }])}
      >
        + Add Effect
      </button>
    </div>
  );
}

// ============================================================================
// Actions Section
// ============================================================================
interface ActionsSectionProps {
  actions: ActionDefinitionSchema[];
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: string[];
  onChange: (actions: ActionDefinitionSchema[]) => void;
}

function ActionsSection({ actions, components, zones, phases, onChange }: ActionsSectionProps) {
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

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

  const phaseNames = phases.map(p => p);

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
            <button
              style={{ ...styles.button, padding: '8px 12px' }}
              onClick={() => setExpandedAction(expandedAction === index ? null : index)}
            >
              {expandedAction === index ? 'Collapse' : 'Expand'}
            </button>
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
              style={{ ...styles.input, minHeight: '40px' }}
              value={action.description || ''}
              onChange={(e) => updateAction(index, { description: e.target.value })}
              placeholder="What this action does"
            />
          </div>

          {/* Summary when collapsed */}
          {expandedAction !== index && (
            <div style={{ fontSize: '0.85em', color: '#666', marginTop: '8px', cursor: 'pointer' }} onClick={() => setExpandedAction(index)}>
              Preconditions: {action.preconditions?.length || 0} | Effects: {action.effects?.length || 0} | Costs: {action.costs?.length || 0}
              <span style={{ color: '#667eea', marginLeft: '8px' }}>Click Expand to edit →</span>
            </div>
          )}

          {/* Expanded view with builders */}
          {expandedAction === index && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              {/* Preconditions */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Preconditions ({action.preconditions?.length || 0})
                  </label>
                  <button
                    style={{ ...styles.button, fontSize: '0.8em', padding: '4px 10px' }}
                    onClick={() => updateAction(index, {
                      preconditions: [...(action.preconditions || []), { type: 'isPlayerTurn' }]
                    })}
                  >
                    + Add
                  </button>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  Conditions that must be true for this action to be valid
                </div>
                {(action.preconditions || []).map((precond, pIndex) => (
                  <ConditionBuilder
                    key={pIndex}
                    condition={precond}
                    onChange={(newCond) => {
                      const newPreconditions = [...(action.preconditions || [])];
                      if (newCond) {
                        newPreconditions[pIndex] = newCond;
                      } else {
                        newPreconditions.splice(pIndex, 1);
                      }
                      updateAction(index, { preconditions: newPreconditions });
                    }}
                    components={components}
                    zones={zones}
                    phases={phaseNames}
                    targetCount={typeof action.targeting?.count === 'number' ? action.targeting.count : undefined}
                  />
                ))}
                {(!action.preconditions || action.preconditions.length === 0) && (
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db', color: '#9ca3af', fontSize: '0.85em' }}>
                    No preconditions. Click "+ Add" to add one.
                  </div>
                )}
              </div>

              {/* Costs */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Costs ({action.costs?.length || 0})
                  </label>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  Effects applied before the main effects (e.g., pay mana). If costs fail, action is cancelled.
                </div>
                <EffectListBuilder
                  effects={action.costs || []}
                  onChange={(costs) => updateAction(index, { costs })}
                  components={components}
                  zones={zones}
                  phases={phaseNames}
                  targetCount={typeof action.targeting?.count === 'number' ? action.targeting.count : undefined}
                />
              </div>

              {/* Effects */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Effects ({action.effects?.length || 0})
                  </label>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  What happens when the action is executed
                </div>
                <EffectListBuilder
                  effects={action.effects || []}
                  onChange={(effects) => updateAction(index, { effects })}
                  components={components}
                  zones={zones}
                  phases={phaseNames}
                  targetCount={typeof action.targeting?.count === 'number' ? action.targeting.count : undefined}
                />
              </div>
            </div>
          )}
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
// Rules Section
// ============================================================================
interface RulesSectionProps {
  rules: RuleDefinitionSchema[];
  components: Record<string, ComponentDefinition>;
  zones: Record<string, ZoneDefinition>;
  phases: string[];
  actions: ActionDefinitionSchema[];
  onChange: (rules: RuleDefinitionSchema[]) => void;
}

function RulesSection({ rules, components, zones, phases, actions, onChange }: RulesSectionProps) {
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  // Common event types for suggestions
  const commonEventTypes = [
    'TurnEnded',
    'TurnStarted',
    'CardPlayed',
    'CardDrawn',
    'ActivePlayerChanged',
    'EntityCreated',
    'EntityDestroyed',
    'EntityMoved',
    'PhaseChanged',
    'ResourceChanged',
  ];

  const addRule = () => {
    onChange([...rules, {
      id: `rule${rules.length + 1}`,
      trigger: {
        eventType: 'TurnEnded',
      },
      conditions: [],
      effects: [],
      priority: 100,
    }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<RuleDefinitionSchema>) => {
    onChange(rules.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const updateTrigger = (index: number, updates: Partial<EventPatternSchema>) => {
    const rule = rules[index];
    updateRule(index, {
      trigger: { ...rule.trigger, ...updates },
    });
  };

  const addFilter = (index: number) => {
    const rule = rules[index];
    const filters = rule.trigger.filters || {};
    const newKey = `filterKey${Object.keys(filters).length + 1}`;
    updateTrigger(index, {
      filters: { ...filters, [newKey]: '' },
    });
  };

  const updateFilter = (ruleIndex: number, filterKey: string, newKey: string, value: string) => {
    const rule = rules[ruleIndex];
    const filters = { ...(rule.trigger.filters || {}) };
    if (newKey !== filterKey) {
      delete filters[filterKey];
    }
    filters[newKey] = value;
    updateTrigger(ruleIndex, { filters });
  };

  const removeFilter = (ruleIndex: number, filterKey: string) => {
    const rule = rules[ruleIndex];
    const filters = { ...(rule.trigger.filters || {}) };
    delete filters[filterKey];
    updateTrigger(ruleIndex, { filters: Object.keys(filters).length > 0 ? filters : undefined });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.sectionTitle}>Rules</h3>
        <button style={styles.successButton} onClick={addRule}>+ Add Rule</button>
      </div>

      {rules.map((rule, index) => (
        <div key={index} style={styles.card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
              value={rule.id}
              onChange={(e) => updateRule(index, { id: e.target.value })}
              placeholder="ruleId"
            />
            <button
              style={{ ...styles.button, padding: '8px 12px' }}
              onClick={() => setExpandedRule(expandedRule === index ? null : index)}
            >
              {expandedRule === index ? 'Collapse' : 'Expand'}
            </button>
            <button style={styles.dangerButton} onClick={() => removeRule(index)}>Delete</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={styles.label}>Name (optional)</label>
              <input
                style={styles.input}
                value={rule.name || ''}
                onChange={(e) => updateRule(index, { name: e.target.value || undefined })}
                placeholder="Human readable name"
              />
            </div>
            <div>
              <label style={styles.label}>Priority</label>
              <input
                type="number"
                style={styles.input}
                value={rule.priority ?? 100}
                onChange={(e) => updateRule(index, { priority: parseInt(e.target.value) || 100 })}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description (optional)</label>
            <textarea
              style={{ ...styles.input, minHeight: '40px' }}
              value={rule.description || ''}
              onChange={(e) => updateRule(index, { description: e.target.value || undefined })}
              placeholder="What this rule does"
            />
          </div>

          {/* Summary when collapsed */}
          {expandedRule !== index && (
            <div style={{ fontSize: '0.85em', color: '#666', marginTop: '8px', cursor: 'pointer' }} onClick={() => setExpandedRule(index)}>
              Trigger: {rule.trigger.eventType} | Conditions: {rule.conditions?.length || 0} | Effects: {rule.effects?.length || 0} | Priority: {rule.priority ?? 100}
              <span style={{ color: '#667eea', marginLeft: '8px' }}>Click Expand to edit →</span>
            </div>
          )}

          {/* Expanded view */}
          {expandedRule === index && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              {/* Event Trigger */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Event Trigger
                  </label>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  The event type that triggers this rule
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Event Type</label>
                  <input
                    style={styles.input}
                    list={`event-types-${index}`}
                    value={rule.trigger.eventType}
                    onChange={(e) => updateTrigger(index, { eventType: e.target.value })}
                    placeholder="TurnEnded"
                  />
                  <datalist id={`event-types-${index}`}>
                    {commonEventTypes.map(et => (
                      <option key={et} value={et} />
                    ))}
                  </datalist>
                </div>

                {/* Event Filters */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={styles.label}>Filters (optional)</label>
                    <button
                      style={{ ...styles.button, fontSize: '0.8em', padding: '4px 10px' }}
                      onClick={() => addFilter(index)}
                    >
                      + Add Filter
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                    Additional constraints on event data (e.g., playerId, cardType)
                  </div>
                  {rule.trigger.filters && Object.entries(rule.trigger.filters).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        value={key}
                        onChange={(e) => updateFilter(index, key, e.target.value, String(value))}
                        placeholder="filterKey"
                      />
                      <span>:</span>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        value={String(value)}
                        onChange={(e) => updateFilter(index, key, key, e.target.value)}
                        placeholder="filterValue"
                      />
                      <button
                        style={{ ...styles.dangerButton, padding: '6px 10px' }}
                        onClick={() => removeFilter(index, key)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(!rule.trigger.filters || Object.keys(rule.trigger.filters).length === 0) && (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db', color: '#9ca3af', fontSize: '0.85em' }}>
                      No filters. Click "+ Add Filter" to add constraints on event data.
                    </div>
                  )}
                </div>
              </div>

              {/* Conditions */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Conditions ({rule.conditions?.length || 0})
                  </label>
                  <button
                    style={{ ...styles.button, fontSize: '0.8em', padding: '4px 10px' }}
                    onClick={() => updateRule(index, {
                      conditions: [...(rule.conditions || []), { type: 'isPlayerTurn' }]
                    })}
                  >
                    + Add
                  </button>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  Additional checks that must pass before rule effects execute
                </div>
                {(rule.conditions || []).map((condition, cIndex) => (
                  <ConditionBuilder
                    key={cIndex}
                    condition={condition}
                    onChange={(newCond) => {
                      const newConditions = [...(rule.conditions || [])];
                      if (newCond) {
                        newConditions[cIndex] = newCond;
                      } else {
                        newConditions.splice(cIndex, 1);
                      }
                      updateRule(index, { conditions: newConditions });
                    }}
                    components={components}
                    zones={zones}
                    phases={phases}
                  />
                ))}
                {(!rule.conditions || rule.conditions.length === 0) && (
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px dashed #d1d5db', color: '#9ca3af', fontSize: '0.85em' }}>
                    No conditions. Click "+ Add" to add one.
                  </div>
                )}
              </div>

              {/* Effects */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, marginBottom: 0, fontSize: '1em' }}>
                    Effects ({rule.effects?.length || 0})
                  </label>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                  What happens when this rule is triggered
                </div>
                <EffectListBuilder
                  effects={rule.effects || []}
                  onChange={(effects) => updateRule(index, { effects })}
                  components={components}
                  zones={zones}
                  phases={phases}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {rules.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          No rules defined. Rules react to events and execute effects automatically (e.g., switch player on TurnEnded).
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

  // Separate per-player zones from shared zones
  const perPlayerZones = Object.entries(zones).filter(([_, z]) => !z.shared);
  const sharedZones = Object.entries(zones).filter(([_, z]) => z.shared);

  const toggleZone = (zoneName: string) => {
    const currentZones = setup.perPlayer.zones || [];
    const newZones = currentZones.includes(zoneName)
      ? currentZones.filter(z => z !== zoneName)
      : [...currentZones, zoneName];
    updatePerPlayer({ zones: newZones });
  };

  // Per-player starting entities
  const addStartingEntity = () => {
    const entities = setup.perPlayer.startingEntities || [];
    const firstPerPlayerZone = perPlayerZones[0]?.[0] || '';
    updatePerPlayer({
      startingEntities: [...entities, { template: Object.keys(templates)[0] || '', zone: firstPerPlayerZone, count: 1 }],
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

  // Shared zone starting entities
  const addSharedZoneEntity = () => {
    const entities = setup.sharedZoneEntities || [];
    const firstSharedZone = sharedZones[0]?.[0] || '';
    updateSetup({
      sharedZoneEntities: [...entities, { template: Object.keys(templates)[0] || '', zone: firstSharedZone, count: 1 }],
    });
  };

  const removeSharedZoneEntity = (index: number) => {
    const entities = setup.sharedZoneEntities || [];
    updateSetup({ sharedZoneEntities: entities.filter((_, i) => i !== index) });
  };

  const updateSharedZoneEntity = (index: number, updates: Partial<{ template: string; zone: string; count: number }>) => {
    const entities = setup.sharedZoneEntities || [];
    updateSetup({
      sharedZoneEntities: entities.map((e, i) => i === index ? { ...e, ...updates } : e),
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

      {/* Per-Player Zones */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>
          Player Zones
          <span style={{ fontWeight: 'normal', color: '#999', marginLeft: '8px' }}>(each player gets their own)</span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {perPlayerZones.map(([zoneName]) => (
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
          {perPlayerZones.length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>No per-player zones defined</span>
          )}
        </div>
      </div>

      {/* Per-Player Starting Entities */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={styles.label}>
            Per-Player Starting Entities
            <span style={{ fontWeight: 'normal', color: '#999', marginLeft: '8px' }}>(created for each player)</span>
          </label>
          <button style={{ ...styles.button, fontSize: '0.85em' }} onClick={addStartingEntity} disabled={perPlayerZones.length === 0}>+ Add</button>
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
              {perPlayerZones.map(([z]) => <option key={z} value={z}>{z}</option>)}
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

      {/* Shared Zones Section */}
      {sharedZones.length > 0 && (
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid #10b981' }}>
          <h4 style={{ fontSize: '14px', color: '#10b981', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></span>
            Shared Zones Setup
          </h4>

          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
            Shared zones: {sharedZones.map(([name]) => (
              <span key={name} style={{ backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px', marginLeft: '4px' }}>{name}</span>
            ))}
          </div>

          {/* Shared Zone Starting Entities */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={styles.label}>
                Shared Zone Starting Entities
                <span style={{ fontWeight: 'normal', color: '#999', marginLeft: '8px' }}>(created once, shared by all)</span>
              </label>
              <button style={{ ...styles.successButton, fontSize: '0.85em' }} onClick={addSharedZoneEntity}>+ Add</button>
            </div>
            {(setup.sharedZoneEntities || []).map((entity, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <select
                  style={{ ...styles.select, flex: 1 }}
                  value={entity.template}
                  onChange={(e) => updateSharedZoneEntity(index, { template: e.target.value })}
                >
                  <option value="">Template...</option>
                  {Object.keys(templates).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  style={{ ...styles.select, width: '120px' }}
                  value={entity.zone}
                  onChange={(e) => updateSharedZoneEntity(index, { zone: e.target.value })}
                >
                  <option value="">Zone...</option>
                  {sharedZones.map(([z]) => <option key={z} value={z}>{z}</option>)}
                </select>
                <input
                  type="number"
                  style={{ ...styles.input, width: '60px' }}
                  value={entity.count || 1}
                  onChange={(e) => updateSharedZoneEntity(index, { count: parseInt(e.target.value) || 1 })}
                  min={1}
                />
                <button style={{ ...styles.dangerButton, padding: '6px 10px' }} onClick={() => removeSharedZoneEntity(index)}>x</button>
              </div>
            ))}
            {(setup.sharedZoneEntities || []).length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: '0.85em', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                No shared zone entities yet. Add entities to populate shared zones like a marketplace or common area.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GameDefinitionBuilder;
