import { BlockSignalManager } from '../src/signals/block-signal-manager';
import { SignalStateEngine } from '../src/signals/signal-state-engine';
import { OccupancyRegistry } from '../src/trains/occupancy-registry';
import type { PlacedTrainEntry } from '../src/trains/train-manager';
import type { Train } from '../src/trains/formation';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockTrain(opts: {
  occupiedSegments?: { trackNumber: number; inTrackDirection: 'tangent' | 'reverseTangent' }[];
  occupiedJoints?: { jointNumber: number; direction: 'tangent' | 'reverseTangent' }[];
  bogiePositions?: { trackSegment: number; tValue: number; direction: 'tangent' | 'reverseTangent'; point: { x: number; y: number } }[] | null;
  position?: { trackSegment: number; tValue: number; direction: 'tangent' | 'reverseTangent'; point: { x: number; y: number } } | null;
}): Train {
  return {
    occupiedTrackSegments: opts.occupiedSegments ?? [],
    occupiedJointNumbers: opts.occupiedJoints ?? [],
    getBogiePositions: () => opts.bogiePositions ?? null,
    position: opts.position ?? null,
  } as unknown as Train;
}

function entry(id: number, train: Train): PlacedTrainEntry {
  return { id, train };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignalStateEngine', () => {

  describe('aspect computation', () => {
    it('should show GREEN when block is empty', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0, 'tangent');
      bsm.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0, toT: 1 },
      ]);

      const engine = new SignalStateEngine(bsm);
      const registry = new OccupancyRegistry();
      registry.updateFromTrains([]);

      engine.update(registry, []);
      expect(engine.getAspect(s1)).toBe('green');
    });

    it('should show RED when block is occupied (full segment)', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0, 'tangent');
      bsm.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0, toT: 1 },
      ]);

      const train = mockTrain({
        occupiedSegments: [{ trackNumber: 10, inTrackDirection: 'tangent' }],
        position: { trackSegment: 10, tValue: 0.5, direction: 'tangent', point: { x: 0, y: 0 } },
      });
      const placed = [entry(1, train)];

      const registry = new OccupancyRegistry();
      registry.updateFromTrains(placed);

      const engine = new SignalStateEngine(bsm);
      engine.update(registry, placed);
      expect(engine.getAspect(s1)).toBe('red');
    });

    it('should show YELLOW when next block signal is RED', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0, 'tangent');
      const s2 = bsm.addSignal(11, 0, 'tangent');
      bsm.addBlock(s1, s2, [
        { segmentNumber: 10, fromT: 0, toT: 1 },
      ]);
      bsm.addBlock(s2, null, [
        { segmentNumber: 11, fromT: 0, toT: 1 },
      ]);

      // Train in second block makes s2 RED → s1 should be YELLOW
      const train = mockTrain({
        occupiedSegments: [{ trackNumber: 11, inTrackDirection: 'tangent' }],
        position: { trackSegment: 11, tValue: 0.5, direction: 'tangent', point: { x: 0, y: 0 } },
      });
      const placed = [entry(1, train)];

      const registry = new OccupancyRegistry();
      registry.updateFromTrains(placed);

      const engine = new SignalStateEngine(bsm);
      engine.update(registry, placed);
      expect(engine.getAspect(s2)).toBe('red');
      expect(engine.getAspect(s1)).toBe('yellow');
    });

    it('should show GREEN for unknown signal IDs', () => {
      const bsm = new BlockSignalManager();
      const engine = new SignalStateEngine(bsm);
      expect(engine.getAspect(999)).toBe('green');
    });
  });

  describe('partial segment occupancy', () => {
    it('should detect train in partial segment range', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0.5, 'tangent');
      // Block covers segment 10 from t=0.5 to t=1
      bsm.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0.5, toT: 1 },
      ]);

      const train = mockTrain({
        occupiedSegments: [{ trackNumber: 10, inTrackDirection: 'tangent' }],
        position: { trackSegment: 10, tValue: 0.7, direction: 'tangent', point: { x: 0, y: 0 } },
      });
      const placed = [entry(1, train)];

      const registry = new OccupancyRegistry();
      registry.updateFromTrains(placed);

      const engine = new SignalStateEngine(bsm);
      engine.update(registry, placed);
      expect(engine.getAspect(s1)).toBe('red');
    });

    it('should NOT detect train outside partial segment range', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0.5, 'tangent');
      // Block covers segment 10 from t=0.5 to t=1
      bsm.addBlock(s1, null, [
        { segmentNumber: 10, fromT: 0.5, toT: 1 },
      ]);

      // Train is at t=0.2, which is BEFORE the block starts
      const train = mockTrain({
        occupiedSegments: [{ trackNumber: 10, inTrackDirection: 'tangent' }],
        position: { trackSegment: 10, tValue: 0.2, direction: 'tangent', point: { x: 0, y: 0 } },
      });
      const placed = [entry(1, train)];

      const registry = new OccupancyRegistry();
      registry.updateFromTrains(placed);

      const engine = new SignalStateEngine(bsm);
      engine.update(registry, placed);
      expect(engine.getAspect(s1)).toBe('green');
    });
  });

  describe('cascading yellow', () => {
    it('should not cascade YELLOW beyond one signal', () => {
      const bsm = new BlockSignalManager();
      const s1 = bsm.addSignal(10, 0, 'tangent');
      const s2 = bsm.addSignal(11, 0, 'tangent');
      const s3 = bsm.addSignal(12, 0, 'tangent');

      bsm.addBlock(s1, s2, [{ segmentNumber: 10, fromT: 0, toT: 1 }]);
      bsm.addBlock(s2, s3, [{ segmentNumber: 11, fromT: 0, toT: 1 }]);
      bsm.addBlock(s3, null, [{ segmentNumber: 12, fromT: 0, toT: 1 }]);

      // Train in block 3 → s3=RED, s2=YELLOW, s1=GREEN (not yellow)
      const train = mockTrain({
        occupiedSegments: [{ trackNumber: 12, inTrackDirection: 'tangent' }],
        position: { trackSegment: 12, tValue: 0.5, direction: 'tangent', point: { x: 0, y: 0 } },
      });
      const placed = [entry(1, train)];

      const registry = new OccupancyRegistry();
      registry.updateFromTrains(placed);

      const engine = new SignalStateEngine(bsm);
      engine.update(registry, placed);

      expect(engine.getAspect(s3)).toBe('red');
      expect(engine.getAspect(s2)).toBe('yellow');
      // 3-aspect: YELLOW only cascades one block, s1 sees s2=YELLOW (not RED) → GREEN
      expect(engine.getAspect(s1)).toBe('green');
    });
  });
});
