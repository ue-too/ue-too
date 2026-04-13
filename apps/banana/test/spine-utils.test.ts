import { describe, expect, it } from 'bun:test';
import { BCurve } from '@ue-too/curve';
import { validateSpine, sampleSpineEdge, computeAnchorPoint } from '../src/stations/spine-utils';
import type { SpineEntry } from '../src/stations/track-aligned-platform-types';

// ---------------------------------------------------------------------------
// Test graph helpers
// ---------------------------------------------------------------------------

/**
 * Linear graph: joints 0 → 1 → 2, segments 0 (j0-j1) and 1 (j1-j2).
 * Joint 1 has exactly 2 connections — non-branching.
 */
function makeLinearGraph() {
    const segments = new Map([
        [0, { t0Joint: 0, t1Joint: 1 }],
        [1, { t0Joint: 1, t1Joint: 2 }],
    ]);

    const joints = new Map([
        [
            0,
            {
                connections: new Map([[1, 0]]),
            },
        ],
        [
            1,
            {
                connections: new Map([
                    [0, 0],
                    [2, 1],
                ]),
            },
        ],
        [
            2,
            {
                connections: new Map([[1, 1]]),
            },
        ],
    ]);

    return { segments, joints };
}

/**
 * Branching graph: joints 0 → 1 → 2 and 1 → 3.
 * Joint 1 has 3 connections — branching (turnout).
 */
function makeBranchingGraph() {
    const segments = new Map([
        [0, { t0Joint: 0, t1Joint: 1 }],
        [1, { t0Joint: 1, t1Joint: 2 }],
        [2, { t0Joint: 1, t1Joint: 3 }],
    ]);

    const joints = new Map([
        [
            0,
            {
                connections: new Map([[1, 0]]),
            },
        ],
        [
            1,
            {
                connections: new Map([
                    [0, 0],
                    [2, 1],
                    [3, 2],
                ]),
            },
        ],
        [
            2,
            {
                connections: new Map([[1, 1]]),
            },
        ],
        [
            3,
            {
                connections: new Map([[1, 2]]),
            },
        ],
    ]);

    return { segments, joints };
}

// ---------------------------------------------------------------------------
// Straight track curves (horizontal, going right)
//   segment 0: x=0..10, y=0
//   segment 1: x=10..20, y=0
// ---------------------------------------------------------------------------

function makeStraightCurves() {
    const curve0 = new BCurve([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
    ]);
    const curve1 = new BCurve([
        { x: 10, y: 0 },
        { x: 15, y: 0 },
        { x: 20, y: 0 },
    ]);
    return new Map([
        [0, curve0],
        [1, curve1],
    ]);
}

// ---------------------------------------------------------------------------
// validateSpine
// ---------------------------------------------------------------------------

describe('validateSpine', () => {
    const { segments, joints } = makeLinearGraph();
    const { segments: branchSegments, joints: branchJoints } = makeBranchingGraph();

    const getSegment = (id: number) => segments.get(id)!;
    const getJoint = (id: number) => joints.get(id)!;

    it('accepts a single-segment spine', () => {
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }];
        const result = validateSpine(spine, getSegment, getJoint);
        expect(result.valid).toBe(true);
    });

    it('accepts multi-segment spine through non-branching joint', () => {
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 1, tStart: 0, tEnd: 1, side: 1 },
        ];
        const result = validateSpine(spine, getSegment, getJoint);
        expect(result.valid).toBe(true);
    });

    it('rejects multi-segment spine through branching joint', () => {
        const getBranchSeg = (id: number) => branchSegments.get(id)!;
        const getBranchJoint = (id: number) => branchJoints.get(id)!;
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 1, tStart: 0, tEnd: 1, side: 1 },
        ];
        const result = validateSpine(spine, getBranchSeg, getBranchJoint);
        expect(result.valid).toBe(false);
        expect((result as { valid: false; error: string }).error).toBeTruthy();
    });

    it('rejects empty spine', () => {
        const result = validateSpine([], getSegment, getJoint);
        expect(result.valid).toBe(false);
        expect((result as { valid: false; error: string }).error).toBeTruthy();
    });

    it('rejects spine with non-adjacent segments (no shared joint)', () => {
        // segment 0 is j0-j1, segment 1 is j1-j2.
        // Fake segment 99 that doesn't share a joint with segment 0.
        const fakeSegments = new Map([
            ...segments,
            [99, { t0Joint: 5, t1Joint: 6 }],
        ]);
        const getFakeSeg = (id: number) => fakeSegments.get(id)!;
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 99, tStart: 0, tEnd: 1, side: 1 },
        ];
        const result = validateSpine(spine, getFakeSeg, getJoint);
        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// sampleSpineEdge
