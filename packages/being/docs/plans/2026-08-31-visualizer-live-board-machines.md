# Live Board Machines in the Visualizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the state machine visualizer's five board registry entries at the machines already running inside the page's own viewport `Board`, so real keyboard, mouse and touch input drives the chart live.

**Architecture:** `@ue-too/being` gains an `onEventResult` subscription that fires after `handles()` with the full `EventResult` — the one hook that can tell a precondition veto from a handled no-op — plus disposers on all three subscription methods. `@ue-too/board` exposes read-only getters for the kmt and touch machines it already constructs. The visualizer's registry splits into a discriminated `simulated | live` source, and logging/edge-flashing move from `fireEvent` onto the subscription so hand-fired and canvas-driven events travel one identical path.

**Tech Stack:** TypeScript (strict), Bun, Nx, Vitest, Vite (examples app), dagre (layout).

**Spec:** `packages/being/docs/specs/2026-08-31-visualizer-live-board-machines-design.md`

## Global Constraints

- **Package manager & runtime:** Bun. Never `npm`/`yarn`/`pnpm`/`node`.
- **Run tasks from the repo root via Nx:** `bunx nx test being`, `bunx nx test board`. Do NOT `cd` into a package and run `bun run <script>`.
- **Formatting:** Prettier — 4-space indent, single quotes, trailing comma `es5`. Run `bun run format` before each commit.
- **TypeScript:** strict mode; TypeScript errors are blocking; avoid `any` in public interfaces.
- **No breaking changes.** Every published-interface change in this plan is either an optional member or a widened return type. No commit in this plan may be labeled `!`.
- **Conventional commits drive published versions.** Use `feat(being):`, `feat(board):`, `feat(examples):`, `refactor(examples):` exactly as given in each task's commit step. A wrong label produces a wrong version bump.
- **Never call `wrapup()` or `reset()` on a live board machine outside the paths this plan defines** — `wrapup()` parks it in `TERMINAL` permanently and the real board stops responding to all input.

---

### Task 1: `onEventResult` and disposers in `@ue-too/being`

**Files:**
- Modify: `packages/being/src/interface.ts` (interface `StateMachine` ~line 251-261; class `TemplateStateMachine` fields ~line 631, constructor ~line 656, `happens` ~line 712-755, `onStateChange`/`onHappens` ~line 757-771)
- Test: `packages/being/test/event-result-subscription.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export type EventResultCallback<EventPayloadMapping, Context extends BaseContext, States extends string> = (args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>, result: EventResult<States, unknown>, context: Context) => void`
  - `StateMachine.onEventResult?(callback: EventResultCallback<...>): void | (() => void)` — optional member.
  - `StateMachine.onStateChange(callback): void | (() => void)` and `StateMachine.onHappens(callback): void | (() => void)` — widened returns.
  - On `TemplateStateMachine`, all three return `() => void` (a real disposer).

**Background for the implementer:** `happens()` already calls `_happensCallbacks` before dispatch and `_stateChangeCallbacks` after a transition. Neither can observe a *result*: a precondition veto returns `{ handled: false }` from inside `handles()`, and a self-transition is skipped by the `result.nextState !== this._currentState` guard, so in both cases `onStateChange` never fires and an outside observer cannot tell what happened. `onEventResult` closes that gap by firing right after `handles()` returns.

- [ ] **Step 1: Write the failing test**

