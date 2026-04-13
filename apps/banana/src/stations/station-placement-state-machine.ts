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
import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import type { TrackGraph } from '@/trains/tracks/track';
import { ELEVATION } from '@/trains/tracks/types';

import { useGaugeStore } from '@/stores/gauge-store';

import { createIslandStation } from './station-factory';
import type { StationManager } from './station-manager';
import type { StationRenderSystem } from './station-render-system';

// ---------------------------------------------------------------------------
// States & Events
// ---------------------------------------------------------------------------

export type StationPlacementStates =
    | 'IDLE'
    | 'HOVER_FOR_START'
    | 'HOVER_FOR_END';

export type StationPlacementEvents = {
    leftPointerDown: { x: number; y: number };
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    startPlacement: {};
    endPlacement: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface StationPlacementContext extends BaseContext {
    startDrag: (position: Point) => void;
    updateDrag: (position: Point) => void;
    finishDrag: (position: Point) => void;
    cancelPlacement: () => void;
    convert2WorldPosition: (position: Point) => Point;
    convert2WindowPosition: (position: Point) => Point;
}

// ---------------------------------------------------------------------------
// Engine (implements context)
// ---------------------------------------------------------------------------

export class StationPlacementEngine
    extends ObservableInputTracker
    implements StationPlacementContext
{
    private _trackGraph: TrackGraph;
    private _stationManager: StationManager;
    private _stationRenderSystem: StationRenderSystem;
    private _camera: ObservableBoardCamera;

    private _dragStart: Point | null = null;
    /** Track spacing matching the factory defaults (platformWidth + 2*offset). */
    /** Track spacing matching the factory defaults (platformWidth + 2*offset = 8 + 2*1.2). */
    private _trackSpacing = 10.4;

    constructor(
        canvas: Canvas,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
        stationManager: StationManager,
        stationRenderSystem: StationRenderSystem
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._stationManager = stationManager;
        this._stationRenderSystem = stationRenderSystem;
    }

    startDrag(position: Point): void {
        this._dragStart = position;
        this._stationRenderSystem.showPreview(
            position,
            { x: 1, y: 0 },
            0.5,
            this._trackSpacing
        );
    }

    updateDrag(position: Point): void {
        if (this._dragStart === null) return;

        const dx = position.x - this._dragStart.x;
        const dy = position.y - this._dragStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) return;

        const direction = { x: dx / dist, y: dy / dist };
        const center = {
            x: (this._dragStart.x + position.x) / 2,
            y: (this._dragStart.y + position.y) / 2,
        };

        this._stationRenderSystem.showPreview(
            center,
            direction,
            dist,
            this._trackSpacing
        );
    }

    finishDrag(position: Point): void {
        if (this._dragStart === null) return;

        const start = this._dragStart;
        const dx = position.x - start.x;
        const dy = position.y - start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this._stationRenderSystem.hidePreview();
        this._dragStart = null;

        if (dist < 2) return; // too short, cancel

        const direction = { x: dx / dist, y: dy / dist };
        const center = {
            x: (start.x + position.x) / 2,
            y: (start.y + position.y) / 2,
        };

        const stationId = createIslandStation(
            this._trackGraph,
            this._stationManager,
            {
                position: center,
                direction,
                length: dist,
                elevation: ELEVATION.GROUND,
                gauge: useGaugeStore.getState().currentGauge,
            }
        );
        this._stationRenderSystem.addStation(stationId);
    }

    cancelPlacement(): void {
        this._stationRenderSystem.hidePreview();
        this._dragStart = null;
    }

    /**
     * Creates a station with no platforms, no tracks, and no joints.
     * Used as a prerequisite for adding track-aligned platforms.
     */
    createBareStation(position: Point): number {
        const stationId = this._stationManager.createStation({
            name: 'Station',
            position,
            elevation: ELEVATION.GROUND,
            platforms: [],
            trackSegments: [],
            joints: [],
            trackAlignedPlatforms: [],
        });
        this._stationRenderSystem.addStation(stationId);
        return stationId;
    }

    setup(): void {}
    cleanup(): void {}

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

// ---------------------------------------------------------------------------
// State machine states
// ---------------------------------------------------------------------------

class StationPlacementIdleState extends TemplateState<
    StationPlacementEvents,
    StationPlacementContext,
    StationPlacementStates
> {
    protected _eventReactions: EventReactions<
        StationPlacementEvents,
        StationPlacementContext,
        StationPlacementStates
    > = {
        startPlacement: {
            action: NO_OP,
            defaultTargetState: 'HOVER_FOR_START',
        },
    };
}

/** Waiting for the first click to set the start point. */
class StationPlacementHoverForStartState extends TemplateState<
    StationPlacementEvents,
    StationPlacementContext,
    StationPlacementStates
> {
    protected _eventReactions: EventReactions<
        StationPlacementEvents,
        StationPlacementContext,
        StationPlacementStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                context.startDrag(worldPos);
            },
            defaultTargetState: 'HOVER_FOR_END',
        },
        endPlacement: {
            action: context => context.cancelPlacement(),
            defaultTargetState: 'IDLE',
        },
        escapeKey: {
            action: context => context.cancelPlacement(),
            defaultTargetState: 'IDLE',
        },
    };
}

/** Start point set; following pointer to show preview. Click to place. */
class StationPlacementHoverForEndState extends TemplateState<
    StationPlacementEvents,
    StationPlacementContext,
    StationPlacementStates
> {
    protected _eventReactions: EventReactions<
        StationPlacementEvents,
        StationPlacementContext,
        StationPlacementStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                context.updateDrag(worldPos);
            },
            defaultTargetState: 'HOVER_FOR_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                context.finishDrag(worldPos);
            },
            defaultTargetState: 'HOVER_FOR_START',
        },
        escapeKey: {
            action: context => context.cancelPlacement(),
            defaultTargetState: 'HOVER_FOR_START',
        },
        endPlacement: {
            action: context => context.cancelPlacement(),
            defaultTargetState: 'IDLE',
        },
    };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export class StationPlacementStateMachine extends TemplateStateMachine<
    StationPlacementEvents,
    StationPlacementContext,
    StationPlacementStates
> {
    constructor(context: StationPlacementContext) {
        super(
            {
                IDLE: new StationPlacementIdleState(),
                HOVER_FOR_START: new StationPlacementHoverForStartState(),
                HOVER_FOR_END: new StationPlacementHoverForEndState(),
            },
            'IDLE',
            context
        );
    }
}
