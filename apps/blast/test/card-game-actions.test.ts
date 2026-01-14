/**
 * Unit Tests for Card Game Actions
 *
 * Tests the action definitions for DrawCard, PlayCard, AttackCreature, AttackPlayer, ActivateAbility, EndTurn.
 */

import { Coordinator, Entity } from '@ue-too/ecs';
import { GameState, PLAYER_COMPONENT, ZONE_COMPONENT } from '../src/board-game-engine/core/game-state';
import type { PlayerComponent, ZoneComponent } from '../src/board-game-engine/core/game-state';
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
  type CardStateComponent,
  type LocationComponent,
  type DeckComponent,
  type TurnStateComponent,
} from '../src/games/simple-card-game/components';
import {
  drawCardAction,
  playCardAction,
  attackCreatureAction,
  attackPlayerAction,
  endTurnAction,
} from '../src/games/simple-card-game/actions';
import { ActionContext } from '../src/board-game-engine/action-system/action-context';
import type { Action } from '../src/board-game-engine/core/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestGameState(): {
  state: GameState;
  player1: Entity;
  player2: Entity;
  player1DeckZone: Entity;
  player1HandZone: Entity;
  player1BoardZone: Entity;
  player2DeckZone: Entity;
  player2HandZone: Entity;
  player2BoardZone: Entity;
} {
  const coordinator = new Coordinator();

  // Register components - must register LOCATION and DECK before registerCardGameComponents
  if (coordinator.getComponentType(LOCATION_COMPONENT) === null) {
    coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
  }
  if (coordinator.getComponentType(DECK_COMPONENT) === null) {
    coordinator.registerComponent<DeckComponent>(DECK_COMPONENT);
  }

  // Register card game components
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
    mana: 3,
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
    mana: 3,
    maxMana: 10,
    health: 20,
    maxHealth: 20,
  });
  coordinator.addComponentToEntity<TurnStateComponent>(TURN_STATE_COMPONENT, player2, {
    hasDrawnThisTurn: false,
  });

  // Create zones for player 1
  const player1DeckZone = createZone(coordinator, 'deck', player1);
  const player1HandZone = createZone(coordinator, 'hand', player1);
  const player1BoardZone = createZone(coordinator, 'board', player1);
  createZone(coordinator, 'discard', player1);

  // Create zones for player 2
  const player2DeckZone = createZone(coordinator, 'deck', player2);
  const player2HandZone = createZone(coordinator, 'hand', player2);
  const player2BoardZone = createZone(coordinator, 'board', player2);
  createZone(coordinator, 'discard', player2);

  // Set initial state
  state.setCurrentPhase('Main');
  state.setTurnNumber(1);
  state.setActivePlayer(player1);

  return {
    state,
    player1,
    player2,
    player1DeckZone,
    player1HandZone,
    player1BoardZone,
    player2DeckZone,
    player2HandZone,
    player2BoardZone,
  };
}

function createZone(coordinator: Coordinator, name: string, owner: Entity): Entity {
  const zone = coordinator.createEntity();
  coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone, {
    name: name,
    owner: owner,
    visibility: 'public',
  });
  coordinator.addComponentToEntity<{ cached: { entities: Entity[] } }>(DECK_COMPONENT, zone, {
    cached: { entities: [] },
  });
  return zone;
}

function createCard(
  coordinator: Coordinator,
  owner: Entity,
  zoneEntity: Entity,
  cardData: Partial<CardComponent> = {}
): Entity {
  const card = coordinator.createEntity();

  const defaultCard: CardComponent = {
    name: 'Test Card',
    cardType: 'Creature',
    cost: 1,
    description: 'A test card',
    power: 2,
    toughness: 2,
    ...cardData,
  };

  coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, card, defaultCard);
  coordinator.addComponentToEntity<OwnerComponent>(OWNER_COMPONENT, card, { owner });
  coordinator.addComponentToEntity<LocationComponent>(LOCATION_COMPONENT, card, {
    location: zoneEntity,
    sortIndex: 0,
  });

  // Add to zone's deck component
  const deckComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
    DECK_COMPONENT,
    zoneEntity
  );
  if (deckComp) {
    deckComp.cached.entities.push(card);
  }

  return card;
}

