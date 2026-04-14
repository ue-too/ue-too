import {
    BaseContext,
    EventReactions,
    NO_OP,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';
import {
    Canvas,
    ObservableBoardCamera,
    ObservableInputTracker,
    convertFromCanvas2ViewPort,
    convertFromCanvas2Window,
    convertFromViewPort2Canvas,
    convertFromViewport2World,
    convertFromWindow2Canvas,
    convertFromWorld2Viewport,
} from '@ue-too/board';
import { Point, PointCal } from '@ue-too/math';

import { Formation, Train, TrainPosition } from '../formation';
import { JointDirectionPreferenceMap } from '../tracks/joint-direction-preference-map';
import { TrackGraph } from '../tracks/track';

export type TrainPlacementStates = 'IDLE' | 'HOVER_FOR_PLACEMENT';

export type TrainPlacementEvents = {
    leftPointerDown: {
        x: number;
        y: number;
    };
    leftPointerUp: {
        x: number;
        y: number;
    };
    pointerMove: {
        x: number;
        y: number;
    };
    escapeKey: {};
    startPlacement: {};
    endPlacement: {};
    flipTrainDirection: {};
    F: {};
};

export interface TrainPlacementContext extends BaseContext {
    cancelCurrentTrainPlacement: () => void;
    placeTrain: (position: Point) => void;
    hoverForPlacement: (position: Point) => void;
    flipTrainDirection: () => void;
    convert2WorldPosition: (position: Point) => Point;
    convert2WindowPosition: (position: Point) => Point;
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
    private _preferenceMap: JointDirectionPreferenceMap | null;

    constructor(trackGraph: TrackGraph, preferenceMap?: JointDirectionPreferenceMap) {
        this._trackGraph = trackGraph;
        this._preferenceMap = preferenceMap ?? null;
    }

    get preferenceMap(): JointDirectionPreferenceMap | null {
        return this._preferenceMap;
    }

    getNextJoint(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent'
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
        const possibleNextJoints = joint.direction[direction];
        if (possibleNextJoints.size === 0) {
            console.warn('no possible next joints');
            return null;
        }

        let selectedNextJointNumber: number | undefined;
        if (this._preferenceMap) {
            const preferred = this._preferenceMap.get(jointNumber, direction);
            if (preferred !== undefined && possibleNextJoints.has(preferred)) {
                selectedNextJointNumber = preferred;
            }
        }
        if (selectedNextJointNumber === undefined) {
            selectedNextJointNumber = possibleNextJoints.values().next().value;
        }
        if (selectedNextJointNumber === undefined) {
            return null;
        }
        const nextTrackSegmentNumber = joint.connections.get(
            selectedNextJointNumber
        );
        const nextJoint = this._trackGraph.getJoint(selectedNextJointNumber);
        if (nextTrackSegmentNumber === undefined) {
            return null;
        }
        const nextTrackSegment = this._trackGraph.getTrackSegmentWithJoints(
            nextTrackSegmentNumber
        );
        if (nextJoint === null) {
            console.warn('next joint not found');
            return null;
        }
        if (nextTrackSegment === null) {
            console.warn('next track segment not found');
            return null;
        }
        const nextDirection: 'tangent' | 'reverseTangent' =
            nextTrackSegment.t0Joint === jointNumber
                ? 'tangent'
                : 'reverseTangent';
        return {
            jointNumber: selectedNextJointNumber,
            direction: nextDirection,
            curveNumber: nextTrackSegmentNumber,
        };
    }
}

/**
 * Joint resolver for bogie walk-back.
 *
 * Walk-back is a fundamentally different question from forward advancement:
 * forward asks "where should the train go next?" (a policy question answered
 * by the train's configured {@link JointDirectionManager} — default heuristic,
 * route-aware, etc.), while walk-back asks "which segments is the body
 * already on?" (a geometric question answered by the occupied track segments
 * that previous forward steps have recorded).
 *
 * This resolver is used by {@link Train._getBogiePositions} instead of the
 * train's forward-policy JDM, so walk-back is unaffected by quirks in the
 * forward policy — specifically the revisited-joint and `currentIndex` lag
 * edge cases that used to bite {@link TimetableJointDirectionManager}.
 *
 * Strategy:
 *   - Unambiguous joint (one reachable branch) → pick it.
 *   - Ambiguous joint with a populated occupied list → strictly pick the
 *     branch whose segment is in the list.  If no branch matches, return
 *     null — the train body is in an inconsistent state and walk-back
 *     should fail loudly rather than silently shifting the rear.
 *   - Ambiguous joint with an empty occupied list → bootstrap by picking
 *     the first-available branch.  This only fires on the very first
 *     walk-back pass after placement, before the seeding path at
 *     {@link Train._getBogiePositions} has populated the occupied list.
 */
export class WalkBackJointDirectionManager implements JointDirectionManager {
    private _trackGraph: TrackGraph;

    constructor(trackGraph: TrackGraph) {
        this._trackGraph = trackGraph;
    }

    getNextJoint(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent',
        _occupiedJoints?: {
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
        if (joint === null) return null;

        const possibleNextJoints = joint.direction[direction];
        if (possibleNextJoints.size === 0) return null;

        let selectedNextJointNumber: number | undefined;

        const hasOccupied =
            occupiedTrackSegments !== undefined &&
            occupiedTrackSegments.length > 0;

        if (possibleNextJoints.size > 1 && hasOccupied) {
            const occupiedSet = new Set(
                occupiedTrackSegments!.map(s => s.trackNumber)
            );
            for (const nextJoint of possibleNextJoints) {
                const segNumber = joint.connections.get(nextJoint);
                if (segNumber === undefined) continue;
                if (occupiedSet.has(segNumber)) {
                    selectedNextJointNumber = nextJoint;
                    break;
                }
            }
            // Ambiguous junction, occupied list populated, but no branch
            // matched — the train body is inconsistent with the graph.
            // Fail instead of silently picking the wrong branch.
            if (selectedNextJointNumber === undefined) return null;
        }

        // Unambiguous joint OR bootstrap (empty occupied) — pick the first
        // available branch.
        if (selectedNextJointNumber === undefined) {
            selectedNextJointNumber = possibleNextJoints.values().next().value;
        }
        if (selectedNextJointNumber === undefined) return null;

        const nextTrackSegmentNumber = joint.connections.get(
            selectedNextJointNumber
        );
        if (nextTrackSegmentNumber === undefined) return null;

        const nextTrackSegment = this._trackGraph.getTrackSegmentWithJoints(
            nextTrackSegmentNumber
        );
        if (nextTrackSegment === null) return null;

        const nextDirection: 'tangent' | 'reverseTangent' =
            nextTrackSegment.t0Joint === jointNumber
                ? 'tangent'
                : 'reverseTangent';

        return {
            jointNumber: selectedNextJointNumber,
            direction: nextDirection,
            curveNumber: nextTrackSegmentNumber,
        };
    }
}

/** Options for {@link TrainPlacementEngine}. */
export type TrainPlacementEngineOptions = {
    /** When a train is placed, called with that train. Return a new Train to use for the next placement (e.g. for multiple trains). */
    onPlaced?: (placed: Train) => Train | void;
};

export class TrainPlacementEngine
    extends ObservableInputTracker
    implements TrainPlacementContext
{
    private _trackGraph: TrackGraph;
    private _trainTangent: Point | null = null;

    private _jointDirectionManager: JointDirectionManager;
    private _potentialTrainPlacement: TrainPosition | null = null;
    private _train: Train;
    private _onPlaced: ((placed: Train) => Train | void) | undefined;
    private _camera: ObservableBoardCamera;
    private _pendingFormation: Formation | null = null;

    constructor(
        canvas: Canvas,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
        options?: TrainPlacementEngineOptions
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._jointDirectionManager = new DefaultJointDirectionManager(
            trackGraph
        );
        this._onPlaced = options?.onPlaced;
        this._train = new Train(null, trackGraph, this._jointDirectionManager);
        this._camera = camera;
    }

    /** Set the formation to use for the next train placement. */
    setFormation(formation: Formation | null): void {
        this._pendingFormation = formation;
        // Rebuild the preview train with the new formation
        this._train = new Train(
            null,
            this._trackGraph,
            this._jointDirectionManager,
            formation ?? undefined
        );
    }

    /** The formation currently set for the next placement, or null for default. */
    get pendingFormation(): Formation | null {
        return this._pendingFormation;
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

        if (this._onPlaced) {
            const next = this._onPlaced(this._train);
            if (next) {
                this._train = next;
            }
        }
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
    // position is in raw window coordinates space
    convert2WorldPosition(position: Point): Point {
        const pointInCanvas = convertFromWindow2Canvas(position, this.canvas);
        const pointInViewPort = convertFromCanvas2ViewPort(pointInCanvas, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromViewport2World(
            pointInViewPort,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation,
            false
        );
    }

    // position is in the world space
    convert2WindowPosition(position: Point): Point {
        const pointInViewPort = convertFromWorld2Viewport(
            position,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation
        );
        const pointInCanvas = convertFromViewPort2Canvas(pointInViewPort, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromCanvas2Window(pointInCanvas, this.canvas);
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
        leftPointerUp: {
            action: (context, event) => {
                const worldPosition = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                context.placeTrain(worldPosition);
            },
            defaultTargetState: 'HOVER_FOR_PLACEMENT',
        },
        pointerMove: {
            action: (context, event) => {
                const worldPosition = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                context.hoverForPlacement(worldPosition);
            },
            defaultTargetState: 'HOVER_FOR_PLACEMENT',
        },
        escapeKey: {
            action: context => {
                context.cancelCurrentTrainPlacement();
            },
            defaultTargetState: 'IDLE',
        },
        F: {
            action: context => {
                context.flipTrainDirection();
            },
            defaultTargetState: 'HOVER_FOR_PLACEMENT',
        },
    };
}
