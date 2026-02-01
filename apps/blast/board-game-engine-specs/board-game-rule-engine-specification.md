# Board Game Rule Engine - Complete System Specification

## Document Overview

This document provides a comprehensive specification for a general-purpose board game rule engine designed for digitization, prototyping, and AI-powered playtesting. The system is built on four core pillars:

1. **Action System** - Defines and executes player actions
2. **Event System** - Manages state change notifications
3. **Rule Engine** - Processes events and applies game rules
4. **Phase Management** - Controls game flow and turn structure

---

## Table of Contents

### Part 1: Action System

1. [Action System Overview](#action-system)
2. [Core Action Components](#action-system-core-components)
3. [Action Lifecycle](#action-lifecycle)
4. [Action Examples](#action-examples)

### Part 2: Event System

5. [Event System Overview](#event-system)
6. [Core Event Components](#event-system-core-components)
7. [Event Processing](#event-processing)
8. [Event Examples](#event-examples)

### Part 3: Rule Engine

9. [Rule Engine Overview](#rule-engine)
10. [Core Rule Components](#rule-engine-core-components)
11. [Rule Execution](#rule-execution)
12. [Rule Examples](#rule-examples)

### Part 4: Phase Management

13. [Phase System Overview](#phase-system)
14. [Core Phase Components](#phase-system-core-components)
15. [Phase Transitions](#phase-transitions)
16. [Phase Examples](#phase-examples)

### Part 5: Integration & Architecture

17. [System Integration](#system-integration)
18. [Complete Game Loop](#complete-game-loop)
19. [Error Handling](#error-handling)
20. [Performance Considerations](#performance-considerations)
21. [Testing Strategy](#testing-strategy)
22. [Extensibility](#extensibility)
23. [Open Questions](#open-questions)

---

# Part 1: Action System

## Action System

### Overview

The Action System is responsible for defining, validating, and executing all player actions in the game. It provides a declarative framework where game actions are defined as templates with preconditions, costs, and effects.

**Key Responsibilities**:

- Define what actions players can take
- Validate whether actions are legal
- Execute actions and produce state changes
- Generate events from action execution

---

## Action System Core Components

### 1. Action

**Purpose**: Represents a specific instance of a player's intent to perform an action.

**Type Definition**:

```typescript
interface Action {
    type: string; // Action type identifier (e.g., "PlayCard", "Move")
    actorId: string; // EntityId of the actor performing the action
    targetIds: string[]; // Ordered list of EntityIds being targeted
    parameters: Record<string, any>; // Additional action-specific data
}
```

**Properties**:

- `type`: Must match a registered ActionDefinition name
- `actorId`: Must reference a valid Entity in the current GameState
- `targetIds`: Can be empty for actions with no targets. Order matters for multi-target actions
- `parameters`: Flexible key-value store for action-specific data (e.g., `{ cardSlot: 3, bidAmount: 50 }`)

**Characteristics**:

- Immutable once created
- Two actions are equal if all fields match exactly
- Serializable for network play and replays

---

### 2. ActionContext

**Purpose**: Bundles all information needed during action validation and execution.

**Type Definition**:

```typescript
interface ActionContext {
    state: GameState; // Current game state (immutable)
    action: Action; // The action being executed
    actor: Entity; // Resolved actor entity
    targets: Entity[]; // Resolved target entities (in order)
    parameters: Record<string, any>; // Copy of action.parameters for convenience
}
```

**Usage**:

- Created once per action execution
- Passed through all preconditions and effects
- Avoids repeated entity lookups
- Provides convenient access to resolved entities

---

### 3. Precondition

**Purpose**: Represents a single condition that must be true for an action to be valid.

**Interface**:

```typescript
interface Precondition {
    check(context: ActionContext): boolean;
    getErrorMessage(context: ActionContext): string;
}
```

**Design Principles**:

- Pure functions (no side effects, deterministic)
- Independent (each checks one thing)
- Composable (can be combined in any order)
- Fast (called frequently for action generation)

**Common Precondition Types**:

#### IsPlayerTurn

```typescript
class IsPlayerTurn implements Precondition {
    check(context: ActionContext): boolean;
    getErrorMessage(context: ActionContext): string;
}
```

Checks if `context.state.activePlayer === context.actor.id`

#### HasComponent

```typescript
class HasComponent implements Precondition {
    constructor(
        componentType: string,
        target: 'actor' | `target${number}` = 'actor'
    );
}
```

Checks if specified entity has a component

#### ResourceAvailable

```typescript
class ResourceAvailable implements Precondition {
    constructor(
        resourceName: string,
        amount: number | ((context: ActionContext) => number)
    );
}
```

Checks if actor has sufficient resources

#### EntityInZone

```typescript
class EntityInZone implements Precondition {
    constructor(zone: string, target: 'actor' | `target${number}` = 'actor');
}
```

Checks if entity is in a specific zone

#### PhaseCheck

```typescript
class PhaseCheck implements Precondition {
    constructor(allowedPhases: string[]);
}
```

Checks if current phase is in allowed list

#### CustomPrecondition

```typescript
class CustomPrecondition implements Precondition {
    constructor(
        checkFn: (context: ActionContext) => boolean,
        errorMessage: string | ((context: ActionContext) => string)
    );
}
```

For game-specific conditions

---

### 4. Effect

**Purpose**: Represents a state modification that occurs when an action executes.

**Interface**:

```typescript
interface Effect {
    apply(context: ActionContext): GameState;
    generatesEvent(): boolean;
    createEvent(context: ActionContext): Event | null;
}
```

**Design Principles**:

- **Immutability**: Must return NEW GameState, never mutate
- **Atomicity**: Each effect is all-or-nothing
- **Composability**: Effects can be chained sequentially
- **Event generation**: Effects can trigger events for the rule engine

**Common Effect Types**:

#### ModifyResource

```typescript
class ModifyResource implements Effect {
    constructor(
        resourceName: string,
        amount: number | ((context: ActionContext) => number),
        target: 'actor' | `target${number}` = 'actor',
        operation: 'add' | 'subtract' | 'set' = 'add'
    );
}
```

Modifies a resource on an entity

#### MoveEntity

```typescript
class MoveEntity implements Effect {
    constructor(
        toZone: string,
        target: 'actor' | `target${number}` = 'actor',
        position?: 'top' | 'bottom' | 'random' | number
    );
}
```

Moves entity between zones

#### CreateEntity

```typescript
class CreateEntity implements Effect {
    constructor(
        entityType: string,
        components: Record<string, any>,
        owner?: 'actor' | `target${number}` | string
    );
}
```

Creates a new entity in the game

#### DestroyEntity

```typescript
class DestroyEntity implements Effect {
    constructor(target: 'actor' | `target${number}` = 'target0');
}
```

Removes an entity from the game

#### EmitEvent

```typescript
class EmitEvent implements Effect {
    constructor(
        eventType: string,
        data:
            | Record<string, any>
            | ((context: ActionContext) => Record<string, any>)
    );
}
```

Explicitly emits an event without modifying state

#### CompositeEffect

```typescript
class CompositeEffect implements Effect {
    constructor(effects: Effect[]);
}
```

Chains multiple effects together

---

### 5. ActionDefinition

**Purpose**: Template that defines how an action type works.

**Type Definition**:

```typescript
interface ActionDefinition {
    name: string;
    preconditions: Precondition[];
    costs: Effect[];
    effects: Effect[];
    targetSelector?: (state: GameState, actor: Entity) => Entity[][];
    parameterGenerator?: (
        state: GameState,
        actor: Entity
    ) => Record<string, any>[];
    metadata?: {
        displayName?: string;
        description?: string;
        iconUrl?: string;
    };
}
```

**Properties**:

- **name**: Unique action type identifier
- **preconditions**: All must pass for action to be valid
- **costs**: Effects applied before main effects (e.g., pay mana)
- **effects**: Main state modifications
- **targetSelector**: Optional function to generate valid target combinations
- **parameterGenerator**: Optional function to generate valid parameter sets

**Method Signatures**:

```typescript
interface ActionDefinition {
    canExecute(state: GameState, action: Action): [boolean, string | null];
    execute(state: GameState, action: Action): GameState;
    getGeneratedEvents(state: GameState, action: Action): Event[];
}
```

---

### 6. ActionSystem

**Purpose**: Central manager for all actions.

**Class Structure**:

```typescript
class ActionSystem {
    private actionDefinitions: Map<string, ActionDefinition>;

    registerAction(definition: ActionDefinition): void;
    unregisterAction(actionType: string): void;
    getDefinition(actionType: string): ActionDefinition | null;
    getValidActions(state: GameState, playerId: string): Action[];
    executeAction(state: GameState, action: Action): [GameState, Event[]];
    validateAction(state: GameState, action: Action): [boolean, string | null];
}
```

**Key Methods**:

**getValidActions()** - Generates all valid actions for a player:

```
1. Get player entity from state
2. For each registered ActionDefinition:
   a. Generate all target combinations (using targetSelector or [])
   b. Generate all parameter combinations (using parameterGenerator or [{}])
   c. For each (targets, parameters) pair:
      i. Create Action instance
      ii. Check all preconditions
      iii. If all pass, add to valid actions list
3. Return valid actions
```

**executeAction()** - Executes an action:

```
1. Validate action (preconditions)
2. Create ActionContext
3. Apply costs sequentially
4. Apply effects sequentially
5. Collect generated events
6. Return [final state, events]
```

---

## Action Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    ACTION LIFECYCLE                      │
└─────────────────────────────────────────────────────────┘

1. DEFINITION PHASE (Setup)
   │ Game defines ActionDefinitions
   │ ActionSystem.registerAction()
   ↓

2. GENERATION PHASE (Per Turn)
   │ getValidActions(state, playerId)
   │  - Generate target combinations
   │  - Generate parameter combinations
   │  - Check preconditions
   │  - Return valid Actions
   ↓

3. SELECTION PHASE (Player Input)
   │ Player/AI selects an Action
   ↓

4. VALIDATION PHASE (Safety Check)
   │ validateAction(state, action)
   │  - Re-check preconditions
   │  - Ensure still valid
   ↓

5. EXECUTION PHASE
   │ executeAction(state, action)
   │  a. Create ActionContext
   │  b. Apply Costs → State'
   │  c. Apply Effects → State''
   │  d. Collect Events
   │  e. Return [State, Events]
   ↓

6. EVENT PROCESSING PHASE
   │ Events sent to EventQueue
   │ RuleEngine processes events
   │ (May trigger more state changes)
```

---

## Action Examples

### Example 1: Draw Card Action

```typescript
const drawCardAction = new ActionDefinition({
    name: 'DrawCard',

    preconditions: [
        new IsPlayerTurn(),
        new CustomPrecondition(ctx => {
            const deck = ctx.state.query(
                `type == 'Deck' AND owner == '${ctx.actor.id}'`
            );
            return deck.length > 0 && deck[0].get('Cards').length > 0;
        }, 'No cards in deck'),
    ],

    costs: [],

    effects: [
        new MoveEntity('hand', 'deckTopCard', 'top'),
        new EmitEvent('CardDrawn', ctx => ({
            playerId: ctx.actor.id,
            cardId: ctx.targets[0]?.id,
        })),
    ],

    targetSelector: (state, actor) => {
        const deck = state.query(`type == 'Deck' AND owner == '${actor.id}'`);
        if (deck.length > 0) {
            const topCard = deck[0].get('Cards')[0];
            return [[topCard]];
        }
        return [];
    },
});
```

### Example 2: Play Card Action

```typescript
const playCardAction = new ActionDefinition({
    name: 'PlayCard',

    preconditions: [
        new IsPlayerTurn(),
        new HasComponent('Card', 'actor'),
        new EntityInZone('hand', 'actor'),
        new ResourceAvailable('mana', ctx => ctx.actor.get('Card').cost),
        new PhaseCheck(['Main']),
    ],

    costs: [
        new ModifyResource(
            'mana',
            ctx => -ctx.actor.get('Card').cost,
            'player',
            'subtract'
        ),
    ],

    effects: [
        new MoveEntity('board', 'actor'),
        new EmitEvent('CardPlayed', ctx => ({
            cardId: ctx.actor.id,
            playerId: ctx.state.activePlayer,
        })),
    ],

    targetSelector: (state, actor) => {
        const hand = state.query(`zone == 'hand' AND owner == '${actor.id}'`);
        return hand.map(card => [card]);
    },
});
```

### Example 3: Attack Action

```typescript
const attackAction = new ActionDefinition({
    name: 'Attack',

    preconditions: [
        new IsPlayerTurn(),
        new HasComponent('Attack', 'actor'),
        new HasComponent('Health', 'target0'),
        new EntityInZone('board', 'actor'),
        new EntityInZone('board', 'target0'),
        new CustomPrecondition(
            ctx => ctx.actor.get('Status')?.canAttack === true,
            'Attacker has already attacked this turn'
        ),
        new CustomPrecondition(
            ctx => ctx.actor.get('Owner').id !== ctx.targets[0].get('Owner').id,
            'Cannot attack your own units'
        ),
    ],

    costs: [new ModifyResource('canAttack', 0, 'actor', 'set')],

    effects: [
        new ModifyResource(
            'health',
            ctx => -ctx.actor.get('Attack').power,
            'target0',
            'subtract'
        ),
        new EmitEvent('EntityAttacked', ctx => ({
            attackerId: ctx.actor.id,
            defenderId: ctx.targets[0].id,
            damage: ctx.actor.get('Attack').power,
        })),
    ],

    targetSelector: (state, actor) => {
        const actorOwner = actor.get('Owner').id;
        const enemies = state.query(
            `zone == 'board' AND owner != '${actorOwner}' AND has('Health')`
        );
        return enemies.map(enemy => [enemy]);
    },
});
```

---

# Part 2: Event System

## Event System

### Overview

The Event System manages all state change notifications in the game. Events are immutable records of "something that happened" and serve as the communication layer between the Action System and Rule Engine.

**Key Responsibilities**:

- Represent state changes as events
- Queue events for processing
- Detect infinite loops and cycles
- Track event history for debugging/replay

---

## Event System Core Components

### 1. Event

**Purpose**: Immutable record of something that happened in the game.

**Type Definition**:

```typescript
interface Event {
    type: string; // Event type (e.g., "CardPlayed", "EntityDestroyed")
    data: Record<string, any>; // Event-specific payload
    timestamp: number; // When the event occurred
    id: string; // Unique identifier
}
```

**Properties**:

- `type`: Category of event (used for pattern matching by rules)
- `data`: Contextual information about what happened
- `timestamp`: Monotonically increasing time value
- `id`: Unique identifier for this specific event instance

**Characteristics**:

- Immutable once created
- Hashable for cycle detection
- Serializable for network play and replays

**Standard Event Types**:

- `ActionExecuted`: Generated for every action
- `CardPlayed`: When a card is played
- `CardDrawn`: When a card is drawn
- `EntityCreated`: When an entity is created
- `EntityDestroyed`: When an entity is destroyed
- `EntityMoved`: When an entity changes zones
- `ResourceChanged`: When a resource value changes
- `PhaseChanged`: When the game phase transitions
- `TurnStarted`: When a turn begins
- `TurnEnded`: When a turn ends

---

### 2. EventPattern

**Purpose**: Pattern for matching events (used by rules to "listen" for specific events).

**Type Definition**:

```typescript
interface EventPattern {
    eventType: string; // Event type to match (use "*" for wildcard)
    filters: Record<string, any>; // Additional constraints
}
```

**Matching Logic**:

```typescript
function matches(event: Event): boolean {
    // Check type
    if (this.eventType !== '*' && event.type !== this.eventType) {
        return false;
    }

    // Check filters
    for (const [key, expectedValue] of Object.entries(this.filters)) {
        if (!(key in event.data)) return false;

        const actualValue = event.data[key];

        // Handle callable filters (predicates)
        if (typeof expectedValue === 'function') {
            if (!expectedValue(actualValue)) return false;
        }
        // Handle exact match
        else if (actualValue !== expectedValue) {
            return false;
        }
    }

    return true;
}
```

**Examples**:

```typescript
// Match any CardPlayed event
new EventPattern('CardPlayed', {});

// Match CardPlayed events for a specific player
new EventPattern('CardPlayed', { playerId: 'player1' });

// Match CardPlayed events where card is a Spell
new EventPattern('CardPlayed', {
    cardId: cardId => state.getEntity(cardId)?.get('Card')?.type === 'Spell',
});

// Match all events
new EventPattern('*', {});
```

---

### 3. EventQueue

**Purpose**: Manages pending events in FIFO order.

**Class Structure**:

```typescript
class EventQueue {
    private queue: Event[];
    private maxDepth: number;
    public processedCount: number;

    add(event: Event): void;
    addMultiple(events: Event[]): void;
    pop(): Event | null;
    isEmpty(): boolean;
    size(): number;
    clear(): void;
}
```

**Characteristics**:

- First-In-First-Out (FIFO) ordering
- Bounded depth for safety
- Tracks number of processed events

---

### 4. EventProcessor

**Purpose**: Processes events through the rule engine.

**Class Structure**:

```typescript
class EventProcessor {
  constructor(
    private ruleEngine: RuleEngine,
    private maxIterations: number = 100
  );

  processAll(state: GameState, queue: EventQueue): GameState;
}
```

**Processing Algorithm**:

```
function processAll(state, queue):
  iterations = 0
  processedSignatures = new Set()

  while !queue.isEmpty() AND iterations < maxIterations:
    event = queue.pop()

    // Cycle detection
    signature = getEventSignature(event)
    if signature in processedSignatures:
      log warning and continue
    processedSignatures.add(signature)

    // Process through rule engine
    [newState, newEvents] = ruleEngine.processEvent(state, event)

    // Add new events to queue
    queue.addMultiple(newEvents)

    state = newState
    iterations++

  if iterations >= maxIterations:
    throw error or log warning

  return state
```

**Safety Features**:

1. **Cycle Detection**: Tracks event signatures to prevent infinite loops
2. **Max Iterations**: Prevents runaway event cascades
3. **Event Signature**: Creates unique string for each event instance

**Event Signature Generation**:

```typescript
function getEventSignature(event: Event): string {
    const parts = [event.type];
    for (const key of Object.keys(event.data).sort()) {
        parts.push(`${key}:${event.data[key]}`);
    }
    return parts.join('|');
}
```

---

### 5. EventHistory

**Purpose**: Tracks event history for debugging and replay.

**Class Structure**:

```typescript
class EventHistory {
    private events: Event[];
    private maxHistory: number;

    record(event: Event): void;
    getEventsOfType(eventType: string): Event[];
    getEventsMatching(pattern: EventPattern): Event[];
    getRecent(count: number): Event[];
    clear(): void;
}
```

**Use Cases**:

- Debugging ("Why did this happen?")
- Replay systems
- AI training (RL needs complete history)
- Undo/redo functionality
- Analytics and telemetry

---

### 6. EventBuilder

**Purpose**: Helper for building common event types.

**Static Methods**:

```typescript
class EventBuilder {
    static actionExecuted(action: Action): Event;
    static entityCreated(entity: Entity): Event;
    static entityDestroyed(entity: Entity): Event;
    static resourceChanged(
        entityId: string,
        resourceName: string,
        oldValue: number,
        newValue: number
    ): Event;
    static phaseChanged(
        fromPhase: string,
        toPhase: string,
        activePlayer?: string
    ): Event;
    static turnStarted(playerId: string, turnNumber: number): Event;
    static turnEnded(playerId: string, turnNumber: number): Event;
}
```

**Example Usage**:

```typescript
// Instead of manually creating events
const event = new Event('CardPlayed', {
  cardId: card.id,
  playerId: player.id,
  timestamp: Date.now(),
  id: generateId()
});

// Use builder
const event = EventBuilder.cardPlayed(card, player);
```

---

## Event Processing

### Event Flow Diagram

```
Action Executed
   ↓
Generate Events (from effects)
   ↓
Add to EventQueue
   ↓
EventProcessor.processAll()
   ↓
   ┌─────────────────────┐
   │ While queue not empty│
   └─────────┬───────────┘
             ↓
   ┌─────────────────────┐
   │ Pop next event      │
   └─────────┬───────────┘
             ↓
   ┌─────────────────────┐
   │ Check cycle         │
   │ (event signature)   │
   └─────────┬───────────┘
             ↓
   ┌─────────────────────┐
   │ RuleEngine.process  │
   │ - Match rules       │
   │ - Check conditions  │
   │ - Apply effects     │
   └─────────┬───────────┘
             ↓
   ┌─────────────────────┐
   │ Collect new events  │
   │ from rule effects   │
   └─────────┬───────────┘
             ↓
   Add new events to queue
   Loop back ──┘
             ↓
   Return final state
```

### Integration with Action System

```typescript
// After action execution
const [newState, events] = actionSystem.executeAction(state, action);

// Create event queue
const queue = new EventQueue();
queue.addMultiple(events);

// Process all events
const eventProcessor = new EventProcessor(ruleEngine);
const finalState = eventProcessor.processAll(newState, queue);
```

---

## Event Examples

### Example 1: Simple Event Generation

```typescript
// Action generates events
const playCardAction = new ActionDefinition({
    name: 'PlayCard',
    effects: [
        new MoveEntity('board', 'actor'),
        new EmitEvent('CardPlayed', ctx => ({
            cardId: ctx.actor.id,
            playerId: ctx.state.activePlayer,
            cardType: ctx.actor.get('Card').type,
        })),
    ],
});

// Execution produces event
const [newState, events] = actionSystem.executeAction(state, action);
// events = [
//   { type: 'ActionExecuted', data: { actionType: 'PlayCard', ... } },
//   { type: 'CardPlayed', data: { cardId: 'card1', playerId: 'player1', cardType: 'Spell' } }
// ]
```

### Example 2: Event Cascade

```typescript
// Initial action
PlayCard → CardPlayed event
              ↓
// Rule triggers on CardPlayed
Rule: "When spell is played, draw a card"
  → DrawCard action executed
      ↓
      CardDrawn event
          ↓
// Another rule triggers on CardDrawn
Rule: "When you draw your 10th card, gain 5 health"
  → Heal effect
      ↓
      ResourceChanged event
          ↓
// Rules cascade until no more triggers
```

### Example 3: Cycle Detection

```typescript
// Bad rule configuration (infinite loop)
Rule A: "When ResourceChanged, emit CustomEvent"
Rule B: "When CustomEvent, modify resource"

// Without cycle detection:
ResourceChanged → CustomEvent → ResourceChanged → CustomEvent → ...

// With cycle detection:
EventProcessor sees repeated "ResourceChanged:health:player1" signature
Logs warning and breaks cycle
```

---

# Part 3: Rule Engine

## Rule Engine

### Overview

The Rule Engine is the heart of the game logic system. It listens for events, checks conditions, and applies effects. This is where game mechanics like "when a card is played, draw another card" are implemented.

**Key Responsibilities**:

- Match events to rules
- Check rule conditions
- Execute rule effects
- Generate new events from rule effects
- Manage rule priorities and ordering

---

## Rule Engine Core Components

### 1. Rule

**Purpose**: Represents a game rule that responds to events.

**Type Definition**:

```typescript
interface Rule {
    id: string; // Unique identifier
    trigger: EventPattern; // What event activates this rule
    conditions: Condition[]; // Additional checks before executing
    effects: Effect[]; // What happens when rule fires
    priority: number; // Resolution order (higher = first)
    source?: string; // Entity this rule belongs to (or null for global)
}
```

**Properties**:

- **id**: Unique identifier for the rule
- **trigger**: EventPattern that activates this rule
- **conditions**: Additional checks that must pass (beyond event matching)
- **effects**: State modifications to apply (reuses Effect from Action System)
- **priority**: When multiple rules trigger, this determines order
- **source**: Optional entity ID if rule is attached to specific entity

**Rule Types**:

1. **Global Rules**: Always active, not attached to any entity
2. **Entity Rules**: Attached to specific entities (e.g., card abilities)
3. **Temporary Rules**: Created dynamically and removed later
4. **Passive Rules**: Always listening
5. **Triggered Rules**: Fire once then are removed

---

### 2. Condition

**Purpose**: A check that must pass before rule effects execute.

**Interface**:

```typescript
interface Condition {
    type: string; // Condition type identifier
    parameters: Record<string, any>; // Condition-specific data

    evaluate(state: GameState, context: RuleContext): boolean;
}
```

**Common Condition Types**:

#### EntityHasComponent

```typescript
class EntityHasComponent implements Condition {
    constructor(
        entitySelector: string | ((context: RuleContext) => Entity),
        componentType: string
    );
}
```

Checks if an entity has a specific component

#### ResourceComparison

```typescript
class ResourceComparison implements Condition {
    constructor(
        entitySelector: string | ((context: RuleContext) => Entity),
        resourceName: string,
        operator: '==' | '!=' | '<' | '>' | '<=' | '>=',
        value: number | ((context: RuleContext) => number)
    );
}
```

Compares a resource value

#### EntityCount

```typescript
class EntityCount implements Condition {
    constructor(
        selector: string,
        operator: '==' | '!=' | '<' | '>' | '<=' | '>=',
        count: number
    );
}
```

Checks number of entities matching a selector

#### PhaseIs

```typescript
class PhaseIs implements Condition {
    constructor(phases: string[]);
}
```

Checks if current phase matches

#### CustomCondition

```typescript
class CustomCondition implements Condition {
    constructor(
        evaluateFn: (state: GameState, context: RuleContext) => boolean
    );
}
```

Custom lambda-based condition

**Example Conditions**:

```typescript
// Check if player has more than 10 health
new ResourceComparison('player1', 'health', '>', 10);

// Check if there are 3+ creatures on board
new EntityCount('zone == "board" AND type == "Creature"', '>=', 3);

// Check if it's the combat phase
new PhaseIs(['Combat']);

// Custom: Check if player has any cards in hand
new CustomCondition((state, ctx) => {
    const hand = state.query(
        `zone == "hand" AND owner == "${ctx.event.data.playerId}"`
    );
    return hand.length > 0;
});
```

---

### 3. RuleContext

**Purpose**: Bundles information needed during rule evaluation.

**Type Definition**:

```typescript
interface RuleContext {
    state: GameState; // Current game state
    event: Event; // The event that triggered this rule
    rule: Rule; // The rule being evaluated
    matchedEntities: Entity[]; // Entities from event pattern matching
}
```

**Usage**:

- Passed to conditions during evaluation
- Passed to effects during execution
- Provides convenient access to event data and matched entities

---

### 4. RuleEngine

**Purpose**: Central manager for all game rules.

**Class Structure**:

```typescript
class RuleEngine {
    private globalRules: Rule[];
    private entityRules: Map<string, Rule[]>; // entityId -> rules

    addGlobalRule(rule: Rule): void;
    removeGlobalRule(ruleId: string): void;
    addEntityRule(entityId: string, rule: Rule): void;
    removeEntityRule(entityId: string, ruleId: string): void;

    processEvent(state: GameState, event: Event): [GameState, Event[]];
    getAllActiveRules(state: GameState): Rule[];
}
```

**Rule Storage**:

- **Global Rules**: Stored in array, always checked
- **Entity Rules**: Stored in map by entity ID
    - Only checked if entity exists in state
    - Automatically cleaned up when entity destroyed

---

### 5. Rule Processing

**Algorithm**:

```typescript
function processEvent(state: GameState, event: Event): [GameState, Event[]] {
    // 1. Find all matching rules
    const triggeredRules: Rule[] = [];

    // Check global rules
    for (const rule of this.globalRules) {
        if (rule.trigger.matches(event)) {
            triggeredRules.push(rule);
        }
    }

    // Check entity-specific rules
    for (const [entityId, rules] of this.entityRules) {
        if (state.entities.has(entityId)) {
            for (const rule of rules) {
                if (rule.trigger.matches(event)) {
                    triggeredRules.push(rule);
                }
            }
        }
    }

    // 2. Sort by priority (higher priority first)
    triggeredRules.sort((a, b) => b.priority - a.priority);

    // 3. Execute rules in priority order
    let newState = state;
    const generatedEvents: Event[] = [];

    for (const rule of triggeredRules) {
        const context: RuleContext = {
            state: newState,
            event: event,
            rule: rule,
            matchedEntities: [], // Could extract from event
        };

        // Check all conditions
        const allConditionsPass = rule.conditions.every(condition =>
            condition.evaluate(newState, context)
        );

        if (allConditionsPass) {
            // Apply effects
            for (const effect of rule.effects) {
                // Create action context for effect
                const actionContext = createActionContextForRule(context);
                newState = effect.apply(actionContext);

                // Collect generated events
                if (effect.generatesEvent()) {
                    const event = effect.createEvent(actionContext);
                    if (event) {
                        generatedEvents.push(event);
                    }
                }
            }
        }
    }

    return [newState, generatedEvents];
}
```

---

## Rule Execution

### Execution Flow

```
Event Arrives
   ↓
RuleEngine.processEvent()
   ↓
┌──────────────────────────────┐
│ 1. Find Matching Rules       │
│    - Check global rules      │
│    - Check entity rules      │
│    - Filter by trigger match │
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────┐
│ 2. Sort by Priority          │
│    (higher priority first)   │
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────┐
│ 3. For each rule:            │
│    ┌──────────────────────┐ │
│    │ Check conditions     │ │
│    └──────┬───────────────┘ │
│           ↓                  │
│    ┌──────────────────────┐ │
│    │ If all pass:         │ │
│    │ - Apply effects      │ │
│    │ - Collect events     │ │
│    └──────────────────────┘ │
└──────────┬───────────────────┘
           ↓
Return [new state, events]
```

### Priority System

Rules with higher priority execute first. This is crucial for:

- Replacement effects ("instead of drawing, do X")
- Prevention effects ("prevent the next N damage")
- Layering complex interactions

**Priority Guidelines**:

- **1000+**: Replacement effects (happen "instead of")
- **500-999**: Modification effects (change values)
- **100-499**: Triggered abilities (normal rule effects)
- **0-99**: Cleanup and passive effects

**Example**:

```typescript
// Priority 1000: Replacement effect
new Rule({
  id: "replacement_draw",
  trigger: new EventPattern("CardDrawn"),
  conditions: [new CustomCondition(ctx => ctx.state.hasEffect("ReplaceDraws"))],
  effects: [
    new CancelEvent(),  // Cancel the normal draw
    new CreateEntity("Token", {...})  // Create token instead
  ],
  priority: 1000
});

// Priority 500: Modification effect
new Rule({
  id: "double_draws",
  trigger: new EventPattern("CardDrawn"),
  effects: [
    new DrawCard()  // Draw an additional card
  ],
  priority: 500
});

// Priority 100: Normal triggered ability
new Rule({
  id: "card_drawn_trigger",
  trigger: new EventPattern("CardDrawn"),
  effects: [
    new ModifyResource("life", 1)  // Gain 1 life
  ],
  priority: 100
});
```

---

## Rule Examples

### Example 1: Simple Triggered Ability

```typescript
// "When you draw a card, gain 1 life"
const lifeGainOnDrawRule = new Rule({
    id: 'life_on_draw',
    trigger: new EventPattern('CardDrawn', {
        playerId: 'player1', // Only for player1
    }),
    conditions: [], // No additional conditions
    effects: [new ModifyResource('life', 1, 'player', 'add')],
    priority: 100,
});

ruleEngine.addGlobalRule(lifeGainOnDrawRule);
```

### Example 2: Conditional Rule

```typescript
// "When you play a spell, if you have 10+ cards in hand, draw a card"
const spellDrawRule = new Rule({
    id: 'spell_draw',
    trigger: new EventPattern('CardPlayed', {
        cardType: type => type === 'Spell',
    }),
    conditions: [
        new EntityCount(
            `zone == "hand" AND owner == "${event.data.playerId}"`,
            '>=',
            10
        ),
    ],
    effects: [
        new EmitEvent('DrawCard', ctx => ({
            playerId: ctx.event.data.playerId,
        })),
    ],
    priority: 100,
});
```

### Example 3: Entity-Attached Rule

```typescript
// Card ability: "When this creature attacks, draw a card"
const creatureAbility = new Rule({
    id: 'attack_draw',
    trigger: new EventPattern('EntityAttacked', {
        attackerId: id => id === creatureId, // Only when THIS creature attacks
    }),
    conditions: [],
    effects: [
        new EmitEvent('DrawCard', ctx => ({
            playerId: ctx.state.getEntity(creatureId).get('Owner').id,
        })),
    ],
    priority: 100,
    source: creatureId,
});

// Attach to entity
ruleEngine.addEntityRule(creatureId, creatureAbility);

// When entity is destroyed, rule is automatically inactive
```

### Example 4: Replacement Effect

```typescript
// "If you would draw a card, create a token instead"
const replacementRule = new Rule({
    id: 'replace_draw',
    trigger: new EventPattern('CardDrawn'),
    conditions: [
        new CustomCondition((state, ctx) =>
            state.hasEffect('ReplaceDrawsWithTokens')
        ),
    ],
    effects: [
        new CancelEvent(), // Prevent the draw
        new CreateEntity('Token', {
            type: 'Creature',
            power: 1,
            toughness: 1,
        }),
    ],
    priority: 1000, // High priority to execute before other draw triggers
});
```

### Example 5: Complex Rule Chain

```typescript
// Setup multiple rules that interact

// Rule 1: "When you play a creature, draw a card"
const rule1 = new Rule({
  id: "creature_draw",
  trigger: new EventPattern("CardPlayed", {
    cardType: "Creature"
  }),
  effects: [new EmitEvent("DrawCard", ...)],
  priority: 100
});

// Rule 2: "When you draw a card, gain 1 life"
const rule2 = new Rule({
  id: "draw_life",
  trigger: new EventPattern("CardDrawn"),
  effects: [new ModifyResource("life", 1)],
  priority: 100
});

// Rule 3: "When your life increases, deal 1 damage to opponent"
const rule3 = new Rule({
  id: "life_damage",
  trigger: new EventPattern("ResourceChanged", {
    resourceName: "life",
    delta: (d) => d > 0
  }),
  effects: [new ModifyResource("life", -1, "opponent")],
  priority: 100
});

// Execution chain:
// Play Creature → CardPlayed event
//   → Rule 1 triggers → DrawCard event
//     → Rule 2 triggers → Life +1 → ResourceChanged event
//       → Rule 3 triggers → Opponent life -1
```

---

# Part 4: Phase Management

## Phase System

### Overview

The Phase System controls the flow of the game through different phases and turns. It manages which actions are legal when, automates phase transitions, and triggers phase-based events.

**Key Responsibilities**:

- Define game phases and their properties
- Control phase transitions
- Enforce phase restrictions on actions
- Auto-advance phases when appropriate
- Emit phase change events

---

## Phase System Core Components

### 1. Phase

**Purpose**: Represents the current state of game flow.

**Type Definition**:

```typescript
interface Phase {
    name: string; // Phase identifier
    activePlayer?: string; // Who can act (if applicable)
    allowedActionTypes: Set<string>; // What actions are legal
    autoAdvance: boolean; // Should phase auto-advance?
    autoAdvanceCondition?: (state: GameState) => boolean;
    subPhase?: Phase; // For nested phases
    metadata?: Record<string, any>; // Phase-specific data
}
```

**Properties**:

- **name**: Unique identifier for the phase (e.g., "Upkeep", "Main", "Combat")
- **activePlayer**: Which player can take actions (null for simultaneous phases)
- **allowedActionTypes**: Whitelist of action types legal in this phase
- **autoAdvance**: Whether phase automatically advances
- **autoAdvanceCondition**: Optional function to check if ready to advance
- **subPhase**: For complex phases with sub-steps (e.g., Combat has multiple sub-phases)

---

### 2. PhaseDefinition

**Purpose**: Template defining phase behavior.

**Type Definition**:

```typescript
interface PhaseDefinition {
    name: string;
    allowedActionTypes: string[];
    onEnter?: (state: GameState) => GameState;
    onExit?: (state: GameState) => GameState;
    autoAdvance?: boolean;
    autoAdvanceCondition?: (state: GameState) => boolean;
    nextPhase?: string | ((state: GameState) => string);
    subPhases?: PhaseDefinition[];
}
```

**Lifecycle Hooks**:

- **onEnter**: Called when entering phase (e.g., untap all permanents)
- **onExit**: Called when leaving phase (e.g., discard to hand size)

---

### 3. PhaseManager

**Purpose**: Manages phase transitions and phase-related logic.

**Class Structure**:

```typescript
class PhaseManager {
    private phaseDefinitions: Map<string, PhaseDefinition>;
    private phaseHistory: Phase[];

    registerPhase(definition: PhaseDefinition): void;
    getCurrentPhase(state: GameState): Phase;
    canAdvancePhase(state: GameState): boolean;
    advancePhase(state: GameState): GameState;
    canPerformAction(state: GameState, actionType: string): boolean;
    getNextPhase(state: GameState): string;
}
```

---

### 4. Phase Transition

**Algorithm**:

```typescript
function advancePhase(state: GameState): GameState {
    const currentPhase = state.phase;
    const currentDef = this.phaseDefinitions.get(currentPhase.name);

    // 1. Execute onExit for current phase
    let newState = state;
    if (currentDef.onExit) {
        newState = currentDef.onExit(newState);
    }

    // 2. Determine next phase
    const nextPhaseName = this.getNextPhase(newState);
    const nextDef = this.phaseDefinitions.get(nextPhaseName);

    // 3. Create new Phase object
    const nextPhase: Phase = {
        name: nextPhaseName,
        activePlayer: this.determineActivePlayer(newState, nextDef),
        allowedActionTypes: new Set(nextDef.allowedActionTypes),
        autoAdvance: nextDef.autoAdvance || false,
        autoAdvanceCondition: nextDef.autoAdvanceCondition,
    };

    // 4. Update state
    newState = newState.clone();
    newState.phase = nextPhase;
    newState.phaseHistory.push(nextPhase);

    // 5. Execute onEnter for new phase
    if (nextDef.onEnter) {
        newState = nextDef.onEnter(newState);
    }

    // 6. Emit PhaseChanged event
    const event = EventBuilder.phaseChanged(
        currentPhase.name,
        nextPhase.name,
        nextPhase.activePlayer
    );
    newState.eventQueue.push(event);

    return newState;
}
```

---

## Phase Transitions

### Transition Flow

```
Current Phase
     ↓
Check if can advance
(autoAdvanceCondition or explicit call)
     ↓
Execute onExit() for current phase
     ↓
Determine next phase name
     ↓
Create new Phase object
     ↓
Update state.phase
     ↓
Execute onEnter() for new phase
     ↓
Emit PhaseChanged event
     ↓
Process event through RuleEngine
(triggers phase-based rules)
```

### Auto-Advance

Some phases automatically advance when certain conditions are met:

```typescript
const mainPhase = new PhaseDefinition({
    name: 'Main',
    allowedActionTypes: ['PlayCard', 'ActivateAbility'],
    autoAdvance: false, // Player must explicitly end turn
});

const drawPhase = new PhaseDefinition({
    name: 'Draw',
    allowedActionTypes: ['DrawCard'],
    autoAdvance: true,
    autoAdvanceCondition: state => {
        // Auto-advance after drawing 1 card
        const events = state.getRecentEvents(1);
        return events.some(e => e.type === 'CardDrawn');
    },
    nextPhase: 'Main',
});

const cleanupPhase = new PhaseDefinition({
    name: 'Cleanup',
    allowedActionTypes: [],
    autoAdvance: true,
    autoAdvanceCondition: state => true, // Always advance immediately
    nextPhase: state => {
        // Next player's turn
        const nextPlayer = getNextPlayer(state);
        return 'Upkeep';
    },
    onExit: state => {
        // Discard to hand size
        return enforceHandSize(state);
    },
});
```

---

## Phase Examples

### Example 1: Simple Turn Structure

```typescript
// Basic turn structure: Upkeep → Main → End
const turnPhases = [
    new PhaseDefinition({
        name: 'Upkeep',
        allowedActionTypes: [],
        autoAdvance: true,
        onEnter: state => {
            // Untap all, draw card
            return state;
        },
        nextPhase: 'Main',
    }),

    new PhaseDefinition({
        name: 'Main',
        allowedActionTypes: ['PlayCard', 'ActivateAbility', 'Attack'],
        autoAdvance: false, // Player decides when to end
        nextPhase: 'End',
    }),

    new PhaseDefinition({
        name: 'End',
        allowedActionTypes: [],
        autoAdvance: true,
        onExit: state => {
            // Discard to hand size
            return enforceHandSize(state);
        },
        nextPhase: state => {
            // Switch to next player
            state.activePlayer = getNextPlayer(state);
            return 'Upkeep';
        },
    }),
];

phaseManager.registerPhases(turnPhases);
```

### Example 2: Combat with Sub-Phases

```typescript
const combatPhase = new PhaseDefinition({
    name: 'Combat',
    allowedActionTypes: [],
    subPhases: [
        {
            name: 'DeclareAttackers',
            allowedActionTypes: ['DeclareAttacker'],
            autoAdvance: false,
            onEnter: state => {
                // Mark all creatures as potential attackers
                return state;
            },
        },
        {
            name: 'DeclareBlockers',
            allowedActionTypes: ['DeclareBlocker'],
            autoAdvance: false,
            activePlayer: state => getOpponent(state.activePlayer),
            onEnter: state => {
                // Defending player can block
                return state;
            },
        },
        {
            name: 'CombatDamage',
            allowedActionTypes: [],
            autoAdvance: true,
            onEnter: state => {
                // Resolve all combat damage
                return resolveCombatDamage(state);
            },
            nextPhase: 'Main',
        },
    ],
});
```

### Example 3: Simultaneous Action Phase

```typescript
// Phase where all players act simultaneously
const draftPhase = new PhaseDefinition({
    name: 'Draft',
    allowedActionTypes: ['SelectCard'],
    activePlayer: null, // All players can act
    autoAdvance: false,
    autoAdvanceCondition: state => {
        // Advance when all players have selected
        return state.getAllPlayers().every(p => p.hasSelectedCard);
    },
    onExit: state => {
        // Pass packs to next player
        return rotatePacks(state);
    },
});
```

### Example 4: Phase-Based Rules

```typescript
// Rules that only trigger in specific phases

// "At the beginning of your upkeep, draw a card"
const upkeepDrawRule = new Rule({
    id: 'upkeep_draw',
    trigger: new EventPattern('PhaseChanged', {
        to_phase: 'Upkeep',
        active_player: 'player1',
    }),
    conditions: [],
    effects: [new EmitEvent('DrawCard', { playerId: 'player1' })],
    priority: 100,
});

// "At the end of turn, discard down to 7 cards"
const handSizeRule = new Rule({
    id: 'hand_size',
    trigger: new EventPattern('PhaseChanged', {
        to_phase: 'End',
    }),
    conditions: [
        new CustomCondition((state, ctx) => {
            const hand = state.query(
                `zone == "hand" AND owner == "${ctx.event.data.active_player}"`
            );
            return hand.length > 7;
        }),
    ],
    effects: [new ForceDiscard(/* discard until 7 */)],
    priority: 100,
});
```

---

# Part 5: Integration & Architecture

## System Integration

### How Systems Work Together

```
┌─────────────────────────────────────────────────────────┐
│                     GAME ENGINE                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐      ┌──────────────┐                │
│  │  GameState   │◄────►│ ActionSystem │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                     │                         │
│         │                     ↓                         │
│         │              [State, Events]                  │
│         │                     │                         │
│         ↓                     ↓                         │
│  ┌──────────────┐      ┌──────────────┐                │
│  │ PhaseManager │      │ EventQueue   │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                     │                         │
│         │                     ↓                         │
│         │              ┌──────────────┐                │
│         │              │EventProcessor│                │
│         │              └──────┬───────┘                │
│         │                     │                         │
│         │                     ↓                         │
│         │              ┌──────────────┐                │
│         └─────────────►│ RuleEngine   │                │
│                        └──────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Player Input
   ↓
2. ActionSystem generates valid actions
   ↓
3. Player selects action
   ↓
4. ActionSystem executes action
   ↓
5. Action produces [NewState, Events]
   ↓
6. Events added to EventQueue
   ↓
7. EventProcessor processes queue
   ↓
8. For each event:
   - RuleEngine finds matching rules
   - Rules checked and executed
   - New events generated
   - Added back to queue
   ↓
9. Loop until queue empty
   ↓
10. Check phase auto-advance
    ↓
11. If should advance:
    - PhaseManager transitions phase
    - Phase change emits event
    - Back to step 7
    ↓
12. Final state ready for next action
```

---

## Complete Game Loop

### Full Game Engine Implementation

```typescript
class GameEngine {
    private state: GameState;
    private actionSystem: ActionSystem;
    private ruleEngine: RuleEngine;
    private eventProcessor: EventProcessor;
    private phaseManager: PhaseManager;
    private eventHistory: EventHistory;

    constructor(gameDefinition: GameDefinition) {
        this.state = gameDefinition.createInitialState();
        this.actionSystem = new ActionSystem(gameDefinition.actions);
        this.ruleEngine = new RuleEngine(gameDefinition.rules);
        this.eventProcessor = new EventProcessor(this.ruleEngine);
        this.phaseManager = new PhaseManager(gameDefinition.phases);
        this.eventHistory = new EventHistory();
    }

    // Get valid actions for current player
    getValidActions(playerId: string): Action[] {
        return this.actionSystem.getValidActions(this.state, playerId);
    }

    // Execute a player action
    performAction(action: Action): void {
        try {
            // 1. Execute action
            const [newState, events] = this.actionSystem.executeAction(
                this.state,
                action
            );

            // 2. Create event queue
            const queue = new EventQueue();
            queue.addMultiple(events);

            // 3. Process all events through rule engine
            let finalState = this.eventProcessor.processAll(newState, queue);

            // 4. Record events in history
            events.forEach(e => this.eventHistory.record(e));

            // 5. Check for win conditions
            const winner = this.checkWinConditions(finalState);
            if (winner) {
                finalState.phase = new Phase({
                    name: 'GameOver',
                    winner: winner,
                });
            }

            // 6. Auto-advance phase if needed
            while (this.shouldAutoAdvancePhase(finalState)) {
                finalState = this.advancePhaseWithEvents(finalState);
            }

            // 7. Update state
            this.state = finalState;
        } catch (error) {
            console.error('Action execution failed:', error);
            throw error;
        }
    }

    // Advance phase and process resulting events
    private advancePhaseWithEvents(state: GameState): GameState {
        // Advance phase
        const newState = this.phaseManager.advancePhase(state);

        // Process phase change events
        const queue = new EventQueue();
        queue.addMultiple(newState.eventQueue);
        newState.eventQueue = [];

        const finalState = this.eventProcessor.processAll(newState, queue);
        return finalState;
    }

    private shouldAutoAdvancePhase(state: GameState): boolean {
        const currentPhase = state.phase;
        if (!currentPhase.autoAdvance) return false;

        if (currentPhase.autoAdvanceCondition) {
            return currentPhase.autoAdvanceCondition(state);
        }

        return true;
    }

    private checkWinConditions(state: GameState): string | null {
        // Check each player for win conditions
        for (const player of state.getAllPlayers()) {
            if (this.hasWon(state, player.id)) {
                return player.id;
            }
        }
        return null;
    }

    private hasWon(state: GameState, playerId: string): boolean {
        // Game-specific win condition logic
        // Example: opponent has 0 life
        const opponents = state.getOpponents(playerId);
        return opponents.every(opp => {
            const life = opp.get('Resources')?.life || 0;
            return life <= 0;
        });
    }

    // Get state filtered for specific player (hides hidden information)
    getStateForPlayer(playerId: string): GameState {
        return this.state.getPlayerView(playerId);
    }

    // Get event history
    getEventHistory(): Event[] {
        return this.eventHistory.events;
    }

    // Undo last action (if history is maintained)
    undo(): void {
        // Implementation depends on state history tracking
    }

    // Save/load game state
    serialize(): string {
        return JSON.stringify({
            state: this.state.serialize(),
            history: this.eventHistory.events,
        });
    }

    deserialize(data: string): void {
        const parsed = JSON.parse(data);
        this.state = GameState.deserialize(parsed.state);
        this.eventHistory.events = parsed.history;
    }
}
```

### Usage Example

```typescript
// 1. Define game
const gameDefinition = new GameDefinition({
    name: 'MyCardGame',
    actions: [drawCardAction, playCardAction, attackAction, endTurnAction],
    rules: [upkeepDrawRule, cardPlayTrigger, combatDamageRule],
    phases: [upkeepPhase, mainPhase, combatPhase, endPhase],
    initialState: () => createInitialGameState(),
});

// 2. Create engine
const engine = new GameEngine(gameDefinition);

// 3. Game loop
while (!engine.isGameOver()) {
    const currentPlayer = engine.getCurrentPlayer();

    // Get valid actions
    const validActions = engine.getValidActions(currentPlayer);

    // Player/AI selects action
    const selectedAction = await getPlayerInput(validActions);

    // Execute action
    engine.performAction(selectedAction);

    // Display state
    displayGameState(engine.getStateForPlayer(currentPlayer));
}

// 4. Game over
const winner = engine.getWinner();
console.log(`Game over! Winner: ${winner}`);
```

---

## Error Handling

### Error Types

```typescript
// Base error class
class GameEngineError extends Error {
    constructor(
        message: string,
        public context?: any
    ) {
        super(message);
        this.name = 'GameEngineError';
    }
}

// Specific error types
class ActionValidationError extends GameEngineError {
    constructor(
        action: Action,
        public failedPrecondition: Precondition,
        message: string
    ) {
        super(message, { action });
        this.name = 'ActionValidationError';
    }
}

class ActionExecutionError extends GameEngineError {
    constructor(
        action: Action,
        public failedAt: 'precondition' | 'cost' | 'effect',
        cause: Error
    ) {
        super(`Action execution failed at ${failedAt}: ${cause.message}`, {
            action,
            cause,
        });
        this.name = 'ActionExecutionError';
    }
}

class RuleExecutionError extends GameEngineError {
    constructor(rule: Rule, event: Event, cause: Error) {
        super(`Rule execution failed: ${cause.message}`, {
            rule,
            event,
            cause,
        });
        this.name = 'RuleExecutionError';
    }
}

class InfiniteLoopError extends GameEngineError {
    constructor(
        public eventSignature: string,
        public iterationCount: number
    ) {
        super(`Infinite loop detected: ${eventSignature}`, {
            eventSignature,
            iterationCount,
        });
        this.name = 'InfiniteLoopError';
    }
}

class InvalidStateError extends GameEngineError {
    constructor(
        message: string,
        public state: GameState
    ) {
        super(message, { state });
        this.name = 'InvalidStateError';
    }
}
```

### Error Handling Strategy

```typescript
class GameEngine {
    performAction(action: Action): void {
        try {
            // Validation phase
            const [valid, error] = this.actionSystem.validateAction(
                this.state,
                action
            );

            if (!valid) {
                throw new ActionValidationError(
                    action,
                    null,
                    error || 'Unknown validation error'
                );
            }

            // Execution phase
            const [newState, events] = this.actionSystem.executeAction(
                this.state,
                action
            );

            // Event processing phase
            const queue = new EventQueue();
            queue.addMultiple(events);

            let finalState: GameState;
            try {
                finalState = this.eventProcessor.processAll(newState, queue);
            } catch (error) {
                if (error instanceof InfiniteLoopError) {
                    // Log the loop and continue with current state
                    console.error('Infinite loop detected:', error);
                    finalState = newState;
                } else {
                    throw error;
                }
            }

            // Update state
            this.state = finalState;
        } catch (error) {
            // Log error
            this.logError(error);

            // Rethrow or handle gracefully
            if (error instanceof ActionValidationError) {
                // User error - show message and allow retry
                throw error;
            } else if (error instanceof InfiniteLoopError) {
                // System error - log but continue
                console.error('System error:', error);
            } else {
                // Unknown error - rethrow
                throw error;
            }
        }
    }

    private logError(error: Error): void {
        // Send to logging service
        console.error({
            type: error.name,
            message: error.message,
            stack: error.stack,
            context: (error as GameEngineError).context,
            gameState: this.state.serialize(),
        });
    }
}
```

---

## Performance Considerations

### 1. Action Generation Optimization

**Problem**: `getValidActions()` can generate thousands of possible actions.

**Solutions**:

#### Caching

```typescript
class ActionSystem {
    private actionCache: Map<string, Action[]> = new Map();

    getValidActions(state: GameState, playerId: string): Action[] {
        const cacheKey = this.getCacheKey(state, playerId);

        if (this.actionCache.has(cacheKey)) {
            return this.actionCache.get(cacheKey);
        }

        const actions = this.generateValidActions(state, playerId);
        this.actionCache.set(cacheKey, actions);

        return actions;
    }

    private getCacheKey(state: GameState, playerId: string): string {
        // Create hash from relevant state
        return `${state.hash()}:${playerId}`;
    }

    // Invalidate cache when state changes
    invalidateCache(): void {
        this.actionCache.clear();
    }
}
```

#### Lazy Generation

```typescript
class ActionSystem {
    *getValidActionsLazy(
        state: GameState,
        playerId: string
    ): IterableIterator<Action> {
        for (const actionDef of this.actionDefinitions.values()) {
            for (const action of this.generateActionVariants(
                state,
                playerId,
                actionDef
            )) {
                if (this.isValidAction(state, action)) {
                    yield action;
                }
            }
        }
    }
}

// Usage
for (const action of actionSystem.getValidActionsLazy(state, playerId)) {
    // Process one action at a time
    if (someCondition(action)) break; // Can early-exit
}
```

#### Incremental Updates

```typescript
class ActionSystem {
    private invalidatedActionTypes: Set<string> = new Set();

    markActionTypeInvalidated(actionType: string): void {
        this.invalidatedActionTypes.add(actionType);
    }

    getValidActions(state: GameState, playerId: string): Action[] {
        // Only regenerate invalidated action types
        for (const actionType of this.invalidatedActionTypes) {
            this.regenerateActions(state, playerId, actionType);
        }
        this.invalidatedActionTypes.clear();

        return this.getAllCachedActions(playerId);
    }
}
```

### 2. Event Processing Optimization

**Problem**: Event cascades can create hundreds of events.

**Solutions**:

#### Event Batching

```typescript
class EventProcessor {
    processAll(state: GameState, queue: EventQueue): GameState {
        // Batch events by type for more efficient processing
        const eventBatches = this.groupEventsByType(queue);

        let newState = state;
        for (const [eventType, events] of eventBatches) {
            newState = this.processBatch(newState, events);
        }

        return newState;
    }
}
```

#### Rule Indexing

```typescript
class RuleEngine {
    private ruleIndex: Map<string, Rule[]> = new Map();

    addGlobalRule(rule: Rule): void {
        // Index by event type
        const eventType = rule.trigger.eventType;
        if (!this.ruleIndex.has(eventType)) {
            this.ruleIndex.set(eventType, []);
        }
        this.ruleIndex.get(eventType).push(rule);
    }

    processEvent(state: GameState, event: Event): [GameState, Event[]] {
        // Only check rules indexed for this event type
        const relevantRules = this.ruleIndex.get(event.type) || [];
        const wildcardRules = this.ruleIndex.get('*') || [];

        const allRules = [...relevantRules, ...wildcardRules];

        // Process only relevant rules
        return this.executeRules(state, event, allRules);
    }
}
```

### 3. State Cloning Optimization

**Problem**: Cloning entire GameState for every mutation is expensive.

**Solutions**:

#### Structural Sharing with Immer

```typescript
import { produce } from 'immer';

class GameState {
    clone(): GameState {
        // Immer creates copy-on-write proxy
        return produce(this, draft => {
            // draft is a mutable proxy
            // Only changed parts are actually copied
        });
    }
}
```

#### Selective Cloning

```typescript
class GameState {
    cloneForEffect(effect: Effect): GameState {
        // Only clone parts that effect will modify
        if (effect.type === 'ModifyResource') {
            return this.cloneResources();
        } else if (effect.type === 'MoveEntity') {
            return this.cloneEntities();
        }
        // Full clone as fallback
        return this.clone();
    }
}
```

### 4. Memory Management

**Problem**: Keeping too many state snapshots in memory.

**Solutions**:

#### Limited History

```typescript
class GameEngine {
    private stateHistory: GameState[] = [];
    private maxHistory = 10; // Keep last 10 states for undo

    performAction(action: Action): void {
        // Save current state
        this.stateHistory.push(this.state);

        // Trim history
        if (this.stateHistory.length > this.maxHistory) {
            this.stateHistory.shift();
        }

        // Execute action...
    }
}
```

#### State Compression

```typescript
class GameState {
    serialize(): string {
        // Only serialize changed data
        const diff = this.getDiffFromInitial();
        return JSON.stringify(diff);
    }

    static deserialize(data: string, initialState: GameState): GameState {
        const diff = JSON.parse(data);
        return initialState.applyDiff(diff);
    }
}
```

---

## Testing Strategy

### 1. Unit Tests

Test individual components in isolation:

```typescript
describe('ActionSystem', () => {
    describe('validateAction', () => {
        it('rejects action when not player turn', () => {
            const state = createState({ activePlayer: 'player1' });
            const action = createAction({ actorId: 'player2' });

            const [valid, error] = actionSystem.validateAction(state, action);

            expect(valid).toBe(false);
            expect(error).toContain('not your turn');
        });

        it('accepts action when all preconditions pass', () => {
            const state = createState({
                activePlayer: 'player1',
                entities: {
                    player1: createPlayer({ mana: 10 }),
                    card1: createCard({ cost: 5 }),
                },
            });
            const action = createAction({
                type: 'PlayCard',
                actorId: 'card1',
            });

            const [valid, error] = actionSystem.validateAction(state, action);

            expect(valid).toBe(true);
            expect(error).toBeNull();
        });
    });
});

describe('RuleEngine', () => {
    it('triggers rule when event matches pattern', () => {
        const rule = createRule({
            trigger: new EventPattern('CardPlayed'),
            effects: [new ModifyResource('life', 1)],
        });
        ruleEngine.addGlobalRule(rule);

        const event = new Event('CardPlayed', { cardId: 'card1' });
        const [newState, events] = ruleEngine.processEvent(state, event);

        expect(newState.getEntity('player1').get('Resources').life).toBe(21);
    });

    it('does not trigger rule when conditions fail', () => {
        const rule = createRule({
            trigger: new EventPattern('CardPlayed'),
            conditions: [new ResourceComparison('player1', 'life', '<', 10)],
            effects: [new ModifyResource('life', 1)],
        });
        ruleEngine.addGlobalRule(rule);

        const state = createState({ life: 20 }); // Condition fails
        const event = new Event('CardPlayed', { cardId: 'card1' });
        const [newState, events] = ruleEngine.processEvent(state, event);

        expect(newState.getEntity('player1').get('Resources').life).toBe(20);
    });
});
```

### 2. Integration Tests

Test complete flows:

```typescript
describe('Complete game flow', () => {
    it('executes action, triggers rules, and advances phase', () => {
        const engine = new GameEngine(gameDefinition);

        // Initial state
        expect(engine.getCurrentPhase()).toBe('Main');
        expect(engine.getCurrentPlayer()).toBe('player1');

        // Play card
        const action = {
            type: 'PlayCard',
            actorId: 'card1',
            targetIds: [],
            parameters: {},
        };

        engine.performAction(action);

        // Check effects
        const state = engine.getState();
        expect(state.getEntity('card1').get('Position').zone).toBe('board');
        expect(state.getEntity('player1').get('Resources').mana).toBe(5);

        // Check triggered rules
        expect(state.getEntity('player1').get('Resources').life).toBe(21); // Life gain rule

        // End turn
        engine.performAction({ type: 'EndTurn', actorId: 'player1' });

        // Check phase advanced
        expect(engine.getCurrentPhase()).toBe('Upkeep');
        expect(engine.getCurrentPlayer()).toBe('player2');
    });
});
```

### 3. Property-Based Tests

Test invariants:

```typescript
import * as fc from 'fast-check';

describe('Invariants', () => {
    it('state never mutates during action execution', () => {
        fc.assert(
            fc.property(
                arbitraryGameState(),
                arbitraryValidAction(),
                (state, action) => {
                    const originalState = deepClone(state);

                    engine.performAction(action);

                    expect(state).toEqual(originalState);
                }
            )
        );
    });

    it('event processing always terminates', () => {
        fc.assert(
            fc.property(
                arbitraryGameState(),
                arbitraryEvent(),
                (state, event) => {
                    const queue = new EventQueue();
                    queue.add(event);

                    // Should not throw or hang
                    expect(() => {
                        eventProcessor.processAll(state, queue);
                    }).not.toThrow();
                }
            )
        );
    });

    it('valid actions are always executable', () => {
        fc.assert(
            fc.property(arbitraryGameState(), state => {
                const validActions = actionSystem.getValidActions(
                    state,
                    state.activePlayer
                );

                for (const action of validActions) {
                    // Should not throw
                    expect(() => {
                        actionSystem.executeAction(state, action);
                    }).not.toThrow();
                }
            })
        );
    });
});
```

### 4. Simulation Tests

Test by playing complete games:

```typescript
describe('Game simulations', () => {
    it('plays 100 random games without errors', () => {
        for (let i = 0; i < 100; i++) {
            const engine = new GameEngine(gameDefinition);

            while (!engine.isGameOver()) {
                const validActions = engine.getValidActions(
                    engine.getCurrentPlayer()
                );

                // Random action selection
                const randomAction =
                    validActions[
                        Math.floor(Math.random() * validActions.length)
                    ];

                expect(() => {
                    engine.performAction(randomAction);
                }).not.toThrow();
            }

            // Game should have winner
            expect(engine.getWinner()).toBeTruthy();
        }
    });
});
```

---

## Extensibility

### 1. Custom Components

Games can define custom components, preconditions, effects, and rules:

```typescript
// Custom Component
class FlyingComponent extends Component {
    type = 'Flying';
    canBeBlocked = false;
}

// Custom Precondition
class CanFly extends Precondition {
    check(context: ActionContext): boolean {
        return context.actor.has('Flying');
    }

    getErrorMessage(): string {
        return 'Creature must have flying';
    }
}

// Custom Effect
class DealDamageToAll extends Effect {
    constructor(private damage: number) {
        super();
    }

    apply(context: ActionContext): GameState {
        const newState = context.state.clone();

        // Find all creatures
        const creatures = newState.query('type == "Creature"');

        // Deal damage to each
        for (const creature of creatures) {
            const health = creature.get('Health');
            health.current -= this.damage;
        }

        return newState;
    }
}

// Register custom types
componentRegistry.register('Flying', FlyingComponent);
preconditionRegistry.register('CanFly', CanFly);
effectRegistry.register('DealDamageToAll', DealDamageToAll);
```

### 2. Plugin System

```typescript
interface GameEnginePlugin {
    name: string;
    version: string;

    install(engine: GameEngine): void;
    uninstall(engine: GameEngine): void;
}

class ExpansionPackPlugin implements GameEnginePlugin {
    name = 'ExpansionPack1';
    version = '1.0.0';

    install(engine: GameEngine): void {
        // Add new actions
        engine.actionSystem.registerAction(newAction1);
        engine.actionSystem.registerAction(newAction2);

        // Add new rules
        engine.ruleEngine.addGlobalRule(newRule1);
        engine.ruleEngine.addGlobalRule(newRule2);

        // Add new phases
        engine.phaseManager.registerPhase(newPhase);

        // Register custom components
        componentRegistry.register('NewComponent', NewComponent);
    }

    uninstall(engine: GameEngine): void {
        // Remove added content
        engine.actionSystem.unregisterAction('newAction1');
        engine.ruleEngine.removeGlobalRule('newRule1');
        // ...
    }
}

// Usage
const plugin = new ExpansionPackPlugin();
engine.installPlugin(plugin);
```

### 3. Game Definition DSL

```typescript
// Declarative game definition
const gameDefinition = defineGame({
    name: 'MyCardGame',

    setup: {
        players: 2,
        startingLife: 20,
        startingHandSize: 7,
        deckSize: 60,
    },

    actions: [
        defineAction({
            name: 'PlayCard',
            requires: {
                turn: 'mine',
                zone: 'hand',
                resource: { mana: card => card.cost },
            },
            costs: [spend({ mana: card => card.cost })],
            effects: [moveToZone('board'), trigger('CardPlayed')],
        }),

        defineAction({
            name: 'Attack',
            requires: {
                turn: 'mine',
                zone: 'board',
                untapped: true,
                target: { zone: 'board', controller: 'opponent' },
            },
            effects: [
                dealDamage(attacker => attacker.power, 'target'),
                trigger('Attack'),
            ],
        }),
    ],

    rules: [
        defineRule({
            when: event('CardPlayed', { cardType: 'Spell' }),
            then: [drawCards(1)],
        }),

        defineRule({
            when: event('TurnStart'),
            then: [untapAll(), drawCards(1)],
        }),
    ],

    phases: [
        definePhase({
            name: 'Upkeep',
            auto: true,
            onEnter: [untapAll(), drawCards(1)],
            next: 'Main',
        }),

        definePhase({
            name: 'Main',
            allows: ['PlayCard', 'ActivateAbility'],
            next: 'Combat',
        }),
    ],

    winConditions: [
        condition(state => {
            return state
                .getOpponents(state.activePlayer)
                .some(opp => opp.life <= 0);
        }),
    ],
});
```

---

## Open Questions

### Critical Questions (Need answers before full implementation):

#### Action System

1. **Preconditions**: Should they short-circuit on first failure?
    - **Recommendation**: Yes, for performance. First failure is sufficient.

2. **Costs**: Can they fail, or are they guaranteed by preconditions?
    - **Recommendation**: Costs should be guaranteed by preconditions. Preconditions check, costs execute.

3. **Effect Failures**: Rollback or continue with partial state?
    - **Recommendation**: Throw error and rollback. Partial state is dangerous.

4. **Target Selection**: How to handle variable target counts?
    - **Recommendation**: Use `targetSelector` that returns arrays of different sizes.

5. **State Immutability**: Use library (Immer) or custom solution?
    - **Recommendation**: Use Immer for TypeScript, structural sharing for performance.

6. **Action Generation**: Lazy (iterator) or eager (array)?
    - **Recommendation**: Provide both. Lazy for AI, eager for UI.

7. **Error Handling**: What's the strategy for failed effects?
    - **Recommendation**: Throw specific error types, log context, rollback state.

8. **Event Timing**: When exactly are events emitted?
    - **Recommendation**: All events collected during execution, emitted atomically at end.

#### Event System

9. **Max Iterations**: What's reasonable limit?
    - **Recommendation**: 100 iterations default, configurable per game.

10. **Cycle Detection**: How strict should it be?
    - **Recommendation**: Track exact event signatures, warn on repeats.

11. **Event History**: How much to keep?
    - **Recommendation**: Last 1000 events default, configurable.

#### Rule Engine

12. **Rule Priorities**: How to handle ties?
    - **Recommendation**: Registration order breaks ties.

13. **Rule Modification**: Can rules modify other rules?
    - **Recommendation**: No. Rules should only modify game state, not rule set.

14. **Rule Persistence**: Do rules survive entity destruction?
    - **Recommendation**: Entity-attached rules are removed with entity.

#### Phase Management

15. **Nested Phases**: How deep can they nest?
    - **Recommendation**: 2 levels maximum (Phase → SubPhase).

16. **Phase Interrupts**: Can phases be interrupted?
    - **Recommendation**: No direct interrupts. Use priority rules instead.

### Design Questions (Can decide during implementation):

1. Should actions have unique IDs? **Recommend: Yes, for logging**
2. Should ActionContext include helper methods? **Recommend: Yes**
3. Should preconditions support AND/OR composition? **Recommend: Yes, via CompositeCondition**
4. Should effects have priorities? **Recommend: No, use sequential order**
5. Should there be transaction support? **Recommend: Future feature**
6. Performance targets for getValidActions()? **Recommend: <100ms**
7. Test coverage targets? **Recommend: 80%+ for core systems**
8. Serialization format? **Recommend: JSON for simplicity**

---

## Conclusion

This specification provides a complete architecture for a general-purpose board game rule engine. The four systems work together to provide:

- **Flexibility**: Can model diverse game types
- **Declarative Design**: Games defined as data, not code
- **AI-Friendly**: Clean interfaces for reinforcement learning
- **Designer-Friendly**: Natural abstractions for game concepts
- **Extensible**: Plugin system for expansions
- **Testable**: Clear boundaries between components
- **Performant**: Optimizations for common operations

### Next Steps

1. **Answer Critical Questions**: Make decisions on open design questions
2. **Implement Core**: Start with GameState, Entity, Component
3. **Build Action System**: Implement actions, preconditions, effects
4. **Build Event System**: Implement events, queue, processor
5. **Build Rule Engine**: Implement rules, conditions, pattern matching
6. **Build Phase System**: Implement phases, transitions
7. **Integration**: Connect all systems together
8. **Testing**: Comprehensive test suite
9. **Sample Games**: Implement 2-3 reference games
10. **AI Integration**: Connect to RL framework
11. **Designer Tools**: Build GUI for game definition

### Reference Implementations

Consider implementing these as validation:

- **Tic-Tac-Toe**: Simplest possible game
- **Simple Card Game**: Like Go Fish or Uno
- **Resource Management**: Like Catan or Ticket to Ride
- **Combat Game**: Like simplified Magic: The Gathering

This will validate the architecture handles different game types effectively.
