import { Point } from '@ue-too/math';

import { TrackGraph } from './track';

export type ProceduralTrackOptions = {
  /** Number of track segments to create (chain of segments). */
  segmentCount: number;
  /** World-space distance between segment endpoints. */
  spacing?: number;
  /** Start position X. Default 0. */
  startX?: number;
  /** Start position Y. Default 0. */
  startY?: number;
  /** If true, add slight perpendicular offset so track is not a straight line (tests curves). Default false. */
  gentleCurve?: boolean;
};

/**
 * Get the segment number and end joint (t1Joint) of the most recently added segment.
 * Returns null if there are no segments.
 */
function getLastSegmentEnd(
  trackGraph: TrackGraph,
): { segmentNumber: number; endJointNumber: number } | null {
  const ids = trackGraph.trackCurveManager.livingEntities;
  if (ids.length === 0) return null;
  const segmentNumber = Math.max(...ids);
  const segment = trackGraph.getTrackSegmentWithJoints(segmentNumber);
  if (!segment) return null;
  return { segmentNumber, endJointNumber: segment.t1Joint };
}

/**
 * Generate a procedural chain of track segments for stress testing.
 * Creates segmentCount segments in a path (optionally with gentle curvature).
 *
 * @param trackGraph - The track graph to add segments to
 * @param options - Segment count, spacing, start position, and curve option
 * @returns The number of segments successfully created
 */
export function generateProceduralTrackPath(
  trackGraph: TrackGraph,
  options: ProceduralTrackOptions,
): number {
  const {
    segmentCount,
    spacing = 20,
    startX = 0,
    startY = 0,
    gentleCurve = false,
  } = options;

  if (segmentCount < 1) return 0;

  const points: Point[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const x = startX + i * spacing;
    let y = startY;
    if (gentleCurve) {
      y += Math.sin((i / segmentCount) * Math.PI * 0.5) * spacing * 2;
    }
    points.push({ x, y });
  }

  const mid0 = {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
  if (gentleCurve) {
    mid0.y += spacing * 0.3;
  }

  const ok = trackGraph.createNewTrackSegment(
    points[0],
    points[1],
    [mid0],
  );
  if (!ok) return 0;

  let created = 1;
  for (let i = 2; i <= segmentCount; i++) {
    const last = getLastSegmentEnd(trackGraph);
    if (!last) break;

    const mid = {
      x: (points[i - 1].x + points[i].x) / 2,
      y: (points[i - 1].y + points[i].y) / 2,
    };
    if (gentleCurve) {
      mid.y += spacing * 0.3 * (i % 2 === 0 ? 1 : -1);
    }

    const ok = trackGraph.branchToNewJoint(last.endJointNumber, points[i], [mid]);
    if (!ok) break;
    created += 1;
  }

  return created;
}
