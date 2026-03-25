import { TimetableJointDirectionManager } from '../src/timetable/timetable-joint-direction-manager';
import type { RouteJointStep } from '../src/timetable/types';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { TrackJoint } from '../src/trains/tracks/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJoint(
  tangent: number[],
  reverseTangent: number[],
  connections: [number, number][] = [],
): TrackJoint {
  return {
    position: { x: 0, y: 0 },
    connections: new Map(connections),
    tangent: { x: 1, y: 0 },
    direction: {
      tangent: new Set(tangent),
      reverseTangent: new Set(reverseTangent),
    },
  };
}

/**
 * Build a mock TrackGraph for the direction manager tests.
 *
 * Layout:
 *   0 --(seg 100)--> 1 --(seg 101)--> 2
 *                     1 --(seg 102)--> 3  (branch)
 *
 * Joint 0: t=[1], rt=[], connections: {1: 100}
 * Joint 1: t=[2, 3], rt=[0], connections: {0: 100, 2: 101, 3: 102}
 * Joint 2: t=[], rt=[1], connections: {1: 101}
 * Joint 3: t=[], rt=[1], connections: {1: 102}
 */
function buildTestGraph(): TrackGraph {
  const joints = new Map<number, TrackJoint>();
  joints.set(0, makeJoint([1], [], [[1, 100]]));
  joints.set(1, makeJoint([2, 3], [0], [[0, 100], [2, 101], [3, 102]]));
  joints.set(2, makeJoint([], [1], [[1, 101]]));
  joints.set(3, makeJoint([], [1], [[1, 102]]));

  return {
    getJoint(n: number) {
      return joints.get(n) ?? null;
    },
    getTrackSegmentWithJoints(segNumber: number) {
      // Each segment: t0Joint is the lower-numbered joint
      const segMap: Record<number, { t0Joint: number; t1Joint: number }> = {
        100: { t0Joint: 0, t1Joint: 1 },
        101: { t0Joint: 1, t1Joint: 2 },
        102: { t0Joint: 1, t1Joint: 3 },
      };
      const info = segMap[segNumber];
      if (!info) return null;
      return { ...info, curve: { fullLength: 10, lengthAtT: () => 5 } };
    },
  } as unknown as TrackGraph;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimetableJointDirectionManager', () => {
  let graph: TrackGraph;

  beforeEach(() => {
    graph = buildTestGraph();
  });

  describe('getNextJoint', () => {
    it('follows the route sequence: 0 → 1 → 2', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 2, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      // At joint 0, going tangent, should pick joint 1
      const result = mgr.getNextJoint(0, 'tangent');
      expect(result).not.toBeNull();
      expect(result!.jointNumber).toBe(1);
      expect(result!.curveNumber).toBe(100);
    });

    it('picks branch 3 when route says 0 → 1 → 3', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 3, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      // At joint 1, route says go to 3
      mgr.setCurrentIndex(1);
      const result = mgr.getNextJoint(1, 'tangent');
      expect(result).not.toBeNull();
      expect(result!.jointNumber).toBe(3);
      expect(result!.curveNumber).toBe(102);
    });

    it('picks branch 2 when route says 0 → 1 → 2', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 2, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      mgr.setCurrentIndex(1);
      const result = mgr.getNextJoint(1, 'tangent');
      expect(result).not.toBeNull();
      expect(result!.jointNumber).toBe(2);
      expect(result!.curveNumber).toBe(101);
    });

    it('falls back to default when joint is not in route', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      // Joint 99 is not in the route — falls back
      const result = mgr.getNextJoint(99, 'tangent');
      // DefaultJointDirectionManager will return null for non-existent joint
      expect(result).toBeNull();
    });

    it('falls back when at the end of the route', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      // Set index to the last joint — no "next" joint available
      mgr.setCurrentIndex(1);
      const result = mgr.getNextJoint(1, 'tangent');
      // Falls back to DefaultJointDirectionManager
      // Default should still return something since joint 1 has tangent connections
      expect(result).not.toBeNull();
    });

    it('determines correct direction on next segment (tangent from t0Joint)', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 2, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      // At joint 0, t0Joint of seg 100 is 0 → next direction is tangent
      const result = mgr.getNextJoint(0, 'tangent');
      expect(result!.direction).toBe('tangent');
    });

    it('determines correct direction on next segment (reverseTangent from t1Joint)', () => {
      // Going from joint 2 → 1 (reverse direction on seg 101)
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 2, direction: 'reverseTangent' },
        { jointNumber: 1, direction: 'reverseTangent' },
        { jointNumber: 0, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);

      const result = mgr.getNextJoint(2, 'reverseTangent');
      expect(result).not.toBeNull();
      expect(result!.jointNumber).toBe(1);
      // Joint 2 is t1Joint of seg 101, so direction from joint 2 is reverseTangent
      expect(result!.direction).toBe('reverseTangent');
    });
  });

  describe('setCurrentIndex / setRouteJoints', () => {
    it('setCurrentIndex advances the search start', () => {
      const routeJoints: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 2, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeJoints, 0);
      expect(mgr.currentIndex).toBe(0);

      mgr.setCurrentIndex(2);
      expect(mgr.currentIndex).toBe(2);
    });

    it('setRouteJoints replaces the route and resets index', () => {
      const routeA: RouteJointStep[] = [
        { jointNumber: 0, direction: 'tangent' },
        { jointNumber: 1, direction: 'tangent' },
      ];
      const mgr = new TimetableJointDirectionManager(graph, routeA, 1);
      expect(mgr.currentIndex).toBe(1);

      const routeB: RouteJointStep[] = [
        { jointNumber: 1, direction: 'tangent' },
        { jointNumber: 3, direction: 'tangent' },
      ];
      mgr.setRouteJoints(routeB);
      expect(mgr.currentIndex).toBe(0);

      // Should now follow routeB
      const result = mgr.getNextJoint(1, 'tangent');
      expect(result).not.toBeNull();
      expect(result!.jointNumber).toBe(3);
    });
  });
});
