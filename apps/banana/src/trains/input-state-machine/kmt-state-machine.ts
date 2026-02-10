import type {
    BaseContext,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState } from '@ue-too/being';
import { Observable, Observer, SubscriptionOptions, SynchronousObservable } from '@ue-too/board';
import { BCurve } from '@ue-too/curve';
import { type Point, directionAlignedToTangent } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import { PreviewCurveCalculator } from '../tracks/new-joint';
import {
    ELEVATION,
    FlatElevation,
    ProjectionCurveResult,
    ProjectionEdgeResult,
    ProjectionJointResult,
    ProjectionPositiveResult,
    ProjectionResult,
    SlopedElevation,
    TrackSegmentDrawData,
} from '../tracks/types';
import { TrackGraph } from '../tracks/track';

export type LayoutStates =
    | 'IDLE'
    | 'HOVER_FOR_STARTING_POINT'
    | 'HOVER_FOR_ENDING_POINT'
    | 'HOVER_FOR_CURVE_DELETION';

export type LayoutEvents = {
    pointerdown: {
        position: Point;
        pointerId: number;
    };
    pointerup: {
        pointerId: number;
        position: Point;
    };
    pointermove: {
        pointerId: number;
        position: Point;
    };
    escapeKey: {};
    startLayout: {};
    endLayout: {};
    flipEndTangent: {};
    flipStartTangent: {};
    toggleStraightLine: {};
    startDeletion: {};
    endDeletion: {};
    scroll: {
        positive: boolean;
    };
};

export interface LayoutContext extends BaseContext {
    startCurve: () => void;
    endCurve: () => Point | null;
    cancelCurrentCurve: () => void;
    hoveringForEndJoint: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
    insertJointIntoTrackSegment: (
        startJointNumber: number,
        endJointNumber: number,
        atT: number
    ) => void;
    flipEndTangent: () => void;
    flipStartTangent: () => void;
    toggleStraightLine: () => void;
    hoverForCurveDeletion: (position: Point) => void;
    deleteCurrentCurve: () => void;
    cancelCurrentDeletion: () => void;
    setCurrentJointElevation: (elevation: ELEVATION) => void;
    bumpCurrentJointElevation: () => void;
    lowerCurrentJointElevation: () => void;
    bumpStartJointElevation: () => void;
    lowerStartJointElevation: () => void;
    bumpEndJointElevation: () => void;
    lowerEndJointElevation: () => void;
    previewStartProjection: ProjectionPositiveResult | null;
    newStartJointType: NewJointType | null;
    lastCurveSuccess: boolean;
}

export class LayoutIDLEState extends TemplateState<
    LayoutEvents,
    LayoutContext,
    LayoutStates
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        LayoutEvents,
        LayoutContext,
        LayoutStates
    > = {
            startLayout: {
                action: NO_OP,
                defaultTargetState: 'HOVER_FOR_STARTING_POINT',
            },
            startDeletion: {
                action: NO_OP,
                defaultTargetState: 'HOVER_FOR_CURVE_DELETION',
            },
        };
}

export class LayoutHoverForCurveDeletionState extends TemplateState<
    LayoutEvents,
    LayoutContext,
    LayoutStates
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        LayoutEvents,
        LayoutContext,
        LayoutStates
    > = {
            pointermove: {
                action: (context, event) => {
                    context.hoverForCurveDeletion(event.position);
                },
            },
            pointerup: {
                action: (context, event) => {
                    // context.deleteCurrentCurve();
                    context.deleteCurrentCurve();
                },
                defaultTargetState: 'HOVER_FOR_CURVE_DELETION',
            },
            endDeletion: {
                action: (context, event) => {
                    context.cancelCurrentDeletion();
                },
                defaultTargetState: 'IDLE',
            },
        };
}

