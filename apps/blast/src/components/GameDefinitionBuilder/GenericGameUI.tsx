/**
 * GenericGameUI - Game-agnostic UI renderer for the live preview.
 *
 * Dynamically renders game state based on what's in the ECS coordinator,
 * using the game definition schema to understand component structure.
 */

import React, { useState, useMemo } from 'react';
import type { Entity, Coordinator } from '@ue-too/ecs';
import { createGlobalComponentName } from '@ue-too/ecs';
import type { GameEngine } from '../../board-game-engine/game-engine';
import { ZONE_COMPONENT, DECK_COMPONENT, PLAYER_COMPONENT } from '../../board-game-engine/core/game-state';
import { EntityDisplay } from './EntityDisplay';
import type { BuilderGameDefinition } from './types';

export interface GenericGameUIProps {
  engine: GameEngine;
  gameDefinition: BuilderGameDefinition;
  onStateChange: () => void;
}

interface ZoneInfo {
  entity: Entity;
  name: string;
  owner: Entity | null;
  entities: Entity[];
}

interface PlayerInfo {
  entity: Entity;
  name: string;
  properties: Record<string, unknown>;
}

// Get all zones from the coordinator
function getAllZones(coordinator: Coordinator): ZoneInfo[] {
  const zones: ZoneInfo[] = [];

  for (const entity of coordinator.getAllEntities()) {
    const zoneComp = coordinator.getComponentFromEntity<{
      name: string;
      owner: Entity | null;
      visibility?: string;
    }>(ZONE_COMPONENT, entity);

    if (zoneComp) {
      const deckComp = coordinator.getComponentFromEntity<{
        cached: { entities: Entity[] };
      }>(DECK_COMPONENT, entity);

      zones.push({
        entity,
        name: zoneComp.name,
        owner: zoneComp.owner,
        entities: deckComp?.cached?.entities ?? [],
      });
    }
  }

  return zones;
}

// Get all players from the coordinator
function getAllPlayers(coordinator: Coordinator): PlayerInfo[] {
  const players: PlayerInfo[] = [];

  for (const entity of coordinator.getAllEntities()) {
    const playerComp = coordinator.getComponentFromEntity<{
      name: string;
      playerNumber?: number;
    }>(PLAYER_COMPONENT, entity);

    if (playerComp) {
      // Collect all component data for this player
      const properties: Record<string, unknown> = { ...playerComp };

      // Look for Resource component (common pattern)
      const resourceName = createGlobalComponentName('Resource');
      const resourceComp = coordinator.getComponentFromEntity(resourceName, entity);
      if (resourceComp) {
        Object.assign(properties, resourceComp);
      }

      players.push({
        entity,
        name: playerComp.name,
        properties,
      });
    }
  }

  return players.sort((a, b) => {
    const aNum = (a.properties.playerNumber as number) ?? 0;
    const bNum = (b.properties.playerNumber as number) ?? 0;
    return aNum - bNum;
  });
}

// Group zones by owner
function groupZonesByOwner(zones: ZoneInfo[]): Map<Entity | null, ZoneInfo[]> {
  const grouped = new Map<Entity | null, ZoneInfo[]>();

  for (const zone of zones) {
    const existing = grouped.get(zone.owner) ?? [];
    existing.push(zone);
    grouped.set(zone.owner, existing);
  }

  return grouped;
}

// Group actions by type
function groupActionsByType(
  actions: Array<{ type: string; targetIds: Entity[] }>
): Map<string, Array<{ type: string; targetIds: Entity[] }>> {
  const grouped = new Map<string, Array<{ type: string; targetIds: Entity[] }>>();

  for (const action of actions) {
    const existing = grouped.get(action.type) ?? [];
    existing.push(action);
    grouped.set(action.type, existing);
  }

  return grouped;
}

