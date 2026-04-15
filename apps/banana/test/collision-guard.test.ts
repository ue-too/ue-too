import { describe, it, expect, beforeEach } from 'bun:test';
import { CrossingMap, CollisionGuard } from '../src/trains/collision-guard';
import { OccupancyRegistry } from '../src/trains/occupancy-registry';
import type { PlacedTrainEntry } from '../src/trains/train-manager';
import type { Train, TrainPosition, ThrottleSteps } from '../src/trains/formation';
import type { TrackGraph } from '../src/trains/tracks/track';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosition(
    segment: number,
    tValue: number,
    direction: 'tangent' | 'reverseTangent' = 'tangent',
): TrainPosition {
    return { trackSegment: segment, tValue, direction, point: { x: 0, y: 0 } };
}

function mockTrain(opts: {
    headPosition: TrainPosition | null;
    bogiePositions: TrainPosition[] | null;
    speed?: number;
    occupiedSegments?: { trackNumber: number; inTrackDirection: 'tangent' | 'reverseTangent' }[];
    occupiedJoints?: { jointNumber: number; direction: 'tangent' | 'reverseTangent' }[];
}): Train {
    let speed = opts.speed ?? 0;
    let throttle: ThrottleSteps = 'N';
    let collisionLocked = false;

    return {
        position: opts.headPosition,
        getBogiePositions: () => opts.bogiePositions,
        get speed() {
            return speed;
        },
        get throttleStep() {
            return throttle;
        },
        get collisionLocked() {
            return collisionLocked;
        },
        occupiedTrackSegments: opts.occupiedSegments ?? [],
        occupiedJointNumbers: opts.occupiedJoints ?? [],
        formation: {
            headCouplerLength: 0,
            tailCouplerLength: 0,
        },
        setThrottleStep(step: ThrottleSteps) {
            if (collisionLocked) return;
            throttle = step;
        },
        emergencyStop() {
            speed = 0;
            throttle = 'er';
            collisionLocked = true;
        },
        clearCollisionLock() {
            collisionLocked = false;
        },
    } as unknown as Train;
}

function entry(id: number, train: Train): PlacedTrainEntry {
    return { id, train };
}

/**
 * Build a mock TrackGraph whose getTrackSegmentWithJoints returns a segment
 * with a curve that maps tValue linearly to arc-length via fullLength.
 *
 * lengthAtT(t) = t * fullLength
 */
function mockTrackGraph(segmentFullLength: number = 100): TrackGraph {
    return {
        getTrackSegmentWithJoints(_segNum: number) {
            return {
                curve: {
                    lengthAtT: (t: number) => t * segmentFullLength,
                    fullLength: segmentFullLength,
                },
            };
        },
    } as unknown as TrackGraph;
}

// ---------------------------------------------------------------------------
// CrossingMap tests
// ---------------------------------------------------------------------------

describe('CrossingMap', () => {

    let map: CrossingMap;

    beforeEach(() => {
        map = new CrossingMap();
    });

    describe('addCrossing — bidirectional entries', () => {

        it('creates an entry for A referencing B', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            const crossings = map.getCrossings(1);
            expect(crossings).toHaveLength(1);
            expect(crossings[0]).toMatchObject({ crossingSegment: 2, selfT: 0.3, otherT: 0.7 });
        });

        it('creates a mirrored entry for B referencing A', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            const crossings = map.getCrossings(2);
            expect(crossings).toHaveLength(1);
            expect(crossings[0]).toMatchObject({ crossingSegment: 1, selfT: 0.7, otherT: 0.3 });
        });

        it('accumulates multiple crossings for the same segment', () => {
            map.addCrossing(1, 0.2, 2, 0.5);
            map.addCrossing(1, 0.8, 3, 0.4);
            expect(map.getCrossings(1)).toHaveLength(2);
            expect(map.getCrossings(2)).toHaveLength(1);
            expect(map.getCrossings(3)).toHaveLength(1);
        });
    });

    describe('getCrossings — unknown segment returns empty array', () => {

        it('returns empty array for a segment with no crossings', () => {
            expect(map.getCrossings(99)).toHaveLength(0);
        });

        it('returns empty readonly array (not undefined)', () => {
            const result = map.getCrossings(42);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });
    });

    describe('removeSegment — cleans up both sides', () => {

        it('removes the segment itself', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            map.removeSegment(1);
            expect(map.getCrossings(1)).toHaveLength(0);
        });

        it('removes back-references from partner segments', () => {
            map.addCrossing(1, 0.3, 2, 0.7);
            map.removeSegment(1);
            expect(map.getCrossings(2)).toHaveLength(0);
        });

        it('removing one segment does not affect unrelated crossings', () => {
            map.addCrossing(10, 0.1, 20, 0.9);
            map.addCrossing(30, 0.5, 40, 0.5);
            map.removeSegment(10);
            expect(map.getCrossings(30)).toHaveLength(1);
            expect(map.getCrossings(40)).toHaveLength(1);
        });

        it('removing a segment with multiple crossings cleans all partners', () => {
            map.addCrossing(1, 0.2, 2, 0.5);
            map.addCrossing(1, 0.8, 3, 0.4);
            map.removeSegment(1);
            expect(map.getCrossings(1)).toHaveLength(0);
            expect(map.getCrossings(2)).toHaveLength(0);
            expect(map.getCrossings(3)).toHaveLength(0);
        });

        it('removeSegment on unknown segment is a no-op', () => {
            expect(() => map.removeSegment(999)).not.toThrow();
        });
    });
});

// ---------------------------------------------------------------------------
// CollisionGuard — same-track detection tests
// ---------------------------------------------------------------------------

