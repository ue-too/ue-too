/**
 * Simple Card Game - Game Definition
 *
 * Sets up a 2-player card game with:
 * - Deck, Hand, Board, and Discard zones for each player
 * - Starting deck of cards
 * - All card game actions (Draw, Play, Attack, etc.)
 */

import { Coordinator, Entity } from '@ue-too/ecs';
import { GameState, PLAYER_COMPONENT, ZONE_COMPONENT } from '../../board-game-engine/core/game-state';
import type { PlayerComponent, ZoneComponent } from '../../board-game-engine/core/game-state';
import {
  CARD_COMPONENT,
  RESOURCE_COMPONENT,
  OWNER_COMPONENT,
  CARD_STATE_COMPONENT,
  LOCATION_COMPONENT,
  DECK_COMPONENT,
  TURN_STATE_COMPONENT,
  registerCardGameComponents,
  type CardComponent,
  type ResourceComponent,
  type OwnerComponent,
  type LocationComponent,
  type TurnStateComponent,
} from './components';
import { cardGameActions } from './actions';
import { GameEngine, type GameDefinition } from '../../board-game-engine/game-engine';
import type { PhaseDefinition, Rule } from '../../board-game-engine/core/types';

// ============================================================================
// Sample Card Definitions
// ============================================================================

interface CardDefinition {
  name: string;
  cardType: 'Creature' | 'Spell' | 'Artifact';
  cost: number;
  description: string;
  power?: number;
  toughness?: number;
  effectId?: string;
}

/**
 * Sample starter deck cards.
 */
const STARTER_DECK: CardDefinition[] = [
  // Low-cost creatures
  { name: 'Goblin Scout', cardType: 'Creature', cost: 1, description: 'A quick goblin.', power: 1, toughness: 1 },
  { name: 'Goblin Scout', cardType: 'Creature', cost: 1, description: 'A quick goblin.', power: 1, toughness: 1 },
  { name: 'Forest Sprite', cardType: 'Creature', cost: 1, description: 'A tiny forest dweller.', power: 1, toughness: 2 },
  { name: 'Forest Sprite', cardType: 'Creature', cost: 1, description: 'A tiny forest dweller.', power: 1, toughness: 2 },

  // Mid-cost creatures
  { name: 'Iron Golem', cardType: 'Creature', cost: 2, description: 'A sturdy construct.', power: 2, toughness: 2 },
  { name: 'Iron Golem', cardType: 'Creature', cost: 2, description: 'A sturdy construct.', power: 2, toughness: 2 },
  { name: 'Fire Elemental', cardType: 'Creature', cost: 3, description: 'Burns with inner flame.', power: 3, toughness: 2 },
  { name: 'Fire Elemental', cardType: 'Creature', cost: 3, description: 'Burns with inner flame.', power: 3, toughness: 2 },

  // High-cost creatures
  { name: 'Stone Giant', cardType: 'Creature', cost: 4, description: 'A massive stone creature.', power: 4, toughness: 4 },
  { name: 'Dragon Whelp', cardType: 'Creature', cost: 5, description: 'A young but fierce dragon.', power: 5, toughness: 3 },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a card entity in the game.
 */
function createCard(
  coordinator: Coordinator,
  definition: CardDefinition,
  owner: Entity,
  zoneEntity: Entity,
  sortIndex: number
): Entity {
  const card = coordinator.createEntity();

  // Add card component
  coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, card, {
    name: definition.name,
    cardType: definition.cardType,
    cost: definition.cost,
    description: definition.description,
    power: definition.power,
    toughness: definition.toughness,
    effectId: definition.effectId,
  });

  // Add owner component
  coordinator.addComponentToEntity<OwnerComponent>(OWNER_COMPONENT, card, {
    owner: owner,
  });

  // Add location component (places card in zone)
  coordinator.addComponentToEntity<LocationComponent>(LOCATION_COMPONENT, card, {
    location: zoneEntity,
    sortIndex: sortIndex,
  });

  return card;
}

/**
 * Create a zone entity for a player.
 */
function createZone(
  coordinator: Coordinator,
  name: string,
  owner: Entity | null,
  visibility: 'public' | 'private' | 'owner-only'
): Entity {
  const zone = coordinator.createEntity();

  // Add zone component
  coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone, {
    name: name,
    owner: owner,
    visibility: visibility,
  });

  // Add deck component to track entities in this zone
  coordinator.addComponentToEntity<{ cached: { entities: Entity[] } }>(DECK_COMPONENT, zone, {
    cached: { entities: [] },
  });

  return zone;
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Game State Creation
// ============================================================================

