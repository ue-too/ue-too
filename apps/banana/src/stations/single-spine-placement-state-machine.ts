import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { TemplateState, TemplateStateMachine } from '@ue-too/being';
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

import type { StationManager } from './station-manager';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatformRenderSystem } from './track-aligned-platform-render-system';
import { computePlatformOffset } from './platform-offset';
import { validateSpine, computeAnchorPoint, sampleSpineEdge } from './spine-utils';
import type { SpineEntry } from './track-aligned-platform-types';

// ---------------------------------------------------------------------------
// States & Events
// ---------------------------------------------------------------------------

export const SINGLE_SPINE_PLACEMENT_STATES = [
    'IDLE',
    'PICK_START',
    'PICK_END',
    'DRAW_OUTER',
] as const;

export type SingleSpineStates = CreateStateType<typeof SINGLE_SPINE_PLACEMENT_STATES>;

export type SingleSpineEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    startPlacement: { stationId: number };
    endPlacement: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface SingleSpineContext extends BaseContext {
    readonly activeStationId: number | null;
    readonly hasStart: boolean;
    readonly hasEnd: boolean;
    readonly isFinalized: boolean;
    setStation: (stationId: number) => void;
    hoverUpdate: (position: Point) => void;
    pickStart: (position: Point) => boolean;
    updateEnd: (position: Point) => boolean;
    confirmEnd: (position: Point) => boolean;
    addOuterVertex: (position: Point) => boolean;
    isNearClosingAnchor: (position: Point) => boolean;
    finalize: () => void;
    cancel: () => void;
    convert2WorldPosition: (position: Point) => Point;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/** Snap radius for closing the outer vertex polygon (meters). */
const CLOSING_SNAP_RADIUS = 2;

export class SingleSpinePlacementEngine
    extends ObservableInputTracker
    implements SingleSpineContext
{
    private _trackGraph: TrackGraph;
    private _stationManager: StationManager;
    private _platformManager: TrackAlignedPlatformManager;
    private _platformRenderSystem: TrackAlignedPlatformRenderSystem;
    private _camera: ObservableBoardCamera;

    // State
    private _activeStationId: number | null = null;
    private _hasStart = false;
    private _hasEnd = false;
    private _isFinalized = false;

    // Placement data
    private _spine: SpineEntry[] = [];
    private _outerVertices: Point[] = [];
    private _startAnchor: Point | null = null;
    private _endAnchor: Point | null = null;
    private _offset = 0;

    constructor(
        canvas: Canvas,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
        stationManager: StationManager,
        platformManager: TrackAlignedPlatformManager,
        platformRenderSystem: TrackAlignedPlatformRenderSystem,
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._stationManager = stationManager;
        this._platformManager = platformManager;
        this._platformRenderSystem = platformRenderSystem;
    }

    // -------------------------------------------------------------------------
    // Context properties
    // -------------------------------------------------------------------------

    get activeStationId(): number | null {
        return this._activeStationId;
    }

    get hasStart(): boolean {
        return this._hasStart;
    }

    get hasEnd(): boolean {
        return this._hasEnd;
    }

    get isFinalized(): boolean {
        return this._isFinalized;
    }

    // -------------------------------------------------------------------------
    // Context methods
    // -------------------------------------------------------------------------

    setStation(stationId: number): void {
        this._activeStationId = stationId;
    }

    hoverUpdate(position: Point): void {
        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) {
            this._platformRenderSystem.hidePreview();
            return;
        }

        const segment = this._trackGraph.getTrackSegmentWithJoints(projection.curve);
        if (segment === null) {
            this._platformRenderSystem.hidePreview();
            return;
        }

        // Determine which side the cursor is on.
        const { tangent, projectionPoint } = projection;
        const dx = position.x - projectionPoint.x;
        const dy = position.y - projectionPoint.y;
        const cross = tangent.x * dy - tangent.y * dx;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        this._platformRenderSystem.showTrackHighlight(projection.curve, projection.atT, side, offset);
    }

    pickStart(position: Point): boolean {
        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) return false;

        const segment = this._trackGraph.getTrackSegmentWithJoints(projection.curve);
        if (segment === null) return false;

        // Validate that the start point is within reasonable distance of the station.
        if (this._activeStationId !== null) {
            const station = this._stationManager.getStation(this._activeStationId);
            if (station !== null) {
                const dist = PointCal.distanceBetweenPoints(position, station.position);
                if (dist > 500) return false;
            }
        }

        // Determine side from cross product of tangent × (cursor - projectionPoint).
        const { tangent, projectionPoint } = projection;
        const dx = position.x - projectionPoint.x;
        const dy = position.y - projectionPoint.y;
        // cross product z-component: tangent × delta
        const cross = tangent.x * dy - tangent.y * dx;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        this._offset = offset;

        const startEntry: SpineEntry = {
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT, // will be updated by confirmEnd
            side,
        };

        this._spine = [startEntry];
        this._outerVertices = [];
        this._hasStart = true;
        this._hasEnd = false;
        this._isFinalized = false;

        // Compute start anchor.
        const curve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (curve !== null) {
            this._startAnchor = computeAnchorPoint(startEntry, 'start', offset, () => curve);
        }

        // Show preview with just the start anchor.
        this._updatePlacementPreview();

        return true;
    }

    updateEnd(position: Point): boolean {
        if (!this._hasStart || this._spine.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) return false;

        // Minimal preview update — just track the projected point for now.
        return true;
    }

    confirmEnd(position: Point): boolean {
        if (!this._hasStart || this._spine.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) return false;

        const startEntry = this._spine[0];
        const startSeg = startEntry.trackSegment;
        const startT = startEntry.tStart;
        const side = startEntry.side;

        let finalSpine: SpineEntry[];

        if (projection.curve === startSeg) {
            // Same segment — just update tEnd.
            const tEnd = projection.atT;
            // Ensure tEnd != tStart (minimum length).
            if (Math.abs(tEnd - startT) < 1e-6) return false;
            finalSpine = [
                {
                    trackSegment: startSeg,
                    tStart: Math.min(startT, tEnd),
                    tEnd: Math.max(startT, tEnd),
                    side,
                },
            ];
        } else {
            // Multi-segment — walk through non-branching joints.
            const built = this._buildSpinePath(startSeg, startT, side, projection.curve, projection.atT);
            if (built === null) return false;
            finalSpine = built;
        }

        // Validate the spine.
        const validationResult = validateSpine(
            finalSpine,
            (id) => {
                const seg = this._trackGraph.getTrackSegmentWithJoints(id);
                if (seg === null) throw new Error(`Missing segment ${id}`);
                return seg;
            },
            (id) => {
                const joint = this._trackGraph.getJoint(id);
                if (joint === null) throw new Error(`Missing joint ${id}`);
                return joint as { connections: Map<number, number> };
            },
        );

        if (!validationResult.valid) return false;

        this._spine = finalSpine;

        // Compute end anchor.
        const lastEntry = finalSpine[finalSpine.length - 1];
        const endCurve = this._trackGraph.getTrackSegmentCurve(lastEntry.trackSegment);
        if (endCurve !== null) {
            this._endAnchor = computeAnchorPoint(lastEntry, 'end', this._offset, () => endCurve);
        }

        this._hasEnd = true;
        this._updatePlacementPreview();
        return true;
    }

    addOuterVertex(position: Point): boolean {
        this._outerVertices.push(position);
        this._updatePlacementPreview();
        return true;
    }

    isNearClosingAnchor(position: Point): boolean {
        if (this._startAnchor === null) return false;
        return PointCal.distanceBetweenPoints(position, this._startAnchor) <= CLOSING_SNAP_RADIUS;
    }

    finalize(): void {
        if (
            this._activeStationId === null ||
            this._spine.length === 0 ||
            !this._hasStart ||
            !this._hasEnd
        ) {
            this._resetState();
            return;
        }

        const station = this._stationManager.getStation(this._activeStationId);
        if (station === null) {
            this._resetState();
            return;
        }

        const platformId = this._platformManager.createPlatform({
            stationId: this._activeStationId,
            spineA: [...this._spine],
            spineB: null,
            offset: this._offset,
            outerVertices: {
                kind: 'single',
                vertices: [...this._outerVertices],
            },
            stopPositions: [],
        });

        station.trackAlignedPlatforms.push(platformId);

        const elevation = station.elevation;
        this._platformRenderSystem.addPlatform(platformId, elevation);

        this._isFinalized = true;
        this._platformRenderSystem.hidePreview();
        this._resetState();
    }

    cancel(): void {
        this._platformRenderSystem.hidePreview();
        this._resetState();
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
            false,
        );
    }

    convert2WindowPosition(position: Point): Point {
        const pointInViewPort = convertFromWorld2Viewport(
            position,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation,
        );
        const pointInCanvas = convertFromViewPort2Canvas(pointInViewPort, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromCanvas2Window(pointInCanvas, this.canvas);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private _resetState(): void {
        this._hasStart = false;
        this._hasEnd = false;
        this._isFinalized = false;
        this._spine = [];
        this._outerVertices = [];
        this._startAnchor = null;
        this._endAnchor = null;
        this._offset = 0;
    }

    private _updatePlacementPreview(): void {
        if (this._spine.length === 0) return;

        // Sample spine edge points.
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spinePoints: Point[];
        try {
            spinePoints = sampleSpineEdge(this._spine, this._offset, getCurve);
        } catch {
            spinePoints = [];
        }

        this._platformRenderSystem.showPlacementPreview(
            spinePoints,
            this._outerVertices,
            this._startAnchor,
            this._endAnchor,
        );
    }

    /**
     * Builds a spine path from `startSeg` to `endSeg` by walking through
     * non-branching joints using BFS.
     */
    private _buildSpinePath(
        startSeg: number,
        startT: number,
        side: 1 | -1,
        endSeg: number,
        endT: number,
    ): SpineEntry[] | null {
        // BFS from startSeg to endSeg.
        type QueueEntry = { segId: number; path: number[] };
        const visited = new Set<number>();
        const queue: QueueEntry[] = [{ segId: startSeg, path: [startSeg] }];

        while (queue.length > 0) {
            const { segId, path } = queue.shift()!;

            if (segId === endSeg) {
                // Build spine entries from path.
                return this._pathToSpineEntries(path, startT, side, endT);
            }

            if (visited.has(segId)) continue;
            visited.add(segId);

            const segment = this._trackGraph.getTrackSegmentWithJoints(segId);
            if (segment === null) continue;

            // Try both joints of this segment.
            for (const jointId of [segment.t0Joint, segment.t1Joint]) {
                const joint = this._trackGraph.getJoint(jointId);
                if (joint === null) continue;

                // Only traverse through non-branching joints.
                if (joint.connections.size > 2) continue;

                for (const [, connectedSegId] of joint.connections) {
                    if (!visited.has(connectedSegId) && connectedSegId !== segId) {
                        queue.push({ segId: connectedSegId, path: [...path, connectedSegId] });
                    }
                }
            }
        }

        return null;
    }

    /**
     * Converts a sequence of segment IDs into SpineEntry objects.
     */
    private _pathToSpineEntries(
        path: number[],
        startT: number,
        side: 1 | -1,
        endT: number,
    ): SpineEntry[] {
        const entries: SpineEntry[] = [];

        for (let i = 0; i < path.length; i++) {
            const segId = path[i];
            const isFirst = i === 0;
            const isLast = i === path.length - 1;

            let tStart: number;
            let tEnd: number;
            let entrySide: 1 | -1 = side;

            if (isFirst && isLast) {
                tStart = Math.min(startT, endT);
                tEnd = Math.max(startT, endT);
            } else if (isFirst) {
                // For the first segment, we need to determine direction.
                // Walk from startT toward the connecting joint.
                const segment = this._trackGraph.getTrackSegmentWithJoints(segId);
                if (segment === null) {
                    tStart = startT;
                    tEnd = 1;
                } else {
                    // Find shared joint with next segment.
                    const nextSegId = path[i + 1];
                    const nextSeg = this._trackGraph.getTrackSegmentWithJoints(nextSegId);
                    if (nextSeg !== null) {
                        const segJoints = new Set([segment.t0Joint, segment.t1Joint]);
                        const nextJoints = [nextSeg.t0Joint, nextSeg.t1Joint];
                        const sharedJoint = nextJoints.find((j) => segJoints.has(j));
                        if (sharedJoint === segment.t1Joint) {
                            tStart = startT;
                            tEnd = 1;
                        } else {
                            // Shared joint is t0Joint — going backwards.
                            tStart = 0;
                            tEnd = startT;
                            entrySide = (side * -1) as 1 | -1;
                        }
                    } else {
                        tStart = startT;
                        tEnd = 1;
                    }
                }
            } else if (isLast) {
                const segment = this._trackGraph.getTrackSegmentWithJoints(segId);
                if (segment === null) {
                    tStart = 0;
                    tEnd = endT;
                } else {
                    // Find shared joint with previous segment.
                    const prevSegId = path[i - 1];
                    const prevSeg = this._trackGraph.getTrackSegmentWithJoints(prevSegId);
                    if (prevSeg !== null) {
                        const prevJoints = new Set([prevSeg.t0Joint, prevSeg.t1Joint]);
                        const segJoints = [segment.t0Joint, segment.t1Joint];
                        const sharedJoint = segJoints.find((j) => prevJoints.has(j));
                        if (sharedJoint === segment.t0Joint) {
                            tStart = 0;
                            tEnd = endT;
                        } else {
                            // Shared joint is t1Joint — entering from t1.
                            tStart = endT;
                            tEnd = 1;
                            entrySide = (side * -1) as 1 | -1;
                        }
                    } else {
                        tStart = 0;
                        tEnd = endT;
                    }
                }
            } else {
                tStart = 0;
                tEnd = 1;
            }

            entries.push({
                trackSegment: segId,
                tStart,
                tEnd,
                side: entrySide,
            });
        }

        return entries;
    }
}

// ---------------------------------------------------------------------------
// State machine states
// ---------------------------------------------------------------------------

class SingleSpineIdleState extends TemplateState<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
> {
    protected _eventReactions: EventReactions<
        SingleSpineEvents,
        SingleSpineContext,
        SingleSpineStates
    > = {
        startPlacement: {
            action: (context, event) => {
                context.setStation(event.stationId);
            },
            defaultTargetState: 'PICK_START',
        },
    };
}

class SingleSpinePickStartState extends TemplateState<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
> {
    protected _eventReactions: EventReactions<
        SingleSpineEvents,
        SingleSpineContext,
        SingleSpineStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.hoverUpdate(worldPos);
            },
            defaultTargetState: 'PICK_START',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.pickStart(worldPos);
            },
            defaultTargetState: 'PICK_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        started: (context) => context.hasStart,
    };

    protected _eventGuards: Partial<
        EventGuards<
            SingleSpineEvents,
            SingleSpineStates,
            SingleSpineContext,
            Guard<SingleSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'started',
                target: 'PICK_END',
            },
        ],
    };
}

