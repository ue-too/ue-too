# `@ue-too/being-devtools` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@ue-too/being-devtools`, a package that attaches the examples app's state machine visualizer to any running `@ue-too/being` machine with one function call, and rebuild the examples visualizer page on top of it.

**Architecture:** A new integration-layer package whose modules split along the DOM boundary. Pure modules (`hotkey`, `log`, `enabled`, `context`, `registry`, `board`, `hook`, `attach`, plus the moved `layout` and `render`) are unit-tested under plain `bun test`. Two DOM modules (`panel-dom`, `debugger`) build a Shadow DOM panel with a pannable graph canvas, tabs per attached machine, an event log, fire buttons, and a reset, and are verified by hand through the rebuilt examples page. `attach.ts` exposes the one-liner `attachMachineDebugger` / `attachBoardDebugger` over a lazily created shared overlay panel, and `hook.ts` publishes `window.__UE_TOO_BEING__` for console access.

**Tech Stack:** TypeScript (strict), Bun, Nx, Vitest-style tests run by `bun test`, Vite (examples app), `@dagrejs/dagre` 1.1.5 (layout), `@ue-too/board` (graph viewport), Shadow DOM.

**Spec:** `packages/being/docs/specs/2026-09-08-being-devtools-design.md`

## Global Constraints

- **Package manager & runtime:** Bun. Never `npm`/`yarn`/`pnpm`/`node`.
- **Run tasks from the repo root via Nx:** `bunx nx test being-devtools`, `bunx nx build being-devtools`, `bunx nx build examples`. Do NOT `cd` into a package and run `bun run <script>`.
- **Formatting:** Prettier — 4-space indent, single quotes, trailing comma `es5`. Run `bun run format` before each commit; the code blocks below are close to Prettier output but Prettier's result wins.
- **TypeScript:** strict mode; TypeScript errors are blocking; no `any` in public interfaces. Two sanctioned exceptions: the internal alias `AnyStateMachine = StateMachine<any, any, any, any>`, which never appears in a public parameter or return type, and the `...args: any[]` rest parameters inside the public `MachineLike` shape, which exist so that concrete machines are accepted without a cast (see Task 5).
- **Type-checking outside the package build:** `apps/examples` is a composite project with references, so `tsc --noEmit` on its tsconfig needs every referenced package built. Where this plan type-checks a single file it passes the file to `tsc` directly with explicit flags, which bypasses references and resolves workspace packages through `node_modules`:
  `bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2020 --lib es2020,dom <file>`
- **`@ue-too/being` and `@ue-too/board` do not change.** No task touches `packages/being/src` or `packages/board/src`.
- **Dependencies of the new package are exactly:** `@ue-too/being` (`workspace:*`), `@ue-too/board` (`workspace:*`), `@dagrejs/dagre` (`1.1.5`). Nothing else.
- **Live-only semantics.** The panel never calls `wrapup()` on any machine. `reset()` is allowed (it round-trips through `TERMINAL` and restarts). Detaching only disposes the `onEventResult` subscription.
- **Conventional commits drive published versions.** Use exactly the commit types given in each task: `feat(being-devtools):`, `refactor(examples):`, `docs(being-devtools):`, `chore:`. No commit in this plan may be labeled `!`.
- **Tests import from `vitest`** (`import { describe, expect, it } from 'vitest'`) and live in `packages/being-devtools/test/*.test.ts`. `bun test` rewrites the `vitest` import to `bun:test` — this is how every other package in the repo does it.
- **Branch:** `feat/being-devtools` (already exists and holds the spec).

---

### Task 1: Scaffold the package and move `layout.ts` / `render.ts`

**Files:**

- Create (via scaffold): `packages/being-devtools/` — `package.json`, `project.json`, `tsconfig.json`, `tsconfig.spec.json`, `jest.config.js`, `rollup.config.js`, `typedoc.json`, `README.md`, `src/index.ts`, `test/being-devtools.test.ts`
- Create: `packages/being-devtools/src/layout.ts` (copied verbatim from `apps/examples/src/state-machine-visualizer/layout.ts`)
- Create: `packages/being-devtools/src/render.ts` (copied verbatim from `apps/examples/src/state-machine-visualizer/render.ts`)
- Modify: `tsconfig.json` (repo root) — add a project reference
- Test: `packages/being-devtools/test/layout.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
    - `layoutGraph(graph: MachineGraph, measureText: (text: string) => number): LaidOutGraph`
    - `type LaidOutGraph = { nodes: LaidOutNode[]; edges: LaidOutEdge[] }`, `type LaidOutEdge = { from; to; event; guard?; preconditions?; points; selfLoop; labelX; labelY; label }`
    - `drawGraph(ctx: CanvasRenderingContext2D, layout: LaidOutGraph, currentState: string | null, flash: Flash, now: number, enabledEdges?: boolean[]): void`
    - `type Flash = { edgeIndex: number; at: number } | null`

- [ ] **Step 1: Run the scaffold**

```bash
bun run scaffold:package being-devtools
```

Expected: `✅ Created ...` lines and a new `packages/being-devtools/` directory.

- [ ] **Step 2: Replace `packages/being-devtools/package.json`**

The scaffold writes an old version and no dependencies. Overwrite the file with:

```json
{
    "dependencies": {
        "@dagrejs/dagre": "1.1.5",
        "@ue-too/being": "workspace:*",
        "@ue-too/board": "workspace:*"
    },
    "exports": {
        ".": {
            "default": "./src/index.ts",
            "import": "./src/index.ts",
            "types": "./src/index.ts"
        },
        "./*": {
            "default": "./src/*/index.ts",
            "import": "./src/*/index.ts",
            "types": "./src/*/index.ts"
        },
        "./package.json": "./package.json"
    },
    "homepage": "https://github.com/kinnet-studio/ue-too",
    "license": "MIT",
    "main": "./src/index.ts",
    "module": "./src/index.ts",
    "name": "@ue-too/being-devtools",
    "repository": {
        "type": "git",
        "url": "https://github.com/kinnet-studio/ue-too.git"
    },
    "scripts": {
        "build:legacy": "rm -rf dist && rollup -c rollup.config.js",
        "test": "jest"
    },
    "type": "module",
    "types": "./src/index.ts",
    "version": "0.18.0"
}
```

`0.18.0` matches the workspace's lockstep version (see `packages/being/package.json`); `nx release` bumps every package together.

- [ ] **Step 3: Replace `packages/being-devtools/project.json`**

Match `packages/board-react-adapter/project.json`: externals on the build, `dependsOn` for the two workspace deps, and the i18n docs script.

```json
{
    "$schema": "../../node_modules/nx/schemas/project-schema.json",
    "name": "being-devtools",
    "projectType": "library",
    "sourceRoot": "packages/being-devtools/src",
    "tags": [],
    "targets": {
        "build": {
            "dependsOn": [
                {
                    "projects": ["being", "board"],
                    "target": "build"
                }
            ],
            "executor": "nx:run-commands",
            "options": {
                "command": "rm -rf dist && bun run ../../scripts/build.ts --external @ue-too/being --external @ue-too/board --external @dagrejs/dagre",
                "cwd": "packages/being-devtools"
            }
        },
        "build:bun": {
            "dependsOn": [
                {
                    "projects": ["being", "board"],
                    "target": "build"
                }
            ],
            "executor": "nx:run-commands",
            "options": {
                "command": "rm -rf dist && bun run ../../scripts/build.ts --external @ue-too/being --external @ue-too/board --external @dagrejs/dagre",
                "cwd": "packages/being-devtools"
            }
        },
        "docs:build": {
            "executor": "nx:run-commands",
            "options": {
                "command": "bun run ../../scripts/docs-build-i18n.ts",
                "cwd": "packages/being-devtools"
            }
        },
        "move-package": {
            "executor": "nx:run-commands",
            "options": {
                "command": "node ../../scripts/move-package.mjs",
                "cwd": "packages/being-devtools"
            }
        },
        "nx-release-publish": {
            "executor": "nx:run-commands",
            "options": {
                "command": "node ../../../scripts/publish-package.mjs",
                "cwd": "packages/being-devtools/dist",
                "forwardAllArgs": false
            }
        },
        "test": {
            "executor": "nx:run-commands",
            "options": {
                "command": "bun test",
                "cwd": "packages/being-devtools"
            }
        }
    }
}
```

- [ ] **Step 4: Replace `packages/being-devtools/tsconfig.json`**

Add project references so `tsc --emitDeclarationOnly` (run by `scripts/build.ts`) can see the workspace deps' declarations. This mirrors `packages/board-react-adapter/tsconfig.json` minus the `jsx` line. Add `"lib": ["ES2020", "DOM"]` because `panel-dom.ts` and `debugger.ts` (later tasks) use `document`, `window`, `ShadowRoot`, and `requestAnimationFrame`.

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "composite": true,
        "declaration": true,
        "lib": ["ES2020", "DOM"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "outDir": "dist",
        "rootDir": "src",
        "strict": true,
        "tsBuildInfoFile": "dist/being-devtools.tsbuildinfo",
        "types": []
    },
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*"],
    "references": [
        {
            "path": "../being"
        },
        {
            "path": "../board"
        }
    ]
}
```

- [ ] **Step 5: Register the package in the root `tsconfig.json`**

In the repo-root `tsconfig.json`, add one entry to the `references` array, after the `./packages/board-pixi-react-integration` entry:

```json
{
    "path": "./packages/being-devtools"
}
```

- [ ] **Step 6: Copy `layout.ts` and `render.ts` verbatim**

```bash
cp apps/examples/src/state-machine-visualizer/layout.ts packages/being-devtools/src/layout.ts
cp apps/examples/src/state-machine-visualizer/render.ts packages/being-devtools/src/render.ts
```

Do not edit either file. The app's copies stay in place until Task 8 deletes them; until then the app and the package each have one copy.

- [ ] **Step 7: Write `packages/being-devtools/src/index.ts`**

Replace the scaffold's placeholder with:

````typescript
/**
 * @packageDocumentation
 * Attachable devtools for `@ue-too/being` state machines.
 *
 * @remarks
 * Attach a floating debugger panel to any running machine with one call:
 *
 * ```ts
 * import { attachMachineDebugger } from '@ue-too/being-devtools';
 *
 * attachMachineDebugger(machine, { name: 'pan-control' });
 * ```
 *
 * The panel draws the machine's state chart, highlights the current state,
 * dims transitions whose preconditions currently fail, logs every event the
 * machine handles (coalescing repeats), shows the context, and lets you fire
 * events by hand. Ctrl+Shift+M (Cmd+Shift+M on macOS) toggles it.
 */

export { layoutGraph } from './layout';
export type { LaidOutEdge, LaidOutGraph, LaidOutNode } from './layout';
export { drawGraph } from './render';
export type { Flash } from './render';
````

Later tasks append their exports to this file.

- [ ] **Step 8: Write the failing layout test**

Delete the scaffold's `packages/being-devtools/test/being-devtools.test.ts` and create `packages/being-devtools/test/layout.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { layoutGraph } from '../src/layout';

const measure = (text: string) => text.length * 7;

describe('layoutGraph', () => {
    it('positions every node and gives each edge a label and a path', () => {
        const laid = layoutGraph(
            {
                nodes: [{ id: 'A' }, { id: 'B' }],
                edges: [
                    { from: 'A', to: 'B', event: 'go' },
                    { from: 'B', to: 'B', event: 'stay' },
                ],
            },
            measure
        );

        expect(laid.nodes.map(n => n.id)).toEqual(['A', 'B']);
        for (const node of laid.nodes) {
            expect(Number.isFinite(node.x)).toBe(true);
            expect(Number.isFinite(node.y)).toBe(true);
            // NODE_PADDING_X (24) on each side
            expect(node.width).toBe(measure(node.id) + 48);
            expect(node.height).toBe(44);
        }

        expect(laid.edges).toHaveLength(2);
        expect(laid.edges[0].label).toBe('go');
        expect(laid.edges[0].selfLoop).toBe(false);
        expect(laid.edges[0].points.length).toBeGreaterThanOrEqual(2);
        expect(laid.edges[1].selfLoop).toBe(true);
        expect(laid.edges[1].points).toHaveLength(5);
    });

    it('labels preconditions and routing guards', () => {
        const laid = layoutGraph(
            {
                nodes: [{ id: 'A' }, { id: 'B' }],
                edges: [
                    {
                        from: 'A',
                        to: 'B',
                        event: 'withdraw',
                        guard: 'isOverdrawn',
                        preconditions: ['hasFunds'],
                    },
                ],
            },
            measure
        );
        expect(laid.edges[0].label).toBe('withdraw if hasFunds [isOverdrawn]');
    });
});
```

- [ ] **Step 9: Install and run the test to verify it fails**

```bash
bun install
bunx nx test being-devtools
```

Expected: `bun install` links the workspace package. The test run should FAIL only if `layout.ts` or dagre did not resolve; if it passes immediately that is fine too — the file is a verbatim move and the test pins existing behaviour. Confirm the two tests execute (2 pass or a resolution error, not "0 tests").

- [ ] **Step 10: Run the build**

```bash
bunx nx build being-devtools
```

Expected: `dist/` created with `index.js` and `.d.ts` files, no tsc errors.

- [ ] **Step 11: Commit**

```bash
bun run format
git add packages/being-devtools tsconfig.json bun.lock
git commit -m "feat(being-devtools): scaffold package with graph layout and render

