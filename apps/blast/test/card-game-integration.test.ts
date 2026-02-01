/**
 * Integration Tests for Simple Card Game
 *
 * Tests the complete game flow using the GameEngine.
 */
import type { Entity } from '@ue-too/ecs';

import { GAME_MANAGER_COMPONENT } from '../src/board-game-engine/core/game-state';
import type {
    GameManagerComponent,
    GameStatusComponent,
} from '../src/board-game-engine/core/game-state';
import type { Action } from '../src/board-game-engine/core/types';
import type { GameEngine } from '../src/board-game-engine/game-engine';
import { createSimpleCardGame } from '../src/games/simple-card-game';
import {
    CARD_COMPONENT,
    CARD_STATE_COMPONENT,
    DECK_COMPONENT,
    GAME_STATUS_COMPONENT,
    PLAYER_COMPONENT,
    RESOURCE_COMPONENT,
    ZONE_COMPONENT,
} from '../src/games/simple-card-game/components';
import type {
    CardComponent,
    CardStateComponent,
    ResourceComponent,
    ZoneComponent,
} from '../src/games/simple-card-game/components';

// ============================================================================
// Test Helpers
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

function getCardsInZone(
    engine: GameEngine,
    playerId: Entity,
    zoneName: string
): Entity[] {
    const zone = getPlayerZone(engine, playerId, zoneName);
    if (!zone) return [];

    const deckComp = engine.state.coordinator.getComponentFromEntity<{
        cached: { entities: Entity[] };
    }>(DECK_COMPONENT, zone);
    return deckComp?.cached.entities ?? [];
}

function findActionByType(
    engine: GameEngine,
    actionType: string
): Action | undefined {
    return engine.getValidActions().find(a => a.type === actionType);
}

function findActionByTypeAndTarget(
    engine: GameEngine,
    actionType: string,
    targetId: Entity
): Action | undefined {
    return engine
        .getValidActions()
        .find(
            a =>
                a.type === actionType &&
                a.targetIds.length > 0 &&
                a.targetIds[0] === targetId
        );
}

// ============================================================================
// Game Initialization Tests
// ============================================================================

describe('Simple Card Game - Initialization', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should create a game with 2 players', () => {
        const players = engine.state.getAllPlayers();
        expect(players).toHaveLength(2);
    });

    it('should start on turn 1 in Main phase', () => {
        expect(engine.getTurnNumber()).toBe(1);
        expect(engine.getCurrentPhase()).toBe('Main');
    });

    it('should set player 1 as active player', () => {
        const currentPlayer = engine.getCurrentPlayer();
        const players = engine.state.getAllPlayers();
        expect(currentPlayer).toBe(players[0]);
    });

    it('should give each player 20 health and 1 mana', () => {
        const players = engine.state.getAllPlayers();
        for (const player of players) {
            const resources =
                engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    player
                );
            expect(resources?.health).toBe(20);
            expect(resources?.mana).toBe(1);
        }
    });

    it('should create zones for each player', () => {
        const players = engine.state.getAllPlayers();
        for (const player of players) {
            expect(getPlayerZone(engine, player, 'deck')).not.toBeNull();
            expect(getPlayerZone(engine, player, 'hand')).not.toBeNull();
            expect(getPlayerZone(engine, player, 'board')).not.toBeNull();
            expect(getPlayerZone(engine, player, 'discard')).not.toBeNull();
        }
    });

    it('should deal 3 cards to each player hand', () => {
        const players = engine.state.getAllPlayers();
        for (const player of players) {
            const handCards = getCardsInZone(engine, player, 'hand');
            expect(handCards).toHaveLength(3);
        }
    });

    it('should have 7 cards remaining in each deck (10 - 3 = 7)', () => {
        const players = engine.state.getAllPlayers();
        for (const player of players) {
            const deckCards = getCardsInZone(engine, player, 'deck');
            expect(deckCards).toHaveLength(7);
        }
    });

    it('should register 6 action types', () => {
        expect(engine.getActionSystem().getActionCount()).toBe(6);
    });
});

// ============================================================================
// Game Flow Tests
// ============================================================================

