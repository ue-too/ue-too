# Live Board Machines in the Visualizer — Design

**Date:** 2026-08-31
**Status:** Approved
**Branch:** `feat/visualizer-live-board-machines`

## Overview

The state machine visualizer's five board entries currently construct fresh
machines against stub contexts (`DummyKmtInputContext`, `DummyCanvas`), so the
chart shows the *shape* of board's input machines but never their real
behaviour — the only way to move them is the panel's fire buttons.

This change points those five entries at the machines already running inside
the visualizer's own viewport `Board`. Holding spacebar over the diagram fires
a real `spacebarDown` on the real machine and lights up
`READY_TO_PAN_VIA_SPACEBAR` on the very chart you are panning. The page becomes
self-referential: the board being diagrammed is the board you are driving.

This partially closes the "attach to a running machine" non-goal from the
[2026-08-25 visualizer design](./2026-08-25-state-machine-visualizer-design.md)
— same-page only, with no devtools-style cross-page protocol.

## Goals

- The five board registry entries observe the live machines of the page's own
  `Board`, driven by genuine keyboard, mouse, and touch input.
- Live transitions reach the log, the edge flash, the state readout, the
  affordance dimming, and the context inspector with the same fidelity the
  simulator panel has today — including telling a precondition veto apart from
  a handled event that stayed put.
- Hand-fired events keep working against live machines, so the panel and the
  canvas drive one and the same machine.
- No breaking change to any published package.

## Non-goals

- Attaching to a machine in a *different* page or app. Still deferred.
- Making the vending-machine and account demos live; they stay simulated.
- Hierarchical machines. Still gated on `hierarchical.ts` graduating.
- Changing board's window-scoped keydown guard so spacebar works while a form
  field has focus. The guard exists to stop the board hijacking real typing;
  the page works around it instead.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Which board is observed | The diagram's own viewport `Board` | One instance already runs all five machines; no second canvas, and driving the chart *is* the demo |
| Observation mechanism | New `onEventResult` in `being`, alongside the existing `onHappens` / `onStateChange` | The existing pair cannot distinguish a precondition veto from a handled no-op, which would hide the #432–#434 work in the live view |
| Unsubscribe | Disposers returned from all three `on*` methods | Live machines are long-lived; re-selecting an entry would otherwise stack duplicate listeners forever |
| API shape | Non-breaking: optional member, widened return type | Matches the precedent set by #435's optional `context`; keeps external implementers of `StateMachine` valid |
| Panel controls under a live machine | Stay fully active | Firing `spacebarDown` by hand visibly changes the real canvas cursor — the clearest proof the chart is wired to the running machine |

## Architecture

### `@ue-too/being`

`interface.ts`, `StateMachine`:

- `onStateChange` and `onHappens` change their declared return from `void` to
  `void | (() => void)`. An existing implementation returning `void` still
  satisfies this, so no external implementer breaks.
- A new **optional** `onEventResult?(callback): void | (() => void)`. The
  callback receives `(args, result, context)` — the event name and payload, the
  full `EventResult`, and the context.

`TemplateStateMachine`:

- Gains `_eventResultCallbacks`, initialised alongside the existing two arrays.
- All three `on*` methods return a disposer that removes that callback.
  Disposing twice is a no-op, and disposing during a dispatch must not cause
  the in-flight iteration to skip a neighbouring callback.
- `onEventResult` callbacks fire immediately after
  `this._states[this._currentState].handles(...)` returns, before the
  transition block.

The resulting order inside one synchronous `happens` call:

```
onHappens  →  handles()  →  onEventResult  →  [transition]  →  onStateChange
```

`onEventResult` therefore observes every outcome, including the two the
existing hooks miss: the `{ handled: false }` returned for a precondition veto,
and a self-transition (which still does not fire `onStateChange`, per the
standing TODO at `interface.ts:737` — untouched here).

One exception, inherited from the existing shape of `happens`: when the machine
is in `INITIAL` or `TERMINAL` it returns `{ handled: false }` before any
callback runs, so `onHappens` and `onEventResult` both stay silent. This is
existing behaviour and is not changed here.

Ships as `feat(being)`, a minor bump. No `!`.

### `@ue-too/board`

Read-only access to machines the board already owns:

- `KMTEventParser` and `TouchEventParser` gain an optional
  `readonly stateMachine?` member — the same conservative shape, so external
  parser implementations stay valid.
- `VanillaKMTEventParser` gains a `get stateMachine()`, pairing the setter that
  has existed without a getter since the parser was written.
  `VanillaTouchEventParser` gains one too.
- `Board` gains `get kmtInputStateMachine()` and `get touchInputStateMachine()`,
  which **delegate to the current parser** rather than caching what the
  constructor built, so they stay correct after a `board.kmtParser = ...` swap.

The camera-control machines need no board change: `CameraMuxWithAnimationAndLock`
already exposes `panStateMachine` / `zoomStateMachine` / `rotateStateMachine`,
it is publicly exported, and `Board` already exposes `get cameraMux()`.

Ships as `feat(board)`, a minor bump.

### `apps/examples` — the visualizer page

**Registry.** `create()` splits into a discriminated source, and
`samplePayloads` hoists to the entry, where it was previously duplicated inside
every `create()`:

```ts
export type MachineSource =
    | { kind: 'simulated'; create(): StateMachine<any, any, any, any> }
    | { kind: 'live'; resolve(board: Board): StateMachine<any, any, any, any> };

export type RegistryEntry = {
    id: string;
    label: string;
    samplePayloads: Record<string, unknown>;
    source: MachineSource;
};
```

`vending-machine` and `account-demo` stay `simulated`. The five board entries
become `live`: kmt and touch resolve off the new `Board` getters; pan, zoom and
rotation narrow `board.cameraMux` to `CameraMuxWithAnimationAndLock` and read
its getters. The stub-context constructions disappear, along with the
`DummyCanvas` / `DummyKmtInputContext` / `TouchInputTracker` imports and the
`registry.ts:31` comment explaining how the touch context was stubbed.

**`main.ts`.**

1. `selectMachine`'s `machine.wrapup()` becomes conditional on the outgoing
   entry being `simulated`. Wrapping up a live machine parks it in `TERMINAL`
   permanently, after which `happens` returns early and the real board stops
   responding to all input.
2. Logging and edge-flashing move out of `fireEvent` and into an
   `onEventResult` subscription taken on select and disposed on switch.
   `fireEvent` shrinks to parsing the payload, calling `happens`, and reporting
   JSON or throw errors. Hand-fired and canvas-driven events then travel one
   identical path.
3. Inside `onEventResult` the transition has not happened yet, so
   `machine.currentState` is still the source state — the `before` that
   `findTakenEdgeIndex(before, event, after)` needs, with
   `after = result.nextState ?? before`.
4. The log coalesces consecutive identical `(event, from, to)` results into one
   line with a `×N` counter, updating that line in place rather than
   prepending.
5. The panel gains a `● LIVE` badge for live entries and a hint that spacebar
   only reaches the board when focus is outside a form field.

The state readout, the #435 affordance dimming, and the context inspector need
no change — the rAF loop already reads `currentState` and `context` every
frame, so they start reflecting real input for free.

## Data flow

```
select entry
  ├─ simulated → source.create()
  └─ live      → source.resolve(board)   // the page's own viewport Board
        ↓
  extractMachineGraph → layout(dagre) → static geometry
  subscribe onEventResult / onStateChange → keep disposers

real input on canvas          hand-fired from panel
  (spacebar, drag, wheel)       (⚡ button + payload)
        ↓                             ↓
        └────→ machine.happens(event, payload) ←────┘
                        ↓
                  onEventResult → log entry (coalesced) + edge flash
                        ↓
                  [transition] → onStateChange
                        ↓
          rAF loop → highlight, dimming, context inspector

switch entry → dispose subscriptions; wrapup() only if simulated
```

## Error handling

- **`resolve()` throws** (e.g. the mux narrow fails because a custom
  `CameraMux` was installed) → surfaced in `panelErrorEl` by the existing
  try/catch in `selectMachine`; other entries unaffected.
- **Bad payload JSON** → inline message on the event row; nothing fired.
  Unchanged.
- **Action throws** → reported on the row and logged. Unchanged.
- **Stranded gesture** — firing half a gesture by hand (a `leftPointerDown`
  with no matching up) leaves the real board mid-pan. Reset recovers it: it
  round-trips through `TERMINAL`, calls `context.cleanup()` then
  `context.setup()`, and returns to the initial state. Reset stays enabled for
  live entries for exactly this reason.
- **Event flooding** — `pointerMove` at ~60Hz during a drag. Handled by log
  coalescing; without it the log blows through `MAX_LOG_ENTRIES` in about three
  seconds of panning.

## Testing

- **Unit, `bunx nx test being`** — new `test/event-result-subscription.test.ts`,
  following the one-file-per-feature convention of `context-getter.test.ts` and
  `event-preconditions.test.ts`. Covers: `onEventResult` fires with the correct
  `EventResult` for handled-with-transition, handled-without-transition,
  self-transition, and precondition-vetoed; the
  `onHappens → onEventResult → onStateChange` ordering; disposers remove the
  listener, are safe to call twice, and do not skip a neighbour when one
  disposes during dispatch.
- **Unit, `bunx nx test board`** — the parser getters return the machines the
  constructor built; `Board`'s getters follow a swapped parser rather than
  going stale.
- **Manual, `bun run dev:examples`** — `apps/examples` has no test
  infrastructure. Hold spacebar over the diagram and watch
  `IDLE → READY_TO_PAN_VIA_SPACEBAR`; drag to reach `INITIAL_PAN → PAN`;
  confirm the log coalesces during a drag instead of flooding; switch entries
  and back, confirming no duplicate log lines (disposal works) and that the
  board still responds to input (the `wrapup` fix works); fire `spacebarDown`
  from the panel and see the real canvas cursor change.

## Build order

1. `onEventResult` + disposers in `being`, with tests.
2. Parser and `Board` getters in `board`, with tests.
3. Registry reshape to the discriminated source, board entries still
   simulated — a pure refactor, verified unchanged.
4. Flip the five board entries to `live`; fix the `wrapup` hazard.
5. Move logging and flashing onto the subscription; add log coalescing.
6. `● LIVE` badge, focus hint, manual verification pass.
