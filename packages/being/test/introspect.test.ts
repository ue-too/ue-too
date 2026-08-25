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