Create `packages/being/test/event-result-subscription.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
    BaseContext,
    EventPreconditions,
    EventReactions,
    Guard,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';

type Events = {
    go: {};
    stay: {};
    loop: {};
    vetoed: {};
    payloaded: { text: string };
};
type States = 'IDLE' | 'ACTIVE';

interface FlagContext extends BaseContext {
    allowed: boolean;
}

function createContext(overrides: Partial<FlagContext> = {}): FlagContext {
    return {
        allowed: false,
        setup() {},
        cleanup() {},
        ...overrides,
    };
}

class IdleState extends TemplateState<Events, FlagContext, States> {
    protected _guards: Guard<FlagContext, 'isAllowed'> = {
        isAllowed: context => context.allowed,
    };
    protected _eventReactions: EventReactions<Events, FlagContext, States> = {
        // handled, with a transition
        go: { action: () => {}, defaultTargetState: 'ACTIVE' },
        // handled, no target state at all
        stay: { action: () => {} },
        // handled, but targets the state we are already in
        loop: { action: () => {}, defaultTargetState: 'IDLE' },
        // vetoed before the action runs
        vetoed: { action: () => {}, defaultTargetState: 'ACTIVE' },
        // carries a payload, so args[1] is populated
        payloaded: { action: () => {} },
    };
    protected _eventPreconditions: Partial<
        EventPreconditions<Events, FlagContext, Guard<FlagContext>>
    > = {
        vetoed: ['isAllowed'],
    };
}

class ActiveState extends TemplateState<Events, FlagContext, States> {}

function createMachine(context: FlagContext) {
    return new TemplateStateMachine<Events, FlagContext, States>(
        { IDLE: new IdleState(), ACTIVE: new ActiveState() },
        'IDLE',
        context
    );
}

describe('onEventResult', () => {
    it('reports a handled event that transitions', () => {
        const machine = createMachine(createContext());
        const seen: unknown[] = [];
        machine.onEventResult((args, result) => {
            seen.push([args[0], result]);
        });
        machine.happens('go');
        expect(seen).toEqual([['go', { handled: true, nextState: 'ACTIVE' }]]);
    });

    it('reports a handled event that does not transition', () => {
        const machine = createMachine(createContext());
        const seen: unknown[] = [];
        machine.onEventResult((args, result) => {
            seen.push([args[0], result]);
        });
        machine.happens('stay');
        expect(seen).toEqual([['stay', { handled: true }]]);
    });

    it('reports a self-transition that onStateChange does not fire for', () => {
        const machine = createMachine(createContext());
        const results: unknown[] = [];
        const stateChanges: unknown[] = [];
        machine.onEventResult((_args, result) => {
            results.push(result);
        });
        machine.onStateChange((from, to) => {
            stateChanges.push([from, to]);
        });
        machine.happens('loop');
        expect(results).toEqual([{ handled: true, nextState: 'IDLE' }]);
        expect(stateChanges).toEqual([]);
    });

    it('reports a precondition veto as not handled', () => {
        const machine = createMachine(createContext({ allowed: false }));
        const seen: unknown[] = [];
        machine.onEventResult((_args, result) => {
            seen.push(result);
        });
        machine.happens('vetoed');
        expect(seen).toEqual([{ handled: false }]);
        expect(machine.currentState).toBe('IDLE');
    });

    it('passes the payload and the live context to the callback', () => {
        const context = createContext();
        const machine = createMachine(context);
        const seen: unknown[] = [];
        machine.onEventResult((args, _result, callbackContext) => {
            seen.push([args[1], callbackContext]);
        });
        machine.happens('payloaded', { text: 'hello' });
        expect(seen).toEqual([[{ text: 'hello' }, context]]);
    });

    it('fires after onHappens and before onStateChange', () => {
        const machine = createMachine(createContext());
        const order: string[] = [];
        machine.onHappens(() => order.push('happens'));
        machine.onEventResult(() => order.push('result'));
        machine.onStateChange(() => order.push('stateChange'));
        machine.happens('go');
        expect(order).toEqual(['happens', 'result', 'stateChange']);
    });

    it('stays silent while the machine is TERMINAL', () => {
        const machine = createMachine(createContext());
        const seen: unknown[] = [];
        machine.onEventResult(() => seen.push('fired'));
        machine.wrapup();
        machine.happens('go');
        expect(seen).toEqual([]);
    });
});

describe('subscription disposers', () => {
    it('onEventResult returns a disposer that removes the callback', () => {
        const machine = createMachine(createContext());
        const seen: string[] = [];
        const dispose = machine.onEventResult(() => seen.push('fired'));
        machine.happens('stay');
        dispose();
        machine.happens('stay');
        expect(seen).toEqual(['fired']);
    });

    it('onHappens returns a working disposer', () => {
        const machine = createMachine(createContext());
        const seen: string[] = [];
        const dispose = machine.onHappens(() => seen.push('fired'));
        machine.happens('stay');
        dispose();
        machine.happens('stay');
        expect(seen).toEqual(['fired']);
    });

    it('onStateChange returns a working disposer', () => {
        const machine = createMachine(createContext());
        const seen: string[] = [];
        const dispose = machine.onStateChange(() => seen.push('fired'));
        machine.happens('go');
        machine.reset();
        dispose();
        machine.happens('go');
        expect(seen).toEqual(['fired']);
    });

    it('is safe to dispose twice', () => {
        const machine = createMachine(createContext());
        const seen: string[] = [];
        const first = machine.onEventResult(() => seen.push('first'));
        machine.onEventResult(() => seen.push('second'));
        first();
        first();
        machine.happens('stay');
        expect(seen).toEqual(['second']);
    });

    it('does not skip a neighbour when a callback disposes during dispatch', () => {
        const machine = createMachine(createContext());
        const seen: string[] = [];
        const first = machine.onEventResult(() => {
            seen.push('first');
            first();
        });
        machine.onEventResult(() => seen.push('second'));
        machine.happens('stay');
        expect(seen).toEqual(['first', 'second']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test being`
Expected: FAIL. `machine.onEventResult` is not a function, and the disposer tests fail because `onStateChange`/`onHappens` currently return `undefined` (calling `dispose()` throws "dispose is not a function").

- [ ] **Step 3: Add the callback type and widen the interface**

In `packages/being/src/interface.ts`, add this type immediately after the existing `StateChangeCallback` declaration (~line 273-276):

```typescript
/**
 * Callback invoked after a state has handled an event, with the event's
 * full {@link EventResult}.
 *
 * @remarks
 * Unlike {@link StateChangeCallback}, this fires for *every* dispatch that
 * reaches a state — including a precondition veto (`{ handled: false }`)
 * and a self-transition, neither of which triggers a state change. Intended
 * for tooling/introspection; do not mutate the context from here.
 *
 * @category Types
 */
export type EventResultCallback<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string,
> = (
    args: EventArgs<EventPayloadMapping, keyof EventPayloadMapping | string>,
    result: EventResult<States, unknown>,
    context: Context
) => void;
```

Then in the `StateMachine` interface, replace the `onStateChange` line and the `onHappens` block (currently lines 251-261) with:

```typescript
    onStateChange(callback: StateChangeCallback<States>): void | (() => void);
    possibleStates: States[];
    onHappens(
        callback: (
            args: EventArgs<
                EventPayloadMapping,
                keyof EventPayloadMapping | string
            >,
            context: Context
        ) => void
    ): void | (() => void);
    /**
     * Subscribe to every event result. Optional so existing StateMachine
     * implementations remain valid; {@link TemplateStateMachine} always
     * provides it. Returns a disposer on implementations that support one.
     */
    onEventResult?(
        callback: EventResultCallback<EventPayloadMapping, Context, States>
    ): void | (() => void);
```

