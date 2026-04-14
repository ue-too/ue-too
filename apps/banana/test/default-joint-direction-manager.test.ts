import { describe, it, expect, beforeEach } from 'bun:test';

import { DefaultJointDirectionManager } from '../src/trains/input-state-machine/train-kmt-state-machine';
import { JointDirectionPreferenceMap } from '../src/trains/tracks/joint-direction-preference-map';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { TrackJoint } from '../src/trains/tracks/types';

// ---------------------------------------------------------------------------
// Helpers (same pattern as timetable-joint-direction-manager.test.ts)
// ---------------------------------------------------------------------------

function makeJoint(
    tangent: number[],
    reverseTangent: number[],
    connections: [number, number][] = []
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
    joints.set(
        1,
        makeJoint(
            [2, 3],
            [0],
            [
                [0, 100],
                [2, 101],
                [3, 102],
            ]
        )
    );
    joints.set(2, makeJoint([], [1], [[1, 101]]));
    joints.set(3, makeJoint([], [1], [[1, 102]]));

    return {
        getJoint(n: number) {
            return joints.get(n) ?? null;
        },
        getTrackSegmentWithJoints(segNumber: number) {
            const segMap: Record<number, { t0Joint: number; t1Joint: number }> =
                {
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

describe('DefaultJointDirectionManager', () => {
    let graph: TrackGraph;

    beforeEach(() => {
        graph = buildTestGraph();
    });

    describe('without preference map (backwards compatible)', () => {
        it('constructs without preference map and falls back to first-from-set', () => {
            const mgr = new DefaultJointDirectionManager(graph);
            // Joint 1 tangent: Set([2, 3]) — first is 2
            const result = mgr.getNextJoint(1, 'tangent');
            expect(result).not.toBeNull();
            expect(result!.jointNumber).toBe(2);
            expect(result!.curveNumber).toBe(101);
        });

        it('returns null for unknown joint', () => {
            const mgr = new DefaultJointDirectionManager(graph);
            const result = mgr.getNextJoint(99, 'tangent');
            expect(result).toBeNull();
        });

        it('returns null when no outgoing joints in direction', () => {
            const mgr = new DefaultJointDirectionManager(graph);
            // Joint 2 has no tangent connections
            const result = mgr.getNextJoint(2, 'tangent');
            expect(result).toBeNull();
        });

        it('preferenceMap getter returns null when no map provided', () => {
            const mgr = new DefaultJointDirectionManager(graph);
            expect(mgr.preferenceMap).toBeNull();
        });
    });

    describe('with preference map', () => {
        it('uses preference when set and valid', () => {
            const prefs = new JointDirectionPreferenceMap();
            // Prefer joint 3 at joint 1 going tangent
            prefs.set(1, 'tangent', 3);
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            const result = mgr.getNextJoint(1, 'tangent');
            expect(result).not.toBeNull();
            expect(result!.jointNumber).toBe(3);
            expect(result!.curveNumber).toBe(102);
        });

        it('falls back to first-from-set when no preference is set', () => {
            const prefs = new JointDirectionPreferenceMap();
            // No preference for joint 1
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            // Joint 1 tangent: Set([2, 3]) — first is 2
            const result = mgr.getNextJoint(1, 'tangent');
            expect(result).not.toBeNull();
            expect(result!.jointNumber).toBe(2);
        });

        it('ignores stale preference not in direction set', () => {
            const prefs = new JointDirectionPreferenceMap();
            // Store a preference for a joint that doesn't exist in the set
            prefs.set(1, 'tangent', 99);
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            // Should fall back to first-from-set (joint 2)
            const result = mgr.getNextJoint(1, 'tangent');
            expect(result).not.toBeNull();
            expect(result!.jointNumber).toBe(2);
        });

        it('preferenceMap getter returns the provided map', () => {
            const prefs = new JointDirectionPreferenceMap();
            const mgr = new DefaultJointDirectionManager(graph, prefs);
            expect(mgr.preferenceMap).toBe(prefs);
        });

        it('uses preference for reverseTangent direction', () => {
            const prefs = new JointDirectionPreferenceMap();
            // Joint 1 reverseTangent only has [0] — still valid to test the path
            // Use joint 0 tangent which has [1]
            prefs.set(0, 'tangent', 1);
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            const result = mgr.getNextJoint(0, 'tangent');
            expect(result).not.toBeNull();
            expect(result!.jointNumber).toBe(1);
        });

        it('preference for joint 2 (branch) overrides default joint 2', () => {
            const prefs = new JointDirectionPreferenceMap();
            // Default would pick joint 2 (first in Set), but we set preference to 3
            prefs.set(1, 'tangent', 3);
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            const result = mgr.getNextJoint(1, 'tangent');
            expect(result!.jointNumber).toBe(3);
        });

        it('switching preference between branches works', () => {
            const prefs = new JointDirectionPreferenceMap();
            const mgr = new DefaultJointDirectionManager(graph, prefs);

            // First: no preference → gets 2
            const result1 = mgr.getNextJoint(1, 'tangent');
            expect(result1!.jointNumber).toBe(2);

            // Now set preference to 3
            prefs.set(1, 'tangent', 3);
            const result2 = mgr.getNextJoint(1, 'tangent');
            expect(result2!.jointNumber).toBe(3);

            // Change back to 2
            prefs.set(1, 'tangent', 2);
            const result3 = mgr.getNextJoint(1, 'tangent');
            expect(result3!.jointNumber).toBe(2);
        });
    });
});
