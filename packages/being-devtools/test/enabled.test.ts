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
