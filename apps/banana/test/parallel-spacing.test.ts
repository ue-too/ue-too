import { describe, expect, it } from 'bun:test';

import { computeParallelSpacing } from '../src/trains/tracks/parallel-spacing';

describe('computeParallelSpacing', () => {
    it('uses bedWidth when present for both tracks', () => {
        expect(
            computeParallelSpacing(
                { bedWidth: 4, gauge: 1.067 },
                { bedWidth: 4, gauge: 1.067 }
            )
        ).toBe(4);
    });

    it('falls back to gauge when bedWidth is undefined', () => {
        expect(computeParallelSpacing({ gauge: 2 }, { gauge: 2 })).toBe(2);
    });

    it('mixes bedWidth and gauge', () => {
        expect(
            computeParallelSpacing({ bedWidth: 5, gauge: 1 }, { gauge: 3 })
        ).toBe(4);
    });

    it('handles asymmetric bedWidths', () => {
        expect(
            computeParallelSpacing(
                { bedWidth: 6, gauge: 1 },
                { bedWidth: 2, gauge: 1 }
            )
        ).toBe(4);
    });
});
