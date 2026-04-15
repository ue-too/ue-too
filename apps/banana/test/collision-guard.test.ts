import { describe, it, expect, beforeEach } from 'bun:test';
import { CrossingMap } from '../src/trains/collision-guard';

// ---------------------------------------------------------------------------
// CrossingMap tests
// ---------------------------------------------------------------------------

describe('CrossingMap', () => {

    let map: CrossingMap;

    beforeEach(() => {
        map = new CrossingMap();
    });

    describe('addCrossing — bidirectional entries', () => {

        it('creates an entry for A referencing B', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            const crossings = map.getCrossings(1);
            expect(crossings).toHaveLength(1);
            expect(crossings[0]).toMatchObject({ crossingSegment: 2, selfT: 0.3, otherT: 0.7 });
        });

        it('creates a mirrored entry for B referencing A', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            const crossings = map.getCrossings(2);
            expect(crossings).toHaveLength(1);
            expect(crossings[0]).toMatchObject({ crossingSegment: 1, selfT: 0.7, otherT: 0.3 });
        });

        it('accumulates multiple crossings for the same segment', () => {
            map.addCrossing(1, 0.2, 2, 0.5);
            map.addCrossing(1, 0.8, 3, 0.4);
            expect(map.getCrossings(1)).toHaveLength(2);
            expect(map.getCrossings(2)).toHaveLength(1);
            expect(map.getCrossings(3)).toHaveLength(1);
        });
    });

    describe('getCrossings — unknown segment returns empty array', () => {

        it('returns empty array for a segment with no crossings', () => {
            expect(map.getCrossings(99)).toHaveLength(0);
        });

        it('returns empty readonly array (not undefined)', () => {
            const result = map.getCrossings(42);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });
    });

    describe('removeSegment — cleans up both sides', () => {

        it('removes the segment itself', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            map.removeSegment(1);
            expect(map.getCrossings(1)).toHaveLength(0);
        });

        it('removes back-references from partner segments', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            map.removeSegment(1);
            // Segment 2's crossing that referenced segment 1 should be gone
            expect(map.getCrossings(2)).toHaveLength(0);
        });

        it('removing one segment does not affect unrelated crossings', () => {
            map.addCrossing(10, 0.1, 20, 0.9);
            map.addCrossing(30, 0.5, 40, 0.5);
            map.removeSegment(10);
            // 30 ↔ 40 should be untouched
            expect(map.getCrossings(30)).toHaveLength(1);
            expect(map.getCrossings(40)).toHaveLength(1);
        });

        it('removing a segment with multiple crossings cleans all partners', () => {
            map.addCrossing(1, 0.2, 2, 0.5);
            map.addCrossing(1, 0.8, 3, 0.4);
            map.removeSegment(1);
            expect(map.getCrossings(1)).toHaveLength(0);
            expect(map.getCrossings(2)).toHaveLength(0);
            expect(map.getCrossings(3)).toHaveLength(0);
        });

        it('removeSegment on unknown segment is a no-op', () => {
            expect(() => map.removeSegment(999)).not.toThrow();
        });
    });
});
