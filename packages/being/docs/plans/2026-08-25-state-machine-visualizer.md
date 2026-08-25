# State Machine Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An interactive statechart visualizer/simulator page in `apps/examples` that renders `@ue-too/being` machines on an `@ue-too/board` canvas and lets users fire events to step through transitions.

**Architecture:** A pure graph-extraction function in `packages/being` (unit-tested) feeds a page-local dagre layout and a canvas renderer running on a `Board` viewport. A DOM sidebar hosts a curated machine registry, per-event fire buttons with JSON payload editors, and an event log. The real machine runs in the page; highlighting reflects real transitions.

**Tech Stack:** TypeScript (strict), Vitest, Vite (examples app), `@dagrejs/dagre` (examples-app-only dependency), `@ue-too/board`, `@ue-too/being`.

**Spec:** `packages/being/docs/specs/2026-08-25-state-machine-visualizer-design.md`

## Global Constraints

- Always use `bun` / `bunx` — never npm/pnpm/yarn/node.
- Run package tasks from the repo root via Nx: tests are `bunx nx test being` — never `cd` into a package and run scripts directly.
- Prettier: 4-space indentation, single quotes, trailing comma `es5`. Run `bun run format` before the final commit.
- TypeScript strict mode; TS errors are blocking.
- Conventional commits scoped to package/app, e.g. `feat(being): ...`, `feat(examples): ...`.
- Worktree: `/Users/vincent.yy.chang/dev/ue-too/state-machine-visualizer`, branch `feat/state-machine-visualizer`. All work happens there.
- The repo root `docs/` directory is gitignored (TypeDoc output) — never put tracked files there.

---

### Task 1: `extractMachineGraph` in `@ue-too/being`

**Files:**
- Create: `packages/being/src/introspect.ts`
- Modify: `packages/being/src/index.ts` (add one export line)
- Test: `packages/being/test/introspect.test.ts`

**Interfaces:**
- Consumes: `StateMachine`, `TemplateState`, `TemplateStateMachine`, `BaseContext`, `Guard`, `EventGuards`, `EventReactions` from `packages/being/src/interface.ts` (all existing).
- Produces (used by Tasks 4–6 via `import { extractMachineGraph, MachineGraph } from '@ue-too/being'`):
  ```ts
  type MachineGraphNode = { id: string };
  type MachineGraphEdge = { from: string; to: string; event: string; guard?: string };
  type MachineGraph = { nodes: MachineGraphNode[]; edges: MachineGraphEdge[] };
  function extractMachineGraph(machine: StateMachine<any, any, any, any>): MachineGraph;
  ```

Semantics (from the spec): for each state and each event key in its `eventReactions`, emit one edge to `defaultTargetState` — or a self-loop (`to === from`) when the reaction has no target — plus one guard-labeled edge per `eventGuards` mapping for that event.

- [ ] **Step 1: Write the failing test**

Create `packages/being/test/introspect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
    BaseContext,
    EventGuards,
    EventReactions,
    Guard,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';
import { extractMachineGraph } from '../src/introspect';

type Events = { go: {}; stay: {}; submit: {} };
type States = 'A' | 'B' | 'C';

class AState extends TemplateState<Events, BaseContext, States> {
    protected _guards: Guard<BaseContext, 'isReady'> = {
        isReady: () => true,
    };
    protected _eventReactions: EventReactions<Events, BaseContext, States> = {
        go: { action: () => {}, defaultTargetState: 'B' },
        stay: { action: () => {} },
        submit: { action: () => {}, defaultTargetState: 'A' },
    };
    protected _eventGuards: Partial<
        EventGuards<Events, States, BaseContext, Guard<BaseContext>>
    > = {
        submit: [{ guard: 'isReady', target: 'C' }],
    };
}

class BState extends TemplateState<Events, BaseContext, States> {}
class CState extends TemplateState<Events, BaseContext, States> {}

function createMachine() {
    return new TemplateStateMachine<Events, BaseContext, States>(
        { A: new AState(), B: new BState(), C: new CState() },
        'A',
        { setup: () => {}, cleanup: () => {} }
    );
}

describe('extractMachineGraph', () => {
    it('emits one node per possible state', () => {
        const graph = extractMachineGraph(createMachine());
        expect(graph.nodes.map(n => n.id).sort()).toEqual(['A', 'B', 'C']);
    });

    it('emits an edge to defaultTargetState for a plain reaction', () => {
        const graph = extractMachineGraph(createMachine());
        expect(graph.edges).toContainEqual({ from: 'A', to: 'B', event: 'go' });
    });

    it('emits a self-loop when a reaction has no defaultTargetState', () => {
        const graph = extractMachineGraph(createMachine());
        expect(graph.edges).toContainEqual({
            from: 'A',
            to: 'A',
            event: 'stay',
        });
    });

    it('emits a guard-labeled edge per eventGuards mapping, alongside the default edge', () => {
        const graph = extractMachineGraph(createMachine());
        expect(graph.edges).toContainEqual({
            from: 'A',
            to: 'A',
            event: 'submit',
        });
        expect(graph.edges).toContainEqual({
            from: 'A',
            to: 'C',
            event: 'submit',
            guard: 'isReady',
        });
    });

    it('emits no outgoing edges for states without reactions', () => {
        const graph = extractMachineGraph(createMachine());
        expect(graph.edges.filter(e => e.from === 'B')).toEqual([]);
        expect(graph.edges.filter(e => e.from === 'C')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root of the worktree): `bunx nx test being`
Expected: FAIL — `introspect.test.ts` cannot resolve `../src/introspect`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/being/src/introspect.ts`:

```ts
/**
 * @packageDocumentation
 * Read-only introspection utilities for state machines.
 */
import { StateMachine } from './interface';

/**
 * A node in an extracted machine graph — one per possible state.
 *
 * @category Introspection
 */
export type MachineGraphNode = { id: string };

/**
 * A directed edge in an extracted machine graph.
 *
 * @remarks
 * `guard` is set when the edge comes from an `eventGuards` mapping; it holds
 * the guard's key in the state's guard registry. Edges with `to === from` are
 * self-loops (a reaction without a `defaultTargetState`).
 *
 * @category Introspection
 */
export type MachineGraphEdge = {
    from: string;
    to: string;
    event: string;
    guard?: string;
};

/**
 * A state machine's structure as a directed graph.
 *
 * @category Introspection
 */
export type MachineGraph = {
    nodes: MachineGraphNode[];
    edges: MachineGraphEdge[];
};

/**
 * Extracts a machine's states and transitions as a directed graph.
 *
 * @remarks
 * Reads only the machine's public surface (`possibleStates`, each state's
 * `eventReactions` and `eventGuards`) — the machine's behavior is untouched.
 * Per state and event, emits one edge to the reaction's
 * `defaultTargetState` (or a self-loop when it has none), plus one
 * guard-labeled edge per `eventGuards` mapping.
 *
 * @category Introspection
 */
export function extractMachineGraph(
    machine: StateMachine<any, any, any, any>
): MachineGraph {
    const stateIds = machine.possibleStates as string[];
    const nodes: MachineGraphNode[] = stateIds.map(id => ({ id }));
    const edges: MachineGraphEdge[] = [];
    for (const stateId of stateIds) {
        const state = machine.states[stateId];
        const reactions = state.eventReactions as Record<
            string,
            { defaultTargetState?: string }
        >;
        const eventGuards = state.eventGuards as Record<
            string,
            { guard: string; target: string }[] | undefined
        >;
        for (const event of Object.keys(reactions)) {
            edges.push({
                from: stateId,
                to: reactions[event].defaultTargetState ?? stateId,
                event,
            });
            for (const mapping of eventGuards[event] ?? []) {
                edges.push({
                    from: stateId,
                    to: mapping.target,
                    event,
                    guard: mapping.guard,
                });
            }
        }
    }
    return { nodes, edges };
}
```

Add to `packages/being/src/index.ts`, after `export * from './interface';`:

```ts
export * from './introspect';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx nx test being`
Expected: all tests PASS, including the pre-existing `being.test.ts`, `vending-machine-example.test.ts`, `hierarchical.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/being/src/introspect.ts packages/being/src/index.ts packages/being/test/introspect.test.ts
git commit -m "feat(being): add extractMachineGraph introspection utility"
```

---

### Task 2: Export the vending machine example from `being`

The visualizer registry (Task 3) needs `createVendingMachine`, which exists in `packages/being/src/vending-machine-example.ts` but is not exported from the package index. That file also has a stray module-level `console.log('test')` (last line) which would run for every importer — remove it as part of exporting.

**Files:**
- Modify: `packages/being/src/vending-machine-example.ts` (delete last line, `console.log('test');`)
- Modify: `packages/being/src/index.ts` (add one export line)

**Interfaces:**
- Produces: `createVendingMachine(): TemplateStateMachine<VendingMachineEvents, BaseContext, VendingMachineStates>` importable from `'@ue-too/being'`. Its events (`insertBills`, `selectCoke`, `selectRedBull`, `selectWater`, `cancelTransaction`) all have empty payloads; states are `IDLE`, `ONE_DOLLAR_INSERTED`, `TWO_DOLLARS_INSERTED`, `THREE_DOLLARS_INSERTED`.

- [ ] **Step 1: Remove the stray log and add the export**

In `packages/being/src/vending-machine-example.ts`, delete the final line:

```ts
console.log('test');
```

In `packages/being/src/index.ts`, after the `./introspect` export added in Task 1, add:

```ts
export * from './vending-machine-example';
```

- [ ] **Step 2: Run tests to verify nothing broke**

Run: `bunx nx test being`
Expected: all PASS (`vending-machine-example.test.ts` already exercises the machine).

- [ ] **Step 3: Commit**

