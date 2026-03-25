import { RouteManager } from '../src/timetable/route-manager';
import type { Route } from '../src/timetable/types';
import type { TrackJoint } from '../src/trains/tracks/types';
import type { TrackGraph } from '../src/trains/tracks/track';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJoint(
  tangent: number[],
  reverseTangent: number[],
): TrackJoint {
  return {
    position: { x: 0, y: 0 },
    connections: new Map(),
    tangent: { x: 1, y: 0 },
    direction: {
      tangent: new Set(tangent),
      reverseTangent: new Set(reverseTangent),
    },
  };
}

/**
 * Build a minimal mock TrackGraph from a joint map.
 * Only `getJoint()` is used by `RouteManager.validate()`.
 */
function mockTrackGraph(joints: Map<number, TrackJoint>): TrackGraph {
  return {
    getJoint(jointNumber: number) {
      return joints.get(jointNumber) ?? null;
    },
  } as unknown as TrackGraph;
}

/**
 * Build a route from joint numbers and directions.
 * Shorthand: `'t'` = tangent, `'r'` = reverseTangent.
 */
function route(
  steps: { j: number; d: 't' | 'r' }[],
): Route {
  return {
    id: 'test-route',
    name: 'Test',
    joints: steps.map((s) => ({
      jointNumber: s.j,
      direction: s.d === 't' ? 'tangent' : 'reverseTangent',
    })),
  };
}

// ---------------------------------------------------------------------------
// Track layout used across tests (matches wrong.json topology)
//
//   0 --seg0-- 1 --seg5-- 8 --seg7-- 5 --seg2-- 4
//                                  \
//                          8 --seg6-- 7 --seg3-- 6
//
//   Joint 0: tangent=[1]         reverseTangent=[]
//   Joint 1: tangent=[8]         reverseTangent=[0]
//   Joint 8: tangent=[7, 5]      reverseTangent=[1]
//   Joint 5: tangent=[8]         reverseTangent=[4]
//   Joint 4: tangent=[5]         reverseTangent=[]
//   Joint 7: tangent=[8]         reverseTangent=[6]
//   Joint 6: tangent=[7]         reverseTangent=[]
// ---------------------------------------------------------------------------

