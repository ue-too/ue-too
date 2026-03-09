import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState } from '@ue-too/being';
import { type Point } from '@ue-too/math';

import {
    ELEVATION,
    ProjectionPositiveResult,
} from '../tracks/types';
import { NewJointType } from './types';

export const LAYOUT_STATES = [
    'IDLE',
    'HOVER_FOR_STARTING_POINT',
    'HOVER_FOR_ENDING_POINT',
    'HOVER_FOR_CURVE_DELETION',
] as const;

export type LayoutStates =
    CreateStateType<typeof LAYOUT_STATES>;

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
    arrowUp: {};
    arrowDown: {};
    clearEndPoint: {};
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
    bumpTension: () => void;
    lowerTension: () => void;
    clearEndPoint: () => void;
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
            arrowUp: {
                action: (context) => {
                    context.bumpStartJointElevation();
                },
            },
            arrowDown: {
                action: (context) => {
                    context.lowerStartJointElevation();
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
                        context.bumpTension();
                    } else {
                        context.lowerTension();
                    }
                },
            },
            arrowUp: {
                action: (context) => {
                    context.bumpEndJointElevation();
                },
            },
            arrowDown: {
                action: (context) => {
                    context.lowerEndJointElevation();
                },
            },
            clearEndPoint: {
                action: (context, event) => {
                    context.clearEndPoint();
                }
            }
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
