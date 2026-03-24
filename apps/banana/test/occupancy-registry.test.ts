import { OccupancyRegistry } from '../src/trains/occupancy-registry';
import type { PlacedTrainEntry } from '../src/trains/train-manager';
import type { Train, TrainPosition } from '../src/trains/formation';

/**
 * Minimal mock train that exposes the properties OccupancyRegistry reads.
 */
function mockTrain(opts: {
    occupiedSegments?: { trackNumber: number; inTrackDirection: 'tangent' | 'reverseTangent' }[];
    occupiedJoints?: { jointNumber: number; direction: 'tangent' | 'reverseTangent' }[];
    bogieSegments?: number[];
    headSegment?: number;
}): Train {
    const bogiePositions = opts.bogieSegments
        ? opts.bogieSegments.map(seg => ({ trackSegment: seg, tValue: 0, direction: 'tangent' as const, point: { x: 0, y: 0 } }))
        : null;
    const position = opts.headSegment != null
        ? { trackSegment: opts.headSegment, tValue: 0, direction: 'tangent' as const, point: { x: 0, y: 0 } }
        : null;
    return {
        occupiedTrackSegments: opts.occupiedSegments ?? [],
        occupiedJointNumbers: opts.occupiedJoints ?? [],
        getBogiePositions: () => bogiePositions,
        position,
    } as unknown as Train;
}

function entry(id: number, train: Train): PlacedTrainEntry {
    return { id, train };
}

