/**
 * Unit Tests for Generic Preconditions Library
 *
 * Tests the configurable, reusable preconditions.
 */

import { Coordinator, Entity, createGlobalComponentName } from '@ue-too/ecs';
import { GameState, PLAYER_COMPONENT, ZONE_COMPONENT } from '../src/board-game-engine/core/game-state';
import type { PlayerComponent, ZoneComponent } from '../src/board-game-engine/core/game-state';
import { ActionContext } from '../src/board-game-engine/action-system/action-context';
import type { Action } from '../src/board-game-engine/core/types';
import {
  ResourceCheck,
  ZoneHasEntities,
  EntityInZone,
  ComponentValueCheck,
  OwnerCheck,
  TargetCount,
  EntityExists,
  EntityResolvers,
} from '../src/board-game-engine/action-system/preconditions/generic';

// ============================================================================
// Test Components
// ============================================================================

const RESOURCE_COMPONENT = createGlobalComponentName('TestResource');
const LOCATION_COMPONENT = createGlobalComponentName('TestLocation');
const DECK_COMPONENT = createGlobalComponentName('TestDeck');
const CARD_COMPONENT = createGlobalComponentName('TestCard');
const OWNER_COMPONENT = createGlobalComponentName('TestOwner');

interface ResourceComponent {
  mana: number;
  maxMana: number;
  health: number;
}

interface LocationComponent {
  location: Entity;
}

interface DeckComponent {
  cached: { entities: Entity[] };
}

interface CardComponent {
  name: string;
  cardType: string;
  tapped: boolean;
}

interface OwnerComponent {
  owner: Entity;
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(): {
  state: GameState;
  player1: Entity;
  player2: Entity;
  zone1: Entity;
  zone2: Entity;
} {
  const coordinator = new Coordinator();

  // Register components
  coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT);
  coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
  coordinator.registerComponent<ResourceComponent>(RESOURCE_COMPONENT);
  coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
  coordinator.registerComponent<DeckComponent>(DECK_COMPONENT);
  coordinator.registerComponent<CardComponent>(CARD_COMPONENT);
  coordinator.registerComponent<OwnerComponent>(OWNER_COMPONENT);

  const state = new GameState(coordinator);

  // Create players
  const player1 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player1, {
    name: 'Player 1',
    playerNumber: 0,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player1, {
    mana: 5,
    maxMana: 10,
    health: 20,
  });

  const player2 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player2, {
    name: 'Player 2',
    playerNumber: 1,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player2, {
    mana: 3,
    maxMana: 10,
    health: 15,
  });

  // Create zones
  const zone1 = coordinator.createEntity();
  coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone1, {
    name: 'zone1',
    owner: player1,
    visibility: 'public',
  });
  coordinator.addComponentToEntity<DeckComponent>(DECK_COMPONENT, zone1, {
    cached: { entities: [] },
  });

  const zone2 = coordinator.createEntity();
  coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone2, {
    name: 'zone2',
    owner: player1,
    visibility: 'public',
  });
  coordinator.addComponentToEntity<DeckComponent>(DECK_COMPONENT, zone2, {
    cached: { entities: [] },
  });

  // Set initial state
  state.setCurrentPhase('Main');
  state.setTurnNumber(1);
  state.setActivePlayer(player1);

  return { state, player1, player2, zone1, zone2 };
}

function createCard(
  coordinator: Coordinator,
  zone: Entity,
  owner: Entity,
  data: Partial<CardComponent> = {}
): Entity {
  const card = coordinator.createEntity();

  coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, card, {
    name: 'Test Card',
    cardType: 'Creature',
    tapped: false,
    ...data,
  });

  coordinator.addComponentToEntity<OwnerComponent>(OWNER_COMPONENT, card, {
    owner,
  });

  coordinator.addComponentToEntity<LocationComponent>(LOCATION_COMPONENT, card, {
    location: zone,
  });

  // Add to zone's deck
  const deckComp = coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, zone);
  if (deckComp) {
    deckComp.cached.entities.push(card);
  }

  return card;
}

function createContext(
  state: GameState,
  actor: Entity,
  targets: Entity[] = [],
  parameters: Record<string, any> = {}
): ActionContext {
  const action: Action = {
    type: 'TestAction',
    actorId: actor,
    targetIds: targets,
    parameters,
  };

  return new ActionContext(state, action, actor, targets, parameters);
}

