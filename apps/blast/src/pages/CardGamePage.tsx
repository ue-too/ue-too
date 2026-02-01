/**
 * Card Game Page - Interactive UI for the board game engine.
 *
 * Displays:
 * - Game status (turn, phase, active player)
 * - Player stats (health, mana)
 * - Player hands (cards)
 * - Player boards (creatures)
 * - Action buttons (Draw, Play, Attack, End Turn)
 */
import type { Entity } from '@ue-too/ecs';
import React, { useMemo, useState } from 'react';

import type { Action } from '../board-game-engine/core/types';
import type { GameEngine } from '../board-game-engine/game-engine';
import { createSimpleCardGame } from '../games/simple-card-game';
import {
    CARD_COMPONENT,
    CARD_STATE_COMPONENT,
    DECK_COMPONENT,
    LOCATION_COMPONENT,
    PLAYER_COMPONENT,
    RESOURCE_COMPONENT,
    ZONE_COMPONENT,
} from '../games/simple-card-game/components';
import type {
    CardComponent,
    CardStateComponent,
    PlayerComponent,
    ResourceComponent,
    ZoneComponent,
} from '../games/simple-card-game/components';

// ============================================================================
// Types
// ============================================================================

interface PlayerInfo {
    playerId: Entity;
    playerComp: PlayerComponent | null;
    resourceComp: ResourceComponent | null;
}

interface CardInfo {
    cardId: Entity;
    cardComp: CardComponent;
    cardState: CardStateComponent | null;
    owner: Entity;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPlayerZone(
    engine: GameEngine,
    playerId: Entity,
    zoneName: string
): Entity | null {
    const allEntities = engine.state.coordinator.getAllEntities();
    for (const entity of allEntities) {
        const zoneComp =
            engine.state.coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                entity
            );
        if (
            zoneComp &&
            zoneComp.name === zoneName &&
            zoneComp.owner === playerId
        ) {
            return entity;
        }
    }
    return null;
}

function getCardsInZone(engine: GameEngine, zoneEntity: Entity): CardInfo[] {
    const deckComp = engine.state.coordinator.getComponentFromEntity<{
        cached: { entities: Entity[] };
    }>(DECK_COMPONENT, zoneEntity);
    if (!deckComp) return [];

    const cards: CardInfo[] = [];
    for (const cardId of deckComp.cached.entities) {
        const cardComp =
            engine.state.coordinator.getComponentFromEntity<CardComponent>(
                CARD_COMPONENT,
                cardId
            );
        if (!cardComp) continue;

        const cardState =
            engine.state.coordinator.getComponentFromEntity<CardStateComponent>(
                CARD_STATE_COMPONENT,
                cardId
            );
        const zoneComp =
            engine.state.coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                zoneEntity
            );

        cards.push({
            cardId,
            cardComp,
            cardState,
            owner: zoneComp?.owner ?? 0,
        });
    }

    return cards;
}

// ============================================================================
// Card Component
// ============================================================================

interface CardDisplayProps {
    card: CardInfo;
    isSelected: boolean;
    onClick: () => void;
    canSelect: boolean;
    showCost?: boolean;
}

