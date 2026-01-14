# Action System

A minimal POC implementation of the Action System specification for game actions.

## Overview

The Action System provides a declarative framework for defining, validating, and executing game actions. Actions are defined as templates with preconditions, costs, and effects.

## Architecture

### Core Components

- **Action**: Represents a specific instance of a player's intent
- **ActionContext**: Bundles all information needed during validation and execution
- **Precondition**: Conditions that must be true for an action to be valid
- **Effect**: State modifications that occur when an action executes
- **ActionDefinition**: Template that defines how an action type works
- **ActionSystem**: Central manager for all actions

### Key Features

- ✅ Immutable state updates
- ✅ Precondition validation with short-circuiting
- ✅ Cost and effect execution in sequence
- ✅ Event generation from effects
- ✅ Action generation for valid player actions
- ✅ Comprehensive test coverage

## Usage

### Basic Example

```typescript
import { ActionSystem, ActionDefinitionImpl } from './action-system';
import { createActionType } from './action-system/types';
import { IsPlayerTurn, ResourceAvailable } from './action-system/preconditions';
import { ModifyResource, MoveEntity, EmitEvent } from './action-system/effects';

// Create action type (using Symbol for type safety)
const PlayCard = createActionType('PlayCard');

// Create action system
const actionSystem = new ActionSystem();

// Define an action
const playCardAction = new ActionDefinitionImpl(
  PlayCard,  // Symbol type identifier
  'PlayCard', // Human-readable name
  [
    new IsPlayerTurn(),
    new ResourceAvailable('mana', 5),
    new EntityInZone('hand', 'actor')
  ],
  [
    new ModifyResource('mana', -5, 'actor', 'subtract')
  ],
  [
    new MoveEntity('board', 'actor'),
    new EmitEvent('CardPlayed', { cardId: 'card1' })
  ]
);

// Register action
actionSystem.registerAction(playCardAction);

// Get valid actions for a player
const validActions = actionSystem.getValidActions(state, 'player1');

// Execute an action
const [newState, events] = actionSystem.executeAction(state, validActions[0]);
```

### Action Types

Action types use Symbols to prevent naming conflicts between different modules or custom actions:

```typescript
// Create unique action type (recommended for most cases)
const PlayCard = createActionType('PlayCard');

// Create global action type (for serialization/cross-module access)
const PlayCard = createGlobalActionType('PlayCard');
// Can be retrieved later with Symbol.for('PlayCard')

// Get string representation for logging/serialization
import { getActionTypeString } from './action-system/types';
console.log(getActionTypeString(PlayCard)); // "PlayCard"
```

## Preconditions

Available precondition classes:

- `IsPlayerTurn`: Checks if actor is the active player
- `HasComponent`: Checks if entity has a component
- `ResourceAvailable`: Checks if actor has sufficient resources
- `EntityInZone`: Checks if entity is in a specific zone
- `PhaseCheck`: Checks if current phase is allowed
- `CustomPrecondition`: For game-specific conditions

## Effects

Available effect classes:

- `ModifyResource`: Modifies a resource on an entity (add/subtract/set)
- `MoveEntity`: Moves entity between zones
- `CreateEntity`: Creates a new entity
- `DestroyEntity`: Removes an entity from the game
- `EmitEvent`: Explicitly emits an event
- `CompositeEffect`: Chains multiple effects together

## Testing

Run tests with:

```bash
bun test action-system
```

All tests are located in `test/action-system/`:
- `preconditions.test.ts`: Tests for all precondition types
- `effects.test.ts`: Tests for all effect types
- `action-system.test.ts`: Integration tests for ActionSystem

## ECS Integration

The action system now supports integration with `@ue-too/ecs`:

### Using ECS

```typescript
import { Coordinator } from '@ue-too/ecs';
import { ECSGameState, EntityIdMapper, ComponentNameMapper } from './action-system';

// Create ECS coordinator
const coordinator = new Coordinator();
const entityMapper = new EntityIdMapper();
const componentMapper = new ComponentNameMapper();

// Register components
const ResourcesSymbol = componentMapper.getOrCreateComponentName('Resources');
const PositionSymbol = componentMapper.getOrCreateComponentName('Position');
coordinator.registerComponent(ResourcesSymbol);
coordinator.registerComponent(PositionSymbol);

// Create game state
const state = new ECSGameState(coordinator, entityMapper, componentMapper, 'player1', 'Main');

// Create entities
const playerEntity = entityMapper.getOrCreateEntity('player1', coordinator);
coordinator.addComponentToEntity(ResourcesSymbol, playerEntity, { mana: 10 });
coordinator.addComponentToEntity(OwnerSymbol, playerEntity, { id: 'player1' });

// Use with action system
const actionSystem = new ActionSystem();
// ... register actions ...
const validActions = actionSystem.getValidActions(state, 'player1');
```

### Adapters

The system includes adapters to bridge string-based entity IDs and component names with the ECS:

- **EntityIdMapper**: Maps string entity IDs to ECS entity numbers
- **ComponentNameMapper**: Maps string component names to ECS ComponentName symbols
- **ECSEntityAdapter**: Wraps ECS entities with string-based component access
- **ECSGameState**: GameState implementation using the ECS Coordinator

### Backward Compatibility

The system maintains backward compatibility with mock implementations. Effects automatically detect whether they're working with ECS or mock entities and adapt accordingly.

## Implementation Notes

### State Immutability

The action system ensures state immutability by:
- Cloning the game state before any modifications
- Returning new state instances from effects
- Never mutating the original state
- With ECS: Creating new Coordinator instances with cloned component data

### Event Generation

Events are collected from:
1. Costs (if they generate events)
2. Effects (if they generate events)
3. Always includes an `ActionExecuted` event

### Action Generation

`getValidActions()` generates actions by:
1. Iterating through all registered action definitions
2. Generating target combinations (via `targetSelector`)
3. Generating parameter combinations (via `parameterGenerator`)
4. Validating each combination through preconditions
5. Returning only valid actions

## Future Enhancements

- Performance optimizations (caching, lazy evaluation)
- Serialization support for replays
- Plugin system for extensibility
- Transaction support for multi-action execution
- More efficient ECS state cloning