class SingleSpinePickEndState extends TemplateState<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
> {
    protected _eventReactions: EventReactions<
        SingleSpineEvents,
        SingleSpineContext,
        SingleSpineStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.updateEnd(worldPos);
            },
            defaultTargetState: 'PICK_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.confirmEnd(worldPos);
            },
            defaultTargetState: 'PICK_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        confirmed: (context) => context.hasEnd,
    };

    protected _eventGuards: Partial<
        EventGuards<
            SingleSpineEvents,
            SingleSpineStates,
            SingleSpineContext,
            Guard<SingleSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'confirmed',
                target: 'DRAW_OUTER',
            },
        ],
    };
}

class SingleSpineDrawOuterState extends TemplateState<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
> {
    protected _eventReactions: EventReactions<
        SingleSpineEvents,
        SingleSpineContext,
        SingleSpineStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                if (context.isNearClosingAnchor(worldPos)) {
                    context.finalize();
                } else {
                    context.addOuterVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_OUTER',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        finalized: (context) => context.isFinalized,
    };

    protected _eventGuards: Partial<
        EventGuards<
            SingleSpineEvents,
            SingleSpineStates,
            SingleSpineContext,
            Guard<SingleSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'finalized',
                target: 'PICK_START',
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// State machine type & factory
// ---------------------------------------------------------------------------

export type SingleSpinePlacementStateMachine = StateMachine<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
>;

export function createSingleSpinePlacementStateMachine(
    context: SingleSpineContext,
): SingleSpinePlacementStateMachine {
    return new TemplateStateMachine<SingleSpineEvents, SingleSpineContext, SingleSpineStates>(
        {
            IDLE: new SingleSpineIdleState(),
            PICK_START: new SingleSpinePickStartState(),
            PICK_END: new SingleSpinePickEndState(),
            DRAW_OUTER: new SingleSpineDrawOuterState(),
        },
        'IDLE',
        context,
    );
}