The `void | (() => void)` return means an existing external implementation returning `void` still satisfies the interface, and `onEventResult` being optional means an existing implementation that lacks it entirely still satisfies it. Neither change is breaking.

- [ ] **Step 4: Implement the callback array, dispatch, and disposers**

In `TemplateStateMachine`, add the field after `_happensCallbacks` (~line 638):

```typescript
    protected _eventResultCallbacks: EventResultCallback<
        EventPayloadMapping,
        Context,
        States
    >[];
```

In the constructor, after `this._happensCallbacks = [];` (~line 657):

```typescript
        this._eventResultCallbacks = [];
```

In `happens()`, change the existing `_happensCallbacks` dispatch (~line 724) to iterate a copy, and add the `onEventResult` dispatch right after `handles()` returns:

```typescript
        for (const callback of [...this._happensCallbacks]) {
            callback(args, this._context);
        }
        const result = this._states[this._currentState].handles(
            args,
            this._context,
            this
        );
        for (const callback of [...this._eventResultCallbacks]) {
            callback(args, result, this._context);
        }
```

Also change the existing state-change dispatch (~line 750) to iterate a copy:

```typescript
            for (const callback of [...this._stateChangeCallbacks]) {
                callback(originalState, this._currentState);
            }
```

Copying is what makes disposing from inside a callback safe — splicing the live array mid-iteration would skip the next callback.

Replace `onStateChange` and `onHappens` (~lines 757-771) and add `onEventResult`:

```typescript
    onStateChange(callback: StateChangeCallback<States>): () => void {
        this._stateChangeCallbacks.push(callback);
        return () => {
            const index = this._stateChangeCallbacks.indexOf(callback);
            if (index !== -1) {
                this._stateChangeCallbacks.splice(index, 1);
            }
        };
    }

    onHappens(
        callback: (
            args: EventArgs<
                EventPayloadMapping,
                keyof EventPayloadMapping | string
            >,
            context: Context
        ) => void
    ): () => void {
        this._happensCallbacks.push(callback);
        return () => {
            const index = this._happensCallbacks.indexOf(callback);
            if (index !== -1) {
                this._happensCallbacks.splice(index, 1);
            }
        };
    }

    onEventResult(
        callback: EventResultCallback<EventPayloadMapping, Context, States>
    ): () => void {
        this._eventResultCallbacks.push(callback);
        return () => {
            const index = this._eventResultCallbacks.indexOf(callback);
            if (index !== -1) {
                this._eventResultCallbacks.splice(index, 1);
            }
        };
    }
```

The `indexOf` guard is what makes a second `dispose()` a no-op.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx nx test being`
Expected: PASS, including the pre-existing `being.test.ts`, `context-getter.test.ts`, `event-preconditions.test.ts`, `introspect.test.ts`, `hierarchical.test.ts` and `vending-machine-example.test.ts` — nothing there should regress, since every change is additive or a widened type.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add packages/being/src/interface.ts packages/being/test/event-result-subscription.test.ts
git commit -m "$(cat <<'EOF'
feat(being): add onEventResult subscription and disposers

Adds an optional onEventResult member to the StateMachine interface and a
concrete implementation on TemplateStateMachine. It fires immediately after
the state handles an event, with the full EventResult, so subscribers can
observe the two outcomes the existing hooks miss: a precondition veto
(handled: false, returned before any transition) and a self-transition
(which never fires onStateChange).

All three on* methods now return a disposer. The interface declares the
return as void | (() => void) and onEventResult as optional, so existing
external implementations of StateMachine remain valid. Callback dispatch
iterates a copy of each array so disposing from inside a callback cannot
skip a neighbour.
EOF
)"
```

---

### Task 2: Machine getters in `@ue-too/board`

**Files:**
- Modify: `packages/board/src/input-interpretation/raw-input-parser/vanilla-kmt-event-parser.ts` (interface `KMTEventParser` ~line 18-32; class, add getter beside the setter at ~line 386)
- Modify: `packages/board/src/input-interpretation/raw-input-parser/vanilla-touch-event-parser.ts` (interface `TouchEventParser` ~line 19-32; class ~line 91)
- Modify: `packages/board/src/boardify/index.ts` (add getters near `get kmtParser()` ~line 587)
- Test: `packages/board/test/boardify/state-machine-getters.test.ts` (create)

**Interfaces:**
- Consumes: nothing from Task 1 at the type level.
- Produces:
  - `KMTEventParser.stateMachine?: StateMachine` (readonly, optional) — where `StateMachine` is the **local minimal interface declared in `vanilla-kmt-event-parser.ts`**, `{ happens: (...args: any[]) => EventResult<any> }`, not `being`'s.
  - `TouchEventParser.stateMachine?: TouchInputStateMachine` (readonly, optional).
  - `Board.kmtInputStateMachine: KmtInputStateMachine | undefined`
  - `Board.touchInputStateMachine: TouchInputStateMachine | undefined`

**Background for the implementer:** two traps here.