describe('CollisionGuard', () => {

    let registry: OccupancyRegistry;
    let crossingMap: CrossingMap;

    beforeEach(() => {
        registry = new OccupancyRegistry();
        crossingMap = new CrossingMap();
    });

    describe('Tier 2 hard stop (distance <= 5)', () => {

        it('calls emergencyStop on both trains when approaching within critical distance', () => {
            // Segment 100 units long. trainA at t=0.04 (arc=4), trainB at t=0.07 (arc=7).
            // Distance = |4-7| = 3 <= 5. trainA tangent (moving up), trainB reverseTangent (moving down) → approaching.
            const trackGraph = mockTrackGraph(100);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.04, 'tangent'),
                bogiePositions: [makePosition(1, 0.04, 'tangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(1, 0.07, 'reverseTangent'),
                bogiePositions: [makePosition(1, 0.07, 'reverseTangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'reverseTangent' }],
            });

            const entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            expect(trainA.collisionLocked).toBe(true);
            expect(trainA.speed).toBe(0);
            expect(trainA.throttleStep).toBe('er');
            expect(trainB.collisionLocked).toBe(true);
            expect(trainB.speed).toBe(0);
            expect(trainB.throttleStep).toBe('er');
        });
    });

    describe('Tier 1 emergency brake (distance <= brakingDistance * 1.8)', () => {

        it('sets throttle to er on both trains within braking distance', () => {
            // Segment 1000 units long. speed=10. brakingDistance = 10² / (2*1.3) ≈ 38.46.
            // threshold = 38.46 * 1.8 ≈ 69.23 units.
            // trainA at t=0.10 (arc=100), trainB at t=0.15 (arc=150). Distance=50.
            // 50 <= 69.23 but > 5 → Tier 1.
            const trackGraph = mockTrackGraph(1000);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.10, 'tangent'),
                bogiePositions: [makePosition(1, 0.10, 'tangent')],
                speed: 10,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(1, 0.15, 'reverseTangent'),
                bogiePositions: [makePosition(1, 0.15, 'reverseTangent')],
                speed: 10,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'reverseTangent' }],
            });

            const entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            // Not collision-locked (Tier 1 does NOT call emergencyStop)
            expect(trainA.collisionLocked).toBe(false);
            expect(trainB.collisionLocked).toBe(false);
            // But throttle should be set to 'er'
            expect(trainA.throttleStep).toBe('er');
            expect(trainB.throttleStep).toBe('er');
        });
    });

    describe('No trigger — trains moving apart', () => {

        it('does not intervene when trains are moving away from each other', () => {
            // trainA at t=0.04 moving reverseTangent (away from trainB above it)
            // trainB at t=0.07 moving tangent (away from trainA below it)
            // Distance = 3 <= 5 but NOT approaching → no trigger
            const trackGraph = mockTrackGraph(100);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.04, 'reverseTangent'),
                bogiePositions: [makePosition(1, 0.04, 'reverseTangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'reverseTangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(1, 0.07, 'tangent'),
                bogiePositions: [makePosition(1, 0.07, 'tangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });

            const entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            expect(trainA.collisionLocked).toBe(false);
            expect(trainB.collisionLocked).toBe(false);
            expect(trainA.throttleStep).toBe('N');
            expect(trainB.throttleStep).toBe('N');
        });
    });

    describe('No trigger — both trains stopped', () => {

        it('skips collision check when both trains have speed === 0', () => {
            const trackGraph = mockTrackGraph(100);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.04, 'tangent'),
                bogiePositions: [makePosition(1, 0.04, 'tangent')],
                speed: 0,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(1, 0.07, 'reverseTangent'),
                bogiePositions: [makePosition(1, 0.07, 'reverseTangent')],
                speed: 0,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'reverseTangent' }],
            });

            const entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            expect(trainA.collisionLocked).toBe(false);
            expect(trainB.collisionLocked).toBe(false);
        });
    });

    describe('No trigger — trains on different segments', () => {

        it('does not intervene when trains are on different segments (not colocated)', () => {
            const trackGraph = mockTrackGraph(100);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.04, 'tangent'),
                bogiePositions: [makePosition(1, 0.04, 'tangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(2, 0.07, 'reverseTangent'),
                bogiePositions: [makePosition(2, 0.07, 'reverseTangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'reverseTangent' }],
            });

            const entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            expect(trainA.collisionLocked).toBe(false);
            expect(trainB.collisionLocked).toBe(false);
        });
    });

    describe('Lock clearing', () => {

        it('clears lock for a train that is no longer in danger', () => {
            const trackGraph = mockTrackGraph(100);
            const guard = new CollisionGuard(trackGraph, crossingMap);

            const trainA = mockTrain({
                headPosition: makePosition(1, 0.04, 'tangent'),
                bogiePositions: [makePosition(1, 0.04, 'tangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const trainB = mockTrain({
                headPosition: makePosition(1, 0.07, 'reverseTangent'),
                bogiePositions: [makePosition(1, 0.07, 'reverseTangent')],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'reverseTangent' }],
            });

            let entries = [entry(1, trainA), entry(2, trainB)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            // Both should be locked after Tier 2 trigger
            expect(trainA.collisionLocked).toBe(true);
            expect(trainB.collisionLocked).toBe(true);

            // Next frame: remove trainB, only trainA remains
            entries = [entry(1, trainA)];
            registry.updateFromTrains(entries);
            guard.update(entries, registry);

            // TrainA's lock should be cleared since it's no longer in danger
            expect(trainA.collisionLocked).toBe(false);
        });
    });
});