// ============================================================================
// ResourceCheck Tests
// ============================================================================

describe('ResourceCheck Precondition', () => {
  it('should pass when resource >= value', () => {
    const { state, player1 } = createTestState();

    const precondition = new ResourceCheck({
      entity: EntityResolvers.actor,
      componentName: RESOURCE_COMPONENT,
      property: 'mana',
      operator: '>=',
      value: 3,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when resource < value', () => {
    const { state, player1 } = createTestState();

    const precondition = new ResourceCheck({
      entity: EntityResolvers.actor,
      componentName: RESOURCE_COMPONENT,
      property: 'mana',
      operator: '>=',
      value: 10,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should work with == operator', () => {
    const { state, player1 } = createTestState();

    const precondition = new ResourceCheck({
      entity: EntityResolvers.actor,
      componentName: RESOURCE_COMPONENT,
      property: 'mana',
      operator: '==',
      value: 5,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should work with != operator', () => {
    const { state, player1 } = createTestState();

    const precondition = new ResourceCheck({
      entity: EntityResolvers.actor,
      componentName: RESOURCE_COMPONENT,
      property: 'mana',
      operator: '!=',
      value: 0,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should use number resolver for value', () => {
    const { state, player1 } = createTestState();

    const precondition = new ResourceCheck({
      entity: EntityResolvers.actor,
      componentName: RESOURCE_COMPONENT,
      property: 'mana',
      operator: '>=',
      value: (ctx) => ctx.parameters.requiredMana,
    });

    const ctx = createContext(state, player1, [], { requiredMana: 3 });
    expect(precondition.check(ctx)).toBe(true);

    const ctx2 = createContext(state, player1, [], { requiredMana: 10 });
    expect(precondition.check(ctx2)).toBe(false);
  });
});

// ============================================================================
// ZoneHasEntities Tests
// ============================================================================

describe('ZoneHasEntities Precondition', () => {
  it('should pass when zone has minimum entities', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    // Add cards to zone
    createCard(coordinator, zone1, player1);
    createCard(coordinator, zone1, player1);

    const precondition = new ZoneHasEntities({
      zone: (_ctx) => zone1,
      zoneListComponent: DECK_COMPONENT,
      minCount: 2,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when zone has fewer than minimum entities', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    createCard(coordinator, zone1, player1);

    const precondition = new ZoneHasEntities({
      zone: (_ctx) => zone1,
      zoneListComponent: DECK_COMPONENT,
      minCount: 5,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should check max count', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    createCard(coordinator, zone1, player1);
    createCard(coordinator, zone1, player1);
    createCard(coordinator, zone1, player1);

    const precondition = new ZoneHasEntities({
      zone: (_ctx) => zone1,
      zoneListComponent: DECK_COMPONENT,
      maxCount: 2,
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(false); // Has 3, max is 2
  });

  it('should filter entities', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    createCard(coordinator, zone1, player1, { cardType: 'Creature' });
    createCard(coordinator, zone1, player1, { cardType: 'Spell' });
    createCard(coordinator, zone1, player1, { cardType: 'Creature' });

    const precondition = new ZoneHasEntities({
      zone: (_ctx) => zone1,
      zoneListComponent: DECK_COMPONENT,
      minCount: 2,
      filter: (entity, ctx) => {
        const card = ctx.state.coordinator.getComponentFromEntity<CardComponent>(
          CARD_COMPONENT,
          entity
        );
        return card?.cardType === 'Creature';
      },
    });

    const ctx = createContext(state, player1);
    expect(precondition.check(ctx)).toBe(true); // 2 creatures
  });
});

// ============================================================================
// EntityInZone Tests
// ============================================================================

describe('EntityInZone Precondition', () => {
  it('should pass when entity is in expected zone', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1);

    const precondition = new EntityInZone({
      entity: EntityResolvers.target,
      zone: (_ctx) => zone1,
      locationComponent: LOCATION_COMPONENT,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when entity is in different zone', () => {
    const { state, player1, zone1, zone2 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone2, player1);

    const precondition = new EntityInZone({
      entity: EntityResolvers.target,
      zone: (_ctx) => zone1,
      locationComponent: LOCATION_COMPONENT,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should accept multiple allowed zones', () => {
    const { state, player1, zone1, zone2 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone2, player1);

    const precondition = new EntityInZone({
      entity: EntityResolvers.target,
      zone: [(_ctx) => zone1, (_ctx) => zone2],
      locationComponent: LOCATION_COMPONENT,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });
});

// ============================================================================
// ComponentValueCheck Tests
// ============================================================================

describe('ComponentValueCheck Precondition', () => {
  it('should pass when value matches', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1, { tapped: false });

    const precondition = new ComponentValueCheck({
      entity: EntityResolvers.target,
      componentName: CARD_COMPONENT,
      property: 'tapped',
      value: false,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when value does not match', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1, { tapped: true });

    const precondition = new ComponentValueCheck({
      entity: EntityResolvers.target,
      componentName: CARD_COMPONENT,
      property: 'tapped',
      value: false,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should work with predicate function', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1, { cardType: 'Creature' });

    const precondition = new ComponentValueCheck({
      entity: EntityResolvers.target,
      componentName: CARD_COMPONENT,
      property: 'cardType',
      value: (type) => type === 'Creature' || type === 'Artifact',
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });
});

// ============================================================================
// OwnerCheck Tests
// ============================================================================

describe('OwnerCheck Precondition', () => {
  it('should pass when entity is owned by actor', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1);

    const precondition = new OwnerCheck({
      entity: EntityResolvers.target,
      expectedOwner: EntityResolvers.actor,
      ownerComponent: OWNER_COMPONENT,
      ownerProperty: 'owner',
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when entity is not owned by actor', () => {
    const { state, player1, player2, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player2); // Owned by player2

    const precondition = new OwnerCheck({
      entity: EntityResolvers.target,
      expectedOwner: EntityResolvers.actor,
      ownerComponent: OWNER_COMPONENT,
      ownerProperty: 'owner',
    });

    const ctx = createContext(state, player1, [card]); // Actor is player1
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should invert check when configured', () => {
    const { state, player1, player2, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player2);

    const precondition = new OwnerCheck({
      entity: EntityResolvers.target,
      expectedOwner: EntityResolvers.actor,
      ownerComponent: OWNER_COMPONENT,
      ownerProperty: 'owner',
      invert: true, // Check that entity is NOT owned by actor
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true); // Card is owned by player2, not player1
  });
});

// ============================================================================
// TargetCount Tests
// ============================================================================

describe('TargetCount Precondition', () => {
  it('should pass with exact target count', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card1 = createCard(coordinator, zone1, player1);
    const card2 = createCard(coordinator, zone1, player1);

    const precondition = new TargetCount({ exact: 2 });

    const ctx = createContext(state, player1, [card1, card2]);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail with wrong exact target count', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card1 = createCard(coordinator, zone1, player1);

    const precondition = new TargetCount({ exact: 2 });

    const ctx = createContext(state, player1, [card1]);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should check min and max', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card1 = createCard(coordinator, zone1, player1);
    const card2 = createCard(coordinator, zone1, player1);

    const precondition = new TargetCount({ min: 1, max: 3 });

    const ctx = createContext(state, player1, [card1, card2]);
    expect(precondition.check(ctx)).toBe(true);
  });
});

// ============================================================================
// EntityExists Tests
// ============================================================================

describe('EntityExists Precondition', () => {
  it('should pass when entity exists with required component', () => {
    const { state, player1, zone1 } = createTestState();
    const coordinator = state.coordinator;

    const card = createCard(coordinator, zone1, player1);

    const precondition = new EntityExists({
      entity: EntityResolvers.target,
      requiredComponent: CARD_COMPONENT,
    });

    const ctx = createContext(state, player1, [card]);
    expect(precondition.check(ctx)).toBe(true);
  });

  it('should fail when entity does not have required component', () => {
    const { state, player1 } = createTestState();
    const coordinator = state.coordinator;

    // Create entity without CARD_COMPONENT
    const entity = coordinator.createEntity();

    const precondition = new EntityExists({
      entity: EntityResolvers.target,
      requiredComponent: CARD_COMPONENT,
    });

    const ctx = createContext(state, player1, [entity]);
    expect(precondition.check(ctx)).toBe(false);
  });

  it('should pass without required component if entity exists', () => {
    const { state, player1 } = createTestState();
    const coordinator = state.coordinator;

    const entity = coordinator.createEntity();

    const precondition = new EntityExists({
      entity: EntityResolvers.target,
    });

    const ctx = createContext(state, player1, [entity]);
    expect(precondition.check(ctx)).toBe(true);
  });
});