export class LayoutHoverForStartingPointState extends TemplateState<
    LayoutEvents,
    LayoutContext,
    LayoutStates
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        LayoutEvents,
        LayoutContext,
        LayoutStates
    > = {
            pointerup: {
                action: (context, event) => {
                    context.startCurve();
                },
                defaultTargetState: 'HOVER_FOR_ENDING_POINT',
            },
            pointermove: {
                action: (context, event) => {
                    context.hoverForStartingPoint(event.position);
                },
                defaultTargetState: 'HOVER_FOR_STARTING_POINT',
            },
            endLayout: {
                action: (context, event) => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'IDLE',
            },
            escapeKey: {
                action: (context, event) => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'IDLE',
            },
            flipEndTangent: {
                action: (context, event) => {
                    context.flipEndTangent();
                },
                defaultTargetState: 'HOVER_FOR_STARTING_POINT',
            },
            flipStartTangent: {
                action: (context, event) => {
                    context.flipStartTangent();
                },
                defaultTargetState: 'HOVER_FOR_STARTING_POINT',
            },
            startDeletion: {
                action: (context, event) => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'HOVER_FOR_CURVE_DELETION',
            },
            scroll: {
                action: (context, event) => {
                    if (event.positive) {
                        context.bumpStartJointElevation();
                    } else {
                        context.lowerStartJointElevation();
                    }
                },
            },
        };
}

export class LayoutHoverForEndingPointState extends TemplateState<
    LayoutEvents,
    LayoutContext,
    LayoutStates
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        LayoutEvents,
        LayoutContext,
        LayoutStates
    > = {
            pointerup: {
                action: (context, event) => {
                    const res = context.endCurve();
                    if (res == null) {
                        return;
                    }
                    context.hoverForStartingPoint(res);
                    context.startCurve();
                },
                defaultTargetState: 'HOVER_FOR_ENDING_POINT',
            },
            pointermove: {
                action: (context, event) => {
                    context.hoveringForEndJoint(event.position);
                },
                defaultTargetState: 'HOVER_FOR_ENDING_POINT',
            },
            endLayout: {
                action: (context, event) => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'IDLE',
            },
            escapeKey: {
                action: context => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'HOVER_FOR_STARTING_POINT',
            },
            flipEndTangent: {
                action: (context, event) => {
                    context.flipEndTangent();
                },
            },
            flipStartTangent: {
                action: (context, event) => {
                    context.flipStartTangent();
                },
            },
            toggleStraightLine: {
                action: (context, event) => {
                    context.toggleStraightLine();
                },
            },
            startDeletion: {
                action: (context, event) => {
                    context.cancelCurrentCurve();
                },
                defaultTargetState: 'HOVER_FOR_CURVE_DELETION',
            },
            scroll: {
                action: (context, event) => {
                    if (event.positive) {
                        context.bumpEndJointElevation();
                    } else {
                        context.lowerEndJointElevation();
                    }
                },
            },
        };

    protected _guards: Guard<LayoutContext, string> = {
        lastCurveNotSuccess: context => {
            return !context.lastCurveSuccess;
        },
    };

    protected _eventGuards: Partial<
        EventGuards<
            LayoutEvents,
            LayoutStates,
            LayoutContext,
            Guard<LayoutContext, string>
        >
    > = {
            pointerup: [
                {
                    guard: 'lastCurveNotSuccess',
                    target: 'HOVER_FOR_STARTING_POINT',
                },
            ],
        };
}

export type LayoutStateMachine = StateMachine<LayoutEvents, LayoutContext, LayoutStates>;

export type BrandNewJoint = {
    type: 'new';
} & BaseJoint;

export type BaseJoint = {
    position: Point;
    elevation: ELEVATION;
};

export type ConstrainedNewJoint = {
    type: 'contrained';
    constraint: ProjectionEdgeResult;
} & BaseJoint;

export type BranchJoint = {
    type: 'branchJoint';
    constraint: ProjectionJointResult;
} & BaseJoint;

export type ExtendingTrackJoint = {
    type: 'extendingTrack';
    constraint: ProjectionJointResult;
} & BaseJoint;