1. `vanilla-kmt-event-parser.ts` declares and exports its **own** minimal `StateMachine` interface (`{ happens: (...args: any[]) => EventResult<any> }`) and stores `_stateMachine` as that type. It is not `being`'s `StateMachine`. The parser getter must return the local type — that is what the field actually holds. `Board`'s getter is where it gets widened back to the real `KmtInputStateMachine`, via a cast that is sound because `Board`'s constructor built it with `createKmtInputStateMachine`. The touch parser has no such problem: it already stores a properly typed `TouchInputStateMachine`.
2. The getters must **delegate to the current parser**, not cache what the constructor built — `board.kmtParser` has a public setter, so a cached field would go stale after a swap. Since a custom parser may not implement the optional member, both `Board` getters return `| undefined`; the visualizer's `resolve()` throws on `undefined` in Task 4.

- [ ] **Step 1: Write the failing test**

Create `packages/board/test/boardify/state-machine-getters.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import Board from '../../src/boardify';
import { VanillaKMTEventParser } from '../../src/input-interpretation/raw-input-parser';

// Board's CanvasProxy constructs ResizeObserver/IntersectionObserver/MutationObserver
// eagerly. With no canvas they never observe anything, so no-op stubs suffice to let
// Board instantiate in a DOM-free test runner.
class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
        return [];
    }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
globalThis.MutationObserver ??=
    NoopObserver as unknown as typeof MutationObserver;

describe('Board state machine getters', () => {
    it('exposes the kmt input state machine the parser holds', () => {
        const board = new Board();
        expect(board.kmtInputStateMachine).toBeDefined();
        expect(board.kmtInputStateMachine).toBe(board.kmtParser.stateMachine);
    });

    it('exposes the touch input state machine the parser holds', () => {
        const board = new Board();
        expect(board.touchInputStateMachine).toBeDefined();
        expect(board.touchInputStateMachine).toBe(
            board.touchParser.stateMachine
        );
    });

    it('the kmt machine starts in IDLE and responds to spacebarDown', () => {
        const board = new Board();
        const machine = board.kmtInputStateMachine!;
        expect(machine.currentState).toBe('IDLE');
        machine.happens('spacebarDown');
        expect(machine.currentState).toBe('READY_TO_PAN_VIA_SPACEBAR');
    });

    it('follows a swapped parser rather than caching the original machine', () => {
        const board = new Board();
        const original = board.kmtInputStateMachine;
        const replacement = { happens: () => ({ handled: false as const }) };
        // The parser's addEventListeners returns early when it has no canvas,
        // so the setter's tearDown/setUp cycle is safe in a DOM-free runner.
        board.kmtParser = new VanillaKMTEventParser(
            replacement,
            board.inputOrchestrator
        );
        expect(board.kmtInputStateMachine).not.toBe(original);
        expect(board.kmtInputStateMachine).toBe(replacement);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test board`
Expected: FAIL — `board.kmtInputStateMachine` is `undefined` and `board.kmtParser.stateMachine` does not exist (TypeScript will also error on both property accesses).

- [ ] **Step 3: Add the parser getters**

In `vanilla-kmt-event-parser.ts`, add to the `KMTEventParser` interface (after the `enable(): void;` line):

```typescript
    /**
     * The state machine this parser dispatches into, when the implementation
     * exposes one. Optional so existing external parser implementations
     * remain valid. Intended for tooling/introspection — dispatch through
     * the parser, not through this reference.
     */
    readonly stateMachine?: StateMachine;
```

In `VanillaKMTEventParser`, add a getter immediately above the existing `set stateMachine` (~line 386), so the orphaned setter finally has a pair:

```typescript
    get stateMachine(): StateMachine {
        return this._stateMachine;
    }

```

In `vanilla-touch-event-parser.ts`, add to the `TouchEventParser` interface (after `enable(): void;`):

```typescript
    /**
     * The state machine this parser dispatches into, when the implementation
     * exposes one. Optional so existing external parser implementations
     * remain valid. Intended for tooling/introspection — dispatch through
     * the parser, not through this reference.
     */
    readonly stateMachine?: TouchInputStateMachine;
```

And add the getter to `VanillaTouchEventParser`, beside the existing `get orchestrator()`:

```typescript
    get stateMachine(): TouchInputStateMachine {
        return this._stateMachine;
    }
```

- [ ] **Step 4: Add the Board getters**

In `packages/board/src/boardify/index.ts`, add immediately after `get kmtParser(): KMTEventParser { ... }` (~line 587-589):

```typescript
    /**
     * The keyboard/mouse/trackpad input state machine currently driving the
     * board, read from the active parser so it stays correct after a
     * {@link kmtParser} swap.
     *
     * @returns The machine, or `undefined` when a custom parser does not
     * expose one.
     *
     * @remarks
     * Intended for tooling/introspection — a visualizer reading
     * `currentState` and `context`, for instance. Drive the board through
     * real input or through the parser, not by dispatching here, and never
     * call `wrapup()` on it: that parks the machine in `TERMINAL` and the
     * board stops responding to all input.
     */
    get kmtInputStateMachine(): KmtInputStateMachine | undefined {
        return this._kmtParser.stateMachine as KmtInputStateMachine | undefined;
    }

    /**
     * The touch input state machine currently driving the board, read from
     * the active parser so it stays correct after a {@link touchParser} swap.
     *
     * @returns The machine, or `undefined` when a custom parser does not
     * expose one.
     *
     * @remarks
     * Intended for tooling/introspection. See {@link kmtInputStateMachine}
     * for the same caveats.
     */
    get touchInputStateMachine(): TouchInputStateMachine | undefined {
        return this._touchParser.stateMachine;
    }
```

