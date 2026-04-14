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
import type { TrackJointWithElevation } from '@/trains/tracks/types';

import type { StationManager } from './station-manager';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatformRenderSystem } from './track-aligned-platform-render-system';
import { computePlatformOffset } from './platform-offset';
import { validateSpine, computeAnchorPoint, sampleSpineEdge, computeStopPositions } from './spine-utils';
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
    'PICK_CAP_PAIRING',
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

    // Hover
    hoverUpdate: (position: Point) => void;

    // Spine A picking
    pickSpineAStart: (position: Point) => boolean;
    updateSpineAEnd: (position: Point) => boolean;
    confirmSpineAEnd: (position: Point) => boolean;

    // Spine B picking
    pickSpineBStart: (position: Point) => boolean;
    updateSpineBEnd: (position: Point) => boolean;
    confirmSpineBEnd: (position: Point) => boolean;

    // Cap pairing
    updateCapPairingHover: (position: Point) => void;
    pickCapPairing: (position: Point) => boolean;

    // End caps
    updateCapHover: (position: Point, cap: 'A' | 'B') => void;
    addCapAVertex: (position: Point) => boolean;
    isNearCapAClosingAnchor: (position: Point) => boolean;
    confirmCapA: () => void;

    addCapBVertex: (position: Point) => boolean;
    isNearCapBClosingAnchor: (position: Point) => boolean;

    finalize: () => void;
    cancel: () => void;
    convert2WorldPosition: (position: Point) => Point;
    showHint: (key: string) => void;

    // Guard flags
    readonly hasSpineAStart: boolean;
    readonly hasSpineAEnd: boolean;
    readonly hasSpineBStart: boolean;
    readonly hasSpineBEnd: boolean;
    readonly hasCapPairing: boolean;
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
    private _onHint: (key: string) => void;

    // State
    private _activeStationId: number | null = null;
    private _hasSpineAStart = false;
    private _hasSpineAEnd = false;
    private _hasSpineBStart = false;
    private _hasSpineBEnd = false;
    private _hasCapPairing = false;
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

    get hasCapPairing(): boolean {
        return this._hasCapPairing;
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
        this._onHint('hintDualPickSpineAStart');
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

        const { tangent, projectionPoint } = projection;
        const dx = position.x - projectionPoint.x;
        const dy = position.y - projectionPoint.y;
        const cross = tangent.x * dy - tangent.y * dx;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        this._platformRenderSystem.showTrackHighlight(projection.curve, projection.atT, side, offset);
    }

    pickSpineAStart(position: Point): boolean {
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

        this._updatePlacementPreview();
        this._onHint('hintDualPickSpineAEnd');
        return true;
    }

    updateSpineAEnd(position: Point): boolean {
        if (!this._hasSpineAStart || this._spineA.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) {
            this._updatePlacementPreview();
            return false;
        }

        const startEntry = this._spineA[0];
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
            const built = this._buildSpinePath(startSeg, startT, side, projection.curve, projection.atT);
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
                this._spineAOffset,
                () => endCurve,
            );
        }

        // Show preview with tentative spine A (without committing state).
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spineAPoints: Point[];
        try {
            spineAPoints = sampleSpineEdge(tentativeSpine, this._spineAOffset, getCurve);
        } catch {
            spineAPoints = [];
        }

        this._platformRenderSystem.showDualSpinePlacementPreview(
            spineAPoints,
            [],
            this._capA,
            this._capB,
            this._spineAStartAnchor,
            tentativeEndAnchor,
            null,
            null,
        );

        return true;
    }

    confirmSpineAEnd(position: Point): boolean {
        if (!this._hasSpineAStart || this._spineA.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
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
                    tStart: startT,
                    tEnd,
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
            this._spineAEndAnchor = computeAnchorPoint(endPointEntry, 'start', this._spineAOffset, () => endCurve);
        }

        this._hasSpineAEnd = true;
        this._updatePlacementPreview();
        this._onHint('hintDualPickSpineBStart');
        return true;
    }

    pickSpineBStart(position: Point): boolean {
        const projection = this._trackGraph.projectPointNearTrack(position, 5);
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
                    if ((jointA as TrackJointWithElevation).elevation !== (jointB as TrackJointWithElevation).elevation) return false;
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

        this._updatePlacementPreview();
        this._onHint('hintDualPickSpineBEnd');
        return true;
    }

    updateSpineBEnd(position: Point): boolean {
        if (!this._hasSpineBStart || this._spineB.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
        if (projection === null) {
            this._updatePlacementPreview();
            return false;
        }

        const startEntry = this._spineB[0];
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
            const built = this._buildSpinePath(startSeg, startT, side, projection.curve, projection.atT);
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
                this._spineAOffset,
                () => endCurve,
            );
        }

        // Show preview with confirmed spine A + tentative spine B.
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spineAPoints: Point[] = [];
        let spineBPoints: Point[];
        try {
            if (this._spineA.length > 0) {
                spineAPoints = sampleSpineEdge(this._spineA, this._spineAOffset, getCurve);
            }
            spineBPoints = sampleSpineEdge(tentativeSpine, this._spineAOffset, getCurve);
        } catch {
            spineBPoints = [];
        }

        this._platformRenderSystem.showDualSpinePlacementPreview(
            spineAPoints,
            spineBPoints,
            this._capA,
            this._capB,
            this._spineAStartAnchor,
            this._spineAEndAnchor,
            this._spineBStartAnchor,
            tentativeEndAnchor,
        );

        return true;
    }

    confirmSpineBEnd(position: Point): boolean {
        if (!this._hasSpineBStart || this._spineB.length === 0) return false;

        const projection = this._trackGraph.projectPointNearTrack(position, 5);
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
                    tStart: startT,
                    tEnd,
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
            this._spineBEndAnchor = computeAnchorPoint(endPointEntry, 'start', this._spineAOffset, () => endCurve);
        }

        this._hasSpineBEnd = true;

        // Auto-detect cap pairing: pick the pairing with the shortest total
        // cap distance (connects nearby endpoints rather than crossing).
        this._autoDetectCapPairing();

        this._updatePlacementPreview();
        this._onHint('hintDualDrawCap1');
        return true;
    }

    updateCapPairingHover(position: Point): void {
        if (
            this._spineAStartAnchor === null ||
            this._spineAEndAnchor === null ||
            this._spineBStartAnchor === null ||
            this._spineBEndAnchor === null
        ) return;

        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spineAPoints: Point[] = [];
        let spineBPoints: Point[] = [];
        try {
            spineAPoints = sampleSpineEdge(this._spineA, this._spineAOffset, getCurve);
            spineBPoints = sampleSpineEdge(this._spineB, this._spineAOffset, getCurve);
        } catch { /* ignore */ }

        // Determine which B anchor is closer to cursor → highlight that pairing.
        const distToEnd = PointCal.distanceBetweenPoints(position, this._spineBEndAnchor);
        const distToStart = PointCal.distanceBetweenPoints(position, this._spineBStartAnchor);
        const cursorNearBEnd = distToEnd <= distToStart;

        this._platformRenderSystem.showCapPairingPreview(
            spineAPoints,
            spineBPoints,
            this._spineAStartAnchor,
            this._spineAEndAnchor,
            this._spineBStartAnchor,
            this._spineBEndAnchor,
            cursorNearBEnd,
        );
    }

    pickCapPairing(position: Point): boolean {
        if (this._spineBStartAnchor === null || this._spineBEndAnchor === null) return false;

        const distToEnd = PointCal.distanceBetweenPoints(position, this._spineBEndAnchor);
        const distToStart = PointCal.distanceBetweenPoints(position, this._spineBStartAnchor);

        if (distToStart < distToEnd) {
            // User wants A_end ↔ B_start — reverse spine B so B_start becomes B_end.
            this._reverseSpineB();
        }
        // else: A_end ↔ B_end — default, no change needed.

        this._hasCapPairing = true;
        this._updatePlacementPreview();
        return true;
    }

    updateCapHover(position: Point, cap: 'A' | 'B'): void {
        // Determine the starting anchor, closing anchor, and vertices for this cap.
        const startAnchor = cap === 'A' ? this._spineAEndAnchor : this._spineBStartAnchor;
        const closingAnchor = cap === 'A' ? this._spineBEndAnchor : this._spineAStartAnchor;
        const vertices = cap === 'A' ? this._capA : this._capB;

        const lastPoint = vertices.length > 0
            ? vertices[vertices.length - 1]
            : startAnchor;

        const isNearClosing = closingAnchor !== null &&
            PointCal.distanceBetweenPoints(position, closingAnchor) <= CLOSING_SNAP_RADIUS;

        this._updatePlacementPreview();
        this._platformRenderSystem.showCapDrawingHover(
            lastPoint,
            isNearClosing && closingAnchor !== null ? closingAnchor : position,
            closingAnchor,
            isNearClosing,
        );
    }

    addCapAVertex(position: Point): boolean {
        this._capA.push(position);
        this._updatePlacementPreview();
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
        this._updatePlacementPreview();
        this._onHint('hintDualDrawCap2');
    }

    addCapBVertex(position: Point): boolean {
        this._capB.push(position);
        this._updatePlacementPreview();
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

        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

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
            stopPositions: [
                ...computeStopPositions(this._spineA, getCurve),
                ...computeStopPositions(this._spineB, getCurve),
            ],
        });

        station.trackAlignedPlatforms.push(platformId);

        // When the first platform is added, reposition the station to the
        // spine midpoint so the station label sits on the platform.
        if (station.trackAlignedPlatforms.length === 1 && station.platforms.length === 0) {
            const stops = computeStopPositions(this._spineA, getCurve);
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
        // and transitions from DRAW_OUTER → PICK_START (dual: CAP_B_DRAW → PICK_SPINE_A_START).
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

    private _updatePlacementPreview(): void {
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let spineAPoints: Point[] = [];
        let spineBPoints: Point[] = [];

        try {
            if (this._spineA.length > 0) {
                spineAPoints = sampleSpineEdge(this._spineA, this._spineAOffset, getCurve);
            }
            if (this._spineB.length > 0) {
                spineBPoints = sampleSpineEdge(this._spineB, this._spineAOffset, getCurve);
            }
        } catch {
            // Ignore sampling errors — just show what we can.
        }

        this._platformRenderSystem.showDualSpinePlacementPreview(
            spineAPoints,
            spineBPoints,
            this._capA,
            this._capB,
            this._spineAStartAnchor,
            this._spineAEndAnchor,
            this._spineBStartAnchor,
            this._spineBEndAnchor,
        );
    }

    /**
     * Automatically selects the cap pairing that produces the shortest total
     * cap distance (connects nearby endpoints). If spine B needs reversing to
     * achieve the A_end↔B_end / B_start↔A_start pairing, it is reversed.
     */
    private _autoDetectCapPairing(): void {
        if (
            this._spineAStartAnchor === null ||
            this._spineAEndAnchor === null ||
            this._spineBStartAnchor === null ||
            this._spineBEndAnchor === null
        ) return;

        // Pairing 1: A_end↔B_end, B_start↔A_start (default, no reversal).
        const dist1 =
            PointCal.distanceBetweenPoints(this._spineAEndAnchor, this._spineBEndAnchor) +
            PointCal.distanceBetweenPoints(this._spineBStartAnchor, this._spineAStartAnchor);

        // Pairing 2: A_end↔B_start, B_end↔A_start (requires reversal).
        const dist2 =
            PointCal.distanceBetweenPoints(this._spineAEndAnchor, this._spineBStartAnchor) +
            PointCal.distanceBetweenPoints(this._spineBEndAnchor, this._spineAStartAnchor);

        if (dist2 < dist1) {
            // Pairing 2 is shorter — reverse spine B so B_start becomes B_end.
            this._reverseSpineB();
        }

        this._hasCapPairing = true;
    }

    /**
     * Reverse spine B so its traversal direction matches spine A.
     * Swaps tStart/tEnd in each entry and reverses the array order.
     * Also swaps the start/end anchor points.
     */
    private _reverseSpineB(): void {
        this._spineB = this._spineB
            .map((e) => ({
                ...e,
                tStart: e.tEnd,
                tEnd: e.tStart,
            }))
            .reverse();

        const tmp = this._spineBStartAnchor;
        this._spineBStartAnchor = this._spineBEndAnchor;
        this._spineBEndAnchor = tmp;
    }

    private _resetState(): void {
        this._hasSpineAStart = false;
        this._hasSpineAEnd = false;
        this._hasSpineBStart = false;
        this._hasSpineBEnd = false;
        this._hasCapPairing = false;
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

                let entryT = 0;

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
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.hoverUpdate(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_START',
        },
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
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.hoverUpdate(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_START',
        },
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

/**
 * After both spines are confirmed, the user clicks to choose which spine B
 * endpoint should pair with spine A's end. This determines cap winding and
 * strip pairing direction. On hover, both possible pairings are shown; the
 * one closer to the cursor is highlighted.
 */
class DualSpinePickCapPairingState extends TemplateState<
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
                context.updateCapPairingHover(worldPos);
            },
            defaultTargetState: 'PICK_CAP_PAIRING',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.pickCapPairing(worldPos);
            },
            defaultTargetState: 'PICK_CAP_PAIRING',
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
        paired: (context) => context.hasCapPairing,
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
                guard: 'paired',
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
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.updateCapHover(worldPos, 'A');
            },
            defaultTargetState: 'DRAW_END_CAP_1',
        },
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
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({ x: event.x, y: event.y });
                context.updateCapHover(worldPos, 'B');
            },
            defaultTargetState: 'DRAW_END_CAP_2',
        },
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
            PICK_CAP_PAIRING: new DualSpinePickCapPairingState(),
            DRAW_END_CAP_1: new DualSpineDrawEndCap1State(),
            DRAW_END_CAP_2: new DualSpineDrawEndCap2State(),
        },
        'IDLE',
        context,
    );
}
