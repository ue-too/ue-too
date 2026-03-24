import { ProximityDetector } from '../src/trains/proximity-detector';
import { OccupancyRegistry } from '../src/trains/occupancy-registry';
import type { PlacedTrainEntry } from '../src/trains/train-manager';
import type { Train, TrainPosition } from '../src/trains/formation';

function makePosition(x: number, y: number, segment = 0, tValue = 0, direction: 'tangent' | 'reverseTangent' = 'tangent'): TrainPosition {
    return { trackSegment: segment, tValue, direction, point: { x, y } };
}

/**
 * Minimal mock train for proximity detection tests.
 * Trains are spread 50+ units apart so only the intended endpoint pair is within threshold.
 * Default couplerLength is 0; the base gap tolerance (2 units) is the effective threshold.
 */
function mockTrain(opts: {
    headPosition: TrainPosition | null;
    bogiePositions: TrainPosition[] | null;
    speed?: number;
    headCouplerLength?: number;
    tailCouplerLength?: number;
    occupiedSegments?: { trackNumber: number; inTrackDirection: 'tangent' | 'reverseTangent' }[];
    occupiedJoints?: { jointNumber: number; direction: 'tangent' | 'reverseTangent' }[];
}): Train {
    return {
        position: opts.headPosition,
        getBogiePositions: () => opts.bogiePositions,
        speed: opts.speed ?? 0,
        occupiedTrackSegments: opts.occupiedSegments ?? [],
        occupiedJointNumbers: opts.occupiedJoints ?? [],
        formation: {
            headCouplerLength: opts.headCouplerLength ?? 0,
            tailCouplerLength: opts.tailCouplerLength ?? 0,
        },
    } as unknown as Train;
}

function entry(id: number, train: Train): PlacedTrainEntry {
    return { id, train };
}

