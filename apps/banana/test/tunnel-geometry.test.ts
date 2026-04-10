import { describe, it, expect } from 'bun:test';
import { BCurve } from '@ue-too/curve';
import { computeTunnelEntranceGeometry } from '../src/trains/tracks/tunnel-geometry';
import type { TrackSegmentDrawData } from '../src/trains/tracks/types';

/** A 100m straight curve along +X. Terrain can be varied along x for crossing tests. */
const makeStraightCurve = () => new BCurve([{ x: 0, y: 0 }, { x: 100, y: 0 }]);

/** Minimal draw data; fields not read by the helper are filled with placeholders. */
const makeDrawData = (elevationFrom: number, elevationTo: number): TrackSegmentDrawData => ({
    curve: makeStraightCurve(),
    originalTrackSegment: {
        trackSegmentNumber: 0,
        startJointPosition: { x: 0, y: 0 },
        endJointPosition: { x: 100, y: 0 },
        tValInterval: { start: 0, end: 1 },
    },
    gauge: 1.435,
    elevation: { from: elevationFrom, to: elevationTo },
    originalElevation: { from: 0, to: 0 },
    excludeSegmentsForCollisionCheck: new Set<number>(),
    bed: false,
});

const flatTerrain = (height: number) => ({ getHeight: () => height });
const xStepTerrain = (threshold: number, loH: number, hiH: number) => ({
    getHeight: (x: number) => (x < threshold ? loH : hiH),
});
const bandIdx = (rawElevation: number) => Math.floor(rawElevation / 10);

describe('computeTunnelEntranceGeometry', () => {
    it('returns null for a flat track (elevation.from === elevation.to)', () => {
        // Even if the flat track is below terrain, the entrance path must bail out —
        // flat underground tracks are handled by the fully-underground enclosure instead.
        const drawData = makeDrawData(10, 10);
        const result = computeTunnelEntranceGeometry(drawData, flatTerrain(30), bandIdx);
        expect(result).toBeNull();
    });

    it('returns null when both ends are above terrain', () => {
        const drawData = makeDrawData(20, 25);
        const result = computeTunnelEntranceGeometry(drawData, flatTerrain(0), bandIdx);
        expect(result).toBeNull();
    });

    it('returns geometry with coverEnd="end" for a ramp entering underground (above → below)', () => {
        const drawData = makeDrawData(20, 0);
        const result = computeTunnelEntranceGeometry(drawData, flatTerrain(10), bandIdx);
        expect(result).not.toBeNull();
        expect(result!.coverEnd).toBe('end');
        expect(result!.leftInner.length).toBeGreaterThan(0);
        expect(result!.leftOuter.length).toBeGreaterThan(0);
        expect(result!.rightInner.length).toBeGreaterThan(0);
        expect(result!.rightOuter.length).toBeGreaterThan(0);
        expect(result!.coverSteps).toBeGreaterThan(0);
        expect(result!.surfaceBandIndex).toBe(bandIdx(10));
    });

    it('returns geometry with coverEnd="start" for a ramp exiting underground (below → above)', () => {
        const drawData = makeDrawData(0, 20);
        const result = computeTunnelEntranceGeometry(drawData, flatTerrain(10), bandIdx);
        expect(result).not.toBeNull();
        expect(result!.coverEnd).toBe('start');
        expect(result!.leftInner.length).toBeGreaterThan(0);
        expect(result!.rightOuter.length).toBeGreaterThan(0);
    });

    it('returns null for a ramp that is fully underground at both ends (regression: bug fix)', () => {
        // Ramp from elevation 0 to 5, terrain at 30 everywhere.
        // Both ends are well below terrain — this should NOT generate an entrance.
        // Before the fix this returned geometry with coverEnd='both'.
        const drawData = makeDrawData(0, 5);
        const result = computeTunnelEntranceGeometry(drawData, flatTerrain(30), bandIdx);
        expect(result).toBeNull();
    });

    it('handles varying terrain: ramp crossing a step-change terrain from above to below', () => {
        // Terrain: 0m for x<50, 30m for x>=50. Ramp elevation 10 → 15.
        // At start (x=0), terrain=0, track=10 → above (relFrom = 10 >= 0).
        // At end (x=100), terrain=30, track=15 → below (relTo = -15 < 0).
        // This is a legitimate above→below transition and must produce coverEnd='end'.
        const drawData = makeDrawData(10, 15);
        const result = computeTunnelEntranceGeometry(
            drawData,
            xStepTerrain(50, 0, 30),
            bandIdx,
        );
        expect(result).not.toBeNull();
        expect(result!.coverEnd).toBe('end');
    });

    it('treats relFrom === 0 (track exactly on terrain) as above, producing an entrance when the other end dives under', () => {
        // Track at 10 with terrain at 10 at the start → relFrom = 0 (above by >= check).
        // Track at 0 with terrain at 30 at the end → relTo = -30 (below).
        // Expect a legitimate above→below entrance with coverEnd='end'.
        const drawData = makeDrawData(10, 0);
        const result = computeTunnelEntranceGeometry(
            drawData,
            xStepTerrain(50, 10, 30),
            bandIdx,
        );
        expect(result).not.toBeNull();
        expect(result!.coverEnd).toBe('end');
    });

    it('plumbs getElevationBandIndex through and picks the higher terrain surface', () => {
        const drawData = makeDrawData(20, 0);
        const result = computeTunnelEntranceGeometry(
            drawData,
            xStepTerrain(50, 5, 25),
            bandIdx,
        );
        expect(result).not.toBeNull();
        // surfaceBandIndex should come from max(startTerrainH, endTerrainH) = 25.
        expect(result!.surfaceBandIndex).toBe(bandIdx(25));
    });
});
