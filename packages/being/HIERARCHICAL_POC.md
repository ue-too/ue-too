# Hierarchical State Machine POC

This document describes the proof-of-concept implementation for hierarchical (nested) state machines in the `@ue-too/being` library.

## Overview

Hierarchical state machines allow states to contain their own internal state machines, enabling modeling of complex stateful behavior with parent-child relationships.

## Key Features

### 1. Composite States
States can contain child state machines. When a composite state is active, its child state machine is also active.

### 2. Event Propagation
Events are first handled by the child state machine. If unhandled, they bubble up to the parent state machine.

### 3. Default Child States
When entering a composite state, you can specify a default child state to enter automatically.

### 4. History States
Composite states can remember the last active child state and restore it when re-entering the parent state.

### 5. State Path Tracking
The hierarchical state machine tracks the full path of active states (e.g., "PARENT.CHILD").

## Implementation

### Core Components

#### `CompositeState`
Abstract base class that extends `TemplateState` and adds support for child state machines.

```typescript
abstract class CompositeState<
  EventPayloadMapping,
  Context extends BaseContext,
  ParentStates extends string,
  ChildStates extends string,
  EventOutputMapping
> extends TemplateState<...>
```

Key methods:
- `getChildStateMachine()`: Abstract method to provide child state machine configuration
- `getCurrentChildState()`: Returns the current child state
- `getStatePath()`: Returns the full hierarchical path

#### `HierarchicalStateMachine`
Extends `TemplateStateMachine` to provide hierarchical state path tracking.

Key methods:
- `getCurrentStatePath()`: Returns current state path (e.g., "PARENT.CHILD")
- `getActiveStatePath()`: Returns array of all active states in hierarchy
- `isInStatePath()`: Checks if machine is in a specific hierarchical path

## Usage Example

See `hierarchical-example.ts` for a complete example. Here's a simplified version:

```typescript
// Define state types
type TopLevelStates = "IDLE" | "PLAYING" | "PAUSED";
type PlayingChildStates = "BUFFERING" | "STREAMING" | "ERROR";

// Create a composite state
class PlayingState extends CompositeState<
  MediaPlayerEvents,
  MediaPlayerContext,
  TopLevelStates,
  PlayingChildStates
> {
  eventReactions = {
    pause: {
      action: () => console.log("Pausing"),
      defaultTargetState: "PAUSED"
    }
  };

  protected getChildStateMachine() {
    const childStates = {
      BUFFERING: new BufferingState(),
      STREAMING: new StreamingState(),
      ERROR: new ErrorState(),
    };

    const childMachine = new TemplateStateMachine(
      childStates,
      "BUFFERING",
      this._context!,
      false
    );

    return {
      stateMachine: childMachine,
      defaultChildState: "BUFFERING",
      rememberHistory: true
    };
  }
}

// Create hierarchical state machine
const machine = new HierarchicalStateMachine(
  {
    IDLE: new IdleState(),
    PLAYING: new PlayingState(),
    PAUSED: new PausedState()
  },
  "IDLE",
  context
);

// Use it
machine.happens("play", { track: "song.mp3" });
console.log(machine.getCurrentStatePath()); // "PLAYING.BUFFERING"
```

## How It Works

1. **State Entry**: When a composite state is entered:
   - Parent state's `uponEnter` is called
   - Child state machine is initialized
   - Default (or history) child state is entered

2. **Event Handling**: When an event occurs:
   - Event is first sent to child state machine
   - If child handles it, processing stops
   - If child doesn't handle it, event bubbles to parent

3. **State Exit**: When exiting a composite state:
   - Current child state is saved (if history enabled)
   - Child state's `beforeExit` is called
   - Child state machine is wrapped up
   - Parent state's `beforeExit` is called

## Limitations & Future Work

This is a POC with some limitations:

1. **Context Sharing**: Child state machines share the same context instance as the parent
2. **Single Level Nesting**: Currently supports one level of nesting (parent → child)
3. **Type Safety**: Some type assertions are needed due to generic constraints
4. **State Path Format**: Uses simple dot notation; could be enhanced

Potential improvements:
- Support for multiple levels of nesting
- Separate contexts for child state machines
- More sophisticated history state handling
- Better type inference for hierarchical paths
- Integration with schema factory

## Files

- `src/hierarchical.ts`: Core implementation
- `src/hierarchical-example.ts`: Usage example
- `src/index.ts`: Exports hierarchical types

## Testing

To test the POC, run the example:

```typescript
import { runHierarchicalStateMachineExample } from './hierarchical-example';
runHierarchicalStateMachineExample();
```

## Notes

- This POC maintains backward compatibility with existing flat state machines
- Composite states are optional - you can mix composite and simple states
- The implementation uses protected properties that may need refinement for production use
