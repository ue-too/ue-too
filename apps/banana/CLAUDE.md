# Banana — Railway Simulation App

## State Machine Architecture

All human interaction logic must be built on `@ue-too/being` state machines. State machines are the cornerstone of this app's input handling — do not implement interaction logic with ad-hoc event listeners or boolean flags.

### Pattern

1. Define states as a const array + `CreateStateType`
2. Define an event mapping type (event name → payload)
3. Define a context interface extending `BaseContext` with the callbacks/services the state machine needs
4. Implement states using `TemplateState` with `EventReactions`
5. Compose into a `TemplateStateMachine`

### Existing Examples

Reference these for conventions and patterns:

- **Tool switching**: `src/trains/input-state-machine/tool-switcher-state-machine.ts`
- **Train placement**: `src/trains/input-state-machine/train-kmt-state-machine.ts`
- **Layout editing**: `src/trains/input-state-machine/layout-kmt-state-machine.ts`
- **Station placement**: `src/stations/station-placement-state-machine.ts`
- **Train editor tools**: `src/train-editor/train-editor-tool-switcher.ts`
- **Bogie editing**: `src/train-editor/bogie-kmt-state-machine.ts`
- **Image editing**: `src/train-editor/image-edit-state-machine.ts`
- **KMT extension (board)**: `src/trains/input-state-machine/kmt-state-machine-extension.ts`

The `@ue-too/board` package also has reference implementations:
- `packages/board/src/input-interpretation/input-state-machine/kmt-input-state-machine.ts`
- `packages/board/src/input-interpretation/input-state-machine/touch-input-state-machine.ts`
