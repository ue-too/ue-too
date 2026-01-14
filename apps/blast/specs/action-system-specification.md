# Action System Specification

## Overview

The Action System is responsible for defining, validating, and executing all player actions in the game. It provides a declarative framework where game actions are defined as templates with preconditions, costs, and effects.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
   - [Action](#1-action)
   - [ActionContext](#2-actioncontext)
   - [Precondition](#3-precondition)
   - [Effect](#4-effect)
   - [ActionDefinition](#5-actiondefinition)
   - [ActionSystem](#6-actionsystem)
2. [Action Lifecycle](#action-lifecycle)
3. [Data Flow](#data-flow)
4. [Examples](#examples)
5. [Integration Points](#integration-points)
6. [Error Handling](#error-handling)
7. [Performance Considerations](#performance-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Extensibility](#extensibility)
10. [Serialization](#serialization)
11. [Open Questions Summary](#open-questions-summary)
12. [Next Steps](#next-steps)

---

## Core Architecture

### 1. Action

**Purpose**: Represents a specific instance of a player's intent to perform an action.

**Type Definition**:
```typescript
interface Action {
  type: string;                    // Action type identifier (e.g., "PlayCard", "Move")
  actorId: string;                 // EntityId of the actor performing the action
  targetIds: string[];             // Ordered list of EntityIds being targeted
  parameters: Record<string, any>; // Additional action-specific data
}
```

**Properties**:
- `type`: Must match a registered ActionDefinition name
- `actorId`: Must reference a valid Entity in the current GameState
- `targetIds`: Can be empty for actions with no targets. Order matters for multi-target actions.
- `parameters`: Flexible key-value store for action-specific data (e.g., `{ cardSlot: 3, bidAmount: 50 }`)

**Immutability**: Actions should be treated as immutable once created.

**Equality**: Two actions are considered equal if all fields match exactly.

**Questions**:
1. Should actions have a unique ID for tracking/logging purposes?
2. Do we need a timestamp field on actions, or should that be handled at a different layer?
3. Should parameters support nested objects, or keep them flat?

---

### 2. ActionContext

**Purpose**: Bundles all information needed during action validation and execution. Passed to all preconditions and effects to avoid repeated entity lookups.

**Type Definition**:
```typescript
interface ActionContext {
  state: GameState;           // Current game state (immutable)
  action: Action;             // The action being executed
  actor: Entity;              // Resolved actor entity
  targets: Entity[];          // Resolved target entities (in order)
  parameters: Record<string, any>; // Copy of action.parameters for convenience
}
```

**Properties**:
- `state`: The GameState at the moment of execution (before any modifications)
- `actor`: Pre-resolved from `state.entities[action.actorId]`
- `targets`: Pre-resolved from `action.targetIds`, preserving order
- `parameters`: Direct reference to `action.parameters`

**Lifecycle**: Created once per action execution, passed through all preconditions and effects.

**Questions**:
1. Should ActionContext include additional helper methods (e.g., `getTarget(index)`, `hasTarget()`)?
2. Should we cache computed values in the context (e.g., actor's resources)?
3. Do we need a way to accumulate metadata during execution (e.g., for logging)?

---

### 3. Precondition

**Purpose**: Represents a single condition that must be true for an action to be valid.

**Interface**:
```typescript
interface Precondition {
  /**
   * Check if the precondition is satisfied
   * @returns true if condition is met, false otherwise
   */
  check(context: ActionContext): boolean;
  
  /**
   * Get human-readable error message when check fails
   * @returns descriptive error message
   */
  getErrorMessage(context: ActionContext): string;
}
```

**Design Principles**:
- **Pure functions**: No side effects, deterministic
- **Independent**: Each precondition checks one thing
- **Composable**: Can be combined in any order
- **Fast**: Should execute quickly (called frequently for action generation)

**Execution Order**: 
- Preconditions are checked in the order they appear in the ActionDefinition
- Short-circuit behavior: Stop on first failure?

**Common Precondition Types**:

#### IsPlayerTurn
```typescript
class IsPlayerTurn implements Precondition {
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- Checks if `context.state.activePlayer === context.actor.id`

#### HasComponent
```typescript
class HasComponent implements Precondition {
  constructor(
    componentType: string,
    target: 'actor' | `target${number}` = 'actor'
  );
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- Checks if specified entity has a component
- Examples: `HasComponent('Health')`, `HasComponent('Card', 'target0')`

#### ResourceAvailable
```typescript
class ResourceAvailable implements Precondition {
  constructor(
    resourceName: string,
    amount: number | ((context: ActionContext) => number)
  );
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- Checks if actor has sufficient resources
- `amount` can be static or computed dynamically

#### EntityInZone
```typescript
class EntityInZone implements Precondition {
  constructor(
    zone: string,
    target: 'actor' | `target${number}` = 'actor'
  );
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- Checks if entity is in a specific zone (e.g., "hand", "board", "deck")

#### PhaseCheck
```typescript
class PhaseCheck implements Precondition {
  constructor(allowedPhases: string[]);
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- Checks if current phase is in allowed list

#### CustomPrecondition
```typescript
class CustomPrecondition implements Precondition {
  constructor(
    checkFn: (context: ActionContext) => boolean,
    errorMessage: string | ((context: ActionContext) => string)
  );
  check(context: ActionContext): boolean;
  getErrorMessage(context: ActionContext): string;
}
```
- For game-specific conditions not covered by standard preconditions

**Questions**:
1. Should preconditions have priority/ordering metadata?
2. Do we want "soft" preconditions that warn but don't block? (e.g., for AI hints)
3. Should we support composite preconditions (AND/OR logic)?
4. How should we handle preconditions that depend on multiple targets (e.g., "targets must be adjacent")?
5. Should preconditions be able to suggest fixes (e.g., "need 3 more mana")?

---

### 4. Effect

**Purpose**: Represents a state modification that occurs when an action executes.

**Interface**:
```typescript
interface Effect {
  /**
   * Apply this effect to the game state
   * @returns new GameState with effect applied
   */
  apply(context: ActionContext): GameState;
  
  /**
   * Does this effect generate an event?
   * @returns true if createEvent() should be called
   */
  generatesEvent(): boolean;
  
  /**
   * Create the event this effect generates (if any)
   * @returns Event or null
   */
  createEvent(context: ActionContext): Event | null;
}
```

**Design Principles**:
- **Immutability**: Must return a NEW GameState, never mutate
- **Atomicity**: Each effect is all-or-nothing
- **Composability**: Effects can be chained sequentially
- **Event generation**: Effects can trigger events for the rule engine

**Effect Execution**:
1. Costs are applied first (in order)
2. Then effects are applied (in order)
3. Each effect receives the state from the previous effect
4. Events are collected and emitted after all effects apply

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
  apply(context: ActionContext): GameState;
  generatesEvent(): boolean;
  createEvent(context: ActionContext): Event | null;
}
```
- Modifies a resource on an entity
- Operations:
  - `add`: Increase resource
  - `subtract`: Decrease resource (with floor at 0)
  - `set`: Set to exact value

**Questions for ModifyResource**:
1. Should subtract allow negative values, or always floor at 0?
2. Should we emit ResourceChanged events for every modification?
3. How do we handle resources that don't exist yet (create on first set)?

#### MoveEntity
```typescript
class MoveEntity implements Effect {
  constructor(
    toZone: string,
    target: 'actor' | `target${number}` = 'actor',
    position?: 'top' | 'bottom' | 'random' | number
  );
  apply(context: ActionContext): GameState;
  generatesEvent(): boolean;
  createEvent(context: ActionContext): Event | null;
}
```
- Moves entity between zones
- `position` controls placement within ordered zones (like decks)

**Questions for MoveEntity**:
1. How do we handle visibility changes when moving to/from hidden zones?
2. Should this effect automatically handle zone-specific logic (e.g., triggering "enter battlefield" in card games)?
3. What happens if an entity doesn't have a Position component?

#### CreateEntity
```typescript
class CreateEntity implements Effect {
  constructor(
    entityType: string,
    components: Record<string, any>,
    owner?: 'actor' | `target${number}` | string
  );
  apply(context: ActionContext): GameState;
  generatesEvent(): boolean;
  createEvent(context: ActionContext): Event | null;
}
```
- Creates a new entity in the game
- `components`: Initial component data
- `owner`: Who controls this entity

**Questions for CreateEntity**:
1. How are entity IDs generated?
2. Should there be a component factory/registry for type safety?
3. Can components reference other entities at creation time?
4. Where does the entity get placed initially (zone)?

#### DestroyEntity
```typescript
class DestroyEntity implements Effect {
  constructor(
    target: 'actor' | `target${number}` = 'target0'
  );
  apply(context: ActionContext): GameState;
  generatesEvent(): boolean; // Always true
  createEvent(context: ActionContext): Event | null;
}
```
- Removes an entity from the game completely

**Questions for DestroyEntity**:
1. Should this trigger a "graveyard" move instead of complete removal?
2. How do we handle entities that reference the destroyed entity?
3. Should there be "indestructible" protection at this level?

#### EmitEvent
```typescript
class EmitEvent implements Effect {
  constructor(
    eventType: string,
    data: Record<string, any> | ((context: ActionContext) => Record<string, any>)
  );
  apply(context: ActionContext): GameState; // No state change
  generatesEvent(): boolean; // Always true
  createEvent(context: ActionContext): Event;
}
```
- Explicitly emits an event without modifying state
- Useful for triggering rule engine reactions

#### CompositeEffect
```typescript
class CompositeEffect implements Effect {
  constructor(effects: Effect[]);
  apply(context: ActionContext): GameState;
  generatesEvent(): boolean;
  createEvent(context: ActionContext): Event | null;
}
```
- Chains multiple effects together
- Executes effects sequentially

**Questions for CompositeEffect**:
1. Should we support conditional effects (if-then-else)?
2. How do we handle partial failures?
3. Should events be collected from all child effects?

**General Effect Questions**:
1. Should effects be able to fail gracefully (return original state + error)?
2. Do we need rollback/undo capability at the effect level?
3. Should effects have priorities or guaranteed ordering?
4. How do we handle effects that depend on random outcomes (dice, shuffling)?
5. Should effects be able to query the state before modification (for conditional logic)?

---

### 5. ActionDefinition

**Purpose**: Template that defines how an action type works. Registered with ActionSystem.

**Type Definition**:
```typescript
interface ActionDefinition {
  name: string;                           // Unique action type identifier
  preconditions: Precondition[];         // Must all pass for action to be valid
  costs: Effect[];                        // Applied before main effects (e.g., pay mana)
  effects: Effect[];                      // Main state modifications
  
  // Optional: Custom targeting logic
  targetSelector?: (state: GameState, actor: Entity) => Entity[][];
  
  // Optional: Custom parameter generation
  parameterGenerator?: (state: GameState, actor: Entity) => Record<string, any>[];
  
  // Optional: Display metadata
  metadata?: {
    displayName?: string;
    description?: string;
    iconUrl?: string;
  };
}
```

**Properties**:

- **name**: Must be unique across all registered actions. Used as `Action.type`.

- **preconditions**: Checked in order. All must pass. Short-circuits on first failure.

- **costs**: Effects applied before main effects. Typically resource consumption or entity removal. If a cost fails to apply, the action should not proceed.

- **effects**: Main state modifications. Applied after costs succeed.

- **targetSelector**: Optional function to generate valid target combinations.
  - Returns array of arrays: each inner array is one valid target combination
  - Example: `[[entity1], [entity2]]` for single-target actions
  - Example: `[[entity1, entity2], [entity3, entity4]]` for multi-target actions
  - If omitted, action is assumed to have no targets

- **parameterGenerator**: Optional function to generate valid parameter sets.
  - Returns array of parameter objects
  - Example: `[{ bidAmount: 10 }, { bidAmount: 20 }]`
  - If omitted, action is assumed to have no parameters

**Method Signatures**:
```typescript
interface ActionDefinition {
  /**
   * Check if action can be executed
   * @returns [canExecute, errorMessage]
   */
  canExecute(state: GameState, action: Action): [boolean, string | null];
  
  /**
   * Execute the action
   * @returns new GameState after costs and effects applied
   */
  execute(state: GameState, action: Action): GameState;
  
  /**
   * Get all events this action generates
   * @returns array of Events to be queued
   */
  getGeneratedEvents(state: GameState, action: Action): Event[];
}
```

**Questions**:
1. Should ActionDefinitions be immutable after registration?
2. Do we need versioning for ActionDefinitions (for replays of old games)?
3. Should there be lifecycle hooks (onBefore, onAfter)?
4. How do we handle actions with variable numbers of targets (e.g., "target up to 3 creatures")?
5. Should ActionDefinitions support inheritance or composition?
6. Do we need a way to "disable" action types dynamically?
7. Should targetSelector have access to the current action parameters?
8. How do we handle circular dependencies in targeting (A targets B, B targets A)?

---

### 6. ActionSystem

**Purpose**: Central manager for all actions. Handles registration, validation, and execution.

**Class Structure**:
```typescript
class ActionSystem {
  private actionDefinitions: Map<string, ActionDefinition>;
  
  constructor();
  
  /**
   * Register a new action type
   */
  registerAction(definition: ActionDefinition): void;
  
  /**
   * Unregister an action type
   */
  unregisterAction(actionType: string): void;
  
  /**
   * Get definition for an action type
   */
  getDefinition(actionType: string): ActionDefinition | null;
  
  /**
   * Get all valid actions for a player
   */
  getValidActions(state: GameState, playerId: string): Action[];
  
  /**
   * Execute an action
   * @returns [newState, generatedEvents]
   * @throws if action is invalid
   */
  executeAction(state: GameState, action: Action): [GameState, Event[]];
  
  /**
   * Check if an action is valid without executing
   */
  validateAction(state: GameState, action: Action): [boolean, string | null];
}
```

**Registration**:
- `registerAction()`: Adds a new ActionDefinition
  - Throws if name already exists
  - Validates definition structure

- `unregisterAction()`: Removes an ActionDefinition
  - Used for game modes, expansions, or dynamic rule changes

**Action Generation**:

`getValidActions()` algorithm:
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

**Performance Considerations**:
- This is called frequently (every time UI needs to update)
- Target/parameter generation can be expensive
- May need caching or incremental updates

**Action Execution**:

`executeAction()` algorithm:
```
1. Validate action (preconditions)
   - If invalid, throw error
2. Create ActionContext
3. Apply costs sequentially
   - Each cost receives state from previous cost
   - If any cost fails, rollback? Or should costs never fail?
4. Apply effects sequentially
   - Each effect receives state from previous effect
5. Collect generated events
   - From costs
   - From effects
   - Always include "ActionExecuted" event
6. Return [final state, events]
```

**Questions**:
1. Should `getValidActions()` be cached? How to invalidate cache?
2. Should action generation be lazy (iterator) or eager (array)?
3. How do we handle actions that are valid for multiple players (e.g., "anyone can bid")?
4. Should there be a max limit on generated actions (for performance)?
5. Should `executeAction()` rollback on cost failure, or should costs be guaranteed to succeed?
6. Do we need transaction support (execute multiple actions atomically)?
7. Should there be hooks for logging/analytics?
8. How do we handle concurrent action execution in multiplayer?
9. Should `getValidActions()` filter based on phase automatically?
10. Do we need a "dry run" mode that doesn't modify state but shows what would happen?

---

## Action Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    ACTION LIFECYCLE                      │
└─────────────────────────────────────────────────────────┘

1. DEFINITION PHASE (Setup)
   ┌──────────────────────────────────────┐
   │ Game defines ActionDefinitions       │
   │ ActionSystem.registerAction()        │
   └──────────────────────────────────────┘
                    ↓
2. GENERATION PHASE (Per Turn)
   ┌──────────────────────────────────────┐
   │ getValidActions(state, playerId)     │
   │  - Generate target combinations      │
   │  - Generate parameter combinations   │
   │  - Check preconditions               │
   │  - Return valid Actions              │
   └──────────────────────────────────────┘
                    ↓
3. SELECTION PHASE (Player Input)
   ┌──────────────────────────────────────┐
   │ Player/AI selects an Action          │
   └──────────────────────────────────────┘
                    ↓
4. VALIDATION PHASE (Safety Check)
   ┌──────────────────────────────────────┐
   │ validateAction(state, action)        │
   │  - Re-check preconditions            │
   │  - Ensure still valid                │
   └──────────────────────────────────────┘
                    ↓
5. EXECUTION PHASE
   ┌──────────────────────────────────────┐
   │ executeAction(state, action)         │
   │                                      │
   │ a. Create ActionContext              │
   │                                      │
   │ b. Apply Costs                       │
   │    ┌─────────────────────┐          │
   │    │ Cost 1 → State'     │          │
   │    │ Cost 2 → State''    │          │
   │    │ Cost N → State'''   │          │
   │    └─────────────────────┘          │
   │                                      │
   │ c. Apply Effects                     │
   │    ┌─────────────────────┐          │
   │    │ Effect 1 → State'   │          │
   │    │ Effect 2 → State''  │          │
   │    │ Effect N → State''' │          │
   │    └─────────────────────┘          │
   │                                      │
   │ d. Collect Events                    │
   │    ┌─────────────────────┐          │
   │    │ From Costs          │          │
   │    │ From Effects        │          │
   │    │ ActionExecuted      │          │
   │    └─────────────────────┘          │
   │                                      │
   │ e. Return [State, Events]            │
   └──────────────────────────────────────┘
                    ↓
6. EVENT PROCESSING PHASE
   ┌──────────────────────────────────────┐
   │ Events sent to EventQueue            │
   │ RuleEngine processes events          │
   │ (May trigger more state changes)     │
   └──────────────────────────────────────┘
```

---

## Data Flow

```
GameState (Immutable)
       ↓
ActionSystem.getValidActions()
       ↓
   [Action, Action, Action, ...]  ← Valid actions for player
       ↓
Player selects Action
       ↓
ActionSystem.executeAction(state, action)
       ↓
   Create ActionContext
       ↓
   Check Preconditions
       ↓
   Apply Costs → State₁
       ↓
   Apply Effects → State₂
       ↓
   Collect Events → [Event, Event, ...]
       ↓
Return [State₂, Events]
       ↓
Events → EventQueue → RuleEngine
       ↓
Final GameState
```

---

## Examples

### Example 1: Simple "Draw Card" Action

```typescript
const drawCardAction = new ActionDefinition({
  name: "DrawCard",
  
  preconditions: [
    new IsPlayerTurn(),
    new CustomPrecondition(
      (ctx) => {
        // Check if deck has cards
        const deck = ctx.state.query(
          `type == 'Deck' AND owner == '${ctx.actor.id}'`
        );
        return deck.length > 0 && deck[0].get('Cards').length > 0;
      },
      "No cards in deck"
    )
  ],
  
  costs: [],
  
  effects: [
    new MoveEntity('hand', 'deckTopCard', 'top'),
    new EmitEvent('CardDrawn', (ctx) => ({
      playerId: ctx.actor.id,
      cardId: ctx.targets[0]?.id
    }))
  ],
  
  // Custom targeting to get top card of deck
  targetSelector: (state, actor) => {
    const deck = state.query(`type == 'Deck' AND owner == '${actor.id}'`);
    if (deck.length > 0) {
      const topCard = deck[0].get('Cards')[0];
      return [[topCard]];
    }
    return [];
  }
});
```

**Questions for this example**:
1. How does `MoveEntity` know to use `target0` as the card to move?
2. Should deck logic be in a DeckComponent with helper methods?

### Example 2: "Play Card" Action

```typescript
const playCardAction = new ActionDefinition({
  name: "PlayCard",
  
  preconditions: [
    new IsPlayerTurn(),
    new HasComponent('Card', 'actor'),
    new EntityInZone('hand', 'actor'),
    new ResourceAvailable('mana', (ctx) => ctx.actor.get('Card').cost),
    new PhaseCheck(['Main'])
  ],
  
  costs: [
    new ModifyResource('mana', (ctx) => -ctx.actor.get('Card').cost, 'player', 'subtract')
  ],
  
  effects: [
    new MoveEntity('board', 'actor'),
    new EmitEvent('CardPlayed', (ctx) => ({
      cardId: ctx.actor.id,
      playerId: ctx.state.activePlayer
    }))
  ],
  
  // Cards in hand are valid targets
  targetSelector: (state, actor) => {
    const hand = state.query(`zone == 'hand' AND owner == '${actor.id}'`);
    return hand.map(card => [card]);
  }
});
```

**Questions for this example**:
1. In the cost, we reference 'player' but actor is the card. How do we resolve the player entity?
2. Should there be a helper to get owner from owned entities?

### Example 3: "Attack" Action (Multi-target)

```typescript
const attackAction = new ActionDefinition({
  name: "Attack",
  
  preconditions: [
    new IsPlayerTurn(),
    new HasComponent('Attack', 'actor'),
    new HasComponent('Health', 'target0'),
    new EntityInZone('board', 'actor'),
    new EntityInZone('board', 'target0'),
    new CustomPrecondition(
      (ctx) => ctx.actor.get('Status')?.canAttack === true,
      "Attacker has already attacked this turn"
    ),
    new CustomPrecondition(
      (ctx) => ctx.actor.get('Owner').id !== ctx.targets[0].get('Owner').id,
      "Cannot attack your own units"
    )
  ],
  
  costs: [
    new ModifyResource('canAttack', 0, 'actor', 'set') // Mark as having attacked
  ],
  
  effects: [
    new ModifyResource(
      'health',
      (ctx) => -ctx.actor.get('Attack').power,
      'target0',
      'subtract'
    ),
    new EmitEvent('EntityAttacked', (ctx) => ({
      attackerId: ctx.actor.id,
      defenderId: ctx.targets[0].id,
      damage: ctx.actor.get('Attack').power
    }))
  ],
  
  targetSelector: (state, actor) => {
    // Can attack any enemy unit on board
    const actorOwner = actor.get('Owner').id;
    const enemies = state.query(
      `zone == 'board' AND owner != '${actorOwner}' AND has('Health')`
    );
    return enemies.map(enemy => [enemy]);
  }
});
```

**Questions for this example**:
1. Should status effects like "canAttack" be handled by the action system or rule engine?
2. How do we handle simultaneous damage (both units attack each other)?

---

## Integration Points

### With GameState

The ActionSystem needs GameState to:
- Resolve entity references (`actorId`, `targetIds`)
- Query for valid targets
- Check current phase/turn
- Clone state for immutable updates

**Required GameState methods**:
```typescript
interface GameState {
  entities: Map<string, Entity>;
  activePlayer: string;
  phase: Phase;
  
  clone(): GameState;
  query(selector: string): Entity[];
  getEntity(id: string): Entity | null;
}
```

### With Event System

Actions generate events that feed into the event processing pipeline:

```typescript
// After executing action
const [newState, events] = actionSystem.executeAction(state, action);

// Events go to queue
eventQueue.addMultiple(events);

// Which triggers rule engine
finalState = eventProcessor.processAll(newState, eventQueue);
```

**Standard Events Generated**:
- `ActionExecuted`: Always generated for every action
- `ResourceChanged`: When resources are modified
- `EntityMoved`: When entities change zones
- `EntityCreated`: When entities are created
- `EntityDestroyed`: When entities are destroyed
- Custom events from `EmitEvent` effects

### With Rule Engine

Rules will listen for action-generated events and can:
- Trigger additional effects
- Modify the state further
- Generate more events

**Example**: A rule that triggers when a card is played:
```typescript
const cardPlayedRule = new Rule({
  trigger: new EventPattern('CardPlayed'),
  conditions: [
    new CustomCondition((state, event) => 
      state.getEntity(event.data.cardId)?.get('Card')?.type === 'Spell'
    )
  ],
  effects: [
    new DrawCards(1)
  ]
});
```

**Questions**:
1. Should the ActionSystem be aware of the RuleEngine, or should they be completely decoupled?
2. Can rules modify action definitions dynamically (e.g., add preconditions)?

---

## Error Handling

### Validation Errors

When `getValidActions()` or `validateAction()` fails:
```typescript
type ValidationResult = {
  valid: boolean;
  error?: string;
  failedPrecondition?: Precondition;
};
```

**Error Categories**:
1. **Invalid Actor**: Actor entity doesn't exist
2. **Invalid Targets**: Target entities don't exist
3. **Precondition Failed**: Specific precondition check failed
4. **Unknown Action Type**: Action type not registered
5. **Phase Restriction**: Action not allowed in current phase

### Execution Errors

When `executeAction()` fails:
```typescript
class ActionExecutionError extends Error {
  action: Action;
  failedAt: 'precondition' | 'cost' | 'effect';
  cause: Error;
}
```

**Error Handling Strategy**:
```typescript
try {
  const [newState, events] = actionSystem.executeAction(state, action);
  // Success
} catch (error) {
  if (error instanceof ActionExecutionError) {
    // Handle gracefully
    console.error(`Action failed at ${error.failedAt}:`, error.message);
  }
  // Do not update state
}
```

**Questions**:
1. Should costs be able to fail, or should preconditions guarantee costs will succeed?
2. If an effect fails midway, should previous effects be rolled back?
3. Should there be a "soft fail" mode for AI simulation?
4. How verbose should error messages be (for debugging vs. user-facing)?

---

## Performance Considerations

### Action Generation Optimization

`getValidActions()` can be expensive:

**Optimization Strategies**:
1. **Caching**: Cache results per (state hash, playerId)
   - Invalidate when state changes
   - Challenge: Computing cheap state hash

2. **Lazy Evaluation**: Use iterators instead of arrays
   ```typescript
   getValidActions(): IterableIterator<Action>
   ```

3. **Incremental Updates**: Track which action types could be affected by state changes
   - Only regenerate affected action types

4. **Pruning**: Early-exit expensive preconditions
   - Check cheap conditions first (turn order, phase)
   - Then expensive conditions (entity queries)

5. **Parallel Generation**: Generate actions for different types in parallel
   - Requires thread-safe state access

**Questions**:
1. What's the acceptable performance target (e.g., <100ms for action generation)?
2. Should we profile and optimize per-game, or build general optimizations?
3. Is lazy evaluation worth the complexity?

### Memory Considerations

Every action execution creates a new GameState:

**Memory Management**:
1. **Structural Sharing**: Clone only changed parts of state
   - Use persistent data structures (e.g., Immer.js)

2. **State Pooling**: Reuse state objects when possible

3. **Garbage Collection**: Be mindful of reference retention

**Questions**:
1. Should we use a library like Immer for immutability, or custom solution?
2. How many state snapshots should we keep in history (for undo)?

---

## Testing Strategy

### Unit Testing

Each component should be independently testable:

```typescript
describe('IsPlayerTurn', () => {
  it('returns true when actor is active player', () => {
    const precondition = new IsPlayerTurn();
    const context = createMockContext({ activePlayer: 'player1', actorId: 'player1' });
    expect(precondition.check(context)).toBe(true);
  });
  
  it('returns false when actor is not active player', () => {
    const precondition = new IsPlayerTurn();
    const context = createMockContext({ activePlayer: 'player1', actorId: 'player2' });
    expect(precondition.check(context)).toBe(false);
  });
});
```

### Integration Testing

Test complete action execution:

```typescript
describe('PlayCard action', () => {
  it('successfully plays card from hand to board', () => {
    const state = createTestState({
      activePlayer: 'player1',
      entities: {
        'player1': createPlayer({ mana: 10 }),
        'card1': createCard({ owner: 'player1', zone: 'hand', cost: 5 })
      }
    });
    
    const action: Action = {
      type: 'PlayCard',
      actorId: 'card1',
      targetIds: [],
      parameters: {}
    };
    
    const [newState, events] = actionSystem.executeAction(state, action);
    
    expect(newState.getEntity('card1').get('Position').zone).toBe('board');
    expect(newState.getEntity('player1').get('Resources').mana).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: 'CardPlayed' }));
  });
});
```

### Property-Based Testing

Test invariants:

```typescript
it('action execution never mutates original state', () => {
  fc.assert(
    fc.property(
      arbitraryGameState(),
      arbitraryAction(),
      (state, action) => {
        const originalState = state.clone();
        try {
          actionSystem.executeAction(state, action);
        } catch {
          // Execution might fail, that's ok
        }
        expect(state).toEqual(originalState);
      }
    )
  );
});
```

**Questions**:
1. What test coverage % should we target?
2. Should we test against real game scenarios or just unit logic?
3. How do we test non-deterministic actions (random effects)?

---

## Extensibility

### Custom Action Types

Games should be able to define their own actions:

```typescript
class DrawCardsEffect implements Effect {
  constructor(private count: number) {}
  
  apply(context: ActionContext): GameState {
    // Custom implementation
    let state = context.state;
    for (let i = 0; i < this.count; i++) {
      // Draw logic
    }
    return state;
  }
  
  generatesEvent(): boolean { return true; }
  createEvent(context: ActionContext): Event {
    return new Event('CardsDrawn', { count: this.count });
  }
}
```

### Plugin System

Allow third-party extensions:

```typescript
interface ActionSystemPlugin {
  name: string;
  install(actionSystem: ActionSystem): void;
  uninstall(actionSystem: ActionSystem): void;
}

class ExpansionPackPlugin implements ActionSystemPlugin {
  install(actionSystem: ActionSystem) {
    actionSystem.registerAction(newAction1);
    actionSystem.registerAction(newAction2);
  }
  
  uninstall(actionSystem: ActionSystem) {
    actionSystem.unregisterAction('newAction1');
    actionSystem.unregisterAction('newAction2');
  }
}
```

**Questions**:
1. Should plugins be able to modify existing actions?
2. How do we handle plugin conflicts?
3. Should there be a plugin dependency system?

---

## Serialization

### Saving/Loading Actions

For replays, network play, and persistence:

```typescript
interface SerializedAction {
  type: string;
  actorId: string;
  targetIds: string[];
  parameters: Record<string, any>;
  timestamp?: number;
}

class ActionSerializer {
  serialize(action: Action): SerializedAction;
  deserialize(data: SerializedAction): Action;
}
```

### ActionDefinition Serialization

For dynamic rule loading:

```typescript
interface SerializedActionDefinition {
  name: string;
  preconditions: SerializedPrecondition[];
  costs: SerializedEffect[];
  effects: SerializedEffect[];
}
```

**Challenges**:
- Lambda functions in preconditions/effects can't be serialized
- Need registry of serializable precondition/effect types

**Questions**:
1. Should we support full serialization, or only for specific use cases?
2. How do we handle version compatibility (replays of old games)?
3. Should serialization be JSON, binary, or pluggable?

---

## Open Questions Summary

### Critical Questions (Need answers before implementation):

1. **Preconditions**: Should they short-circuit on first failure?
2. **Costs**: Can they fail, or are they guaranteed by preconditions?
3. **Effect Failures**: Rollback or continue with partial state?
4. **Target Selection**: How to handle variable target counts?
5. **State Immutability**: Use library (Immer) or custom solution?
6. **Action Generation**: Lazy (iterator) or eager (array)?
7. **Error Handling**: What's the strategy for failed effects?
8. **Event Timing**: When exactly are events emitted (after each effect or all at once)?

### Design Questions (Can decide during implementation):

1. Should actions have unique IDs?
2. Should ActionContext include helper methods?
3. Should preconditions support AND/OR composition?
4. Should effects have priorities?
5. Should there be transaction support (multi-action)?
6. Performance targets for `getValidActions()`?
7. Test coverage targets?
8. Plugin system architecture?
9. Serialization format and scope?

### Nice-to-Have Questions (Future considerations):

1. Versioning for ActionDefinitions?
2. Lifecycle hooks for actions?
3. "Dry run" simulation mode?
4. Soft preconditions for AI hints?
5. Preconditions that suggest fixes?
6. Full serialization support?

---

## Next Steps

Please provide answers to the **Critical Questions** so I can finalize this specification. For the **Design Questions**, let me know if you have strong preferences, or I can make reasonable defaults.

Would you also like me to create similar specifications for:
- Event System
- Rule Engine
- Phase Management

Or shall we proceed with implementing the Action System based on your answers to these questions?
