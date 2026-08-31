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
