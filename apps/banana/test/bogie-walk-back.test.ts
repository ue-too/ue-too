/**
 * Pins the current behavior of Train bogie walk-back and its interaction
 * with JointDirectionManager.  These tests exist as a baseline for a
 * refactor that separates walk-back (rear) from novel-joint discovery
 * (forward).
 *
 * Scenarios:
 *   1. Straddling Y through a single-option reverseTangent crossing (default JDM).
 *   4. Empty occupiedTrackSegments gets seeded on the first walk-back pass.
 *   5. Default JDM prefer-occupied branch at a two-option joint.
 *   2. TODO — revisited joint in route fools timetable JDM (known edge case).
 *   3. TODO — currentIndex lag between onJointsPassed and walk-back query.
 */

import { describe, it, expect } from 'bun:test';
import { BCurve } from '@ue-too/curve';

import type { TrackGraph } from '../src/trains/tracks/track';
import type { TrackJoint } from '../src/trains/tracks/types';
import {
    Train,
    Formation,
    type TrainPosition,
} from '../src/trains/formation';
import { Car, generateCarId, generateFormationId } from '../src/trains/cars';
import {
    DefaultJointDirectionManager,
    type JointDirectionManager,
} from '../src/trains/input-state-machine/train-kmt-state-machine';
import { TimetableJointDirectionManager } from '../src/timetable/timetable-joint-direction-manager';
import type { RouteJointStep } from '../src/timetable/types';

// ---------------------------------------------------------------------------
// Fixture track graph
// ---------------------------------------------------------------------------
//
//                          +--seg 101--> joint 2  (upper branch)
//                          |
//   joint 0 --seg 100--> joint 1
//                     ^    |
//                     |    +--seg 102--> joint 3  (lower branch)
//                     |
//               joint 4 --seg 103--> (joins joint 1 from the side — gives
//                                     joint 1 a second reverseTangent option)
//
// All four segments are 50-unit straight lines.  A 1-car train with bogie
// offset 20 placed near the Y lets walk-back exercise joint crossings.
//
// The seg 103 / joint 4 side-edge exists so joint 1's reverseTangent set is
// {0, 4} (two options) — required to reproduce the timetable-JDM walk-back
// bugs, where an ambiguous reverseTangent crossing needs to pick the
// occupied branch over whatever the route happens to suggest.

const SEG_LEN = 50;