Add `KmtInputStateMachine` and `TouchInputStateMachine` to the existing type import from `../input-interpretation` at the top of the file (the same import that already brings in `createKmtInputStateMachine` / `createTouchInputStateMachine`, ~lines 25-27).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx nx test board`
Expected: PASS, including the pre-existing `test/boardify/input-mode.test.ts`, `test/board-camera/` and `test/util/`.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add packages/board/src packages/board/test
git commit -m "$(cat <<'EOF'
feat(board): expose the live kmt and touch input state machines

Adds a read-only stateMachine getter to VanillaKMTEventParser (pairing the
setter that had none) and to VanillaTouchEventParser, plus optional
stateMachine members on the KMTEventParser and TouchEventParser interfaces
so external parser implementations stay valid.

Board gains kmtInputStateMachine and touchInputStateMachine, which delegate
to the active parser rather than caching what the constructor built, so they
stay correct after a parser swap. Both return undefined when a custom parser
exposes no machine. Intended for tooling/introspection, e.g. a visualizer
observing the board's real input machines.
EOF
)"
```

---

### Task 3: Reshape the registry to a discriminated source

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/registry.ts` (whole file)
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (`selectMachine` ~line 210-231)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type MachineSource = { kind: 'simulated'; create(): StateMachine<any, any, any, any> } | { kind: 'live'; resolve(board: Board): StateMachine<any, any, any, any> }`
  - `export type RegistryEntry = { id: string; label: string; samplePayloads: Record<string, unknown>; source: MachineSource }`

**This task is a pure refactor.** Every entry stays `simulated` and the page must behave identically when you are done. Flipping entries to `live` is Task 4. Keeping these separate means a reviewer can reject the wiring without rejecting the reshape.

**Why the reshape:** `samplePayloads` is currently returned from inside each `create()`, which means it is rebuilt on every machine selection for no reason and is tangled with construction. Hoisting it to the entry lets `create()`/`resolve()` return just a machine, and lets `main.ts` read payloads without constructing anything.

- [ ] **Step 1: Rewrite the registry types and entries**

Replace the top of `registry.ts` (the imports and the `RegistryEntry` type) with:

```typescript
import { StateMachine, createVendingMachine } from '@ue-too/being';
import Board from '@ue-too/board';

import { createAccountDemoMachine } from './account-demo';

/**
 * Where a registry entry's machine comes from.
 *
 * - `simulated` constructs a fresh machine the page owns outright.
 * - `live` borrows a machine already running inside the page's viewport
 *   Board, so real input drives it. A live machine must never be
 *   `wrapup()`-ed by the page: that parks it in TERMINAL and the real board
 *   stops responding to input.
 */
export type MachineSource =
    | { kind: 'simulated'; create(): StateMachine<any, any, any, any> }
    | {
          kind: 'live';
          resolve(board: Board): StateMachine<any, any, any, any>;
      };

export type RegistryEntry = {
    id: string;
    label: string;
    samplePayloads: Record<string, unknown>;
    source: MachineSource;
};
```

Then rewrite the entries. The vending and account entries keep the existing cast comment, which still applies:

```typescript
export const registry: RegistryEntry[] = [
    {
        id: 'vending-machine',
        label: 'Vending machine (being example)',
        samplePayloads: {},
        source: {
            kind: 'simulated',
            // Concrete machines with literal-union States aren't
            // structurally assignable to StateMachine<any, any, any, any>:
            // State['states']'s conditional `string extends States ? string
            // : States` plus method variance defeats `any`-erasure. Confine
            // the cast to this registry boundary rather than loosening
            // `@ue-too/being`'s interfaces.
            create: () =>
                createVendingMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'account-demo',
        label: 'Bank account (preconditions demo)',
        samplePayloads: {
            withdraw: { amount: 60 },
            deposit: { amount: 50 },
        },
        source: {
            kind: 'simulated',
            create: () =>
                createAccountDemoMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
];
```

Then port the five existing board entries into the same shape — `samplePayloads` hoisted out of `create()`, the machine construction moved under `source: { kind: 'simulated', create: ... }`, keeping their current stub contexts (`new DummyKmtInputContext()`, `new TouchInputTracker(new DummyCanvas())`, and the three no-argument camera factories) and their existing imports from `@ue-too/board` for now. Task 4 deletes all of that.

- [ ] **Step 2: Update `selectMachine` to the new shape**

In `main.ts`, replace the body of `selectMachine` (~line 210-231) with:

```typescript
function createMachineFor(
    entry: RegistryEntry
): StateMachine<any, any, any, any> {
    return entry.source.kind === 'simulated'
        ? entry.source.create()
        : entry.source.resolve(board);
}

function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        machine.wrapup();
        machine = null;
        layout = null;
        eventRowsEl.textContent = '';
    }
    panelErrorEl.textContent = '';
    try {
        machine = createMachineFor(entry);
        layout = layoutGraph(extractMachineGraph(machine), measureText);
        flash = null;
        buildEventRows(entry.samplePayloads);
        eventLogEl.textContent = '';
        appendLog(`loaded ${entry.label}`);
    } catch (error) {
        layout = null;
        eventRowsEl.textContent = '';
        panelErrorEl.textContent = `Failed to create "${entry.label}": ${String(error)}`;
    }
}
```

Note `createMachineFor` already handles `live`, so Task 4 needs no change here.

- [ ] **Step 3: Verify the page is unchanged**

Run: `bun run dev:examples` and open the state machine visualizer page.
Expected: identical to before. All seven entries load, current state highlights, fire buttons work with their sample payloads pre-filled, reset works, log entries appear. Nothing is live yet.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add apps/examples/src/state-machine-visualizer/registry.ts apps/examples/src/state-machine-visualizer/main.ts
git commit -m "$(cat <<'EOF'
refactor(examples): split the visualizer registry into a machine source

Replaces RegistryEntry.create() with a discriminated MachineSource that is
either simulated (the page constructs the machine) or live (the page borrows
one from a running Board), and hoists samplePayloads onto the entry, where it
was previously rebuilt inside every create() call.

Pure refactor: every entry is still simulated and the page behaves
identically. Flipping the board entries to live follows.
EOF
)"
```

