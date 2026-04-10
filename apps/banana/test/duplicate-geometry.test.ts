import { describe, expect, it } from 'bun:test';

import { computeDuplicateGeometry } from '../src/trains/tracks/duplicate-geometry';

describe('computeDuplicateGeometry', () => {
    it('offsets a straight segment perpendicular to its tangent', () => {
        const res = computeDuplicateGeometry({
            sourceControlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            sourceStartPosition: { x: 0, y: 0 },
            sourceStartTangent: { x: 1, y: 0 },
            sourceEndPosition: { x: 10, y: 0 },
            sourceEndTangent: { x: 1, y: 0 },
            side: 1,
            spacing: 4,
        });
        expect(res.startPosition).toEqual({ x: 0, y: 4 });
        expect(res.endPosition).toEqual({ x: 10, y: 4 });
        expect(res.middleControlPoints).toEqual([]);
    });

    it('flips side with negative sign', () => {
        const res = computeDuplicateGeometry({
            sourceControlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            sourceStartPosition: { x: 0, y: 0 },
            sourceStartTangent: { x: 1, y: 0 },
            sourceEndPosition: { x: 10, y: 0 },
            sourceEndTangent: { x: 1, y: 0 },
            side: -1,
            spacing: 4,
        });
        expect(res.startPosition).toEqual({ x: 0, y: -4 });
        expect(res.endPosition).toEqual({ x: 10, y: -4 });
    });

    it('offsets quadratic middle CP via linear interpolation of endpoint offsets', () => {
        const res = computeDuplicateGeometry({
            sourceControlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            sourceStartPosition: { x: 0, y: 0 },
            sourceStartTangent: { x: 1, y: 0 },
            sourceEndPosition: { x: 10, y: 0 },
            sourceEndTangent: { x: 1, y: 0 },
            side: 1,
            spacing: 4,
        });
        expect(res.middleControlPoints).toHaveLength(1);
        expect(res.middleControlPoints[0]).toEqual({ x: 5, y: 9 });
    });

    it('inherits source tangents unchanged', () => {
        const res = computeDuplicateGeometry({
            sourceControlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            sourceStartPosition: { x: 0, y: 0 },
            sourceStartTangent: { x: 1, y: 0 },
            sourceEndPosition: { x: 10, y: 0 },
            sourceEndTangent: { x: 1, y: 0 },
            side: 1,
            spacing: 4,
        });
        expect(res.startTangent).toEqual({ x: 1, y: 0 });
        expect(res.endTangent).toEqual({ x: 1, y: 0 });
    });

    it('offsets a cubic source where the start and end tangents differ', () => {
        const res = computeDuplicateGeometry({
            sourceControlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 10, y: 5 },
                { x: 10, y: 10 },
            ],
            sourceStartPosition: { x: 0, y: 0 },
            sourceStartTangent: { x: 1, y: 0 },
            sourceEndPosition: { x: 10, y: 10 },
            sourceEndTangent: { x: 0, y: 1 },
            side: 1,
            spacing: 3,
        });
        expect(res.startPosition).toEqual({ x: 0, y: 3 });
        expect(res.endPosition).toEqual({ x: 7, y: 10 });
        expect(res.middleControlPoints).toHaveLength(2);
        // CP1 at t=1/3: interp offset = (2/3)*(0,3) + (1/3)*(-3,0) = (-1, 2)
        expect(res.middleControlPoints[0]).toEqual({ x: 4, y: 2 });
        // CP2 at t=2/3: interp offset = (1/3)*(0,3) + (2/3)*(-3,0) = (-2, 1)
        expect(res.middleControlPoints[1]).toEqual({ x: 8, y: 6 });
    });
});
