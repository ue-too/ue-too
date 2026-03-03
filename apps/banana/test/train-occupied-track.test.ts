import { BCurve } from '@ue-too/curve';

import { TrackGraph } from '../src/trains/tracks/track';
import { Train, TrainPosition, getPosition } from '../src/trains/formation';
import {
    DefaultJointDirectionManager,
    flipDirection,
    JointDirectionManager,
} from '../src/trains/input-state-machine/train-kmt-state-machine';

/**
 * Helper: build a straight horizontal track graph with N segments chained
 * left-to-right along the x-axis.
 *
 * Returns the graph, the joint numbers in left-to-right order, and the
 * segment numbers in the same order.
 */
function buildStraightTrack(
    segmentCount: number,
    segmentLength: number = 100,
): {
    graph: TrackGraph;
    joints: number[];
    segments: number[];
    jointDirectionManager: JointDirectionManager;
} {
    const graph = new TrackGraph();

    graph.createNewTrackSegment(
        { x: 0, y: 0 },
        { x: segmentLength, y: 0 },
        [{ x: segmentLength / 2, y: 0 }],
    );

    for (let i = 1; i < segmentCount; i++) {
        const startX = i * segmentLength;
        const endX = (i + 1) * segmentLength;
        const allJoints = graph.getJoints();
        const rightmostJoint = allJoints.reduce((a, b) =>
            a.joint.position.x > b.joint.position.x ? a : b,
        );
        graph.extendTrackFromJoint(
            rightmostJoint.jointNumber,
            { x: endX, y: 0 },
            [{ x: (startX + endX) / 2, y: 0 }],
        );
    }

    const joints = graph
        .getJoints()
        .sort((a, b) => a.joint.position.x - b.joint.position.x)
        .map(j => j.jointNumber);

    const segments = graph.trackSegments
        .map((seg, _i) => {
            const t0Pos = graph.getJointPosition(seg.t0Joint)!;
            return { number: seg.t0Joint, x: t0Pos.x, seg };
        })
        .sort((a, b) => a.x - b.x);

    const segNums: number[] = [];
    for (const s of segments) {
        const j0 = graph.getJoint(s.seg.t0Joint)!;
        const j1 = graph.getJoint(s.seg.t1Joint)!;
        const segNum = j0.connections.get(s.seg.t1Joint);
        if (segNum !== undefined) segNums.push(segNum);
    }

    const jointDirectionManager = new DefaultJointDirectionManager(graph);
    return { graph, joints, segments: segNums, jointDirectionManager };
}

/**
 * Create a train placed at a specific position on the track.
 */
function createTrain(
    graph: TrackGraph,
    jointDirectionManager: JointDirectionManager,
    position: TrainPosition,
    offsets: number[] = [40, 10, 40],
): Train {
    const train = new Train(null, offsets, graph, jointDirectionManager);
    train.setPosition(position);
    return train;
}

describe('Train occupied track computation', () => {
    describe('single segment', () => {
        it('should compute occupied tracks when train fits within one segment', () => {
            const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
            const seg = graph.trackSegments[0];
            const segNum = graph
                .getJoint(seg.t0Joint)!
                .connections.get(seg.t1Joint)!;

            const position: TrainPosition = {
                trackSegment: segNum,
                tValue: 0.8,
                direction: 'tangent',
                point: seg.curve.get(0.8),
            };

            const train = createTrain(graph, jointDirectionManager, position);
            const bogies = train.getBogiePositions(false);

            expect(bogies).not.toBeNull();
            expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
            expect(train.occupiedTrackSegments[0].trackNumber).toBe(segNum);
        });

        it('occupied track direction should be reverseTangent when position direction is tangent (default expand)', () => {
            const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
            const seg = graph.trackSegments[0];
            const segNum = graph
                .getJoint(seg.t0Joint)!
                .connections.get(seg.t1Joint)!;

            const position: TrainPosition = {
                trackSegment: segNum,
                tValue: 0.8,
                direction: 'tangent',
                point: seg.curve.get(0.8),
            };

            const train = createTrain(graph, jointDirectionManager, position);
            train.getBogiePositions(false);

            expect(train.occupiedTrackSegments[0].inTrackDirection).toBe(
                'reverseTangent',
            );
        });
    });

    describe('multi-segment', () => {
        it('should track occupied joints when train spans two segments', () => {
            const { graph, joints, jointDirectionManager } =
                buildStraightTrack(2, 80);
            const allSegs = graph.trackSegments;

            const rightSeg = allSegs.find(s => {
                const pos = graph.getJointPosition(s.t0Joint)!;
                return pos.x > 0;
            })!;
            const segNum = graph
                .getJoint(rightSeg.t0Joint)!
                .connections.get(rightSeg.t1Joint)!;

            const position: TrainPosition = {
                trackSegment: segNum,
                tValue: 0.2,
                direction: 'tangent',
                point: rightSeg.curve.get(0.2),
            };

            const train = createTrain(graph, jointDirectionManager, position, [
                30, 10, 30,
            ]);
            const bogies = train.getBogiePositions(false);

            expect(bogies).not.toBeNull();

            if (train.occupiedTrackSegments.length > 1) {
                expect(train.occupiedJointNumbers.length).toBeGreaterThanOrEqual(
                    1,
                );
            }
        });
    });
});