---

### Task 4: Flip the board entries to live, and fix the `wrapup` hazard

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/registry.ts` (the five board entries and the imports)
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (`selectMachine`, plus a new module-level `currentEntry`)

**Interfaces:**
- Consumes: `Board.kmtInputStateMachine` / `Board.touchInputStateMachine` from Task 2; `MachineSource` / `RegistryEntry` from Task 3.
- Produces: nothing new; five registry entries change `source.kind` from `'simulated'` to `'live'`.

- [ ] **Step 1: Point the five board entries at the live board**

In `registry.ts`, replace the `@ue-too/board` import with:

```typescript
import Board, { CameraMuxWithAnimationAndLock } from '@ue-too/board';
```

`DummyCanvas`, `DummyKmtInputContext`, `TouchInputTracker`, `createKmtInputStateMachine`, `createTouchInputStateMachine`, `createDefaultPanControlStateMachine`, `createDefaultZoomControlStateMachine` and `createDefaultRotateControlStateMachine` are all no longer used — remove them. The long comment at the touch entry explaining how the touch context was stubbed goes too; there is nothing left to stub.

Add this helper above `registry`:

```typescript
/**
 * The board's camera-control machines live on the mux. Board types
 * `cameraMux` as the CameraMux interface, which does not declare the three
 * machine getters, so narrow to the concrete class the default Board builds.
 */
function cameraMuxOf(board: Board): CameraMuxWithAnimationAndLock {
    const mux = board.cameraMux;
    if (!(mux instanceof CameraMuxWithAnimationAndLock)) {
        throw new Error(
            'This board uses a custom CameraMux that does not expose camera control state machines.'
        );
    }
    return mux;
}
```

Then replace the five board entries' `source` blocks (leaving each entry's `id`, `label` and `samplePayloads` untouched):

```typescript
    {
        id: 'kmt-input',
        label: 'Board: keyboard/mouse input (live)',
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
        source: {
            kind: 'live',
            resolve: board => {
                const machine = board.kmtInputStateMachine;
                if (machine === undefined) {
                    throw new Error(
                        'This board’s KMT parser does not expose a state machine.'
                    );
                }
                return machine as unknown as StateMachine<any, any, any, any>;
            },
        },
    },
```

The `touch-input` entry follows the identical shape with `board.touchInputStateMachine` and the message `'This board’s touch parser does not expose a state machine.'`, keeping its existing three sample payloads.

The three camera entries take their machine off the mux:

```typescript
    {
        id: 'pan-control',
        label: 'Board: pan control (live)',
        samplePayloads: {},
        source: {
            kind: 'live',
            resolve: board =>
                cameraMuxOf(board).panStateMachine as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
```

`zoom-control` uses `zoomStateMachine`, `rotation-control` uses `rotateStateMachine`; both otherwise identical, with labels `'Board: zoom control (live)'` and `'Board: rotation control (live)'`.

- [ ] **Step 2: Stop wrapping up live machines**

In `main.ts`, add beside the existing `let machine` declaration (~line 22):

```typescript
let currentEntry: RegistryEntry | null = null;
```

Then in `selectMachine`, replace the teardown block and record the entry:

```typescript
function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        // Never wrap up a live machine: wrapup() parks it in TERMINAL, after
        // which happens() returns early forever and the real board stops
        // responding to all input.
        if (currentEntry?.source.kind === 'simulated') {
            machine.wrapup();
        }
        machine = null;
        layout = null;
        eventRowsEl.textContent = '';
    }
    currentEntry = entry;
    panelErrorEl.textContent = '';
    try {
        machine = createMachineFor(entry);
        layout = layoutGraph(extractMachineGraph(machine), measureText);
        flash = null;
        buildEventRows(entry.samplePayloads);
        eventLogEl.textContent = '';
        appendLog(`loaded ${entry.label}`);
    } catch (error) {
        layout = null;
        eventRowsEl.textContent = '';
        panelErrorEl.textContent = `Failed to create "${entry.label}": ${String(error)}`;
    }
}
```

- [ ] **Step 3: Verify manually**

Run: `bun run dev:examples`, open the visualizer, select **Board: keyboard/mouse input (live)**.
Expected:
- Click the diagram canvas once so focus leaves the dropdown, then hold spacebar: the highlight moves `IDLE → READY_TO_PAN_VIA_SPACEBAR` and the canvas cursor becomes a grab hand.
- Still holding spacebar, press and drag with the left button: `INITIAL_PAN`, then `PAN`, and the diagram pans under you.
- Release: back to `IDLE`.
- Select **Board: pan control (live)**, drag the canvas: the state stays `ACCEPTING_USER_INPUT` (it only leaves for programmatic animations) — the log flooding this produces is expected and is fixed in Task 5.
- Switch to the vending machine and back to a live entry: the board still responds to input. This is the `wrapup` fix; before it, the board would be dead.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add apps/examples/src/state-machine-visualizer/registry.ts apps/examples/src/state-machine-visualizer/main.ts
git commit -m "$(cat <<'EOF'
feat(examples): point the visualizer's board entries at the live board

The five board entries now borrow the machines running inside the page's own
viewport Board instead of constructing fresh ones against stub contexts, so
holding spacebar over the diagram fires a real spacebarDown on the real
machine and lights up READY_TO_PAN_VIA_SPACEBAR on the chart you are panning.
All stub-context construction is gone.

selectMachine no longer calls wrapup() when switching away from a live entry:
that would park the board's machine in TERMINAL and kill its input handling
permanently.
EOF
)"
```