```bash
git add packages/being/src/vending-machine-example.ts packages/being/src/index.ts
git commit -m "feat(being): export vending machine example from package index"
```

---

### Task 3: Page skeleton, registry, and examples-app registration

Create the new examples page with its HTML layout (canvas + sidebar), the machine registry seeded with the vending machine, and register the page in the Vite build, the examples nav, and i18n. No graph rendering yet — the page shows the canvas, the machine dropdown, and the current-state readout.

**Files:**
- Create: `apps/examples/src/state-machine-visualizer/index.html`
- Create: `apps/examples/src/state-machine-visualizer/registry.ts`
- Create: `apps/examples/src/state-machine-visualizer/main.ts`
- Modify: `apps/examples/vite.config.js` (add rollup input)
- Modify: `apps/examples/src/index.html` (nav link + example card)
- Modify: `apps/examples/src/i18n/en.ts`, `apps/examples/src/i18n/zh-TW.ts` (3 keys each)

**Interfaces:**
- Consumes: `createVendingMachine` from `'@ue-too/being'` (Task 2); `Board` from `'@ue-too/board'`.
- Produces (used by Tasks 5–7):
  ```ts
  // registry.ts
  type RegistryEntry = {
      id: string;
      label: string;
      create(): {
          machine: StateMachine<any, any, any, any>;
          samplePayloads: Record<string, unknown>;
      };
  };
  const registry: RegistryEntry[];
  ```
  `main.ts` owns: `board: Board`, the rAF loop calling `board.step(performance.now())`, and a `selectMachine(entry: RegistryEntry): void` function that later tasks extend.

- [ ] **Step 1: Create the page HTML**

`apps/examples/src/state-machine-visualizer/index.html`:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>State Machine Visualizer</title>
        <style>
            html,
            body {
                margin: 0;
                height: 100%;
                font-family:
                    system-ui,
                    -apple-system,
                    sans-serif;
            }
            #app {
                display: flex;
                height: 100%;
            }
            #graph {
                flex: 1;
                min-width: 0;
                display: block;
            }
            #sidebar {
                width: 320px;
                flex-shrink: 0;
                border-left: 1px solid #e2e8f0;
                padding: 12px;
                overflow-y: auto;
                box-sizing: border-box;
                font-size: 14px;
            }
            #sidebar h1 {
                font-size: 16px;
                margin: 0 0 12px;
            }
            #machine-select {
                width: 100%;
                margin-bottom: 8px;
            }
            #current-state {
                font-weight: 600;
                margin-bottom: 12px;
            }
            #panel-error {
                color: #dc2626;
                margin-bottom: 8px;
                white-space: pre-wrap;
            }
            .event-row {
                margin-bottom: 6px;
            }
            .event-row button {
                width: 100%;
                text-align: left;
                cursor: pointer;
            }
            .event-row textarea {
                width: 100%;
                box-sizing: border-box;
                font-family: monospace;
                font-size: 12px;
                margin-top: 4px;
            }
            .event-row .payload-error {
                color: #dc2626;
                font-size: 12px;
            }
            #reset-btn {
                width: 100%;
                margin: 12px 0;
                cursor: pointer;
            }
            #event-log {
                list-style: none;
                margin: 0;
                padding: 0;
                font-family: monospace;
                font-size: 12px;
            }
            #event-log li {
                border-top: 1px solid #f1f5f9;
                padding: 2px 0;
            }
        </style>
    </head>
    <body>
        <div id="app">
            <canvas id="graph"></canvas>
            <div id="sidebar">
                <h1>State Machine Visualizer</h1>
                <select id="machine-select"></select>
                <div id="current-state"></div>
                <div id="panel-error"></div>
                <div id="event-rows"></div>
                <button id="reset-btn">Reset machine</button>
                <ul id="event-log"></ul>
            </div>
        </div>
        <script type="module" src="./main.ts"></script>
    </body>
</html>
```

- [ ] **Step 2: Create the registry with the vending machine entry**

`apps/examples/src/state-machine-visualizer/registry.ts`:

```ts
import { createVendingMachine, StateMachine } from '@ue-too/being';

export type RegistryEntry = {
    id: string;
    label: string;
    create(): {
        machine: StateMachine<any, any, any, any>;
        samplePayloads: Record<string, unknown>;
    };
};

export const registry: RegistryEntry[] = [
    {
        id: 'vending-machine',
        label: 'Vending machine (being example)',
        create: () => ({
            machine: createVendingMachine(),
            samplePayloads: {},
        }),
    },
];
```

- [ ] **Step 3: Create the page entry module**

`apps/examples/src/state-machine-visualizer/main.ts`:

```ts
import { StateMachine } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { registry, RegistryEntry } from './registry';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
board.attach(canvas);

const machineSelect = document.getElementById(
    'machine-select'
) as HTMLSelectElement;
const currentStateEl = document.getElementById('current-state')!;
const panelErrorEl = document.getElementById('panel-error')!;

let machine: StateMachine<any, any, any, any> | null = null;

