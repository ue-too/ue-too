import type { Point } from '@ue-too/math';

export type DuplicateGeometryInput = {
    /** Source Bézier control points, including endpoints (first and last). */
    sourceControlPoints: Point[];
    sourceStartPosition: Point;
    sourceStartTangent: Point;
    sourceEndPosition: Point;
    sourceEndTangent: Point;
    /** +1 or -1. +1 places the duplicate to the left of the source tangent. */
    side: 1 | -1;
    /** Perpendicular distance between source and duplicate centerlines. */
    spacing: number;
};

export type DuplicateGeometryResult = {
    startPosition: Point;
    startTangent: Point;
    endPosition: Point;
    endTangent: Point;
    /** Middle control points (excluding first and last) for TrackGraph.connectJoints. */
    middleControlPoints: Point[];
};

// Local 2D normalization to avoid @ue-too/math's PointCal.unitVector which
// mutates its argument by assigning `z = 0` when z is absent.
function normalize2D(v: Point): Point {
    const mag = Math.hypot(v.x, v.y);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
}

function perpOffset(tangent: Point, side: 1 | -1, spacing: number): Point {
    const unit = normalize2D(tangent);
    return { x: -unit.y * side * spacing, y: unit.x * side * spacing };
}

export function computeDuplicateGeometry(
    input: DuplicateGeometryInput
): DuplicateGeometryResult {
    const {
        sourceControlPoints,
        sourceStartPosition,
        sourceStartTangent,
        sourceEndPosition,
        sourceEndTangent,
        side,
        spacing,
    } = input;

    const startOffset = perpOffset(sourceStartTangent, side, spacing);
    const endOffset = perpOffset(sourceEndTangent, side, spacing);

    const startPosition: Point = {
        x: sourceStartPosition.x + startOffset.x,
        y: sourceStartPosition.y + startOffset.y,
    };
    const endPosition: Point = {
        x: sourceEndPosition.x + endOffset.x,
        y: sourceEndPosition.y + endOffset.y,
    };

    const lastIndex = sourceControlPoints.length - 1;
    const middleControlPoints: Point[] = [];
    for (let i = 1; i < lastIndex; i++) {
        const t = i / lastIndex;
        const interpOffset: Point = {
            x: startOffset.x * (1 - t) + endOffset.x * t,
            y: startOffset.y * (1 - t) + endOffset.y * t,
        };
        middleControlPoints.push({
            x: sourceControlPoints[i].x + interpOffset.x,
            y: sourceControlPoints[i].y + interpOffset.y,
        });
    }

    return {
        startPosition,
        startTangent: normalize2D(sourceStartTangent),
        endPosition,
        endTangent: normalize2D(sourceEndTangent),
        middleControlPoints,
    };
}