export type BranchCurveJoint = {
    type: 'branchCurve';
    constraint: ProjectionCurveResult;
    curveElevation: SlopedElevation | FlatElevation;
} & BaseJoint;

export type NewJointType =
    | BrandNewJoint
    | BranchJoint
    | ExtendingTrackJoint
    | BranchCurveJoint
    | ConstrainedNewJoint;

export class CurveCreationEngine implements LayoutContext {
    private _trackGraph: TrackGraph;

    private _newStartJoint: NewJointType | null = null;
    private _newEndJoint: NewJointType | null = null;

    private _previewStartProjection: ProjectionPositiveResult | null = null;
    private _previewStartProjectionObservable: Observable<[ProjectionPositiveResult | null]> = new SynchronousObservable<[ProjectionPositiveResult | null]>();
    private _previewEndProjection: ProjectionPositiveResult | null = null;
    private _previewEndProjectionObservable: Observable<[ProjectionPositiveResult | null]> = new SynchronousObservable<[ProjectionPositiveResult | null]>();

    private _previewCurve: {
        curve: BCurve;
        previewStartAndEndSwitched: boolean;
        elevation: {
            from: ELEVATION;
            to: ELEVATION;
        };
        gauge: number;
    } | null = null;

    private _previewCurveGauge: number = 1.067;

    private _lastCurveSuccess: boolean = false;

    private _previewCurveForDeletion: number | null = null;

    public _currentJointElevation: ELEVATION | null = null;
    private _startJointElevation: ELEVATION | null = null;
    private _elevationObservable: Observable<[ELEVATION | null]> =
        new SynchronousObservable<[ELEVATION | null]>();

    private _previewCurveCalculator: PreviewCurveCalculator =
        new PreviewCurveCalculator();

