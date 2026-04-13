import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState, TemplateStateMachine } from '@ue-too/being';
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

import type { StationManager } from './station-manager';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatformRenderSystem } from './track-aligned-platform-render-system';
import { computePlatformOffset } from './platform-offset';
import { validateSpine, computeAnchorPoint } from './spine-utils';
import type { SpineEntry } from './track-aligned-platform-types';

// ---------------------------------------------------------------------------
// States & Events
// ---------------------------------------------------------------------------

export const DUAL_SPINE_PLACEMENT_STATES = [
    'IDLE',
    'PICK_SPINE_A_START',
    'PICK_SPINE_A_END',
    'PICK_SPINE_B_START',
    'PICK_SPINE_B_END',
    'DRAW_END_CAP_1',
    'DRAW_END_CAP_2',
] as const;

export type DualSpineStates = CreateStateType<typeof DUAL_SPINE_PLACEMENT_STATES>;

export type DualSpineEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    startPlacement: { stationId: number };
    endPlacement: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface DualSpineContext extends BaseContext {
    readonly activeStationId: number | null;
    setStation: (stationId: number) => void;

    // Spine A picking
    pickSpineAStart: (position: Point) => boolean;
    updateSpineAEnd: (position: Point) => boolean;
    confirmSpineAEnd: (position: Point) => boolean;

    // Spine B picking
    pickSpineBStart: (position: Point) => boolean;
    updateSpineBEnd: (position: Point) => boolean;
    confirmSpineBEnd: (position: Point) => boolean;

    // End caps
    addCapAVertex: (position: Point) => boolean;
    isNearCapAClosingAnchor: (position: Point) => boolean;
    confirmCapA: () => void;

    addCapBVertex: (position: Point) => boolean;
    isNearCapBClosingAnchor: (position: Point) => boolean;

    finalize: () => void;
    cancel: () => void;
    convert2WorldPosition: (position: Point) => Point;

    // Guard flags
    readonly hasSpineAStart: boolean;
    readonly hasSpineAEnd: boolean;
    readonly hasSpineBStart: boolean;
    readonly hasSpineBEnd: boolean;
    readonly isCapAClosed: boolean;
    readonly isFinalized: boolean;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/** Snap radius for closing an end cap polygon (meters). */
const CLOSING_SNAP_RADIUS = 2;

export class DualSpinePlacementEngine
    extends ObservableInputTracker
    implements DualSpineContext
{
    private _trackGraph: TrackGraph;
    private _stationManager: StationManager;
    private _platformManager: TrackAlignedPlatformManager;
    private _platformRenderSystem: TrackAlignedPlatformRenderSystem;
    private _camera: ObservableBoardCamera;

    // State
    private _activeStationId: number | null = null;
    private _hasSpineAStart = false;
    private _hasSpineAEnd = false;
    private _hasSpineBStart = false;
    private _hasSpineBEnd = false;
    private _isCapAClosed = false;
    private _isFinalized = false;

    // Placement data — spine A
    private _spineA: SpineEntry[] = [];
    private _spineAStartAnchor: Point | null = null;
    private _spineAEndAnchor: Point | null = null;
    private _spineAOffset = 0;

    // Placement data — spine B
    private _spineB: SpineEntry[] = [];
    private _spineBStartAnchor: Point | null = null;
    private _spineBEndAnchor: Point | null = null;

    // Cap vertex arrays
    private _capA: Point[] = [];
    private _capB: Point[] = [];

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

    get hasSpineAStart(): boolean {
        return this._hasSpineAStart;
    }

    get hasSpineAEnd(): boolean {
        return this._hasSpineAEnd;
    }

    get hasSpineBStart(): boolean {
        return this._hasSpineBStart;
    }

    get hasSpineBEnd(): boolean {
        return this._hasSpineBEnd;
    }

    get isCapAClosed(): boolean {
        return this._isCapAClosed;
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

    pickSpineAStart(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
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
        const cross = tangent.x * dy - tangent.y * dx;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        this._spineAOffset = offset;

        const startEntry: SpineEntry = {
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT,
            side,
        };

        this._spineA = [startEntry];
        this._hasSpineAStart = true;
        this._hasSpineAEnd = false;

        // Compute start anchor.
        const curve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (curve !== null) {
            this._spineAStartAnchor = computeAnchorPoint(startEntry, 'start', offset, () => curve);
        }

        return true;
    }

    updateSpineAEnd(position: Point): boolean {
        if (!this._hasSpineAStart || this._spineA.length === 0) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        return true;
    }

    confirmSpineAEnd(position: Point): boolean {
        if (!this._hasSpineAStart || this._spineA.length === 0) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        const startEntry = this._spineA[0];
        const startSeg = startEntry.trackSegment;
        const startT = startEntry.tStart;
        const side = startEntry.side;

        let finalSpine: SpineEntry[];

        if (projection.curve === startSeg) {
            const tEnd = projection.atT;
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
            const built = this._buildSpinePath(startSeg, startT, side, projection.curve, projection.atT);
            if (built === null) return false;
            finalSpine = built;
        }

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

        this._spineA = finalSpine;

        // Compute end anchor.
        const lastEntry = finalSpine[finalSpine.length - 1];
        const endCurve = this._trackGraph.getTrackSegmentCurve(lastEntry.trackSegment);
        if (endCurve !== null) {
            this._spineAEndAnchor = computeAnchorPoint(lastEntry, 'end', this._spineAOffset, () => endCurve);
        }

        this._hasSpineAEnd = true;
        return true;
    }

    pickSpineBStart(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        const segment = this._trackGraph.getTrackSegmentWithJoints(projection.curve);
        if (segment === null) return false;

        // Elevation check: spine B must be at the same elevation as spine A.
        if (this._spineA.length > 0) {
            const segA = this._spineA[0];
            const segAFull = this._trackGraph.getTrackSegmentWithJoints(segA.trackSegment);
            if (segAFull !== null) {
                const jointA = this._trackGraph.getJoint(segAFull.t0Joint);
                const jointB = this._trackGraph.getJoint(segment.t0Joint);
                if (jointA !== null && jointB !== null) {
                    if ((jointA as any).elevation !== (jointB as any).elevation) return false;
                }
            }
        }

        const { tangent, projectionPoint } = projection;
        const dx = position.x - projectionPoint.x;
        const dy = position.y - projectionPoint.y;
        const cross = tangent.x * dy - tangent.y * dx;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        const startEntry: SpineEntry = {
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT,
            side,
        };

        this._spineB = [startEntry];
        this._hasSpineBStart = true;
        this._hasSpineBEnd = false;

        // Compute start anchor.
        const curve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (curve !== null) {
            this._spineBStartAnchor = computeAnchorPoint(startEntry, 'start', this._spineAOffset, () => curve);
        }

        return true;
    }

    updateSpineBEnd(position: Point): boolean {
        if (!this._hasSpineBStart || this._spineB.length === 0) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        return true;
    }

    confirmSpineBEnd(position: Point): boolean {
        if (!this._hasSpineBStart || this._spineB.length === 0) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        const startEntry = this._spineB[0];
        const startSeg = startEntry.trackSegment;
        const startT = startEntry.tStart;
        const side = startEntry.side;

        let finalSpine: SpineEntry[];

        if (projection.curve === startSeg) {
            const tEnd = projection.atT;
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
            const built = this._buildSpinePath(startSeg, startT, side, projection.curve, projection.atT);
            if (built === null) return false;
            finalSpine = built;
        }

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

        this._spineB = finalSpine;

        // Compute end anchor.
        const lastEntry = finalSpine[finalSpine.length - 1];
        const endCurve = this._trackGraph.getTrackSegmentCurve(lastEntry.trackSegment);
        if (endCurve !== null) {
            this._spineBEndAnchor = computeAnchorPoint(lastEntry, 'end', this._spineAOffset, () => endCurve);
        }

        this._hasSpineBEnd = true;
        return true;
    }

    addCapAVertex(position: Point): boolean {
        this._capA.push(position);
        return true;
    }

    /**
     * Cap A connects spine A end anchor to spine B end anchor.
     * The closing anchor for cap A is spine B's end anchor.
     */
    isNearCapAClosingAnchor(position: Point): boolean {
        if (this._spineBEndAnchor === null) return false;
        return PointCal.distanceBetweenPoints(position, this._spineBEndAnchor) <= CLOSING_SNAP_RADIUS;
    }

    confirmCapA(): void {
        this._isCapAClosed = true;
    }

    addCapBVertex(position: Point): boolean {
        this._capB.push(position);
        return true;
    }

    /**
     * Cap B connects spine B start anchor to spine A start anchor.
     * The closing anchor for cap B is spine A's start anchor.
     */
    isNearCapBClosingAnchor(position: Point): boolean {
        if (this._spineAStartAnchor === null) return false;
        return PointCal.distanceBetweenPoints(position, this._spineAStartAnchor) <= CLOSING_SNAP_RADIUS;
    }

    finalize(): void {
        if (
            this._activeStationId === null ||
            this._spineA.length === 0 ||
            this._spineB.length === 0 ||
            !this._hasSpineAStart ||
            !this._hasSpineAEnd ||
            !this._hasSpineBStart ||
            !this._hasSpineBEnd
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
            spineA: [...this._spineA],
            spineB: [...this._spineB],
            offset: this._spineAOffset,
            outerVertices: {
                kind: 'dual',
                capA: [...this._capA],
                capB: [...this._capB],
            },
            stopPositions: [],
        });

        station.trackAlignedPlatforms.push(platformId);

        const elevation = station.elevation;
        this._platformRenderSystem.addPlatform(platformId, elevation);

        this._isFinalized = true;
        this._resetState();
    }

    cancel(): void {
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
        this._hasSpineAStart = false;
        this._hasSpineAEnd = false;
        this._hasSpineBStart = false;
        this._hasSpineBEnd = false;
        this._isCapAClosed = false;
        this._isFinalized = false;
        this._spineA = [];
        this._spineB = [];
        this._spineAStartAnchor = null;
        this._spineAEndAnchor = null;
        this._spineBStartAnchor = null;
        this._spineBEndAnchor = null;
        this._spineAOffset = 0;
        this._capA = [];
        this._capB = [];
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
        type QueueEntry = { segId: number; path: number[] };
        const visited = new Set<number>();
        const queue: QueueEntry[] = [{ segId: startSeg, path: [startSeg] }];

        while (queue.length > 0) {
            const { segId, path } = queue.shift()!;

            if (segId === endSeg) {
                return this._pathToSpineEntries(path, startT, side, endT);
            }

            if (visited.has(segId)) continue;
            visited.add(segId);

            const segment = this._trackGraph.getTrackSegmentWithJoints(segId);
            if (segment === null) continue;

            for (const jointId of [segment.t0Joint, segment.t1Joint]) {
                const joint = this._trackGraph.getJoint(jointId);
                if (joint === null) continue;

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
                const segment = this._trackGraph.getTrackSegmentWithJoints(segId);
                if (segment === null) {
                    tStart = startT;
                    tEnd = 1;
                } else {
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

class DualSpineIdleState extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        startPlacement: {
            action: (context, event) => {
                context.setStation(event.stationId);
            },
            defaultTargetState: 'PICK_SPINE_A_START',
        },
    };
}

class DualSpinePickSpineAStartState extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.pickSpineAStart(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_START',
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

    protected _guards: Guard<DualSpineContext, string> = {
        started: (context) => context.hasSpineAStart,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'started',
                target: 'PICK_SPINE_A_END',
            },
        ],
    };
}

class DualSpinePickSpineAEndState extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.updateSpineAEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.confirmSpineAEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        confirmed: (context) => context.hasSpineAEnd,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'confirmed',
                target: 'PICK_SPINE_B_START',
            },
        ],
    };
}