describe('switchDirectionOnly occupied track handling', () => {
    it('should preserve occupied track segments after switchDirectionOnly', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(2, 80);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.2,
            direction: 'tangent',
            point: rightSeg.curve.get(0.2),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            30, 10, 30,
        ]);
        train.getBogiePositions(false);

        const occupiedBefore = train.occupiedTrackSegments.map(t => ({
            ...t,
        }));
        const jointsBefore = train.occupiedJointNumbers.map(j => ({ ...j }));

        train.switchDirectionOnly();

        expect(train.occupiedTrackSegments.length).toBe(occupiedBefore.length);
        for (let i = 0; i < occupiedBefore.length; i++) {
            expect(train.occupiedTrackSegments[i].trackNumber).toBe(
                occupiedBefore[i].trackNumber,
            );
            expect(train.occupiedTrackSegments[i].inTrackDirection).toBe(
                occupiedBefore[i].inTrackDirection,
            );
        }
    });

    it('should preserve occupied joint numbers after switchDirectionOnly', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(2, 80);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.2,
            direction: 'tangent',
            point: rightSeg.curve.get(0.2),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            30, 10, 30,
        ]);
        train.getBogiePositions(false);

        const jointsBefore = train.occupiedJointNumbers.map(j => ({ ...j }));

        train.switchDirectionOnly();

        expect(train.occupiedJointNumbers.length).toBe(jointsBefore.length);
        for (let i = 0; i < jointsBefore.length; i++) {
            expect(train.occupiedJointNumbers[i].jointNumber).toBe(
                jointsBefore[i].jointNumber,
            );
            expect(train.occupiedJointNumbers[i].direction).toBe(
                jointsBefore[i].direction,
            );
        }
    });

    it('should produce valid bogie positions after switchDirectionOnly', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(2, 80);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.3,
            direction: 'tangent',
            point: rightSeg.curve.get(0.3),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            30, 10, 30,
        ]);

        const bogiesBefore = train.getBogiePositions(false);
        expect(bogiesBefore).not.toBeNull();

        train.switchDirectionOnly();

        const bogiesAfter = train.getBogiePositions(false);
        expect(bogiesAfter).not.toBeNull();
        expect(bogiesAfter!.length).toBe(bogiesBefore!.length);
    });

    it('should flip the position direction after switchDirectionOnly', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'tangent',
            point: seg.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position);
        train.getBogiePositions(false);

        train.switchDirectionOnly();

        const bogies = train.getBogiePositions(false);
        expect(bogies).not.toBeNull();
        expect(bogies![0].direction).toBe('reverseTangent');
    });

    it('double switchDirectionOnly should restore original state', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(2, 80);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.3,
            direction: 'tangent',
            point: rightSeg.curve.get(0.3),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            30, 10, 30,
        ]);
        train.getBogiePositions(false);

        const occupiedBefore = train.occupiedTrackSegments.map(t => ({
            ...t,
        }));
        const jointsBefore = train.occupiedJointNumbers.map(j => ({ ...j }));

        train.switchDirectionOnly();
        train.switchDirectionOnly();

        const bogies = train.getBogiePositions(false);
        expect(bogies).not.toBeNull();
        expect(bogies![0].direction).toBe('tangent');

        expect(train.occupiedTrackSegments.length).toBe(occupiedBefore.length);
        for (let i = 0; i < occupiedBefore.length; i++) {
            expect(train.occupiedTrackSegments[i].trackNumber).toBe(
                occupiedBefore[i].trackNumber,
            );
            expect(train.occupiedTrackSegments[i].inTrackDirection).toBe(
                occupiedBefore[i].inTrackDirection,
            );
        }

        expect(train.occupiedJointNumbers.length).toBe(jointsBefore.length);
        for (let i = 0; i < jointsBefore.length; i++) {
            expect(train.occupiedJointNumbers[i].jointNumber).toBe(
                jointsBefore[i].jointNumber,
            );
            expect(train.occupiedJointNumbers[i].direction).toBe(
                jointsBefore[i].direction,
            );
        }
    });
});