---

### Task 5: Move logging and flashing onto the subscription, with coalescing

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (`appendLog` ~line 105-112; `fireEvent` ~line 130-172; `selectMachine`; the reset handler ~line 246-252)

**Interfaces:**
- Consumes: `StateMachine.onEventResult` from Task 1.
- Produces: nothing exported.

**Why:** `fireEvent` is currently the only place that logs and flashes, so a canvas-driven transition is invisible. Moving both onto an `onEventResult` subscription means hand-fired and real events travel one identical path — and it is a net deletion from `fireEvent`, not extra code. The disposers from Task 1 earn their keep here: live board machines outlive the page's selection, so re-selecting an entry without disposing would stack duplicate listeners forever.

**The volume problem:** `pointerMove` and `leftPointerMove` fire at ~60Hz while you drag. Unmodified, `appendLog` would create 60 `<li>` per second and evict the entire 200-entry log in about three seconds. Consecutive identical results coalesce into one line with a `×N` counter instead.

- [ ] **Step 1: Add coalescing to `appendLog`**

Replace `appendLog` and add the tracking variable above it:

```typescript
let lastLogEntry: { key: string; count: number; li: HTMLLIElement } | null =
    null;

/**
 * Appends a log line. When `key` matches the previous line's key, the
 * existing line is updated with a ×N counter instead of a new one being
 * added — without this, a live board machine's ~60Hz pointerMove stream
 * evicts the whole log in about three seconds of panning.
 */
function appendLog(text: string, key?: string): void {
    if (key !== undefined && lastLogEntry !== null && lastLogEntry.key === key) {
        lastLogEntry.count += 1;
        lastLogEntry.li.textContent = `${text} ×${lastLogEntry.count}`;
        return;
    }
    const li = document.createElement('li');
    li.textContent = text;
    eventLogEl.prepend(li);
    lastLogEntry = key === undefined ? null : { key, count: 1, li };
    while (eventLogEl.children.length > MAX_LOG_ENTRIES) {
        eventLogEl.lastChild!.remove();
    }
}

function clearLog(): void {
    eventLogEl.textContent = '';
    lastLogEntry = null;
}
```

Calls without a `key` (`loaded ...`, `machine reset`) never coalesce and reset the run, which is what you want — a notice should break the run rather than be absorbed into it.

In `selectMachine`, replace `eventLogEl.textContent = '';` with `clearLog();`.

- [ ] **Step 2: Add the subscription and strip `fireEvent`**

Add above `selectMachine`:

```typescript
let subscriptions: (() => void)[] = [];

function disposeSubscriptions(): void {
    for (const dispose of subscriptions) {
        dispose();
    }
    subscriptions = [];
}

/**
 * Logs and flashes every event the machine handles, whoever fired it — a
 * ⚡ button in this panel or genuine input on the canvas. Runs after the
 * state has handled the event but before the transition, so
 * `machine.currentState` is still the source state.
 */
function subscribeToMachine(target: StateMachine<any, any, any, any>): void {
    const dispose = target.onEventResult?.((args, result) => {
        const event = String(args[0]);
        const payloadText =
            args[1] === undefined ? '' : ` ${JSON.stringify(args[1])}`;
        const before = String(target.currentState);
        if (!result.handled) {
            appendLog(
                `${event}${payloadText} → not handled`,
                `${event}|${before}|unhandled`
            );
            return;
        }
        const after =
            result.nextState === undefined ? before : String(result.nextState);
        if (after === before) {
            appendLog(
                `${event}${payloadText} → handled, no transition`,
                `${event}|${before}|noop`
            );
        } else {
            appendLog(
                `${event}${payloadText} → ${before} ➜ ${after}`,
                `${event}|${before}|${after}`
            );
        }
        const edgeIndex = findTakenEdgeIndex(before, event, after);
        if (edgeIndex !== -1) {
            flash = { edgeIndex, at: performance.now() };
        }
    });
    // The interface declares the return as `void | (() => void)` so external
    // implementations stay valid, and TypeScript will not narrow a `void`
    // union by truthiness — check for a function explicitly.
    if (typeof dispose === 'function') {
        subscriptions.push(dispose);
    }
}
```

In `selectMachine`, call `disposeSubscriptions()` in the teardown block (beside the `wrapup` check) and `subscribeToMachine(machine)` immediately after `machine = createMachineFor(entry);`.

Then strip `fireEvent` down — it keeps only payload parsing and error reporting, since logging and flashing now happen in the subscription:

```typescript
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
    try {
        (machine.happens as any)(event, payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorEl.textContent = `Action threw: ${message}`;
        appendLog(`${event} ${payloadText} → action threw: ${message}`);
    }
}
```

The local `before`, `result` and `findTakenEdgeIndex` call all leave `fireEvent`. `findTakenEdgeIndex` itself stays where it is — the subscription calls it now.

- [ ] **Step 3: Verify manually**

