import {
    BaseContext,
    EventReactions,
    NO_OP,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';
import { Point, PointCal } from '@ue-too/math';

import { TrackGraph } from '../tracks/track';
import { Train, TrainPosition } from '../formation';

export type TrainPlacementStates = 'IDLE' | 'HOVER_FOR_PLACEMENT';

export type TrainPlacementEvents = {
    pointerdown: {
        position: Point;
    };
    pointerup: {
        position: Point;
    };
    pointermove: {
        position: Point;
    };
    escapeKey: {};
    startPlacement: {};
    endPlacement: {};
    flipTrainDirection: {};
};

export interface TrainPlacementContext extends BaseContext {
    cancelCurrentTrainPlacement: () => void;
    placeTrain: (position: Point) => void;
    hoverForPlacement: (position: Point) => void;
    flipTrainDirection: () => void;
}

export function flipDirection(
    direction: 'tangent' | 'reverseTangent'
): 'tangent' | 'reverseTangent' {
    return direction === 'tangent' ? 'reverseTangent' : 'tangent';
}

export interface JointDirectionManager {
    getNextJoint(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent',
        occupiedJoints?: {
            jointNumber: number;
            direction: 'tangent' | 'reverseTangent';
        }[],
        occupiedTrackSegments?: {
            trackNumber: number;
            inTrackDirection: 'tangent' | 'reverseTangent';
        }[]
    ): {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
        curveNumber: number;
    } | null;
}

export class DefaultJointDirectionManager implements JointDirectionManager {
    private _trackGraph: TrackGraph;

    constructor(trackGraph: TrackGraph) {
        this._trackGraph = trackGraph;
    }

    getNextJoint(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent',
        occupiedJoints?: {
            jointNumber: number;
            direction: 'tangent' | 'reverseTangent';
        }[],
        occupiedTrackSegments?: {
            trackNumber: number;
            inTrackDirection: 'tangent' | 'reverseTangent';
        }[]
    ): {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
        curveNumber: number;
    } | null {
        const joint = this._trackGraph.getJoint(jointNumber);
        if (joint === null) {
            console.warn('starting joint not found');
            return null;
        }

        // short circuit
        if (occupiedJoints && occupiedJoints.length > 0) {
            for (let i = 0; i < occupiedJoints.length; i++) {
                if (
                    occupiedJoints[i].jointNumber === jointNumber &&
                    occupiedJoints[i].direction === direction
                ) {
                    if (i < occupiedJoints.length - 1) {
                        const nextJointNumber =
                            occupiedJoints[i + 1].jointNumber;
                        const nextTrackSegmentNumber =
                            joint.connections.get(nextJointNumber);
                        const nextJoint =
                            this._trackGraph.getJoint(nextJointNumber);
                        if (nextJoint === null) {
                            console.warn(
                                'next joint not found, something wrong about the occupied joints'
                            );
                            return null;
                        }
                        if (nextTrackSegmentNumber === undefined) {
                            console.warn(
                                'next track segment is not connected to the joint, something wrong about the occupied joints'
                            );
                            return null;
                        }
                        const nextTrack =
                            this._trackGraph.getTrackSegmentWithJoints(
                                nextTrackSegmentNumber
                            );
                        if (nextTrack === null) {
                            console.warn(
                                'next track segment is not found, something wrong about the occupied joints'
                            );
                            return null;
                        }
                        const nextDirection: 'tangent' | 'reverseTangent' =
                            nextTrack.t0Joint === jointNumber
                                ? 'tangent'
                                : 'reverseTangent';
                        return {
                            jointNumber: nextJointNumber,
                            direction: nextDirection,
                            curveNumber: nextTrackSegmentNumber,
                        };
                    } else if (
                        occupiedTrackSegments &&
                        occupiedTrackSegments.length > 0
                    ) {
                        const lastOccupiedTrack =
                            occupiedTrackSegments[
                            occupiedTrackSegments.length - 1
                            ];
                        const lastOccupiedTrackSegment =
                            this._trackGraph.getTrackSegmentWithJoints(
                                lastOccupiedTrack.trackNumber
                            );
                        if (lastOccupiedTrackSegment == null) {
                            console.warn(
                                'last occupied track segment not found'
                            );
                            break;
                        }
                        const nextJointNumber =
                            lastOccupiedTrack.inTrackDirection === 'tangent'
                                ? lastOccupiedTrackSegment.t1Joint
                                : lastOccupiedTrackSegment.t0Joint;
                        const nextJoint =
                            this._trackGraph.getJoint(nextJointNumber);
                        if (nextJoint == null) {
                            console.warn('next joint not found');
                            break;
                        }
                        return {
                            jointNumber: nextJointNumber,
                            curveNumber: lastOccupiedTrack.trackNumber,
                            direction: lastOccupiedTrack.inTrackDirection,
                        };
                    }
                }
            }
        }
        // short circuit

        const possibleNextJoints = joint.direction[direction];
        if (possibleNextJoints.size === 0) {
            console.warn('no possible next joints');
            return null;
        }
        const firstNextJointNumber: number | undefined = possibleNextJoints
            .values()
            .next().value;
        if (firstNextJointNumber === undefined) {
            return null;
        }
        const firstNextTrackSegmentNumber =
            joint.connections.get(firstNextJointNumber);
        const firstNextJoint = this._trackGraph.getJoint(firstNextJointNumber);
        if (firstNextTrackSegmentNumber === undefined) {
            return null;
        }
        const firstNextTrackSegment =
            this._trackGraph.getTrackSegmentWithJoints(
                firstNextTrackSegmentNumber
            );
        if (firstNextJoint === null) {
            console.warn('first next joint not found');
            return null;
        }
        if (firstNextTrackSegment === null) {
            console.warn('first next track segment not found');
            return null;
        }
        let nextDirection: 'tangent' | 'reverseTangent' =
            firstNextTrackSegment.t0Joint === jointNumber
                ? 'tangent'
                : 'reverseTangent';
        return {
            jointNumber: firstNextJointNumber,
            direction: nextDirection,
            curveNumber: firstNextTrackSegmentNumber,
        };
    }
}

export class TrainPlacementEngine implements TrainPlacementContext {
    private _trackGraph: TrackGraph;
    private _trainTangent: Point | null = null;

    private _jointDirectionManager: JointDirectionManager;
    private _potentialTrainPlacement: TrainPosition | null = null;
    private _train: Train;

    constructor(trackGraph: TrackGraph) {
        this._trackGraph = trackGraph;
        this._jointDirectionManager = new DefaultJointDirectionManager(
            trackGraph
        );
        this._train = new Train(
            1,
            null,
            [40, 10, 40, 10, 40],
            trackGraph,
            this._jointDirectionManager
        );
    }

    cancelCurrentTrainPlacement() {
        this._train.clearPreviewPosition();
    }

    get train(): Train {
        return this._train;
    }

    placeTrain() {
        const previewPosition = this._train.getPreviewPosition();
        if (previewPosition === null) {
            console.warn('no preview position');
            return;
        }
        this._train.setPosition(previewPosition);
        this._train.clearPreviewPosition();
        console.log('placed train');
    }

    hoverForPlacement(position: Point) {
        const res = this._trackGraph.project(position);
        if (res.hit) {
            switch (res.hitType) {
                // case "joint":
                //     this._previewPosition = res.position;
                //     const joint = this._trackGraph.getJoint(res.jointNumber);
                //     if(joint == undefined){
                //         console.warn("joint not found");
                //         return;
                //     }
                //     const connection = joint.connections.values().next().value;

                //     break;
                case 'curve':
                    const trackSegment =
                        this._trackGraph.getTrackSegmentWithJoints(res.curve);
                    if (trackSegment == undefined) {
                        console.warn('track segment not found');
                        return;
                    }
                    this._potentialTrainPlacement = {
                        trackSegment: res.curve,
                        tValue: res.atT,
                        direction: 'tangent',
                        point: res.projectionPoint,
                    };
                    this._train.getPreviewBogiePositions(
                        this._potentialTrainPlacement
                    );
                    break;
            }
        } else {
            this._train.clearPreviewPosition();
        }
    }

    flipTrainDirection() {
        this._train.flipTrainDirection();
    }

    setup() {
        // TODO: setup
    }

    cleanup() {
        // TODO: cleanup
    }
}

export class TrainPlacementStateMachine extends TemplateStateMachine<
    TrainPlacementEvents,
    TrainPlacementContext,
    TrainPlacementStates
> {
    constructor(context: TrainPlacementContext) {
        super(
            {
                IDLE: new TrainPlacementIDLEState(),
                HOVER_FOR_PLACEMENT: new TrainPlacementHoverForPlacementState(),
            },
            'IDLE',
            context
        );
    }
}

export class TrainPlacementIDLEState extends TemplateState<
    TrainPlacementEvents,
    TrainPlacementContext,
    TrainPlacementStates
> {
    protected _eventReactions: EventReactions<
        TrainPlacementEvents,
        TrainPlacementContext,
        TrainPlacementStates
    > = {
            startPlacement: {
                action: NO_OP,
                defaultTargetState: 'HOVER_FOR_PLACEMENT',
            },
        };
}

export class TrainPlacementHoverForPlacementState extends TemplateState<
    TrainPlacementEvents,
    TrainPlacementContext,
    TrainPlacementStates
> {
    protected _eventReactions: EventReactions<
        TrainPlacementEvents,
        TrainPlacementContext,
        TrainPlacementStates
    > = {
            endPlacement: {
                action: context => {
                    context.cancelCurrentTrainPlacement();
                },
                defaultTargetState: 'IDLE',
            },
            pointerup: {
                action: (context, event) => {
                    context.placeTrain(event.position);
                },
                defaultTargetState: 'HOVER_FOR_PLACEMENT',
            },
            pointermove: {
                action: (context, event) => {
                    context.hoverForPlacement(event.position);
                },
                defaultTargetState: 'HOVER_FOR_PLACEMENT',
            },
            escapeKey: {
                action: context => {
                    context.cancelCurrentTrainPlacement();
                },
                defaultTargetState: 'IDLE',
            },
            flipTrainDirection: {
                action: context => {
                    context.flipTrainDirection();
                },
                defaultTargetState: 'HOVER_FOR_PLACEMENT',
            },
        };
}