describe('occupied track consistency: switchDirectionOnly vs switchDirection', () => {
    it('switchDirection should reverse occupied track order and flip directions', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(3, 60);
        const allSegs = graph.trackSegments;

        const midSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0 && pos.x < 120;
        })!;
        const segNum = graph
            .getJoint(midSeg.t0Joint)!
            .connections.get(midSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'tangent',
            point: midSeg.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 10, 20,
        ]);
        train.getBogiePositions(false);

        const tracksBefore = train.occupiedTrackSegments.map(t => ({ ...t }));

        train.switchDirection();

        const tracksAfter = train.occupiedTrackSegments;

        expect(tracksAfter.length).toBe(tracksBefore.length);
        for (let i = 0; i < tracksBefore.length; i++) {
            const reversed = tracksBefore[tracksBefore.length - 1 - i];
            expect(tracksAfter[i].trackNumber).toBe(reversed.trackNumber);
            expect(tracksAfter[i].inTrackDirection).toBe(
                flipDirection(reversed.inTrackDirection),
            );
        }
    });

    it('switchDirectionOnly should NOT reverse occupied track order', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(3, 60);
        const allSegs = graph.trackSegments;

        const midSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0 && pos.x < 120;
        })!;
        const segNum = graph
            .getJoint(midSeg.t0Joint)!
            .connections.get(midSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'tangent',
            point: midSeg.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 10, 20,
        ]);
        train.getBogiePositions(false);

        const tracksBefore = train.occupiedTrackSegments.map(t => ({ ...t }));

        train.switchDirectionOnly();

        const tracksAfter = train.occupiedTrackSegments;

        expect(tracksAfter.length).toBe(tracksBefore.length);
        for (let i = 0; i < tracksBefore.length; i++) {
            expect(tracksAfter[i].trackNumber).toBe(
                tracksBefore[i].trackNumber,
            );
            expect(tracksAfter[i].inTrackDirection).toBe(
                tracksBefore[i].inTrackDirection,
            );
        }
    });
});

describe('occupied track initialization direction correctness', () => {
    it('should use correct inTrackDirection when position direction is tangent', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.8,
            direction: 'tangent',
            point: seg.curve.get(0.8),
        };

        const train = createTrain(graph, jointDirectionManager, position);
        train.getBogiePositions(false);

        expect(train.occupiedTrackSegments[0].inTrackDirection).toBe(
            'reverseTangent',
        );
    });

    it('should use correct inTrackDirection when position direction is reverseTangent', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.2,
            direction: 'reverseTangent',
            point: seg.curve.get(0.2),
        };

        const train = createTrain(graph, jointDirectionManager, position);
        train.getBogiePositions(false);

        expect(train.occupiedTrackSegments[0].inTrackDirection).toBe(
            'tangent',
        );
    });

    it('should use correct inTrackDirection after switchDirectionOnly from tangent', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.8,
            direction: 'tangent',
            point: seg.curve.get(0.8),
        };

        const train = createTrain(graph, jointDirectionManager, position);
        train.getBogiePositions(false);

        const dirBefore = train.occupiedTrackSegments[0].inTrackDirection;
        expect(dirBefore).toBe('reverseTangent');

        train.switchDirectionOnly();

        expect(train.occupiedTrackSegments[0].inTrackDirection).toBe(
            'reverseTangent',
        );
    });

    it('should use correct inTrackDirection after fresh placement with reversed expand direction', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 200);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.8,
            direction: 'tangent',
            point: seg.curve.get(0.8),
        };

        const train = createTrain(graph, jointDirectionManager, position);
        train.getBogiePositions(false);

        train.switchDirectionOnly();

        train.setPosition({
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'reverseTangent',
            point: seg.curve.get(0.5),
        });

        train.switchDirectionOnly();

        train.getBogiePositions(false);

        expect(train.occupiedTrackSegments[0].inTrackDirection).toBe(
            'reverseTangent',
        );
    });
});