Run: `bun run dev:examples`, select **Board: keyboard/mouse input (live)**.
Expected:
- Hold spacebar and drag: the log shows `spacebarDown → IDLE ➜ READY_TO_PAN_VIA_SPACEBAR`, then `leftPointerDown ... ➜ INITIAL_PAN`, then a single coalescing `leftPointerMove ... → handled, no transition ×N` line whose counter climbs as you drag, rather than hundreds of lines.
- Edges flash on canvas-driven transitions, not just hand-fired ones.
- Fire `spacebarDown` from the ⚡ button: it logs and flashes identically, and the real canvas cursor changes to a grab hand.
- Select the bank account demo and fire `withdraw` with `{"amount": 60}` twice: the second logs `not handled` (the `hasFunds` precondition veto), distinct from `handled, no transition`.
- Switch entries back and forth several times, then fire one event: exactly one log line appears, not one per visit. This is the disposer working.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add apps/examples/src/state-machine-visualizer/main.ts
git commit -m "$(cat <<'EOF'
feat(examples): log and flash live transitions via onEventResult

Logging and edge-flashing move out of fireEvent and onto an onEventResult
subscription taken on select and disposed on switch, so canvas-driven and
hand-fired events travel one identical path and a real spacebar press now
lights up the chart. Disposing on switch matters because live board machines
outlive the page's selection — without it, re-selecting an entry would stack
duplicate listeners.

The log coalesces consecutive identical results into a single ×N line.
A live board machine emits pointerMove at ~60Hz while dragging, which would
otherwise evict the entire 200-entry log in about three seconds.
EOF
)"
```

---

### Task 6: LIVE badge, focus hint, and final verification

**Files:**
- Modify: `apps/examples/src/state-machine-visualizer/index.html` (style block ~line 43-46; sidebar markup ~line 113)
- Modify: `apps/examples/src/state-machine-visualizer/main.ts` (element lookups ~line 12-20; `selectMachine`)

**Interfaces:**
- Consumes: `RegistryEntry.source.kind` from Task 3.
- Produces: nothing exported.

**Why the hint:** `VanillaKMTEventParser` attaches keydown to `window` and bails when `e.target !== document.body` (`vanilla-kmt-event-parser.ts:341`). That guard exists so the board does not hijack real typing, and it is correct — but it means spacebar does nothing while the caret is in a payload textarea. Users will hit this immediately, so the page says so rather than board changing its guard.

- [ ] **Step 1: Add the markup and styles**

In `index.html`, add after the `#current-state` div (~line 113):

```html
                <div id="live-badge" hidden>
                    ● LIVE — this machine is running the board behind this
                    canvas
                </div>
                <div id="focus-hint" hidden>
                    Click the canvas first: spacebar only reaches the board
                    when focus is outside a text field.
                </div>
```

And add to the style block, after the `#current-state` rule:

```css
            #live-badge {
                color: #15803d;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            #focus-hint {
                color: #64748b;
                font-size: 12px;
                margin-bottom: 12px;
            }
```

- [ ] **Step 2: Toggle them per entry**

In `main.ts`, add to the element lookups near the top:

```typescript
const liveBadgeEl = document.getElementById('live-badge')!;
const focusHintEl = document.getElementById('focus-hint')!;
```

And in `selectMachine`, right after `currentEntry = entry;`:

```typescript
    const isLive = entry.source.kind === 'live';
    liveBadgeEl.hidden = !isLive;
    focusHintEl.hidden = !isLive;
```

- [ ] **Step 3: Full verification pass**

```bash
bun run format:check
bunx nx test being
bunx nx test board
bun run build
```
Expected: all clean. `bun run build` catches any type error in the published packages that the test runs did not.

Then `bun run dev:examples` for a final manual pass over every entry:
- Both simulated entries (vending, account) behave exactly as before, with no LIVE badge.
- All five live entries show the badge and hint.
- The spacebar walkthrough works: `IDLE → READY_TO_PAN_VIA_SPACEBAR → INITIAL_PAN → PAN → IDLE`.
- Scroll-wheel over the canvas moves the kmt machine and the affordance dimming updates as the current state changes.
- The Context panel shows the live `ObservableInputTracker` fields changing as you drag.
- Touch input entry loads without error (it will simply stay idle on a device with no touchscreen).
- Reset on a live entry returns it to `IDLE` and the board still responds afterwards.

- [ ] **Step 4: Commit**

```bash
git add apps/examples/src/state-machine-visualizer/index.html apps/examples/src/state-machine-visualizer/main.ts
git commit -m "$(cat <<'EOF'
feat(examples): mark live machines in the visualizer panel

Adds a LIVE badge for the five board entries and a hint that spacebar only
reaches the board when focus is outside a text field — the KMT parser's
window-scoped keydown handler bails on any target that is not document.body,
which users hit immediately after typing in a payload editor.
EOF
)"
```

---

## Notes for the reviewer

- **Nothing here is breaking.** Task 1 adds an optional interface member and widens two return types; Task 2 adds optional interface members and new getters. If any commit ends up labeled `feat(...)!`, that is a mistake — all packages version in lockstep and the bump is inferred from these messages.
- **The `wrapup` fix in Task 4 Step 2 is the highest-risk line in the plan.** Getting it wrong does not throw; the board simply stops responding to input after you switch entries once, which is easy to miss in review and obvious in the manual check.
- **Task 3 must not change behaviour.** If the page behaves differently after Task 3, something in the reshape is wrong; do not paper over it in Task 4.
