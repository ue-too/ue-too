# Knit — Knitting Pattern Editor

## State Machine Architecture

All human interaction logic must be built on `@ue-too/being` state machines. State machines are the cornerstone of this app's input handling — do not implement interaction logic with ad-hoc event listeners or boolean flags.

### Pattern

1. Define states as a const array + `CreateStateType`
2. Define an event mapping type (event name → payload)
3. Define a context interface extending `BaseContext` with the callbacks/services the state machine needs
4. Implement states using `TemplateState` with `EventReactions`
5. Compose into a `TemplateStateMachine`
6. Use `CompositeState` to embed child state machines (e.g. wrapping board's `KmtInputStateMachine`)

### Existing Examples

Reference these for conventions and patterns:

- **Top-level input SM**: `src/utils/input-state-machine/knit-input-state-machine.ts`
- **KMT extension**: `src/utils/input-state-machine/kmt-input-state-machine-expansion.ts`

The `@ue-too/board` package also has reference implementations:
- `packages/board/src/input-interpretation/input-state-machine/kmt-input-state-machine.ts`
- `packages/board/src/input-interpretation/input-state-machine/touch-input-state-machine.ts`

Banana app has many more examples of the same pattern:
- `apps/banana/src/trains/input-state-machine/` — multiple state machines for different tools
- `apps/banana/src/train-editor/` — editor-specific state machines