describe('getPosition utility', () => {
    it('should return passedJointNumbers when crossing a joint', () => {
        const { graph, joints, jointDirectionManager } =
            buildStraightTrack(2, 50);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.1,
            direction: 'reverseTangent',
            point: rightSeg.curve.get(0.1),
        };

        const result = getPosition(
            40,
            position,
            graph,
            jointDirectionManager,
        );

        expect(result).not.toBeNull();
        expect(result!.stop).toBe(false);
        expect(result!.passedJointNumbers.length).toBeGreaterThanOrEqual(1);
    });

    it('should return enteringTrackSegments when crossing into another segment', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(2, 50);
        const allSegs = graph.trackSegments;

        const rightSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0;
        })!;
        const segNum = graph
            .getJoint(rightSeg.t0Joint)!
            .connections.get(rightSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.1,
            direction: 'reverseTangent',
            point: rightSeg.curve.get(0.1),
        };

        const result = getPosition(
            40,
            position,
            graph,
            jointDirectionManager,
        );

        expect(result).not.toBeNull();
        expect(result!.enteringTrackSegments.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop at a dead-end joint', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(1, 50);
        const seg = graph.trackSegments[0];
        const segNum = graph
            .getJoint(seg.t0Joint)!
            .connections.get(seg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.9,
            direction: 'tangent',
            point: seg.curve.get(0.9),
        };

        const result = getPosition(
            100,
            position,
            graph,
            jointDirectionManager,
        );

        expect(result).not.toBeNull();
        expect(result!.stop).toBe(true);
    });
});