describe('OccupancyRegistry', () => {

    let registry: OccupancyRegistry;

    beforeEach(() => {
        registry = new OccupancyRegistry();
    });

    describe('empty state', () => {

        it('should return empty set for any segment when no trains exist', () => {
            registry.updateFromTrains([]);
            expect(registry.getTrainsOnSegment(0).size).toBe(0);
            expect(registry.getTrainsOnSegment(99).size).toBe(0);
        });

        it('should return empty set for any joint when no trains exist', () => {
            registry.updateFromTrains([]);
            expect(registry.getTrainsAtJoint(0).size).toBe(0);
        });

        it('should return no colocated pairs when no trains exist', () => {
            registry.updateFromTrains([]);
            expect(registry.getColocatedPairs().size).toBe(0);
        });

        it('should report no shared track for any pair', () => {
            registry.updateFromTrains([]);
            expect(registry.sharesTrack(1, 2)).toBe(false);
        });
    });

    describe('single train', () => {

        it('should register the train on its occupied segments', () => {
            const t = mockTrain({
                occupiedSegments: [
                    { trackNumber: 1, inTrackDirection: 'tangent' },
                    { trackNumber: 2, inTrackDirection: 'tangent' },
                ],
            });
            registry.updateFromTrains([entry(10, t)]);

            expect(registry.getTrainsOnSegment(1).has(10)).toBe(true);
            expect(registry.getTrainsOnSegment(2).has(10)).toBe(true);
            expect(registry.getTrainsOnSegment(3).has(10)).toBe(false);
        });

        it('should register the train on its occupied joints', () => {
            const t = mockTrain({
                occupiedJoints: [
                    { jointNumber: 5, direction: 'tangent' },
                    { jointNumber: 6, direction: 'tangent' },
                    { jointNumber: 7, direction: 'tangent' },
                ],
            });
            registry.updateFromTrains([entry(10, t)]);

            expect(registry.getTrainsAtJoint(5).has(10)).toBe(true);
            expect(registry.getTrainsAtJoint(6).has(10)).toBe(true);
            expect(registry.getTrainsAtJoint(7).has(10)).toBe(true);
            expect(registry.getTrainsAtJoint(8).has(10)).toBe(false);
        });

        it('should return no colocated pairs with only one train', () => {
            const t = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(10, t)]);
            expect(registry.getColocatedPairs().size).toBe(0);
        });
    });

    describe('two trains on different segments', () => {

        it('sharesTrack should return false', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 1, direction: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 3, direction: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.sharesTrack(1, 2)).toBe(false);
        });

        it('should return no colocated pairs', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.getColocatedPairs().size).toBe(0);
        });
    });

    describe('two trains sharing a segment', () => {

        it('sharesTrack should return true', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 5, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [
                    { trackNumber: 5, inTrackDirection: 'reverseTangent' },
                    { trackNumber: 6, inTrackDirection: 'reverseTangent' },
                ],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.sharesTrack(1, 2)).toBe(true);
            expect(registry.sharesTrack(2, 1)).toBe(true);
        });

        it('should include the pair in colocated pairs', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 5, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 5, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            const pairs = registry.getColocatedPairs();
            expect(pairs.size).toBe(1);
            // Pair key uses smaller ID first
            expect(pairs.has('1:2')).toBe(true);
        });
    });

    describe('two trains sharing a joint (but not segment)', () => {

        it('sharesTrack should return true', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 10, direction: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 10, direction: 'reverseTangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.sharesTrack(1, 2)).toBe(true);
        });

        it('should include the pair in colocated pairs', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 10, direction: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'tangent' }],
                occupiedJoints: [{ jointNumber: 10, direction: 'reverseTangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            const pairs = registry.getColocatedPairs();
            expect(pairs.has('1:2')).toBe(true);
        });
    });

    describe('train removed between frames', () => {

        it('should clear stale entries after train is removed', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);
            expect(registry.getTrainsOnSegment(1).size).toBe(2);

            // Next frame, train 2 is gone
            registry.updateFromTrains([entry(1, t1)]);
            expect(registry.getTrainsOnSegment(1).size).toBe(1);
            expect(registry.getTrainsOnSegment(1).has(1)).toBe(true);
            expect(registry.getTrainsOnSegment(1).has(2)).toBe(false);
        });

        it('should remove colocated pairs when a train is removed', () => {
            const t1 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);
            expect(registry.getColocatedPairs().size).toBe(1);

            registry.updateFromTrains([entry(1, t1)]);
            expect(registry.getColocatedPairs().size).toBe(0);
        });
    });

    describe('multiple segments per train', () => {

        it('should register all segments for a train occupying many segments', () => {
            const segments = Array.from({ length: 15 }, (_, i) => ({
                trackNumber: i,
                inTrackDirection: 'tangent' as const,
            }));
            const t = mockTrain({ occupiedSegments: segments });
            registry.updateFromTrains([entry(1, t)]);

            for (let i = 0; i < 15; i++) {
                expect(registry.getTrainsOnSegment(i).has(1)).toBe(true);
            }
            expect(registry.getTrainsOnSegment(15).has(1)).toBe(false);
        });
    });

    describe('three trains with partial overlap', () => {

        it('should detect multiple colocated pairs', () => {
            const t1 = mockTrain({
                occupiedSegments: [
                    { trackNumber: 1, inTrackDirection: 'tangent' },
                    { trackNumber: 2, inTrackDirection: 'tangent' },
                ],
            });
            const t2 = mockTrain({
                occupiedSegments: [
                    { trackNumber: 2, inTrackDirection: 'tangent' },
                    { trackNumber: 3, inTrackDirection: 'tangent' },
                ],
            });
            const t3 = mockTrain({
                occupiedSegments: [
                    { trackNumber: 3, inTrackDirection: 'tangent' },
                    { trackNumber: 4, inTrackDirection: 'tangent' },
                ],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2), entry(3, t3)]);

            const pairs = registry.getColocatedPairs();
            expect(pairs.has('1:2')).toBe(true);  // share segment 2
            expect(pairs.has('2:3')).toBe(true);  // share segment 3
            expect(pairs.has('1:3')).toBe(false);  // no shared segment
        });
    });

    describe('bogie-position-based occupancy (stationary trains)', () => {

        it('should detect shared segment from bogie positions even with empty occupiedTrackSegments', () => {
            // Simulates freshly placed trains that never moved
            const t1 = mockTrain({
                bogieSegments: [5, 5],  // all bogies on segment 5
            });
            const t2 = mockTrain({
                bogieSegments: [5, 5],
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.getTrainsOnSegment(5).has(1)).toBe(true);
            expect(registry.getTrainsOnSegment(5).has(2)).toBe(true);
            expect(registry.sharesTrack(1, 2)).toBe(true);
        });

        it('should detect shared segment when bogies span multiple segments', () => {
            const t1 = mockTrain({
                bogieSegments: [5, 6],  // spans segments 5 and 6
            });
            const t2 = mockTrain({
                bogieSegments: [6, 7],  // spans segments 6 and 7
            });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.sharesTrack(1, 2)).toBe(true);  // share segment 6
        });

        it('should fall back to head position when bogies are null', () => {
            const t1 = mockTrain({ headSegment: 3 });
            const t2 = mockTrain({ headSegment: 3 });
            registry.updateFromTrains([entry(1, t1), entry(2, t2)]);

            expect(registry.getTrainsOnSegment(3).has(1)).toBe(true);
            expect(registry.sharesTrack(1, 2)).toBe(true);
        });
    });

    describe('sharesTrack with non-existent train IDs', () => {

        it('should return false when querying train IDs not in the registry', () => {
            const t = mockTrain({
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            registry.updateFromTrains([entry(1, t)]);

            expect(registry.sharesTrack(1, 999)).toBe(false);
            expect(registry.sharesTrack(999, 1)).toBe(false);
        });
    });
});
