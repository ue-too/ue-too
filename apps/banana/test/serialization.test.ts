import { BCurve } from '@ue-too/curve';
import { GenericEntityManager } from '../src/utils';
import { TrackJointManager } from '../src/trains/tracks/trackjoint-manager';
import { TrackCurveManager } from '../src/trains/tracks/trackcurve-manager';
import { TrackGraph } from '../src/trains/tracks/track';
import { ELEVATION, validateSerializedTrackData } from '../src/trains/tracks/types';
import type { TrackJointWithElevation, SerializedTrackJoint, SerializedTrackSegment } from '../src/trains/tracks/types';

describe('GenericEntityManager.createEntityWithId', () => {
  let manager: GenericEntityManager<string>;

  beforeEach(() => {
    manager = new GenericEntityManager<string>(5);
  });

  it('should create an entity with a specific ID', () => {
    manager.createEntityWithId(3, 'entity-3');
    expect(manager.getEntity(3)).toBe('entity-3');
    expect(manager.getLivingEntityCount()).toBe(1);
    expect(manager.getLivingEntitesIndex()).toEqual([3]);
  });

  it('should allow creating entities with non-sequential IDs', () => {
    manager.createEntityWithId(4, 'entity-4');
    manager.createEntityWithId(1, 'entity-1');
    manager.createEntityWithId(0, 'entity-0');

    expect(manager.getEntity(0)).toBe('entity-0');
    expect(manager.getEntity(1)).toBe('entity-1');
    expect(manager.getEntity(4)).toBe('entity-4');
    expect(manager.getEntity(2)).toBeNull();
    expect(manager.getEntity(3)).toBeNull();
    expect(manager.getLivingEntityCount()).toBe(3);
  });

  it('should expand capacity when ID exceeds max entities', () => {
    manager.createEntityWithId(10, 'entity-10');
    expect(manager.getEntity(10)).toBe('entity-10');
    expect(manager.getLivingEntityCount()).toBe(1);
  });

  it('should throw when entity ID is already in use', () => {
    manager.createEntityWithId(2, 'entity-2');
    expect(() => {
      manager.createEntityWithId(2, 'entity-2-duplicate');
    }).toThrow('not available');
  });

  it('should throw for negative entity ID', () => {
    expect(() => {
      manager.createEntityWithId(-1, 'bad');
    }).toThrow('invalid');
  });

  it('should coexist with createEntity', () => {
    manager.createEntityWithId(2, 'forced-2');
    const autoId = manager.createEntity('auto');
    expect(autoId).toBe(0);
    expect(manager.getEntity(0)).toBe('auto');
    expect(manager.getEntity(2)).toBe('forced-2');
    expect(manager.getLivingEntityCount()).toBe(2);
  });

  it('should work after destroying entities', () => {
    const id0 = manager.createEntity('a');
    const id1 = manager.createEntity('b');
    manager.destroyEntity(id0);

    manager.createEntityWithId(id0, 'restored-a');
    expect(manager.getEntity(id0)).toBe('restored-a');
    expect(manager.getEntity(id1)).toBe('b');
    expect(manager.getLivingEntityCount()).toBe(2);
  });

  it('should handle expansion from zero initial count', () => {
    const zeroManager = new GenericEntityManager<string>(0);
    zeroManager.createEntityWithId(0, 'first');
    expect(zeroManager.getEntity(0)).toBe('first');
    expect(zeroManager.getLivingEntityCount()).toBe(1);
  });

  it('should correctly restore a manager state via createEntityWithId', () => {
    const original = new GenericEntityManager<string>(5);
    original.createEntity('a'); // 0
    original.createEntity('b'); // 1
    original.createEntity('c'); // 2
    original.destroyEntity(1);
    original.createEntity('d'); // gets ID 3 (1 was destroyed, pushed to end)

    const restored = new GenericEntityManager<string>(5);
    const originalEntities = original.getLivingEntitiesWithIndex();
    for (const { index, entity } of originalEntities) {
      restored.createEntityWithId(index, entity);
    }

    for (const { index, entity } of originalEntities) {
      expect(restored.getEntity(index)).toBe(entity);
    }
    expect(restored.getLivingEntityCount()).toBe(original.getLivingEntityCount());
  });
});

