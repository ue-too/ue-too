/**
 * Track maker state machine — manages bezier editing interaction modes.
 *
 * Follows the @ue-too/being TemplateState pattern from the banana app's
 * layout tool state machine.
 *
 * States:
 *   IDLE → (startEditing) → OBJECT_MODE ↔ (tabKey) ↔ EDIT_MODE
 *   EDIT_MODE → (grabPoint) → DRAGGING_POINT → (finalize/escape) → EDIT_MODE
 *   OBJECT_MODE → (grabCurve) → DRAGGING_CURVE → (finalize/escape) → OBJECT_MODE
 */

import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState } from '@ue-too/being';
import type { Point } from '@ue-too/math';

import type { CurveCollectionModel } from '../curve-collection-model';
import { HandleType } from '../types';

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export const TRACK_MAKER_STATES = [
    'IDLE',
    'OBJECT_MODE',
    'EDIT_MODE',
    'DRAGGING_POINT',
    'DRAGGING_CURVE',
] as const;

export type TrackMakerStates = CreateStateType<typeof TRACK_MAKER_STATES>;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type TrackMakerEvents = {
    startEditing: {};
    stopEditing: {};
    leftPointerDown: { x: number; y: number };
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    tabKey: {};
    deleteKey: {};
    G: {};
    // Handle type changes
    setHandleVector: {};
    setHandleAligned: {};
    setHandleFree: {};
    // Slope
    setSlope: { slope: number | null };
    // Curve operations
    addCurve: { x: number; y: number };
    extendCurve: { prepend: boolean };
    // Toggles
    toggleArcFit: {};
    toggleSnap: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface TrackMakerContext extends BaseContext {
    model: CurveCollectionModel;
    convert2WorldPosition: (position: Point) => Point;
    /** Returns the current camera zoom level for zoom-aware hit testing. */
    getZoomLevel: () => number;
    /** Stored by DRAGGING states to compute deltas from the grab start. */
    grabOrigin: Point | null;
}

// ---------------------------------------------------------------------------
// State: IDLE
// ---------------------------------------------------------------------------

export class TrackMakerIdleState extends TemplateState<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
> {
    protected _eventReactions: EventReactions<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    > = {
        startEditing: {
            action: NO_OP,
            defaultTargetState: 'OBJECT_MODE',
        },
    };
}

// ---------------------------------------------------------------------------
// State: OBJECT_MODE — select/move entire curves
// ---------------------------------------------------------------------------

export class TrackMakerObjectModeState extends TemplateState<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
> {
    protected _eventReactions: EventReactions<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    > = {
        tabKey: {
            action: () => {
                console.log('[TrackMaker] OBJECT_MODE: tabKey action fired → EDIT_MODE');
            },
            defaultTargetState: 'EDIT_MODE',
        },
        stopEditing: {
            action: (context) => {
                context.model.clearSelected();
            },
            defaultTargetState: 'IDLE',
        },
        leftPointerDown: {
            action: (context, event) => {
                // Selection is handled by sidebar clicks; this could
                // initiate a grab if a curve is selected
            },
        },
        G: {
            action: (context) => {
                context.model.holdSelectedCurvePositions();
                context.grabOrigin = null;
            },
            defaultTargetState: 'DRAGGING_CURVE',
        },
        escapeKey: {
            action: (context) => {
                context.model.clearSelected();
            },
        },
        deleteKey: {
            action: (context) => {
                context.model.deleteSelectedCurves();
            },
        },
        addCurve: {
            action: (context, event) => {
                const ident = context.model.addCurve();
                // If x,y are provided and non-zero, use as world position for anchor
                if (event.x !== 0 || event.y !== 0) {
                    const worldPos = context.convert2WorldPosition(event);
                    const curve = context.model.getCurve(ident);
                    if (curve) {
                        curve.anchorPoint = worldPos;
                        curve.updatePointsCoordinates();
                    }
                }
                context.model.clearSelected();
                context.model.selectCurve(ident);
            },
        },
        extendCurve: {
            action: (context, event) => {
                context.model.extendSelectedCurves(event.prepend);
            },
        },
        toggleArcFit: {
            action: (context) => context.model.toggleArcFit(),
        },
        toggleSnap: {
            action: (context) => context.model.toggleSnap(),
        },
    };

    protected _guards: Guard<TrackMakerContext, string> = {
        noSelectedCurves: (context) => context.model.getSelectedCurveCount() === 0,
    };

    protected _eventGuards: Partial<
        EventGuards<TrackMakerEvents, TrackMakerStates, TrackMakerContext, Guard<TrackMakerContext, string>>
    > = {
        G: [
            {
                guard: 'noSelectedCurves',
                target: 'OBJECT_MODE', // stay in current state
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// State: EDIT_MODE — edit control points and handles
// ---------------------------------------------------------------------------

export class TrackMakerEditModeState extends TemplateState<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
> {
    protected _eventReactions: EventReactions<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    > = {
        tabKey: {
            action: (context) => {
                console.log('[TrackMaker] EDIT_MODE: tabKey action fired → OBJECT_MODE');
                context.model.releaseGrabbedPoint();
            },
            defaultTargetState: 'OBJECT_MODE',
        },
        stopEditing: {
            action: (context) => {
                context.model.releaseGrabbedPoint();
                context.model.clearSelected();
            },
            defaultTargetState: 'IDLE',
        },
        leftPointerDown: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                const zoomLevel = context.getZoomLevel();
                context.model.handleClick(worldPos, zoomLevel);
                if (context.model.hasGrabbedPoint()) {
                    // Immediately start dragging — store current position as grab origin
                    context.model.holdGrabbedPointPosition();
                    context.grabOrigin = worldPos;
                }
            },
            defaultTargetState: 'DRAGGING_POINT',
        },
        G: {
            action: (context) => {
                context.model.holdGrabbedPointPosition();
                context.grabOrigin = null;
            },
            defaultTargetState: 'DRAGGING_POINT',
        },
        escapeKey: {
            action: (context) => {
                context.model.releaseGrabbedPoint();
            },
        },
        deleteKey: {
            action: (context) => {
                context.model.deleteGrabbedPoint();
            },
        },
        setHandleVector: {
            action: (context) => context.model.changeGrabbedHandleType(HandleType.VECTOR),
        },
        setHandleAligned: {
            action: (context) => context.model.changeGrabbedHandleType(HandleType.ALIGNED),
        },
        setHandleFree: {
            action: (context) => context.model.changeGrabbedHandleType(HandleType.FREE),
        },
        setSlope: {
            action: (context, event) => context.model.setGrabbedPointSlope(event.slope),
        },
        extendCurve: {
            action: (context, event) => context.model.extendSelectedCurves(event.prepend),
        },
        toggleArcFit: {
            action: (context) => context.model.toggleArcFit(),
        },
        toggleSnap: {
            action: (context) => context.model.toggleSnap(),
        },
    };

    protected _guards: Guard<TrackMakerContext, string> = {
        noGrabbedPoint: (context) => !context.model.hasGrabbedPoint(),
    };

    protected _eventGuards: Partial<
        EventGuards<TrackMakerEvents, TrackMakerStates, TrackMakerContext, Guard<TrackMakerContext, string>>
    > = {
        leftPointerDown: [
            {
                guard: 'noGrabbedPoint',
                target: 'EDIT_MODE', // no point hit — stay in EDIT_MODE
            },
        ],
        G: [
            {
                guard: 'noGrabbedPoint',
                target: 'EDIT_MODE', // stay in current state
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// State: DRAGGING_POINT — actively moving a control point or handle
// ---------------------------------------------------------------------------

export class TrackMakerDraggingPointState extends TemplateState<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
> {
    protected _eventReactions: EventReactions<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                if (!context.grabOrigin) {
                    context.grabOrigin = worldPos;
                }
                const diff = {
                    x: worldPos.x - context.grabOrigin.x,
                    y: worldPos.y - context.grabOrigin.y,
                };
                context.model.handleGrab(true, false, diff, context.getZoomLevel());
            },
        },
        leftPointerUp: {
            action: (context) => {
                context.model.holdGrabbedPointPosition();
                context.grabOrigin = null;
            },
            defaultTargetState: 'EDIT_MODE',
        },
        escapeKey: {
            action: (context) => {
                context.model.revertPointToPrevPos();
                context.grabOrigin = null;
            },
            defaultTargetState: 'EDIT_MODE',
        },
    };
}

// ---------------------------------------------------------------------------
// State: DRAGGING_CURVE — actively moving entire selected curves
// ---------------------------------------------------------------------------

export class TrackMakerDraggingCurveState extends TemplateState<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
> {
    protected _eventReactions: EventReactions<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                if (!context.grabOrigin) {
                    // First move — capture origin, diff is 0 (no-op)
                    context.grabOrigin = worldPos;
                }
                const diff = {
                    x: worldPos.x - context.grabOrigin.x,
                    y: worldPos.y - context.grabOrigin.y,
                };
                context.model.handleGrab(false, false, diff, context.getZoomLevel());
            },
        },
        leftPointerUp: {
            action: (context) => {
                context.grabOrigin = null;
            },
            defaultTargetState: 'OBJECT_MODE',
        },
        escapeKey: {
            action: (context) => {
                context.model.revertCurveToPrevPos();
                context.grabOrigin = null;
            },
            defaultTargetState: 'OBJECT_MODE',
        },
    };
}

// ---------------------------------------------------------------------------
// Type alias
// ---------------------------------------------------------------------------

export type TrackMakerStateMachine = StateMachine<
    TrackMakerEvents,
    TrackMakerContext,
    TrackMakerStates
>;
