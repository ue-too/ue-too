# Board Game Rule Engine - Implementation Guide

**Status**: ✅ MVP Complete
**Date**: January 2026
**Version**: 1.0.0

---

## Table of Contents

1. [What Was Implemented](#what-was-implemented)
2. [Architecture Overview](#architecture-overview)
3. [Navigating the Codebase](#navigating-the-codebase)
4. [Key Concepts](#key-concepts)
5. [How to Extend the Engine](#how-to-extend-the-engine)
6. [Future Directions](#future-directions)
7. [Maintenance Guide](#maintenance-guide)

---

## What Was Implemented

### Core Systems (All 4 Complete)

#### 1. **Action System** (`src/board-game-engine/action-system/`)
The action system handles player intents and validates/executes them.

**Components**:
- `ActionDefinition` - Templates for action types (e.g., "PlayCard", "EndTurn")
- `ActionContext` - Bridges actions with ECS operations
- `Precondition` - Conditions that must be true for actions to execute
- `Effect` - State modifications that actions perform
- `ActionSystem` - Validates and executes actions

**Built-in Preconditions**:
- `IsPlayerTurn` - Check if it's the actor's turn
- `HasComponent` - Verify entity has a component
- `PhaseCheck` - Ensure current phase allows the action
- `AndPrecondition`, `OrPrecondition`, `NotPrecondition` - Logical combinators
- `CustomPrecondition` - Define custom logic

**Built-in Effects**:
- `ECSEffect` - Base class for effects that modify components
- `EmitEvent` - Generate events for the rule engine
- `CustomEffect` - Define custom state modifications
- `CompositeEffect` - Chain multiple effects together

#### 2. **Event System** (`src/board-game-engine/event-system/`)
Handles game events and enables event-driven rules.

**Components**:
- `Event` - Immutable records of what happened (e.g., "CardPlayed")
- `EventPattern` - Patterns for matching specific events
- `EventQueue` - FIFO queue with cycle detection
- `EventProcessor` - Processes events and triggers rules

**Features**:
- Pattern matching with filters (equality and predicates)
- Infinite loop detection (prevents runaway rule triggers)
- Event history tracking
- Priority-based event processing

#### 3. **Rule Engine** (`src/board-game-engine/rule-engine/`)
Executes game logic in response to events.

**Components**:
- `Rule` - Defines trigger patterns, conditions, and effects
- `RuleContext` - Context for rule evaluation
- `Condition` - Additional checks beyond event matching
- `RuleEngine` - Processes rules when events occur

**Features**:
- Priority-based rule execution (higher priority = earlier)
- Entity-specific rules (rules attached to specific cards/entities)
- Global rules (apply to all events)
- Composable conditions

#### 4. **Phase System** (`src/board-game-engine/phase-system/`)
Manages game flow through different phases.

**Components**:
- `PhaseDefinition` - Templates for phase types (e.g., "Upkeep", "Main", "Combat")
- `Phase` - Current phase state
- `PhaseManager` - Handles phase transitions and lifecycle

**Features**:
- Auto-advancing phases (e.g., "Upkeep" → "Main")
- Phase-specific action restrictions
- OnEnter/OnExit hooks for phase-specific logic
- Nested sub-phases support

### ECS Integration

**Key Design Decision**: ECS as Primary Game State
- All game state lives in ECS entities and components
- `GameState` class wraps the @ue-too/ecs `Coordinator`
- Game metadata stored in a `GameManager` entity with a component
- Snapshot-based immutability (ECS remains mutable internally)

**Core Components Defined**:
- `GameManagerComponent` - Stores phase, turn, active player, event queue
- `PlayerComponent` - Identifies player entities
- `ZoneComponent` - Represents game zones (hand, deck, board, etc.)
- `CardComponent` - Card data (name, type, cost, power, toughness)
- `ResourceComponent` - Player resources (mana, health)
- `OwnerComponent` - Tracks entity ownership
- `CardStateComponent` - Card state (tapped, summoning sickness)
- `GameStatusComponent` - Win/loss conditions

### Simple Card Game Demo

A 2-player card game demonstrating the full engine capabilities:

**Game Rules**:
- 2 players, each with mana (1-10) and health (20)
- Each player starts with a 10-card deck and draws 3 cards
- Gain +1 mana at the start of each turn (up to 10 max)
- Draw 1 card per turn, play cards by paying mana cost
- Creatures have summoning sickness (can't attack on first turn)
- Attack enemy creatures or the opponent directly to win

**Implemented Actions**:
- `DrawCard` - Draw top card from deck to hand (1 per turn)
- `PlayCard` - Play card from hand to board (pays mana cost)
- `AttackCreature` - Attack enemy creature (mutual damage)
- `AttackPlayer` - Attack opponent directly (reduce health)
- `ActivateAbility` - Activate card abilities
- `EndTurn` - Pass to next player, increment turn counter

**Components**:
- `CardComponent` - Card data (name, type, cost, power, toughness)
- `ResourceComponent` - Player resources (mana, health)
- `CardStateComponent` - Card state (tapped, summoning sickness)
- `TurnStateComponent` - Per-turn state (hasDrawnThisTurn)
- `OwnerComponent` - Tracks entity ownership
- `LocationComponent` - Tracks which zone a card is in

**File Location**: `src/games/simple-card-game/`
**Player Manual**: `docs/simple-card-game-manual.md`

### React UI

A fully interactive interface for the board game engine.

**Features**:
- Display game status (turn, phase, active player)
- Show both players' stats (health, mana, deck size)
- Card display with cost, power/toughness, and status (tapped, sick)
- Card selection (click to select cards in hand or on board)
- Action buttons: Draw Card, Play Selected, Attack Creature, End Turn
- Attack Player button on opponent panel (when creature selected)
- Attack mode with target selection for creature combat
- Visual feedback (green border for selected, rotation for tapped)
- Engine info panel showing valid actions

**File Location**: `src/pages/CardGamePage.tsx`

**Access**: Navigate to http://localhost:5174/card-game after running `bunx nx dev blast`

### JSON Schema-Based Game Definitions

A declarative system for defining board games in JSON without writing TypeScript code.

**Components**:
- `GameDefinitionSchema` - Complete game definition structure
- `ExpressionResolver` - Resolves dynamic expressions like `$actor`, `$target`, `$component.$target.Card.cost`
- `ActionFactory` - Creates action definitions from JSON
- `EffectFactory` - Creates effects from JSON
- `PreconditionFactory` - Creates preconditions from JSON
- `GameDefinitionLoader` - Loads JSON and creates playable games

**Expression Language**:
- `$actor` - The player performing the action
- `$target` / `$target.0` - Target entity at index
- `$activePlayer` - Currently active player
- `$param.<name>` - Action parameter value
- `$component.$entity.Component.property` - Component property access
- `$zone.actor.hand` / `$zone.opponent.board` - Zone references
- `$negate(value)`, `$add(a, b)`, `$multiply(a, b)` - Math operations

**Condition Types**:
- `isPlayerTurn` - Check if it's the actor's turn
- `phaseCheck` - Check current phase
- `resourceCheck` - Check numeric resource with operators
- `entityInZone` - Check entity location
- `componentValueCheck` - Check component property
- `ownerCheck` - Check entity ownership
- `zoneHasEntities` - Check zone contents
- `hasComponent` - Check entity has component
- `and`, `or`, `not` - Logical combinators

**Effect Types**:
- `moveEntity` - Move entity between zones
- `modifyResource` - Add/subtract numeric resources
- `setComponentValue` - Set component properties
- `createEntity` - Spawn new entities
- `destroyEntity` - Remove entities
- `shuffleZone` - Shuffle zone contents
- `transferMultiple` - Move multiple entities
- `conditional` - If/else effects
- `repeat` - Repeat effects
- `emitEvent` - Emit game events
- `composite` - Chain effects

**File Locations**:
- Schema types: `src/board-game-engine/schema/types.ts`
- Expression resolver: `src/board-game-engine/schema/expression-resolver.ts`
- Factories: `src/board-game-engine/schema/factories/`
- JSON Schema: `src/board-game-engine/schema/json-schema/game-definition.schema.json`
- Example game: `src/games/simple-card-game/simple-card-game.json`

**Tests**: `src/board-game-engine/schema/__tests__/expression-resolver.test.ts` (26 tests)

### Game Definition Builder GUI

A visual tool for creating board game definitions without writing JSON manually.

**Features**:
- Tab-based navigation: Metadata, Components, Zones, Templates, Actions, Phases, Setup
- Split-panel layout with live JSON preview
- Load/Save JSON files
- Load example game (simple-card-game.json)
- Copy to clipboard
- Basic validation
- Visual condition builder for preconditions
- Visual effect builder for action effects and costs

**Sections**:
1. **Metadata** - Game name, version, author, description, player count, complexity, tags
2. **Components** - Define component types with properties (type, default value)
3. **Zones** - Define game zones with visibility (public/owner-only/private) and ordering
4. **Templates** - Create entity templates with component instances and values
5. **Actions** - Define actions with preconditions, costs, and effects using visual builders
6. **Phases** - Define phases with allowed actions, next phase, auto-advance
7. **Setup** - Player count, player template, zones, starting entities

**Visual Condition Builder**:
Supports all 13 condition types with dropdown-based editing:
- Basic: `isPlayerTurn`, `phaseCheck`, `hasComponent`
- Resource/Value checks: `resourceCheck`, `componentValueCheck`
- Entity checks: `entityInZone`, `ownerCheck`, `entityExists`
- Zone checks: `zoneHasEntities`, `targetCount`
- Logical combinators: `AND`, `OR`, `NOT` (with nesting up to 3 levels)

Features entity/zone dropdowns (`$actor`, `$target`, `$zone.actor.hand`, etc.), component selection from defined components, operator selection, and expression value support.

**Visual Effect Builder**:
Supports 7 effect types with visual editing:
- `moveEntity` - Move entities between zones
- `modifyResource` - Add/subtract numeric values
- `setComponentValue` - Set component properties
- `shuffleZone` - Shuffle zone contents
- `transferMultiple` - Move multiple entities (top/bottom/random selection)
- `emitEvent` - Emit game events with JSON data
- `conditional` - If/then/else with nested conditions and effects

Features reordering with up/down buttons, nested effect support, and expression value support.

**File Location**: `src/components/GameDefinitionBuilder/index.tsx`

**Access**: Navigate to "Game Builder" in the navigation after running `bunx nx dev blast`

---

## Architecture Overview

### High-Level Flow

```
Player Input → Action → Validation (Preconditions) → Execution (Effects)
                                                           ↓
                                                       Events Emitted
                                                           ↓
                                                    Rule Engine Processes
                                                           ↓
                                                    More Effects/Events
                                                           ↓
                                                    Phase Manager Checks
                                                           ↓
                                                     UI Re-renders
```

### Data Flow

1. **Player Intent**: User clicks "End Turn" button in React UI
2. **Action Creation**: UI creates an `Action` object
3. **Validation**: `ActionSystem.isActionValid()` checks preconditions
4. **Execution**: `ActionSystem.executeAction()` applies costs and effects
5. **Events**: Effects emit events (e.g., "TurnEnded")
6. **Rules**: `RuleEngine.processEvent()` triggers matching rules
7. **Cascading**: Rule effects may emit more events (event chain)
8. **Phase Check**: `PhaseManager` checks if phase should advance
9. **State Update**: React component re-renders with new state

### ECS Integration Pattern

```typescript
// GameState wraps Coordinator
class GameState {
  readonly coordinator: Coordinator;  // The actual ECS
  private gameManagerEntity: Entity;  // Holds metadata

  // Convenience accessors
  get currentPhase(): string { /* read from component */ }
  setCurrentPhase(phase: string): void { /* write to component */ }
}

// ActionContext bridges actions and ECS
class ActionContext {
  constructor(
    public state: GameState,
    public action: Action,
    public actor: Entity,
    public targets: Entity[]
  ) {}

  // Helpers for ECS operations
  getComponent<T>(name, entity): T | null
  setComponent<T>(name, entity, data): void
}

// Effects operate on ECS through context
class CustomEffect implements Effect {
  apply(context: ActionContext): void {
    // Modify ECS state
    const comp = context.getComponent(RESOURCE_COMPONENT, context.actor);
    comp.mana -= 3;
  }
}
```

### Immutability via Snapshots

```typescript
// Capture state before action
const snapshot = gameState.createSnapshot();

try {
  actionSystem.executeAction(action);
} catch (error) {
  // Restore on failure
  gameState.restoreSnapshot(snapshot);
}

// Snapshots use coordinator.serialize()
class GameStateSnapshot {
  private ecsState: any;  // Serialized ECS
  readonly metadata: GameMetadata;

  restore(coordinator: Coordinator): void {
    coordinator.deserialize(this.ecsState, { clearExisting: true });
  }
}
```

---

## Navigating the Codebase

### Directory Structure

```
apps/blast/src/
├── board-game-engine/              # Core engine (game-agnostic)
│   ├── core/                       # Fundamental types and state
│   │   ├── types.ts                # All interface definitions
│   │   ├── game-state.ts           # GameState wrapper around Coordinator
│   │   └── snapshot.ts             # Snapshot for immutability
│   │
│   ├── action-system/              # Player actions
│   │   ├── action-definition.ts    # Action templates
│   │   ├── action-context.ts       # Execution context
│   │   ├── action-system.ts        # Validation and execution
│   │   ├── resolvers.ts            # Shared resolver types and utilities
│   │   ├── preconditions/          # Pre-execution checks
│   │   │   ├── base.ts             # Base classes
│   │   │   ├── is-player-turn.ts
│   │   │   ├── has-component.ts
│   │   │   ├── phase-check.ts
│   │   │   ├── custom.ts
│   │   │   └── generic.ts          # Generic preconditions (ResourceCheck, etc.)
│   │   └── effects/                # State modifications
│   │       ├── base.ts
│   │       ├── emit-event.ts
│   │       ├── custom.ts
│   │       ├── composite.ts
│   │       ├── no-op.ts
│   │       └── generic.ts          # Generic effects (MoveEntity, etc.)
│   │
│   ├── event-system/               # Event handling
│   │   ├── event-pattern.ts        # Event matching
│   │   ├── event-queue.ts          # Queue with cycle detection
│   │   └── event-processor.ts      # Event processing
│   │
│   ├── rule-engine/                # Event-driven rules
│   │   ├── rule-context.ts         # Rule evaluation context
│   │   └── rule-engine.ts          # Rule processor
│   │
│   ├── phase-system/               # Game flow
│   │   └── phase-manager.ts        # Phase transitions
│   │
│   ├── schema/                     # JSON Schema-based definitions
│   │   ├── types.ts                # Schema type definitions
│   │   ├── expression-resolver.ts  # Dynamic expression resolution
│   │   ├── game-definition-loader.ts # Load JSON into playable games
│   │   ├── factories/              # Convert JSON to TypeScript objects
│   │   │   ├── action-factory.ts
│   │   │   ├── effect-factory.ts
│   │   │   └── precondition-factory.ts
│   │   ├── json-schema/            # JSON Schema files
│   │   │   └── game-definition.schema.json
│   │   └── __tests__/              # Schema tests
│   │       └── expression-resolver.test.ts
│   │
│   ├── game-engine.ts              # Main integration class
│   └── index.ts                    # Public exports
│
├── games/simple-card-game/         # Example game implementation
│   ├── components.ts               # Game-specific components
│   ├── game-definition.ts          # Complete game setup (TypeScript)
│   ├── simple-card-game.json       # JSON-based game definition
│   └── index.ts
│
├── components/                     # React components
│   ├── StateMachineBuilder.tsx     # State machine builder tool
│   ├── ObjectSchemaBuilder.tsx     # Object schema builder tool
│   └── GameDefinitionBuilder/      # Game definition builder
│       └── index.tsx               # Main builder component
│
└── pages/
    └── CardGamePage.tsx            # React UI for testing
```

### Key Entry Points

#### For Learning:
1. **Start here**: `board-game-engine/core/types.ts`
   - Read all interface definitions
   - Understand the type relationships
   - See JSDoc examples

2. **Then**: `games/simple-card-game/game-definition.ts`
   - See a complete game implementation
   - Understand how systems integrate
   - Copy patterns for your game

3. **Finally**: `board-game-engine/game-engine.ts`
   - See how all systems work together
   - Understand the initialization flow

#### For Implementing a Game:
1. **Define components**: Create `my-game/components.ts`
2. **Define actions**: Create `my-game/actions.ts`
3. **Define rules**: Create `my-game/rules.ts`
4. **Define phases**: Create `my-game/phases.ts`
5. **Tie it together**: Create `my-game/game-definition.ts`

#### For Extending the Engine:
1. **New precondition**: Add to `action-system/preconditions/`
2. **New effect**: Add to `action-system/effects/`
3. **New condition**: Add to `rule-engine/conditions/`
4. **Export it**: Update `index.ts` files

---

## Key Concepts

### 1. Actions vs Events vs Rules

**Actions** = Player Intent
- "I want to play this card"
- "I want to attack with this creature"
- Synchronous, validated before execution
- Can fail (preconditions not met)

**Events** = Historical Facts
- "A card was played"
- "A creature died"
- Immutable, always succeed
- Generated by effects

**Rules** = Reactive Logic
- "When a spell is cast, draw a card"
- "When a creature dies, deal 1 damage to its owner"
- Triggered by events
- Execute in priority order

### 2. Preconditions vs Conditions

**Preconditions** = Action Requirements
- Checked before action execution
- Block the action if false
- Example: "It must be your turn"

**Conditions** = Rule Requirements
- Checked after event matching
- Block rule execution if false
- Example: "Target must be a creature"

### 3. Costs vs Effects

**Costs** = Paid Before Effects
- Applied first, before main effects
- If cost fails, entire action fails
- Example: "Pay 3 mana"

**Effects** = Main Action Results
- Applied after costs succeed
- Can emit events
- Example: "Draw 2 cards"

### 4. Snapshot-Based Immutability

The ECS is mutable for performance, but we achieve immutability at boundaries:

```typescript
// Before risky operation
const snapshot = state.createSnapshot();

try {
  // Mutate ECS state
  executeAction(action);
  processEvents();
} catch (error) {
  // Rollback on failure
  state.restoreSnapshot(snapshot);
}
```

**When to Snapshot**:
- Before executing actions (for rollback)
- After each turn (for undo)
- Before AI simulation (for lookahead)

### 5. Event Cycle Detection

To prevent infinite loops:

```typescript
// EventQueue tracks event signatures
const signature = `${event.type}:${JSON.stringify(event.data)}`;

// If same event repeats too many times → throw error
if (count > MAX_CYCLES) {
  throw new InfiniteLoopError(signature, count);
}
```

**Design Tip**: Ensure rules don't trigger themselves!

---

## How to Extend the Engine

### Adding a New Action

**Example**: Add a "Draw Card" action

1. **Create the action definition**:

```typescript
// games/simple-card-game/actions.ts
import { ActionDefinition } from '@blast/board-game-engine';
import { IsPlayerTurn, CustomEffect, EmitEvent } from '@blast/board-game-engine';

export const drawCardAction = new ActionDefinition({
  name: 'DrawCard',

  preconditions: [
    new IsPlayerTurn(),
    // Custom check: deck not empty
    new CustomPrecondition(
      (ctx) => {
        const deck = getDeckEntities(ctx.state, ctx.actor);
        return deck.length > 0;
      },
      'Your deck is empty'
    ),
  ],

  costs: [], // No cost to draw

  effects: [
    new CustomEffect((ctx) => {
      // Move top card from deck to hand
      const deck = getDeckEntities(ctx.state, ctx.actor);
      const card = deck[0];

      const handZone = getZoneEntity(ctx.state, 'hand', ctx.actor);
      ctx.setComponent(LOCATION_COMPONENT, card, { location: handZone });
    }),

    new EmitEvent('CardDrawn', (ctx) => ({
      playerId: ctx.actor,
      cardId: /* card entity */,
    })),
  ],

  targetSelector: () => [[]], // No targets
  parameterGenerator: () => [{}], // No parameters

  metadata: {
    displayName: 'Draw Card',
    description: 'Draw the top card of your deck',
  },
});
```

2. **Register the action**:

```typescript
// games/simple-card-game/game-definition.ts
const gameDefinition: GameDefinition = {
  name: 'Simple Card Game',
  actions: [
    endTurnAction,
    drawCardAction, // Add here
  ],
  rules: rules,
  phases: phases,
  createInitialState: createInitialState,
};
```

3. **Add UI button**:

```typescript
// pages/CardGamePage.tsx
<button onClick={() => {
  const action: Action = {
    type: 'DrawCard',
    actorId: activePlayer,
    targetIds: [],
    parameters: {},
  };
  engine.getActionSystem().executeAction(action);
  setState({ ...state }); // Force re-render
}}>
  Draw Card
</button>
```

### Adding a New Rule

**Example**: "At start of turn, draw a card"

1. **Define the rule**:

```typescript
// games/simple-card-game/rules.ts
import { Rule, EventPattern } from '@blast/board-game-engine';

export const drawOnTurnStartRule: Rule = {
  id: 'draw-on-turn-start',

  // Trigger on TurnEnded events
  trigger: new EventPattern({
    eventType: 'TurnEnded',
    filters: {}, // Match all TurnEnded events
  }),

  conditions: [], // No additional conditions

  effects: [
    new CustomEffect((ctx) => {
      // Get the new active player (turn just ended, so it switched)
      const newActivePlayer = ctx.state.activePlayer;

      // Draw a card for them
      const deck = getDeckEntities(ctx.state, newActivePlayer);
      if (deck.length > 0) {
        const card = deck[0];
        const handZone = getZoneEntity(ctx.state, 'hand', newActivePlayer);
        ctx.state.coordinator.getComponentFromEntity(LOCATION_COMPONENT, card).location = handZone;
      }
    }),
  ],

  priority: 100, // Higher = earlier
  source: null, // Global rule
};
```

2. **Register the rule**:

```typescript
// games/simple-card-game/game-definition.ts
const rules: Rule[] = [
  drawOnTurnStartRule,
];
```

### Adding a New Phase

**Example**: Add a "Combat" phase

1. **Define the phase**:

```typescript
// games/simple-card-game/phases.ts
const combatPhase: PhaseDefinition = {
  name: 'Combat',

  allowedActionTypes: [
    'DeclareAttacker',
    'DeclareBlocker',
  ],

  autoAdvance: false, // Wait for player to pass

  onEnter: (state) => {
    // Reset all creatures' attack counts
    const creatures = getAllCreatures(state);
    creatures.forEach(creature => {
      const cardState = state.coordinator.getComponentFromEntity(CARD_STATE_COMPONENT, creature);
      cardState.attacksThisTurn = 0;
    });
  },

  onExit: (state) => {
    // Clean up combat-related state
  },

  nextPhase: 'End', // After combat, go to End phase
};
```

2. **Add to phase list**:

```typescript
const phases: PhaseDefinition[] = [
  upkeepPhase,
  mainPhase,
  combatPhase, // Add here
  endPhase,
];
```

### Adding a New Precondition

**Example**: "Has enough mana"

1. **Create the precondition class**:

```typescript
// board-game-engine/action-system/preconditions/has-mana.ts
import { Precondition, ActionContext } from '../../core/types';

export class HasMana implements Precondition {
  constructor(private amount: number) {}

  check(context: ActionContext): boolean {
    const resources = context.getComponent(
      RESOURCE_COMPONENT,
      context.actor
    );
    return resources !== null && resources.mana >= this.amount;
  }

  getErrorMessage(context: ActionContext): string {
    return `Not enough mana (need ${this.amount})`;
  }
}
```

2. **Export it**:

```typescript
// board-game-engine/action-system/preconditions/index.ts
export { HasMana } from './has-mana';
```

3. **Use it**:

```typescript
const playCardAction = new ActionDefinition({
  name: 'PlayCard',
  preconditions: [
    new IsPlayerTurn(),
    new HasMana(3), // Requires 3 mana
  ],
  // ...
});
```

### Adding a New Effect

**Example**: "Deal damage"

1. **Create the effect class**:

```typescript
// board-game-engine/action-system/effects/deal-damage.ts
import { Effect, ActionContext, Event } from '../../core/types';
import { Entity } from '@ue-too/ecs';

export class DealDamage implements Effect {
  constructor(
    private amount: number,
    private targetResolver: (ctx: ActionContext) => Entity
  ) {}

  apply(context: ActionContext): void {
    const target = this.targetResolver(context);

    const resources = context.getComponent(RESOURCE_COMPONENT, target);
    if (resources) {
      resources.health -= this.amount;

      // Check for death
      if (resources.health <= 0) {
        context.state.addEvent({
          type: 'PlayerDefeated',
          data: { playerId: target },
          timestamp: Date.now(),
          id: generateEventId(),
        });
      }
    }
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event {
    return {
      type: 'DamageDealt',
      data: {
        amount: this.amount,
        target: this.targetResolver(context),
      },
      timestamp: Date.now(),
      id: generateEventId(),
    };
  }
}
```

2. **Use it**:

```typescript
const lightningBoltAction = new ActionDefinition({
  name: 'LightningBolt',
  preconditions: [new IsPlayerTurn(), new HasMana(1)],
  costs: [new ModifyResource(-1, 0)], // Pay 1 mana
  effects: [
    new DealDamage(3, (ctx) => ctx.targets[0]),
  ],
  targetSelector: (state, actor) => {
    // Can target any player
    return state.getAllPlayers().map(p => [p]);
  },
  // ...
});
```

---

## Future Directions

### Short-Term (Next Sprints)

#### 1. **Complete Card Game Actions**
- [x] `DrawCard` - Draw from deck to hand (includes 1 card per turn limit)
- [x] `PlayCard` - Play card from hand to board (pays mana cost, adds summoning sickness)
- [x] `AttackCreature` - Combat between creatures (mutual damage, creatures can die)
- [x] `AttackPlayer` - Direct damage to player (reduces health)
- [x] `ActivateAbility` - Card abilities (taps card, emits event for rule engine)

**Status**: ✅ Complete
**Files**: `src/games/simple-card-game/actions.ts`, `src/games/simple-card-game/components.ts`
**Tests**: `test/card-game-actions.test.ts` (25 tests), `test/card-game-integration.test.ts` (28 tests)
**UI**: `src/pages/CardGamePage.tsx` - Interactive UI with card selection, action buttons
**Docs**: `docs/simple-card-game-manual.md` - Player manual

#### 2. **Deck Building & Card Library**
- [ ] Card database (JSON file or database)
- [ ] Deck construction UI
- [ ] Card rendering (images, stats, effects)
- [ ] Initial set of 20-30 cards

**Estimated Effort**: 1 week
**Priority**: High (core gameplay)

#### 3. **Win Conditions & Game Over**
- [ ] `GameStatusComponent` integration
- [ ] Check for player health <= 0
- [ ] Check for deck-out
- [ ] Victory/defeat UI overlay

**Estimated Effort**: 1-2 days
**Priority**: Medium (needed for complete games)

#### 4. **Enhanced UI**
- [ ] Visual card representations
- [ ] Drag-and-drop for playing cards
- [ ] Target selection UI
- [ ] Animation feedback (cards moving between zones)
- [ ] Event log (history of what happened)

**Estimated Effort**: 1-2 weeks
**Priority**: Medium (better UX)

### Medium-Term (Next Month)

#### 5. **AI Opponent**
- [ ] Action generation (find all valid actions)
- [ ] Minimax or MCTS tree search
- [ ] State evaluation heuristics
- [ ] AI difficulty levels

**Estimated Effort**: 2-3 weeks
**Priority**: High (enables single-player)

#### 6. **Multiplayer Support**
- [ ] Network synchronization (WebSocket or WebRTC)
- [ ] Game lobbies
- [ ] Turn-based protocol
- [ ] Reconnection handling

**Estimated Effort**: 2-3 weeks
**Priority**: Medium (enables real multiplayer)

#### 7. **Comprehensive Testing**
- [ ] Unit tests for all preconditions/effects/conditions
- [ ] Integration tests for action → event → rule flow
- [ ] Simulation tests (1000 random games, no crashes)
- [ ] Performance benchmarks

**Estimated Effort**: 1 week
**Priority**: High (code quality)

#### 8. **Generic Effects & Preconditions Library**

**Generic Effects** (all complete):
- [x] `MoveEntity` - Move entities between zones with cache updates
- [x] `ModifyResource` - Add/subtract numeric resources with min/max clamping
- [x] `SetComponentValue` - Set any component property dynamically
- [x] `CreateEntity` - Spawn new entities with components
- [x] `DestroyEntity` - Remove entities or move to discard zone
- [x] `ShuffleZone` - Fisher-Yates shuffle of zone contents
- [x] `TransferMultiple` - Move N entities between zones
- [x] `ConditionalEffect` - If/else effect execution
- [x] `RepeatEffect` - Repeat effect N times

**Generic Preconditions** (all complete):
- [x] `ResourceCheck` - Check numeric resource with operators (>=, >, <=, <, ==, !=)
- [x] `ZoneHasEntities` - Check zone has min/max entities with optional filter
- [x] `EntityInZone` - Check entity is in expected zone(s)
- [x] `ComponentValueCheck` - Check component property value or predicate
- [x] `OwnerCheck` - Check entity ownership with invert option
- [x] `TargetCount` - Check action has correct number of targets
- [x] `EntityExists` - Check entity exists with optional required component

**Resolver System** (complete):
- [x] `EntityResolvers` - Resolve entities (actor, target, fromParam, fixed)
- [x] `NumberResolvers` - Resolve numbers (fixed, fromParam, fromComponent, negate, add, multiply)
- [x] `ValueResolver<T>` - Generic value resolution

**Status**: ✅ Complete
**Files**:
- `src/board-game-engine/action-system/effects/generic.ts`
- `src/board-game-engine/action-system/preconditions/generic.ts`
- `src/board-game-engine/action-system/resolvers.ts`
**Tests**: `test/generic-effects.test.ts` (19 tests), `test/generic-preconditions.test.ts` (24 tests)

### Long-Term (3-6 Months)

#### 9. **Reusable Abilities System**
- [ ] Keyword abilities (e.g., "Flying", "Haste", "Lifelink")
- [ ] Triggered abilities (attach rules to entities)
- [ ] Activated abilities (costs + effects)
- [ ] Ability composition (combine multiple abilities)

**Estimated Effort**: 2-3 weeks
**Priority**: Medium (reduces duplication)

#### 10. **Save/Load & Replay**
- [ ] Serialize entire game state to JSON
- [ ] Save games to localStorage or server
- [ ] Load saved games
- [ ] Action replay (watch past games)
- [ ] Spectator mode

**Estimated Effort**: 1-2 weeks
**Priority**: Low (nice-to-have)

#### 11. **Advanced Game Modes**
- [ ] Draft mode (pick cards, build deck)
- [ ] Arena mode (gauntlet of AI opponents)
- [ ] Campaign mode (story-driven progression)
- [ ] Tournament mode (bracket elimination)

**Estimated Effort**: 3-4 weeks
**Priority**: Low (content expansion)

#### 12. **Performance Optimization**
- [ ] Profile action execution
- [ ] Optimize event processing (batch events)
- [ ] Cache expensive queries (entities in zone)
- [ ] Web Workers for AI computation
- [ ] Lazy loading for large card libraries

**Estimated Effort**: 1-2 weeks
**Priority**: Medium (scalability)

#### 13. **Card Effect Scripting** ✅ Partially Complete

**Implemented**:
- [x] Domain-specific language (DSL) for card effects - JSON-based expression language
- [x] JSON Schema validation for game definitions
- [x] Expression resolver for `$actor`, `$target`, `$component`, `$zone`, etc.
- [x] Visual editor for game definitions (Game Definition Builder GUI)

**Remaining**:
- [ ] Hot-reload card definitions during gameplay
- [ ] Sandboxed effect execution
- [ ] More advanced expressions (loops, custom functions)

**File Locations**:
- Expression language: `src/board-game-engine/schema/expression-resolver.ts`
- JSON Schema: `src/board-game-engine/schema/json-schema/game-definition.schema.json`
- GUI Builder: `src/components/GameDefinitionBuilder/index.tsx`

**Status**: Core DSL and GUI implemented, advanced features pending
**Priority**: Low (advanced feature)

#### 14. **Game Definition Builder Enhancements**

The GUI builder now includes visual builders for conditions and effects. Remaining enhancements:

- [x] Visual condition builder (AND/OR/NOT tree with dropdowns)
- [x] Visual effect builder (effect chain with reordering)
- [ ] Expression autocomplete (suggest `$actor`, `$target`, etc.)
- [ ] Live game preview (run game from JSON definition)
- [ ] Undo/redo support
- [ ] Template library (pre-built game templates)
- [ ] Validation with detailed error messages
- [ ] Dark mode support

**Implemented**:
- `ConditionBuilder` component - Supports all 13 condition types with nested AND/OR/NOT
- `EffectBuilder` component - Supports 7 effect types with conditional nesting
- `EffectListBuilder` component - Manages lists of effects with reordering
- Actions section expand/collapse with full precondition, cost, and effect editing

**Priority**: Medium (UX improvement)

#### 15. **Other Game Types**
The engine is generic enough to support:
- [ ] **Chess** - Turn-based, deterministic
- [ ] **Checkers** - Simpler board game
- [ ] **Poker** - Betting, hidden information
- [ ] **Tic-Tac-Toe** - Simple demonstration
- [ ] **Go** - Territory control
- [ ] **Custom Games** - Community creations

**Estimated Effort**: 1-2 weeks per game
**Priority**: Low (proof of generality)

---

## Maintenance Guide

### Code Organization Principles

1. **Keep Engine Game-Agnostic**
   - `board-game-engine/` should have zero game-specific logic
   - All game rules live in `games/<game-name>/`
   - Engine provides building blocks, games compose them

2. **Favor Composition Over Inheritance**
   - Use `CompositeEffect` instead of complex subclasses
   - Use `AndPrecondition` / `OrPrecondition` for logic
   - Keep classes small and focused

3. **Immutable Data Structures**
   - Events are immutable (never modify after creation)
   - Components can be mutable (for performance)
   - Use snapshots at boundaries for safety

4. **Clear Separation of Concerns**
   - **Core**: Types and state management
   - **Action System**: Player inputs
   - **Event System**: Notifications
   - **Rule Engine**: Game logic
   - **Phase System**: Game flow
   - **GameEngine**: Integration

### Adding New Features Checklist

When adding a new feature:

- [ ] Add types to `core/types.ts` if needed
- [ ] Implement the feature in appropriate system directory
- [ ] Add JSDoc comments with examples
- [ ] Export from `index.ts`
- [ ] Write unit tests
- [ ] Update this documentation
- [ ] Add example usage in simple card game (if applicable)

### Common Pitfalls

#### 1. **Infinite Event Loops**

**Problem**: Rule triggers event that triggers same rule again.

```typescript
// BAD: Infinite loop
const rule: Rule = {
  id: 'bad-rule',
  trigger: { eventType: 'CardPlayed', filters: {} },
  effects: [
    new EmitEvent('CardPlayed', /* ... */), // Triggers itself!
  ],
};
```

**Solution**: Use different event types or add guards.

```typescript
// GOOD: Different event
const rule: Rule = {
  id: 'good-rule',
  trigger: { eventType: 'CardPlayed', filters: {} },
  effects: [
    new EmitEvent('CardPlayedReaction', /* ... */), // Different type
  ],
};
```

#### 2. **Forgetting to Emit Events**

**Problem**: Effects modify state but don't emit events, so rules never trigger.

```typescript
// BAD: State changes but no one knows
new CustomEffect((ctx) => {
  ctx.getComponent(RESOURCE_COMPONENT, ctx.actor).health -= 5;
  // No event emitted!
});
```

**Solution**: Always emit events for significant state changes.

```typescript
// GOOD: Emit event
new CompositeEffect([
  new CustomEffect((ctx) => {
    ctx.getComponent(RESOURCE_COMPONENT, ctx.actor).health -= 5;
  }),
  new EmitEvent('HealthChanged', (ctx) => ({
    playerId: ctx.actor,
    newHealth: ctx.getComponent(RESOURCE_COMPONENT, ctx.actor).health,
  })),
]);
```

#### 3. **Mutating Immutable Data**

**Problem**: Modifying events or snapshots directly.

```typescript
// BAD: Mutating event
event.data.playerId = newPlayer; // Events are immutable!
```

**Solution**: Create new objects.

```typescript
// GOOD: Create new event
const newEvent: Event = {
  ...event,
  data: { ...event.data, playerId: newPlayer },
};
```

#### 4. **Not Validating Actions**

**Problem**: Executing actions without checking preconditions.

```typescript
// BAD: Direct execution
actionSystem.executeAction(action); // Might violate rules!
```

**Solution**: Always validate first.

```typescript
// GOOD: Validate before execute
if (actionSystem.isActionValid(action)) {
  actionSystem.executeAction(action);
} else {
  console.error('Invalid action:', actionSystem.getValidationError(action));
}
```

#### 5. **Component Name Collisions**

**Problem**: Using same component name in different contexts.

```typescript
// BAD: Generic names
const COMPONENT = createGlobalComponentName('Component');
```

**Solution**: Use descriptive, unique names.

```typescript
// GOOD: Specific names
const CARD_COMPONENT = createGlobalComponentName('Card');
const PLAYER_RESOURCE_COMPONENT = createGlobalComponentName('PlayerResource');
```

### Performance Considerations

#### 1. **Minimize Event Cascades**

Each event can trigger multiple rules, which emit more events.

**Best Practice**: Limit cascade depth to 2-3 levels.

```typescript
// Monitor cascade depth
const MAX_CASCADE_DEPTH = 3;

if (currentDepth > MAX_CASCADE_DEPTH) {
  console.warn('Deep event cascade detected:', eventChain);
}
```

#### 2. **Cache Expensive Queries**

Queries like "get all cards in hand" can be expensive.

**Best Practice**: Cache results during action execution.

```typescript
// Bad: Queries in hot loop
for (let i = 0; i < 100; i++) {
  const cards = getCardsInHand(state, player); // Queries ECS every time
}

// Good: Cache once
const cards = getCardsInHand(state, player);
for (let i = 0; i < 100; i++) {
  // Use cached result
}
```

#### 3. **Limit Snapshot Frequency**

Snapshots serialize the entire ECS, which is expensive.

**Best Practice**: Only snapshot at turn boundaries or before risky actions.

```typescript
// Bad: Snapshot every action
for (const action of actions) {
  const snapshot = state.createSnapshot(); // Expensive!
  executeAction(action);
}

// Good: Snapshot once per turn
const snapshot = state.createSnapshot();
for (const action of actions) {
  executeAction(action);
}
```

### Debugging Tips

#### 1. **Enable Event Logging**

Log all events to see what's happening:

```typescript
state.coordinator.on('event', (event: Event) => {
  console.log('Event:', event.type, event.data);
});
```

#### 2. **Visualize Event Chains**

Track event causality:

```typescript
const eventGraph = new Map<string, string[]>();

function recordEvent(event: Event, cause: Event | null) {
  if (cause) {
    if (!eventGraph.has(cause.id)) {
      eventGraph.set(cause.id, []);
    }
    eventGraph.get(cause.id)!.push(event.id);
  }
}
```

#### 3. **Snapshot Diffing**

Compare before/after snapshots:

```typescript
const before = state.createSnapshot();
executeAction(action);
const after = state.createSnapshot();

console.log('State diff:', diff(before.toJSON(), after.toJSON()));
```

#### 4. **Action Replay**

Record all actions and replay them:

```typescript
const actionHistory: Action[] = [];

function executeWithRecording(action: Action) {
  actionHistory.push(action);
  actionSystem.executeAction(action);
}

function replay() {
  const initialState = loadInitialState();
  for (const action of actionHistory) {
    actionSystem.executeAction(action);
  }
}
```

### Testing Strategy

#### Unit Tests (Per Component)

Test individual pieces in isolation:

```typescript
describe('HasMana precondition', () => {
  it('should pass when player has enough mana', () => {
    const state = createTestState();
    const player = createPlayerWithMana(state, 5);
    const context = createMockContext(state, player);

    const precondition = new HasMana(3);
    expect(precondition.check(context)).toBe(true);
  });

  it('should fail when player lacks mana', () => {
    const state = createTestState();
    const player = createPlayerWithMana(state, 2);
    const context = createMockContext(state, player);

    const precondition = new HasMana(3);
    expect(precondition.check(context)).toBe(false);
  });
});
```

#### Integration Tests (Action → Event → Rule)

Test complete flows:

```typescript
describe('PlayCard action', () => {
  it('should move card from hand to board and trigger rules', () => {
    const engine = createTestEngine();
    const state = engine.getState();

    // Setup: Card in hand
    const card = createCard(state, { cost: 3 });
    const player = getActivePlayer(state);
    moveToHand(state, card, player);

    // Execute: Play the card
    const action: Action = {
      type: 'PlayCard',
      actorId: player,
      targetIds: [card],
      parameters: {},
    };

    engine.getActionSystem().executeAction(action);

    // Verify: Card moved to board
    expect(isInZone(state.coordinator, card, 'board', player)).toBe(true);

    // Verify: Mana was spent
    const resources = state.coordinator.getComponentFromEntity(RESOURCE_COMPONENT, player);
    expect(resources.mana).toBe(/* initial - 3 */);

    // Verify: CardPlayed event was emitted
    const events = state.getEventQueue();
    expect(events).toContainEqual(expect.objectContaining({
      type: 'CardPlayed',
      data: expect.objectContaining({ cardId: card }),
    }));
  });
});
```

#### Simulation Tests (Stability)

Run random games to catch edge cases:

```typescript
describe('Game stability', () => {
  it('should complete 1000 random games without crashing', () => {
    for (let i = 0; i < 1000; i++) {
      const engine = createTestEngine();

      while (!engine.getState().isGameOver()) {
        const validActions = engine.getActionSystem().getValidActions();
        const randomAction = validActions[Math.floor(Math.random() * validActions.length)];

        engine.getActionSystem().executeAction(randomAction);
      }

      // If we got here, game completed successfully
      expect(engine.getState().isGameOver()).toBe(true);
    }
  });
});
```

### Documentation Standards

#### JSDoc Format

```typescript
/**
 * Brief one-line description.
 *
 * More detailed explanation of what this does, how it works,
 * and any important considerations.
 *
 * @param paramName - Description of parameter
 * @param anotherParam - Description with type info if complex
 * @returns Description of return value
 *
 * @throws {ErrorType} When error condition occurs
 *
 * @remarks
 * Additional notes, edge cases, performance considerations.
 *
 * @example
 * ```typescript
 * // Realistic usage example
 * const result = myFunction(arg1, arg2);
 * console.log(result); // Expected output
 * ```
 *
 * @see {@link RelatedClass} for related functionality
 *
 * @group Category Name
 */
```

#### README Structure

Each game should have a README:

```markdown
# Game Name

Brief description.

## Features

- Feature 1
- Feature 2

## How to Play

1. Step 1
2. Step 2

## Components

List of ECS components used.

## Actions

List of player actions.

## Rules

List of game rules.

## Future Enhancements

Ideas for expansion.
```

### Version Control

#### Branch Strategy

- `main` - Stable, tested code
- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/update-description` - Documentation updates

#### Commit Messages

```
feat(action-system): add HasMana precondition

- Checks if player has sufficient mana
- Used by PlayCard and ActivateAbility actions
- Includes error message with required amount

Closes #123
```

### Deployment Checklist

Before deploying a new version:

- [ ] All tests pass (`bunx nx test blast`)
- [ ] TypeScript compiles (`bunx nx build blast`)
- [ ] Manual testing of new features
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version number bumped
- [ ] Git tag created

---

## Getting Help

### Common Questions

**Q: How do I make an action that targets multiple entities?**

A: Use `targetSelector` to return arrays with multiple elements:

```typescript
targetSelector: (state, actor) => {
  const creatures = getCreatures(state, actor);
  const combinations: Entity[][] = [];

  // Generate all 2-creature combinations
  for (let i = 0; i < creatures.length; i++) {
    for (let j = i + 1; j < creatures.length; j++) {
      combinations.push([creatures[i], creatures[j]]);
    }
  }

  return combinations;
}
```

**Q: How do I implement hidden information (opponent's hand)?**

A: Add a visibility system:

```typescript
interface ZoneComponent {
  name: string;
  owner: Entity | null;
  visibility: 'public' | 'private' | 'owner-only'; // Add this
}

// When rendering, check visibility
function canSee(viewer: Entity, zone: Entity): boolean {
  const zoneComp = getComponent(ZONE_COMPONENT, zone);
  if (zoneComp.visibility === 'public') return true;
  if (zoneComp.visibility === 'owner-only' && zoneComp.owner === viewer) return true;
  return false;
}
```

**Q: How do I implement card abilities?**

A: Attach rules to specific entities:

```typescript
const cardAbilityRule: Rule = {
  id: 'lightning-rod-ability',
  trigger: { eventType: 'CreatureEntersPlay', filters: {} },
  conditions: [],
  effects: [new DealDamage(1, /* target */)],
  priority: 100,
  source: cardEntity, // Attach to specific card
};

// When card leaves play, remove its rules
function destroyCard(cardEntity: Entity) {
  ruleEngine.removeRulesForSource(cardEntity);
  coordinator.destroyEntity(cardEntity);
}
```

**Q: How do I implement simultaneous actions (like declaring attackers)?**

A: Use a "batch action":

```typescript
const declareAttackersAction = new ActionDefinition({
  name: 'DeclareAttackers',
  // ...
  parameterGenerator: (state, actor) => {
    const creatures = getCreatures(state, actor);

    // Generate all possible attacker combinations
    const combinations: Record<string, any>[] = [];

    for (let mask = 0; mask < (1 << creatures.length); mask++) {
      const attackers: Entity[] = [];
      for (let i = 0; i < creatures.length; i++) {
        if (mask & (1 << i)) {
          attackers.push(creatures[i]);
        }
      }
      combinations.push({ attackers });
    }

    return combinations;
  },
  // ...
});
```

### Resources

- **ECS Documentation**: `packages/ecs/README.md`
- **Original Spec**: `board-game-engine-specs/board-game-rule-engine-specification.md`
- **This Guide**: `board-game-engine-specs/implementation-guide.md`
- **Code-Based Development Guide**: `board-game-engine-specs/code-based-game-development.md`
- **TypeDoc**: Generate with `bunx typedoc` (if configured)

### Contact

For questions or issues:
1. Check existing documentation
2. Search for similar patterns in `games/simple-card-game/`
3. Create a GitHub issue
4. Reach out to the team

---

## Appendix: Quick Reference

### Component Constants

```typescript
// From board-game-engine/core/game-state.ts
GAME_MANAGER_COMPONENT
ZONE_COMPONENT
PLAYER_COMPONENT

// From games/simple-card-game/components.ts
CARD_COMPONENT
RESOURCE_COMPONENT
CARD_STATE_COMPONENT
OWNER_COMPONENT
GAME_STATUS_COMPONENT
```

### Built-in Preconditions

```typescript
// Basic preconditions
new IsPlayerTurn()
new HasComponent(CARD_COMPONENT, 'actor')
new PhaseCheck('Main')
new AndPrecondition([precond1, precond2])
new OrPrecondition([precond1, precond2])
new NotPrecondition(precond)
new AlwaysTruePrecondition()
new AlwaysFalsePrecondition()
new CustomPrecondition(checkFn, errorMsg)

// Generic preconditions (configurable via resolvers)
new ResourceCheck({ entity, component, property, operator, value })
new ZoneHasEntities({ zone, minCount, maxCount, filter })
new EntityInZone({ entity, expectedZones })
new ComponentValueCheck({ entity, component, property, expectedValue, predicate })
new OwnerCheck({ entity, expectedOwner, invert })
new TargetCount({ count, min, max })
new EntityExists({ entity, requiredComponent })
```

### Built-in Effects

```typescript
// Basic effects
new EmitEvent('EventType', dataFn)
new CustomEffect(applyFn)
new CompositeEffect([effect1, effect2])
new NoOpEffect()

// Generic effects (configurable via resolvers)
new MoveEntity({ entity, fromZone, toZone, eventType })
new ModifyResource({ entity, component, property, amount, min, max })
new SetComponentValue({ entity, component, property, value })
new CreateEntity({ components, targetZone, eventType })
new DestroyEntity({ entity, discardZone, eventType })
new ShuffleZone({ zone, eventType })
new TransferMultiple({ fromZone, toZone, count, filter })
new ConditionalEffect({ condition, ifEffect, elseEffect })
new RepeatEffect({ effect, count })
```

### Resolver System

```typescript
// Entity resolvers - dynamically get entities at runtime
EntityResolvers.actor           // The acting player
EntityResolvers.target          // First target
EntityResolvers.targetAt(1)     // Target at index
EntityResolvers.fromParam('p')  // From action parameters
EntityResolvers.fixed(entity)   // Fixed entity

// Number resolvers - dynamically compute values
NumberResolvers.fixed(5)                          // Fixed value
NumberResolvers.fromParam('damage')               // From parameters
NumberResolvers.fromComponent(COMP, entity, 'x') // From component property
NumberResolvers.negate(resolver)                  // Negate value
NumberResolvers.add(r1, r2, ...)                  // Sum values
NumberResolvers.multiply(r1, r2, ...)            // Multiply values
```

### Common Patterns

```typescript
// Get all entities in a zone
const cards = state.coordinator.getAllEntities().filter(entity => {
  return isInZone(state.coordinator, entity, 'hand', playerId);
});

// Modify a component
const comp = state.coordinator.getComponentFromEntity(COMPONENT_NAME, entity);
comp.property = newValue;

// Emit an event
state.addEvent({
  type: 'CustomEvent',
  data: { key: 'value' },
  timestamp: Date.now(),
  id: generateEventId(),
});

// Check game over
const gameStatus = state.coordinator.getComponentFromEntity(
  GAME_STATUS_COMPONENT,
  gameManagerEntity
);
if (gameStatus?.isGameOver) {
  console.log('Winner:', gameStatus.winner);
}
```

### JSON Expression Language Quick Reference

```typescript
// Entity Expressions
$actor                        // The player performing the action
$target                       // First target (shorthand for $target.0)
$target.0                     // Target at index 0
$target.1                     // Target at index 1
$activePlayer                 // Currently active player
$param.cardId                 // Entity from action parameters
$eachPlayer                   // Current player in setup loop

// Zone Expressions
$zone.actor.hand              // Actor's hand zone
$zone.actor.deck              // Actor's deck zone
$zone.opponent.board          // Opponent's board zone
$zone.$eachPlayer.deck        // Each player's deck (in setup)

// Component Expressions
$component.$actor.Resource.mana       // Actor's mana value
$component.$target.Card.cost          // Target card's cost
$component.$target.Card.cardType      // Target card's type

// Math Expressions
$negate($component.$target.Card.cost) // Negative of card cost
$add(2, 3)                            // 2 + 3 = 5
$multiply($param.damage, 2)           // Double the damage
```

### JSON Schema Condition Types

```json
// Is it the player's turn?
{ "type": "isPlayerTurn" }

// Check current phase
{ "type": "phaseCheck", "phases": ["Main", "Combat"] }

// Check numeric resource
{
  "type": "resourceCheck",
  "entity": "$actor",
  "component": "Resource",
  "property": "mana",
  "operator": ">=",
  "value": "$component.$target.Card.cost"
}

// Check entity is in zone
{
  "type": "entityInZone",
  "entity": "$target",
  "zone": "$zone.actor.hand"
}

// Check component value
{
  "type": "componentValueCheck",
  "entity": "$target",
  "component": "Card",
  "property": "cardType",
  "value": "Creature"
}

// Logical combinators
{ "type": "and", "conditions": [...] }
{ "type": "or", "conditions": [...] }
{ "type": "not", "condition": {...} }
```

### JSON Schema Effect Types

```json
// Move entity between zones
{
  "type": "moveEntity",
  "entity": "$target",
  "fromZone": "$zone.actor.hand",
  "toZone": "$zone.actor.board"
}

// Modify numeric resource
{
  "type": "modifyResource",
  "entity": "$actor",
  "component": "Resource",
  "property": "mana",
  "amount": "$negate($component.$target.Card.cost)"
}

// Set component value
{
  "type": "setComponentValue",
  "entity": "$target",
  "component": "CardState",
  "property": "tapped",
  "value": true
}

// Transfer multiple entities
{
  "type": "transferMultiple",
  "fromZone": "$zone.actor.deck",
  "toZone": "$zone.actor.hand",
  "count": 3,
  "selection": "top"
}

// Conditional effect
{
  "type": "conditional",
  "condition": {...},
  "then": [...],
  "else": [...]
}
```

---

**End of Implementation Guide**

For the latest updates, see the Git repository and inline code documentation.