export const GenericGameUI: React.FC<GenericGameUIProps> = ({
  engine,
  gameDefinition,
  onStateChange,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const coordinator = engine.state.coordinator;
  // Don't memoize validActions - they need to be recalculated after every state change
  const validActions = engine.getValidActions();
  const actionsByType = groupActionsByType(validActions);

  const players = useMemo(() => getAllPlayers(coordinator), [coordinator]);
  const zones = useMemo(() => getAllZones(coordinator), [coordinator]);
  const zonesByOwner = useMemo(() => groupZonesByOwner(zones), [zones]);

  const currentPlayer = engine.getCurrentPlayer();
  const currentPhase = engine.getCurrentPhase();
  const turnNumber = engine.getTurnNumber();
  const isGameOver = engine.isGameOver();
  const winner = isGameOver ? engine.getWinner() : null;

  // Execute an action
  const executeAction = (action: { type: string; targetIds: Entity[] }) => {
    try {
      // Find the matching valid action to get the correct actorId
      const matchingAction = validActions.find(
        (a) => a.type === action.type && JSON.stringify(a.targetIds) === JSON.stringify(action.targetIds)
      );
      
      if (!matchingAction) {
        console.error('No matching valid action found:', action);
        alert(`Action ${action.type} is not currently valid`);
        return;
      }
      
      engine.performAction(matchingAction);
      setSelectedEntity(null);
      onStateChange();
    } catch (error) {
      console.error('Action failed:', error);
      alert(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Find action for selected entity
  const getActionsForEntity = (entityId: Entity) => {
    return validActions.filter((a) => a.targetIds.includes(entityId));
  };

  // Render player stats
  const renderPlayerStats = (player: PlayerInfo) => {
    const props = player.properties;
    const isActive = player.entity === currentPlayer;

    return (
      <div
        key={player.entity}
        style={{
          flex: 1,
          padding: '12px',
          backgroundColor: isActive ? '#e8f5e9' : '#f5f5f5',
          borderRadius: '8px',
          border: isActive ? '2px solid #4CAF50' : '1px solid #ddd',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>{player.name}</span>
          {isActive && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
              }}
            >
              Active
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          {typeof props.health === 'number' && (
            <span style={{ color: props.health <= 5 ? '#f44336' : '#4CAF50' }}>
              Health: {props.health}
            </span>
          )}
          {typeof props.mana === 'number' && (
            <span style={{ color: '#2196F3' }}>Mana: {props.mana}</span>
          )}
          {typeof props.maxMana === 'number' && props.maxMana !== props.mana && (
            <span style={{ color: '#999' }}>/ {props.maxMana}</span>
          )}
        </div>
      </div>
    );
  };

  // Render a zone
  const renderZone = (zone: ZoneInfo, playerName?: string) => {
    const zoneDef = gameDefinition.zones[zone.name];
    const visibility = zoneDef?.visibility ?? 'public';
    const isPrivate = visibility === 'private';
    const isShared = playerName === 'Shared';

    return (
      <div
        key={`${zone.owner}-${zone.name}`}
        style={{
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isShared ? '#e65100' : '#666',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {playerName && !isShared && <span>{playerName}'s</span>}
          <span>{zone.name}</span>
          <span style={{ color: '#999', fontWeight: 400 }}>({zone.entities.length})</span>
        </div>
        <div
          style={{
            minHeight: '60px',
            padding: '8px',
            backgroundColor: isShared ? '#fff8e1' : '#f8f9fa',
            borderRadius: '6px',
            border: isShared ? '1px solid #ffe0b2' : '1px solid #e0e0e0',
          }}
        >
          {isPrivate ? (
            <span style={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>
              {zone.entities.length} hidden cards
            </span>
          ) : zone.entities.length === 0 ? (
            <span style={{ color: '#999', fontSize: '12px' }}>Empty</span>
          ) : (
            zone.entities.map((entityId) => (
              <EntityDisplay
                key={entityId}
                entityId={entityId}
                coordinator={coordinator}
                componentSchemas={gameDefinition.components}
                isSelected={selectedEntity === entityId}
                onClick={() => setSelectedEntity(selectedEntity === entityId ? null : entityId)}
                canSelect={getActionsForEntity(entityId).length > 0}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Game Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          backgroundColor: isGameOver ? '#ffebee' : '#e3f2fd',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px' }}>
          <span>
            <strong>Turn:</strong> {turnNumber}
          </span>
          <span>
            <strong>Phase:</strong> {currentPhase}
          </span>
        </div>
        {isGameOver && (
          <span style={{ color: '#f44336', fontWeight: 'bold' }}>
            Game Over! {winner ? `Winner: Player ${winner}` : 'Draw'}
          </span>
        )}
      </div>

      {/* Player Stats */}
      <div style={{ display: 'flex', gap: '12px' }}>{players.map(renderPlayerStats)}</div>

      {/* Zones by Player */}
      {players.map((player) => {
        const playerZones = zonesByOwner.get(player.entity) ?? [];
        if (playerZones.length === 0) return null;

        return (
          <div key={player.entity}>
            {playerZones.map((zone) => renderZone(zone, player.name))}
          </div>
        );
      })}

      {/* Shared Zones (no owner) */}
      {(zonesByOwner.get(null) ?? []).length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff3e0',
            borderRadius: '8px',
            border: '1px solid #ffcc80',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e65100' }}>
              Shared Zones
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: '#ff9800',
                color: 'white',
                borderRadius: '4px',
              }}
            >
              All Players
            </span>
          </div>
          {(zonesByOwner.get(null) ?? []).map((zone) => renderZone(zone, 'Shared'))}
        </div>
      )}

      {/* Actions Panel */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Actions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from(actionsByType.entries()).map(([actionType, actions]) => {
            // For actions with no targets or single target type, show one button
            const hasTarget = actions.some((a) => a.targetIds.length > 0);
            const canExecute =
              !hasTarget || (selectedEntity && actions.some((a) => a.targetIds.includes(selectedEntity)));

            // Find specific action for selected entity
            const targetedAction = selectedEntity
              ? actions.find((a) => a.targetIds.includes(selectedEntity))
              : actions.find((a) => a.targetIds.length === 0);

            return (
              <button
                key={actionType}
                onClick={() => {
                  if (targetedAction) {
                    executeAction(targetedAction);
                  } else if (!hasTarget && actions.length > 0) {
                    executeAction(actions[0]);
                  }
                }}
                disabled={isGameOver || !canExecute}
                style={{
                  padding: '8px 16px',
                  backgroundColor:
                    isGameOver || !canExecute
                      ? '#ccc'
                      : actionType.toLowerCase().includes('attack')
                        ? '#f44336'
                        : actionType.toLowerCase().includes('end')
                          ? '#ff9800'
                          : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isGameOver || !canExecute ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {actionType}
                {hasTarget && selectedEntity && canExecute && ' (on selected)'}
              </button>
            );
          })}
        </div>
        {selectedEntity && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            Selected entity: {selectedEntity}
          </div>
        )}
      </div>

      {/* Debug Panel */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          color: '#e2e8f0',
        }}
      >
        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
          }}
        >
          {showDebug ? '▼' : '▶'} Debug Info
        </button>
        {showDebug && (
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            <div>Valid actions: {validActions.length}</div>
            <div>Total entities: {coordinator.getAllEntities().length}</div>
            <div>Zones: {zones.length}</div>
            <div>Players: {players.length}</div>
            <div style={{ marginTop: '8px' }}>
              <strong>Actions:</strong>
              <pre style={{ margin: '4px 0', maxHeight: '200px', overflow: 'auto' }}>
                {JSON.stringify(validActions, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenericGameUI;