describe('Simple Card Game - Game Flow', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should have DrawCard as a valid action', () => {
        const drawAction = findActionByType(engine, 'DrawCard');
        expect(drawAction).toBeDefined();
    });

    it('should have EndTurn as a valid action', () => {
        const endTurnAction = findActionByType(engine, 'EndTurn');
        expect(endTurnAction).toBeDefined();
    });

    it('should have PlayCard actions for affordable cards in hand', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const handCards = getCardsInZone(engine, currentPlayer, 'hand');

        // At least one card should be playable with 1 mana
        const playableCards = handCards.filter(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return cardComp && cardComp.cost <= 1;
        });

        // If there are affordable cards, there should be PlayCard actions
        if (playableCards.length > 0) {
            const playActions = engine
                .getValidActions()
                .filter(a => a.type === 'PlayCard');
            expect(playActions.length).toBeGreaterThan(0);
        }
    });

    it('should switch players on EndTurn', () => {
        const players = engine.state.getAllPlayers();
        expect(engine.getCurrentPlayer()).toBe(players[0]);

        const endTurnAction = findActionByType(engine, 'EndTurn')!;
        engine.performAction(endTurnAction);

        expect(engine.getCurrentPlayer()).toBe(players[1]);
    });

    it('should increase mana on new turn', () => {
        const players = engine.state.getAllPlayers();
        const player1 = players[0];
        const player2 = players[1];

        // Player 1 has 1 mana
        let resources1 =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player1
            );
        expect(resources1?.mana).toBe(1);

        // End turn - Player 2 gains 1 mana at start of their turn
        const endTurn1 = findActionByType(engine, 'EndTurn')!;
        engine.performAction(endTurn1);

        // Player 2 now has 2 mana (1 original + 1 gained at turn start)
        let resources2 =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player2
            );
        expect(resources2?.mana).toBe(2);

        // End player 2's turn - Player 1 gains 1 mana at start of their turn
        const endTurn2 = findActionByType(engine, 'EndTurn')!;
        engine.performAction(endTurn2);

        // Player 1 should now have 2 mana (1 original + 1 gained at turn start)
        resources1 =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player1
            );
        expect(resources1?.mana).toBe(2);
    });

    it('should increment turn number after both players take a turn', () => {
        expect(engine.getTurnNumber()).toBe(1);

        // Player 1 ends turn
        engine.performAction(findActionByType(engine, 'EndTurn')!);
        expect(engine.getTurnNumber()).toBe(1);

        // Player 2 ends turn
        engine.performAction(findActionByType(engine, 'EndTurn')!);
        expect(engine.getTurnNumber()).toBe(2);
    });
});

// ============================================================================
// Drawing Cards Tests
// ============================================================================

describe('Simple Card Game - Drawing Cards', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should draw a card from deck to hand', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const initialHandSize = getCardsInZone(
            engine,
            currentPlayer,
            'hand'
        ).length;
        const initialDeckSize = getCardsInZone(
            engine,
            currentPlayer,
            'deck'
        ).length;

        const drawAction = findActionByType(engine, 'DrawCard')!;
        engine.performAction(drawAction);

        const newHandSize = getCardsInZone(
            engine,
            currentPlayer,
            'hand'
        ).length;
        const newDeckSize = getCardsInZone(
            engine,
            currentPlayer,
            'deck'
        ).length;

        expect(newHandSize).toBe(initialHandSize + 1);
        expect(newDeckSize).toBe(initialDeckSize - 1);
    });

    it('should not allow drawing when deck is empty', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const deckZone = getPlayerZone(engine, currentPlayer, 'deck')!;

        // Empty the deck
        const deckComp = engine.state.coordinator.getComponentFromEntity<{
            cached: { entities: Entity[] };
        }>(DECK_COMPONENT, deckZone);
        if (deckComp) {
            deckComp.cached.entities = [];
        }

        // Refresh valid actions
        const drawAction = findActionByType(engine, 'DrawCard');
        expect(drawAction).toBeUndefined();
    });
});

// ============================================================================
// Playing Cards Tests
// ============================================================================

