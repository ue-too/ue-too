/**
 * EntityDisplay - Generic entity card renderer for the game preview.
 *
 * Renders entity data by iterating through component schemas defined
 * in the game definition and displaying available properties.
 */

import React from 'react';
import type { Entity, Coordinator, ComponentName } from '@ue-too/ecs';
import { createGlobalComponentName } from '@ue-too/ecs';
import type { ComponentDefinition } from '../../board-game-engine/schema/types';

export interface EntityDisplayProps {
  entityId: Entity;
  coordinator: Coordinator;
  componentSchemas: Record<string, ComponentDefinition>;
  isSelected: boolean;
  onClick: () => void;
  canSelect: boolean;
  highlight?: boolean;
}

// Get a friendly display name from a component's properties
function getEntityDisplayName(
  coordinator: Coordinator,
  entityId: Entity,
  componentSchemas: Record<string, ComponentDefinition>
): string {
  // Try common name properties in order of preference
  const nameProperties = ['name', 'cardName', 'displayName', 'title'];

  for (const [compName] of Object.entries(componentSchemas)) {
    const componentName = createGlobalComponentName(compName);
    const component = coordinator.getComponentFromEntity(componentName, entityId);
    if (component && typeof component === 'object') {
      for (const prop of nameProperties) {
        if (prop in component && typeof (component as Record<string, unknown>)[prop] === 'string') {
          return (component as Record<string, unknown>)[prop] as string;
        }
      }
    }
  }

  return `Entity ${entityId}`;
}

// Check if entity has a "tapped" or similar state
function getEntityState(
  coordinator: Coordinator,
  entityId: Entity,
  componentSchemas: Record<string, ComponentDefinition>
): { tapped?: boolean; sick?: boolean } {
  const result: { tapped?: boolean; sick?: boolean } = {};

  for (const [compName] of Object.entries(componentSchemas)) {
    const componentName = createGlobalComponentName(compName);
    const component = coordinator.getComponentFromEntity(componentName, entityId);
    if (component && typeof component === 'object') {
      const comp = component as Record<string, unknown>;
      if ('tapped' in comp) result.tapped = Boolean(comp.tapped);
      if ('summoningSickness' in comp) result.sick = Boolean(comp.summoningSickness);
    }
  }

  return result;
}

// Get key display properties for an entity
function getDisplayProperties(
  coordinator: Coordinator,
  entityId: Entity,
  componentSchemas: Record<string, ComponentDefinition>
): Array<{ label: string; value: unknown; type: string }> {
  const properties: Array<{ label: string; value: unknown; type: string }> = [];

  // Priority properties to show first
  const priorityProps = ['cost', 'mana', 'health', 'power', 'toughness', 'attack', 'defense'];

  for (const [compName, compDef] of Object.entries(componentSchemas)) {
    const componentName = createGlobalComponentName(compName);
    const component = coordinator.getComponentFromEntity(componentName, entityId);

    if (component && typeof component === 'object') {
      const comp = component as Record<string, unknown>;

      for (const [propName, propDef] of Object.entries(compDef.properties)) {
        // Skip name properties (already shown as title)
        if (['name', 'cardName', 'displayName', 'title'].includes(propName)) continue;
        // Skip state properties (shown as indicators)
        if (['tapped', 'summoningSickness', 'attacksThisTurn'].includes(propName)) continue;
        // Skip entity references
        if (propDef.type === 'entity') continue;

        if (propName in comp) {
          const value = comp[propName];
          // Only show meaningful values
          if (value !== null && value !== undefined && value !== '') {
            properties.push({
              label: propName,
              value,
              type: propDef.type,
            });
          }
        }
      }
    }
  }

  // Sort by priority
  properties.sort((a, b) => {
    const aIdx = priorityProps.indexOf(a.label.toLowerCase());
    const bIdx = priorityProps.indexOf(b.label.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  return properties;
}

// Get color for a property based on its name
function getPropertyColor(label: string): string {
  const colorMap: Record<string, string> = {
    cost: '#2196F3',
    mana: '#2196F3',
    health: '#4CAF50',
    power: '#f44336',
    attack: '#f44336',
    toughness: '#4CAF50',
    defense: '#4CAF50',
  };
  return colorMap[label.toLowerCase()] || '#666';
}

export const EntityDisplay: React.FC<EntityDisplayProps> = ({
  entityId,
  coordinator,
  componentSchemas,
  isSelected,
  onClick,
  canSelect,
  highlight = false,
}) => {
  const name = getEntityDisplayName(coordinator, entityId, componentSchemas);
  const state = getEntityState(coordinator, entityId, componentSchemas);
  const properties = getDisplayProperties(coordinator, entityId, componentSchemas);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-block',
        width: '120px',
        padding: '8px',
        margin: '4px',
        border: isSelected 
          ? '3px solid #4CAF50' 
          : highlight 
            ? '2px solid #ff9800' 
            : '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: highlight 
          ? '#fff3cd' 
          : state.tapped 
            ? '#f5f5f5' 
            : 'white',
        cursor: canSelect ? 'pointer' : 'default',
        opacity: state.sick ? 0.7 : 1,
        transform: state.tapped ? 'rotate(5deg)' : 'none',
        transition: 'all 0.2s ease',
        boxShadow: isSelected 
          ? '0 2px 8px rgba(76, 175, 80, 0.3)' 
          : highlight 
            ? '0 2px 8px rgba(255, 152, 0, 0.4)' 
            : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Entity Name */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: '12px',
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </div>

      {/* State Indicators */}
      {(state.tapped || state.sick) && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {state.tapped && (
            <span
              style={{
                fontSize: '9px',
                padding: '1px 4px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                borderRadius: '3px',
              }}
            >
              Tapped
            </span>
          )}
          {state.sick && (
            <span
              style={{
                fontSize: '9px',
                padding: '1px 4px',
                backgroundColor: '#ff9800',
                color: 'white',
                borderRadius: '3px',
              }}
            >
              Sick
            </span>
          )}
        </div>
      )}

      {/* Properties */}
      <div style={{ fontSize: '10px' }}>
        {properties.slice(0, 4).map((prop, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>{prop.label}:</span>
            <span style={{ color: getPropertyColor(prop.label), fontWeight: 500 }}>
              {String(prop.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntityDisplay;
