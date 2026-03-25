# Getting Started

`@ue-too/being` is a finite state machine library for building state machines with event-driven transitions and context management.

## Installation

```bash
npm install @ue-too/being
```

## Basic Usage

```typescript
import { StateMachine } from "@ue-too/being";

const machine = new StateMachine({
    initial: "idle",
    states: {
        idle: {
            on: { START: "running" },
        },
        running: {
            on: { STOP: "idle" },
        },
    },
});

machine.send("START"); // transitions to "running"
```
