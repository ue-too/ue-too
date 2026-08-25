# State Machine Visualizer — Design

**Date:** 2026-08-25
**Status:** Approved
**Branch:** `feat/state-machine-visualizer`

## Overview

An interactive statechart visualizer and simulator for `@ue-too/being` state
machines, in the spirit of the XState/Stately visualizer. It renders a
machine's states and transitions as a diagram on an `@ue-too/board` canvas,
runs the real machine in the page, highlights the current state live, and lets
the user fire events (with payloads) to step through transitions.

The machine genuinely runs inside the page, so "live view" and "simulator"
are the same thing: state highlighting reflects real transitions, not a
replay.

## Goals

- Visualize any flat `being` machine from its public surface — no changes to
  the library's runtime behavior.
- Let users fire events with editable payloads and watch transitions happen.
- Dogfood `@ue-too/board` (viewport, pan/zoom) and `@ue-too/curve` (edges)
  in the renderer.
- Ship as a public examples page (auto-deployed to the GitHub Pages site).

## Non-goals (v1)

- Hierarchical machines (`CompositeState`) — board's real machines are flat
  and `hierarchical.ts` is a POC. Nested charts come later if the
  hierarchical API graduates.
- Attaching to a machine running in a _different_ page/app (devtools-style
  protocol). The registry constructs machines locally with stub contexts.
- Node dragging, click-selection, or manual re-layout. v1 interaction is
  board's pan/zoom only.
- A plug-in API for registering machines from other packages. Adding a
  machine means adding a registry entry in code.

## Architecture

Two pieces, split by testability and reuse:

1. **Graph extraction** — a pure function in `packages/being`
   (new `src/introspect.ts`, exported from the package index):

    ```ts
    extractMachineGraph(machine: StateMachine<any, any, any, any>): MachineGraph

    type MachineGraph = {
        nodes: { id: string }[];
        edges: { from: string; to: string; event: string; guard?: string }[];
    };
    ```

    It walks `machine.possibleStates` and, for each state, its public
    `eventReactions`, `eventGuards`, and `guards`. Per state + event it emits:
    - one edge to `defaultTargetState`, or a **self-loop** (`to === from`)
      when the reaction has no target;
    - one **guard-labeled** edge per `eventGuards` mapping
      (`guard` set to the guard's registry key).

    Extraction only reads public getters; the library's behavior is untouched.
    Placing it in `being` puts the rules under vitest and leaves the door open
    for later reuse (e.g. Mermaid/docs generation) at no extra cost now.

2. **The visualizer page** — `apps/examples/src/state-machine-visualizer/`
   (`index.html`, `main.ts`, plus the modules below), registered in the
   examples nav following the existing convention. Everything visual is
   page-local.

### Page modules

**`registry.ts`** — curated machine list:

```ts
type RegistryEntry = {
    id: string;
    label: string;
    create(): {
        machine: StateMachine<any, any, any, any>;
        samplePayloads: Record<string, unknown>;
    };
};
```

`create()` runs lazily on selection so one broken entry cannot break the
page. v1 entries: the vending-machine example from `being`, plus board's
five machines (kmt-input, touch-input, pan-control, zoom-control,
rotation-control), each constructed with a stub context owned by its entry.

**Acceptance bar:** vending machine + kmt-input working. A board machine
whose context cannot be sensibly stubbed is deferred, not a blocker.

**`layout.ts`** — positions via `@dagrejs/dagre` (added as a dependency of
`apps/examples` only). Node boxes are sized by measuring the state-name text
with canvas `measureText`; dagre returns node positions and edge waypoints.
Special cases:

- **Self-loops** are excluded from dagre and drawn manually as a small arc
  anchored to the node's corner.
- **Parallel edges** between the same state pair use dagre's named
  multi-edges so they stay separated.

Layout runs once per machine selection.

**`render.ts`** — a `Board` instance owns the canvas, exactly like existing
example pages; pan/zoom/camera come from the toolkit. Each animation frame
draws in world space:

1. edges as beziers built from dagre's waypoints (via `@ue-too/curve`),
   with arrowheads and labels — `eventName`, or `eventName [guardName]`
   for guarded edges;
2. nodes as rounded rects with the state name;
3. the current state with a highlight fill;
4. the most recently taken edge with a flash that fades by simple
   time-decay alpha (no animate-package dependency).

**Simulator panel** — a plain DOM sidebar (no framework):

- Machine dropdown from the registry; switching calls `wrapup()` on the old
  machine and rebuilds graph → layout → render.
- Current state readout, including `INITIAL` / `TERMINAL`.
- One row per event: a fire button plus a collapsible JSON textarea for the
  payload, prefilled from `samplePayloads`. Events the current state does
  not handle are still fireable — seeing `not handled` is informative.
- Event log fed by `onHappens` + `onStateChange`, entries like
  `pointerDown {...} → IDLE ➜ PAN` or `→ not handled`, capped at ~200.
- Reset button → `machine.reset()`.

## Data flow

```
registry.create() → machine
machine → extractMachineGraph → layout(dagre) → static geometry
user fires event → machine.happens(event, payload)
    → onHappens    → log entry
    → onStateChange → highlight update + edge flash
```

## Error handling

- **Bad payload JSON** → inline message on the event row; nothing fired.
- **`create()` throws** → error shown in the panel; entry marked
  unavailable; other entries unaffected.
- **Unhandled event** → normal outcome, logged as `not handled`.

## Testing

- **Unit (vitest, `bunx nx test being`)** — `extractMachineGraph` covering:
  reaction edges with `defaultTargetState`; self-loop when a reaction has no
  target; guard-labeled edges from `eventGuards`; states with no reactions;
  multiple events targeting the same state pair.
- **Manual** — the page via `bun run dev:examples`: each registry machine
  renders, current state highlights, transitions flash, payload editing and
  reset work, log entries are correct.

## Build order

1. `extractMachineGraph` in `being`, with tests.
2. Page skeleton + registry with the vending machine entry.
3. Layout + renderer (static chart, no interaction).
4. Simulator panel wiring (fire events, highlight, log, reset).
5. Board machine registry entries (stub contexts), deferring any that
   cannot be stubbed sensibly.
6. Examples nav registration + polish.