describe('ProximityDetector', () => {

    let detector: ProximityDetector;
    let registry: OccupancyRegistry;

    beforeEach(() => {
        detector = new ProximityDetector();
        registry = new OccupancyRegistry();
    });

    describe('no colocated trains', () => {

        it('should return no matches when trains are on different segments', () => {
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(200, 200, 2),
                bogiePositions: [makePosition(200, 200, 2), makePosition(250, 200, 2)],
                occupiedSegments: [{ trackNumber: 2, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });
    });

    describe('colocated but far apart', () => {

        it('should return no matches when endpoints are beyond threshold', () => {
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(200, 0, 1),
                bogiePositions: [makePosition(200, 0, 1), makePosition(250, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });
    });

    describe('tail-to-head within threshold', () => {

        it('should detect a match when A tail is near B head', () => {
            // Train A: head at (0,0), tail at (50,0)
            // Train B: head at (52,0), tail at (100,0)
            // A's tail (50,0) is 2 units from B's head (52,0) → within 8-unit threshold
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(1);
            expect(matches[0].trainA.end).toBe('tail');
            expect(matches[0].trainB.end).toBe('head');
        });
    });

    describe('head-to-tail within threshold', () => {

        it('should detect a match when A head is near B tail', () => {
            // Train A: head at (102,0), tail at (150,0)
            // Train B: head at (0,0), tail at (100,0)
            // A's head (102,0) is 2 from B's tail (100,0) → match
            const t1 = mockTrain({
                headPosition: makePosition(102, 0, 1),
                bogiePositions: [makePosition(102, 0, 1), makePosition(150, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(1);
            expect(matches[0].trainA.end).toBe('head');
            expect(matches[0].trainB.end).toBe('tail');
        });
    });

    describe('head-to-head within threshold', () => {

        it('should detect a match when both heads are close', () => {
            // Trains face each other: both heads at ~100, tails pointing away
            const t1 = mockTrain({
                headPosition: makePosition(100, 0, 1),
                bogiePositions: [makePosition(100, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(102, 0, 1),
                bogiePositions: [makePosition(102, 0, 1), makePosition(150, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(1);
            expect(matches[0].trainA.end).toBe('head');
            expect(matches[0].trainB.end).toBe('head');
        });
    });

    describe('tail-to-tail within threshold', () => {

        it('should detect a match when both tails are close', () => {
            // Trains face away: tails both at ~100, heads pointing outward
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(200, 0, 1),
                bogiePositions: [makePosition(200, 0, 1), makePosition(102, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(1);
            expect(matches[0].trainA.end).toBe('tail');
            expect(matches[0].trainB.end).toBe('tail');
        });
    });

    describe('moving train excluded', () => {

        it('should not match when one train is moving', () => {
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                speed: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });

        it('should not match when both trains are moving', () => {
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                speed: 3,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                speed: 2,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });
    });

    describe('multiple matches (3 trains in a line)', () => {

        it('should detect two separate tail-to-head matches', () => {
            // A: 0..50, B: 52..100, C: 102..150
            // A-tail(50) ↔ B-head(52): 2 units → match
            // B-tail(100) ↔ C-head(102): 2 units → match
            // A ↔ C: 52 units apart → no match
            const tA = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const tB = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const tC = mockTrain({
                headPosition: makePosition(102, 0, 1),
                bogiePositions: [makePosition(102, 0, 1), makePosition(150, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, tA), entry(2, tB), entry(3, tC)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(2);
        });
    });

    describe('match disappears', () => {

        it('should clear matches when trains move apart', () => {
            const t1Close = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2Close = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });

            let entries = [entry(1, t1Close), entry(2, t2Close)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);
            expect(detector.getMatches()).toHaveLength(1);

            // Now trains are far apart
            const t2Far = mockTrain({
                headPosition: makePosition(200, 0, 1),
                bogiePositions: [makePosition(200, 0, 1), makePosition(250, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            entries = [entry(1, t1Close), entry(2, t2Far)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);
            expect(detector.getMatches()).toHaveLength(0);
        });
    });

    describe('getMatchesForTrain', () => {

        it('should return only matches involving the specified train', () => {
            // A: 0..50, B: 52..100, C: 102..150 (all on same segment, spaced 50 units apart)
            const tA = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const tB = mockTrain({
                headPosition: makePosition(52, 0, 1),
                bogiePositions: [makePosition(52, 0, 1), makePosition(100, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const tC = mockTrain({
                headPosition: makePosition(102, 0, 1),
                bogiePositions: [makePosition(102, 0, 1), makePosition(150, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, tA), entry(2, tB), entry(3, tC)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            // Train 1 only matches with train 2 (tail-to-head)
            const matchesFor1 = detector.getMatchesForTrain(1);
            expect(matchesFor1).toHaveLength(1);
            expect(
                matchesFor1[0].trainA.id === 1 || matchesFor1[0].trainB.id === 1
            ).toBe(true);

            // Train 2 matches with both 1 and 3
            const matchesFor2 = detector.getMatchesForTrain(2);
            expect(matchesFor2).toHaveLength(2);

            // Train 3 only matches with train 2
            const matchesFor3 = detector.getMatchesForTrain(3);
            expect(matchesFor3).toHaveLength(1);

            // Non-existent train has no matches
            expect(detector.getMatchesForTrain(99)).toHaveLength(0);
        });
    });

    describe('coupler length extends threshold', () => {

        it('should match at greater distance when couplerLength is set', () => {
            // Tails 10 units apart — with default couplerLength=0, threshold=2, no match
            // With couplerLength=5 on each, threshold = 5+5+2 = 12 → match
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                tailCouplerLength: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(110, 0, 1),
                bogiePositions: [makePosition(110, 0, 1), makePosition(60, 0, 1)],
                tailCouplerLength: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            const matches = detector.getMatches();
            expect(matches).toHaveLength(1);
            expect(matches[0].trainA.end).toBe('tail');
            expect(matches[0].trainB.end).toBe('tail');
        });

        it('should not match beyond combined coupler reach', () => {
            // Tails 20 units apart — threshold = 5+5+2 = 12 → no match
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                tailCouplerLength: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(120, 0, 1),
                bogiePositions: [makePosition(120, 0, 1), makePosition(70, 0, 1)],
                tailCouplerLength: 5,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });
    });

    describe('train with null position or null bogies', () => {

        it('should skip trains with null position', () => {
            const t1 = mockTrain({
                headPosition: null,
                bogiePositions: null,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: [makePosition(0, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });

        it('should skip trains with null bogie positions', () => {
            const t1 = mockTrain({
                headPosition: makePosition(0, 0, 1),
                bogiePositions: null,
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const t2 = mockTrain({
                headPosition: makePosition(2, 0, 1),
                bogiePositions: [makePosition(2, 0, 1), makePosition(50, 0, 1)],
                occupiedSegments: [{ trackNumber: 1, inTrackDirection: 'tangent' }],
            });
            const entries = [entry(1, t1), entry(2, t2)];
            registry.updateFromTrains(entries);
            detector.update(entries, registry);

            expect(detector.getMatches()).toHaveLength(0);
        });
    });
});