Copies layout.ts and render.ts verbatim from the examples visualizer; the
app's copies are removed when the page is rebuilt on the package.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 2: `hotkey.ts`

**Files:**

- Create: `packages/being-devtools/src/hotkey.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/hotkey.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
    - `type ParsedHotkey = { ctrl: boolean; shift: boolean; alt: boolean; key: string }`
    - `type HotkeyEventLike = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }` (a `KeyboardEvent` satisfies it)
    - `parseHotkey(spec: string): ParsedHotkey` — throws on no key or two keys
    - `matchesHotkey(event: HotkeyEventLike, hotkey: ParsedHotkey): boolean` — `ctrl` is satisfied by `ctrlKey` **or** `metaKey`

- [ ] **Step 1: Write the failing test**

Create `packages/being-devtools/test/hotkey.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { matchesHotkey, parseHotkey } from '../src/hotkey';

function key(overrides: Partial<Parameters<typeof matchesHotkey>[0]>) {
    return {
        key: 'm',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...overrides,
    };
}

describe('parseHotkey', () => {
    it('parses modifiers and a key, case-insensitively', () => {
        expect(parseHotkey('Ctrl+Shift+M')).toEqual({
            ctrl: true,
            shift: true,
            alt: false,
            key: 'm',
        });
    });

    it('treats cmd and meta as ctrl', () => {
        expect(parseHotkey('cmd+k').ctrl).toBe(true);
        expect(parseHotkey('meta+k').ctrl).toBe(true);
    });

    it('rejects a spec with no key', () => {
        expect(() => parseHotkey('ctrl+shift')).toThrow(/no key/);
    });

    it('rejects a spec with two keys', () => {
        expect(() => parseHotkey('ctrl+m+k')).toThrow(/more than one key/);
    });
});

