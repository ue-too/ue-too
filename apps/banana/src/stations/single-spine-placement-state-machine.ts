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
import { validateSpine, computeAnchorPoint, sampleSpineEdge, computeStopPositions } from './spine-utils';
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
    showHint: (key: string) => void;
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
    private _onHint: (key: string) => void;

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
        onHint?: (key: string) => void,
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._stationManager = stationManager;
        this._platformManager = platformManager;
        this._platformRenderSystem = platformRenderSystem;
        this._onHint = onHint ?? (() => {});
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
        this._onHint('hintPickStart');
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

        this._onHint('hintPickEnd');
        return true;
    }

    updateEnd(position: Point): boolean {
        if (!this._hasStart || this._spine.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) {
            this._updatePlacementPreview();
            return false;
        }

        const startEntry = this._spine[0];
        const startSeg = startEntry.trackSegment;
        const startT = startEntry.tStart;
        const side = startEntry.side;

        let tentativeSpine: SpineEntry[];

        if (projection.curve === startSeg) {
            const tEnd = projection.atT;
            if (Math.abs(tEnd - startT) < 1e-6) {
                this._updatePlacementPreview();
                return false;
            }
            tentativeSpine = [
                {
                    trackSegment: startSeg,
                    tStart: startT,
                    tEnd,
                    side,
                },
            ];
        } else {
            const built = this._buildSpinePath(
                startSeg,
                startT,
                side,
                projection.curve,
                projection.atT,
            );
            if (built === null) {
                this._updatePlacementPreview();
                return false;
            }
            tentativeSpine = built;
        }

        // Compute tentative end anchor at the exact projection point.
        let tentativeEndAnchor: Point | null = null;
        const lastEntry = tentativeSpine[tentativeSpine.length - 1];
        const endCurve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (endCurve !== null) {
            const endPointEntry: SpineEntry = {
                trackSegment: projection.curve,
                tStart: projection.atT,
                tEnd: projection.atT,
                side: lastEntry.side,
            };
            tentativeEndAnchor = computeAnchorPoint(
                endPointEntry,
                'start',
                this._offset,
                () => endCurve,
            );
        }

        // Show preview with the tentative spine (without committing state).
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spinePoints: Point[];
        try {
            spinePoints = sampleSpineEdge(tentativeSpine, this._offset, getCurve);
        } catch {
            spinePoints = [];
        }

        this._platformRenderSystem.showPlacementPreview(
            spinePoints,
            this._outerVertices,
            this._startAnchor,
            tentativeEndAnchor,
        );

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
                    tStart: startT,
                    tEnd,
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

        // Compute end anchor at the exact projection point.
        const lastEntry = finalSpine[finalSpine.length - 1];
        const endCurve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (endCurve !== null) {
            const endPointEntry: SpineEntry = {
                trackSegment: projection.curve,
                tStart: projection.atT,
                tEnd: projection.atT,
                side: lastEntry.side,
            };
            this._endAnchor = computeAnchorPoint(endPointEntry, 'start', this._offset, () => endCurve);
        }

        this._hasEnd = true;
        this._updatePlacementPreview();
        this._onHint('hintDrawOuter');
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

        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        const platformId = this._platformManager.createPlatform({
            stationId: this._activeStationId,
            spineA: [...this._spine],
            spineB: null,
            offset: this._offset,
            outerVertices: {
                kind: 'single',
                vertices: [...this._outerVertices],
            },
            stopPositions: computeStopPositions(this._spine, getCurve),
        });

        station.trackAlignedPlatforms.push(platformId);

        // When the first platform is added, reposition the station to the
        // spine midpoint so the station label sits on the platform.
        if (station.trackAlignedPlatforms.length === 1 && station.platforms.length === 0) {
            const stops = computeStopPositions(this._spine, getCurve);
            if (stops.length > 0) {
                const curve = getCurve(stops[0].trackSegmentId);
                station.position = curve.get(stops[0].tValue);
            }
        }

        const elevation = station.elevation;
        this._platformRenderSystem.addPlatform(platformId, elevation);

        // Notify after the station's trackAlignedPlatforms array is updated
        // so subscribers (e.g. debug overlay) see the new platform.
        this._platformManager.notifyChange();

        this._platformRenderSystem.hidePreview();
        this._onHint('hintPlatformCreated');
        this._resetState();
        // Set _isFinalized AFTER _resetState so the guard sees it as true
        // and transitions from DRAW_OUTER → PICK_START.
        this._isFinalized = true;
    }

    cancel(): void {
        this._platformRenderSystem.hidePreview();
        this._resetState();
    }

    showHint(key: string): void {
        this._onHint(key);
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
    /**
     * Converts a sequence of segment IDs into SpineEntry objects.
     *
     * The side value is propagated from the user's original pick. At each
     * segment junction the tangent vectors of both curves are compared via dot
     * product: if they point in opposite directions the side is flipped so that
     * the offset stays on the same geometric side of the track.
     */
    private _pathToSpineEntries(
        path: number[],
        startT: number,
        side: 1 | -1,
        endT: number,
    ): SpineEntry[] {
        const entries: SpineEntry[] = [];
        let currentSide = side;

        for (let i = 0; i < path.length; i++) {
            const segId = path[i];
            const isFirst = i === 0;
            const isLast = i === path.length - 1;

            const segment = this._trackGraph.getTrackSegmentWithJoints(segId);

            let tStart: number;
            let tEnd: number;

            if (isFirst && isLast) {
                // Same segment — preserve user's drawing direction.
                tStart = startT;
                tEnd = endT;
            } else if (isFirst) {
                // First segment: determine exit direction toward next segment.
                if (segment !== null) {
                    const nextSegId = path[i + 1];
                    const nextSeg = this._trackGraph.getTrackSegmentWithJoints(nextSegId);
                    if (nextSeg !== null) {
                        const exitT = this._sharedJointT(segment, nextSeg);
                        tStart = startT;
                        tEnd = exitT;
                    } else {
                        tStart = startT;
                        tEnd = 1;
                    }
                } else {
                    tStart = startT;
                    tEnd = 1;
                }
                // First segment always keeps the user's original side — no flip.
            } else {
                // Non-first segment: determine entry t and check for side flip.
                const prevSegId = path[i - 1];
                const prevSeg = this._trackGraph.getTrackSegmentWithJoints(prevSegId);

                let entryT: 0 | 1 = 0;

                if (segment !== null && prevSeg !== null) {
                    entryT = this._sharedJointT(segment, prevSeg);

                    // Compare tangent directions at the junction to decide side flip.
                    const prevCurve = this._trackGraph.getTrackSegmentCurve(prevSegId);
                    const thisCurve = this._trackGraph.getTrackSegmentCurve(segId);
                    if (prevCurve !== null && thisCurve !== null) {
                        const prevExitT = this._sharedJointT(prevSeg, segment);
                        const prevTangent = prevCurve.derivative(prevExitT);
                        const thisTangent = thisCurve.derivative(entryT);
                        const dot =
                            prevTangent.x * thisTangent.x +
                            prevTangent.y * thisTangent.y;
                        if (dot < 0) {
                            currentSide = (currentSide * -1) as 1 | -1;
                        }
                    }
                }

                if (isLast) {
                    tStart = entryT;
                    tEnd = endT;
                } else {
                    // Middle segment: determine exit toward next segment.
                    if (segment !== null) {
                        const nextSegId = path[i + 1];
                        const nextSeg = this._trackGraph.getTrackSegmentWithJoints(nextSegId);
                        if (nextSeg !== null) {
                            tStart = entryT;
                            tEnd = this._sharedJointT(segment, nextSeg);
                        } else {
                            tStart = entryT;
                            tEnd = entryT === 0 ? 1 : 0;
                        }
                    } else {
                        tStart = entryT;
                        tEnd = entryT === 0 ? 1 : 0;
                    }
                }
            }

            entries.push({
                trackSegment: segId,
                tStart,
                tEnd,
                side: currentSide,
            });
        }

        return entries;
    }

    /**
     * Returns the t-value (0 or 1) on `seg` at the joint it shares with `other`.
     * Falls back to 1 if no shared joint is found.
     */
    private _sharedJointT(
        seg: { t0Joint: number; t1Joint: number },
        other: { t0Joint: number; t1Joint: number },
    ): 0 | 1 {
        const otherJoints = new Set([other.t0Joint, other.t1Joint]);
        if (otherJoints.has(seg.t0Joint)) return 0;
        if (otherJoints.has(seg.t1Joint)) return 1;
        return 1; // fallback
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