describe('Simple Card Game - Playing Cards', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should play a card from hand to board', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const handCards = getCardsInZone(engine, currentPlayer, 'hand');

        // Find an affordable card
        const affordableCard = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return cardComp && cardComp.cost <= 1;
        });

        if (affordableCard) {
            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                affordableCard
            )!;
            engine.performAction(playAction);

            const boardCards = getCardsInZone(engine, currentPlayer, 'board');
            expect(boardCards).toContain(affordableCard);

            const newHandCards = getCardsInZone(engine, currentPlayer, 'hand');
            expect(newHandCards).not.toContain(affordableCard);
        }
    });

    it('should deduct mana when playing a card', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const handCards = getCardsInZone(engine, currentPlayer, 'hand');

        const affordableCard = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return cardComp && cardComp.cost === 1;
        });

        if (affordableCard) {
            const initialMana =
                engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    currentPlayer
                )?.mana;

            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                affordableCard
            )!;
            engine.performAction(playAction);

            const newMana =
                engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    currentPlayer
                )?.mana;

            expect(newMana).toBe(initialMana! - 1);
        }
    });

    it('should give creatures summoning sickness when played', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const handCards = getCardsInZone(engine, currentPlayer, 'hand');

        const affordableCreature = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return (
                cardComp &&
                cardComp.cost <= 1 &&
                cardComp.cardType === 'Creature'
            );
        });

        if (affordableCreature) {
            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                affordableCreature
            )!;
            engine.performAction(playAction);

            const cardState =
                engine.state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    affordableCreature
                );
            expect(cardState?.summoningSickness).toBe(true);
        }
    });
});

// ============================================================================
// Combat Tests
// ============================================================================

describe('Simple Card Game - Combat', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should not allow attacking with creatures that have summoning sickness', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const handCards = getCardsInZone(engine, currentPlayer, 'hand');

        // Play a creature
        const affordableCreature = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return (
                cardComp &&
                cardComp.cost <= 1 &&
                cardComp.cardType === 'Creature'
            );
        });

        if (affordableCreature) {
            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                affordableCreature
            )!;
            engine.performAction(playAction);

            // Check that no attack actions are available for this creature
            const attackActions = engine
                .getValidActions()
                .filter(
                    a =>
                        (a.type === 'AttackCreature' ||
                            a.type === 'AttackPlayer') &&
                        a.targetIds[0] === affordableCreature
                );
            expect(attackActions).toHaveLength(0);
        }
    });

    it('should allow attacking after summoning sickness wears off', () => {
        const players = engine.state.getAllPlayers();
        const player1 = players[0];
        const player2 = players[1];
        const handCards = getCardsInZone(engine, player1, 'hand');

        // Play a creature for player 1
        const affordableCreature = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return (
                cardComp &&
                cardComp.cost <= 1 &&
                cardComp.cardType === 'Creature'
            );
        });

        if (affordableCreature) {
            // Play the creature
            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                affordableCreature
            )!;
            engine.performAction(playAction);

            // End player 1's turn
            engine.performAction(findActionByType(engine, 'EndTurn')!);

            // End player 2's turn
            engine.performAction(findActionByType(engine, 'EndTurn')!);

            // Now it's player 1's turn again, creature should be able to attack
            const attackPlayerActions = engine
                .getValidActions()
                .filter(
                    a =>
                        a.type === 'AttackPlayer' &&
                        a.targetIds[0] === affordableCreature
                );
            expect(attackPlayerActions.length).toBeGreaterThan(0);
        }
    });

    it('should deal damage to opponent when attacking player', () => {
        const players = engine.state.getAllPlayers();
        const player1 = players[0];
        const player2 = players[1];

        // Fast forward to have mana and a creature ready to attack
        // Give player1 more mana
        const resources1 =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player1
            )!;
        resources1.mana = 5;

        const handCards = getCardsInZone(engine, player1, 'hand');
        const creature = handCards.find(card => {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            return cardComp && cardComp.cardType === 'Creature';
        });

        if (creature) {
            // Play the creature
            const playAction = findActionByTypeAndTarget(
                engine,
                'PlayCard',
                creature
            )!;
            engine.performAction(playAction);

            // Remove summoning sickness manually for testing
            const cardState =
                engine.state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    creature
                )!;
            cardState.summoningSickness = false;

            // Get creature's power
            const creatureCard =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    creature
                )!;
            const power = creatureCard.power ?? 0;

            // Get initial health
            const player2Resources =
                engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    player2
                )!;
            const initialHealth = player2Resources.health;

            // Attack player 2
            const attackAction = engine
                .getValidActions()
                .find(
                    a =>
                        a.type === 'AttackPlayer' &&
                        a.targetIds[0] === creature &&
                        a.targetIds[1] === player2
                )!;
            engine.performAction(attackAction);

            // Check damage was dealt
            expect(player2Resources.health).toBe(initialHealth - power);
        }
    });
});

