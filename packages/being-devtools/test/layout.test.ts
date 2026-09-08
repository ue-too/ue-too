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