class DualSpinePickSpineBStartState extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.pickSpineBStart(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        started: (context) => context.hasSpineBStart,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'started',
                target: 'PICK_SPINE_B_END',
            },
        ],
    };
}

class DualSpinePickSpineBEndState extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.updateSpineBEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.confirmSpineBEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_B_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        confirmed: (context) => context.hasSpineBEnd,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'confirmed',
                target: 'DRAW_END_CAP_1',
            },
        ],
    };
}

class DualSpineDrawEndCap1State extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                if (context.isNearCapAClosingAnchor(worldPos)) {
                    context.confirmCapA();
                } else {
                    context.addCapAVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_END_CAP_1',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        capAClosed: (context) => context.isCapAClosed,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'capAClosed',
                target: 'DRAW_END_CAP_2',
            },
        ],
    };
}

class DualSpineDrawEndCap2State extends TemplateState<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
> {
    protected _eventReactions: EventReactions<
        DualSpineEvents,
        DualSpineContext,
        DualSpineStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                if (context.isNearCapBClosingAnchor(worldPos)) {
                    context.finalize();
                } else {
                    context.addCapBVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_END_CAP_2',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        finalized: (context) => context.isFinalized,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DualSpineEvents,
            DualSpineStates,
            DualSpineContext,
            Guard<DualSpineContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'finalized',
                target: 'PICK_SPINE_A_START',
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// State machine type & factory
// ---------------------------------------------------------------------------

export type DualSpinePlacementStateMachine = StateMachine<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
>;

export function createDualSpinePlacementStateMachine(
    context: DualSpineContext,
): DualSpinePlacementStateMachine {
    return new TemplateStateMachine<DualSpineEvents, DualSpineContext, DualSpineStates>(
        {
            IDLE: new DualSpineIdleState(),
            PICK_SPINE_A_START: new DualSpinePickSpineAStartState(),
            PICK_SPINE_A_END: new DualSpinePickSpineAEndState(),
            PICK_SPINE_B_START: new DualSpinePickSpineBStartState(),
            PICK_SPINE_B_END: new DualSpinePickSpineBEndState(),
            DRAW_END_CAP_1: new DualSpineDrawEndCap1State(),
            DRAW_END_CAP_2: new DualSpineDrawEndCap2State(),
        },
        'IDLE',
        context,
    );
}
