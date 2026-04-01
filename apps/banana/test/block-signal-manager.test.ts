import { BlockSignalManager } from '../src/signals/block-signal-manager';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { SegmentSplitInfo } from '../src/trains/tracks/track';

// ---------------------------------------------------------------------------
// Mock TrackGraph helpers
// ---------------------------------------------------------------------------

type MockJoint = {
  position: { x: number; y: number };
  connections: Map<number, number>;
  tangent: { x: number; y: number };
  direction: {
    tangent: Set<number>;
    reverseTangent: Set<number>;
  };
};

type MockSegment = {
  t0Joint: number;
  t1Joint: number;
  curve: { get: (t: number) => { x: number; y: number }; derivative: (t: number) => { x: number; y: number }; lengthAtT: (t: number) => number; fullLength: number };
};

/**
 * Build a mock TrackGraph from a simple linear chain of joints and segments.
 *
 * Example: buildLinearTrackGraph([0, 1, 2, 3], [10, 11, 12])
 * creates joints 0-1-2-3 connected by segments 10, 11, 12
 * with joint direction tangent pointing forward (lower→higher joint number).
 */
function buildLinearTrackGraph(
  jointNumbers: number[],
  segmentNumbers: number[],
): TrackGraph {
  const joints = new Map<number, MockJoint>();
  const segments = new Map<number, MockSegment>();

  // Create joints
  for (let i = 0; i < jointNumbers.length; i++) {
    joints.set(jointNumbers[i], {
      position: { x: i * 10, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
    });
  }

  // Create segments connecting consecutive joints
  for (let i = 0; i < segmentNumbers.length; i++) {
    const t0 = jointNumbers[i];
    const t1 = jointNumbers[i + 1];
    segments.set(segmentNumbers[i], {
      t0Joint: t0,
      t1Joint: t1,
      curve: {
        get: (t: number) => ({ x: (i + t) * 10, y: 0 }),
        derivative: () => ({ x: 1, y: 0 }),
        lengthAtT: (t: number) => t * 10,
        fullLength: 10,
      },
    });

    // Wire connections
    const j0 = joints.get(t0)!;
    const j1 = joints.get(t1)!;
    j0.connections.set(t1, segmentNumbers[i]);
    j1.connections.set(t0, segmentNumbers[i]);

    // Wire directions: tangent goes forward (t0→t1), reverseTangent goes back (t1→t0)
    j0.direction.tangent.add(t1);
    j1.direction.reverseTangent.add(t0);
  }

  return {
    getJoint: (num: number) => joints.get(num) ?? null,
    getTrackSegmentWithJoints: (num: number) => segments.get(num) ?? null,
  } as unknown as TrackGraph;
}

/**
 * Build a Y-junction track graph:
 *   joint 0 --seg10-- joint 1 --seg11-- joint 2
 *                           \--seg12-- joint 3
 */
function buildJunctionTrackGraph(): TrackGraph {
  const joints = new Map<number, MockJoint>();
  const segments = new Map<number, MockSegment>();

  for (const jn of [0, 1, 2, 3]) {
    joints.set(jn, {
      position: { x: jn * 10, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
    });
  }

  // seg 10: joint 0 → joint 1
  segments.set(10, { t0Joint: 0, t1Joint: 1, curve: { get: () => ({ x: 0, y: 0 }), derivative: () => ({ x: 1, y: 0 }), lengthAtT: (t: number) => t * 10, fullLength: 10 } });
  joints.get(0)!.connections.set(1, 10);
  joints.get(1)!.connections.set(0, 10);
  joints.get(0)!.direction.tangent.add(1);
  joints.get(1)!.direction.reverseTangent.add(0);

  // seg 11: joint 1 → joint 2
  segments.set(11, { t0Joint: 1, t1Joint: 2, curve: { get: () => ({ x: 0, y: 0 }), derivative: () => ({ x: 1, y: 0 }), lengthAtT: (t: number) => t * 10, fullLength: 10 } });
  joints.get(1)!.connections.set(2, 11);
  joints.get(2)!.connections.set(1, 11);
  joints.get(1)!.direction.tangent.add(2);
  joints.get(2)!.direction.reverseTangent.add(1);

  // seg 12: joint 1 → joint 3
  segments.set(12, { t0Joint: 1, t1Joint: 3, curve: { get: () => ({ x: 0, y: 0 }), derivative: () => ({ x: 1, y: 0 }), lengthAtT: (t: number) => t * 10, fullLength: 10 } });
  joints.get(1)!.connections.set(3, 12);
  joints.get(3)!.connections.set(1, 12);
  joints.get(1)!.direction.tangent.add(3);
  joints.get(3)!.direction.reverseTangent.add(1);

  return {
    getJoint: (num: number) => joints.get(num) ?? null,
    getTrackSegmentWithJoints: (num: number) => segments.get(num) ?? null,
  } as unknown as TrackGraph;
}

describe('BlockSignalManager', () => {
  let mgr: BlockSignalManager;

  beforeEach(() => {
    mgr = new BlockSignalManager();
  });

  // -----------------------------------------------------------------------
  // Signal CRUD
  // -----------------------------------------------------------------------

  describe('addSignal / getSignal', () => {
    it('should create a signal and retrieve it by ID', () => {
      const id = mgr.addSignal(10, 0.5, 'tangent');
      const signal = mgr.getSignal(id);
      expect(signal).not.toBeNull();
      expect(signal!.segmentNumber).toBe(10);
      expect(signal!.tValue).toBe(0.5);
      expect(signal!.direction).toBe('tangent');
    });

    it('should assign unique IDs', () => {
      const a = mgr.addSignal(1, 0.1, 'tangent');
      const b = mgr.addSignal(1, 0.9, 'reverseTangent');
      expect(a).not.toBe(b);
    });
  });

  describe('removeSignal', () => {
    it('should remove a signal', () => {
      const id = mgr.addSignal(5, 0.5, 'tangent');
      mgr.removeSignal(id);
      expect(mgr.getSignal(id)).toBeNull();
    });

    it('should remove blocks that use this signal as entry', () => {
      const s1 = mgr.addSignal(5, 0.5, 'tangent');
      const s2 = mgr.addSignal(6, 0.5, 'tangent');
      const blockId = mgr.addBlock(s1, s2, [
        { segmentNumber: 5, fromT: 0.5, toT: 1 },
        { segmentNumber: 6, fromT: 0, toT: 0.5 },
      ]);
      mgr.removeSignal(s1);
      expect(mgr.getBlock(blockId)).toBeNull();
    });

    it('should detach exit signal from block when exit signal is removed', () => {
      const s1 = mgr.addSignal(5, 0.5, 'tangent');
      const s2 = mgr.addSignal(6, 0.5, 'tangent');
      const blockId = mgr.addBlock(s1, s2, [
        { segmentNumber: 5, fromT: 0.5, toT: 1 },
        { segmentNumber: 6, fromT: 0, toT: 0.5 },
      ]);
      mgr.removeSignal(s2);
      const block = mgr.getBlock(blockId);
      expect(block).not.toBeNull();
      expect(block!.exitSignalId).toBeNull();
    });
  });

  describe('getSignalsOnSegment', () => {
    it('should return signals on a segment sorted by tValue', () => {
      mgr.addSignal(10, 0.8, 'tangent');
      mgr.addSignal(10, 0.2, 'tangent');
      mgr.addSignal(10, 0.5, 'reverseTangent');

      const signals = mgr.getSignalsOnSegment(10);
      expect(signals.length).toBe(3);
      expect(signals[0].tValue).toBe(0.2);
      expect(signals[1].tValue).toBe(0.5);
      expect(signals[2].tValue).toBe(0.8);
    });

    it('should return empty array for segments with no signals', () => {
      expect(mgr.getSignalsOnSegment(99).length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Block CRUD
  // -----------------------------------------------------------------------

  describe('addBlock / getBlock', () => {
    it('should create a block and retrieve it by ID', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      const s2 = mgr.addSignal(3, 1, 'tangent');
      const segments = [
        { segmentNumber: 1, fromT: 0, toT: 1 },
        { segmentNumber: 2, fromT: 0, toT: 1 },
        { segmentNumber: 3, fromT: 0, toT: 1 },
      ];
      const blockId = mgr.addBlock(s1, s2, segments);
      const block = mgr.getBlock(blockId);

      expect(block).not.toBeNull();
      expect(block!.entrySignalId).toBe(s1);
      expect(block!.exitSignalId).toBe(s2);
      expect(block!.segments.length).toBe(3);
    });
  });

  describe('getBlockByEntrySignal', () => {
    it('should find the block protected by a signal', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      const blockId = mgr.addBlock(s1, null, [
        { segmentNumber: 1, fromT: 0, toT: 1 },
      ]);
      const block = mgr.getBlockByEntrySignal(s1);
      expect(block).not.toBeNull();
      expect(block!.id).toBe(blockId);
    });

    it('should return null for signals without a block', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      expect(mgr.getBlockByEntrySignal(s1)).toBeNull();
    });
  });

  describe('getNextBlockAfter', () => {
    it('should chain blocks via exit/entry signal linkage', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      const s2 = mgr.addSignal(2, 0, 'tangent');
      const s3 = mgr.addSignal(3, 0, 'tangent');

      const block1 = mgr.addBlock(s1, s2, [
        { segmentNumber: 1, fromT: 0, toT: 1 },
      ]);
      const block2 = mgr.addBlock(s2, s3, [
        { segmentNumber: 2, fromT: 0, toT: 1 },
      ]);

      const nextBlock = mgr.getNextBlockAfter(block1);
      expect(nextBlock).not.toBeNull();
      expect(nextBlock!.id).toBe(block2);
    });

    it('should return null for blocks with no exit signal', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      const blockId = mgr.addBlock(s1, null, [
        { segmentNumber: 1, fromT: 0, toT: 1 },
      ]);
      expect(mgr.getNextBlockAfter(blockId)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('should round-trip signals and blocks', () => {
      const s1 = mgr.addSignal(5, 0.3, 'tangent');
      const s2 = mgr.addSignal(7, 0.8, 'reverseTangent');
      mgr.addBlock(s1, s2, [
        { segmentNumber: 5, fromT: 0.3, toT: 1 },
        { segmentNumber: 6, fromT: 0, toT: 1 },
        { segmentNumber: 7, fromT: 0, toT: 0.8 },
      ]);

      const data = mgr.serialize();
      const restored = new BlockSignalManager();
      restored.deserialize(data);

      expect(restored.getSignal(s1)).toEqual(mgr.getSignal(s1));
      expect(restored.getSignal(s2)).toEqual(mgr.getSignal(s2));
      expect(restored.getBlockByEntrySignal(s1)).toEqual(
        mgr.getBlockByEntrySignal(s1),
      );
      expect(restored.getSignalsOnSegment(5).length).toBe(1);
      expect(restored.getSignalsOnSegment(7).length).toBe(1);
    });

    it('should assign new IDs above restored max', () => {
      const s1 = mgr.addSignal(1, 0, 'tangent');
      const data = mgr.serialize();

      const restored = new BlockSignalManager();
      restored.deserialize(data);
      const newId = restored.addSignal(2, 0.5, 'tangent');
      expect(newId).toBeGreaterThan(s1);
    });
  });

  // -----------------------------------------------------------------------
  // computeBlockSegments (auto-fill)
  // -----------------------------------------------------------------------

  describe('computeBlockSegments', () => {
    it('should compute segments for a straight 3-segment path', () => {
      // joints: 0-1-2-3, segments: 10,11,12
      const tg = buildLinearTrackGraph([0, 1, 2, 3], [10, 11, 12]);
      const s1 = mgr.addSignal(10, 0.3, 'tangent');
      const s2 = mgr.addSignal(12, 0.7, 'tangent');

      const result = mgr.computeBlockSegments(s1, s2, tg);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      // First: partial seg 10 from 0.3 to 1
      expect(result![0]).toEqual({ segmentNumber: 10, fromT: 0.3, toT: 1 });
      // Middle: full seg 11
      expect(result![1]).toEqual({ segmentNumber: 11, fromT: 0, toT: 1 });
      // Last: partial seg 12 from 0 to 0.7
      expect(result![2]).toEqual({ segmentNumber: 12, fromT: 0, toT: 0.7 });
    });

    it('should handle same-segment signals', () => {
      const tg = buildLinearTrackGraph([0, 1], [10]);
      const s1 = mgr.addSignal(10, 0.2, 'tangent');
      const s2 = mgr.addSignal(10, 0.8, 'tangent');

      const result = mgr.computeBlockSegments(s1, s2, tg);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0]).toEqual({ segmentNumber: 10, fromT: 0.2, toT: 0.8 });
    });

    it('should find path through a junction', () => {
      // Y-junction: 0--10--1--11--2, 1--12--3
      const tg = buildJunctionTrackGraph();
      const s1 = mgr.addSignal(10, 0.5, 'tangent');
      const s2 = mgr.addSignal(12, 0.5, 'tangent');

      const result = mgr.computeBlockSegments(s1, s2, tg);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);
      expect(result![0].segmentNumber).toBe(10);
      expect(result![1].segmentNumber).toBe(12);
    });

    it('should return null for invalid signal IDs', () => {
      const tg = buildLinearTrackGraph([0, 1], [10]);
      expect(mgr.computeBlockSegments(999, 998, tg)).toBeNull();
    });

    it('should return null when no path exists', () => {
      // Two disconnected segments
      const tg = buildLinearTrackGraph([0, 1], [10]);
      const s1 = mgr.addSignal(10, 0.5, 'tangent');
      // Signal on segment 99 which doesn't exist in the graph
      const s2 = mgr.addSignal(99, 0.5, 'tangent');
      expect(mgr.computeBlockSegments(s1, s2, tg)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // handleSegmentRemoved
  // -----------------------------------------------------------------------

  describe('handleSegmentRemoved', () => {
    it('should remove signals on the deleted segment', () => {
      const s1 = mgr.addSignal(10, 0.5, 'tangent');
      const s2 = mgr.addSignal(10, 0.8, 'reverseTangent');
      const s3 = mgr.addSignal(11, 0.5, 'tangent');

      mgr.handleSegmentRemoved(10);

      expect(mgr.getSignal(s1)).toBeNull();
      expect(mgr.getSignal(s2)).toBeNull();
      expect(mgr.getSignal(s3)).not.toBeNull(); // unaffected
    });

    it('should remove block segment entries referencing deleted segment', () => {
      const s1 = mgr.addSignal(10, 0, 'tangent');
      const blockId = mgr.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0, toT: 1 },
        { segmentNumber: 11, fromT: 0, toT: 1 },
      ]);

      // Removing segment 11 should just trim that entry, not delete the block
      mgr.handleSegmentRemoved(11);
      const block = mgr.getBlock(blockId);
      expect(block).not.toBeNull();
      expect(block!.segments.length).toBe(1);
      expect(block!.segments[0].segmentNumber).toBe(10);
    });

    it('should remove the entire block if all segments are deleted', () => {
      const s1 = mgr.addSignal(5, 0, 'tangent');
      // Signal on seg 5, block covers seg 10 only
      const blockId = mgr.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0, toT: 1 },
      ]);

      mgr.handleSegmentRemoved(10);
      expect(mgr.getBlock(blockId)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // handleSegmentSplit
  // -----------------------------------------------------------------------

  describe('handleSegmentSplit', () => {
    it('should remap a signal on the first half of a split', () => {
      const s1 = mgr.addSignal(10, 0.2, 'tangent');

      mgr.handleSegmentSplit({
        oldSegmentNumber: 10,
        splitT: 0.5,
        firstNewSegment: 20,
        secondNewSegment: 21,
        newJointNumber: 99,
      });

      const signal = mgr.getSignal(s1);
      expect(signal).not.toBeNull();
      expect(signal!.segmentNumber).toBe(20);
      // 0.2 / 0.5 = 0.4
      expect(signal!.tValue).toBeCloseTo(0.4);
    });

    it('should remap a signal on the second half of a split', () => {
      const s1 = mgr.addSignal(10, 0.8, 'tangent');

      mgr.handleSegmentSplit({
        oldSegmentNumber: 10,
        splitT: 0.5,
        firstNewSegment: 20,
        secondNewSegment: 21,
        newJointNumber: 99,
      });

      const signal = mgr.getSignal(s1);
      expect(signal).not.toBeNull();
      expect(signal!.segmentNumber).toBe(21);
      // (0.8 - 0.5) / (1 - 0.5) = 0.6
      expect(signal!.tValue).toBeCloseTo(0.6);
    });

    it('should remap block segment entries spanning the split', () => {
      const s1 = mgr.addSignal(5, 0, 'tangent');
      const blockId = mgr.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0.1, toT: 0.9 },
      ]);

      mgr.handleSegmentSplit({
        oldSegmentNumber: 10,
        splitT: 0.5,
        firstNewSegment: 20,
        secondNewSegment: 21,
        newJointNumber: 99,
      });

      const block = mgr.getBlock(blockId);
      expect(block).not.toBeNull();
      // Spanning entry should become two entries
      expect(block!.segments.length).toBe(2);
      expect(block!.segments[0].segmentNumber).toBe(20);
      expect(block!.segments[0].fromT).toBeCloseTo(0.2); // 0.1/0.5
      expect(block!.segments[0].toT).toBe(1);
      expect(block!.segments[1].segmentNumber).toBe(21);
      expect(block!.segments[1].fromT).toBe(0);
      expect(block!.segments[1].toT).toBeCloseTo(0.8); // (0.9-0.5)/0.5
    });

    it('should update segment index after signal remap', () => {
      mgr.addSignal(10, 0.3, 'tangent');

      mgr.handleSegmentSplit({
        oldSegmentNumber: 10,
        splitT: 0.5,
        firstNewSegment: 20,
        secondNewSegment: 21,
        newJointNumber: 99,
      });

      // Old segment should have no signals
      expect(mgr.getSignalsOnSegment(10).length).toBe(0);
      // New segment should have the remapped signal
      expect(mgr.getSignalsOnSegment(20).length).toBe(1);
    });
  });
});
