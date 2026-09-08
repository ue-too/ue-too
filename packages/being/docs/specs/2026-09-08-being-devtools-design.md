# `@ue-too/being-devtools` — Design

**Date:** 2026-09-08
**Status:** Approved
**Branch:** `feat/being-devtools`

## Overview

The state machine visualizer in `apps/examples` can already watch a machine it
did not create: the five board entries borrow the machines running inside the
page's own viewport `Board` and drive the chart from real input (see the
[2026-08-31 design](./2026-08-31-visualizer-live-board-machines-design.md)).
What it cannot do is leave the examples app. The panel is a page you navigate
to, wired to a dozen DOM ids in a hand-written sidebar, not a thing you attach
to your own machine.

This design turns that page into a published package, `@ue-too/being-devtools`,
whose whole user-facing contract is one line after building a machine:

```ts
import { attachMachineDebugger } from '@ue-too/being-devtools';

const machine = new TemplateStateMachine(states, 'IDLE', context);
attachMachineDebugger(machine, { name: 'pan-control' });
```

That call injects a collapsed floating panel into the host page. Ctrl+Shift+M
expands it to the familiar chart, log, context inspector and fire buttons,
now showing the caller's machine. The examples visualizer becomes a thin
consumer of the same package, so there is one copy of the layout and render
code and the page proves the package works.

This closes the "attach to a running machine" non-goal from the
[2026-08-25 visualizer design](./2026-08-25-state-machine-visualizer-design.md)
for the same-page case.

## Goals

- A developer using `@ue-too/being` in any web page can see their machine's
  chart, current state, context, and event log with one function call and no
  layout changes to their page.
- A developer using `@ue-too/board` can register all five board input and
  camera machines with one call.
- Several attached machines share one panel as tabs.
- The panel never damages the host's machine: no `wrapup()`, no listener
  leaks, disposable in one call.
- The examples visualizer page is rebuilt on the package, with no user-visible
  regression: same chart, same log coalescing, same fire buttons, same
  precondition dimming, same reset recovery.
- No breaking change to `@ue-too/being` or `@ue-too/board`. Neither package
  changes at all.

## Non-goals (v1)

- A browser extension or any cross-page / cross-frame protocol. The
  `window.__UE_TOO_BEING__` hook is shaped so an extension could consume it
  later, but nothing consumes it now.
- Hierarchical machines. Still gated on `hierarchical.ts` graduating.
- Time travel, event replay, or recording.
- Editing context from the panel.
- Framework wrappers (React/Vue components). Consumers call the function in an
  effect or `onMounted` themselves.
- A built-in layout to replace dagre. Dagre stays, pinned at the version the
  examples app already uses.

## Architecture

### Package

`packages/being-devtools`, published as `@ue-too/being-devtools`, in the
integration layer of the monorepo. Created with `bun run scaffold:package
being-devtools`, then adjusted to match `board-react-adapter`:

- `dependencies`: `@ue-too/being` and `@ue-too/board` as `workspace:*`,
  `@dagrejs/dagre` at `1.1.5`.
- `project.json` build target: `dependsOn` `being` and `board`; build command
  passes `--external @ue-too/being --external @ue-too/board --external
@dagrejs/dagre`.
- `docs:build` target uses `docs-build-i18n.ts` like every other package.
- `nx.json` already releases `packages/*`, so the package versions in
  lockstep with no config change.
- `CLAUDE.md` project structure gains a `being-devtools/` line under
  Integration.

### Source modules

```
packages/being-devtools/src/
  index.ts        public exports
  attach.ts       attachMachineDebugger / attachBoardDebugger and the shared default panel
  debugger.ts     MachineDebugger class: owns the panel, tabs, render loop, hotkey
  registry.ts     MachineRegistry: name → attached machine + subscription disposer
  board.ts        resolveBoardMachines(board): the five machines plus sample payloads
  hotkey.ts       parseHotkey / matchesHotkey (pure)
  log.ts          EventLog: coalescing log model (pure, no DOM)
  enabled.ts      computeEnabledEdges(machine, layout) (pure, moved from main.ts)
  context.ts      serializeContext (pure, moved from main.ts)
  layout.ts       moved verbatim from apps/examples
  render.ts       moved verbatim from apps/examples
  panel-dom.ts    builds the panel's DOM tree and styles inside a shadow root
```

The split is DOM versus not-DOM. Everything in `registry.ts`, `hotkey.ts`,
`log.ts`, `enabled.ts`, `context.ts`, `layout.ts`, and `board.ts` runs under
plain `bun test` with no DOM environment. `debugger.ts` and `panel-dom.ts`
are the only files that touch `document`.

### Public API