function CardDisplay({
    card,
    isSelected,
    onClick,
    canSelect,
    showCost = true,
}: CardDisplayProps) {
    const { cardComp, cardState } = card;

    const cardStyle: React.CSSProperties = {
        display: 'inline-block',
        width: '120px',
        padding: '10px',
        margin: '5px',
        border: isSelected ? '3px solid #4CAF50' : '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: cardState?.tapped ? '#e0e0e0' : '#fff',
        cursor: canSelect ? 'pointer' : 'default',
        opacity: cardState?.summoningSickness ? 0.7 : 1,
        transform: cardState?.tapped ? 'rotate(5deg)' : 'none',
        transition: 'all 0.2s ease',
    };

    return (
        <div style={cardStyle} onClick={canSelect ? onClick : undefined}>
            <div
                style={{
                    fontWeight: 'bold',
                    fontSize: '12px',
                    marginBottom: '5px',
                }}
            >
                {cardComp.name}
            </div>
            {showCost && (
                <div style={{ fontSize: '10px', color: '#666' }}>
                    Cost:{' '}
                    <span style={{ color: '#2196F3', fontWeight: 'bold' }}>
                        {cardComp.cost}
                    </span>
                </div>
            )}
            {cardComp.cardType === 'Creature' && (
                <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    <span style={{ color: '#f44336' }}>⚔ {cardComp.power}</span>
                    {' / '}
                    <span style={{ color: '#4CAF50' }}>
                        🛡 {cardComp.toughness}
                    </span>
                </div>
            )}
            {cardState?.tapped && (
                <div style={{ fontSize: '10px', color: '#999' }}>Tapped</div>
            )}
            {cardState?.summoningSickness && (
                <div style={{ fontSize: '10px', color: '#ff9800' }}>Sick</div>
            )}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function CardGamePage() {
    const [engine] = useState<GameEngine>(() => createSimpleCardGame());
    const [renderCount, forceUpdate] = useState(0);
    const [selectedCard, setSelectedCard] = useState<Entity | null>(null);
    const [attackTarget, setAttackTarget] = useState<Entity | null>(null);
    const [actionMode, setActionMode] = useState<
        'normal' | 'attackCreature' | 'attackPlayer'
    >('normal');

    const refresh = () => {
        setSelectedCard(null);
        setAttackTarget(null);
        setActionMode('normal');
        forceUpdate(n => n + 1);
    };

    // Get current player info
    const getCurrentPlayerInfo = (): PlayerInfo | null => {
        const playerId = engine.getCurrentPlayer();
        if (!playerId) return null;

        const playerComp =
            engine.state.coordinator.getComponentFromEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                playerId
            );
        const resourceComp =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                playerId
            );

        return { playerId, playerComp, resourceComp };
    };

    // Get all players info
    const getAllPlayersInfo = (): PlayerInfo[] => {
        const players = engine.state.getAllPlayers();
        return players.map(playerId => {
            const playerComp =
                engine.state.coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    playerId
                );
            const resourceComp =
                engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    playerId
                );
            return { playerId, playerComp, resourceComp };
        });
    };

    // Get valid actions of a specific type
    const getActionsOfType = (type: string): Action[] => {
        return engine.getValidActions().filter(a => a.type === type);
    };

    // Execute an action by type
    const executeAction = (type: string, targetIds: Entity[] = []) => {
        const actions = engine.getValidActions();
        const action = actions.find(
            a =>
                a.type === type &&
                JSON.stringify(a.targetIds) === JSON.stringify(targetIds)
        );
        if (action) {
            engine.performAction(action);
            refresh();
        }
    };

    // Handle card click based on mode
    const handleCardClick = (card: CardInfo, zone: string, owner: Entity) => {
        const currentPlayer = getCurrentPlayerInfo();
        if (!currentPlayer) return;

        if (actionMode === 'attackCreature') {
            if (owner !== currentPlayer.playerId && zone === 'board') {
                // Selecting enemy creature as attack target
                if (selectedCard !== null) {
                    executeAction('AttackCreature', [
                        selectedCard,
                        card.cardId,
                    ]);
                }
            }
        } else if (actionMode === 'attackPlayer') {
            // In attackPlayer mode, we don't select cards from opponent's board
        } else {
            // Normal mode
            if (owner === currentPlayer.playerId) {
                if (zone === 'hand') {
                    // Select/deselect card for playing
                    setSelectedCard(
                        selectedCard === card.cardId ? null : card.cardId
                    );
                } else if (zone === 'board') {
                    // Select creature for attacking
                    setSelectedCard(
                        selectedCard === card.cardId ? null : card.cardId
                    );
                }
            }
        }
    };

    // Handle actions
    const handleDrawCard = () => executeAction('DrawCard');

    const handlePlayCard = () => {
        if (selectedCard !== null) {
            executeAction('PlayCard', [selectedCard]);
        }
    };

    const handleAttackCreature = () => {
        if (selectedCard !== null) {
            setActionMode('attackCreature');
        }
    };

    const handleAttackPlayer = (opponentId: Entity) => {
        if (selectedCard !== null) {
            executeAction('AttackPlayer', [selectedCard, opponentId]);
        }
    };

    const handleEndTurn = () => executeAction('EndTurn');

    const handleCancelAction = () => {
        setSelectedCard(null);
        setAttackTarget(null);
        setActionMode('normal');
    };

    // Calculate available actions
    const validActions = useMemo(
        () => engine.getValidActions(),
        [engine, renderCount]
    );
    const canDraw = validActions.some(a => a.type === 'DrawCard');
    const canPlaySelected =
        selectedCard !== null &&
        validActions.some(
            a => a.type === 'PlayCard' && a.targetIds[0] === selectedCard
        );
    const canAttackWithSelected =
        selectedCard !== null &&
        validActions.some(
            a =>
                (a.type === 'AttackCreature' || a.type === 'AttackPlayer') &&
                a.targetIds[0] === selectedCard
        );
    const canEndTurn = validActions.some(a => a.type === 'EndTurn');

    const currentPlayer = getCurrentPlayerInfo();
    const allPlayers = getAllPlayersInfo();
    const isGameOver = engine.isGameOver();
    const winner = engine.getWinner();

    return (
        <div
            style={{
                padding: '20px',
                fontFamily: 'system-ui, sans-serif',
                maxWidth: '1200px',
                margin: '0 auto',
            }}
        >
            <h1>Board Game Engine - Card Game Demo</h1>

            {/* Game Status */}
            <div
                style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '8px',
                }}
            >
                <h2 style={{ margin: '0 0 10px 0' }}>Game Status</h2>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <span>
                        <strong>Turn:</strong> {engine.getTurnNumber()}
                    </span>
                    <span>
                        <strong>Phase:</strong> {engine.getCurrentPhase()}
                    </span>
                    {currentPlayer && (
                        <span>
                            <strong>Active:</strong>{' '}
                            {currentPlayer.playerComp?.name}
                        </span>
                    )}
                    {isGameOver && (
                        <span style={{ color: 'red', fontWeight: 'bold' }}>
                            Game Over! {winner && `Winner: Player ${winner}`}
                        </span>
                    )}
                </div>
            </div>

            {/* Action Mode Banner */}
            {actionMode !== 'normal' && (
                <div
                    style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>
                        {actionMode === 'attackCreature' &&
                            'Select an enemy creature to attack'}
                        {actionMode === 'attackPlayer' &&
                            'Click "Attack Player" button next to opponent'}
                    </span>
                    <button
                        onClick={handleCancelAction}
                        style={{ padding: '5px 10px' }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Players Section */}
            <div style={{ marginTop: '20px' }}>
                {allPlayers.map(({ playerId, playerComp, resourceComp }) => {
                    const isCurrentPlayer =
                        playerId === currentPlayer?.playerId;
                    const handZone = getPlayerZone(engine, playerId, 'hand');
                    const boardZone = getPlayerZone(engine, playerId, 'board');
                    const deckZone = getPlayerZone(engine, playerId, 'deck');

                    const handCards = handZone
                        ? getCardsInZone(engine, handZone)
                        : [];
                    const boardCards = boardZone
                        ? getCardsInZone(engine, boardZone)
                        : [];
                    const deckSize = deckZone
                        ? (engine.state.coordinator.getComponentFromEntity<{
                              cached: { entities: Entity[] };
                          }>(DECK_COMPONENT, deckZone)?.cached.entities
                              .length ?? 0)
                        : 0;

                    return (
                        <div
                            key={playerId}
                            style={{
                                padding: '15px',
                                margin: '10px 0',
                                border: isCurrentPlayer
                                    ? '3px solid #4CAF50'
                                    : '1px solid #ddd',
                                borderRadius: '8px',
                                backgroundColor: isCurrentPlayer
                                    ? '#f0f8f0'
                                    : '#fff',
                            }}
                        >
                            {/* Player Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <h3 style={{ margin: 0 }}>
                                    {playerComp?.name}
                                    {isCurrentPlayer && (
                                        <span
                                            style={{
                                                color: '#4CAF50',
                                                marginLeft: '10px',
                                            }}
                                        >
                                            ● Active
                                        </span>
                                    )}
                                </h3>
                                {!isCurrentPlayer &&
                                    isCurrentPlayer === false &&
                                    canAttackWithSelected && (
                                        <button
                                            onClick={() =>
                                                handleAttackPlayer(playerId)
                                            }
                                            style={{
                                                padding: '5px 10px',
                                                backgroundColor: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Attack Player
                                        </button>
                                    )}
                            </div>

                            {/* Player Stats */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '20px',
                                    marginTop: '10px',
                                }}
                            >
                                <div>
                                    <strong>Health:</strong>{' '}
                                    <span
                                        style={{
                                            color:
                                                resourceComp &&
                                                resourceComp.health <= 5
                                                    ? '#f44336'
                                                    : '#4CAF50',
                                        }}
                                    >
                                        {resourceComp?.health}/
                                        {resourceComp?.maxHealth}
                                    </span>
                                </div>
                                <div>
                                    <strong>Mana:</strong>{' '}
                                    <span style={{ color: '#2196F3' }}>
                                        {resourceComp?.mana}/
                                        {resourceComp?.maxMana}
                                    </span>
                                </div>
                                <div>
                                    <strong>Deck:</strong> {deckSize} cards
                                </div>
                            </div>

                            {/* Board */}
                            <div style={{ marginTop: '15px' }}>
                                <strong>
                                    Board ({boardCards.length} creatures):
                                </strong>
                                <div
                                    style={{
                                        minHeight: '80px',
                                        padding: '10px',
                                        backgroundColor: '#e8f5e9',
                                        borderRadius: '4px',
                                    }}
                                >
                                    {boardCards.length === 0 ? (
                                        <span style={{ color: '#999' }}>
                                            No creatures on board
                                        </span>
                                    ) : (
                                        boardCards.map(card => (
                                            <CardDisplay
                                                key={card.cardId}
                                                card={card}
                                                isSelected={
                                                    selectedCard === card.cardId
                                                }
                                                onClick={() =>
                                                    handleCardClick(
                                                        card,
                                                        'board',
                                                        playerId
                                                    )
                                                }
                                                canSelect={
                                                    isCurrentPlayer ||
                                                    actionMode ===
                                                        'attackCreature'
                                                }
                                                showCost={false}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Hand (only show for current player) */}
                            {isCurrentPlayer && (
                                <div style={{ marginTop: '15px' }}>
                                    <strong>
                                        Hand ({handCards.length} cards):
                                    </strong>
                                    <div
                                        style={{
                                            minHeight: '80px',
                                            padding: '10px',
                                            backgroundColor: '#e3f2fd',
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {handCards.length === 0 ? (
                                            <span style={{ color: '#999' }}>
                                                No cards in hand
                                            </span>
                                        ) : (
                                            handCards.map(card => (
                                                <CardDisplay
                                                    key={card.cardId}
                                                    card={card}
                                                    isSelected={
                                                        selectedCard ===
                                                        card.cardId
                                                    }
                                                    onClick={() =>
                                                        handleCardClick(
                                                            card,
                                                            'hand',
                                                            playerId
                                                        )
                                                    }
                                                    canSelect={true}
                                                    showCost={true}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div
                style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                }}
            >
                <h3 style={{ margin: '0 0 10px 0' }}>Actions</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleDrawCard}
                        disabled={!canDraw || isGameOver}
                        style={{
                            padding: '10px 20px',
                            backgroundColor:
                                canDraw && !isGameOver ? '#2196F3' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor:
                                canDraw && !isGameOver
                                    ? 'pointer'
                                    : 'not-allowed',
                        }}
                    >
                        Draw Card
                    </button>

                    <button
                        onClick={handlePlayCard}
                        disabled={!canPlaySelected || isGameOver}
                        style={{
                            padding: '10px 20px',
                            backgroundColor:
                                canPlaySelected && !isGameOver
                                    ? '#4CAF50'
                                    : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor:
                                canPlaySelected && !isGameOver
                                    ? 'pointer'
                                    : 'not-allowed',
                        }}
                    >
                        Play Selected
                    </button>

                    <button
                        onClick={handleAttackCreature}
                        disabled={!canAttackWithSelected || isGameOver}
                        style={{
                            padding: '10px 20px',
                            backgroundColor:
                                canAttackWithSelected && !isGameOver
                                    ? '#f44336'
                                    : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor:
                                canAttackWithSelected && !isGameOver
                                    ? 'pointer'
                                    : 'not-allowed',
                        }}
                    >
                        Attack Creature
                    </button>

                    <button
                        onClick={handleEndTurn}
                        disabled={!canEndTurn || isGameOver}
                        style={{
                            padding: '10px 20px',
                            backgroundColor:
                                canEndTurn && !isGameOver ? '#9c27b0' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor:
                                canEndTurn && !isGameOver
                                    ? 'pointer'
                                    : 'not-allowed',
                        }}
                    >
                        End Turn
                    </button>
                </div>

                {selectedCard !== null && (
                    <div style={{ marginTop: '10px', color: '#666' }}>
                        Selected card ID: {selectedCard}
                    </div>
                )}
            </div>

            {/* Engine Info */}
            <div
                style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                }}
            >
                <h3 style={{ margin: '0 0 10px 0' }}>Engine Info</h3>
                <div
                    style={{
                        display: 'flex',
                        gap: '20px',
                        flexWrap: 'wrap',
                        fontSize: '14px',
                    }}
                >
                    <span>
                        <strong>Valid Actions:</strong> {validActions.length}
                    </span>
                    <span>
                        <strong>Global Rules:</strong>{' '}
                        {engine.getRuleEngine().getGlobalRuleCount()}
                    </span>
                    <span>
                        <strong>Registered Actions:</strong>{' '}
                        {engine.getActionSystem().getActionCount()}
                    </span>
                </div>
                <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer' }}>
                        Available Actions
                    </summary>
                    <ul
                        style={{
                            fontSize: '12px',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {validActions.map((action, idx) => (
                            <li key={idx}>
                                {action.type}
                                {action.targetIds.length > 0 &&
                                    ` (targets: ${action.targetIds.join(', ')})`}
                            </li>
                        ))}
                    </ul>
                </details>
            </div>
        </div>
    );
}