function buildTestGraph(): TrackGraph {
  const joints = new Map<number, TrackJoint>();
  joints.set(0, makeJoint([1], []));
  joints.set(1, makeJoint([8], [0]));
  joints.set(8, makeJoint([7, 5], [1]));
  joints.set(5, makeJoint([8], [4]));
  joints.set(4, makeJoint([5], []));
  joints.set(7, makeJoint([8], [6]));
  joints.set(6, makeJoint([7], []));
  return mockTrackGraph(joints);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RouteManager.validate', () => {
  let mgr: RouteManager;
  let graph: TrackGraph;

  beforeEach(() => {
    mgr = new RouteManager();
    graph = buildTestGraph();
  });

  // -- Valid routes -------------------------------------------------------

  it('accepts a single-joint route', () => {
    expect(mgr.validate(route([{ j: 0, d: 't' }]), graph)).toBe(true);
  });

  it('accepts a simple two-joint route (0 → 1)', () => {
    expect(
      mgr.validate(route([{ j: 0, d: 't' }, { j: 1, d: 't' }]), graph),
    ).toBe(true);
  });

  it('accepts the full forward route 0 → 1 → 8 → 5 → 4', () => {
    // Joint 0: t=[1]           → d='t'
    // Joint 1: t=[8], rt=[0]   → arrive rt, depart t → d='t'
    // Joint 8: t=[7,5], rt=[1] → arrive rt, depart t → d='t'
    // Joint 5: t=[8], rt=[4]   → arrive t, depart rt → d='r'
    // Joint 4: last
    expect(
      mgr.validate(
        route([
          { j: 0, d: 't' },
          { j: 1, d: 't' },
          { j: 8, d: 't' },
          { j: 5, d: 'r' },
          { j: 4, d: 't' },
        ]),
        graph,
      ),
    ).toBe(true);
  });

  it('accepts the reverse route 4 → 5 → 8 → 1 → 0', () => {
    // Joint 4: t=[5]           → d='t'
    // Joint 5: t=[8], rt=[4]   → arrive rt, depart t → d='t'
    // Joint 8: t=[7,5], rt=[1] → arrive t, depart rt → d='r'
    // Joint 1: t=[8], rt=[0]   → arrive t, depart rt → d='r'
    // Joint 0: last
    expect(
      mgr.validate(
        route([
          { j: 4, d: 't' },
          { j: 5, d: 't' },
          { j: 8, d: 'r' },
          { j: 1, d: 'r' },
          { j: 0, d: 't' },
        ]),
        graph,
      ),
    ).toBe(true);
  });

  it('accepts route through the branch 0 → 1 → 8 → 7 → 6', () => {
    expect(
      mgr.validate(
        route([
          { j: 0, d: 't' },
          { j: 1, d: 't' },
          { j: 8, d: 't' },
          { j: 7, d: 'r' },
          { j: 6, d: 't' },
        ]),
        graph,
      ),
    ).toBe(true);
  });

  // -- Invalid: non-existent joint ----------------------------------------

  it('rejects route with a non-existent joint', () => {
    expect(
      mgr.validate(route([{ j: 0, d: 't' }, { j: 99, d: 't' }]), graph),
    ).toBe(false);
  });

  // -- Invalid: joints not connected --------------------------------------

  it('rejects route with disconnected joints (0 → 8)', () => {
    // Joint 0 tangent=[1], not 8
    expect(
      mgr.validate(route([{ j: 0, d: 't' }, { j: 8, d: 't' }]), graph),
    ).toBe(false);
  });

  // -- Invalid: wrong direction specified ---------------------------------

  it('rejects when direction is wrong for the pair (1 → 0 with tangent)', () => {
    // Joint 1 tangent=[8], reverseTangent=[0]; going to 0 needs reverseTangent
    expect(
      mgr.validate(route([{ j: 1, d: 't' }, { j: 0, d: 't' }]), graph),
    ).toBe(false);
  });

  // -- Invalid: same-side arrival and departure ---------------------------

  it('rejects when arrival and departure are on the same side at an intermediate joint', () => {
    // Route 0 → 1 → 8 with direction tangent at joint 1.
    // Joint 1: tangent=[8], reverseTangent=[0].
    // Arrival from 0 is on reverseTangent side, departure to 8 is tangent → OK.
    // Now force both same-side: build a graph where joint 1 has 0 AND 8 both
    // in tangent, meaning arrival and departure would be on the same side.
    const joints = new Map<number, TrackJoint>();
    joints.set(0, makeJoint([1], []));
    joints.set(1, makeJoint([0, 8], [])); // 0 and 8 both in tangent
    joints.set(8, makeJoint([], [1]));
    const g = mockTrackGraph(joints);

    expect(
      mgr.validate(
        route([
          { j: 0, d: 't' },     // departs toward 1 (tangent has 1)
          { j: 1, d: 't' },     // departs toward 8 (tangent has 8)
          { j: 8, d: 't' },
        ]),
        g,
      ),
    ).toBe(false);
  });

  it('rejects same-side arrival/departure on the real graph (e.g. 8 → 5 → 8)', () => {
    // Joint 5: tangent=[8], reverseTangent=[4].
    // Coming from 8 (tangent side at joint 5), departing to 8 (also tangent) — same side.
    expect(
      mgr.validate(
        route([
          { j: 8, d: 't' },     // 8 tangent=[7,5], reaches 5
          { j: 5, d: 't' },     // tries to depart tangent toward 8 — same side as arrival
          { j: 8, d: 't' },
        ]),
        graph,
      ),
    ).toBe(false);
  });

  it('rejects U-turn at a junction (5 → 8 → 5)', () => {
    // Joint 8: tangent=[7, 5], reverseTangent=[1].
    // Arriving from 5 (tangent side), departing to 5 (also tangent side) — same side.
    expect(
      mgr.validate(
        route([
          { j: 5, d: 't' },
          { j: 8, d: 't' },     // departure direction tangent toward 5
          { j: 5, d: 't' },
        ]),
        graph,
      ),
    ).toBe(false);
  });

  // -- Edge cases ---------------------------------------------------------

  it('rejects empty route', () => {
    expect(
      mgr.validate({ id: 'e', name: 'empty', joints: [] }, graph),
    ).toBe(false);
  });
});