```ts
export type AttachOptions = {
    /** Tab label. Must be unique within a panel; a collision throws. */
    name?: string;
    /** Default payload JSON for each event's fire button. */
    samplePayloads?: Record<string, unknown>;
};

export type MachineDebuggerOptions = {
    /** Render inline into this element instead of as a floating overlay. */
    container?: HTMLElement;
    /** Toggle shortcut, e.g. 'ctrl+shift+m' (default). `false` disables. */
    hotkey?: string | false;
    /** Start expanded. Default false for overlay, true for container. */
    openByDefault?: boolean;
};

export type AttachHandle = { dispose(): void };

export class MachineDebugger {
    constructor(options?: MachineDebuggerOptions);
    attach(
        machine: StateMachine<any, any, any, any>,
        options?: AttachOptions
    ): AttachHandle;
    attachBoard(board: Board, options?: { namePrefix?: string }): AttachHandle;
    open(): void;
    close(): void;
    toggle(): void;
    get isOpen(): boolean;
    /** The panel's own graph viewport, so a page can diagram the board it pans. */
    get board(): Board;
    dispose(): void;
}

/** Attach to the page's shared overlay panel, creating it on first call. */
export function attachMachineDebugger(
    machine: StateMachine<any, any, any, any>,
    options?: AttachOptions
): AttachHandle;

/** Attach all five board machines to the shared overlay panel. */
export function attachBoardDebugger(
    board: Board,
    options?: { namePrefix?: string }
): AttachHandle;
```

`attachMachineDebugger` and `attachBoardDebugger` share one module-level
`MachineDebugger` created lazily with default options. When its last
attachment is disposed the shared panel is disposed too, so a page that
attaches and detaches leaves no trace.

Unnamed attachments get `machine-1`, `machine-2`, … in attach order.

### Live-only semantics

Every attached machine is borrowed. The panel therefore:

- never calls `wrapup()` — the 2026-08-31 design explains that this parks a
  live machine in `TERMINAL` and stops the real board responding to input;
- keeps the reset button, because `reset()` round-trips through `TERMINAL`
  and restarts, and is the recovery for a machine stranded by a hand-fired
  half-gesture;
- on detach, only disposes its `onEventResult` subscription and drops the
  tab.

The "simulated" registry kind from the examples page disappears. The examples
page constructs its two demo machines once and attaches them like any other
borrowed machine.

### Board helper

`resolveBoardMachines(board)` returns up to five entries:

| name suffix        | source                               | sample payloads          |
| ------------------ | ------------------------------------ | ------------------------ |
| `kmt-input`        | `board.kmtInputStateMachine`         | the nine KMT payloads    |
| `touch-input`      | `board.touchInputStateMachine`       | the three touch payloads |
| `pan-control`      | `board.cameraMux.panStateMachine`    | none                     |
| `zoom-control`     | `board.cameraMux.zoomStateMachine`   | none                     |
| `rotation-control` | `board.cameraMux.rotateStateMachine` | none                     |

Names are `${namePrefix ?? 'board'}:${suffix}`. Two boards on one page pass
different prefixes.

The camera mux is narrowed structurally, by checking that
`panStateMachine`, `zoomStateMachine`, and `rotateStateMachine` are present
on `board.cameraMux`, not with `instanceof`. This matches `@ue-too/board`'s
own check in `boardify/index.ts` and survives a consumer that resolves two
copies of `@ue-too/board`. A board whose parser or mux lacks a machine skips
that entry; the helper attaches what it finds and throws only if it finds
nothing.

### Panel

**Mounting.** With no `container`, `panel-dom.ts` appends a host `<div>` to
`document.body`, fixed to the bottom-right corner above host content, and
attaches a shadow root. All styles live in a `<style>` inside the shadow
root, so host CSS cannot restyle the panel and the panel cannot leak out.
With a `container`, the same shadow root is attached to the caller's element
and the fixed positioning is dropped.

`@ue-too/board` attaches pointer listeners to the canvas and keyboard
listeners to `window`, and never inspects `event.target`, so a canvas inside
a shadow root should behave normally. This is verified in the first
implementation task. If it does not, the fallback is a light-DOM root with
`ue-being-devtools-` prefixed classes; the rest of the design is unchanged.

**Collapsed.** A small pill showing the attached machine count. Clicking it
opens the panel.

**Expanded.** The current visualizer layout: pannable, zoomable graph canvas
on the left (its own `Board`), sidebar on the right containing, top to
bottom: tab strip (one tab per attached machine), current state, context
inspector (collapsed `<details>`), event fire buttons with payload
`<textarea>`s, reset button, event log. A close control in the corner.
The overlay is 60vw × 55vh, with a 640 × 400 px minimum; the container case
fills its container.

**Render loop.** One `requestAnimationFrame` loop per panel, started on
`open()` and stopped on `close()`. The graph `Board` only steps while the
panel is open, so a collapsed overlay costs nothing per frame.
Subscriptions stay attached while collapsed, so the log is complete when
the panel reopens.