/**
 * Create initial game state with 2 players, zones, and starting decks.
 */
function createInitialState(): GameState {
  const coordinator = new Coordinator();

  // Register all required components
  registerCardGameComponents(coordinator);
  coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT);
  coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

  // Create game state
  const state = new GameState(coordinator);

  // Create players
  const player1 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player1, {
    name: 'Player 1',
    playerNumber: 0,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player1, {
    mana: 1,
    maxMana: 10,
    health: 20,
    maxHealth: 20,
  });
  coordinator.addComponentToEntity<TurnStateComponent>(TURN_STATE_COMPONENT, player1, {
    hasDrawnThisTurn: false,
  });

  const player2 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player2, {
    name: 'Player 2',
    playerNumber: 1,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player2, {
    mana: 1,
    maxMana: 10,
    health: 20,
    maxHealth: 20,
  });
  coordinator.addComponentToEntity<TurnStateComponent>(TURN_STATE_COMPONENT, player2, {
    hasDrawnThisTurn: false,
  });

  // Create zones for each player
  const players = [player1, player2];

  for (const player of players) {
    // Deck zone (private - only owner can see)
    const deckZone = createZone(coordinator, 'deck', player, 'owner-only');

    // Hand zone (owner only)
    const handZone = createZone(coordinator, 'hand', player, 'owner-only');

    // Board zone (public)
    const boardZone = createZone(coordinator, 'board', player, 'public');

    // Discard zone (public)
    const discardZone = createZone(coordinator, 'discard', player, 'public');

    // Create and shuffle deck
    const shuffledDeck = shuffleArray(STARTER_DECK);

    // Add cards to deck
    const deckComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      DECK_COMPONENT,
      deckZone
    )!;

    for (let i = 0; i < shuffledDeck.length; i++) {
      const card = createCard(coordinator, shuffledDeck[i], player, deckZone, i);
      deckComp.cached.entities.push(card);
    }

    // Draw starting hand (3 cards)
    const handComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      DECK_COMPONENT,
      handZone
    )!;

    for (let i = 0; i < 3; i++) {
      if (deckComp.cached.entities.length > 0) {
        const cardEntity = deckComp.cached.entities.pop()!;
        const locationComp = coordinator.getComponentFromEntity<LocationComponent>(
          LOCATION_COMPONENT,
          cardEntity
        );
        if (locationComp) {
          locationComp.location = handZone;
        }
        handComp.cached.entities.push(cardEntity);
      }
    }
  }

  // Set initial game state
  state.setCurrentPhase('Main');
  state.setTurnNumber(1);
  state.setActivePlayer(player1);

  return state;
}

// ============================================================================
// Phase Definitions
// ============================================================================

/**
 * Phases for the simple card game.
 */
const phases: PhaseDefinition[] = [
  {
    name: 'Main',
    allowedActionTypes: ['DrawCard', 'PlayCard', 'AttackCreature', 'AttackPlayer', 'ActivateAbility', 'EndTurn'],
    autoAdvance: false,
    nextPhase: 'Main', // Stays in Main phase (turn-based, not phase-based for MVP)
    onEnter: (state) => {
      // Gain 1 mana at start of turn (up to max)
      const activePlayer = state.activePlayer;
      if (activePlayer) {
        const resources = state.coordinator.getComponentFromEntity<ResourceComponent>(
          RESOURCE_COMPONENT,
          activePlayer
        );
        if (resources && resources.mana < resources.maxMana) {
          resources.mana = Math.min(resources.mana + 1, resources.maxMana);
        }
      }
    },
  },
];

// ============================================================================
// Rule Definitions
// ============================================================================

/**
 * Rules for the simple card game.
 * For MVP, we keep rules minimal. Future versions can add:
 * - Card draw on turn start
 * - Ability effects
 * - Win condition checks
 */
const rules: Rule[] = [];

// ============================================================================
// Game Creation
// ============================================================================

/**
 * Create the simple card game definition.
 */
export function createSimpleCardGame(): GameEngine {
  const gameDefinition: GameDefinition = {
    name: 'Simple Card Game',
    actions: cardGameActions,
    rules: rules,
    phases: phases,
    createInitialState: createInitialState,
  };

  return new GameEngine(gameDefinition);
}

// ============================================================================
// Exports
// ============================================================================

export { STARTER_DECK, type CardDefinition };
