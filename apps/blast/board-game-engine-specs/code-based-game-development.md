# Code-Based Game Development Guide

This guide explains how to build board games directly in TypeScript code, without using the GUI Game Definition Builder. This approach gives you full programmatic control and is ideal for complex games or when you need custom logic.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Setup](#project-setup)
3. [Core Concepts](#core-concepts)
4. [Step-by-Step: Building a Game](#step-by-step-building-a-game)
5. [Components](#components)
6. [Actions](#actions)
7. [Preconditions](#preconditions)
8. [Effects](#effects)
9. [Phases](#phases)
10. [Rules](#rules)
11. [Putting It All Together](#putting-it-all-together)
12. [Running Your Game](#running-your-game)
13. [Best Practices](#best-practices)

---

## Overview

The board game engine is built on top of an Entity Component System (ECS). Games are defined by:

- **Components**: Data attached to entities (cards, players, zones)
- **Actions**: What players can do (draw card, play card, attack)
- **Preconditions**: Conditions that must be true for an action to be valid
- **Effects**: State changes that happen when an action executes
- **Phases**: Game flow stages (upkeep, main, combat, end)
- **Rules**: Event-driven logic that triggers automatically

---

## Project Setup

### File Structure

Create a folder for your game under `src/games/`:

```
src/games/my-game/
├── index.ts           # Exports
├── components.ts      # ECS component definitions
├── actions.ts         # Player actions
├── game-definition.ts # Game setup and configuration
└── rules.ts           # (Optional) Event-driven rules
```

### Required Imports

```typescript
// ECS
import {
    ComponentName,
    Coordinator,
    Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

// Board Game Engine
import {
    ActionDefinition,
    AndPrecondition,
    CompositeEffect,
    CustomEffect,
    CustomPrecondition,
    EmitEvent,
    GameEngine,
    GameState,
    IsPlayerTurn,
    NotPrecondition,
    OrPrecondition,
    PhaseCheck,
} from '../../board-game-engine';
import type {
    ActionContext,
    GameDefinition,
    PhaseDefinition,
    Rule,
} from '../../board-game-engine';
// Core components (reuse these)
import {
    PLAYER_COMPONENT,
    ZONE_COMPONENT,
} from '../../board-game-engine/core/game-state';
```

---

## Core Concepts

### Entities

Everything in the game is an entity: players, cards, zones, tokens. Entities are just IDs - they have no data by themselves.

```typescript
const card = coordinator.createEntity();
const player = coordinator.createEntity();
const handZone = coordinator.createEntity();
```

### Components

Components are data bags attached to entities. Define them with interfaces:

```typescript
export interface CardComponent {
    name: string;
    cost: number;
    power: number;
}

export const CARD_COMPONENT: ComponentName = createGlobalComponentName('Card');
```

### GameState

The `GameState` class wraps the ECS coordinator and provides game-specific functionality:

```typescript
const state = new GameState(coordinator);
state.setCurrentPhase('Main');
state.setActivePlayer(player1);
state.setTurnNumber(1);
```

---

## Step-by-Step: Building a Game

### 1. Define Components (`components.ts`)

```typescript
import {
    ComponentName,
    Coordinator,
    Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

// ============================================================================
// Card Component
// ============================================================================

export const CARD_COMPONENT: ComponentName = createGlobalComponentName('Card');

export interface CardComponent {
    name: string;
    cardType: 'Creature' | 'Spell';
    cost: number;
    power?: number;
    toughness?: number;
}

// ============================================================================
// Resource Component (for players)
// ============================================================================

export const RESOURCE_COMPONENT: ComponentName =
    createGlobalComponentName('Resource');

export interface ResourceComponent {
    mana: number;
    maxMana: number;
    health: number;
    maxHealth: number;
}

// ============================================================================
// Owner Component
// ============================================================================

export const OWNER_COMPONENT: ComponentName =
    createGlobalComponentName('Owner');

export interface OwnerComponent {
    owner: Entity;
}

// ============================================================================
// Location Component
// ============================================================================

export const LOCATION_COMPONENT: ComponentName =
    createGlobalComponentName('Location');

export interface LocationComponent {
    location: Entity; // The zone entity this is in
    sortIndex: number;
}

// ============================================================================
// Register Components
// ============================================================================

export function registerGameComponents(coordinator: Coordinator): void {
    coordinator.registerComponent<CardComponent>(CARD_COMPONENT);
    coordinator.registerComponent<ResourceComponent>(RESOURCE_COMPONENT);
    coordinator.registerComponent<OwnerComponent>(OWNER_COMPONENT);
    coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
}

// ============================================================================
// Helper Functions
// ============================================================================

export function isCard(coordinator: Coordinator, entity: Entity): boolean {
    return coordinator.getComponentFromEntity(CARD_COMPONENT, entity) !== null;
}

export function getOwner(
    coordinator: Coordinator,
    entity: Entity
): Entity | null {
    const ownerComp = coordinator.getComponentFromEntity<OwnerComponent>(
        OWNER_COMPONENT,
        entity
    );
    return ownerComp?.owner ?? null;
}
```

### 2. Define Actions (`actions.ts`)

Actions are what players can do. Each action has:

- **name**: Unique identifier
- **preconditions**: Checks that must pass
- **costs**: Effects applied before main effects (if any fail, action is cancelled)
- **effects**: Main state changes
- **targetSelector**: Function that returns valid target combinations
- **parameterGenerator**: Function that returns valid parameter combinations

```typescript
import type { Entity } from '@ue-too/ecs';

import { ActionDefinition } from '../../board-game-engine/action-system/action-definition';
import {
    CustomEffect,
    EmitEvent,
} from '../../board-game-engine/action-system/effects';
import {
    CustomPrecondition,
    IsPlayerTurn,
    PhaseCheck,
} from '../../board-game-engine/action-system/preconditions';
import {
    CARD_COMPONENT,
    type CardComponent,
    LOCATION_COMPONENT,
    RESOURCE_COMPONENT,
    type ResourceComponent,
    ZONE_COMPONENT,
    getOwner,
    isCard,
} from './components';

// ============================================================================
// Helper: Get cards in a zone
// ============================================================================

function getCardsInZone(
    ctx: { state: any },
    zoneName: string,
    owner: Entity
): Entity[] {
    const coordinator = ctx.state.coordinator;
    const cards: Entity[] = [];

    for (const entity of coordinator.getAllEntities()) {
        if (!isCard(coordinator, entity)) continue;

        const locationComp = coordinator.getComponentFromEntity(
            LOCATION_COMPONENT,
            entity
        );
        if (!locationComp) continue;

        const zoneComp = coordinator.getComponentFromEntity(
            ZONE_COMPONENT,
            locationComp.location
        );
        if (zoneComp?.name === zoneName && zoneComp?.owner === owner) {
            cards.push(entity);
        }
    }

    return cards;
}

// ============================================================================
// PlayCard Action
// ============================================================================

export const playCardAction = new ActionDefinition({
    name: 'PlayCard',

    preconditions: [
        // Must be your turn
        new IsPlayerTurn(),

        // Must be in Main phase
        new PhaseCheck(['Main']),

        // Must have a target
        new CustomPrecondition(
            ctx => ctx.targets.length === 1,
            'Must select a card to play'
        ),

        // Target must be a card in your hand
        new CustomPrecondition(ctx => {
            const card = ctx.targets[0];
            const locationComp = ctx.state.coordinator.getComponentFromEntity(
                LOCATION_COMPONENT,
                card
            );
            if (!locationComp) return false;

            const zoneComp = ctx.state.coordinator.getComponentFromEntity(
                ZONE_COMPONENT,
                locationComp.location
            );
            return zoneComp?.name === 'hand' && zoneComp?.owner === ctx.actor;
        }, 'Card must be in your hand'),

        // Must have enough mana
        new CustomPrecondition(
            ctx => {
                const card = ctx.targets[0];
                const cardComp =
                    ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                        CARD_COMPONENT,
                        card
                    );
                const resources =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );

                return (resources?.mana ?? 0) >= (cardComp?.cost ?? 0);
            },
            ctx => {
                const cardComp =
                    ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                        CARD_COMPONENT,
                        ctx.targets[0]
                    );
                const resources =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );
                return `Not enough mana (need ${cardComp?.cost ?? 0}, have ${resources?.mana ?? 0})`;
            }
        ),
    ],

    costs: [
        // Pay mana cost
        new CustomEffect(ctx => {
            const card = ctx.targets[0];
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            const resources =
                ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    ctx.actor
                );

            if (cardComp && resources) {
                resources.mana -= cardComp.cost;
            }
        }),
    ],

    effects: [
        // Direct effect: Move card from hand to board (immediate state change)
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const card = ctx.targets[0];

            // Find the board zone for this player
            for (const entity of coordinator.getAllEntities()) {
                const zoneComp = coordinator.getComponentFromEntity(
                    ZONE_COMPONENT,
                    entity
                );
                if (
                    zoneComp?.name === 'board' &&
                    zoneComp?.owner === ctx.actor
                ) {
                    const locationComp = coordinator.getComponentFromEntity(
                        LOCATION_COMPONENT,
                        card
                    );
                    if (locationComp) {
                        locationComp.location = entity; // State changed immediately
                    }
                    break;
                }
            }
        }),

        // Event effect: Emit event for reactive rules (processed after action)
        new EmitEvent('CardPlayed', ctx => {
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return {
                playerId: ctx.actor,
                cardId: ctx.targets[0],
                cardName: cardComp?.name ?? 'Unknown',
            };
        }),
    ],

    targetSelector: (state, actor) => {
        // Return all cards in hand that player can afford
        const cardsInHand = getCardsInZone({ state }, 'hand', actor);
        const resources =
            state.coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                actor
            );
        const mana = resources?.mana ?? 0;

        return cardsInHand
            .filter(card => {
                const cardComp =
                    state.coordinator.getComponentFromEntity<CardComponent>(
                        CARD_COMPONENT,
                        card
                    );
                return (cardComp?.cost ?? 0) <= mana;
            })
            .map(card => [card]); // Each card is a separate target option
    },

    parameterGenerator: () => [{}], // No parameters needed

    metadata: {
        displayName: 'Play Card',
        description: 'Play a card from your hand to the board',
    },
});

// ============================================================================
// EndTurn Action
// ============================================================================

export const endTurnAction = new ActionDefinition({
    name: 'EndTurn',

    preconditions: [new IsPlayerTurn()],

    costs: [],

    effects: [
        // Direct effect: Switch to next player (immediate state change)
        new CustomEffect(ctx => {
            // Switch to next player
            const players = ctx.state.getAllPlayers();
            const currentIndex = players.indexOf(ctx.state.activePlayer!);
            const nextIndex = (currentIndex + 1) % players.length;
            ctx.state.setActivePlayer(players[nextIndex]); // State changed immediately

            // Increment turn if wrapped around
            if (nextIndex === 0) {
                ctx.state.setTurnNumber(ctx.state.turnNumber + 1);
            }
        }),

        // Event effect: Emit event for reactive rules (e.g., rules that respond to turn ending)
        new EmitEvent('TurnEnded', ctx => ({
            playerId: ctx.actor,
            turnNumber: ctx.state.turnNumber,
        })),
    ],

    targetSelector: () => [[]], // No targets
    parameterGenerator: () => [{}],

    metadata: {
        displayName: 'End Turn',
        description: 'End your turn',
    },
});

// ============================================================================
// Export all actions
// ============================================================================

export const gameActions = [playCardAction, endTurnAction];
```

### 3. Define Game Setup (`game-definition.ts`)

```typescript
import { Coordinator, Entity } from '@ue-too/ecs';

import {
    GameState,
    PLAYER_COMPONENT,
    ZONE_COMPONENT,
} from '../../board-game-engine/core/game-state';
import type {
    PlayerComponent,
    ZoneComponent,
} from '../../board-game-engine/core/game-state';
import type { PhaseDefinition, Rule } from '../../board-game-engine/core/types';
import {
    type GameDefinition,
    GameEngine,
} from '../../board-game-engine/game-engine';
import { gameActions } from './actions';
import {
    CARD_COMPONENT,
    type CardComponent,
    LOCATION_COMPONENT,
    type LocationComponent,
    OWNER_COMPONENT,
    type OwnerComponent,
    RESOURCE_COMPONENT,
    type ResourceComponent,
    registerGameComponents,
} from './components';

// ============================================================================
// Card Definitions
// ============================================================================

interface CardDef {
    name: string;
    cardType: 'Creature' | 'Spell';
    cost: number;
    power?: number;
    toughness?: number;
}

const STARTER_DECK: CardDef[] = [
    { name: 'Goblin', cardType: 'Creature', cost: 1, power: 1, toughness: 1 },
    { name: 'Goblin', cardType: 'Creature', cost: 1, power: 1, toughness: 1 },
    { name: 'Knight', cardType: 'Creature', cost: 2, power: 2, toughness: 2 },
    { name: 'Knight', cardType: 'Creature', cost: 2, power: 2, toughness: 2 },
    { name: 'Dragon', cardType: 'Creature', cost: 5, power: 5, toughness: 5 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function createZone(
    coordinator: Coordinator,
    name: string,
    owner: Entity | null,
    visibility: 'public' | 'private' | 'owner-only'
): Entity {
    const zone = coordinator.createEntity();
    coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone, {
        name,
        owner,
        visibility,
    });
    return zone;
}

function createCard(
    coordinator: Coordinator,
    def: CardDef,
    owner: Entity,
    zone: Entity,
    sortIndex: number
): Entity {
    const card = coordinator.createEntity();

    coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, card, {
        name: def.name,
        cardType: def.cardType,
        cost: def.cost,
        power: def.power,
        toughness: def.toughness,
    });

    coordinator.addComponentToEntity<OwnerComponent>(OWNER_COMPONENT, card, {
        owner,
    });

    coordinator.addComponentToEntity<LocationComponent>(
        LOCATION_COMPONENT,
        card,
        {
            location: zone,
            sortIndex,
        }
    );

    return card;
}

function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// ============================================================================
// Initial State Creation
// ============================================================================

function createInitialState(): GameState {
    const coordinator = new Coordinator();

    // Register components
    registerGameComponents(coordinator);
    coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT);
    coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

    const state = new GameState(coordinator);

    // Create players
    const players: Entity[] = [];

    for (let i = 0; i < 2; i++) {
        const player = coordinator.createEntity();

        coordinator.addComponentToEntity<PlayerComponent>(
            PLAYER_COMPONENT,
            player,
            {
                name: `Player ${i + 1}`,
                playerNumber: i,
            }
        );

        coordinator.addComponentToEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player,
            {
                mana: 1,
                maxMana: 10,
                health: 20,
                maxHealth: 20,
            }
        );

        players.push(player);

        // Create zones for this player
        const deckZone = createZone(coordinator, 'deck', player, 'owner-only');
        const handZone = createZone(coordinator, 'hand', player, 'owner-only');
        const boardZone = createZone(coordinator, 'board', player, 'public');
        const discardZone = createZone(
            coordinator,
            'discard',
            player,
            'public'
        );

        // Create shuffled deck
        const shuffledDeck = shuffle(STARTER_DECK);
        shuffledDeck.forEach((cardDef, index) => {
            createCard(coordinator, cardDef, player, deckZone, index);
        });

        // Draw starting hand (move 3 cards from deck to hand)
        // In a real implementation, you'd track cards in zones properly
    }

    // Set initial game state
    state.setCurrentPhase('Main');
    state.setTurnNumber(1);
    state.setActivePlayer(players[0]);

    return state;
}

// ============================================================================
// Phase Definitions
// ============================================================================

const phases: PhaseDefinition[] = [
    {
        name: 'Main',
        allowedActionTypes: ['PlayCard', 'EndTurn'],
        autoAdvance: false,
        nextPhase: 'Main',
        onEnter: state => {
            // Give active player +1 mana at start of turn
            const player = state.activePlayer;
            if (player) {
                const resources =
                    state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        player
                    );
                if (resources && resources.mana < resources.maxMana) {
                    resources.mana++;
                }
            }
        },
    },
];

// ============================================================================
// Rules (Optional)
// ============================================================================

const rules: Rule[] = [
    // Add event-driven rules here
];

// ============================================================================
// Game Creation
// ============================================================================

export function createMyGame(): GameEngine {
    const definition: GameDefinition = {
        name: 'My Card Game',
        actions: gameActions,
        rules: rules,
        phases: phases,
        createInitialState: createInitialState,
    };

    return new GameEngine(definition);
}
```

### 4. Export (`index.ts`)

```typescript
export * from './components';
export * from './actions';
export * from './game-definition';
```

---

## Preconditions

Preconditions validate whether an action can be executed.

### Built-in Preconditions

```typescript
import {
  IsPlayerTurn,
  PhaseCheck,
  HasComponent,
  AndPrecondition,
  OrPrecondition,
  NotPrecondition,
  CustomPrecondition,
  AlwaysTruePrecondition,
  AlwaysFalsePrecondition,
} from '../../board-game-engine';

// Check if it's the actor's turn
new IsPlayerTurn()

// Check current phase
new PhaseCheck(['Main', 'Combat'])

// Check entity has a component
new HasComponent(CARD_COMPONENT, 'target')  // 'target' or 'actor'

// Combine preconditions
new AndPrecondition([precond1, precond2])
new OrPrecondition([precond1, precond2])
new NotPrecondition(precond)

// Custom logic
new CustomPrecondition(
  (ctx) => ctx.targets.length === 1,
  'Must select exactly one target'
)

// Dynamic error message
new CustomPrecondition(
  (ctx) => /* check */,
  (ctx) => `Error: ${ctx.targets.length} targets selected`
)
```

### Custom Precondition Examples

```typescript
// Check mana
new CustomPrecondition(ctx => {
    const resources =
        ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            ctx.actor
        );
    return (resources?.mana ?? 0) >= 3;
}, 'Need at least 3 mana');

// Check target ownership
new CustomPrecondition(ctx => {
    const owner = getOwner(ctx.state.coordinator, ctx.targets[0]);
    return owner !== ctx.actor; // Must target opponent's card
}, 'Cannot target your own card');
```

---

## Effects

Effects modify game state when an action executes. There are two types:

1. **Direct Effects** - Modify state immediately (synchronous)
2. **Event-Generating Effects** - Create events that trigger rules (reactive)

### Built-in Effects

```typescript
import {
    CompositeEffect,
    CustomEffect,
    EmitEvent,
    NoOpEffect,
} from '../../board-game-engine';

// Direct state modification (happens immediately)
new CustomEffect(ctx => {
    const resources =
        ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            ctx.actor
        );
    if (resources) {
        resources.mana -= 3; // State changed immediately
    }
});

// Emit event for rule engine (triggers reactive rules)
new EmitEvent('CardPlayed', ctx => ({
    playerId: ctx.actor,
    cardId: ctx.targets[0],
}));

// Combine multiple effects (can mix direct and event effects)
new CompositeEffect([effect1, effect2, effect3]);

// Do nothing (placeholder)
new NoOpEffect();
```

**Key Points**:

- **Direct effects** (like `CustomEffect`) modify state immediately during action execution
- **Event effects** (like `EmitEvent`) create events that are processed after action execution to trigger rules
- Actions commonly have **both** - direct effects for immediate changes, and events for reactive logic
- Not all actions need to emit events - only when you want reactive rules to respond

### Effect Patterns

```typescript
// Move entity between zones
new CustomEffect(ctx => {
    const coordinator = ctx.state.coordinator;
    const card = ctx.targets[0];

    // Find destination zone
    const destZone = findZone(coordinator, 'board', ctx.actor);

    // Update location
    const location = coordinator.getComponentFromEntity<LocationComponent>(
        LOCATION_COMPONENT,
        card
    );
    if (location && destZone) {
        location.location = destZone;
    }
});

// Deal damage
new CustomEffect(ctx => {
    const target = ctx.targets[0];
    const resources =
        ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            target
        );
    if (resources) {
        resources.health -= ctx.parameters.damage as number;
    }
});

// Create new entity
new CustomEffect(ctx => {
    const coordinator = ctx.state.coordinator;
    const token = coordinator.createEntity();

    coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, token, {
        name: 'Token',
        cardType: 'Creature',
        cost: 0,
        power: 1,
        toughness: 1,
    });

    // Add to board...
});
```

---

## Phases

Phases control game flow and which actions are allowed.

```typescript
const phases: PhaseDefinition[] = [
    {
        name: 'Upkeep',
        allowedActionTypes: [], // No actions allowed
        autoAdvance: true, // Automatically advance to next phase
        nextPhase: 'Main',
        onEnter: state => {
            // Untap all permanents, draw a card, etc.
        },
        onExit: state => {
            // Cleanup
        },
    },
    {
        name: 'Main',
        allowedActionTypes: ['PlayCard', 'ActivateAbility'],
        autoAdvance: false, // Wait for player to pass
        nextPhase: 'Combat',
    },
    {
        name: 'Combat',
        allowedActionTypes: ['DeclareAttackers', 'DeclareBlockers'],
        autoAdvance: false,
        nextPhase: 'End',
    },
    {
        name: 'End',
        allowedActionTypes: ['EndTurn'],
        autoAdvance: false,
        nextPhase: 'Upkeep', // Next player's upkeep
    },
];
```

---

## Rules

Rules react to **events** (not direct action effects) and execute effects automatically. Rules enable reactive, decoupled game logic.

**Important**: Rules are triggered by events emitted from actions, not by direct state changes. If an action only has direct effects (like `CustomEffect`), no rules will trigger. Use `EmitEvent` in your action effects if you want rules to react.

```typescript
import { EventPattern } from '../../board-game-engine';
import type { Rule } from '../../board-game-engine/core/types';

const rules: Rule[] = [
    {
        id: 'draw-on-turn-start',
        trigger: new EventPattern({
            eventType: 'TurnStarted',
            filters: {},
        }),
        conditions: [],
        effects: [
            new CustomEffect(ctx => {
                // Draw a card for active player
                drawCard(ctx.state, ctx.state.activePlayer!);
            }),
        ],
        priority: 100, // Higher = earlier
        source: null, // Global rule (not attached to specific entity)
    },

    {
        id: 'check-win-condition',
        trigger: new EventPattern({
            eventType: 'HealthChanged',
            filters: {},
        }),
        conditions: [],
        effects: [
            new CustomEffect(ctx => {
                // Check if any player has 0 health
                for (const player of ctx.state.getAllPlayers()) {
                    const resources =
                        ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                            RESOURCE_COMPONENT,
                            player
                        );
                    if (resources && resources.health <= 0) {
                        // Game over!
                        ctx.state.addEvent({
                            type: 'GameOver',
                            data: { loser: player },
                            timestamp: Date.now(),
                            id: `event-${Date.now()}`,
                        });
                    }
                }
            }),
        ],
        priority: 50,
        source: null,
    },
];
```

---

## Putting It All Together

```typescript
// game-definition.ts
import { type GameDefinition, GameEngine } from '../../board-game-engine';

export function createMyGame(): GameEngine {
    const definition: GameDefinition = {
        name: 'My Awesome Card Game',
        actions: gameActions, // From actions.ts
        rules: rules, // From rules.ts
        phases: phases, // Defined above
        createInitialState, // Function that creates GameState
    };

    return new GameEngine(definition);
}
```

---

## Running Your Game

### In React

```typescript
import React, { useState, useEffect } from 'react';
import { createMyGame } from '../games/my-game';

function GamePage() {
  const [engine, setEngine] = useState(() => createMyGame());
  const [, forceUpdate] = useState({});

  const state = engine.getState();
  const actionSystem = engine.getActionSystem();

  const executeAction = (actionType: string, targetIds: Entity[] = []) => {
    const action = {
      type: actionType,
      actorId: state.activePlayer!,
      targetIds,
      parameters: {},
    };

    if (actionSystem.isActionValid(action)) {
      actionSystem.executeAction(action);
      forceUpdate({});  // Re-render
    } else {
      console.error('Invalid action:', actionSystem.getValidationError(action));
    }
  };

  return (
    <div>
      <h1>Turn {state.turnNumber}</h1>
      <button onClick={() => executeAction('EndTurn')}>End Turn</button>
      {/* Render game UI */}
    </div>
  );
}
```

### Getting Valid Actions

```typescript
const validActions = actionSystem.getValidActions(state.activePlayer!);

for (const action of validActions) {
    console.log(`Can execute: ${action.type} with targets:`, action.targetIds);
}
```

### Checking Action Validity

```typescript
const action = {
    type: 'PlayCard',
    actorId: player,
    targetIds: [cardEntity],
    parameters: {},
};

if (actionSystem.isActionValid(action)) {
    actionSystem.executeAction(action);
} else {
    const error = actionSystem.getValidationError(action);
    console.error('Cannot play card:', error);
}
```

---

## Best Practices

### 1. Keep Components Pure Data

Components should only contain data, no methods:

```typescript
// Good
interface CardComponent {
    name: string;
    cost: number;
}

// Bad
interface CardComponent {
    name: string;
    cost: number;
    canPlay(): boolean; // Don't do this
}
```

### 2. Use Helper Functions

Create helper functions for common queries:

```typescript
function getCardsInZone(
    coordinator: Coordinator,
    zoneName: string,
    owner: Entity
): Entity[] {
    // ...
}

function getPlayerMana(coordinator: Coordinator, player: Entity): number {
    // ...
}
```

### 3. Use Events for Reactive Logic

Emit events when you want rules to react to changes. Direct effects are fine for immediate state changes:

```typescript
// Direct effects for immediate state changes
effects: [
    new CustomEffect(ctx => {
        // Modify state immediately (e.g., move card, pay mana)
        moveCard(ctx);
    }),
];

// Emit events when you want reactive rules to respond
effects: [
    new CustomEffect(ctx => {
        // Direct state change
        moveCard(ctx);
    }),
    new EmitEvent('CardPlayed', ctx => ({
        // Event data for rules to react
        playerId: ctx.actor,
        cardId: ctx.targets[0],
    })),
];
```

**When to use events**:

- When you want rules to react to the action (e.g., "when a card is played, draw a card")
- When multiple systems need to know about a change
- For decoupled reactive logic

**When direct effects are enough**:

- Simple state changes that don't need reactive responses
- Resource management (paying costs, moving entities)
- Immediate game state updates

### 4. Validate Early with Preconditions

Put validation in preconditions, not effects:

```typescript
// Good
preconditions: [
  new CustomPrecondition(ctx => hasEnoughMana(ctx), 'Not enough mana'),
],
effects: [
  new CustomEffect(ctx => spendMana(ctx)),  // Safe to assume mana is available
]

// Bad
effects: [
  new CustomEffect(ctx => {
    if (!hasEnoughMana(ctx)) return;  // Don't check here
    spendMana(ctx);
  }),
]
```

### 5. Use TypeScript Generics

Leverage TypeScript for type safety:

```typescript
const cardComp = coordinator.getComponentFromEntity<CardComponent>(
    CARD_COMPONENT,
    entity
);
// cardComp is CardComponent | null, fully typed
```

---

## Reference: Simple Card Game

For a complete working example, see:

- `src/games/simple-card-game/components.ts` - Component definitions
- `src/games/simple-card-game/actions.ts` - All player actions
- `src/games/simple-card-game/game-definition.ts` - Game setup
- `src/pages/CardGamePage.tsx` - React UI integration

---

## Next Steps

1. Copy the simple-card-game folder as a template
2. Modify components for your game
3. Add your custom actions
4. Define phases for your game flow
5. Add rules for automated game logic
6. Build a UI to interact with the engine

For questions or issues, see the [implementation guide](./implementation-guide.md).