**Hotkey.** `debugger.ts` registers one `keydown` listener on `window`.
`matchesHotkey(event, parsed)` treats `ctrl` as satisfied by either
`ctrlKey` or `metaKey` so the default works on macOS. A `container` panel
still honours the hotkey unless `hotkey: false`.

### Console hook

Creating any panel sets `window.__UE_TOO_BEING__`:

```ts
{
    machines: Map<string, StateMachine<any, any, any, any>>;
    open(): void;   // opens the most recently created panel
    close(): void;
    attach(machine, options?): AttachHandle;  // to the shared overlay panel
}
```

`machines` is the union across all live panels. The hook is removed when
the last panel is disposed. It exists for console inspection when the
overlay is inconvenient, and as the seam a future extension would read.

## Data flow

1. `attach(machine, opts)` → registry assigns a name, subscribes via
   `onEventResult` (if the machine implements it; otherwise the tab shows a
   one-line notice and no log), builds the layout with
   `layoutGraph(extractMachineGraph(machine), measureText)`, adds a tab, and
   selects it if it is the first.
2. An event on the machine, from host input or a fire button, fires the
   subscription → `EventLog.append(text, key)` coalesces repeats → a
   matching edge is flashed.
3. Each frame while open: step the graph board, `drawGraph` the selected
   tab's layout with current state, flash, and `computeEnabledEdges`, and
   refresh the state readout and context text if changed.
4. `dispose()` on a handle → unsubscribe, remove the tab, select a
   neighbour. Last handle on the shared panel → panel disposed, hook removed.

## Error handling

- `attach` throws synchronously on a duplicate name, before subscribing.
- A machine without `onEventResult` is attached with a visible notice in its
  tab, matching the existing visualizer behaviour.
- `layoutGraph` or `extractMachineGraph` throwing is caught; the tab shows
  the message in place of the chart and the machine is not subscribed.
- Fire buttons keep the existing behaviour: invalid JSON and thrown actions
  are shown inline under the button and logged.
- `attachBoardDebugger` throws only if no machine at all is found on the
  board; partial boards attach what exists.

## Examples page

`apps/examples/src/state-machine-visualizer/` keeps `index.html` (reduced to
a single full-page container plus the title) and `account-demo.ts`.
`main.ts` becomes:

```ts
const panel = new MachineDebugger({ container, openByDefault: true });
panel.attach(createVendingMachine(), {
    name: 'Vending machine (being example)',
});
panel.attach(createAccountDemoMachine(), {
    name: 'Bank account (preconditions demo)',
    samplePayloads,
});
panel.attachBoard(panelGraphBoard); // the diagram's own board, resolved from the panel
```

The panel exposes its own graph `Board` (`get board()`) so the page can keep
the self-referential trick from the 2026-08-31 design: the board being
diagrammed is the board you are panning. `registry.ts`, `layout.ts`, and
`render.ts` are deleted from the app. The vite entry is unchanged.
`@dagrejs/dagre` is removed from the app's dependencies since the package
brings it.

## Testing

Under `bun test`, no DOM environment:

- `registry.ts`: attach assigns sequential default names; duplicate explicit
  name throws before subscribing; detach unsubscribes exactly once; last
  detach reports empty so the caller can tear down.
- `hotkey.ts`: parses `ctrl+shift+m`; matches with `ctrlKey` and with
  `metaKey`; rejects when an extra modifier is held; `false` never matches.
- `log.ts`: same key coalesces with `×N`; different key starts a new line;
  cap evicts oldest; `!unhandled` / `!noop` sentinels cannot collide with a
  state name.
- `enabled.ts`: only edges leaving the current state; precondition fail
  dims; missing guard fails closed; throwing guard stays enabled.
- `context.ts`: functions stripped; circular marked; truncation at the cap.
- `board.ts`: a stub board exposing all five machines yields five entries
  with the expected names and payloads; a stub without a touch parser yields
  four; a stub with a mux lacking the getters yields two; a stub with nothing
  throws.
- `layout.ts`: existing behaviour pinned with a small graph, if no tests
  moved with it.

The DOM panel is verified by hand in the examples visualizer page, which is
the reason the page is rebuilt on the package in the same change. The
manual checklist is: overlay appears collapsed on a plain page; hotkey
toggles it; spacebar-pan over the graph lights the pan machine; the log
coalesces during a drag; reset recovers a stranded live machine; dispose
removes every node and the window hook.

## Build order

1. Scaffold the package; move `layout.ts` and `render.ts` in verbatim; get
   `bunx nx build being-devtools` green with the externals.
2. Pure modules with tests: `hotkey.ts`, `log.ts`, `enabled.ts`,
   `context.ts`, `registry.ts`, `board.ts`.
3. `panel-dom.ts` and `debugger.ts`: container mounting first, verified by
   pointing the examples page at it; then the overlay and hotkey.
4. `attach.ts` shared panel and the window hook.
5. Rebuild the examples page on the package; delete the app's copies.
6. README, TypeDoc config, `CLAUDE.md` structure line.