describe('matchesHotkey', () => {
    const hotkey = parseHotkey('ctrl+shift+m');

    it('matches with ctrl held', () => {
        expect(
            matchesHotkey(key({ ctrlKey: true, shiftKey: true }), hotkey)
        ).toBe(true);
    });

    it('matches with meta held instead of ctrl (macOS)', () => {
        expect(
            matchesHotkey(key({ metaKey: true, shiftKey: true }), hotkey)
        ).toBe(true);
    });

    it('matches the shifted uppercase key the browser reports', () => {
        expect(
            matchesHotkey(
                key({ key: 'M', ctrlKey: true, shiftKey: true }),
                hotkey
            )
        ).toBe(true);
    });

    it('rejects when a required modifier is missing', () => {
        expect(matchesHotkey(key({ ctrlKey: true }), hotkey)).toBe(false);
    });

    it('rejects when an extra modifier is held', () => {
        expect(
            matchesHotkey(
                key({ ctrlKey: true, shiftKey: true, altKey: true }),
                hotkey
            )
        ).toBe(false);
    });

    it('rejects a different key', () => {
        expect(
            matchesHotkey(
                key({ key: 'k', ctrlKey: true, shiftKey: true }),
                hotkey
            )
        ).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/hotkey`.

- [ ] **Step 3: Implement `packages/being-devtools/src/hotkey.ts`**

```typescript
/**
 * A parsed keyboard shortcut such as `ctrl+shift+m`.
 *
 * @remarks
 * `ctrl` is satisfied by either the Control key or the Command/Meta key,
 * so one spec works on every platform.
 *
 * @category Types
 */
export type ParsedHotkey = {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    /** Lower-cased key name, as reported by `KeyboardEvent.key`. */
    key: string;
};

/**
 * The subset of `KeyboardEvent` that {@link matchesHotkey} reads.
 *
 * @category Types
 */
export type HotkeyEventLike = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
};

/**
 * Parses a `+`-separated shortcut spec. Modifier words are `ctrl`, `cmd`,
 * `meta` (all meaning {@link ParsedHotkey.ctrl}), `shift`, `alt`, `option`.
 * Exactly one non-modifier word is required.
 *
 * @throws Error when the spec names no key or more than one key.
 * @category Helpers
 */
export function parseHotkey(spec: string): ParsedHotkey {
    const parts = spec
        .toLowerCase()
        .split('+')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    const parsed: ParsedHotkey = {
        ctrl: false,
        shift: false,
        alt: false,
        key: '',
    };
    for (const part of parts) {
        if (part === 'ctrl' || part === 'cmd' || part === 'meta') {
            parsed.ctrl = true;
        } else if (part === 'shift') {
            parsed.shift = true;
        } else if (part === 'alt' || part === 'option') {
            parsed.alt = true;
        } else if (parsed.key === '') {
            parsed.key = part;
        } else {
            throw new Error(`Hotkey "${spec}" names more than one key`);
        }
    }
    if (parsed.key === '') {
        throw new Error(`Hotkey "${spec}" has no key`);
    }
    return parsed;
}

/**
 * True when the event's key and modifier set equal the hotkey exactly.
 * Extra modifiers do not match; Control and Meta are interchangeable.
 *
 * @category Helpers
 */
export function matchesHotkey(
    event: HotkeyEventLike,
    hotkey: ParsedHotkey
): boolean {
    return (
        event.key.toLowerCase() === hotkey.key &&
        (event.ctrlKey || event.metaKey) === hotkey.ctrl &&
        event.shiftKey === hotkey.shift &&
        event.altKey === hotkey.alt
    );
}
```

- [ ] **Step 4: Export from `index.ts`**

Append to `packages/being-devtools/src/index.ts`:

```typescript
export { matchesHotkey, parseHotkey } from './hotkey';
export type { HotkeyEventLike, ParsedHotkey } from './hotkey';
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bunx nx test being-devtools
```

Expected: all hotkey tests PASS, layout tests still PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): parse and match panel toggle hotkeys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 3: `log.ts` — coalescing event log model

**Files:**

- Create: `packages/being-devtools/src/log.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/log.test.ts`

**Interfaces:**

- Consumes: `EventResult` from `@ue-too/being`.
- Produces:
    - `type LogEntry = { text: string; key?: string; count: number }`
    - `type LogChange = { kind: 'added'; entry: LogEntry; evicted: number } | { kind: 'updated'; entry: LogEntry }`
    - `class EventLog { constructor(maxEntries = 200); get entries(): readonly LogEntry[] /* newest first */; append(text: string, key?: string): LogChange; clear(): void }`
    - `formatLogEntry(entry: LogEntry): string` — `text` or `text ×N`
    - `type EventLine = { event: string; text: string; key: string; handled: boolean; before: string; after: string }`
    - `describeEventResult(event: string, payload: unknown, before: string, result: EventResult<string, unknown>): EventLine`
    - `MAX_LOG_ENTRIES = 200`

**Background:** this is the `appendLog` logic from `apps/examples/src/state-machine-visualizer/main.ts` lifted out of the DOM. Without coalescing, a live board machine's ~60 Hz `pointerMove` stream evicts the whole log in about three seconds of panning. The `!unhandled` / `!noop` sentinels cannot collide with a real state name, unlike the transition key which interpolates one.

- [ ] **Step 1: Write the failing test**

Create `packages/being-devtools/test/log.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
    EventLog,
    MAX_LOG_ENTRIES,
    describeEventResult,
    formatLogEntry,
} from '../src/log';

describe('EventLog', () => {
    it('adds a new entry at the front', () => {
        const log = new EventLog();
        log.append('first');
        const change = log.append('second');
        expect(change.kind).toBe('added');
        expect(log.entries.map(e => e.text)).toEqual(['second', 'first']);
    });

    it('coalesces a repeat of the previous key into a counter', () => {
        const log = new EventLog();
        log.append('move → handled', 'move|A|!noop');
        const change = log.append('move → handled', 'move|A|!noop');
        expect(change.kind).toBe('updated');
        expect(log.entries).toHaveLength(1);
        expect(log.entries[0].count).toBe(2);
        expect(formatLogEntry(log.entries[0])).toBe('move → handled ×2');
    });

    it('does not coalesce across a different key or an unkeyed line', () => {
        const log = new EventLog();
        log.append('a', 'k1');
        log.append('b', 'k2');
        log.append('a', 'k1');
        expect(log.entries).toHaveLength(3);

        const log2 = new EventLog();
        log2.append('a', 'k1');
        log2.append('plain');
        log2.append('a', 'k1');
        expect(log2.entries).toHaveLength(3);
    });

    it('evicts the oldest entries beyond the cap and reports how many', () => {
        const log = new EventLog(3);
        log.append('1');
        log.append('2');
        log.append('3');
        const change = log.append('4');
        expect(change.kind).toBe('added');
        if (change.kind === 'added') {
            expect(change.evicted).toBe(1);
        }
        expect(log.entries.map(e => e.text)).toEqual(['4', '3', '2']);
    });

    it('defaults to MAX_LOG_ENTRIES', () => {
        const log = new EventLog();
        for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) {
            log.append(String(i));
        }
        expect(log.entries).toHaveLength(MAX_LOG_ENTRIES);
    });

    it('clear empties the log', () => {
        const log = new EventLog();
        log.append('x');
        log.clear();
        expect(log.entries).toHaveLength(0);
    });
});

describe('describeEventResult', () => {
    it('reports an unhandled event with a sentinel key', () => {
        const line = describeEventResult('withdraw', { amount: 5 }, 'ACTIVE', {
            handled: false,
        });
        expect(line.handled).toBe(false);
        expect(line.text).toBe('withdraw {"amount":5} → not handled');
        expect(line.key).toBe('withdraw|ACTIVE|!unhandled');
        expect(line.after).toBe('ACTIVE');
    });

    it('reports a handled event with no transition', () => {
        const line = describeEventResult('tick', undefined, 'RUNNING', {
            handled: true,
        });
        expect(line.text).toBe('tick → handled, no transition');
        expect(line.key).toBe('tick|RUNNING|!noop');
        expect(line.after).toBe('RUNNING');
    });

    it('treats a nextState equal to the source as no transition', () => {
        const line = describeEventResult('tick', undefined, 'RUNNING', {
            handled: true,
            nextState: 'RUNNING',
        });
        expect(line.key).toBe('tick|RUNNING|!noop');
    });

    it('reports a transition with both states in the key', () => {
        const line = describeEventResult('stop', undefined, 'RUNNING', {
            handled: true,
            nextState: 'IDLE',
        });
        expect(line.handled).toBe(true);
        expect(line.text).toBe('stop → RUNNING ➜ IDLE');
        expect(line.key).toBe('stop|RUNNING|IDLE');
        expect(line.before).toBe('RUNNING');
        expect(line.after).toBe('IDLE');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/log`.

- [ ] **Step 3: Implement `packages/being-devtools/src/log.ts`**

```typescript
import { EventResult } from '@ue-too/being';

/** Default cap on retained log lines. @category Types */
export const MAX_LOG_ENTRIES = 200;

/**
 * One line of the event log. `count` > 1 means consecutive identical
 * `key`s were coalesced into this line.
 *
 * @category Types
 */
export type LogEntry = {
    text: string;
    key?: string;
    count: number;
};

/**
 * What {@link EventLog.append} did, so a view can update incrementally.
 *
 * @category Types
 */
export type LogChange =
    | { kind: 'added'; entry: LogEntry; evicted: number }
    | { kind: 'updated'; entry: LogEntry };

/**
 * A bounded, newest-first log that coalesces consecutive lines sharing a
 * key into one line with a `×N` counter.
 *
 * @remarks
 * Without coalescing, a live board machine's ~60 Hz `pointerMove` stream
 * evicts the whole log in about three seconds of panning.
 *
 * @category Core
 */
export class EventLog {
    private _entries: LogEntry[] = [];

    constructor(private readonly maxEntries: number = MAX_LOG_ENTRIES) {}

    /** Newest first. */
    get entries(): readonly LogEntry[] {
        return this._entries;
    }

    append(text: string, key?: string): LogChange {
        const newest = this._entries[0];
        if (key !== undefined && newest !== undefined && newest.key === key) {
            newest.count += 1;
            newest.text = text;
            return { kind: 'updated', entry: newest };
        }
        const entry: LogEntry = { text, key, count: 1 };
        this._entries.unshift(entry);
        let evicted = 0;
        while (this._entries.length > this.maxEntries) {
            this._entries.pop();
            evicted += 1;
        }
        return { kind: 'added', entry, evicted };
    }

    clear(): void {
        this._entries = [];
    }
}

/** Display text for a log entry, with the coalescing counter. @category Helpers */
export function formatLogEntry(entry: LogEntry): string {
    return entry.count > 1 ? `${entry.text} ×${entry.count}` : entry.text;
}

/**
 * A described `onEventResult` callback, ready to log and to match against
 * the chart's edges.
 *
 * @category Types
 */
export type EventLine = {
    event: string;
    text: string;
    key: string;
    handled: boolean;
    before: string;
    /** The state after the event; equals `before` when nothing moved. */
    after: string;
};

/**
 * Turns one `onEventResult` callback into a log line and a coalescing key.
 *
 * @remarks
 * `!unhandled` and `!noop` are sentinels that cannot collide with a real
 * state name (unlike the transition key, which interpolates one), so a
 * state literally named "unhandled" cannot coalesce into the wrong line.
 *
 * @category Helpers
 */
export function describeEventResult(
    event: string,
    payload: unknown,
    before: string,
    result: EventResult<string, unknown>
): EventLine {
    const payloadText =
        payload === undefined ? '' : ` ${JSON.stringify(payload)}`;
    if (!result.handled) {
        return {
            event,
            text: `${event}${payloadText} → not handled`,
            key: `${event}|${before}|!unhandled`,
            handled: false,
            before,
            after: before,
        };
    }
    const after =
        result.nextState === undefined ? before : String(result.nextState);
    if (after === before) {
        return {
            event,
            text: `${event}${payloadText} → handled, no transition`,
            key: `${event}|${before}|!noop`,
            handled: true,
            before,
            after,
        };
    }
    return {
        event,
        text: `${event}${payloadText} → ${before} ➜ ${after}`,
        key: `${event}|${before}|${after}`,
        handled: true,
        before,
        after,
    };
}
```

- [ ] **Step 4: Export from `index.ts`**

Append:

```typescript
export {
    EventLog,
    MAX_LOG_ENTRIES,
    describeEventResult,
    formatLogEntry,
} from './log';
export type { EventLine, LogChange, LogEntry } from './log';
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bunx nx test being-devtools
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): coalescing event log model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 4: `enabled.ts` and `context.ts`

**Files:**

- Create: `packages/being-devtools/src/enabled.ts`
- Create: `packages/being-devtools/src/context.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/enabled.test.ts`, `packages/being-devtools/test/context.test.ts`

**Interfaces:**

- Consumes: `LaidOutGraph`, `LaidOutEdge` from Task 1; `StateMachine` from `@ue-too/being`.
- Produces:
    - `computeEnabledEdges(machine: StateMachine<any, any, any, any>, layout: LaidOutGraph): boolean[]` — one flag per `layout.edges` entry
    - `serializeContext(context: unknown, maxChars = MAX_CONTEXT_CHARS): string`
    - `MAX_CONTEXT_CHARS = 2000`

**Background:** both functions are lifted from `apps/examples/src/state-machine-visualizer/main.ts` (`computeEnabledEdges`, `serializeContext`) with the module-level `machine`/`layout` globals turned into parameters. Behaviour is unchanged: an edge is enabled when it leaves the current state and every declared precondition passes against the live context; a missing guard fails closed (matching the machine's veto); a throwing guard stays enabled (display only, don't dim on a throw); routing guards are not evaluated.

- [ ] **Step 1: Write the failing tests**

Create `packages/being-devtools/test/enabled.test.ts`:

```typescript
import { StateMachine } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { computeEnabledEdges } from '../src/enabled';
import { LaidOutEdge, LaidOutGraph } from '../src/layout';

function edge(
    from: string,
    to: string,
    event: string,
    preconditions?: string[]
): LaidOutEdge {
    return {
        from,
        to,
        event,
        preconditions,
        points: [],
        selfLoop: from === to,
        labelX: 0,
        labelY: 0,
        label: event,
    };
}

function machine(
    currentState: string,
    context: unknown,
    guards: Record<string, (context: unknown) => boolean>
): StateMachine<any, any, any, any> {
    return {
        currentState,
        context,
        states: { [currentState]: { guards } },
    } as unknown as StateMachine<any, any, any, any>;
}

const layout: LaidOutGraph = {
    nodes: [],
    edges: [
        edge('A', 'B', 'plain'),
        edge('A', 'B', 'guarded', ['hasFunds']),
        edge('A', 'B', 'unknownGuard', ['missing']),
        edge('A', 'B', 'throwing', ['boom']),
        edge('B', 'A', 'elsewhere'),
    ],
};

describe('computeEnabledEdges', () => {
    it('enables edges leaving the current state whose preconditions pass', () => {
        const m = machine(
            'A',
            { balance: 10 },
            {
                hasFunds: c => (c as { balance: number }).balance > 0,
                boom: () => {
                    throw new Error('guard exploded');
                },
            }
        );
        expect(computeEnabledEdges(m, layout)).toEqual([
            true, // plain
            true, // guarded, passes
            false, // missing guard fails closed
            true, // throwing guard is left enabled
            false, // leaves another state
        ]);
    });

    it('dims an edge whose precondition fails', () => {
        const m = machine(
            'A',
            { balance: 0 },
            {
                hasFunds: c => (c as { balance: number }).balance > 0,
            }
        );
        expect(computeEnabledEdges(m, layout)[1]).toBe(false);
    });

    it('does not evaluate preconditions when there is no context', () => {
        const m = machine('A', undefined, {
            hasFunds: () => false,
        });
        expect(computeEnabledEdges(m, layout)[1]).toBe(true);
    });
});
```

Create `packages/being-devtools/test/context.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { MAX_CONTEXT_CHARS, serializeContext } from '../src/context';

describe('serializeContext', () => {
    it('returns an empty string for nothing', () => {
        expect(serializeContext(undefined)).toBe('');
        expect(serializeContext(null)).toBe('');
    });

    it('pretty-prints and strips functions', () => {
        const text = serializeContext({
            balance: 100,
            setup() {},
        });
        expect(text).toBe('{\n  "balance": 100\n}');
    });

    it('marks circular references instead of throwing', () => {
        const context: Record<string, unknown> = { name: 'loop' };
        context.self = context;
        expect(serializeContext(context)).toContain('"self": "[circular]"');
    });

    it('truncates at the cap with an ellipsis line', () => {
        const context = { big: 'x'.repeat(MAX_CONTEXT_CHARS * 2) };
        const text = serializeContext(context);
        expect(text.endsWith('\n…')).toBe(true);
        expect(text.length).toBe(MAX_CONTEXT_CHARS + 2);
    });

    it('honours a custom cap', () => {
        expect(serializeContext({ a: 'bbbbbbbb' }, 5)).toBe('{\n  "\n…');
    });

    it('reports unserializable values', () => {
        expect(serializeContext({ n: BigInt(1) })).toBe(
            '(context not serializable)'
        );
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/enabled` and `../src/context`.

- [ ] **Step 3: Implement `packages/being-devtools/src/enabled.ts`**

```typescript
import { StateMachine } from '@ue-too/being';

import { LaidOutGraph } from './layout';

/**
 * Which edges can fire right now: the edge must leave the current state,
 * and every declared precondition must pass against the live context.
 *
 * @remarks
 * Routing-guard edges are not evaluated — their truth depends on
 * post-action context, which cannot be known before firing. A precondition
 * whose guard is missing fails closed, matching the machine's own veto. A
 * guard that throws leaves the edge enabled: this is display only, and a
 * throwing guard should not silently dim a transition.
 *
 * @returns One flag per entry of `layout.edges`, in order.
 * @category Helpers
 */
export function computeEnabledEdges(
    machine: StateMachine<any, any, any, any>,
    layout: LaidOutGraph
): boolean[] {
    const current = String(machine.currentState);
    const context = machine.context;
    return layout.edges.map(edge => {
        if (edge.from !== current) {
            return false;
        }
        if (
            !edge.preconditions ||
            edge.preconditions.length === 0 ||
            context === undefined
        ) {
            return true;
        }
        const guards = (machine.states[edge.from]?.guards ?? {}) as Record<
            string,
            (context: unknown) => boolean
        >;
        return edge.preconditions.every(name => {
            const evaluate = guards[name];
            if (evaluate === undefined) {
                return false;
            }
            try {
                return evaluate(context);
            } catch {
                return true;
            }
        });
    });
}
```

- [ ] **Step 4: Implement `packages/being-devtools/src/context.ts`**

```typescript
/** Default cap on the serialized context text. @category Types */
export const MAX_CONTEXT_CHARS = 2000;

/**
 * Pretty-prints a machine's context for the inspector: functions are
 * dropped, circular references become `"[circular]"`, and text beyond
 * `maxChars` is cut and marked with an ellipsis line.
 *
 * @category Helpers
 */
export function serializeContext(
    context: unknown,
    maxChars: number = MAX_CONTEXT_CHARS
): string {
    if (context === undefined || context === null) {
        return '';
    }
    const seen = new WeakSet<object>();
    let text: string | undefined;
    try {
        text = JSON.stringify(
            context,
            (_key, value: unknown) => {
                if (typeof value === 'function') {
                    return undefined;
                }
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[circular]';
                    }
                    seen.add(value);
                }
                return value;
            },
            2
        );
    } catch {
        return '(context not serializable)';
    }
    if (text === undefined) {
        return '(context not serializable)';
    }
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}
```

- [ ] **Step 5: Export from `index.ts`**

Append:

```typescript
export { computeEnabledEdges } from './enabled';
export { MAX_CONTEXT_CHARS, serializeContext } from './context';
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
bunx nx test being-devtools
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): enabled-edge and context inspector helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 5: `registry.ts` — attached-machine registry and public attach types

**Files:**

- Create: `packages/being-devtools/src/registry.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/registry.test.ts`

**Interfaces:**

- Consumes: `StateMachine` from `@ue-too/being`.
- Produces:
    - `type AnyStateMachine = StateMachine<any, any, any, any>` — internal alias, **not exported from `index.ts`**
    - `type MachineLike` — the public parameter type every attach function accepts (see background)
    - `type AttachOptions = { name?: string; samplePayloads?: Record<string, unknown> }`
    - `type AttachHandle = { dispose(): void }`
    - `type AttachedMachine = { readonly name: string; readonly machine: AnyStateMachine; readonly samplePayloads: Record<string, unknown> }`
    - `type Subscriber = (entry: AttachedMachine) => (() => void) | undefined`
    - `class MachineRegistry { get size(): number; get names(): string[]; get(name): AttachedMachine | undefined; attach(machine: MachineLike, options: AttachOptions, subscribe: Subscriber): AttachedMachine; detach(name: string): boolean; detachAll(): void }`

**Background — why `MachineLike` exists:** the examples registry carries this comment: _"Concrete machines with literal-union States aren't structurally assignable to `StateMachine<any, any, any, any>`: State['states']'s conditional `string extends States ? string : States` plus method variance defeats `any`-erasure."_ If the public `attach` took `StateMachine<any, any, any, any>`, every caller would need `as unknown as StateMachine<any, any, any, any>` — the opposite of a one-liner. So the public parameter is a minimal structural type that any `TemplateStateMachine` satisfies without a cast, and the cast to `AnyStateMachine` happens exactly once, inside `MachineRegistry.attach`.

- [ ] **Step 1: Write the failing test**

Create `packages/being-devtools/test/registry.test.ts`:

```typescript
import { createVendingMachine } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { AttachedMachine, MachineLike, MachineRegistry } from '../src/registry';

function fakeMachine(): MachineLike {
    return {
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

describe('MachineRegistry', () => {
    it('assigns sequential default names in attach order', () => {
        const registry = new MachineRegistry();
        const a = registry.attach(fakeMachine(), {}, () => undefined);
        const b = registry.attach(fakeMachine(), {}, () => undefined);
        expect(a.name).toBe('machine-1');
        expect(b.name).toBe('machine-2');
        expect(registry.names).toEqual(['machine-1', 'machine-2']);
    });

    it('skips a default name that was taken explicitly', () => {
        const registry = new MachineRegistry();
        registry.attach(fakeMachine(), { name: 'machine-1' }, () => undefined);
        const next = registry.attach(fakeMachine(), {}, () => undefined);
        expect(next.name).toBe('machine-2');
    });

    it('throws on a duplicate explicit name before subscribing', () => {
        const registry = new MachineRegistry();
        registry.attach(fakeMachine(), { name: 'pan' }, () => undefined);
        let subscribed = false;
        expect(() =>
            registry.attach(fakeMachine(), { name: 'pan' }, () => {
                subscribed = true;
                return undefined;
            })
        ).toThrow(/"pan" is already attached/);
        expect(subscribed).toBe(false);
        expect(registry.size).toBe(1);
    });

    it('passes the entry to the subscriber and stores sample payloads', () => {
        const registry = new MachineRegistry();
        let seen: AttachedMachine | null = null;
        const entry = registry.attach(
            fakeMachine(),
            { name: 'x', samplePayloads: { go: { speed: 1 } } },
            e => {
                seen = e;
                return undefined;
            }
        );
        expect(seen).toBe(entry);
        expect(entry.samplePayloads).toEqual({ go: { speed: 1 } });
        expect(registry.get('x')).toBe(entry);
    });

    it('does not register an entry whose subscriber throws', () => {
        const registry = new MachineRegistry();
        expect(() =>
            registry.attach(fakeMachine(), { name: 'x' }, () => {
                throw new Error('layout failed');
            })
        ).toThrow('layout failed');
        expect(registry.size).toBe(0);
    });

    it('detach runs the disposer exactly once', () => {
        const registry = new MachineRegistry();
        let disposals = 0;
        registry.attach(fakeMachine(), { name: 'x' }, () => () => {
            disposals += 1;
        });
        expect(registry.detach('x')).toBe(true);
        expect(registry.detach('x')).toBe(false);
        expect(disposals).toBe(1);
        expect(registry.size).toBe(0);
    });

    it('detachAll disposes everything', () => {
        const registry = new MachineRegistry();
        let disposals = 0;
        const disposer = () => {
            disposals += 1;
        };
        registry.attach(fakeMachine(), {}, () => disposer);
        registry.attach(fakeMachine(), {}, () => disposer);
        registry.detachAll();
        expect(disposals).toBe(2);
        expect(registry.size).toBe(0);
    });

    it('accepts a concrete TemplateStateMachine without a cast', () => {
        // Compile-time check: createVendingMachine() has literal-union
        // States and must satisfy MachineLike directly.
        const registry = new MachineRegistry();
        const entry = registry.attach(
            createVendingMachine(),
            { name: 'vending' },
            () => undefined
        );
        expect(entry.machine.currentState).toBeDefined();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/registry`.

- [ ] **Step 3: Implement `packages/being-devtools/src/registry.ts`**

```typescript
import { StateMachine } from '@ue-too/being';

/**
 * Internal: a fully erased machine. Never appears in a public signature.
 */
export type AnyStateMachine = StateMachine<any, any, any, any>;

/**
 * The structural surface a machine must have to be attached.
 *
 * @remarks
 * Concrete `TemplateStateMachine`s with literal-union States are not
 * assignable to `StateMachine<any, any, any, any>` (the conditional in
 * `State['states']` plus method variance defeats `any`-erasure), so the
 * public parameter type is this minimal shape, which they satisfy without
 * a cast. The erasure happens once, inside {@link MachineRegistry.attach}.
 *
 * @category Types
 */
export type MachineLike = {
    happens(...args: any[]): unknown;
    currentState: unknown;
    states: object;
    possibleStates: readonly unknown[];
    context?: unknown;
    reset(): void;
    onEventResult?(callback: (...args: any[]) => void): void | (() => void);
};

/**
 * Options for attaching one machine.
 *
 * @category Types
 */
export type AttachOptions = {
    /** Tab label. Must be unique within a panel; a collision throws. */
    name?: string;
    /** Default payload JSON shown under each event's fire button. */
    samplePayloads?: Record<string, unknown>;
};

/**
 * Returned by every attach call. `dispose()` detaches the machine(s) and
 * releases their subscriptions. Safe to call more than once.
 *
 * @category Types
 */
export type AttachHandle = { dispose(): void };

/**
 * An attached machine as the panel sees it.
 *
 * @category Types
 */
export type AttachedMachine = {
    readonly name: string;
    readonly machine: AnyStateMachine;
    readonly samplePayloads: Record<string, unknown>;
};

/**
 * Called once per successful attach. Returns the disposer for whatever it
 * subscribed, or `undefined` if it subscribed nothing.
 */
export type Subscriber = (entry: AttachedMachine) => (() => void) | undefined;

/**
 * Name → machine bookkeeping for one panel. Owns nothing but the
 * subscription disposers; the panel owns the DOM.
 *
 * @category Core
 */
export class MachineRegistry {
    private readonly records = new Map<
        string,
        { entry: AttachedMachine; unsubscribe: (() => void) | undefined }
    >();
    private unnamedCount = 0;

    get size(): number {
        return this.records.size;
    }

    /** Names in attach order. */
    get names(): string[] {
        return [...this.records.keys()];
    }

    get(name: string): AttachedMachine | undefined {
        return this.records.get(name)?.entry;
    }

    /**
     * Registers a machine. The name is resolved and checked first, then
     * `subscribe` runs, then the record is stored — so a duplicate name
     * never subscribes and a throwing subscriber never registers.
     *
     * @throws Error when `options.name` is already attached.
     */
    attach(
        machine: MachineLike,
        options: AttachOptions,
        subscribe: Subscriber
    ): AttachedMachine {
        const name = this.resolveName(options.name);
        const entry: AttachedMachine = {
            name,
            machine: machine as unknown as AnyStateMachine,
            samplePayloads: options.samplePayloads ?? {},
        };
        const unsubscribe = subscribe(entry);
        this.records.set(name, { entry, unsubscribe });
        return entry;
    }

    /** @returns false when nothing by that name was attached. */
    detach(name: string): boolean {
        const record = this.records.get(name);
        if (record === undefined) {
            return false;
        }
        this.records.delete(name);
        record.unsubscribe?.();
        return true;
    }

    detachAll(): void {
        for (const name of this.names) {
            this.detach(name);
        }
    }

    private resolveName(requested: string | undefined): string {
        if (requested !== undefined) {
            if (this.records.has(requested)) {
                throw new Error(
                    `A machine named "${requested}" is already attached to this debugger.`
                );
            }
            return requested;
        }
        let name: string;
        do {
            this.unnamedCount += 1;
            name = `machine-${this.unnamedCount}`;
        } while (this.records.has(name));
        return name;
    }
}
```

- [ ] **Step 4: Export from `index.ts`**

Append (note: `AnyStateMachine` and `Subscriber` are deliberately not exported):

```typescript
export { MachineRegistry } from './registry';
export type {
    AttachHandle,
    AttachOptions,
    AttachedMachine,
    MachineLike,
} from './registry';
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bunx nx test being-devtools
```

Expected: PASS. `bun test` does not type-check, so the cast-free claim is verified in the next step.

- [ ] **Step 6: Type-check the package and the cast-free test**

```bash
bunx nx build being-devtools
bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2020 --lib es2020,dom packages/being-devtools/test/registry.test.ts
```

Expected: both clean. If the second command rejects `createVendingMachine()` as not assignable to `MachineLike`, loosen the offending member of `MachineLike` in `registry.ts` (for example `possibleStates: unknown`) rather than adding a cast in the test — the whole point of the type is cast-free attachment.

- [ ] **Step 7: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): machine registry with cast-free attach types

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 6: `board.ts` — resolve a board's five machines

**Files:**

- Create: `packages/being-devtools/src/board.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/board.test.ts`

**Interfaces:**

- Consumes: `AnyStateMachine` from Task 5.
- Produces:
    - `type BoardLike = { kmtInputStateMachine?: unknown; touchInputStateMachine?: unknown; cameraMux: unknown }` — a real `Board` satisfies it
    - `type BoardMachineEntry = { name: string; machine: AnyStateMachine; samplePayloads: Record<string, unknown> }`
    - `resolveBoardMachines(board: BoardLike, namePrefix = 'board'): BoardMachineEntry[]` — in the order kmt-input, touch-input, pan-control, zoom-control, rotation-control, skipping whatever the board lacks
    - `KMT_SAMPLE_PAYLOADS`, `TOUCH_SAMPLE_PAYLOADS` constants

**Background:** the camera mux is narrowed structurally, not with `instanceof CameraMuxWithAnimationAndLock`. `@ue-too/board`'s own `hasBeingStateMachineShape` in `boardify/index.ts` takes the same approach because a consumer that resolves two copies of a package fails `instanceof` against a perfectly valid object.

- [ ] **Step 1: Write the failing test**

Create `packages/being-devtools/test/board.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
    KMT_SAMPLE_PAYLOADS,
    TOUCH_SAMPLE_PAYLOADS,
    resolveBoardMachines,
} from '../src/board';

function fakeMachine(tag: string) {
    return {
        tag,
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

function fullBoard() {
    return {
        kmtInputStateMachine: fakeMachine('kmt'),
        touchInputStateMachine: fakeMachine('touch'),
        cameraMux: {
            panStateMachine: fakeMachine('pan'),
            zoomStateMachine: fakeMachine('zoom'),
            rotateStateMachine: fakeMachine('rotate'),
        },
    };
}

describe('resolveBoardMachines', () => {
    it('finds all five machines with prefixed names and payloads', () => {
        const entries = resolveBoardMachines(fullBoard());
        expect(entries.map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:touch-input',
            'board:pan-control',
            'board:zoom-control',
            'board:rotation-control',
        ]);
        expect(entries[0].samplePayloads).toBe(KMT_SAMPLE_PAYLOADS);
        expect(entries[1].samplePayloads).toBe(TOUCH_SAMPLE_PAYLOADS);
        expect(entries[2].samplePayloads).toEqual({});
        expect((entries[4].machine as unknown as { tag: string }).tag).toBe(
            'rotate'
        );
    });

    it('honours a custom prefix', () => {
        const entries = resolveBoardMachines(fullBoard(), 'minimap');
        expect(entries[0].name).toBe('minimap:kmt-input');
    });

    it('skips a parser that exposes no machine', () => {
        const board = fullBoard();
        board.touchInputStateMachine = undefined as never;
        expect(resolveBoardMachines(board).map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:pan-control',
            'board:zoom-control',
            'board:rotation-control',
        ]);
    });

    it('skips a mux without the machine getters', () => {
        const board = { ...fullBoard(), cameraMux: { notAMachine: true } };
        expect(resolveBoardMachines(board).map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:touch-input',
        ]);
    });

    it('rejects a value that only looks like a machine', () => {
        const board = {
            kmtInputStateMachine: { happens: () => undefined },
            cameraMux: {},
        };
        expect(resolveBoardMachines(board)).toEqual([]);
    });

    it('returns an empty list for a board with nothing', () => {
        expect(resolveBoardMachines({ cameraMux: undefined })).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/board`.

- [ ] **Step 3: Implement `packages/being-devtools/src/board.ts`**

```typescript
import { AnyStateMachine } from './registry';

/**
 * The slice of a `Board` this helper reads. Typed loosely so tests can
 * stub it and so a `Board` from a second copy of `@ue-too/board` still
 * fits; every value is checked structurally before use.
 *
 * @category Types
 */
export type BoardLike = {
    kmtInputStateMachine?: unknown;
    touchInputStateMachine?: unknown;
    cameraMux: unknown;
};

/**
 * One machine found on a board, ready to attach.
 *
 * @category Types
 */
export type BoardMachineEntry = {
    name: string;
    machine: AnyStateMachine;
    samplePayloads: Record<string, unknown>;
};

/** Default fire-button payloads for the keyboard/mouse input machine. @category Types */
export const KMT_SAMPLE_PAYLOADS: Record<string, unknown> = {
    leftPointerDown: { x: 100, y: 100 },
    leftPointerUp: { x: 100, y: 100 },
    leftPointerMove: { x: 120, y: 110 },
    middlePointerDown: { x: 100, y: 100 },
    middlePointerUp: { x: 100, y: 100 },
    middlePointerMove: { x: 120, y: 110 },
    pointerMove: { x: 120, y: 110 },
    scroll: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
    scrollWithCtrl: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
};

/** Default fire-button payloads for the touch input machine. @category Types */
export const TOUCH_SAMPLE_PAYLOADS: Record<string, unknown> = {
    touchstart: {
        points: [
            { ident: 0, x: 100, y: 200 },
            { ident: 1, x: 300, y: 200 },
        ],
    },
    touchmove: {
        points: [
            { ident: 0, x: 110, y: 210 },
            { ident: 1, x: 310, y: 210 },
        ],
    },
    touchend: {
        points: [
            { ident: 0, x: 110, y: 210 },
            { ident: 1, x: 310, y: 210 },
        ],
    },
};

/**
 * Structural check for a `being` machine, mirroring `@ue-too/board`'s own
 * `hasBeingStateMachineShape`: no `instanceof`, so a machine from a second
 * copy of `@ue-too/being` still passes.
 */
function isStateMachine(value: unknown): value is AnyStateMachine {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.happens === 'function' &&
        'currentState' in candidate &&
        'states' in candidate &&
        'possibleStates' in candidate
    );
}

/**
 * Finds the `being` machines a `Board` exposes: the keyboard/mouse and
 * touch input machines, and the pan, zoom, and rotation control machines
 * on its camera mux. Anything the board lacks (a custom parser or mux) is
 * skipped rather than failing the whole call.
 *
 * @param namePrefix Names are `${namePrefix}:${suffix}`; two boards on
 * one page pass different prefixes.
 * @category Helpers
 */
export function resolveBoardMachines(
    board: BoardLike,
    namePrefix: string = 'board'
): BoardMachineEntry[] {
    const entries: BoardMachineEntry[] = [];
    const push = (
        suffix: string,
        machine: unknown,
        samplePayloads: Record<string, unknown> = {}
    ): void => {
        if (isStateMachine(machine)) {
            entries.push({
                name: `${namePrefix}:${suffix}`,
                machine,
                samplePayloads,
            });
        }
    };
    push('kmt-input', board.kmtInputStateMachine, KMT_SAMPLE_PAYLOADS);
    push('touch-input', board.touchInputStateMachine, TOUCH_SAMPLE_PAYLOADS);
    const mux = board.cameraMux;
    if (typeof mux === 'object' && mux !== null) {
        const getters = mux as Record<string, unknown>;
        push('pan-control', getters.panStateMachine);
        push('zoom-control', getters.zoomStateMachine);
        push('rotation-control', getters.rotateStateMachine);
    }
    return entries;
}
```

- [ ] **Step 4: Export from `index.ts`**

Append:

```typescript
export {
    KMT_SAMPLE_PAYLOADS,
    TOUCH_SAMPLE_PAYLOADS,
    resolveBoardMachines,
} from './board';
export type { BoardLike, BoardMachineEntry } from './board';
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bunx nx test being-devtools
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): resolve a board's input and camera machines

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 7: `panel-dom.ts` — the Shadow DOM panel skeleton

**Files:**

- Create: `packages/being-devtools/src/panel-dom.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
    - `type PanelDom = { host: HTMLElement; canvas: HTMLCanvasElement; tabStrip: HTMLElement; currentState: HTMLElement; contextView: HTMLElement; panelError: HTMLElement; eventRows: HTMLElement; resetButton: HTMLButtonElement; log: HTMLUListElement; pill: HTMLButtonElement; closeButton: HTMLButtonElement; setOpen(open: boolean): void; setCount(count: number): void; destroy(): void }`
    - `createPanelDom(options: { container?: HTMLElement }): PanelDom`

**Background:** this file is DOM-only and has no unit test; Task 8 verifies it through the examples page. Two mount modes share one shadow tree: with no `container` the host is appended to `document.body` as a fixed bottom-right overlay; with a `container` the host fills it. Visibility is switched by a class on the wrapper, not the `hidden` attribute, because an author `display:flex` rule would beat the UA's `[hidden]` rule inside the shadow tree.

The board's canvas proxy sizes itself from `getBoundingClientRect()` and re-measures on window resize, so the canvas only needs CSS size, exactly like the existing page's `#graph`.

- [ ] **Step 1: Implement `packages/being-devtools/src/panel-dom.ts`**

```typescript
/**
 * References into the panel's shadow tree, handed to the debugger.
 */
export type PanelDom = {
    host: HTMLElement;
    canvas: HTMLCanvasElement;
    tabStrip: HTMLElement;
    currentState: HTMLElement;
    contextView: HTMLElement;
    panelError: HTMLElement;
    eventRows: HTMLElement;
    resetButton: HTMLButtonElement;
    log: HTMLUListElement;
    pill: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    setOpen(open: boolean): void;
    setCount(count: number): void;
    destroy(): void;
};

const STYLES = `
    :host {
        all: initial;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #0f172a;
    }
    :host(.overlay) {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483000;
    }
    :host(.inline) {
        display: block;
        width: 100%;
        height: 100%;
    }
    .wrap {
        display: contents;
    }
    .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
        font: inherit;
        cursor: pointer;
    }
    .wrap.open .pill {
        display: none;
    }
    .panel {
        display: flex;
        width: 60vw;
        height: 55vh;
        min-width: 640px;
        min-height: 400px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18);
        overflow: hidden;
        box-sizing: border-box;
    }
    :host(.inline) .panel {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        border-radius: 0;
        box-shadow: none;
    }
    .wrap:not(.open) .panel {
        display: none;
    }
    canvas {
        flex: 1;
        min-width: 0;
        display: block;
    }
    .sidebar {
        width: 320px;
        flex-shrink: 0;
        border-left: 1px solid #e2e8f0;
        padding: 12px;
        overflow-y: auto;
        box-sizing: border-box;
        font-size: 14px;
    }
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .header h1 {
        font-size: 16px;
        margin: 0;
    }
    .close {
        border: none;
        background: transparent;
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        color: #64748b;
    }
    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 8px;
    }
    .tab {
        font: inherit;
        font-size: 12px;
        padding: 3px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        cursor: pointer;
    }
    .tab.active {
        background: #dbeafe;
        border-color: #2563eb;
    }
    .hint {
        color: #64748b;
        font-size: 12px;
        margin-bottom: 12px;
    }
    .current-state {
        font-weight: 600;
        margin-bottom: 12px;
    }
    details {
        margin-bottom: 12px;
    }
    summary {
        font-weight: 600;
        cursor: pointer;
    }
    .context-view {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px;
        margin: 4px 0 0;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        max-height: 180px;
        overflow: auto;
        white-space: pre-wrap;
    }
    .panel-error {
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
        font: inherit;
    }
    .event-row textarea {
        width: 100%;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
    }
    .payload-error {
        color: #dc2626;
        font-size: 12px;
        white-space: pre-wrap;
    }
    .reset {
        width: 100%;
        margin: 8px 0 12px;
        font: inherit;
        cursor: pointer;
    }
    .log {
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .log li {
        padding: 2px 0;
        border-bottom: 1px solid #f1f5f9;
        word-break: break-word;
    }
`;

const MARKUP = `
    <style>${STYLES}</style>
    <div class="wrap">
        <button class="pill" type="button" title="Open being devtools">
            ⚙ being <span class="count">0</span>
        </button>
        <div class="panel">
            <canvas></canvas>
            <div class="sidebar">
                <div class="header">
                    <h1>State machines</h1>
                    <button class="close" type="button" title="Close">×</button>
                </div>
                <div class="tabs"></div>
                <div class="hint">
                    Events fired here and real input on the page both drive the
                    chart. Click the chart to hand keyboard focus back to it.
                </div>
                <div class="current-state"></div>
                <details open>
                    <summary>Context</summary>
                    <pre class="context-view"></pre>
                </details>
                <div class="panel-error"></div>
                <div class="event-rows"></div>
                <button class="reset" type="button">Reset machine</button>
                <ul class="log"></ul>
            </div>
        </div>
    </div>
`;

/**
 * Builds the panel's shadow tree. With no `container` the host is a fixed
 * bottom-right overlay appended to `document.body`; with one, the host
 * fills the container.
 */
export function createPanelDom(options: { container?: HTMLElement }): PanelDom {
    const host = document.createElement('div');
    host.className = options.container === undefined ? 'overlay' : 'inline';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = MARKUP;
    (options.container ?? document.body).appendChild(host);

    const query = <T extends Element>(selector: string): T => {
        const element = root.querySelector<T>(selector);
        if (element === null) {
            throw new Error(
                `being-devtools panel markup is missing ${selector}`
            );
        }
        return element;
    };

    const wrap = query<HTMLDivElement>('.wrap');
    const count = query<HTMLSpanElement>('.count');

    return {
        host,
        canvas: query<HTMLCanvasElement>('canvas'),
        tabStrip: query<HTMLDivElement>('.tabs'),
        currentState: query<HTMLDivElement>('.current-state'),
        contextView: query<HTMLPreElement>('.context-view'),
        panelError: query<HTMLDivElement>('.panel-error'),
        eventRows: query<HTMLDivElement>('.event-rows'),
        resetButton: query<HTMLButtonElement>('.reset'),
        log: query<HTMLUListElement>('.log'),
        pill: query<HTMLButtonElement>('.pill'),
        closeButton: query<HTMLButtonElement>('.close'),
        setOpen(open) {
            wrap.classList.toggle('open', open);
        },
        setCount(value) {
            count.textContent = String(value);
        },
        destroy() {
            host.remove();
        },
    };
}
```

- [ ] **Step 2: Type-check via the build**

```bash
bunx nx build being-devtools
```

Expected: no tsc errors (the `DOM` lib was added in Task 1). `panel-dom.ts` is intentionally not exported from `index.ts`; Task 8's `debugger.ts` is its only consumer.

- [ ] **Step 3: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): shadow DOM panel skeleton

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 8: `debugger.ts` and the examples page rebuilt on it

**Files:**

- Create: `packages/being-devtools/src/debugger.ts`
- Modify: `packages/being-devtools/src/index.ts`
- Modify: `apps/examples/src/state-machine-visualizer/index.html` (rewrite)
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (rewrite)
- Delete: `apps/examples/src/state-machine-visualizer/registry.ts`, `layout.ts`, `render.ts`
- Modify: `apps/examples/package.json` — add `@ue-too/being-devtools`, remove `@dagrejs/dagre`
- Modify: `apps/examples/project.json` — add `being-devtools` to `implicitDependencies`

**Interfaces:**

- Consumes: everything from Tasks 1–7: `layoutGraph`, `drawGraph`, `Flash`, `parseHotkey`, `matchesHotkey`, `EventLog`, `describeEventResult`, `formatLogEntry`, `computeEnabledEdges`, `serializeContext`, `MachineRegistry`, `MachineLike`, `AttachOptions`, `AttachHandle`, `AttachedMachine`, `AnyStateMachine`, `resolveBoardMachines`, `BoardLike`, `createPanelDom`, `PanelDom`. From packages: `extractMachineGraph` (`@ue-too/being`), `Board` (`@ue-too/board`).
- Produces:
    - `type MachineDebuggerOptions = { container?: HTMLElement; hotkey?: string | false; openByDefault?: boolean }`
    - `DEFAULT_HOTKEY = 'ctrl+shift+m'`
    - `class MachineDebugger { constructor(options?); attach(machine: MachineLike, options?: AttachOptions): AttachHandle; attachBoard(board: BoardLike, options?: { namePrefix?: string }): AttachHandle; open(); close(); toggle(); get isOpen(): boolean; get board(): Board; get size(): number; get machines(): ReadonlyMap<string, AnyStateMachine>; dispose() }`
    - Task 9 relies on `size`, `machines`, `open`, `close`, `attach`, `attachBoard`, `dispose`, and on the constructor calling `registerPanel(this)` / `dispose()` calling `unregisterPanel(this)` — those two calls are added in Task 9, not here.

**Background:** this is `apps/examples/src/state-machine-visualizer/main.ts` turned into a class that owns its DOM. Behavioural rules carried over verbatim: the `onEventResult` callback runs after the state handled the event but before the transition, so `machine.currentState` inside it is still the source state; every attached machine is borrowed so `wrapup()` is never called; `reset()` stays as the recovery for a live machine stranded by a hand-fired half-gesture.

- [ ] **Step 1: Implement `packages/being-devtools/src/debugger.ts`**

````typescript
import { extractMachineGraph } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { BoardLike, resolveBoardMachines } from './board';
import { serializeContext } from './context';
import { computeEnabledEdges } from './enabled';
import { ParsedHotkey, matchesHotkey, parseHotkey } from './hotkey';
import { LaidOutGraph, layoutGraph } from './layout';
import { EventLog, describeEventResult, formatLogEntry } from './log';
import { PanelDom, createPanelDom } from './panel-dom';
import {
    AnyStateMachine,
    AttachHandle,
    AttachOptions,
    AttachedMachine,
    MachineLike,
    MachineRegistry,
} from './registry';
import { Flash, drawGraph } from './render';

/**
 * Options for a {@link MachineDebugger} panel.
 *
 * @category Types
 */
export type MachineDebuggerOptions = {
    /** Render inline into this element instead of as a floating overlay. */
    container?: HTMLElement;
    /** Toggle shortcut (default {@link DEFAULT_HOTKEY}). `false` disables it. */
    hotkey?: string | false;
    /** Start expanded. Defaults to `false` for the overlay, `true` with a container. */
    openByDefault?: boolean;
};

/** @category Types */
export const DEFAULT_HOTKEY = 'ctrl+shift+m';

type Tab = {
    entry: AttachedMachine;
    layout: LaidOutGraph | null;
    layoutError: string | null;
    log: EventLog;
    flash: Flash;
    button: HTMLButtonElement;
};

function findTakenEdgeIndex(
    layout: LaidOutGraph,
    from: string,
    event: string,
    to: string
): number {
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

/**
 * A debugger panel: a pannable state chart plus a sidebar with one tab per
 * attached machine, the current state, a context inspector, fire buttons,
 * reset, and a coalescing event log.
 *
 * @remarks
 * Every attached machine is borrowed. The panel never calls `wrapup()` —
 * that parks a live machine in `TERMINAL` and, for a board machine, stops
 * the real board responding to input. `reset()` is offered because it
 * round-trips through `TERMINAL` and restarts; it is the recovery for a
 * machine stranded by a hand-fired half-gesture.
 *
 * @example
 * ```ts
 * const panel = new MachineDebugger();
 * const handle = panel.attach(machine, { name: 'pan-control' });
 * // later
 * handle.dispose();
 * panel.dispose();
 * ```
 *
 * @category Core
 */
export class MachineDebugger {
    private readonly dom: PanelDom;
    private readonly graphBoard: Board;
    private readonly registry = new MachineRegistry();
    private readonly tabs = new Map<string, Tab>();
    private readonly measureCtx: CanvasRenderingContext2D;
    private readonly hotkey: ParsedHotkey | null;
    private selected: Tab | null = null;
    private rafId: number | null = null;
    private opened = false;
    private disposed = false;
    private lastContextText: string | null = null;

    constructor(options: MachineDebuggerOptions = {}) {
        this.dom = createPanelDom({ container: options.container });
        this.graphBoard = new Board();
        this.graphBoard.attach(this.dom.canvas);
        this.measureCtx = document.createElement('canvas').getContext('2d')!;
        this.hotkey =
            options.hotkey === false
                ? null
                : parseHotkey(options.hotkey ?? DEFAULT_HOTKEY);
        this.dom.pill.addEventListener('click', () => this.open());
        this.dom.closeButton.addEventListener('click', () => this.close());
        this.dom.resetButton.addEventListener('click', () =>
            this.resetSelected()
        );
        window.addEventListener('keydown', this.onKeyDown);
        this.dom.setCount(0);
        this.select(null);
        const openByDefault =
            options.openByDefault ?? options.container !== undefined;
        if (openByDefault) {
            this.open();
        } else {
            this.dom.setOpen(false);
        }
    }

    /** The panel's own graph viewport, so a page can diagram the board it pans. */
    get board(): Board {
        return this.graphBoard;
    }

    get isOpen(): boolean {
        return this.opened;
    }

    /** Number of attached machines. */
    get size(): number {
        return this.registry.size;
    }

    /** Name → machine for every attached machine. */
    get machines(): ReadonlyMap<string, AnyStateMachine> {
        const map = new Map<string, AnyStateMachine>();
        for (const name of this.registry.names) {
            map.set(name, this.registry.get(name)!.machine);
        }
        return map;
    }

    /**
     * Attaches a machine as a new tab.
     *
     * @throws Error when `options.name` is already attached to this panel.
     */
    attach(machine: MachineLike, options: AttachOptions = {}): AttachHandle {
        this.assertNotDisposed();
        const entry = this.registry.attach(machine, options, e =>
            this.subscribe(this.createTab(e))
        );
        this.dom.setCount(this.registry.size);
        if (this.selected === null) {
            this.select(entry.name);
        }
        return { dispose: () => this.detach(entry.name) };
    }

    /**
     * Attaches every `being` machine the board exposes (see
     * {@link resolveBoardMachines}). Attaches what it finds; throws only
     * when it finds nothing.
     */
    attachBoard(
        board: BoardLike,
        options: { namePrefix?: string } = {}
    ): AttachHandle {
        this.assertNotDisposed();
        const found = resolveBoardMachines(board, options.namePrefix);
        if (found.length === 0) {
            throw new Error(
                'No being state machines found on this board: its parsers and camera mux expose none.'
            );
        }
        const handles: AttachHandle[] = [];
        try {
            for (const item of found) {
                handles.push(
                    this.attach(item.machine, {
                        name: item.name,
                        samplePayloads: item.samplePayloads,
                    })
                );
            }
        } catch (error) {
            for (const handle of handles) {
                handle.dispose();
            }
            throw error;
        }
        return {
            dispose: () => {
                for (const handle of handles) {
                    handle.dispose();
                }
            },
        };
    }

    open(): void {
        if (this.disposed || this.opened) {
            return;
        }
        this.opened = true;
        this.dom.setOpen(true);
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(this.step);
        }
    }

    close(): void {
        if (!this.opened) {
            return;
        }
        this.opened = false;
        this.dom.setOpen(false);
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    toggle(): void {
        if (this.opened) {
            this.close();
        } else {
            this.open();
        }
    }

    /** Detaches every machine, stops the render loop, and removes the panel. */
    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.close();
        this.disposed = true;
        window.removeEventListener('keydown', this.onKeyDown);
        this.registry.detachAll();
        this.tabs.clear();
        this.selected = null;
        this.graphBoard.tearDown();
        this.dom.destroy();
    }

    private assertNotDisposed(): void {
        if (this.disposed) {
            throw new Error('This MachineDebugger has been disposed.');
        }
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (this.hotkey !== null && matchesHotkey(event, this.hotkey)) {
            event.preventDefault();
            this.toggle();
        }
    };

    private readonly step = (now: number): void => {
        if (!this.opened) {
            this.rafId = null;
            return;
        }
        this.graphBoard.step(now);
        const ctx = this.graphBoard.context;
        const tab = this.selected;
        if (ctx !== undefined && tab !== null && tab.layout !== null) {
            drawGraph(
                ctx,
                tab.layout,
                String(tab.entry.machine.currentState),
                tab.flash,
                now,
                computeEnabledEdges(tab.entry.machine, tab.layout)
            );
        }
        this.dom.currentState.textContent =
            tab === null
                ? 'No machine attached'
                : `Current state: ${String(tab.entry.machine.currentState)}`;
        const contextText =
            tab === null ? '' : serializeContext(tab.entry.machine.context);
        if (contextText !== this.lastContextText) {
            this.dom.contextView.textContent = contextText;
            this.lastContextText = contextText;
        }
        this.rafId = requestAnimationFrame(this.step);
    };

    private readonly measureText = (text: string): number => {
        this.measureCtx.font = '13px system-ui, sans-serif';
        return this.measureCtx.measureText(text).width;
    };

    private createTab(entry: AttachedMachine): Tab {
        let layout: LaidOutGraph | null = null;
        let layoutError: string | null = null;
        try {
            layout = layoutGraph(
                extractMachineGraph(entry.machine),
                this.measureText
            );
        } catch (error) {
            layoutError =
                error instanceof Error ? error.message : String(error);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tab';
        button.textContent = entry.name;
        button.addEventListener('click', () => this.select(entry.name));
        this.dom.tabStrip.appendChild(button);
        const tab: Tab = {
            entry,
            layout,
            layoutError,
            log: new EventLog(),
            flash: null,
            button,
        };
        this.tabs.set(entry.name, tab);
        tab.log.append(`attached ${entry.name}`);
        if (layoutError !== null) {
            tab.log.append(`(chart unavailable: ${layoutError})`);
        } else if (typeof entry.machine.onEventResult !== 'function') {
            tab.log.append(
                '(this machine does not expose onEventResult — no event log)'
            );
        }
        return tab;
    }

    /**
     * Logs and flashes every event the machine handles, whoever fired it.
     * Runs after the state has handled the event but before the
     * transition, so `currentState` is still the source state.
     */
    private subscribe(tab: Tab): (() => void) | undefined {
        const { machine } = tab.entry;
        const layout = tab.layout;
        if (layout === null || typeof machine.onEventResult !== 'function') {
            return undefined;
        }
        const dispose = machine.onEventResult((args, result) => {
            const before = String(machine.currentState);
            const line = describeEventResult(
                String(args[0]),
                args[1],
                before,
                result
            );
            this.appendLog(tab, line.text, line.key);
            if (line.handled) {
                const edgeIndex = findTakenEdgeIndex(
                    layout,
                    before,
                    line.event,
                    line.after
                );
                if (edgeIndex !== -1) {
                    tab.flash = { edgeIndex, at: performance.now() };
                }
            }
        });
        return typeof dispose === 'function' ? dispose : undefined;
    }

    private detach(name: string): void {
        const tab = this.tabs.get(name);
        if (tab === undefined) {
            return;
        }
        this.registry.detach(name);
        tab.button.remove();
        this.tabs.delete(name);
        this.dom.setCount(this.registry.size);
        if (this.selected === tab) {
            const next = this.tabs.keys().next();
            this.select(next.done ? null : next.value);
        }
    }

    private select(name: string | null): void {
        const tab = name === null ? null : (this.tabs.get(name) ?? null);
        if (this.selected !== null) {
            this.selected.button.classList.remove('active');
        }
        this.selected = tab;
        this.lastContextText = null;
        this.dom.panelError.textContent =
            tab !== null && tab.layoutError !== null
                ? `Chart unavailable: ${tab.layoutError}`
                : '';
        this.dom.eventRows.textContent = '';
        this.dom.log.textContent = '';
        if (tab === null) {
            return;
        }
        tab.button.classList.add('active');
        this.buildEventRows(tab);
        for (const entry of tab.log.entries) {
            const li = document.createElement('li');
            li.textContent = formatLogEntry(entry);
            this.dom.log.appendChild(li);
        }
    }

    private appendLog(tab: Tab, text: string, key?: string): void {
        const change = tab.log.append(text, key);
        if (tab !== this.selected) {
            return;
        }
        const logEl = this.dom.log;
        if (change.kind === 'updated') {
            const first = logEl.firstElementChild;
            if (first !== null) {
                first.textContent = formatLogEntry(change.entry);
            }
            return;
        }
        const li = document.createElement('li');
        li.textContent = formatLogEntry(change.entry);
        logEl.prepend(li);
        while (logEl.children.length > tab.log.entries.length) {
            logEl.lastElementChild!.remove();
        }
    }

    private buildEventRows(tab: Tab): void {
        if (tab.layout === null) {
            return;
        }
        const events: string[] = [];
        for (const edge of tab.layout.edges) {
            if (!events.includes(edge.event)) {
                events.push(edge.event);
            }
        }
        for (const event of events) {
            const row = document.createElement('div');
            row.className = 'event-row';
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `⚡ ${event}`;
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'payload';
            const textarea = document.createElement('textarea');
            textarea.rows = 3;
            textarea.value = JSON.stringify(
                tab.entry.samplePayloads[event] ?? {},
                null,
                2
            );
            const errorEl = document.createElement('div');
            errorEl.className = 'payload-error';
            button.addEventListener('click', () =>
                this.fireEvent(tab, event, textarea.value, errorEl)
            );
            details.append(summary, textarea);
            row.append(button, details, errorEl);
            this.dom.eventRows.appendChild(row);
        }
    }

    private fireEvent(
        tab: Tab,
        event: string,
        payloadText: string,
        errorEl: HTMLElement
    ): void {
        errorEl.textContent = '';
        let payload: unknown;
        try {
            payload = JSON.parse(payloadText);
        } catch (error) {
            errorEl.textContent = `Invalid JSON: ${String(error)}`;
            return;
        }
        try {
            (
                tab.entry.machine.happens as (
                    event: string,
                    payload: unknown
                ) => unknown
            )(event, payload);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            errorEl.textContent = `Action threw: ${message}`;
            this.appendLog(
                tab,
                `${event} ${payloadText} → action threw: ${message}`
            );
        }
    }

    private resetSelected(): void {
        const tab = this.selected;
        if (tab === null) {
            return;
        }
        tab.entry.machine.reset();
        tab.flash = null;
        this.appendLog(tab, 'machine reset');
    }
}
````

- [ ] **Step 2: Export from `index.ts`**

Append:

```typescript
export { DEFAULT_HOTKEY, MachineDebugger } from './debugger';
export type { MachineDebuggerOptions } from './debugger';
```

- [ ] **Step 3: Type-check via the build**

```bash
bunx nx build being-devtools
```

Expected: no tsc errors. Likely trouble spots: the `onEventResult` callback parameter types (`args`, `result`) infer from `AnyStateMachine`, so `args[0]` / `args[1]` and `result.handled` must resolve; if `machine.states[edge.from]?.guards` in `enabled.ts` complains, that file already casts to `Record<string, ...>`.

- [ ] **Step 4: Wire the examples app to the package**

In `apps/examples/package.json`, inside `dependencies`, add `"@ue-too/being-devtools": "workspace:*"` (alphabetically after `@ue-too/being`) and delete the `"@dagrejs/dagre": "1.1.5"` line — the package brings dagre now.

In `apps/examples/project.json`, add `"being-devtools"` to the `implicitDependencies` array after `"being"`.

In `apps/examples/tsconfig.json`, add a project reference after the `../../packages/being` entry:

```json
{
    "path": "../../packages/being-devtools"
}
```

Then:

```bash
bun install
```

- [ ] **Step 5: Rewrite `apps/examples/src/state-machine-visualizer/index.html`**

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
            }
            #app {
                height: 100%;
            }
        </style>
    </head>
    <body>
        <div id="app"></div>
        <script type="module" src="./main.ts"></script>
    </body>
</html>
```

- [ ] **Step 6: Rewrite `apps/examples/src/state-machine-visualizer/main.ts`**

```typescript
import { createVendingMachine } from '@ue-too/being';
import { MachineDebugger } from '@ue-too/being-devtools';

import { createAccountDemoMachine } from './account-demo';

const container = document.getElementById('app')!;

// Inline mount: the page is the panel. Everything attached here is
// borrowed, so the panel never wraps anything up; reset is the recovery
// for a live machine stranded by a hand-fired half-gesture.
const panel = new MachineDebugger({ container, openByDefault: true });

panel.attach(createVendingMachine(), {
    name: 'Vending machine (being example)',
});
panel.attach(createAccountDemoMachine(), {
    name: 'Bank account (preconditions demo)',
    samplePayloads: {
        withdraw: { amount: 60 },
        deposit: { amount: 50 },
    },
});

// The diagram's own viewport: the board being charted is the board you
// are panning. Hold spacebar over the chart and watch the pan machine.
panel.attachBoard(panel.board);
```

- [ ] **Step 7: Delete the app's copies**

```bash
git rm apps/examples/src/state-machine-visualizer/registry.ts \
    apps/examples/src/state-machine-visualizer/layout.ts \
    apps/examples/src/state-machine-visualizer/render.ts
```

`account-demo.ts` stays.

- [ ] **Step 8: Type-check and build the examples app**

```bash
bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2020 --lib es2020,dom apps/examples/src/state-machine-visualizer/main.ts
bunx nx build examples
```

Expected: both succeed (Vite does not type-check, which is why the first command exists). If `createVendingMachine()` or `createAccountDemoMachine()` is rejected as not assignable to `MachineLike`, fix `MachineLike` in `registry.ts` (loosen the offending member) — do not add casts in `main.ts`.

- [ ] **Step 9: Verify by hand in the browser**

```bash
bun run dev:examples
```

Open `http://localhost:<port>/ue-too/state-machine-visualizer/` (Vite prints the port; the app's `base` is `/ue-too/`). Use the `agent-browser` skill if you cannot open a browser yourself. Check every item:

1. Seven tabs appear: the two demos and `board:kmt-input`, `board:touch-input`, `board:pan-control`, `board:zoom-control`, `board:rotation-control`.
2. Vending machine tab: chart draws; the current state node is highlighted; ⚡ buttons fire and the log lines and edge flash appear.
3. Bank account tab: with the default balance, `withdraw` with `{"amount": 60}` twice ends in `FROZEN`; a third `withdraw` shows `→ not handled` and its edge is dimmed. Context panel shows the live `balance`.
4. `board:pan-control` tab: hold spacebar over the chart and drag — `READY_TO_PAN_VIA_SPACEBAR` / panning states light up from real input. Log lines for `pointerMove` coalesce into one `×N` line rather than flooding.
5. `board:kmt-input` tab: scroll over the chart and confirm the log updates.
6. Reset on a board tab recovers it (log shows `machine reset`, state returns to `IDLE`, panning still works afterwards).
7. Ctrl+Shift+M (Cmd+Shift+M on macOS) collapses the inline panel to the pill and expands it again; the log is intact after reopening.
8. No console errors.

If keyboard or pointer input does not reach the graph board inside the shadow root, that is the one risk the spec flagged: switch `panel-dom.ts` to a light-DOM root (append the markup directly into `host` with the styles scoped under a `.ue-being-devtools` class) and re-run this checklist. Everything else in the plan is unaffected.

- [ ] **Step 10: Commit**

```bash
bun run format
git add packages/being-devtools apps/examples bun.lock
git commit -m "feat(being-devtools): MachineDebugger panel, examples visualizer rebuilt on it

The examples page becomes a thin consumer: it attaches its two demo
machines and its own graph board to an inline MachineDebugger. The app's
registry, layout and render modules are deleted in favour of the package.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 9: `hook.ts` and `attach.ts` — shared overlay panel and `window.__UE_TOO_BEING__`

**Files:**

- Create: `packages/being-devtools/src/hook.ts`
- Create: `packages/being-devtools/src/attach.ts`
- Modify: `packages/being-devtools/src/debugger.ts` (two lines: register in the constructor, unregister in `dispose`)
- Modify: `packages/being-devtools/src/index.ts`
- Test: `packages/being-devtools/test/hook.test.ts`, `packages/being-devtools/test/attach.test.ts`

**Interfaces:**

- Consumes: `MachineDebugger` (Task 8), `AttachHandle`, `AttachOptions`, `MachineLike`, `AnyStateMachine` (Task 5), `BoardLike` (Task 6).
- Produces:
    - `hook.ts`: `type HookPanel = { open(): void; close(): void; readonly machines: ReadonlyMap<string, AnyStateMachine> }`; `type BeingDevtoolsHook = { readonly machines: ReadonlyMap<string, AnyStateMachine>; open(): void; close(): void; attach(machine: MachineLike, options?: AttachOptions): AttachHandle }`; `HOOK_KEY = '__UE_TOO_BEING__'`; `registerPanel(panel: HookPanel, target?: HookTarget): void`; `unregisterPanel(panel: HookPanel): void`; `configureHookAttach(fn): void`; `type HookTarget = Record<string, unknown>`
    - `attach.ts`: `type SharedPanelLike = { attach(...): AttachHandle; attachBoard(...): AttachHandle; readonly size: number; dispose(): void }`; `createSharedAttachers(factory: () => SharedPanelLike): { attachMachineDebugger; attachBoardDebugger }`; `attachMachineDebugger(machine: MachineLike, options?: AttachOptions): AttachHandle`; `attachBoardDebugger(board: BoardLike, options?: { namePrefix?: string }): AttachHandle`

**Background:** the hook lives in its own module so it can be tested against a plain object instead of `window`, and so `debugger.ts` (which registers panels) and `attach.ts` (which supplies the hook's `attach`) do not import each other. `attach.ts` injects its function with `configureHookAttach` at module load; `index.ts` imports `attach.ts`, so any consumer of the package entry gets a working hook.

- [ ] **Step 1: Write the failing tests**

Create `packages/being-devtools/test/hook.test.ts`:

```typescript
import { afterEach, describe, expect, it } from 'vitest';

import {
    BeingDevtoolsHook,
    HOOK_KEY,
    HookPanel,
    configureHookAttach,
    registerPanel,
    unregisterPanel,
} from '../src/hook';
import { AnyStateMachine } from '../src/registry';

function fakePanel(
    names: string[]
): HookPanel & { opened: number; closed: number } {
    const machines = new Map<string, AnyStateMachine>();
    for (const name of names) {
        machines.set(name, { name } as unknown as AnyStateMachine);
    }
    return {
        opened: 0,
        closed: 0,
        machines,
        open() {
            this.opened += 1;
        },
        close() {
            this.closed += 1;
        },
    };
}

function hookOn(target: Record<string, unknown>): BeingDevtoolsHook {
    return target[HOOK_KEY] as BeingDevtoolsHook;
}

describe('window hook', () => {
    const registered: HookPanel[] = [];
    afterEach(() => {
        for (const panel of registered.splice(0)) {
            unregisterPanel(panel);
        }
    });
    const register = (panel: HookPanel, target: Record<string, unknown>) => {
        registerPanel(panel, target);
        registered.push(panel);
    };

    it('installs on the first panel and removes on the last', () => {
        const target: Record<string, unknown> = {};
        const a = fakePanel(['a']);
        const b = fakePanel(['b']);
        register(a, target);
        expect(hookOn(target)).toBeDefined();
        register(b, target);
        unregisterPanel(a);
        expect(hookOn(target)).toBeDefined();
        unregisterPanel(b);
        expect(HOOK_KEY in target).toBe(false);
        registered.length = 0;
    });

    it('unions machines across live panels', () => {
        const target: Record<string, unknown> = {};
        register(fakePanel(['a', 'b']), target);
        register(fakePanel(['c']), target);
        expect([...hookOn(target).machines.keys()]).toEqual(['a', 'b', 'c']);
    });

    it('open and close address the most recently registered panel', () => {
        const target: Record<string, unknown> = {};
        const first = fakePanel([]);
        const second = fakePanel([]);
        register(first, target);
        register(second, target);
        hookOn(target).open();
        hookOn(target).close();
        expect(first.opened + first.closed).toBe(0);
        expect(second.opened).toBe(1);
        expect(second.closed).toBe(1);
    });

    it('attach delegates to the configured function', () => {
        const target: Record<string, unknown> = {};
        register(fakePanel([]), target);
        let received: unknown = null;
        const handle = { dispose() {} };
        configureHookAttach((machine, options) => {
            received = { machine, options };
            return handle;
        });
        const machine = { happens() {} } as unknown as Parameters<
            BeingDevtoolsHook['attach']
        >[0];
        expect(hookOn(target).attach(machine, { name: 'x' })).toBe(handle);
        expect(received).toEqual({ machine, options: { name: 'x' } });
    });

    it('does nothing when there is no target', () => {
        expect(() => registerPanel(fakePanel([]), undefined)).not.toThrow();
    });
});
```

Create `packages/being-devtools/test/attach.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { SharedPanelLike, createSharedAttachers } from '../src/attach';
import { MachineLike } from '../src/registry';

function fakeMachine(): MachineLike {
    return {
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

function fakePanelFactory(options: { boardMachines?: number } = {}) {
    const panels: (SharedPanelLike & { disposed: boolean })[] = [];
    const factory = () => {
        let size = 0;
        const panel = {
            disposed: false,
            get size() {
                return size;
            },
            attach() {
                size += 1;
                return {
                    dispose() {
                        size -= 1;
                    },
                };
            },
            attachBoard() {
                const count = options.boardMachines ?? 5;
                if (count === 0) {
                    throw new Error('No being state machines found');
                }
                size += count;
                return {
                    dispose() {
                        size -= count;
                    },
                };
            },
            dispose() {
                panel.disposed = true;
            },
        };
        panels.push(panel);
        return panel;
    };
    return { factory, panels };
}

describe('shared attachers', () => {
    it('creates one panel lazily and reuses it', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        expect(panels).toHaveLength(0);
        attachMachineDebugger(fakeMachine());
        attachMachineDebugger(fakeMachine());
        expect(panels).toHaveLength(1);
        expect(panels[0].size).toBe(2);
    });

    it('disposes the panel when the last handle is disposed, then recreates', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        const a = attachMachineDebugger(fakeMachine());
        const b = attachMachineDebugger(fakeMachine());
        a.dispose();
        expect(panels[0].disposed).toBe(false);
        b.dispose();
        expect(panels[0].disposed).toBe(true);
        attachMachineDebugger(fakeMachine());
        expect(panels).toHaveLength(2);
    });

    it('ignores a second dispose of the same handle', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        const a = attachMachineDebugger(fakeMachine());
        const b = attachMachineDebugger(fakeMachine());
        a.dispose();
        a.dispose();
        expect(panels[0].size).toBe(1);
        expect(panels[0].disposed).toBe(false);
        b.dispose();
    });

    it('attachBoardDebugger shares the same panel', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger, attachBoardDebugger } =
            createSharedAttachers(factory);
        attachMachineDebugger(fakeMachine());
        const board = attachBoardDebugger({ cameraMux: {} });
        expect(panels).toHaveLength(1);
        expect(panels[0].size).toBe(6);
        board.dispose();
        expect(panels[0].size).toBe(1);
    });

    it('tears down an empty panel if attachBoardDebugger finds nothing', () => {
        const { factory, panels } = fakePanelFactory({ boardMachines: 0 });
        const { attachBoardDebugger } = createSharedAttachers(factory);
        expect(() => attachBoardDebugger({ cameraMux: {} })).toThrow(
            /No being state machines/
        );
        expect(panels[0].disposed).toBe(true);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bunx nx test being-devtools
```

Expected: FAIL — cannot resolve `../src/hook` and `../src/attach`.

- [ ] **Step 3: Implement `packages/being-devtools/src/hook.ts`**

```typescript
import {
    AnyStateMachine,
    AttachHandle,
    AttachOptions,
    MachineLike,
} from './registry';

/** The property name installed on `window`. @category Types */
export const HOOK_KEY = '__UE_TOO_BEING__';

/** What a panel must expose to be reachable from the hook. */
export type HookPanel = {
    open(): void;
    close(): void;
    readonly machines: ReadonlyMap<string, AnyStateMachine>;
};

/**
 * The console hook at `window.__UE_TOO_BEING__`, present while at least
 * one panel is alive.
 *
 * @remarks
 * `machines` is the union across every live panel. `open()` and `close()`
 * address the most recently created panel. `attach()` goes to the shared
 * overlay panel, exactly like `attachMachineDebugger`.
 *
 * @category Types
 */
export type BeingDevtoolsHook = {
    readonly machines: ReadonlyMap<string, AnyStateMachine>;
    open(): void;
    close(): void;
    attach(machine: MachineLike, options?: AttachOptions): AttachHandle;
};

/** Where the hook is installed. `window` in a browser; injectable for tests. */
export type HookTarget = Record<string, unknown>;

type HookAttach = BeingDevtoolsHook['attach'];

const panels: HookPanel[] = [];
let installedOn: HookTarget | null = null;
let hookAttach: HookAttach = () => {
    throw new Error(
        'being-devtools hook attach is not configured; import the package entry point.'
    );
};

function defaultTarget(): HookTarget | undefined {
    return typeof window === 'undefined'
        ? undefined
        : (window as unknown as HookTarget);
}

function createHook(): BeingDevtoolsHook {
    return {
        get machines() {
            const all = new Map<string, AnyStateMachine>();
            for (const panel of panels) {
                for (const [name, machine] of panel.machines) {
                    all.set(name, machine);
                }
            }
            return all;
        },
        open() {
            panels[panels.length - 1]?.open();
        },
        close() {
            panels[panels.length - 1]?.close();
        },
        attach(machine, options) {
            return hookAttach(machine, options);
        },
    };
}

/** Supplies the function the hook's `attach()` delegates to. */
export function configureHookAttach(fn: HookAttach): void {
    hookAttach = fn;
}

/**
 * Adds a panel to the hook, installing the hook on `target` if it is the
 * first. Passing `undefined` as the target (no `window`) is a no-op for
 * installation but still tracks the panel.
 */
export function registerPanel(
    panel: HookPanel,
    target: HookTarget | undefined = defaultTarget()
): void {
    if (!panels.includes(panel)) {
        panels.push(panel);
    }
    if (target !== undefined && installedOn === null) {
        target[HOOK_KEY] = createHook();
        installedOn = target;
    }
}

/** Removes a panel; the hook is uninstalled when no panels remain. */
export function unregisterPanel(panel: HookPanel): void {
    const index = panels.indexOf(panel);
    if (index !== -1) {
        panels.splice(index, 1);
    }
    if (panels.length === 0 && installedOn !== null) {
        delete installedOn[HOOK_KEY];
        installedOn = null;
    }
}
```

- [ ] **Step 4: Implement `packages/being-devtools/src/attach.ts`**

````typescript
import { BoardLike } from './board';
import { MachineDebugger } from './debugger';
import { configureHookAttach } from './hook';
import { AttachHandle, AttachOptions, MachineLike } from './registry';

/** The slice of {@link MachineDebugger} the shared-panel logic needs. */
export type SharedPanelLike = {
    attach(machine: MachineLike, options?: AttachOptions): AttachHandle;
    attachBoard(
        board: BoardLike,
        options?: { namePrefix?: string }
    ): AttachHandle;
    readonly size: number;
    dispose(): void;
};

/**
 * Builds the pair of one-liner attach functions over a lazily created
 * shared panel. The panel is created on the first attach and disposed
 * when the last handle is disposed, so a page that attaches and detaches
 * leaves no trace.
 */
export function createSharedAttachers(factory: () => SharedPanelLike): {
    attachMachineDebugger(
        machine: MachineLike,
        options?: AttachOptions
    ): AttachHandle;
    attachBoardDebugger(
        board: BoardLike,
        options?: { namePrefix?: string }
    ): AttachHandle;
} {
    let shared: SharedPanelLike | null = null;

    const panel = (): SharedPanelLike => {
        if (shared === null) {
            shared = factory();
        }
        return shared;
    };

    const tearDownIfEmpty = (): void => {
        if (shared !== null && shared.size === 0) {
            shared.dispose();
            shared = null;
        }
    };

    const wrap = (handle: AttachHandle): AttachHandle => {
        let disposed = false;
        return {
            dispose() {
                if (disposed) {
                    return;
                }
                disposed = true;
                handle.dispose();
                tearDownIfEmpty();
            },
        };
    };

    const guarded = (
        run: (p: SharedPanelLike) => AttachHandle
    ): AttachHandle => {
        const p = panel();
        try {
            return wrap(run(p));
        } catch (error) {
            tearDownIfEmpty();
            throw error;
        }
    };

    return {
        attachMachineDebugger: (machine, options) =>
            guarded(p => p.attach(machine, options)),
        attachBoardDebugger: (board, options) =>
            guarded(p => p.attachBoard(board, options)),
    };
}

const shared = createSharedAttachers(() => new MachineDebugger());

/**
 * Attaches a machine to the page's shared floating panel, creating the
 * panel on first use. Press Ctrl+Shift+M (Cmd+Shift+M on macOS) to open it.
 *
 * @example
 * ```ts
 * const handle = attachMachineDebugger(machine, { name: 'pan-control' });
 * // on teardown
 * handle.dispose();
 * ```
 *
 * @category Core
 */
export function attachMachineDebugger(
    machine: MachineLike,
    options?: AttachOptions
): AttachHandle {
    return shared.attachMachineDebugger(machine, options);
}

/**
 * Attaches every `being` machine a `Board` exposes — keyboard/mouse input,
 * touch input, pan, zoom, and rotation control — to the shared panel.
 *
 * @throws Error when the board exposes no machines at all.
 * @category Core
 */
export function attachBoardDebugger(
    board: BoardLike,
    options?: { namePrefix?: string }
): AttachHandle {
    return shared.attachBoardDebugger(board, options);
}

configureHookAttach(attachMachineDebugger);
````

- [ ] **Step 5: Register panels from `debugger.ts`**

In `packages/being-devtools/src/debugger.ts`:

Add the import:

```typescript
import { registerPanel, unregisterPanel } from './hook';
```

In the constructor, immediately after `this.dom.setCount(0);`, add:

```typescript
registerPanel(this);
```

In `dispose()`, immediately after `this.disposed = true;`, add:

```typescript
unregisterPanel(this);
```

`MachineDebugger` already satisfies `HookPanel` through its `open`, `close`, and `machines` members.

- [ ] **Step 6: Export from `index.ts`**

Append:

```typescript
export { attachBoardDebugger, attachMachineDebugger } from './attach';
export { HOOK_KEY } from './hook';
export type { BeingDevtoolsHook } from './hook';
```

- [ ] **Step 7: Run the tests and the build**

```bash
bunx nx test being-devtools
bunx nx build being-devtools
```

Expected: all tests PASS; build clean.

- [ ] **Step 8: Verify the overlay by hand**

Temporarily change the `@ue-too/being-devtools` import line in `apps/examples/src/state-machine-visualizer/main.ts` to also import `attachMachineDebugger`, and add at the end of the file:

```typescript
attachMachineDebugger(createVendingMachine(), { name: 'overlay-check' });
```

Run `bun run dev:examples`, open the visualizer page, and check:

1. A `⚙ being 1` pill appears bottom-right, over the inline panel.
2. Clicking it opens a floating panel sized to the viewport with the vending machine; Ctrl+Shift+M toggles both panels (they share the hotkey — expected).
3. In the console, `[...window.__UE_TOO_BEING__.machines.keys()]` lists eight names (seven inline + `overlay-check`); `.open()` / `.close()` drive the overlay, the most recently created panel.
4. In the console, `window.__UE_TOO_BEING__.attach(window.__UE_TOO_BEING__.machines.get('overlay-check'), { name: 'from-console' })` adds a `from-console` tab to the overlay; repeating it with the same name throws the duplicate-name error.
5. Revert the temporary import change and remove the added line. Reload: the pill is gone and `window.__UE_TOO_BEING__` still exists, because the inline panel is registered.

Confirm the temporary lines are removed before committing.

- [ ] **Step 9: Commit**

```bash
bun run format
git add packages/being-devtools
git commit -m "feat(being-devtools): one-call attach over a shared overlay and window hook

attachMachineDebugger / attachBoardDebugger lazily create one floating
panel and dispose it with the last handle. window.__UE_TOO_BEING__ exposes
the attached machines and open/close/attach for console use.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

---

### Task 10: README, docs config, `CLAUDE.md`, final verification

**Files:**

- Modify: `packages/being-devtools/README.md` (rewrite)
- Modify: `packages/being-devtools/typedoc.json` (check `categoryOrder`)
- Modify: `CLAUDE.md` (repo root) — project structure
- Verify: whole-repo test, build, format check

**Interfaces:**

- Consumes: the public API as exported from `packages/being-devtools/src/index.ts`.
- Produces: nothing new.

- [ ] **Step 1: Write `packages/being-devtools/README.md`**

````markdown
# @ue-too/being-devtools

Attachable devtools for [`@ue-too/being`](https://www.npmjs.com/package/@ue-too/being) state machines. One call strips a live state chart, event log, and context inspector onto any running machine.

[![npm version](https://img.shields.io/npm/v/@ue-too/being-devtools.svg)](https://www.npmjs.com/package/@ue-too/being-devtools)
[![license](https://img.shields.io/npm/l/@ue-too/being-devtools.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

## Install

```bash
bun add -d @ue-too/being-devtools
```
````

Peers: `@ue-too/being` and `@ue-too/board` are dependencies and install with it.

## One line

```ts
import { attachMachineDebugger } from '@ue-too/being-devtools';

const machine = new TemplateStateMachine(states, 'IDLE', context);
attachMachineDebugger(machine, { name: 'pan-control' });
```

A collapsed pill appears bottom-right. Press **Ctrl+Shift+M** (Cmd+Shift+M on macOS) or click it to open the panel:

- the machine's state chart, laid out from its states, events, preconditions and routing guards;
- the current state highlighted; transitions whose preconditions currently fail are dimmed;
- an event log of everything the machine handles, whoever fired it, with repeats coalesced into `×N`;
- the context, live;
- a fire button per event with an editable JSON payload, and a reset.

Call `attachMachineDebugger` again to add more machines as tabs. Every call returns a handle whose `dispose()` detaches that machine; when the last one goes, the panel goes too.

Guard it for development builds:

```ts
if (import.meta.env.DEV) {
    attachMachineDebugger(machine, { name: 'pan-control' });
}
```

## Boards

`@ue-too/board` runs five `being` machines. Attach them all at once:

```ts
import { attachBoardDebugger } from '@ue-too/being-devtools';

attachBoardDebugger(board); // tabs: board:kmt-input, board:touch-input, board:pan-control, ...
attachBoardDebugger(minimap, { namePrefix: 'minimap' });
```

## Own the panel

For an inline mount or a custom hotkey, construct the panel yourself:

```ts
import { MachineDebugger } from '@ue-too/being-devtools';

const panel = new MachineDebugger({
    container: document.getElementById('debug')!, // inline instead of overlay
    hotkey: 'ctrl+alt+d', // or false to disable
    openByDefault: true,
});
panel.attach(machine, { name: 'pan-control' });
panel.attachBoard(board);
panel.dispose();
```

## Console

While any panel is alive, `window.__UE_TOO_BEING__` exposes `machines` (name → machine), `open()`, `close()`, and `attach(machine, options)`.

## What it never does

The panel borrows your machines. It never calls `wrapup()`, which would park a live machine in `TERMINAL` and, for a board, stop it responding to input. Reset is available because `reset()` restarts the machine; it is the recovery for a machine stranded by a hand-fired half-gesture.

Machines that do not implement the optional `onEventResult` subscription still get the chart, current state and context, but no event log. `TemplateStateMachine` implements it.

````

- [ ] **Step 2: Check `packages/being-devtools/typedoc.json`**

The scaffold's `categoryOrder` is `['Core', 'Helpers', 'Types', '*']`, matching the `@category` tags used throughout this plan. Leave it. Confirm the docs build works:

```bash
bunx nx docs:build being-devtools
````

Expected: `docs/en/being-devtools/` (and other locales) generated without errors.

- [ ] **Step 3: Update `CLAUDE.md`**

In the repo-root `CLAUDE.md`, under `Integration (depend on mid-level):`, add a line after `board-game-engine/`:

```
    being-devtools/ — Attachable debugger panel for being machines (state chart, event log, context)
```

- [ ] **Step 4: Run the whole verification set**

```bash
bun run format:check
bunx nx test being-devtools
bun test
bunx nx build being-devtools
bunx nx build examples
```

Expected: format check clean; all package tests PASS; both builds succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/being-devtools/README.md packages/being-devtools/typedoc.json CLAUDE.md
git commit -m "docs(being-devtools): README, docs config, and CLAUDE.md structure entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7"
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/being-devtools
gh pr create --title "feat(being-devtools): attachable debugger panel for being machines" --body "$(
    cat << 'EOF'
## Summary

- New integration-layer package `@ue-too/being-devtools`: `attachMachineDebugger(machine)` straps the state machine visualizer onto any running `@ue-too/being` machine as a floating Shadow DOM overlay (Ctrl+Shift+M), with tabs per machine, a coalescing event log, precondition dimming, a context inspector, fire buttons, and reset. `attachBoardDebugger(board)` registers a board's five machines in one call. `MachineDebugger` gives full control (inline mount, custom hotkey).
- `window.__UE_TOO_BEING__` exposes attached machines and open/close/attach for console use.
- The examples state machine visualizer is rebuilt as a thin consumer of the package; its registry, layout and render modules are deleted.
- No changes to `@ue-too/being` or `@ue-too/board`.

Spec: `packages/being/docs/specs/2026-09-08-being-devtools-design.md`
Plan: `packages/being/docs/plans/2026-09-08-being-devtools.md`

## Test plan

- [ ] `bun test` green (new tests: layout, hotkey, log, enabled, context, registry, board, hook, attach)
- [ ] `bunx nx build being-devtools` and `bunx nx build examples` succeed
- [ ] Examples visualizer page: seven tabs, live board machines light up from real input, log coalesces during a drag, reset recovers a stranded live machine
- [ ] Overlay: pill appears, hotkey toggles, hook present in console, disposing the last handle removes both

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_018z87YjdvG72iGPz9DBC9A7
EOF
)"
```