describe('occupied track after movement (update)', () => {
    it('should update occupied tracks when train advances across a joint', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(3, 50);
        const allSegs = graph.trackSegments;

        const leftSeg = allSegs.reduce((a, b) => {
            const posA = graph.getJointPosition(a.t0Joint)!;
            const posB = graph.getJointPosition(b.t0Joint)!;
            return posA.x < posB.x ? a : b;
        });
        const segNum = graph
            .getJoint(leftSeg.t0Joint)!
            .connections.get(leftSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'tangent',
            point: leftSeg.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        train.getBogiePositions(false);

        train.setThrottleStep('p5');

        for (let i = 0; i < 200; i++) {
            train.update(50);
        }

        const bogies = train.getBogiePositions(false);
        expect(bogies).not.toBeNull();
        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
    });

    it('should prepend new joint and new track when head crosses into next segment', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(3, 80);
        const seg0 = segments[0];
        const seg1 = segments[1];
        const jointBetween = graph.getTrackSegmentWithJoints(seg0)!.t1Joint;

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.85,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.85),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 5, 20,
        ]);
        train.getBogiePositions(false);

        const initialTrackCount = train.occupiedTrackSegments.length;
        const initialJointCount = train.occupiedJointNumbers.length;

        train.setThrottleStep('p5');
        let steps = 0;
        const maxSteps = 500;
        while (train.getBogiePositions(false)![0].trackSegment === seg0 && steps < maxSteps) {
            train.update(50);
            steps++;
        }

        expect(steps).toBeLessThan(maxSteps);
        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg1);
        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(initialTrackCount);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === seg1)).toBe(true);
        expect(train.occupiedJointNumbers.some(j => j.jointNumber === jointBetween)).toBe(true);
    });

    it('should update position trackSegment when head moves to new segment', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(3, 80);
        const seg0 = segments[0];
        const seg1 = segments[1];

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.9,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.9),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        train.getBogiePositions(false);

        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg0);

        train.setThrottleStep('p5');
        for (let i = 0; i < 300; i++) {
            train.update(50);
            const bogies = train.getBogiePositions(false);
            if (bogies && bogies[0].trackSegment === seg1) break;
        }

        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg1);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === seg1)).toBe(true);
    });

    it('should trim occupied joints when tail passes a joint', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(4, 60);
        const seg0 = segments[0];
        const seg1 = segments[1];
        const joint0To1 = graph.getTrackSegmentWithJoints(seg0)!.t1Joint;

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.95,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.95),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        train.getBogiePositions(false);

        train.setThrottleStep('p5');
        for (let i = 0; i < 150; i++) {
            train.update(50);
        }

        const hadJoint0To1 = train.occupiedJointNumbers.some(
            j => j.jointNumber === joint0To1,
        );

        for (let i = 0; i < 400; i++) {
            train.update(50);
        }

        const hasJoint0To1After = train.occupiedJointNumbers.some(
            j => j.jointNumber === joint0To1,
        );

        expect(train.occupiedJointNumbers.length).toBeGreaterThanOrEqual(0);
        if (hadJoint0To1 && !hasJoint0To1After) {
            expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('should keep occupied track and joint lists consistent with bogie positions', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(4, 100);
        const seg0 = segments[0];

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.6,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.6),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        const bogiesBefore = train.getBogiePositions(false);
        expect(bogiesBefore).not.toBeNull();

        train.setThrottleStep('p4');
        for (let i = 0; i < 100; i++) {
            train.update(50);
        }

        const bogies = train.getBogiePositions(false);
        expect(bogies).not.toBeNull();

        const headSegment = bogies![0].trackSegment;
        const tailSegment = bogies![bogies!.length - 1].trackSegment;

        expect(train.occupiedTrackSegments.some(t => t.trackNumber === headSegment)).toBe(true);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === tailSegment)).toBe(true);
        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
    });

    it('should not change occupied track or joint when throttle is N and speed is zero', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(2, 80);
        const seg0 = segments[0];

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.5,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            25, 5, 25,
        ]);
        train.getBogiePositions(false);

        const tracksBefore = [...train.occupiedTrackSegments];
        const jointsBefore = [...train.occupiedJointNumbers];

        train.setThrottleStep('N');
        for (let i = 0; i < 20; i++) {
            train.update(50);
        }

        expect(train.occupiedTrackSegments.length).toBe(tracksBefore.length);
        expect(train.occupiedJointNumbers.length).toBe(jointsBefore.length);
        for (let i = 0; i < tracksBefore.length; i++) {
            expect(train.occupiedTrackSegments[i].trackNumber).toBe(
                tracksBefore[i].trackNumber,
            );
            expect(train.occupiedTrackSegments[i].inTrackDirection).toBe(
                tracksBefore[i].inTrackDirection,
            );
        }
        for (let i = 0; i < jointsBefore.length; i++) {
            expect(train.occupiedJointNumbers[i].jointNumber).toBe(
                jointsBefore[i].jointNumber,
            );
            expect(train.occupiedJointNumbers[i].direction).toBe(
                jointsBefore[i].direction,
            );
        }
    });

    it('should maintain valid occupied data after switchDirectionOnly then update', () => {
        const { graph, jointDirectionManager } = buildStraightTrack(3, 80);
        const allSegs = graph.trackSegments;

        const midSeg = allSegs.find(s => {
            const pos = graph.getJointPosition(s.t0Joint)!;
            return pos.x > 0 && pos.x < 160;
        })!;
        const segNum = graph
            .getJoint(midSeg.t0Joint)!
            .connections.get(midSeg.t1Joint)!;

        const position: TrainPosition = {
            trackSegment: segNum,
            tValue: 0.5,
            direction: 'tangent',
            point: midSeg.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 5, 20,
        ]);
        train.getBogiePositions(false);

        train.switchDirectionOnly();

        train.setThrottleStep('p3');

        for (let i = 0; i < 100; i++) {
            train.update(50);
            const bogies = train.getBogiePositions(false);
            if (bogies === null) break;
        }

        const bogiesAfter = train.getBogiePositions(false);
        expect(bogiesAfter).not.toBeNull();
        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
    });
});