function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        machine.wrapup();
        machine = null;
    }
    panelErrorEl.textContent = '';
    try {
        const created = entry.create();
        machine = created.machine;
    } catch (error) {
        panelErrorEl.textContent = `Failed to create "${entry.label}": ${String(error)}`;
    }
}

for (const entry of registry) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    machineSelect.appendChild(option);
}
machineSelect.addEventListener('change', () => {
    const entry = registry.find(e => e.id === machineSelect.value);
    if (entry) {
        selectMachine(entry);
    }
});
selectMachine(registry[0]);

function step() {
    board.step(performance.now());
    currentStateEl.textContent = machine
        ? `Current state: ${String(machine.currentState)}`
        : 'No machine loaded';
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
```

- [ ] **Step 4: Register the page in Vite, nav, and i18n**

In `apps/examples/vite.config.js`, add to `rollupOptions.input` (after the `'svg'` entry):

```js
'state-machine-visualizer': resolve(
    __dirname,
    'src/state-machine-visualizer/index.html'
),
```

In `apps/examples/src/index.html`, add a nav link next to the existing ones (after the SVG link, line ~131):

```html
<a
    href="state-machine-visualizer/index.html"
    data-i18n="nav.state-machine"
    >State Machine Visualizer</a
>
```

and an example card following the pattern of the existing `.example-card` blocks (find the SVG card and copy its structure):

```html
<div class="example-card">
    <h3 data-i18n="card.state-machine.title">State Machine Visualizer</h3>
    <p data-i18n="card.state-machine.desc">
        Interactive statechart visualizer and simulator for @ue-too/being
        machines, rendered with @ue-too/board.
    </p>
    <a href="state-machine-visualizer/index.html" data-i18n="card.open"
        >Open</a
    >
</div>
```

(Match the card's inner link markup to what the neighboring cards actually use — copy a sibling card and change the text/href.)

In `apps/examples/src/i18n/en.ts`, add alongside the `nav.svg` / `card.svg.*` keys:

```ts
'nav.state-machine': 'State Machine Visualizer',
'card.state-machine.title': 'State Machine Visualizer',
'card.state-machine.desc':
    'Interactive statechart visualizer and simulator for @ue-too/being machines, rendered with @ue-too/board.',
```

In `apps/examples/src/i18n/zh-TW.ts`:

```ts
'nav.state-machine': '狀態機視覺化',
'card.state-machine.title': '狀態機視覺化',
'card.state-machine.desc':
    '互動式狀態機視覺化與模擬器，使用 @ue-too/board 繪製 @ue-too/being 狀態機。',
```

- [ ] **Step 5: Verify manually**

Run: `bun run dev:examples`
Open the dev server URL. Expected: the landing page shows the new nav link and card; the new page loads with an empty pannable canvas, the machine dropdown showing "Vending machine (being example)", and "Current state: IDLE". No console errors.

- [ ] **Step 6: Commit**

```bash
git add apps/examples/src/state-machine-visualizer apps/examples/vite.config.js apps/examples/src/index.html apps/examples/src/i18n/en.ts apps/examples/src/i18n/zh-TW.ts
git commit -m "feat(examples): add state machine visualizer page skeleton and registry"
```

---

### Task 4: Dagre layout module

**Files:**
- Modify: `apps/examples/package.json` (add dependency)
- Create: `apps/examples/src/state-machine-visualizer/layout.ts`

**Interfaces:**
- Consumes: `MachineGraph` from `'@ue-too/being'` (Task 1).
- Produces (used by Task 5):
  ```ts
  type LaidOutNode = { id: string; x: number; y: number; width: number; height: number }; // x,y = center
  type LaidOutEdge = {
      from: string; to: string; event: string; guard?: string;
      points: { x: number; y: number }[];
      selfLoop: boolean;
      labelX: number; labelY: number;
      label: string; // "event" or "event [guard]"
  };
  type LaidOutGraph = { nodes: LaidOutNode[]; edges: LaidOutEdge[] };
  function layoutGraph(graph: MachineGraph, measureText: (text: string) => number): LaidOutGraph;
  ```
  Edge order in `LaidOutGraph.edges` matches `MachineGraph.edges` order — Task 6 relies on this to flash the taken edge by index.

- [ ] **Step 1: Add the dagre dependency**

In `apps/examples/package.json`, add to `dependencies` (pinned, matching the repo's pinning style seen with `fabric`/`konva`):

```json
"@dagrejs/dagre": "1.1.5",
```

Then run from the repo root: `bun install`
Expected: installs without error. `@dagrejs/dagre` ships its own TypeScript types.

- [ ] **Step 2: Write the layout module**

`apps/examples/src/state-machine-visualizer/layout.ts`:

```ts
import dagre from '@dagrejs/dagre';
import { MachineGraph } from '@ue-too/being';

export type LaidOutNode = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type LaidOutEdge = {
    from: string;
    to: string;
    event: string;
    guard?: string;
    points: { x: number; y: number }[];
    selfLoop: boolean;
    labelX: number;
    labelY: number;
    label: string;
};

export type LaidOutGraph = {
    nodes: LaidOutNode[];
    edges: LaidOutEdge[];
};

const NODE_PADDING_X = 24;
const NODE_HEIGHT = 44;

export function layoutGraph(
    graph: MachineGraph,
    measureText: (text: string) => number
): LaidOutGraph {
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, edgesep: 20 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of graph.nodes) {
        g.setNode(node.id, {
            width: measureText(node.id) + NODE_PADDING_X * 2,
            height: NODE_HEIGHT,
        });
    }
    graph.edges.forEach((edge, i) => {
        if (edge.from === edge.to) {
            return; // self-loops are drawn manually, not laid out by dagre
        }
        const label = edge.guard
            ? `${edge.event} [${edge.guard}]`
            : edge.event;
        g.setEdge(
            edge.from,
            edge.to,
            { width: measureText(label), height: 16, labelpos: 'c' },
            `e${i}`
        );
    });

    dagre.layout(g);

    const nodes: LaidOutNode[] = graph.nodes.map(n => {
        const { x, y, width, height } = g.node(n.id);
        return { id: n.id, x, y, width, height };
    });
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const edges: LaidOutEdge[] = graph.edges.map((edge, i) => {
        const label = edge.guard
            ? `${edge.event} [${edge.guard}]`
            : edge.event;
        if (edge.from === edge.to) {
            const n = nodeById.get(edge.from)!;
            const cornerX = n.x + n.width / 2;
            const cornerY = n.y - n.height / 2;
            return {
                ...edge,
                label,
                selfLoop: true,
                points: [
                    { x: cornerX - 12, y: cornerY },
                    { x: cornerX + 28, y: cornerY - 32 },
                    { x: cornerX, y: cornerY + 12 },
                ],
                labelX: cornerX + 34,
                labelY: cornerY - 36,
            };
        }
        const laidOut = g.edge(edge.from, edge.to, `e${i}`);
        const mid = laidOut.points[Math.floor(laidOut.points.length / 2)];
        return {
            ...edge,
            label,
            selfLoop: false,
            points: laidOut.points,
            labelX: laidOut.x ?? mid.x,
            labelY: laidOut.y ?? mid.y,
        };
    });

    return { nodes, edges };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `bunx tsc --noEmit -p apps/examples` — if the examples app has no own tsconfig for type-checking, instead confirm via the Vite dev server console (`bun run dev:examples`, open the page) that there is no import/type error. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/examples/package.json bun.lock apps/examples/src/state-machine-visualizer/layout.ts
git commit -m "feat(examples): add dagre layout module for state machine visualizer"
```

---

### Task 5: Canvas renderer on the Board viewport

**Spec deviation (deliberate):** the spec suggested building edge curves via `@ue-too/curve`; this plan draws them directly with canvas `quadraticCurveTo` from dagre's waypoints. The curve package adds a dependency without simplifying anything here — dagre's waypoints map 1:1 onto canvas curve calls. If curve-based edges are wanted later (e.g. for hit-testing edges), that's a contained swap inside `render.ts`.

**Files:**
- Create: `apps/examples/src/state-machine-visualizer/render.ts`
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (wire graph extraction + layout + drawing into the rAF loop)

**Interfaces:**
- Consumes: `LaidOutGraph`, `layoutGraph` (Task 4); `extractMachineGraph` (Task 1); `board.context` / `board.step` (existing Board API, world-space drawing as in `apps/examples/src/base/main.ts`).
- Produces (used by Task 6):
  ```ts
  type Flash = { edgeIndex: number; at: number } | null;
  function drawGraph(
      ctx: CanvasRenderingContext2D,
      layout: LaidOutGraph,
      currentState: string | null,
      flash: Flash,
      now: number
  ): void;
  ```
  `main.ts` after this task holds `let layout: LaidOutGraph | null` and `let flash: Flash`, rebuilt/cleared inside `selectMachine`.

- [ ] **Step 1: Write the renderer**

`apps/examples/src/state-machine-visualizer/render.ts`:

```ts
import { LaidOutEdge, LaidOutGraph } from './layout';

export type Flash = { edgeIndex: number; at: number } | null;

const FLASH_DURATION_MS = 800;

const COLORS = {
    nodeFill: '#f8fafc',
    nodeStroke: '#64748b',
    nodeText: '#0f172a',
    activeFill: '#dbeafe',
    activeStroke: '#2563eb',
    edge: '#94a3b8',
    edgeLabel: '#475569',
    flash: '#2563eb',
};

function edgePath(ctx: CanvasRenderingContext2D, edge: LaidOutEdge): void {
    const pts = edge.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (edge.selfLoop) {
        // single control point loop: start -> control -> end
        ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
        return;
    }
    // smooth polyline: quadratic curves through midpoints
    for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
}

function drawArrowhead(ctx: CanvasRenderingContext2D, edge: LaidOutEdge): void {
    const pts = edge.points;
    const tip = pts[pts.length - 1];
    const prev = edge.selfLoop ? pts[1] : pts[pts.length - 2];
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
        tip.x - size * Math.cos(angle - Math.PI / 6),
        tip.y - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        tip.x - size * Math.cos(angle + Math.PI / 6),
        tip.y - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

export function drawGraph(
    ctx: CanvasRenderingContext2D,
    layout: LaidOutGraph,
    currentState: string | null,
    flash: Flash,
    now: number
): void {
    ctx.save();
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    layout.edges.forEach((edge, i) => {
        const flashing =
            flash !== null &&
            flash.edgeIndex === i &&
            now - flash.at < FLASH_DURATION_MS;
        ctx.strokeStyle = COLORS.edge;
        ctx.fillStyle = COLORS.edge;
        ctx.lineWidth = 1.5;
        edgePath(ctx, edge);
        ctx.stroke();
        drawArrowhead(ctx, edge);
        if (flashing) {
            const t = (now - flash!.at) / FLASH_DURATION_MS;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = COLORS.flash;
            ctx.fillStyle = COLORS.flash;
            ctx.lineWidth = 3;
            edgePath(ctx, edge);
            ctx.stroke();
            drawArrowhead(ctx, edge);
            ctx.restore();
        }
        // label with a knockout halo so it stays readable over edges
        ctx.save();
        ctx.fillStyle = COLORS.edgeLabel;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(edge.label, edge.labelX, edge.labelY);
        ctx.fillText(edge.label, edge.labelX, edge.labelY);
        ctx.restore();
    });

    for (const node of layout.nodes) {
        const active = node.id === currentState;
        const left = node.x - node.width / 2;
        const top = node.y - node.height / 2;
        ctx.fillStyle = active ? COLORS.activeFill : COLORS.nodeFill;
        ctx.strokeStyle = active ? COLORS.activeStroke : COLORS.nodeStroke;
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(left, top, node.width, node.height, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.nodeText;
        ctx.fillText(node.id, node.x, node.y);
    }

    ctx.restore();
}
```

- [ ] **Step 2: Wire extraction + layout + drawing into `main.ts`**

Modify `apps/examples/src/state-machine-visualizer/main.ts`:

Add imports:

```ts
import { extractMachineGraph } from '@ue-too/being';

import { LaidOutGraph, layoutGraph } from './layout';
import { drawGraph, Flash } from './render';
```

Add module state next to `let machine`:

```ts
let layout: LaidOutGraph | null = null;
let flash: Flash = null;

const measureCtx = document.createElement('canvas').getContext('2d')!;
function measureText(text: string): number {
    measureCtx.font = '13px system-ui, sans-serif';
    return measureCtx.measureText(text).width;
}
```

In `selectMachine`, inside the `try` after `machine = created.machine;`, add:

```ts
layout = layoutGraph(extractMachineGraph(created.machine), measureText);
flash = null;
```

and in the failure/cleanup paths (`if (machine)` block at the top and the `catch`) add `layout = null;`.

In the `step()` function, after `board.step(...)` and before the `currentStateEl` update, add:

```ts
if (board.context && layout) {
    const current = machine ? String(machine.currentState) : null;
    drawGraph(board.context, layout, current, flash, performance.now());
}
```

- [ ] **Step 3: Verify manually**

Run: `bun run dev:examples`, open the visualizer page.
Expected: the vending machine renders as 4 rounded-rect nodes laid out left-to-right with labeled, arrowed edges (including self-loops on `THREE_DOLLARS_INSERTED` for `insertBills`/`selectWater`, and on `ONE_DOLLAR_INSERTED`/`TWO_DOLLARS_INSERTED` for under-funded selections); `IDLE` is highlighted; pan and zoom work via the board's built-in input handling.

- [ ] **Step 4: Commit**

```bash
git add apps/examples/src/state-machine-visualizer/render.ts apps/examples/src/state-machine-visualizer/main.ts
git commit -m "feat(examples): render state machine graph on board canvas"
```

---

### Task 6: Simulator panel — fire events, log, reset

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/main.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–5; `machine.happens`, `machine.onHappens`, `machine.onStateChange`, `machine.reset` (existing `StateMachine` API).
- Produces: complete v1 user-facing behavior; no downstream consumers.

Behavior spec: one row per event (unique `event` values from the extracted graph's edges, in first-appearance order) with a fire button and a collapsible payload textarea prefilled from `samplePayloads[event] ?? {}`. Firing parses the textarea as JSON — on parse failure, show the error inline in that row and do not fire. The event log (max 200 entries, newest first) records every fired event with its result. The taken edge flashes: after a handled result, find the edge index matching `(from = state before, event, to = state after)`, preferring a guard-labeled edge over the default edge when both match.

- [ ] **Step 1: Build the event rows and log wiring**

In `apps/examples/src/state-machine-visualizer/main.ts`, add DOM refs:

```ts
const eventRowsEl = document.getElementById('event-rows')!;
const eventLogEl = document.getElementById('event-log')!;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
```

Add helpers at module level:

```ts
const MAX_LOG_ENTRIES = 200;

function appendLog(text: string): void {
    const li = document.createElement('li');
    li.textContent = text;
    eventLogEl.prepend(li);
    while (eventLogEl.children.length > MAX_LOG_ENTRIES) {
        eventLogEl.lastChild!.remove();
    }
}

function findTakenEdgeIndex(
    from: string,
    event: string,
    to: string
): number {
    if (!layout) {
        return -1;
    }
    let fallback = -1;
    for (let i = 0; i < layout.edges.length; i++) {
        const edge = layout.edges[i];
        if (edge.from === from && edge.event === event && edge.to === to) {
            if (edge.guard) {
                return i; // guarded edge is the more specific match
            }
            fallback = i;
        }
    }
    return fallback;
}

function fireEvent(
    event: string,
    payloadText: string,
    errorEl: HTMLElement
): void {
    if (!machine) {
        return;
    }
    errorEl.textContent = '';
    let payload: unknown;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        errorEl.textContent = `Invalid JSON: ${String(error)}`;
        return;
    }
    const before = String(machine.currentState);
    const result = (machine.happens as any)(event, payload);
    if (result.handled) {
        const after = String(machine.currentState);
        appendLog(`${event} ${payloadText} → ${before} ➜ ${after}`);
        const edgeIndex = findTakenEdgeIndex(before, event, after);
        if (edgeIndex !== -1) {
            flash = { edgeIndex, at: performance.now() };
        }
    } else {
        appendLog(`${event} ${payloadText} → not handled`);
    }
}

function buildEventRows(samplePayloads: Record<string, unknown>): void {
    eventRowsEl.textContent = '';
    if (!layout) {
        return;
    }
    const events: string[] = [];
    for (const edge of layout.edges) {
        if (!events.includes(edge.event)) {
            events.push(edge.event);
        }
    }
    for (const event of events) {
        const row = document.createElement('div');
        row.className = 'event-row';
        const button = document.createElement('button');
        button.textContent = `⚡ ${event}`;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'payload';
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.value = JSON.stringify(samplePayloads[event] ?? {}, null, 2);
        const errorEl = document.createElement('div');
        errorEl.className = 'payload-error';
        button.addEventListener('click', () =>
            fireEvent(event, textarea.value, errorEl)
        );
        details.append(summary, textarea);
        row.append(button, details, errorEl);
        eventRowsEl.appendChild(row);
    }
}
```

- [ ] **Step 2: Wire into machine selection and reset**

In `selectMachine`, in the `try` block after the `layout = ...` line from Task 5, add:

```ts
buildEventRows(created.samplePayloads);
eventLogEl.textContent = '';
appendLog(`loaded ${entry.label}`);
```

In the failure paths where `layout = null;` is set, also add `eventRowsEl.textContent = '';`.

After the `selectMachine(registry[0]);` call, wire the reset button:

```ts
resetBtn.addEventListener('click', () => {
    if (machine) {
        machine.reset();
        flash = null;
        appendLog('machine reset');
    }
});
```

- [ ] **Step 3: Verify manually — full vending machine walkthrough**

Run: `bun run dev:examples`, open the page. Verify:

1. Five event rows appear (`insertBills`, `selectCoke`, `selectRedBull`, `selectWater`, `cancelTransaction`), each with a `{}` payload.
2. Fire `insertBills` → highlight moves `IDLE` ➜ `ONE_DOLLAR_INSERTED`, the edge flashes blue and fades, log shows `insertBills {} → IDLE ➜ ONE_DOLLAR_INSERTED`.
3. Fire `selectRedBull` in `ONE_DOLLAR_INSERTED` → self-loop flash, state unchanged.
4. Fire `selectCoke` (nothing in `IDLE` handles it) → log shows `→ not handled`, no flash.
5. Enter `{bad json` in a payload textarea and fire → inline `Invalid JSON` error, nothing logged.
6. Reset → state back to `IDLE`, log entry `machine reset`.

- [ ] **Step 4: Commit**

```bash
git add apps/examples/src/state-machine-visualizer/main.ts
git commit -m "feat(examples): add simulator panel with event firing, log, and reset"
```

---

### Task 7: Board machine registry entries

Add board's machines to the registry. Acceptance bar per the spec: **kmt-input must work**; touch and the camera-control machines are added where their contexts stub cleanly and skipped otherwise (note any skip in the commit message).

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/registry.ts`

**Interfaces:**
- Consumes: from `'@ue-too/board'`: `createKmtInputStateMachine`, `DummyKmtInputContext`, `createDefaultPanControlStateMachine`, `createDefaultZoomControlStateMachine`, `createDefaultRotateControlStateMachine`, `createTouchInputStateMachine`. All are exported through board's index chain (`board/src/index.ts` → `input-interpretation`/`camera` → their submodule indexes); if one fails to import, add the missing `export` to the relevant submodule `index.ts` rather than deep-importing.
- Produces: additional `RegistryEntry` items; no interface changes.

- [ ] **Step 1: Add the kmt-input entry (required)**

In `registry.ts`, extend the imports and append to `registry`:

```ts
import {
    createDefaultPanControlStateMachine,
    createDefaultRotateControlStateMachine,
    createDefaultZoomControlStateMachine,
    createKmtInputStateMachine,
    DummyKmtInputContext,
} from '@ue-too/board';
```

```ts
{
    id: 'kmt-input',
    label: 'Board: keyboard/mouse input',
    create: () => ({
        machine: createKmtInputStateMachine(new DummyKmtInputContext()),
        samplePayloads: {
            leftPointerDown: { x: 100, y: 100 },
            leftPointerUp: { x: 100, y: 100 },
            leftPointerMove: { x: 120, y: 110 },
            middlePointerDown: { x: 100, y: 100 },
            middlePointerUp: { x: 100, y: 100 },
            middlePointerMove: { x: 120, y: 110 },
            pointerMove: { x: 120, y: 110 },
            scroll: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
            scrollWithCtrl: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
        },
    }),
},
```

(Payload shapes come from `kmt-input-state-machine.ts`: `PointerEventPayload = {x, y}`, `ScrollWithCtrlEventPayload = {deltaX, deltaY, x, y}`; all other kmt events have empty payloads and need no samples.)

- [ ] **Step 2: Add the camera-control entries**

`createDefaultPanControlStateMachine`, `createDefaultZoomControlStateMachine`, and `createDefaultRotateControlStateMachine` each take an optional context defaulting to a noop `BaseContext` — call them with no arguments:

```ts
{
    id: 'pan-control',
    label: 'Board: pan control',
    create: () => ({
        machine: createDefaultPanControlStateMachine(),
        samplePayloads: {},
    }),
},
{
    id: 'zoom-control',
    label: 'Board: zoom control',
    create: () => ({
        machine: createDefaultZoomControlStateMachine(),
        samplePayloads: {},
    }),
},
{
    id: 'rotation-control',
    label: 'Board: rotation control',
    create: () => ({
        machine: createDefaultRotateControlStateMachine(),
        samplePayloads: {},
    }),
},
```

If `createDefaultRotateControlStateMachine`'s signature differs (verify in `packages/board/src/camera/camera-mux/animation-and-lock/rotation-control-state-machine.ts` around line 435 — pan and zoom were confirmed to default their context), adapt to pass `{ setup: () => {}, cleanup: () => {} }` explicitly; if it requires a real camera rig with no default, drop the entry and note it in the commit message.

- [ ] **Step 3: Attempt the touch-input entry (deferrable)**

Check `packages/board/src/input-interpretation/input-state-machine/touch-input-context.ts` for the `TouchContext` interface. There is no `DummyTouchContext` class (unlike kmt). Decision rule: if `TouchContext` has ≤ ~10 members that can each be stubbed with a no-op or constant (like `DummyKmtInputContext` does for kmt), write an inline stub object in `registry.ts` and add the entry with `samplePayloads` of `{ touchstart: { points: [{ ident: 0, x: 100, y: 200 }] }, ... }` following the payload shapes in `touch-input-state-machine.ts`. Otherwise skip the entry — the spec explicitly defers board machines whose contexts resist stubbing — and note the skip in the commit message.

- [ ] **Step 4: Verify manually**

Run: `bun run dev:examples`, open the page. For each new dropdown entry: the graph renders, the initial state is highlighted (`IDLE` for kmt, `ACCEPTING_USER_INPUT` for camera controls), and firing sampled events transitions correctly (e.g. kmt: `spacebarDown` → `READY_TO_PAN_VIA_SPACEBAR`, then `leftPointerDown` → `INITIAL_PAN`). Confirm a broken-looking machine doesn't take down the page (the `create()` try/catch shows an inline error instead).

- [ ] **Step 5: Commit**

```bash
git add apps/examples/src/state-machine-visualizer/registry.ts
git commit -m "feat(examples): add board input and camera machines to visualizer registry"
```

---

### Task 8: Final verification and polish

**Files:**
- Modify: whatever `bun run format` touches (formatting only).

- [ ] **Step 1: Format**

Run from repo root: `bun run format`
Then: `bun run format:check`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `bun test`
Expected: all packages pass (this catches any accidental breakage in `being` consumers from the new exports).

- [ ] **Step 3: Build check**

Run: `bun run build` and `bun run build:apps`
Expected: both succeed — this validates the new Vite input entry and the dagre dependency in the production build.

- [ ] **Step 4: Final manual pass**

Run: `bun run dev:examples`. Walk the Task 6 vending-machine checklist once more, plus one kmt-input transition. Expected: all behaviors intact after formatting.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(examples): format and finalize state machine visualizer"
```

If there is nothing to commit after formatting, skip the commit.