// ============================================================================
// DrawCard Action Tests
// ============================================================================

describe('DrawCard Action', () => {
  it('should allow drawing when it is player turn and deck has cards', () => {
    const { state, player1, player1DeckZone, player1HandZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add a card to the deck
    createCard(coordinator, player1, player1DeckZone, { name: 'Test Card' });

    // Check preconditions
    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = drawCardAction.canExecute(state, action);
    expect(canExecute).toBe(true);
    expect(error).toBeNull();
  });

  it('should not allow drawing when deck is empty', () => {
    const { state, player1 } = createTestGameState();

    // Deck is empty (no cards added)
    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = drawCardAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toBe('Your deck is empty');
  });

  it('should not allow drawing when it is not player turn', () => {
    const { state, player1, player2, player1DeckZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add a card to player1's deck
    createCard(coordinator, player1, player1DeckZone, { name: 'Test Card' });

    // Player 2 tries to draw (but it's player 1's turn)
    const action: Action = {
      type: 'DrawCard',
      actorId: player2,
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = drawCardAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('not your turn');
  });

  it('should move card from deck to hand when executed', () => {
    const { state, player1, player1DeckZone, player1HandZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add a card to the deck
    const card = createCard(coordinator, player1, player1DeckZone, { name: 'Drawn Card' });

    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    // Execute the action
    drawCardAction.execute(state, action);

    // Check card is now in hand
    const handDeckComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      DECK_COMPONENT,
      player1HandZone
    );
    const deckDeckComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      DECK_COMPONENT,
      player1DeckZone
    );

    expect(handDeckComp?.cached.entities).toContain(card);
    expect(deckDeckComp?.cached.entities).not.toContain(card);
  });

  it('should generate CardDrawn event', () => {
    const { state, player1, player1DeckZone } = createTestGameState();
    const coordinator = state.coordinator;

    createCard(coordinator, player1, player1DeckZone, { name: 'Test Card' });

    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    const events = drawCardAction.getGeneratedEvents(state, action);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'CardDrawn')).toBe(true);
  });

  it('should not allow drawing more than once per turn', () => {
    const { state, player1, player1DeckZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add cards to the deck
    createCard(coordinator, player1, player1DeckZone, { name: 'Card 1' });
    createCard(coordinator, player1, player1DeckZone, { name: 'Card 2' });

    // Mark that player has already drawn this turn
    const turnState = coordinator.getComponentFromEntity<TurnStateComponent>(
      TURN_STATE_COMPONENT,
      player1
    );
    turnState!.hasDrawnThisTurn = true;

    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = drawCardAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toBe('You have already drawn a card this turn');
  });

  it('should set hasDrawnThisTurn to true after drawing', () => {
    const { state, player1, player1DeckZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add a card to the deck
    createCard(coordinator, player1, player1DeckZone, { name: 'Test Card' });

    const action: Action = {
      type: 'DrawCard',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    // Verify it starts as false
    const turnStateBefore = coordinator.getComponentFromEntity<TurnStateComponent>(
      TURN_STATE_COMPONENT,
      player1
    );
    expect(turnStateBefore!.hasDrawnThisTurn).toBe(false);

    // Execute the draw
    drawCardAction.execute(state, action);

    // Verify it is now true
    const turnStateAfter = coordinator.getComponentFromEntity<TurnStateComponent>(
      TURN_STATE_COMPONENT,
      player1
    );
    expect(turnStateAfter!.hasDrawnThisTurn).toBe(true);
  });
});

// ============================================================================
// PlayCard Action Tests
// ============================================================================

describe('PlayCard Action', () => {
  it('should allow playing a card from hand with enough mana', () => {
    const { state, player1, player1HandZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add a card to hand (cost 1, player has 3 mana)
    const card = createCard(coordinator, player1, player1HandZone, { name: 'Goblin', cost: 1 });

    const action: Action = {
      type: 'PlayCard',
      actorId: player1,
      targetIds: [card],
      parameters: {},
    };

    const [canExecute, error] = playCardAction.canExecute(state, action);
    expect(canExecute).toBe(true);
    expect(error).toBeNull();
  });

  it('should not allow playing a card with insufficient mana', () => {
    const { state, player1, player1HandZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Add an expensive card (cost 5, player has 3 mana)
    const card = createCard(coordinator, player1, player1HandZone, { name: 'Dragon', cost: 5 });

    const action: Action = {
      type: 'PlayCard',
      actorId: player1,
      targetIds: [card],
      parameters: {},
    };

    const [canExecute, error] = playCardAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('Not enough mana');
  });

  it('should not allow playing a card not in hand', () => {
    const { state, player1, player1DeckZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Card is in deck, not in hand
    const card = createCard(coordinator, player1, player1DeckZone, { name: 'Hidden Card', cost: 1 });

    const action: Action = {
      type: 'PlayCard',
      actorId: player1,
      targetIds: [card],
      parameters: {},
    };

    const [canExecute, error] = playCardAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toBe('Card must be in your hand');
  });

  it('should move card to board and deduct mana when executed', () => {
    const { state, player1, player1HandZone, player1BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, player1, player1HandZone, { name: 'Warrior', cost: 2 });

    const action: Action = {
      type: 'PlayCard',
      actorId: player1,
      targetIds: [card],
      parameters: {},
    };

    // Execute the action
    playCardAction.execute(state, action);

    // Check card is on board
    const boardDeckComp = coordinator.getComponentFromEntity<{ cached: { entities: Entity[] } }>(
      DECK_COMPONENT,
      player1BoardZone
    );
    expect(boardDeckComp?.cached.entities).toContain(card);

    // Check mana was deducted (3 - 2 = 1)
    const resources = coordinator.getComponentFromEntity<ResourceComponent>(RESOURCE_COMPONENT, player1);
    expect(resources?.mana).toBe(1);
  });

  it('should add summoning sickness to creatures', () => {
    const { state, player1, player1HandZone } = createTestGameState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, player1, player1HandZone, {
      name: 'Creature',
      cardType: 'Creature',
      cost: 1,
    });

    const action: Action = {
      type: 'PlayCard',
      actorId: player1,
      targetIds: [card],
      parameters: {},
    };

    playCardAction.execute(state, action);

    const cardState = coordinator.getComponentFromEntity<CardStateComponent>(CARD_STATE_COMPONENT, card);
    expect(cardState?.summoningSickness).toBe(true);
  });
});

// ============================================================================
// AttackCreature Action Tests
// ============================================================================

describe('AttackCreature Action', () => {
  it('should allow attacking an enemy creature', () => {
    const { state, player1, player2, player1BoardZone, player2BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Create attacker on player1's board (no summoning sickness)
    const attacker = createCard(coordinator, player1, player1BoardZone, {
      name: 'Attacker',
      cardType: 'Creature',
      power: 3,
      toughness: 3,
    });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    // Create defender on player2's board
    const defender = createCard(coordinator, player2, player2BoardZone, {
      name: 'Defender',
      cardType: 'Creature',
      power: 2,
      toughness: 2,
    });

    const action: Action = {
      type: 'AttackCreature',
      actorId: player1,
      targetIds: [attacker, defender],
      parameters: {},
    };

    const [canExecute, error] = attackCreatureAction.canExecute(state, action);
    expect(canExecute).toBe(true);
    expect(error).toBeNull();
  });

  it('should not allow attacking with a creature that has summoning sickness', () => {
    const { state, player1, player2, player1BoardZone, player2BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Create attacker with summoning sickness
    const attacker = createCard(coordinator, player1, player1BoardZone, { name: 'Sick Attacker' });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: true,
      attacksThisTurn: 0,
    });

    const defender = createCard(coordinator, player2, player2BoardZone, { name: 'Defender' });

    const action: Action = {
      type: 'AttackCreature',
      actorId: player1,
      targetIds: [attacker, defender],
      parameters: {},
    };

    const [canExecute, error] = attackCreatureAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('summoning sickness');
  });

  it('should not allow attacking with a tapped creature', () => {
    const { state, player1, player2, player1BoardZone, player2BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Create tapped attacker
    const attacker = createCard(coordinator, player1, player1BoardZone, { name: 'Tapped Attacker' });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: true,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    const defender = createCard(coordinator, player2, player2BoardZone, { name: 'Defender' });

    const action: Action = {
      type: 'AttackCreature',
      actorId: player1,
      targetIds: [attacker, defender],
      parameters: {},
    };

    const [canExecute, error] = attackCreatureAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('tapped');
  });

  it('should deal damage and tap attacker when executed', () => {
    const { state, player1, player2, player1BoardZone, player2BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    const attacker = createCard(coordinator, player1, player1BoardZone, {
      name: 'Attacker',
      power: 3,
      toughness: 3,
    });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    const defender = createCard(coordinator, player2, player2BoardZone, {
      name: 'Defender',
      power: 2,
      toughness: 4,
    });

    const action: Action = {
      type: 'AttackCreature',
      actorId: player1,
      targetIds: [attacker, defender],
      parameters: {},
    };

    attackCreatureAction.execute(state, action);

    // Attacker should be tapped
    const attackerState = coordinator.getComponentFromEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker);
    expect(attackerState?.tapped).toBe(true);

    // Defender should have taken damage (4 - 3 = 1 toughness)
    const defenderCard = coordinator.getComponentFromEntity<CardComponent>(CARD_COMPONENT, defender);
    expect(defenderCard?.toughness).toBe(1);

    // Attacker should have taken counter-damage (3 - 2 = 1 toughness)
    const attackerCard = coordinator.getComponentFromEntity<CardComponent>(CARD_COMPONENT, attacker);
    expect(attackerCard?.toughness).toBe(1);
  });
});

// ============================================================================
// AttackPlayer Action Tests
// ============================================================================

describe('AttackPlayer Action', () => {
  it('should allow attacking an opponent player', () => {
    const { state, player1, player2, player1BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    const attacker = createCard(coordinator, player1, player1BoardZone, {
      name: 'Attacker',
      power: 4,
      toughness: 4,
    });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    const action: Action = {
      type: 'AttackPlayer',
      actorId: player1,
      targetIds: [attacker, player2],
      parameters: {},
    };

    const [canExecute, error] = attackPlayerAction.canExecute(state, action);
    expect(canExecute).toBe(true);
    expect(error).toBeNull();
  });

  it('should not allow attacking yourself', () => {
    const { state, player1, player1BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    const attacker = createCard(coordinator, player1, player1BoardZone, { name: 'Attacker' });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    const action: Action = {
      type: 'AttackPlayer',
      actorId: player1,
      targetIds: [attacker, player1], // Attacking self
      parameters: {},
    };

    const [canExecute, error] = attackPlayerAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('opponent');
  });

  it('should deal damage to opponent player when executed', () => {
    const { state, player1, player2, player1BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    const attacker = createCard(coordinator, player1, player1BoardZone, {
      name: 'Attacker',
      power: 5,
      toughness: 5,
    });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker, {
      tapped: false,
      summoningSickness: false,
      attacksThisTurn: 0,
    });

    const action: Action = {
      type: 'AttackPlayer',
      actorId: player1,
      targetIds: [attacker, player2],
      parameters: {},
    };

    attackPlayerAction.execute(state, action);

    // Attacker should be tapped
    const attackerState = coordinator.getComponentFromEntity<CardStateComponent>(CARD_STATE_COMPONENT, attacker);
    expect(attackerState?.tapped).toBe(true);

    // Player 2 should have taken damage (20 - 5 = 15 health)
    const player2Resources = coordinator.getComponentFromEntity<ResourceComponent>(RESOURCE_COMPONENT, player2);
    expect(player2Resources?.health).toBe(15);
  });
});

// ============================================================================
// EndTurn Action Tests
// ============================================================================

describe('EndTurn Action', () => {
  it('should allow ending turn when it is player turn', () => {
    const { state, player1 } = createTestGameState();

    const action: Action = {
      type: 'EndTurn',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = endTurnAction.canExecute(state, action);
    expect(canExecute).toBe(true);
    expect(error).toBeNull();
  });

  it('should not allow ending turn when it is not player turn', () => {
    const { state, player2 } = createTestGameState();

    const action: Action = {
      type: 'EndTurn',
      actorId: player2, // It's player1's turn
      targetIds: [],
      parameters: {},
    };

    const [canExecute, error] = endTurnAction.canExecute(state, action);
    expect(canExecute).toBe(false);
    expect(error).toContain('not your turn');
  });

  it('should switch active player when executed', () => {
    const { state, player1, player2 } = createTestGameState();

    expect(state.activePlayer).toBe(player1);

    const action: Action = {
      type: 'EndTurn',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    endTurnAction.execute(state, action);

    expect(state.activePlayer).toBe(player2);
  });

  it('should untap all creatures and remove summoning sickness on new turn', () => {
    const { state, player1, player2, player1BoardZone, player2BoardZone } = createTestGameState();
    const coordinator = state.coordinator;

    // Create a tapped creature for player1
    const tappedCreature = createCard(coordinator, player1, player1BoardZone, { name: 'Tapped Creature' });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, tappedCreature, {
      tapped: true,
      summoningSickness: false,
      attacksThisTurn: 1,
    });

    // Create a creature with summoning sickness for player2
    const sickCreature = createCard(coordinator, player2, player2BoardZone, { name: 'Sick Creature' });
    coordinator.addComponentToEntity<CardStateComponent>(CARD_STATE_COMPONENT, sickCreature, {
      tapped: false,
      summoningSickness: true,
      attacksThisTurn: 0,
    });

    const action: Action = {
      type: 'EndTurn',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };

    endTurnAction.execute(state, action);

    // Player1's creature should be untapped
    const tappedState = coordinator.getComponentFromEntity<CardStateComponent>(CARD_STATE_COMPONENT, tappedCreature);
    expect(tappedState?.tapped).toBe(false);
    expect(tappedState?.attacksThisTurn).toBe(0);

    // Player2's creature should have summoning sickness removed
    const sickState = coordinator.getComponentFromEntity<CardStateComponent>(CARD_STATE_COMPONENT, sickCreature);
    expect(sickState?.summoningSickness).toBe(false);
  });

  it('should increment turn number when wrapping back to first player', () => {
    const { state, player1, player2 } = createTestGameState();

    expect(state.turnNumber).toBe(1);

    // End player1's turn
    const action1: Action = {
      type: 'EndTurn',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };
    endTurnAction.execute(state, action1);

    expect(state.turnNumber).toBe(1); // Still turn 1, now player2's turn

    // End player2's turn
    const action2: Action = {
      type: 'EndTurn',
      actorId: player2,
      targetIds: [],
      parameters: {},
    };
    endTurnAction.execute(state, action2);

    expect(state.turnNumber).toBe(2); // Now turn 2, back to player1
    expect(state.activePlayer).toBe(player1);
  });

  it('should reset hasDrawnThisTurn for new active player', () => {
    const { state, player1, player2 } = createTestGameState();
    const coordinator = state.coordinator;

    // Set player2's hasDrawnThisTurn to true (simulating they drew last turn)
    const player2TurnState = coordinator.getComponentFromEntity<TurnStateComponent>(
      TURN_STATE_COMPONENT,
      player2
    );
    player2TurnState!.hasDrawnThisTurn = true;

    // End player1's turn (switches to player2)
    const action: Action = {
      type: 'EndTurn',
      actorId: player1,
      targetIds: [],
      parameters: {},
    };
    endTurnAction.execute(state, action);

    // Player2's hasDrawnThisTurn should be reset to false for their new turn
    const player2TurnStateAfter = coordinator.getComponentFromEntity<TurnStateComponent>(
      TURN_STATE_COMPONENT,
      player2
    );
    expect(player2TurnStateAfter!.hasDrawnThisTurn).toBe(false);
  });
});