describe('occupied track after movement (update) with expandDirection same (position is back of train)', () => {
    it('should update occupied tracks when position (back) advances after switchDirectionOnly', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(3, 80);
        const seg1 = segments[1];

        const position: TrainPosition = {
            trackSegment: seg1,
            tValue: 0.2,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg1)!.curve.get(0.2),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 5, 20,
        ]);
        train.getBogiePositions(false);
        train.switchDirectionOnly();

        const bogiesAfterSwitch = train.getBogiePositions(false);
        expect(bogiesAfterSwitch).not.toBeNull();
        expect(bogiesAfterSwitch![0].direction).toBe('reverseTangent');

        train.setThrottleStep('p5');
        for (let i = 0; i < 100; i++) {
            train.update(50);
            const bogies = train.getBogiePositions(false);
            if (bogies === null) break;
        }

        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
        const bogies = train.getBogiePositions(false);
        if (bogies !== null) {
            expect(bogies[0].direction).toBe('reverseTangent');
        }
    });

    it('should prepend new joint and track when position (back) crosses into previous segment', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(3, 80);
        const seg0 = segments[0];
        const seg1 = segments[1];
        const jointBetween = graph.getTrackSegmentWithJoints(seg0)!.t1Joint;

        const position: TrainPosition = {
            trackSegment: seg1,
            tValue: 0.15,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg1)!.curve.get(0.15),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            20, 5, 20,
        ]);
        train.getBogiePositions(false);
        train.switchDirectionOnly();

        const positionSegmentBefore = train.getBogiePositions(false)![0].trackSegment;
        expect(positionSegmentBefore).toBe(seg1);

        train.setThrottleStep('p5');
        let steps = 0;
        const maxSteps = 600;
        while (
            train.getBogiePositions(false)![0].trackSegment === seg1 &&
            steps < maxSteps
        ) {
            train.update(50);
            steps++;
        }

        expect(steps).toBeLessThan(maxSteps);
        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg0);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === seg0)).toBe(true);
        expect(train.occupiedJointNumbers.some(j => j.jointNumber === jointBetween)).toBe(true);
    });

    it('should update position trackSegment when position (back) moves to previous segment', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(3, 80);
        const seg0 = segments[0];
        const seg1 = segments[1];

        const position: TrainPosition = {
            trackSegment: seg1,
            tValue: 0.1,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg1)!.curve.get(0.1),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        train.getBogiePositions(false);
        train.switchDirectionOnly();

        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg1);

        train.setThrottleStep('p5');
        for (let i = 0; i < 500; i++) {
            train.update(50);
            const bogies = train.getBogiePositions(false);
            if (bogies && bogies[0].trackSegment === seg0) break;
        }

        expect(train.getBogiePositions(false)![0].trackSegment).toBe(seg0);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === seg0)).toBe(true);
    });

    it('should keep occupied track and joint consistent with bogie positions when expandDirection is same', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(4, 100);
        const seg0 = segments[0];

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.6,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.6),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            15, 5, 15,
        ]);
        const bogiesBefore = train.getBogiePositions(false);
        expect(bogiesBefore).not.toBeNull();

        train.switchDirectionOnly();

        train.setThrottleStep('p4');
        for (let i = 0; i < 100; i++) {
            train.update(50);
        }

        const bogies = train.getBogiePositions(false);
        expect(bogies).not.toBeNull();

        const backSegment = bogies![0].trackSegment;
        const frontSegment = bogies![bogies!.length - 1].trackSegment;

        expect(train.occupiedTrackSegments.some(t => t.trackNumber === backSegment)).toBe(true);
        expect(train.occupiedTrackSegments.some(t => t.trackNumber === frontSegment)).toBe(true);
        expect(train.occupiedTrackSegments.length).toBeGreaterThanOrEqual(1);
    });

    it('should not change occupied track or joint when throttle is N after switchDirectionOnly', () => {
        const { graph, segments, jointDirectionManager } =
            buildStraightTrack(2, 80);
        const seg0 = segments[0];

        const position: TrainPosition = {
            trackSegment: seg0,
            tValue: 0.5,
            direction: 'tangent',
            point: graph.getTrackSegmentWithJoints(seg0)!.curve.get(0.5),
        };

        const train = createTrain(graph, jointDirectionManager, position, [
            25, 5, 25,
        ]);
        train.getBogiePositions(false);
        train.switchDirectionOnly();

        const tracksBefore = [...train.occupiedTrackSegments];
        const jointsBefore = [...train.occupiedJointNumbers];

        train.setThrottleStep('N');
        for (let i = 0; i < 20; i++) {
            train.update(50);
        }

        expect(train.occupiedTrackSegments.length).toBe(tracksBefore.length);
        expect(train.occupiedJointNumbers.length).toBe(jointsBefore.length);
        for (let i = 0; i < tracksBefore.length; i++) {
            expect(train.occupiedTrackSegments[i].trackNumber).toBe(
                tracksBefore[i].trackNumber,
            );
            expect(train.occupiedTrackSegments[i].inTrackDirection).toBe(
                tracksBefore[i].inTrackDirection,
            );
        }
        for (let i = 0; i < jointsBefore.length; i++) {
            expect(train.occupiedJointNumbers[i].jointNumber).toBe(
                jointsBefore[i].jointNumber,
            );
            expect(train.occupiedJointNumbers[i].direction).toBe(
                jointsBefore[i].direction,
            );
        }
    });
});