// ============================================================================
// Win Condition Tests
// ============================================================================

describe('Simple Card Game - Win Conditions', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should detect game over when a player reaches 0 health', () => {
        const players = engine.state.getAllPlayers();
        const player2 = players[1];

        // Set player2's health to 0
        const resources =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player2
            )!;
        resources.health = 0;

        expect(engine.isGameOver()).toBe(true);

        // Verify GameStatusComponent is updated
        const gameManagerEntity = engine.state.coordinator
            .getAllEntities()
            .find(entity => {
                return (
                    engine.state.coordinator.getComponentFromEntity<GameManagerComponent>(
                        GAME_MANAGER_COMPONENT,
                        entity
                    ) !== null
                );
            });
        expect(gameManagerEntity).toBeDefined();

        if (gameManagerEntity !== undefined) {
            const gameStatus =
                engine.state.coordinator.getComponentFromEntity<GameStatusComponent>(
                    GAME_STATUS_COMPONENT,
                    gameManagerEntity
                );
            expect(gameStatus).toBeDefined();
            expect(gameStatus?.isGameOver).toBe(true);
        }
    });

    it('should identify winner when game is over', () => {
        const players = engine.state.getAllPlayers();
        const player1 = players[0];
        const player2 = players[1];

        // Set player2's health to 0
        const resources =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player2
            )!;
        resources.health = 0;

        const winner = engine.getWinner();
        expect(winner).toBe(player1);

        // Verify GameStatusComponent has winner set
        const gameManagerEntity = engine.state.coordinator
            .getAllEntities()
            .find(entity => {
                return (
                    engine.state.coordinator.getComponentFromEntity<GameManagerComponent>(
                        GAME_MANAGER_COMPONENT,
                        entity
                    ) !== null
                );
            });
        expect(gameManagerEntity).toBeDefined();

        if (gameManagerEntity !== undefined) {
            const gameStatus =
                engine.state.coordinator.getComponentFromEntity<GameStatusComponent>(
                    GAME_STATUS_COMPONENT,
                    gameManagerEntity
                );
            expect(gameStatus).toBeDefined();
            expect(gameStatus?.isGameOver).toBe(true);
            expect(gameStatus?.winner).toBe(player1);
        }
    });

    it('should not be game over when all players have health', () => {
        expect(engine.isGameOver()).toBe(false);
    });
});

// ============================================================================
// Valid Actions Tests
// ============================================================================

describe('Simple Card Game - Valid Actions', () => {
    let engine: GameEngine;

    beforeEach(() => {
        engine = createSimpleCardGame();
    });

    it('should return valid actions for current player only', () => {
        const players = engine.state.getAllPlayers();
        const player1 = players[0];

        const validActions = engine.getValidActions();

        // All valid actions should have player1 as the actor
        for (const action of validActions) {
            expect(action.actorId).toBe(player1);
        }
    });

    it('should update valid actions after performing an action', () => {
        const initialActions = engine.getValidActions();
        const drawAction = findActionByType(engine, 'DrawCard')!;

        engine.performAction(drawAction);

        const newActions = engine.getValidActions();

        // Actions should potentially differ (more cards in hand = more PlayCard options)
        expect(newActions).toBeDefined();
    });

    it('should not include PlayCard for cards that cost more than available mana', () => {
        const currentPlayer = engine.getCurrentPlayer()!;
        const resources =
            engine.state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                currentPlayer
            )!;
        const availableMana = resources.mana;

        const playActions = engine
            .getValidActions()
            .filter(a => a.type === 'PlayCard');

        for (const action of playActions) {
            const cardComp =
                engine.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    action.targetIds[0]
                )!;
            expect(cardComp.cost).toBeLessThanOrEqual(availableMana);
        }
    });
});