describe('TrackJointManager serialization', () => {
  function makeJoint(
    x: number,
    y: number,
    elevation: ELEVATION = ELEVATION.GROUND,
    connections: [number, number][] = [],
    tangentDir: number[] = [],
    reverseTangentDir: number[] = []
  ): TrackJointWithElevation {
    return {
      position: { x, y },
      connections: new Map(connections),
      tangent: { x: 1, y: 0 },
      direction: {
        tangent: new Set(tangentDir),
        reverseTangent: new Set(reverseTangentDir),
      },
      elevation,
    };
  }

  it('should serialize and deserialize an empty manager', () => {
    const manager = new TrackJointManager(5);
    const serialized = manager.serialize();
    expect(serialized).toEqual([]);

    const restored = TrackJointManager.deserialize(serialized);
    expect(restored.getJoints()).toEqual([]);
  });

  it('should round-trip a single joint', () => {
    const manager = new TrackJointManager(5);
    const joint = makeJoint(10, 20, ELEVATION.GROUND);
    const id = manager.createJoint(joint);

    const serialized = manager.serialize();
    const restored = TrackJointManager.deserialize(serialized);

    const restoredJoint = restored.getJoint(id);
    expect(restoredJoint).not.toBeNull();
    expect(restoredJoint!.position).toEqual({ x: 10, y: 20 });
    expect(restoredJoint!.elevation).toBe(ELEVATION.GROUND);
  });

  it('should preserve joint numbers across serialize/deserialize', () => {
    const manager = new TrackJointManager(10);
    const id0 = manager.createJoint(makeJoint(0, 0));
    const id1 = manager.createJoint(makeJoint(10, 0));
    const id2 = manager.createJoint(makeJoint(20, 0));
    manager.destroyJoint(id1);
    const id3 = manager.createJoint(makeJoint(30, 0));

    const serialized = manager.serialize();
    const restored = TrackJointManager.deserialize(serialized);

    expect(restored.getJoint(id0)).not.toBeNull();
    expect(restored.getJoint(id1)).toBeNull();
    expect(restored.getJoint(id2)).not.toBeNull();
    expect(restored.getJoint(id3)).not.toBeNull();

    expect(restored.getJoint(id0)!.position).toEqual({ x: 0, y: 0 });
    expect(restored.getJoint(id2)!.position).toEqual({ x: 20, y: 0 });
    expect(restored.getJoint(id3)!.position).toEqual({ x: 30, y: 0 });
  });

  it('should preserve Map connections through serialization', () => {
    const manager = new TrackJointManager(5);
    const joint = makeJoint(0, 0, ELEVATION.GROUND, [[1, 5], [2, 7]]);
    const id = manager.createJoint(joint);

    const serialized = manager.serialize();
    const restored = TrackJointManager.deserialize(serialized);

    const restoredJoint = restored.getJoint(id)!;
    expect(restoredJoint.connections).toBeInstanceOf(Map);
    expect(restoredJoint.connections.size).toBe(2);
    expect(restoredJoint.connections.get(1)).toBe(5);
    expect(restoredJoint.connections.get(2)).toBe(7);
  });

  it('should preserve Set directions through serialization', () => {
    const manager = new TrackJointManager(5);
    const joint = makeJoint(0, 0, ELEVATION.GROUND, [], [3, 5], [4, 6]);
    const id = manager.createJoint(joint);

    const serialized = manager.serialize();
    const restored = TrackJointManager.deserialize(serialized);

    const restoredJoint = restored.getJoint(id)!;
    expect(restoredJoint.direction.tangent).toBeInstanceOf(Set);
    expect(restoredJoint.direction.reverseTangent).toBeInstanceOf(Set);
    expect(restoredJoint.direction.tangent).toEqual(new Set([3, 5]));
    expect(restoredJoint.direction.reverseTangent).toEqual(new Set([4, 6]));
  });

  it('should produce valid JSON from serialize()', () => {
    const manager = new TrackJointManager(5);
    manager.createJoint(makeJoint(1, 2, ELEVATION.ABOVE_1, [[0, 3]], [1], [2]));

    const serialized = manager.serialize();
    const json = JSON.stringify(serialized);
    const parsed: SerializedTrackJoint[] = JSON.parse(json);

    const restored = TrackJointManager.deserialize(parsed);
    const joint = restored.getJoint(0)!;
    expect(joint.position).toEqual({ x: 1, y: 2 });
    expect(joint.elevation).toBe(ELEVATION.ABOVE_1);
    expect(joint.connections.get(0)).toBe(3);
  });

  it('should preserve elevation values', () => {
    const manager = new TrackJointManager(10);
    const elevations = [ELEVATION.SUB_2, ELEVATION.GROUND, ELEVATION.ABOVE_3];
    const ids: number[] = [];
    for (const elev of elevations) {
      ids.push(manager.createJoint(makeJoint(0, 0, elev)));
    }

    const serialized = manager.serialize();
    const restored = TrackJointManager.deserialize(serialized);

    for (let i = 0; i < ids.length; i++) {
      expect(restored.getJoint(ids[i])!.elevation).toBe(elevations[i]);
    }
  });
});