// ---------------------------------------------------------------------------

describe('sampleSpineEdge', () => {
    const curves = makeStraightCurves();
    const getCurve = (id: number) => curves.get(id)!;

    it('samples a single straight segment with positive offset', () => {
        // Straight track going right (tangent = +x), normal (left of tangent) = +y
        // With side=1 and offset=2, points should be at y=2
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }];
        const points = sampleSpineEdge(spine, 2, getCurve);

        expect(points.length).toBeGreaterThan(1);
        for (const pt of points) {
            expect(pt.y).toBeCloseTo(2, 5);
        }
    });

    it('samples a single straight segment with negative offset (right side)', () => {
        // side=-1 flips normal to -y, so offset=2 yields y=-2
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: -1 }];
        const points = sampleSpineEdge(spine, 2, getCurve);

        expect(points.length).toBeGreaterThan(1);
        for (const pt of points) {
            expect(pt.y).toBeCloseTo(-2, 5);
        }
    });

    it('x-coordinates span from tStart to tEnd along curve', () => {
        // Full segment 0: x should go from 0 to 10
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }];
        const points = sampleSpineEdge(spine, 0, getCurve);

        expect(points[0].x).toBeCloseTo(0, 5);
        expect(points[points.length - 1].x).toBeCloseTo(10, 5);
    });

    it('samples multi-segment spine continuously', () => {
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 1, tStart: 0, tEnd: 1, side: 1 },
        ];
        const points = sampleSpineEdge(spine, 2, getCurve);

        // Should start near x=0 and end near x=20
        expect(points[0].x).toBeCloseTo(0, 5);
        expect(points[points.length - 1].x).toBeCloseTo(20, 5);
        // All y should be ~2
        for (const pt of points) {
            expect(pt.y).toBeCloseTo(2, 5);
        }
    });

    it('respects custom stepsPerSegment', () => {
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }];
        const points3 = sampleSpineEdge(spine, 0, getCurve, 3);
        // 3 steps → 3+1 = 4 points
        expect(points3.length).toBe(4);

        const points5 = sampleSpineEdge(spine, 0, getCurve, 5);
        expect(points5.length).toBe(6);
    });
});

// ---------------------------------------------------------------------------
// computeAnchorPoint
// ---------------------------------------------------------------------------

describe('computeAnchorPoint', () => {
    const curves = makeStraightCurves();
    const getCurve = (id: number) => curves.get(id)!;

    it('computes offset point at start of spine entry (tStart)', () => {
        const entry: SpineEntry = { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 };
        // At t=0, point is (0,0), tangent is +x, normal is +y
        const pt = computeAnchorPoint(entry, 'start', 3, getCurve);
        expect(pt.x).toBeCloseTo(0, 5);
        expect(pt.y).toBeCloseTo(3, 5);
    });

    it('computes offset point at end of spine entry (tEnd)', () => {
        const entry: SpineEntry = { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 };
        // At t=1, point is (10,0), tangent is +x, normal is +y
        const pt = computeAnchorPoint(entry, 'end', 3, getCurve);
        expect(pt.x).toBeCloseTo(10, 5);
        expect(pt.y).toBeCloseTo(3, 5);
    });

    it('flips offset for side=-1', () => {
        const entry: SpineEntry = { trackSegment: 0, tStart: 0, tEnd: 1, side: -1 };
        const pt = computeAnchorPoint(entry, 'start', 3, getCurve);
        expect(pt.x).toBeCloseTo(0, 5);
        expect(pt.y).toBeCloseTo(-3, 5);
    });

    it('computes anchor at a mid-segment t-value', () => {
        // At t=0.5 on segment 0, x should be ~5 (midpoint of 0..10)
        const entry: SpineEntry = { trackSegment: 0, tStart: 0.5, tEnd: 1, side: 1 };
        const pt = computeAnchorPoint(entry, 'start', 2, getCurve);
        expect(pt.x).toBeCloseTo(5, 0);
        expect(pt.y).toBeCloseTo(2, 5);
    });

    it('computes anchor at segment boundary (t=1)', () => {
        const entry: SpineEntry = { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 };
        const pt = computeAnchorPoint(entry, 'end', 2, getCurve);
        expect(pt.x).toBeCloseTo(10, 5);
        expect(pt.y).toBeCloseTo(2, 5);
    });

    it('returns raw curve point when offset is zero', () => {
        const entry: SpineEntry = { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 };
        const pt = computeAnchorPoint(entry, 'start', 0, getCurve);
        expect(pt.x).toBeCloseTo(0, 5);
        expect(pt.y).toBeCloseTo(0, 5);
    });
});