    private _previewDrawDataObservable: Observable<[{ index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined]> =
        new SynchronousObservable<[{ index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined]>();

    constructor() {
        this._trackGraph = new TrackGraph();
    }

    get newStartJointType(): NewJointType | null {
        return this._newStartJoint;
    }

    get lastCurveSuccess(): boolean {
        return this._lastCurveSuccess;
    }

    get previewCurveForDeletion(): BCurve | null {
        const res =
            this._previewCurveForDeletion !== null
                ? this._trackGraph.getTrackSegmentCurve(
                    this._previewCurveForDeletion
                )
                : null;
        return res;
    }

    startCurve() {
        // this.cancelCurrentCurve();
    }

    setCurrentJointElevation(elevation: ELEVATION) {
        if (elevation != this._currentJointElevation) {
            this._elevationObservable.notify(elevation);
        }
        this._currentJointElevation = elevation;
    }

    bumpStartJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation >= ELEVATION.ABOVE_3) {
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if (this._newStartJoint === null) {
            return;
        }
        this._newStartJoint.elevation = currentElevation + 1;
        if (this._newEndJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    bumpEndJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation >= ELEVATION.ABOVE_3) {
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if (this._newEndJoint === null) {
            return;
        }
        this._newEndJoint.elevation = currentElevation + 1;
        if (this._newStartJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    bumpCurrentJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation >= ELEVATION.ABOVE_3) {
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
    }

    lowerStartJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation <= ELEVATION.SUB_3) {
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if (this._newStartJoint === null) {
            return;
        }
        this._newStartJoint.elevation = currentElevation - 1;
        if (this._newEndJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    lowerEndJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation <= ELEVATION.SUB_3) {
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if (this._newEndJoint === null) {
            return;
        }
        this._newEndJoint.elevation = currentElevation - 1;
        if (this._newStartJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    lowerCurrentJointElevation() {
        if (
            this._newStartJoint !== null &&
            (this._newStartJoint.type === 'branchCurve' ||
                this._newStartJoint.type === 'branchJoint')
        ) {
            return;
        }
        const currentElevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        if (currentElevation <= ELEVATION.SUB_3) {
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
    }

    onElevationChange(observer: Observer<[ELEVATION | null]>) {
        this._elevationObservable.subscribe(observer);
    }

    hoverForCurveDeletion(position: Point) {
        const res = this._trackGraph.project(position);
        if (res.hit && res.hitType === 'curve') {
            this._previewCurveForDeletion = res.curve;
        } else {
            this._previewCurveForDeletion = null;
        }
    }

    hoverForStartingPoint(position: Point, gauge: number = 1.067) {
        const res = this._trackGraph.project(position);
        const elevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        this._newStartJoint = this.determineNewJointType(
            position,
            res,
            elevation
        );
        if (res.hit) {
            this._previewStartProjection = res;
        } else {
            this._previewStartProjection = null;
        }

        this._previewCurveGauge = gauge;
        this._previewStartProjectionObservable.notify(res.hit ? res : null);
    }

    flipStartTangent() {
        this._previewCurveCalculator.toggleStartTangentFlip();
        if (this._newStartJoint === null) {
            return;
        }
        if (this._newEndJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    private _updatePreviewCurve(
        startJoint: NewJointType,
        endJoint: NewJointType
    ) {
        const newPreviewCurve = this._previewCurveCalculator.getPreviewCurve(
            startJoint,
            endJoint
        );
        if (this._previewCurve == null) {
            this._previewCurve = {
                curve: new BCurve(newPreviewCurve.cps),
                previewStartAndEndSwitched: newPreviewCurve.startAndEndSwitched,
                elevation: newPreviewCurve.startAndEndSwitched
                    ? {
                        from: endJoint.elevation,
                        to: startJoint.elevation,
                    }
                    : {
                        from: startJoint.elevation,
                        to: endJoint.elevation,
                    },
                gauge: this._previewCurveGauge,
            };
        } else {
            this._previewCurve.curve.setControlPoints(newPreviewCurve.cps);
            this._previewCurve.previewStartAndEndSwitched =
                newPreviewCurve.startAndEndSwitched;
            this._previewCurve.elevation = newPreviewCurve.startAndEndSwitched
                ? {
                    from: endJoint.elevation,
                    to: startJoint.elevation,
                }
                : {
                    from: startJoint.elevation,
                    to: endJoint.elevation,
                };
        }

        const previewCurve = this._previewCurve.curve;
        const startElevation = this._previewCurve.elevation.from;
        const endElevation = this._previewCurve.elevation.to;

        const excludeSegmentsForCollisionCheck = new Set<number>();

        if (startJoint.type === 'branchCurve') {
            excludeSegmentsForCollisionCheck.add(startJoint.constraint.curve);
        }

        if (startJoint.type === 'branchJoint' || startJoint.type === 'extendingTrack') {
            const startJointNumber = startJoint.constraint.jointNumber;
            const startTrackJoint = this._trackGraph.getJoint(startJointNumber);
            if (startTrackJoint !== null) {
                const connections = startTrackJoint.connections;
                connections.forEach((_, trackSegmentNumber) => {
                    excludeSegmentsForCollisionCheck.add(trackSegmentNumber);
                });
            }
        }

        if (endJoint.type === 'branchCurve') {
            excludeSegmentsForCollisionCheck.add(endJoint.constraint.curve);
        }

        if (endJoint.type === 'branchJoint' || endJoint.type === 'extendingTrack') {
            const endJointNumber = endJoint.constraint.jointNumber;
            const endTrackJoint = this._trackGraph.getJoint(endJointNumber);
            if (endTrackJoint !== null) {
                const connections = endTrackJoint.connections;
                connections.forEach((_, trackSegmentNumber) => {
                    excludeSegmentsForCollisionCheck.add(trackSegmentNumber);
                });
            }
        }

        const drawData = this._trackGraph.trackCurveManager.getPreviewDrawData(previewCurve, startElevation, endElevation, this._previewCurve.gauge, excludeSegmentsForCollisionCheck);

        this._previewDrawDataObservable.notify(drawData);
    }

    onPreviewDrawDataChange(observer: Observer<[{ index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined]>, options?: SubscriptionOptions) {
        this._previewDrawDataObservable.subscribe(observer, options);
    }

    flipEndTangent() {
        this._previewCurveCalculator.toggleEndTangentFlip();
        if (this._newStartJoint === null) {
            return;
        }
        if (this._newEndJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    toggleStraightLine() {
        this._previewCurveCalculator.toggleStraightLine();
        if (this._newStartJoint === null) {
            return;
        }
        if (this._newEndJoint === null) {
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    hoveringForEndJoint(position: Point) {
        if (this._newStartJoint == null) {
            return;
        }

        const res = this._trackGraph.project(position);
        const elevation =
            this._currentJointElevation != null
                ? this._currentJointElevation
                : ELEVATION.GROUND;
        this._newEndJoint = this.determineNewJointType(
            position,
            res,
            elevation
        );

        if (res.hit) {
            this._previewEndProjection = res;
        } else {
            this._previewEndProjection = null;
        }

        this._previewEndProjectionObservable.notify(res.hit ? res : null);

        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    onPreviewStartProjectionChange(observer: Observer<[ProjectionPositiveResult | null]>, options?: SubscriptionOptions) {
        this._previewStartProjectionObservable.subscribe(observer, options);
    }

    onPreviewEndProjectionChange(observer: Observer<[ProjectionPositiveResult | null]>, options?: SubscriptionOptions) {
        this._previewEndProjectionObservable.subscribe(observer, options);
    }

    get previewCurve(): {
        curve: BCurve;
        previewStartAndEndSwitched: boolean;
        elevation: {
            from: ELEVATION;
            to: ELEVATION;
        };
    } | null {
        return this._previewCurve;
    }

    get previewStartProjection(): ProjectionPositiveResult | null {
        return this._previewStartProjection;
    }

    get previewEndProjection(): ProjectionPositiveResult | null {
        return this._previewEndProjection;
    }

    get newEndJointType(): NewJointType | null {
        return this._newEndJoint;
    }

    endCurve(): Point | null {
        const res = this.endCurveInternal();
        console.log('endCurve', res);
        if (res !== null) {
            this._lastCurveSuccess = true;
        } else {
            this.cancelCurrentCurve();
            this._lastCurveSuccess = false;
        }

        return res;
    }

    deleteCurrentCurve() {
        if (this._previewCurveForDeletion === null) {
            return;
        }
        console.log('deleteCurrentCurve', this._previewCurveForDeletion);
        this._trackGraph.removeTrackSegment(this._previewCurveForDeletion);
        this._previewCurveForDeletion = null;
    }

    private endCurveInternal(): Point | null {
        let res: Point | null = null;

        if (
            this._newStartJoint === null ||
            this._previewCurve === null ||
            this._newEndJoint === null
        ) {
            this.cancelCurrentCurve();
            return null;
        }

        const cps = this._previewCurve.curve.getControlPoints().slice(1, -1);

        console.log(
            'preview curve',
            this._previewCurve.curve.getControlPoints()
        );
        console.log('cps', cps);

        let startJointNumber: number | null = null;
        let endJointNumber: number | null = null;

        // TODO maybe turn this into a validation pipeline function and add other edge cases?
        if (this._newStartJoint.type === 'extendingTrack') {
            const startJointNumber = this._newStartJoint.constraint.jointNumber;
            const startJointTangent = this._newStartJoint.constraint.tangent;
            const previewCurveTangent = this._previewCurve
                .previewStartAndEndSwitched
                ? this._previewCurve.curve.derivative(1)
                : this._previewCurve.curve.derivative(0);
            if (this._previewCurve.previewStartAndEndSwitched) {
                console.log('start and end point switched in preview curve');
            } else {
                console.log(
                    'start and end point not switched in preview curve'
                );
            }
            if (
                !extendTrackIsPossible(
                    startJointNumber,
                    startJointTangent,
                    previewCurveTangent,
                    this._trackGraph
                )
            ) {
                console.warn('extend track not possible for start joint');
                this.cancelCurrentCurve();
                return null;
            }
        }

        if (this._newEndJoint.type === 'extendingTrack') {
            console.log('checking extend track possible for end joint');
            const startJointNumber = this._newEndJoint.constraint.jointNumber;
            const startJointTangent = this._newEndJoint.constraint.tangent;
            const previewCurveTangentInTheDirectionToOtherJoint = this
                ._previewCurve.previewStartAndEndSwitched
                ? this._previewCurve.curve.derivative(0)
                : PointCal.multiplyVectorByScalar(
                    this._previewCurve.curve.derivative(1),
                    -1
                );
            if (
                !extendTrackIsPossible(
                    startJointNumber,
                    startJointTangent,
                    previewCurveTangentInTheDirectionToOtherJoint,
                    this._trackGraph
                )
            ) {
                console.warn('extend track not possible for end joint');
                this.cancelCurrentCurve();
                return null;
            }
        }

        if (
            this._newStartJoint.type == 'branchCurve' ||
            this._newStartJoint.type == 'branchJoint' ||
            this._newEndJoint.type == 'branchCurve' ||
            this._newEndJoint.type == 'branchJoint'
        ) {
            console.log('checking if branching curve can be sloped');
            console.log('start joint elevation', this._newStartJoint.elevation);
            console.log('end joint elevation', this._newEndJoint.elevation);
            if (this._newStartJoint.elevation != this._newEndJoint.elevation) {
                console.warn('branching curve can not be sloped');
                this.cancelCurrentCurve();
                return null;
            }

            if (this._newStartJoint.type == 'branchCurve') {
                if (this._newStartJoint.curveElevation.curveIsSloped) {
                    console.warn('branching curve can not be sloped');
                    this.cancelCurrentCurve();
                    return null;
                }
            }

            if (this._newEndJoint.type == 'branchCurve') {
                if (this._newEndJoint.curveElevation.curveIsSloped) {
                    console.warn('branching curve can not be sloped');
                    this.cancelCurrentCurve();
                    return null;
                }
            }
        }

        // END OF VALIDATION PIPELINE

        if (
            this._newStartJoint.type === 'new' ||
            this._newStartJoint.type === 'contrained'
        ) {
            const startTangent = this._previewCurve.previewStartAndEndSwitched
                ? PointCal.unitVector(this._previewCurve.curve.derivative(1))
                : PointCal.unitVector(this._previewCurve.curve.derivative(0));
            startJointNumber = this._trackGraph.createNewEmptyJoint(
                this._newStartJoint.position,
                startTangent,
                this._newStartJoint.elevation
            );
        } else if (this._newStartJoint.type === 'branchCurve') {
            const constraint = this._newStartJoint.constraint;
            const trackSegmentNumber = constraint.curve;
            startJointNumber =
                this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(
                    trackSegmentNumber,
                    constraint.atT
                );
        } else {
            startJointNumber = this._newStartJoint.constraint.jointNumber;
        }

        if (
            this._newEndJoint.type === 'new' ||
            this._newEndJoint.type === 'contrained'
        ) {
            if (this._newEndJoint.type === 'new') {
                const previewCurveStartAndEndSwitched =
                    this._previewCurve.previewStartAndEndSwitched;
                const endTangent = previewCurveStartAndEndSwitched
                    ? PointCal.unitVector(
                        this._previewCurve.curve.derivative(0)
                    )
                    : PointCal.unitVector(
                        this._previewCurve.curve.derivative(1)
                    );
                const previewCurveCPs =
                    this._previewCurve.curve.getControlPoints();
                const endPosition = previewCurveStartAndEndSwitched
                    ? previewCurveCPs[0]
                    : previewCurveCPs[previewCurveCPs.length - 1];
                res = endPosition;
                endJointNumber = this._trackGraph.createNewEmptyJoint(
                    endPosition,
                    endTangent,
                    this._newEndJoint.elevation
                );
            } else {
                res = this._newEndJoint.position;
                endJointNumber = this._trackGraph.createNewEmptyJoint(
                    this._newEndJoint.position,
                    this._newEndJoint.constraint.tangent,
                    this._newEndJoint.elevation
                );
            }
        } else if (this._newEndJoint.type === 'branchCurve') {
            const constraint = this._newEndJoint.constraint;
            const trackSegmentNumber = constraint.curve;
            res = constraint.projectionPoint;
            endJointNumber =
                this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(
                    trackSegmentNumber,
                    constraint.atT
                );

            console.log('end joint number', endJointNumber);
        } else {
            res = this._newEndJoint.position;
            endJointNumber = this._newEndJoint.constraint.jointNumber;
        }

        if (startJointNumber === null || endJointNumber === null) {
            if (startJointNumber === null) {
                console.warn('startJointNumber is null');
            }
            if (endJointNumber === null) {
                console.warn('endJointNumber is null');
            }
            this.cancelCurrentCurve();
            return null;
        }

        this._trackGraph.connectJoints(startJointNumber, endJointNumber, cps);
        this._trackGraph.logJoints();
        this.cancelCurrentCurve();

        return res;
    }

    insertJointIntoTrackSegment(
        startJointNumber: number,
        endJointNumber: number,
        atT: number
    ) {
        this._trackGraph.insertJointIntoTrackSegment(
            startJointNumber,
            endJointNumber,
            atT
        );
        this._trackGraph.logJoints();
    }

    cancelCurrentCurve() {
        this._previewStartProjection = null;
        this._previewEndProjection = null;
        this._previewStartProjectionObservable.notify(null);
        this._previewEndProjectionObservable.notify(null);
        this._previewCurve = null;
        this._previewDrawDataObservable.notify(undefined);
        this._newStartJoint = null;
        this._newEndJoint = null;
    }

    cancelCurrentDeletion() {
        this._previewCurveForDeletion = null;
    }

    setup() { }

    cleanup() { }

    get trackGraph(): TrackGraph {
        return this._trackGraph;
    }

    determineNewJointType(
        rawPosition: Point,
        projection: ProjectionResult,
        elevation: ELEVATION = ELEVATION.GROUND
    ): NewJointType {
        if (!projection.hit) {
            return {
                type: 'new',
                position: rawPosition,
                elevation: elevation,
            };
        }

        switch (projection.hitType) {
            case 'joint':
                if (
                    this._trackGraph.jointIsEndingTrack(projection.jointNumber)
                ) {
                    // extending from a dead end joint
                    return {
                        type: 'extendingTrack',
                        position: projection.projectionPoint,
                        constraint: projection,
                        elevation: elevation,
                    };
                } else {
                    // branching out from a joint that is not an ending track
                    return {
                        type: 'branchJoint',
                        position: projection.projectionPoint,
                        constraint: projection,
                        elevation: elevation,
                    };
                }
            case 'curve':
                return {
                    type: 'branchCurve',
                    position: projection.projectionPoint,
                    constraint: projection,
                    elevation: projection.elevation.elevation,
                    curveElevation: projection.elevation,
                };
            case 'edge':
                return {
                    type: 'contrained',
                    position: projection.projectionPoint,
                    constraint: projection,
                    elevation: elevation,
                };
        }
    }
}

function extendTrackIsPossible(
    startJointNumber: number,
    startJointTangent: Point,
    previewCurveTangentInTheDirectionToOtherJoint: Point,
    trackGraph: TrackGraph
) {
    const jointTangentIsPointingInEmptyDirection =
        trackGraph.tangentIsPointingInEmptyDirection(startJointNumber);
    const emptyTangentDirection = jointTangentIsPointingInEmptyDirection
        ? startJointTangent
        : PointCal.multiplyVectorByScalar(startJointTangent, -1);

    if (
        directionAlignedToTangent(
            emptyTangentDirection,
            previewCurveTangentInTheDirectionToOtherJoint
        )
    ) {
        return true;
    }

    return false;
}