describe('TrackCurveManager serialization', () => {
  function makeStraightCurve(x1: number, y1: number, x2: number, y2: number): BCurve {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return new BCurve([
      { x: x1, y: y1 },
      { x: midX, y: midY },
      { x: x2, y: y2 },
    ]);
  }

  function makeCubicCurve(
    x1: number, y1: number,
    cx1: number, cy1: number,
    cx2: number, cy2: number,
    x2: number, y2: number
  ): BCurve {
    return new BCurve([
      { x: x1, y: y1 },
      { x: cx1, y: cy1 },
      { x: cx2, y: cy2 },
      { x: x2, y: y2 },
    ]);
  }

  it('should serialize and deserialize an empty manager', () => {
    const manager = new TrackCurveManager(5);
    const serialized = manager.serialize();
    expect(serialized).toEqual([]);

    const restored = TrackCurveManager.deserialize(serialized);
    expect(restored.livingEntities).toEqual([]);
  });

  it('should round-trip a single track segment', () => {
    const manager = new TrackCurveManager(5);
    const curve = makeStraightCurve(0, 0, 100, 0);
    const segId = manager.createCurveWithJoints(
      curve, 0, 1, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const serialized = manager.serialize();
    expect(serialized.length).toBe(1);
    expect(serialized[0].segmentNumber).toBe(segId);

    const restored = TrackCurveManager.deserialize(serialized);
    const restoredSegment = restored.getTrackSegmentWithJoints(segId);
    expect(restoredSegment).not.toBeNull();
    expect(restoredSegment!.t0Joint).toBe(0);
    expect(restoredSegment!.t1Joint).toBe(1);
    expect(restoredSegment!.elevation).toEqual({
      from: ELEVATION.GROUND,
      to: ELEVATION.GROUND,
    });
  });

  it('should preserve segment numbers across serialize/deserialize', () => {
    const manager = new TrackCurveManager(10);
    const seg0 = manager.createCurveWithJoints(
      makeStraightCurve(0, 0, 100, 0), 0, 1,
      ELEVATION.GROUND, ELEVATION.GROUND
    );
    const seg1 = manager.createCurveWithJoints(
      makeStraightCurve(0, 50, 100, 50), 2, 3,
      ELEVATION.GROUND, ELEVATION.GROUND
    );
    const seg2 = manager.createCurveWithJoints(
      makeStraightCurve(0, 100, 100, 100), 4, 5,
      ELEVATION.GROUND, ELEVATION.GROUND
    );
    manager.destroyCurve(seg1);

    const serialized = manager.serialize();
    expect(serialized.length).toBe(2);

    const restored = TrackCurveManager.deserialize(serialized);
    expect(restored.getTrackSegmentWithJoints(seg0)).not.toBeNull();
    expect(restored.getTrackSegmentWithJoints(seg1)).toBeNull();
    expect(restored.getTrackSegmentWithJoints(seg2)).not.toBeNull();
    expect(restored.livingEntities.sort()).toEqual([seg0, seg2].sort());
  });

  it('should preserve BCurve control points', () => {
    const manager = new TrackCurveManager(5);
    const originalCps = [
      { x: 0, y: 0 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 100, y: 0 },
    ];
    const curve = new BCurve(originalCps);
    const segId = manager.createCurveWithJoints(
      curve, 0, 1, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const serialized = manager.serialize();
    const restored = TrackCurveManager.deserialize(serialized);

    const restoredSegment = restored.getTrackSegmentWithJoints(segId)!;
    const restoredCps = restoredSegment.curve.getControlPoints();
    expect(restoredCps.length).toBe(originalCps.length);
    for (let i = 0; i < originalCps.length; i++) {
      expect(restoredCps[i].x).toBeCloseTo(originalCps[i].x);
      expect(restoredCps[i].y).toBeCloseTo(originalCps[i].y);
    }
  });

  it('should preserve joint references (t0Joint, t1Joint)', () => {
    const manager = new TrackCurveManager(5);
    const segId = manager.createCurveWithJoints(
      makeStraightCurve(0, 0, 50, 0), 7, 13,
      ELEVATION.GROUND, ELEVATION.GROUND
    );

    const serialized = manager.serialize();
    const restored = TrackCurveManager.deserialize(serialized);
    const seg = restored.getTrackSegmentWithJoints(segId)!;
    expect(seg.t0Joint).toBe(7);
    expect(seg.t1Joint).toBe(13);
  });

  it('should preserve elevation values', () => {
    const manager = new TrackCurveManager(5);
    const segId = manager.createCurveWithJoints(
      makeStraightCurve(0, 0, 100, 0), 0, 1,
      ELEVATION.GROUND, ELEVATION.ABOVE_2
    );

    const serialized = manager.serialize();
    const restored = TrackCurveManager.deserialize(serialized);
    const seg = restored.getTrackSegmentWithJoints(segId)!;
    expect(seg.elevation.from).toBe(ELEVATION.GROUND);
    expect(seg.elevation.to).toBe(ELEVATION.ABOVE_2);
  });

  it('should preserve gauge', () => {
    const manager = new TrackCurveManager(5);
    const customGauge = 1.435;
    const segId = manager.createCurveWithJoints(
      makeStraightCurve(0, 0, 100, 0), 0, 1,
      ELEVATION.GROUND, ELEVATION.GROUND, customGauge
    );

    const serialized = manager.serialize();
    const restored = TrackCurveManager.deserialize(serialized);
    expect(restored.getTrackSegmentWithJoints(segId)!.gauge).toBe(customGauge);
  });

  it('should produce valid JSON from serialize()', () => {
    const manager = new TrackCurveManager(5);
    manager.createCurveWithJoints(
      makeCubicCurve(0, 0, 20, 40, 80, 40, 100, 0),
      0, 1, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const serialized = manager.serialize();
    const json = JSON.stringify(serialized);
    const parsed: SerializedTrackSegment[] = JSON.parse(json);

    const restored = TrackCurveManager.deserialize(parsed);
    expect(restored.livingEntities.length).toBe(1);
  });

  it('should rebuild RTree so projectOnCurve works after deserialization', () => {
    const manager = new TrackCurveManager(5);
    const curve = makeStraightCurve(0, 0, 100, 0);
    const segId = manager.createCurveWithJoints(
      curve, 0, 1, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const projection = manager.projectOnCurve({ x: 50, y: 0 });
    expect(projection).not.toBeNull();

    const serialized = manager.serialize();
    const restored = TrackCurveManager.deserialize(serialized);

    const restoredProjection = restored.projectOnCurve({ x: 50, y: 0 });
    expect(restoredProjection).not.toBeNull();
    expect(restoredProjection!.curve).toBe(segId);
  });
});

describe('Cross-reference preservation', () => {
  it('should maintain joint-to-segment and segment-to-joint references', () => {
    const jointManager = new TrackJointManager(10);
    const curveManager = new TrackCurveManager(10);

    const j0 = jointManager.createJoint({
      position: { x: 0, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
      elevation: ELEVATION.GROUND,
    });
    const j1 = jointManager.createJoint({
      position: { x: 100, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
      elevation: ELEVATION.GROUND,
    });

    const curve = new BCurve([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ]);
    const segId = curveManager.createCurveWithJoints(
      curve, j0, j1, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const j0Data = jointManager.getJoint(j0)!;
    j0Data.connections.set(j1, segId);
    j0Data.direction.tangent.add(j1);
    const j1Data = jointManager.getJoint(j1)!;
    j1Data.connections.set(j0, segId);
    j1Data.direction.reverseTangent.add(j0);

    const serializedJoints = jointManager.serialize();
    const serializedSegments = curveManager.serialize();

    const json = JSON.stringify({ joints: serializedJoints, segments: serializedSegments });
    const parsed = JSON.parse(json);

    const restoredJoints = TrackJointManager.deserialize(parsed.joints);
    const restoredCurves = TrackCurveManager.deserialize(parsed.segments);

    const rj0 = restoredJoints.getJoint(j0)!;
    const rj1 = restoredJoints.getJoint(j1)!;
    const rSeg = restoredCurves.getTrackSegmentWithJoints(segId)!;

    expect(rj0.connections.get(j1)).toBe(segId);
    expect(rj1.connections.get(j0)).toBe(segId);
    expect(rj0.direction.tangent.has(j1)).toBe(true);
    expect(rj1.direction.reverseTangent.has(j0)).toBe(true);

    expect(rSeg.t0Joint).toBe(j0);
    expect(rSeg.t1Joint).toBe(j1);
  });

  it('should handle multiple segments sharing joints', () => {
    const jointManager = new TrackJointManager(10);
    const curveManager = new TrackCurveManager(10);

    const j0 = jointManager.createJoint({
      position: { x: 0, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
      elevation: ELEVATION.GROUND,
    });
    const j1 = jointManager.createJoint({
      position: { x: 100, y: 0 },
      connections: new Map(),
      tangent: { x: 1, y: 0 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
      elevation: ELEVATION.GROUND,
    });
    const j2 = jointManager.createJoint({
      position: { x: 100, y: 100 },
      connections: new Map(),
      tangent: { x: 0, y: 1 },
      direction: { tangent: new Set(), reverseTangent: new Set() },
      elevation: ELEVATION.GROUND,
    });

    const seg0 = curveManager.createCurveWithJoints(
      new BCurve([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]),
      j0, j1, ELEVATION.GROUND, ELEVATION.GROUND
    );
    const seg1 = curveManager.createCurveWithJoints(
      new BCurve([{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }]),
      j1, j2, ELEVATION.GROUND, ELEVATION.GROUND
    );

    const j1Data = jointManager.getJoint(j1)!;
    j1Data.connections.set(j0, seg0);
    j1Data.connections.set(j2, seg1);

    const serializedJoints = jointManager.serialize();
    const serializedSegments = curveManager.serialize();

    const restoredJoints = TrackJointManager.deserialize(serializedJoints);
    const restoredCurves = TrackCurveManager.deserialize(serializedSegments);

    const rj1 = restoredJoints.getJoint(j1)!;
    expect(rj1.connections.get(j0)).toBe(seg0);
    expect(rj1.connections.get(j2)).toBe(seg1);

    expect(restoredCurves.getTrackSegmentWithJoints(seg0)!.t0Joint).toBe(j0);
    expect(restoredCurves.getTrackSegmentWithJoints(seg0)!.t1Joint).toBe(j1);
    expect(restoredCurves.getTrackSegmentWithJoints(seg1)!.t0Joint).toBe(j1);
    expect(restoredCurves.getTrackSegmentWithJoints(seg1)!.t1Joint).toBe(j2);
  });
});

describe('validateSerializedTrackData', () => {
  const validData = {
    joints: [
      {
        jointNumber: 0,
        position: { x: 0, y: 0 },
        connections: [[1, 0]],
        tangent: { x: 1, y: 0 },
        direction: { tangent: [1], reverseTangent: [] },
        elevation: 0,
      },
      {
        jointNumber: 1,
        position: { x: 100, y: 0 },
        connections: [[0, 0]],
        tangent: { x: 1, y: 0 },
        direction: { tangent: [], reverseTangent: [0] },
        elevation: 0,
      },
    ],
    segments: [
      {
        segmentNumber: 0,
        controlPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
        t0Joint: 0,
        t1Joint: 1,
        elevation: { from: 0, to: 0 },
        gauge: 1.067,
        splits: [],
      },
    ],
  };

  it('should accept valid data', () => {
    expect(validateSerializedTrackData(validData)).toEqual({ valid: true });
  });

  it('should reject null', () => {
    const result = validateSerializedTrackData(null);
    expect(result.valid).toBe(false);
  });

  function expectInvalid(data: unknown, errorSubstring: string) {
    const result = validateSerializedTrackData(data);
    expect(result.valid).toBe(false);
    expect((result as { valid: false; error: string }).error).toContain(errorSubstring);
  }

  it('should reject missing joints array', () => {
    expectInvalid({ segments: [] }, 'joints');
  });

  it('should reject missing segments array', () => {
    expectInvalid({ joints: [] }, 'segments');
  });

  it('should reject duplicate joint numbers', () => {
    expectInvalid({
      joints: [
        { ...validData.joints[0] },
        { ...validData.joints[1], jointNumber: 0 },
      ],
      segments: [],
    }, 'duplicated');
  });

  it('should reject duplicate segment numbers', () => {
    expectInvalid({
      joints: validData.joints,
      segments: [
        { ...validData.segments[0] },
        { ...validData.segments[0] },
      ],
    }, 'duplicated');
  });

  it('should reject segment referencing non-existent joint', () => {
    expectInvalid({
      joints: validData.joints,
      segments: [{ ...validData.segments[0], t0Joint: 99 }],
    }, 'non-existent');
  });

  it('should reject control points with fewer than 2 points', () => {
    expectInvalid({
      joints: validData.joints,
      segments: [{ ...validData.segments[0], controlPoints: [{ x: 0, y: 0 }] }],
    }, 'controlPoints');
  });

  it('should reject invalid gauge', () => {
    expectInvalid({
      joints: validData.joints,
      segments: [{ ...validData.segments[0], gauge: -1 }],
    }, 'gauge');
  });

  it('should reject invalid point in position', () => {
    expectInvalid({
      joints: [{ ...validData.joints[0], position: { x: 'bad' } }],
      segments: [],
    }, 'position');
  });

  it('should accept output of TrackGraph.serialize() after JSON round-trip', () => {
    const graph = new TrackGraph();
    graph.createNewTrackSegment(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      [{ x: 50, y: 0 }]
    );
    const serialized = graph.serialize();
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    expect(validateSerializedTrackData(parsed)).toEqual({ valid: true });
  });
});

describe('TrackGraph.serialize / loadFromSerializedData', () => {
  it('should round-trip an empty graph', () => {
    const graph = new TrackGraph();
    const serialized = graph.serialize();
    expect(serialized.joints).toEqual([]);
    expect(serialized.segments).toEqual([]);

    graph.loadFromSerializedData(serialized);
    expect(graph.getJoints()).toEqual([]);
  });

  it('should round-trip a graph with a single segment', () => {
    const graph = new TrackGraph();
    graph.createNewTrackSegment(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      [{ x: 50, y: 0 }]
    );

    const joints = graph.getJoints();
    const serialized = graph.serialize();

    const graph2 = new TrackGraph();
    graph2.loadFromSerializedData(serialized);

    const restoredJoints = graph2.getJoints();
    expect(restoredJoints.length).toBe(joints.length);
    for (const { jointNumber } of joints) {
      const original = graph.getJoint(jointNumber);
      const restored = graph2.getJoint(jointNumber);
      expect(restored).not.toBeNull();
      expect(restored!.position.x).toBeCloseTo(original!.position.x);
      expect(restored!.position.y).toBeCloseTo(original!.position.y);
    }
  });

  it('should clear existing data before loading', () => {
    const graph = new TrackGraph();
    graph.createNewTrackSegment(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      [{ x: 50, y: 0 }]
    );
    graph.createNewTrackSegment(
      { x: 0, y: 50 }, { x: 100, y: 50 },
      [{ x: 50, y: 50 }]
    );
    expect(graph.trackSegments.length).toBe(2);

    const singleSegData = {
      joints: [
        { jointNumber: 0, position: { x: 0, y: 0 }, connections: [[1, 0]] as [number, number][], tangent: { x: 1, y: 0 }, direction: { tangent: [1], reverseTangent: [] }, elevation: ELEVATION.GROUND },
        { jointNumber: 1, position: { x: 50, y: 0 }, connections: [[0, 0]] as [number, number][], tangent: { x: 1, y: 0 }, direction: { tangent: [], reverseTangent: [0] }, elevation: ELEVATION.GROUND },
      ],
      segments: [
        { segmentNumber: 0, controlPoints: [{ x: 0, y: 0 }, { x: 25, y: 0 }, { x: 50, y: 0 }], t0Joint: 0, t1Joint: 1, elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND }, gauge: 1.067, splits: [] },
      ],
    };

    graph.loadFromSerializedData(singleSegData);
    expect(graph.trackSegments.length).toBe(1);
    expect(graph.getJoints().length).toBe(2);
  });

  it('should survive a full JSON round-trip via loadFromSerializedData', () => {
    const graph = new TrackGraph();
    graph.createNewTrackSegment(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      [{ x: 50, y: 0 }]
    );

    const json = JSON.stringify(graph.serialize());
    const parsed = JSON.parse(json);

    const graph2 = new TrackGraph();
    graph2.loadFromSerializedData(parsed);

    expect(graph2.trackSegments.length).toBe(1);
    expect(graph2.getJoints().length).toBe(2);
  });
});