function makeJoint(
    tangent: number[],
    reverseTangent: number[],
    connections: [number, number][]
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

function straight(
    from: { x: number; y: number },
    to: { x: number; y: number }
): BCurve {
    return new BCurve([from, to]);
}

function buildYTrackGraph(): TrackGraph {
    const joints = new Map<number, TrackJoint>();
    joints.set(0, makeJoint([1], [], [[1, 100]]));
    joints.set(
        1,
        makeJoint(
            [2, 3],
            [0, 4],
            [
                [0, 100],
                [2, 101],
                [3, 102],
                [4, 103],
            ]
        )
    );
    joints.set(2, makeJoint([], [1], [[1, 101]]));
    joints.set(3, makeJoint([], [1], [[1, 102]]));
    joints.set(4, makeJoint([1], [], [[1, 103]]));

    const segments: Record<
        number,
        { t0Joint: number; t1Joint: number; curve: BCurve }
    > = {
        100: {
            t0Joint: 0,
            t1Joint: 1,
            curve: straight({ x: 0, y: 0 }, { x: SEG_LEN, y: 0 }),
        },
        101: {
            t0Joint: 1,
            t1Joint: 2,
            curve: straight(
                { x: SEG_LEN, y: 0 },
                { x: 2 * SEG_LEN, y: 5 }
            ),
        },
        102: {
            t0Joint: 1,
            t1Joint: 3,
            curve: straight(
                { x: SEG_LEN, y: 0 },
                { x: 2 * SEG_LEN, y: -5 }
            ),
        },
        103: {
            t0Joint: 4,
            t1Joint: 1,
            curve: straight(
                { x: SEG_LEN, y: -SEG_LEN },
                { x: SEG_LEN, y: 0 }
            ),
        },
    };

    return {
        getJoint(n: number) {
            return joints.get(n) ?? null;
        },
        getTrackSegmentWithJoints(n: number) {
            return segments[n] ?? null;
        },
    } as unknown as TrackGraph;
}

// Single car, bogies 20 units apart, 2.5 units of edge-to-bogie on each end.
// Formation.bogieOffsets() = [2.5, 20]; carOffsets (.slice(1)) = [20].
// So walk-back has exactly one step: 20 units from the front bogie.
function makeOneCarTrain(
    trackGraph: TrackGraph,
    jdm: JointDirectionManager,
    position: TrainPosition
): Train {
    const car = new Car(generateCarId(), [20], 2.5, 2.5);
    const formation = new Formation(generateFormationId(), [car]);
    return new Train(position, trackGraph, jdm, formation);
}

// Invalidate the cached bogie positions so a subsequent call re-runs
// _getBogiePositions with the new position.  Reaches into a private field
// because the production code doesn't expose a public invalidator; tests
// need this to exercise multiple walk-back passes on the same train.
function invalidateBogieCache(train: Train): void {
    (train as unknown as { _cachedBogiePositions: null })._cachedBogiePositions =
        null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Train bogie walk-back', () => {
    describe('Scenario 1: walk-back across a Y with empty occupied list', () => {
        it('walks back from seg 101 through joint 1 onto seg 100 (default JDM, bootstrap picks first-available)', () => {
            const graph = buildYTrackGraph();
            const jdm = new DefaultJointDirectionManager(graph);

            // Front bogie 5 units past joint 1 on the upper branch.
            // Walk-back 20 units: 5 back to joint 1, then 15 into seg 100.
            // Joint 1's reverseTangent set is {0, 4} (joint 0 inserted first)
            // and `_occupiedTrackSegments` is empty on the first call, so the
            // bootstrap picks first-available = joint 0 via seg 100.
            // Seg 100's t1Joint is joint 1, so reverseTangent enters at tVal=1
            // and the rear lands at tVal = 1 - 15/50 = 0.7.
            const frontPos: TrainPosition = {
                trackSegment: 101,
                tValue: 5 / SEG_LEN,
                direction: 'tangent',
                point: { x: SEG_LEN + 5, y: 0.5 },
            };
            const train = makeOneCarTrain(graph, jdm, frontPos);

            const bogiePositions = train.getBogiePositions();
            expect(bogiePositions).not.toBeNull();
            expect(bogiePositions!.length).toBe(2);

            const [front, rear] = bogiePositions!;
            expect(front.trackSegment).toBe(101);
            expect(rear.trackSegment).toBe(100);
            expect(rear.direction).toBe('reverseTangent');
            expect(rear.tValue).toBeCloseTo(0.7, 2);
        });
    });

    describe('Scenario 4: empty occupiedTrackSegments bootstrap', () => {
        it('populates occupiedTrackSegments after the first walk-back pass', () => {
            const graph = buildYTrackGraph();
            const jdm = new DefaultJointDirectionManager(graph);

            const frontPos: TrainPosition = {
                trackSegment: 102,
                tValue: 5 / SEG_LEN,
                direction: 'tangent',
                point: { x: SEG_LEN + 5, y: -0.5 },
            };
            const train = makeOneCarTrain(graph, jdm, frontPos);

            // Before any walk-back, the occupied list is empty.
            expect(train.occupiedTrackSegments).toEqual([]);

            train.getBogiePositions();

            // The seeding path at formation.ts:794-805 populates both the
            // head segment (102) and the segment the rear walked back into
            // (100).  This is the invariant a refactor must preserve.
            const trackNumbers = train.occupiedTrackSegments.map(
                s => s.trackNumber
            );
            expect(trackNumbers).toContain(102);
            expect(trackNumbers).toContain(100);
        });
    });

    describe('Scenario 5: default JDM prefer-occupied at a two-option joint', () => {
        it('rear bogie stays on the already-occupied lower branch (seg 102)', () => {
            const graph = buildYTrackGraph();
            const jdm = new DefaultJointDirectionManager(graph);

            // Step 1: place the train past the Y on the lower branch so the
            // body straddles joint 1.  This seeds occupiedTrackSegments with
            // [102, 100] (leading edge + walked-back segment).
            const seedPos: TrainPosition = {
                trackSegment: 102,
                tValue: 10 / SEG_LEN,
                direction: 'tangent',
                point: { x: SEG_LEN + 10, y: -1 },
            };
            const train = makeOneCarTrain(graph, jdm, seedPos);
            train.getBogiePositions();

            const seeded = train.occupiedTrackSegments.map(s => s.trackNumber);
            expect(seeded).toContain(102);

            // Step 2: reposition the front bogie back onto seg 100 with the
            // train now pointing reverseTangent (as if backing out).  The
            // walk-back expands in the tangent direction, crosses joint 1,
            // and faces two tangent options: seg 101 (joint 2) and seg 102
            // (joint 3).  The prefer-occupied heuristic at
            // train-kmt-state-machine.ts:107-117 should pick seg 102 because
            // it's the occupied branch, not seg 101.
            const backedOutPos: TrainPosition = {
                trackSegment: 100,
                tValue: 45 / SEG_LEN, // 5 units short of joint 1
                direction: 'reverseTangent',
                point: { x: 45, y: 0 },
            };
            invalidateBogieCache(train);
            train.setPosition(backedOutPos);

            const bogiePositions = train.getBogiePositions();
            expect(bogiePositions).not.toBeNull();
            const rear = bogiePositions![1];
            expect(rear.trackSegment).toBe(102);
            // 20 units walked: 5 to joint 1, 15 onto seg 102.  Seg 102
            // tangent enters at tVal=0, so rear ends at 15/50 = 0.3.
            expect(rear.tValue).toBeCloseTo(0.3, 2);
        });

        it('without prior occupancy, picks first-available (seg 101)', () => {
            // Counterpoint to the previous test: when occupiedTrackSegments
            // is empty, the default JDM falls through to "first available",
            // which is the first-inserted tangent neighbour of joint 1 (2).
            // Pins this behavior so the bootstrap path is visible in the
            // test suite.
            const graph = buildYTrackGraph();
            const jdm = new DefaultJointDirectionManager(graph);

            const backedOutPos: TrainPosition = {
                trackSegment: 100,
                tValue: 45 / SEG_LEN,
                direction: 'reverseTangent',
                point: { x: 45, y: 0 },
            };
            const train = makeOneCarTrain(graph, jdm, backedOutPos);

            const bogiePositions = train.getBogiePositions();
            expect(bogiePositions).not.toBeNull();
            const rear = bogiePositions![1];
            expect(rear.trackSegment).toBe(101);
        });
    });

    // -----------------------------------------------------------------------
    // Regression tests for the walk-back / forward-JDM separation.  These
    // exercise the exact class of bug the refactor fixes: walk-back must
    // always pick the occupied branch at an ambiguous joint, regardless of
    // what the train's forward JointDirectionManager would choose.
    // -----------------------------------------------------------------------
    describe('Scenario 2: revisited joint in a timetable route', () => {
        it('walk-back picks the occupied branch even when the route revisits the joint with a different next-step', () => {
            const graph = buildYTrackGraph();

            // Route revisits joint 1: the forward scan from currentIndex=0
            // finds joint 1 at index 1, next-step = joint 4 via seg 103.
            // Joint 1's reverseTangent set contains 4, so the direction
            // guard in TimetableJointDirectionManager passes — the timetable
            // JDM returns seg 103 for a reverseTangent query at joint 1.
            // But the train is physically on seg 100, so the correct rear
            // placement is seg 100.  Walk-back must ignore the route.
            const routeJoints: RouteJointStep[] = [
                { jointNumber: 0, direction: 'tangent' },
                { jointNumber: 1, direction: 'tangent' },
                { jointNumber: 4, direction: 'reverseTangent' },
                { jointNumber: 1, direction: 'tangent' },
                { jointNumber: 2, direction: 'tangent' },
            ];
            const jdm = new TimetableJointDirectionManager(
                graph,
                routeJoints,
                0
            );

            // Front bogie 5 units past joint 1 on the upper branch (seg 101).
            const frontPos: TrainPosition = {
                trackSegment: 101,
                tValue: 5 / SEG_LEN,
                direction: 'tangent',
                point: { x: SEG_LEN + 5, y: 0.5 },
            };
            const train = makeOneCarTrain(graph, jdm, frontPos);

            // Seed occupied: the train body is physically on [seg 101, seg 100]
            // — it came from joint 0 through joint 1 onto the upper branch.
            // Walk-back queries joint 1 reverseTangent; with this seeded
            // state, the correct branch is seg 100.
            (
                train as unknown as {
                    _occupiedTrackSegments: {
                        trackNumber: number;
                        inTrackDirection: 'tangent' | 'reverseTangent';
                    }[];
                }
            )._occupiedTrackSegments = [
                { trackNumber: 101, inTrackDirection: 'tangent' },
                { trackNumber: 100, inTrackDirection: 'tangent' },
            ];

            const bogiePositions = train.getBogiePositions();
            expect(bogiePositions).not.toBeNull();
            const rear = bogiePositions![1];
            // Before the refactor, the timetable JDM's forward scan would
            // mislead walk-back into seg 103 (the route's revisited branch).
            // After the refactor, walk-back uses its own resolver and lands
            // on the occupied branch (seg 100).
            expect(rear.trackSegment).toBe(100);
        });
    });

    describe('Scenario 3: currentIndex lag between onJointsPassed and walk-back', () => {
        it('walk-back picks the occupied branch even when the timetable currentIndex still points at the just-crossed joint', () => {
            const graph = buildYTrackGraph();

            // Route: [0, 1, 4, 2].  Joint 1 is at index 1.  currentIndex=0,
            // as if the front just crossed joint 1 but onJointsPassed
            // hasn't fired yet.  Forward scan finds joint 1 at index 1,
            // next-step = joint 4 via seg 103, direction guard passes
            // (joint 1.reverseTangent contains 4), and the timetable JDM
            // returns seg 103 — again, wrong for walk-back.
            const routeJoints: RouteJointStep[] = [
                { jointNumber: 0, direction: 'tangent' },
                { jointNumber: 1, direction: 'tangent' },
                { jointNumber: 4, direction: 'reverseTangent' },
                { jointNumber: 2, direction: 'tangent' },
            ];
            const jdm = new TimetableJointDirectionManager(
                graph,
                routeJoints,
                0
            );

            const frontPos: TrainPosition = {
                trackSegment: 101,
                tValue: 5 / SEG_LEN,
                direction: 'tangent',
                point: { x: SEG_LEN + 5, y: 0.5 },
            };
            const train = makeOneCarTrain(graph, jdm, frontPos);

            (
                train as unknown as {
                    _occupiedTrackSegments: {
                        trackNumber: number;
                        inTrackDirection: 'tangent' | 'reverseTangent';
                    }[];
                }
            )._occupiedTrackSegments = [
                { trackNumber: 101, inTrackDirection: 'tangent' },
                { trackNumber: 100, inTrackDirection: 'tangent' },
            ];

            const bogiePositions = train.getBogiePositions();
            expect(bogiePositions).not.toBeNull();
            const rear = bogiePositions![1];
            expect(rear.trackSegment).toBe(100);
        });
    });
});
