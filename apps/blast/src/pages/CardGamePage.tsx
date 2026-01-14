/**
 * Card Game Page - Test UI for the board game engine.
 */

import React, { useState, useEffect } from 'react';
import { createSimpleCardGame } from '../games/simple-card-game';
import type { GameEngine } from '../board-game-engine/game-engine';
import { RESOURCE_COMPONENT, PLAYER_COMPONENT } from '../games/simple-card-game/components';
import type { ResourceComponent, PlayerComponent } from '../games/simple-card-game/components';

export function CardGamePage() {
  const [engine] = useState<GameEngine>(() => createSimpleCardGame());
  const [, forceUpdate] = useState(0);

  const refresh = () => forceUpdate((n) => n + 1);

  // Get current player info
  const getCurrentPlayerInfo = () => {
    const playerId = engine.getCurrentPlayer();
    if (!playerId) return null;

    const playerComp = engine.state.coordinator.getComponentFromEntity<PlayerComponent>(
      PLAYER_COMPONENT,
      playerId
    );
    const resourceComp = engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
      RESOURCE_COMPONENT,
      playerId
    );

    return { playerId, playerComp, resourceComp };
  };

  // Get all players info
  const getAllPlayersInfo = () => {
    const players = engine.state.getAllPlayers();
    return players.map((playerId) => {
      const playerComp = engine.state.coordinator.getComponentFromEntity<PlayerComponent>(
        PLAYER_COMPONENT,
        playerId
      );
      const resourceComp = engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
        RESOURCE_COMPONENT,
        playerId
      );
      return { playerId, playerComp, resourceComp };
    });
  };

  const handleEndTurn = () => {
    const actions = engine.getValidActions();
    const endTurnAction = actions.find((a) => a.type === 'EndTurn');
    if (endTurnAction) {
      engine.performAction(endTurnAction);
      refresh();
    }
  };

  const currentPlayer = getCurrentPlayerInfo();
  const allPlayers = getAllPlayersInfo();
  const isGameOver = engine.isGameOver();
  const winner = engine.getWinner();

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Board Game Engine Demo</h1>
      <p style={{ color: '#666' }}>Simple Card Game - MVP Test</p>

      <div style={{ marginTop: '20px' }}>
        <h2>Game Status</h2>
        <p>
          <strong>Turn:</strong> {engine.getTurnNumber()}
        </p>
        <p>
          <strong>Phase:</strong> {engine.getCurrentPhase()}
        </p>
        {currentPlayer && (
          <p>
            <strong>Active Player:</strong> {currentPlayer.playerComp?.name} (Entity:{' '}
            {currentPlayer.playerId})
          </p>
        )}
        {isGameOver && (
          <p style={{ color: 'red', fontWeight: 'bold' }}>
            Game Over! {winner && `Winner: Player ${winner}`}
          </p>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>Players</h2>
        {allPlayers.map(({ playerId, playerComp, resourceComp }) => (
          <div
            key={playerId}
            style={{
              padding: '15px',
              margin: '10px 0',
              border: playerId === currentPlayer?.playerId ? '2px solid #4CAF50' : '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: playerId === currentPlayer?.playerId ? '#f0f8f0' : '#fff',
            }}
          >
            <h3>{playerComp?.name}</h3>
            <p>
              <strong>Health:</strong> {resourceComp?.health}/{resourceComp?.maxHealth}
            </p>
            <p>
              <strong>Mana:</strong> {resourceComp?.mana}/{resourceComp?.maxMana}
            </p>
            {playerId === currentPlayer?.playerId && <span style={{ color: '#4CAF50' }}>● Active</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>Actions</h2>
        <button
          onClick={handleEndTurn}
          disabled={isGameOver}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: isGameOver ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isGameOver ? 'not-allowed' : 'pointer',
          }}
        >
          End Turn
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Engine Info</h3>
        <p>
          <strong>Valid Actions:</strong> {engine.getValidActions().length}
        </p>
        <p>
          <strong>Global Rules:</strong> {engine.getRuleEngine().getGlobalRuleCount()}
        </p>
        <p>
          <strong>Registered Actions:</strong> {engine.getActionSystem().getActionCount()}
        </p>
      </div>
    </div>
  );
}