// ---------------------------------------------------------------------------
// sampleSpineEdge — partial t-ranges
// ---------------------------------------------------------------------------

describe('sampleSpineEdge — partial t-ranges', () => {
    const curves = makeStraightCurves();
    const getCurve = (id: number) => curves.get(id)!;

    it('samples a partial segment (tStart=0.2, tEnd=0.8)', () => {
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0.2, tEnd: 0.8, side: 1 }];
        const points = sampleSpineEdge(spine, 0, getCurve, 3);
        // 3 steps + 1 = 4 points
        expect(points).toHaveLength(4);
        // x should range from ~2 to ~8 (20% to 80% of 0..10)
        expect(points[0].x).toBeCloseTo(2, 0);
        expect(points[points.length - 1].x).toBeCloseTo(8, 0);
    });

    it('handles a reversed t-range (tStart > tEnd)', () => {
        // Walking the segment in reverse
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 1, tEnd: 0, side: 1 }];
        const points = sampleSpineEdge(spine, 0, getCurve, 3);
        // x should go from 10 down to 0
        expect(points[0].x).toBeCloseTo(10, 0);
        expect(points[points.length - 1].x).toBeCloseTo(0, 0);
    });
});

// ---------------------------------------------------------------------------
// sampleSpineEdge — curved track
// ---------------------------------------------------------------------------

describe('sampleSpineEdge — curved track', () => {
    it('offsets perpendicular to a quarter-circle arc', () => {
        // Quarter circle from (10,0) through (10,10) to (0,10) — 3-point quadratic Bézier
        const curve = new BCurve([
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ]);
        const getCurve = () => curve;

        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0, tEnd: 1, side: 1 }];
        const offset = 2;
        const points = sampleSpineEdge(spine, offset, getCurve, 10);

        // Each point should be approximately `offset` distance from its corresponding
        // on-curve point. Verify at endpoints where we know the normal direction.
        // At t=0, tangent ≈ (0,1), normal (side=1) ≈ (-1,0), so offset point ≈ (8,0)
        expect(points[0].x).toBeCloseTo(8, 0);
        expect(points[0].y).toBeCloseTo(0, 0);

        // At t=1, tangent ≈ (-1,0), normal (side=1) ≈ (0,-1), so offset point ≈ (0,8)
        const last = points[points.length - 1];
        expect(last.x).toBeCloseTo(0, 0);
        expect(last.y).toBeCloseTo(8, 0);
    });
});

// ---------------------------------------------------------------------------
// validateSpine — additional edge cases
// ---------------------------------------------------------------------------

describe('validateSpine — edge cases', () => {
    it('accepts a spine with three consecutive segments', () => {
        const segments = new Map([
            [0, { t0Joint: 0, t1Joint: 1 }],
            [1, { t0Joint: 1, t1Joint: 2 }],
            [2, { t0Joint: 2, t1Joint: 3 }],
        ]);
        const joints = new Map([
            [0, { connections: new Map([[1, 0]]) }],
            [1, { connections: new Map([[0, 0], [2, 1]]) }],
            [2, { connections: new Map([[1, 1], [3, 2]]) }],
            [3, { connections: new Map([[2, 2]]) }],
        ]);

        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 1, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 2, tStart: 0, tEnd: 1, side: 1 },
        ];
        const result = validateSpine(
            spine,
            (id) => segments.get(id)!,
            (id) => joints.get(id)!,
        );
        expect(result.valid).toBe(true);
    });

    it('rejects when branching occurs at the second joint in a three-segment spine', () => {
        const segments = new Map([
            [0, { t0Joint: 0, t1Joint: 1 }],
            [1, { t0Joint: 1, t1Joint: 2 }],
            [2, { t0Joint: 2, t1Joint: 3 }],
        ]);
        // Joint 2 branches — has 3 connections
        const joints = new Map([
            [0, { connections: new Map([[1, 0]]) }],
            [1, { connections: new Map([[0, 0], [2, 1]]) }],
            [2, { connections: new Map([[1, 1], [3, 2], [4, 3]]) }],
            [3, { connections: new Map([[2, 2]]) }],
        ]);

        const spine: SpineEntry[] = [
            { trackSegment: 1, tStart: 0, tEnd: 1, side: 1 },
            { trackSegment: 2, tStart: 0, tEnd: 1, side: 1 },
        ];
        const result = validateSpine(
            spine,
            (id) => segments.get(id)!,
            (id) => joints.get(id)!,
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.error).toContain('branching');
        }
    });
});
