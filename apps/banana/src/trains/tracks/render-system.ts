import { Container, Graphics, MeshSimple, Text, Texture } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve } from '@ue-too/curve';
import { Point, PointCal } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { DeletionHighlightState } from '../input-state-machine/curve-engine';
import { CatenaryHighlightState, CatenaryLayoutEngine, CatenaryPreviewState } from '../input-state-machine/catenary-layout-engine';
import { DuplicateHighlightState, DuplicateToSideEngine } from '../input-state-machine/duplicate-to-side-engine';
import { ELEVATION, ELEVATION_MAX, ELEVATION_MIN, ELEVATION_VALUES, ProjectionPositiveResult, TrackSegmentDrawData, TrackSegmentWithCollision, TrackStyle } from './types';
import { LEVEL_HEIGHT } from './constants';
import type { TerrainData } from '@/terrain/terrain-data';
import { clearShadowCache } from '@/utils';
import { WorldRenderSystem, findElevationInterval } from '@/world-render-system';
import { CameraState, CameraZoomEventPayload, ObservableBoardCamera } from '@ue-too/board';
import { ballastHalfWidth } from './geometry-utils';
import { computeTunnelEntranceGeometry } from './tunnel-geometry';

/** Zoom level above which detailed track draw data is shown; below this only the bezier curve is drawn. */
const ZOOM_THRESHOLD_DETAILED_TRACK = 5;

/** World-space length (meters when 1px = 1m) per one repeat of the rail texture along the curve. ~0.6m matches typical tie spacing. */
const TRACK_TEXTURE_TILE_LEN = 0.6;

/** World-space length per one repeat of the ballast texture. */
const BALLAST_TEXTURE_TILE_LEN = 2;

/** Resolution of the procedural track segment texture (power-of-two for repeat wrap). */
const TRACK_TEX_SIZE = 64;

/** Dimensions of the shared 1D elevation gradient texture. */
const ELEVATION_GRADIENT_WIDTH = 4;
const ELEVATION_GRADIENT_HEIGHT = 128;

/** Raw elevation range in world units (ELEVATION * LEVEL_HEIGHT). */
const ELEVATION_RAW_MIN = ELEVATION_MIN * LEVEL_HEIGHT;
const ELEVATION_RAW_MAX = ELEVATION_MAX * LEVEL_HEIGHT;

/** Map a raw elevation value to a normalised [0, 1] coordinate into the gradient texture. */
const normalizeElevation = (rawElevation: number): number =>
    (rawElevation - ELEVATION_RAW_MIN) / (ELEVATION_RAW_MAX - ELEVATION_RAW_MIN);

/** Size of the tiny solid-black texture used for shadow meshes. */
const SHADOW_TEX_SIZE = 4;

/** Size of the tiny solid-color textures used for tunnel meshes. */
const TUNNEL_TEX_SIZE = 4;

/** Compute the rail mesh half-width (always derived from gauge — not affected by ballast width). */
const railHalfWidth = (drawData: TrackSegmentDrawData): number => {
    const style = drawData.trackStyle ?? 'ballasted';
    const tieOverhang = style === 'slab' ? 0 : 4;
    const texFullWidth = TRACK_TEX_SIZE + tieOverhang * 2;
    return (drawData.gauge / 2) * (texFullWidth / TRACK_TEX_SIZE);
};


/** Renderer (or app) that provides texture generation for the texture-style track and train cars. */
export type TrackTextureRenderer = {
    renderer: { textureGenerator: { generateTexture: (options: { target: Container }) => Texture } };
};

export class TrackRenderSystem {

    private _worldRenderSystem: WorldRenderSystem;
    private _simplifiedTrack: Container;
    private _topLevelContainer: Container;
    private _trackCurveManager: TrackCurveManager;
    private _simplifiedTrackGraphicsMap: Map<number, { graphics: Graphics; bandKey: string }> = new Map();
    /** Rail mesh containers in the offset layer (between ballast and bogies), keyed by draw data key. */
    private _offsetRailMap: Map<string, Container> = new Map();

    /** Keys of drawables registered with the WorldRenderSystem by this renderer. */
    private _drawableKeys: Set<string> = new Set();

    /** Maps each draw data key to its elevation band index (rebuilt on every reindex). */
    private _drawDataBandMap: Map<string, number> = new Map();

    /** Keys of preview drawables (ephemeral, re-created on each preview change). */
    private _previewKeys: string[] = [];

    /** Rail containers added to the offset layer for preview curves (cleaned up on each preview change). */
    private _previewRailContainers: Container[] = [];

    /** Cutting-wall keys for preview curves (cleaned up on each preview change). */
    private _previewCuttingKeys: string[] = [];

    /** Tunnel cover-cap keys for preview curves (cleaned up on each preview change). */
    private _previewCoverKeys: string[] = [];

    /** Bed keys for preview curves (cleaned up on each preview change). */
    private _previewBedKeys: string[] = [];

    private _previewStartProjection: Graphics = new Graphics();
    private _previewEndProjection: Graphics = new Graphics();

    /** World-space overlay stroke drawn on the track under the cursor / selected source in duplicate mode. */
    private _duplicateHighlightGraphics: Graphics = new Graphics();

    /** World-space overlay stroke drawn on the track under the cursor in delete mode. */
    private _deletionHighlightGraphics: Graphics = new Graphics();

    /** World-space overlay stroke drawn on the track under the cursor / selected source in catenary mode. */
    private _catenaryHighlightGraphics: Graphics = new Graphics();

    /** World-space preview graphics for catenary poles while the user is choosing a side. */
    private _catenaryPreviewGraphics: Graphics = new Graphics();

    private _showPreviewCurveArcs: boolean = false;
    private _latestPreviewDrawDataList:
        | { index: number; drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[]
        | undefined = undefined;

    private _sunAngle: number = 135;
    private _baseShadowLength: number = 10;

    private _camera: ObservableBoardCamera;

    /** Optional renderer for generating track texture (required for texture render style). */
    private _textureRenderer: TrackTextureRenderer | null = null;

    /** Whether to show elevation gradient on ballast (vs solid color). */
    private _showElevationGradient: boolean = false;

    /** Current track visual style. */
    private _trackStyle: TrackStyle = 'ballasted';

    /** Whether newly laid tracks are electrified (catenary poles). */
    private _electrified: boolean = false;

    /** Total width of the gravel bed foundation in world units. Stamped per track when laid. */
    private _bedWidth: number = 3;

    /** Whether newly laid tracks will have a bed (gravel foundation below ballast). */
    private _bed: boolean = false;

    /** Catenary pole containers keyed by draw data key. */
    private _catenaryMap: Map<string, Container> = new Map();

    /** Cutting wall meshes keyed by draw data key (for tracks that go below terrain). */
    private _cuttingMap: Map<string, Container> = new Map();

    /** Tunnel cover-cap meshes keyed by draw data key (rendered above rails). */
    private _cuttingCoverMap: Map<string, Container> = new Map();

    /** Dashed underground-track indicators keyed by curve number. */
    private _undergroundIndicatorMap: Map<number, { graphics: Graphics; bandKey: string }> = new Map();

    /** Tunnel enclosure meshes (walls + ceiling) for fully underground segments, keyed by draw data key. */
    private _tunnelWallMap: Map<string, MeshSimple> = new Map();
    private _tunnelCeilingMap: Map<string, MeshSimple> = new Map();

    /** Tunnel enclosure keys for preview curves (cleaned up on each preview change). */
    private _previewTunnelWallKeys: string[] = [];
    private _previewTunnelCeilingKeys: string[] = [];

    /** Shared solid ballast texture (used when elevation gradient is off); created lazily. */
    private _solidBallastTexture: Texture | null = null;

    /** Shared rail + ties texture; created lazily. */
    private _railTexture: Texture | null = null;

    /** Shared slab track texture (concrete bed); created lazily. */
    private _slabBallastTexture: Texture | null = null;

    /** Shared slab-style rail texture (short concrete ties); created lazily. */
    private _slabRailTexture: Texture | null = null;

    /** Shared 1D elevation gradient texture; created lazily. */
    private _elevationGradientTexture: Texture | null = null;

    /** Tiny solid-black texture for shadow meshes; created lazily. */
    private _shadowTexture: Texture | null = null;

    /** Shared solid-color textures for tunnel meshes; created lazily. */
    private _tunnelWallTexture: Texture | null = null;
    private _tunnelCeilingTexture: Texture | null = null;
    private _cuttingWallTexture: Texture | null = null;
    private _cuttingCoverTexture: Texture | null = null;

    /** Shared bed (gravel foundation) texture; created lazily. */
    private _bedTexture: Texture | null = null;

    /** Bed mesh containers keyed by draw data key. */
    private _bedMeshMap: Map<string, MeshSimple> = new Map();

    /**
     * Per-key shadow state retained for efficient sun-angle updates.
     *
     * - `constantElevation` shadows (from === to, elevation > 0) only need a
     *   position update because the polygon shape is angle-independent.
     * - Varying-elevation shadows must be cleared and redrawn.
     */
    private _shadowRecords: Map<string, ShadowRecord> = new Map();

    /** For each drawable key, the ballast node contains elevationMesh and solidBallastMesh (toggle visibility). */
    private _ballastStyleNodes: Map<string, { elevationMesh: Container; solidBallastMesh: Container }> = new Map();

    private _abortController: AbortController = new AbortController();

    /** Terrain heightmap used to determine if tracks are underground. */
    private _terrainData: TerrainData | null = null;

    constructor(
        worldRenderSystem: WorldRenderSystem,
        trackCurveManager: TrackCurveManager,
        curveCreationEngine: CurveCreationEngine,
        camera: ObservableBoardCamera,
        textureRenderer?: TrackTextureRenderer | null,
        terrainData?: TerrainData | null,
        duplicateToSideEngine?: DuplicateToSideEngine,
        catenaryLayoutEngine?: CatenaryLayoutEngine,
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._terrainData = terrainData ?? null;
        this._topLevelContainer = new Container();
        this._simplifiedTrack = new Container();

        worldRenderSystem.addOverlayContainer(this._topLevelContainer);
        worldRenderSystem.addOverlayContainer(this._simplifiedTrack);

        this._trackCurveManager = trackCurveManager;

        this._trackCurveManager.onDelete(this._onDelete.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onAdd(this._onNewTrackData.bind(this), { signal: this._abortController.signal });
        curveCreationEngine.onPreviewDrawDataChange(this._onPreviewDrawDataChange.bind(this), { signal: this._abortController.signal });
        curveCreationEngine.onDeletionHighlightChange(this._onDeletionHighlightChange.bind(this), { signal: this._abortController.signal });
        if (duplicateToSideEngine) {
            duplicateToSideEngine.onPreviewDrawDataChange(this._onPreviewDrawDataChange.bind(this), { signal: this._abortController.signal });
            duplicateToSideEngine.onHighlightChange(this._onDuplicateHighlightChange.bind(this), { signal: this._abortController.signal });
        }
        if (catenaryLayoutEngine) {
            catenaryLayoutEngine.onHighlightChange(this._onCatenaryHighlightChange.bind(this), { signal: this._abortController.signal });
            catenaryLayoutEngine.onPreviewChange(this._onCatenaryPreviewChange.bind(this), { signal: this._abortController.signal });
            catenaryLayoutEngine.onCommit((payload) => {
                this.applyCatenary(payload.segmentNumber, payload.side);
            }, { signal: this._abortController.signal });
        }

        this._topLevelContainer.addChild(this._duplicateHighlightGraphics);
        this._topLevelContainer.addChild(this._deletionHighlightGraphics);
        this._topLevelContainer.addChild(this._catenaryHighlightGraphics);
        this._topLevelContainer.addChild(this._catenaryPreviewGraphics);

        this._previewStartProjection.visible = false;
        this._previewEndProjection.visible = false;

        this._previewStartProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewStartProjection.pivot.set(this._previewStartProjection.width / 2, this._previewStartProjection.height / 2);
        this._previewStartProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewStartProjection);

        curveCreationEngine.onPreviewStartProjectionChange(this._onPreviewStartChange.bind(this), { signal: this._abortController.signal });

        this._previewEndProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewEndProjection.pivot.set(this._previewEndProjection.width / 2, this._previewEndProjection.height / 2);
        this._previewEndProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewEndProjection);

        curveCreationEngine.onPreviewEndProjectionChange(this._onPreviewEndChange.bind(this), { signal: this._abortController.signal });

        this._trackCurveManager.onAddTrackSegment(this._onAddTrackSegment.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onRemoveTrackSegment(this._onRemoveTrackSegment.bind(this), { signal: this._abortController.signal });

        this._camera = camera;
        this._textureRenderer = textureRenderer ?? null;

        this._camera.on('zoom', this._onZoom.bind(this), { signal: this._abortController.signal });

        this._applyZoomLod(this._camera.zoomLevel);
    }

    /** Whether the elevation gradient is shown on ballast (vs solid color). */
    get showElevationGradient(): boolean {
        return this._showElevationGradient;
    }

    set showElevationGradient(value: boolean) {
        if (this._showElevationGradient === value) return;
        this._showElevationGradient = value;
        this._applyElevationGradientVisibility();
    }

    /** Apply elevation gradient toggle to all ballast nodes. Rails and ties stay visible. */
    private _applyElevationGradientVisibility(): void {
        for (const [, { elevationMesh, solidBallastMesh }] of this._ballastStyleNodes) {
            elevationMesh.visible = this._showElevationGradient;
            solidBallastMesh.visible = !this._showElevationGradient;
        }
    }

    /** Current track visual style. */
    get trackStyle(): TrackStyle {
        return this._trackStyle;
    }

    set trackStyle(style: TrackStyle) {
        this._trackStyle = style;
    }

    /** Whether newly laid tracks will have catenary poles. */
    get electrified(): boolean {
        return this._electrified;
    }

    set electrified(value: boolean) {
        this._electrified = value;
    }

    /**
     * Apply catenary electrification to an existing track segment on a given side.
     * Updates all draw data entries belonging to that segment, then rebuilds catenary graphics.
     */
    applyCatenary(segmentNumber: number, side: 1 | -1): void {
        // Stamp the canonical segment so serialization picks it up.
        const segment = this._trackCurveManager.getTrackSegmentWithJoints(segmentNumber);
        if (segment) {
            segment.electrified = true;
            segment.catenarySide = side;
        }

        const drawDataList = this._trackCurveManager.persistedDrawData;
        for (const drawData of drawDataList) {
            if (drawData.originalTrackSegment.trackSegmentNumber === segmentNumber) {
                drawData.electrified = true;
                drawData.catenarySide = side;

                const key = JSON.stringify({
                    trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber,
                    tValInterval: drawData.originalTrackSegment.tValInterval,
                });

                // Remove existing catenary graphics if present.
                const existing = this._catenaryMap.get(key);
                if (existing !== undefined) {
                    const removed = this._worldRenderSystem.removeFromBand(`__catenary__${key}`);
                    removed?.destroy({ children: true });
                    this._catenaryMap.delete(key);
                }

                // Rebuild catenary graphics on the new side.
                const catenaryContainer = this._buildCatenaryForDrawData(drawData);
                const bandIndex = this._drawDataBandMap.get(key);
                if (bandIndex !== undefined) {
                    this._worldRenderSystem.addToBand(`__catenary__${key}`, catenaryContainer, bandIndex, 'catenary');
                    this._catenaryMap.set(key, catenaryContainer);
                }
            }
        }
    }

    /**
     * Remove catenary electrification from an existing track segment.
     * Clears electrified/catenarySide from all draw data entries belonging to that segment.
     */
    removeCatenary(segmentNumber: number): void {
        const segment = this._trackCurveManager.getTrackSegmentWithJoints(segmentNumber);
        if (segment) {
            segment.electrified = false;
            segment.catenarySide = undefined;
        }

        const drawDataList = this._trackCurveManager.persistedDrawData;
        for (const drawData of drawDataList) {
            if (drawData.originalTrackSegment.trackSegmentNumber === segmentNumber) {
                drawData.electrified = false;
                drawData.catenarySide = undefined;

                const key = JSON.stringify({
                    trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber,
                    tValInterval: drawData.originalTrackSegment.tValInterval,
                });

                const existing = this._catenaryMap.get(key);
                if (existing !== undefined) {
                    const removed = this._worldRenderSystem.removeFromBand(`__catenary__${key}`);
                    removed?.destroy({ children: true });
                    this._catenaryMap.delete(key);
                }
            }
        }
    }

    /** Total width of the gravel bed foundation for newly laid tracks (meters). */
    get bedWidth(): number {
        return this._bedWidth;
    }

    set bedWidth(value: number) {
        this._bedWidth = Math.max(1, value);
    }

    /** Whether newly laid tracks will have a bed (gravel foundation below ballast). */
    get bed(): boolean {
        return this._bed;
    }

    set bed(value: boolean) {
        this._bed = value;
    }

    get sunAngle(): number {
        return this._sunAngle;
    }

    set sunAngle(angle: number) {
        if (this._sunAngle === angle) return;
        this._sunAngle = angle;
        clearShadowCache();
        this._rebuildAllShadows();
    }

    get showPreviewCurveArcs(): boolean {
        return this._showPreviewCurveArcs;
    }

    set showPreviewCurveArcs(show: boolean) {
        if (this._showPreviewCurveArcs === show) return;
        this._showPreviewCurveArcs = show;
        // Redraw current preview immediately (without requiring pointer movement).
        this._onPreviewDrawDataChange(this._latestPreviewDrawDataList);
    }

    private _onZoom(_event: CameraZoomEventPayload, cameraState: CameraState) {
        this._applyZoomLod(cameraState.zoomLevel);
        // Redraw preview so radius labels pick up new zoom-based font size.
        if (this._showPreviewCurveArcs) {
            this._onPreviewDrawDataChange(this._latestPreviewDrawDataList);
        }
    }

    /**
     * Toggle track representation by zoom: low zoom shows only the bezier curve;
     * high zoom shows detailed draw data (elevation segments, shadows) and hides the simplified curve.
     */
    private _applyZoomLod(zoomLevel: number): void {
        const useDetailed = zoomLevel >= ZOOM_THRESHOLD_DETAILED_TRACK;

        for (const [, entry] of this._simplifiedTrackGraphicsMap) {
            entry.graphics.visible = !useDetailed;
        }

        // Dashed underground indicators: only when zoomed out (simplified view)
        for (const [, entry] of this._undergroundIndicatorMap) {
            entry.graphics.visible = !useDetailed;
        }

        for (const key of this._drawableKeys) {
            const container = this._worldRenderSystem.getDrawable(key);
            if (container !== undefined) {
                container.visible = useDetailed;
            }
        }

        for (const [, railContainer] of this._offsetRailMap) {
            railContainer.visible = useDetailed;
        }

        for (const [, catenaryContainer] of this._catenaryMap) {
            catenaryContainer.visible = useDetailed;
        }

        for (const [, record] of this._shadowRecords) {
            record.mesh.visible = useDetailed;
        }

        for (const [, bedMesh] of this._bedMeshMap) {
            bedMesh.visible = useDetailed;
        }

        // Tunnel meshes (cutting walls/covers, tunnel walls/ceiling): only when zoomed in
        for (const [, g] of this._cuttingMap) {
            g.visible = useDetailed;
        }

        for (const [, g] of this._cuttingCoverMap) {
            g.visible = useDetailed;
        }

        for (const [, g] of this._tunnelWallMap) {
            g.visible = useDetailed;
        }

        for (const [, g] of this._tunnelCeilingMap) {
            g.visible = useDetailed;
        }
    }

    /**
     * Update every shadow for the current sun angle.
     *
     * Constant-elevation shadows only need a position update (cheap).
     * Varying-elevation shadows are cleared and redrawn in-place (no
     * destroy/create overhead).
     */
    private _rebuildAllShadows(): void {
        const sunAngleRad = (this._sunAngle * Math.PI) / 180;
        const cosA = Math.cos(sunAngleRad);
        const sinA = Math.sin(sunAngleRad);

        for (const [, record] of this._shadowRecords) {
            if (record.constantElevation) {
                record.mesh.position.set(
                    cosA * record.shadowLength,
                    sinA * record.shadowLength,
                );
            } else if (record.baseVerts && record.elevationFactors) {
                const verts = record.mesh.vertices as Float32Array;
                const base = record.baseVerts;
                const factors = record.elevationFactors;
                for (let i = 0; i < factors.length; i++) {
                    const offsetX = cosA * factors[i];
                    const offsetY = sinA * factors[i];
                    const bi = i * 4;
                    verts[bi] = base[bi] + offsetX;
                    verts[bi + 1] = base[bi + 1] + offsetY;
                    verts[bi + 2] = base[bi + 2] + offsetX;
                    verts[bi + 3] = base[bi + 3] + offsetY;
                }
                record.mesh.vertices = verts;
            }
        }
    }

    private _onPreviewStartChange(projection: ProjectionPositiveResult | null) {
        if (projection === null) {
            this._previewStartProjection.visible = false;
            return;
        }

        const type = projection.hitType;
        const position = projection.projectionPoint;

        if (!this._previewStartProjection.visible) {
            this._previewStartProjection.visible = true;
        }

        this._previewStartProjection.position.set(position.x, position.y);
        const color = getProjectionTypeColor(type);
        this._previewStartProjection.tint = color;
    }

    private _onPreviewEndChange(projection: ProjectionPositiveResult | null) {
        if (projection === null) {
            this._previewEndProjection.visible = false;
            return;
        }

        const type = projection.hitType;
        const position = projection.projectionPoint;

        if (!this._previewEndProjection.visible) {
            this._previewEndProjection.visible = true;
        }

        this._previewEndProjection.position.set(position.x, position.y);
        const color = getProjectionTypeColor(type);
        this._previewEndProjection.tint = color;
    }

    cleanup() {
        this._abortController.abort();

        this._previewKeys.forEach(key => {
            const container = this._worldRenderSystem.removeFromBand(key);
            container?.destroy({ children: true });
        });
        this._previewKeys = [];
        this._previewRailContainers.forEach((c, idx) => {
            const removed = this._worldRenderSystem.removeFromBand(`__preview_rail__${idx}`);
            removed?.destroy({ children: true });
        });
        this._previewRailContainers = [];
        this._previewCuttingKeys.forEach(ck => {
            const removed = this._worldRenderSystem.removeFromBand(ck);
            removed?.destroy({ children: true });
        });
        this._previewCuttingKeys = [];
        this._previewCoverKeys.forEach(ck => {
            const removed = this._worldRenderSystem.removeFromBand(ck);
            removed?.destroy({ children: true });
        });
        this._previewCoverKeys = [];
        this._previewTunnelWallKeys.forEach(tk => {
            const removed = this._worldRenderSystem.removeFromBand(tk);
            removed?.destroy({ children: true });
        });
        this._previewTunnelWallKeys = [];
        this._previewTunnelCeilingKeys.forEach(tk => {
            const removed = this._worldRenderSystem.removeFromBand(tk);
            removed?.destroy({ children: true });
        });
        this._previewTunnelCeilingKeys = [];
        this._previewBedKeys.forEach(bk => {
            this._worldRenderSystem.removeBed(bk);
        });
        this._previewBedKeys = [];

        this._drawableKeys.forEach(key => {
            const container = this._worldRenderSystem.removeFromBand(key);
            container?.destroy({ children: true });
            this._worldRenderSystem.removeShadow(key);
            this._worldRenderSystem.removeBed(key);
            // Remove associated rail
            const railRemoved = this._worldRenderSystem.removeFromBand(`__rail__${key}`);
            railRemoved?.destroy({ children: true });
        });
        this._drawableKeys.clear();
        this._shadowRecords.clear();
        this._bedMeshMap.clear();
        this._offsetRailMap.clear();

        this._previewStartProjection.destroy();
        this._previewEndProjection.destroy();

        this._catenaryMap.forEach((catenaryContainer, key) => {
            const removed = this._worldRenderSystem.removeFromBand(`__catenary__${key}`);
            removed?.destroy({ children: true });
        });
        this._catenaryMap.clear();

        this._cuttingMap.forEach((cuttingGraphics, key) => {
            const removed = this._worldRenderSystem.removeFromBand(`__cutting__${key}`);
            removed?.destroy({ children: true });
        });
        this._cuttingMap.clear();

        this._cuttingCoverMap.forEach((coverGraphics, key) => {
            const removed = this._worldRenderSystem.removeFromBand(`__cutting_cover__${key}`);
            removed?.destroy({ children: true });
        });
        this._cuttingCoverMap.clear();

        this._tunnelWallMap.forEach((_g, key) => {
            const removed = this._worldRenderSystem.removeFromBand(`__tunnel_wall__${key}`);
            removed?.destroy({ children: true });
        });
        this._tunnelWallMap.clear();

        this._tunnelCeilingMap.forEach((_g, key) => {
            const removed = this._worldRenderSystem.removeFromBand(`__tunnel_ceiling__${key}`);
            removed?.destroy({ children: true });
        });
        this._tunnelCeilingMap.clear();

        this._simplifiedTrackGraphicsMap.forEach((entry) => {
            const removed = this._worldRenderSystem.removeFromBand(entry.bandKey);
            removed?.destroy({ children: true });
        });
        this._simplifiedTrackGraphicsMap.clear();

        this._undergroundIndicatorMap.forEach((entry) => {
            const removed = this._worldRenderSystem.removeFromBand(entry.bandKey);
            removed?.destroy({ children: true });
        });
        this._undergroundIndicatorMap.clear();

        this._worldRenderSystem.removeOverlayContainer(this._topLevelContainer);
        this._topLevelContainer.destroy({ children: true });

        this._worldRenderSystem.removeOverlayContainer(this._simplifiedTrack);
        this._simplifiedTrack.destroy({ children: true });

        this._ballastStyleNodes.clear();
        if (this._solidBallastTexture !== null) {
            this._solidBallastTexture.destroy(true);
            this._solidBallastTexture = null;
        }
        if (this._railTexture !== null) {
            this._railTexture.destroy(true);
            this._railTexture = null;
        }
        if (this._slabBallastTexture !== null) {
            this._slabBallastTexture.destroy(true);
            this._slabBallastTexture = null;
        }
        if (this._slabRailTexture !== null) {
            this._slabRailTexture.destroy(true);
            this._slabRailTexture = null;
        }
        if (this._elevationGradientTexture !== null) {
            this._elevationGradientTexture.destroy(true);
            this._elevationGradientTexture = null;
        }
        if (this._shadowTexture !== null) {
            this._shadowTexture.destroy(true);
            this._shadowTexture = null;
        }
        if (this._bedTexture !== null) {
            this._bedTexture.destroy(true);
            this._bedTexture = null;
        }
    }

    /**
     * Build catenary pole + wire overhang graphics for an electrified track segment.
     *
     * Poles are placed at regular intervals along the curve. Each pole is a
     * vertical mast with an outrigger arm and a contact wire line.
     */
    private _buildCatenaryForDrawData(drawData: TrackSegmentDrawData): Graphics {
        const g = new Graphics();
        const curve = drawData.curve;
        const curveLength = curve.fullLength;

        // Pole spacing in world units (meters).
        const poleSpacing = 25;
        const poleCount = Math.max(1, Math.floor(curveLength / poleSpacing));

        // Mast offset from track center — place at the edge of the bed (or ballast when no bed).
        const ballastHw = ballastHalfWidth(drawData);
        const mastOffset = drawData.bed
            ? Math.max(ballastHw, (drawData.bedWidth ?? 3) / 2)
            : ballastHw;

        // Use stored side (all poles on one side) or default to +1.
        const side = drawData.catenarySide ?? 1;

        for (let i = 0; i <= poleCount; i++) {
            const t = poleCount === 0 ? 0.5 : i / poleCount;
            const point = curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            // Normal perpendicular to track.
            const nx = -tangent.y;
            const ny = tangent.x;

            const mastX = point.x + nx * mastOffset * side;
            const mastY = point.y + ny * mastOffset * side;

            // Mast — vertical pole (drawn as a thick line in 2D top-down view).
            g.circle(mastX, mastY, 0.12);
            g.fill(0x707070);

            // Outrigger arm from mast to above track center.
            g.moveTo(mastX, mastY);
            g.lineTo(point.x, point.y);
            g.stroke({ color: 0x888888, width: 0.06 });

            // Contact wire dot at track center.
            g.circle(point.x, point.y, 0.04);
            g.fill(0x404040);
        }

        // Draw the catenary wire along the full curve.
        const wireSteps = Math.max(10, Math.ceil(curveLength / 1));
        const controlPoints = curve.getControlPoints();
        g.moveTo(controlPoints[0].x, controlPoints[0].y);
        for (let i = 1; i <= wireSteps; i++) {
            const t = i / wireSteps;
            const p = i === wireSteps ? controlPoints[controlPoints.length - 1] : curve.getPointbyPercentage(t);
            g.lineTo(p.x, p.y);
        }
        g.stroke({ color: 0x505050, width: 0.04 });

        return g;
    }

    /**
     * Shared geometry computation for tunnel entrance walls and cover.
     * Delegates to the pure helper in `tunnel-geometry.ts`.
     */
    private _computeTunnelEntranceGeometry(drawData: TrackSegmentDrawData) {
        return computeTunnelEntranceGeometry(
            drawData,
            this._terrainData ?? null,
            (rawElevation) => this._worldRenderSystem.getElevationBandIndex(rawElevation),
        );
    }

    /**
     * Build the retaining-wall meshes (two thin parallel strips) for a
     * ramped track that goes below terrain.
     *
     * Placed in the GROUND band's drawable sublayer.
     */
    private _buildCuttingForDrawData(drawData: TrackSegmentDrawData): { mesh: Container; surfaceBandIndex: number } | null {
        const geo = this._computeTunnelEntranceGeometry(drawData);
        if (geo === null) return null;
        const texture = this._getOrCreateCuttingWallTexture();
        if (texture === null) return null;

        const { leftInner, leftOuter, rightInner, rightOuter, surfaceBandIndex } = geo;
        const container = new Container();

        const leftWall = TrackRenderSystem._buildStripMesh(leftInner, leftOuter, texture, 0.9);
        if (leftWall) container.addChild(leftWall);
        const rightWall = TrackRenderSystem._buildStripMesh(rightInner, rightOuter, texture, 0.9);
        if (rightWall) container.addChild(rightWall);

        return { mesh: container, surfaceBandIndex };
    }

    /**
     * Build the tunnel cover-cap mesh for a ramped track that goes below
     * terrain. The cover spans the full width between the outer wall edges at
     * the underground end of the ramp.
     *
     * Placed in the GROUND band's onTrack sublayer so it renders above rails.
     */
    private _buildCuttingCoverForDrawData(drawData: TrackSegmentDrawData): { mesh: Container; surfaceBandIndex: number } | null {
        const geo = this._computeTunnelEntranceGeometry(drawData);
        if (geo === null) return null;
        const texture = this._getOrCreateCuttingCoverTexture();
        if (texture === null) return null;

        const { leftOuter, rightOuter, coverEnd, coverSteps, surfaceBandIndex } = geo;
        const container = new Container();
        const lastIdx = leftOuter.length - 1;

        const buildCover = (fromIdx: number, toIdx: number) => {
            const lo = Math.min(fromIdx, toIdx);
            const hi = Math.max(fromIdx, toIdx);
            const left = leftOuter.slice(lo, hi + 1);
            const right = rightOuter.slice(lo, hi + 1);
            const mesh = TrackRenderSystem._buildStripMesh(left, right, texture, 0.95);
            if (mesh) container.addChild(mesh);
        };

        if (coverEnd === 'start') {
            buildCover(0, Math.min(coverSteps, lastIdx));
        } else {
            buildCover(Math.max(0, lastIdx - coverSteps), lastIdx);
        }

        return { mesh: container, surfaceBandIndex };
    }

    /**
     * Determine whether a draw-data segment is fully underground (both ends
     * below terrain). Returns the band index to place tunnel visuals, or null.
     */
    private _isFullyUnderground(drawData: TrackSegmentDrawData): { bandIndex: number } | null {
        const { curve, elevation } = drawData;
        const startPoint = curve.getPointbyPercentage(0);
        const endPoint = curve.getPointbyPercentage(1);
        const startTerrainH = this._terrainData?.getHeight(startPoint.x, startPoint.y) ?? 0;
        const endTerrainH = this._terrainData?.getHeight(endPoint.x, endPoint.y) ?? 0;

        if (elevation.from >= startTerrainH || elevation.to >= endTerrainH) return null;

        const rawElevation = Math.max(elevation.from, elevation.to);
        return { bandIndex: this._worldRenderSystem.getElevationBandIndex(rawElevation) };
    }

    /**
     * Build tunnel wall meshes (two parallel concrete strips) for a fully
     * underground track segment. Placed in the track's own elevation band.
     */
    private _buildTunnelWallsForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const ugInfo = this._isFullyUnderground(drawData);
        if (ugInfo === null) return null;
        const texture = this._getOrCreateTunnelWallTexture();
        if (texture === null) return null;

        const { curve } = drawData;
        const ballastHw = ballastHalfWidth(drawData);
        const hw = drawData.bed ? Math.max(ballastHw, (drawData.bedWidth ?? 3) / 2) : ballastHw;
        const wallThickness = 0.4;
        const innerOffset = hw + 0.1;
        const outerOffset = innerOffset + wallThickness;

        const steps = Math.max(4, Math.ceil(curve.fullLength / 2));

        const leftInner: { x: number; y: number }[] = [];
        const leftOuter: { x: number; y: number }[] = [];
        const rightInner: { x: number; y: number }[] = [];
        const rightOuter: { x: number; y: number }[] = [];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = curve.getPointbyPercentage(t);
            const tangent = PointCal.unitVector(curve.derivativeByPercentage(t));
            const nx = -tangent.y;
            const ny = tangent.x;

            leftInner.push({ x: point.x - nx * innerOffset, y: point.y - ny * innerOffset });
            leftOuter.push({ x: point.x - nx * outerOffset, y: point.y - ny * outerOffset });
            rightInner.push({ x: point.x + nx * innerOffset, y: point.y + ny * innerOffset });
            rightOuter.push({ x: point.x + nx * outerOffset, y: point.y + ny * outerOffset });
        }

        // Combine both walls into a single mesh by concatenating vertex data.
        const leftWall = TrackRenderSystem._buildStripMesh(leftInner, leftOuter, texture, 0.7);
        if (leftWall === null) return null;
        // For the right wall, build a second mesh parented to the left one.
        const rightWall = TrackRenderSystem._buildStripMesh(rightInner, rightOuter, texture, 0.7);
        if (rightWall) leftWall.addChild(rightWall);

        return leftWall;
    }

    /**
     * Build a tunnel ceiling (cover slab) for a fully underground track.
     * Spans the full length of the segment between outer wall edges.
     * Placed in the catenary sublayer so it renders above the track.
     */
    private _buildTunnelCeilingForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const ugInfo = this._isFullyUnderground(drawData);
        if (ugInfo === null) return null;
        const texture = this._getOrCreateTunnelCeilingTexture();
        if (texture === null) return null;

        const { curve } = drawData;
        const ballastHw = ballastHalfWidth(drawData);
        const hw = drawData.bed ? Math.max(ballastHw, (drawData.bedWidth ?? 3) / 2) : ballastHw;
        const outerOffset = hw + 0.1 + 0.4;

        const steps = Math.max(4, Math.ceil(curve.fullLength / 2));

        const leftOuter: { x: number; y: number }[] = [];
        const rightOuter: { x: number; y: number }[] = [];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = curve.getPointbyPercentage(t);
            const tangent = PointCal.unitVector(curve.derivativeByPercentage(t));
            const nx = -tangent.y;
            const ny = tangent.x;

            leftOuter.push({ x: point.x - nx * outerOffset, y: point.y - ny * outerOffset });
            rightOuter.push({ x: point.x + nx * outerOffset, y: point.y + ny * outerOffset });
        }

        return TrackRenderSystem._buildStripMesh(leftOuter, rightOuter, texture, 0.6);
    }

    private _onDelete(key: string) {
        this._ballastStyleNodes.delete(key);
        const container = this._worldRenderSystem.removeFromBand(key);
        if (container !== undefined) {
            container.destroy({ children: true });
            this._drawableKeys.delete(key);
        }

        this._worldRenderSystem.removeShadow(key);
        this._shadowRecords.delete(key);

        this._worldRenderSystem.removeBed(key);
        this._bedMeshMap.delete(key);

        const railContainer = this._offsetRailMap.get(key);
        if (railContainer !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__rail__${key}`);
            removed?.destroy({ children: true });
            this._offsetRailMap.delete(key);
        }

        const catenaryContainer = this._catenaryMap.get(key);
        if (catenaryContainer !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__catenary__${key}`);
            removed?.destroy({ children: true });
            this._catenaryMap.delete(key);
        }

        const cuttingGraphics = this._cuttingMap.get(key);
        if (cuttingGraphics !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__cutting__${key}`);
            removed?.destroy({ children: true });
            this._cuttingMap.delete(key);
        }

        const coverGraphics = this._cuttingCoverMap.get(key);
        if (coverGraphics !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__cutting_cover__${key}`);
            removed?.destroy({ children: true });
            this._cuttingCoverMap.delete(key);
        }

        const tunnelWall = this._tunnelWallMap.get(key);
        if (tunnelWall !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__tunnel_wall__${key}`);
            removed?.destroy({ children: true });
            this._tunnelWallMap.delete(key);
        }

        const tunnelCeiling = this._tunnelCeilingMap.get(key);
        if (tunnelCeiling !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(`__tunnel_ceiling__${key}`);
            removed?.destroy({ children: true });
            this._tunnelCeilingMap.delete(key);
        }

        this._reindexDrawData();
    }

    /** Create or return the shared solid ballast texture with procedural rock detail. */
    private _getOrCreateSolidBallastTexture(): Texture | null {
        if (this._solidBallastTexture !== null) return this._solidBallastTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const size = 256;
        const g = new Graphics();
        // Base fill — covers exact bounds so generateTexture produces a clean size×size texture.
        g.rect(0, 0, size, size);
        g.fill(0x706860);

        // Scatter small rocks fully inside the rect so generateTexture bounds
        // stay exactly size×size (no overflow that would enlarge the texture).
        const rng = seededRng(73);
        const rockColors = [0x585048, 0x4a4238, 0x665e54, 0x3e3830, 0x7a726a];
        const highlightColors = [0x9a9288, 0xa8a098, 0x8e8680];
        const rockCount = 300;
        for (let r = 0; r < rockCount; r++) {
            const rw = 3 + rng() * 6;
            const rh = 3 + rng() * 5;
            // Pad by the max drawn radius (outline = rw+1) so nothing overflows.
            const pad = Math.max(rw, rh) + 1;
            const rx = pad + rng() * (size - pad * 2);
            const ry = pad + rng() * (size - pad * 2);
            const color = rockColors[Math.floor(rng() * rockColors.length)];
            // Dark outline to make rocks stand out from the base
            g.ellipse(rx, ry, rw + 1, rh + 1);
            g.fill({ color: 0x3a3020, alpha: 0.4 });
            g.ellipse(rx, ry, rw, rh);
            g.fill(color);
            // Highlight on top-left to give depth
            if (rng() > 0.3) {
                const hc = highlightColors[Math.floor(rng() * highlightColors.length)];
                g.ellipse(rx - rw * 0.2, ry - rh * 0.25, rw * 0.5, rh * 0.4);
                g.fill({ color: hc, alpha: 0.5 });
            }
        }

        this._solidBallastTexture = renderer.generateTexture({ target: g });
        const source = this._solidBallastTexture.source;
        source.addressMode = 'repeat';
        source.style.update();
        return this._solidBallastTexture;
    }

    /**
     * Build a mesh that draws solid-color ballast along the curve (used when elevation gradient is off).
     */
    private _buildSolidBallastMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const style = drawData.trackStyle ?? 'ballasted';
        const texture = style === 'slab'
            ? this._getOrCreateSlabBallastTexture()
            : this._getOrCreateSolidBallastTexture();
        if (texture === null) return null;

        const { curve } = drawData;
        const hw = ballastHalfWidth(drawData);
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];
        let arcLen = 0;

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            if (i > 0) {
                const prevT = (i - 1) / steps;
                const prev = i === 1 ? startPoint : curve.getPointbyPercentage(prevT);
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                arcLen += Math.sqrt(dx * dx + dy * dy);
            }
            const v = arcLen / BALLAST_TEXTURE_TILE_LEN;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(1, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    /** Create or return the shared rail + ties texture (transparent background, for overlay on ballast). */
    private _getOrCreateRailTexture(): Texture | null {
        if (this._railTexture !== null) return this._railTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        g.rect(0, 0, TRACK_TEX_SIZE, TRACK_TEX_SIZE);
        g.fill({ color: 0xffffff, alpha: 0 });

        const rng = seededRng(42);
        const tieY = TRACK_TEX_SIZE * 0.5 - 6;
        const tieOverhang = 4;
        // Concrete tie
        g.rect(-tieOverhang, tieY, TRACK_TEX_SIZE + tieOverhang * 2, 12);
        g.fill(0xa8a8a0);
        // Subtle surface texture on tie
        for (let i = 0; i < 5; i++) {
            const gy = tieY + 2 + rng() * 8;
            g.moveTo(-tieOverhang, gy);
            g.lineTo(TRACK_TEX_SIZE + tieOverhang, gy + rng() * 2 - 1);
            g.stroke({ color: 0x8a8a82, alpha: 0.4, width: 0.6 });
        }

        const railW = 5;
        const railL = railW / 2;
        const railR = TRACK_TEX_SIZE - railW / 2;
        for (const rx of [railL, railR]) {
            // Rusty brown rail body
            g.rect(rx - railW / 2, 0, railW, TRACK_TEX_SIZE);
            g.fill(0x6b3a1f);
            // Darker rust edges
            g.rect(rx - railW / 2, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0x4a2810, alpha: 0.6 });
            g.rect(rx + railW / 2 - 1, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0x4a2810, alpha: 0.6 });
            // Silver running line (wheel contact strip)
            g.rect(rx - 0.5, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0xd0d0d0, alpha: 0.8 });
        }

        this._railTexture = renderer.generateTexture({ target: g });
        const railSource = this._railTexture.source;
        railSource.addressMode = 'repeat';
        railSource.style.update();
        return this._railTexture;
    }

    /** Create or return the shared slab ballast texture (smooth concrete bed). */
    private _getOrCreateSlabBallastTexture(): Texture | null {
        if (this._slabBallastTexture !== null) return this._slabBallastTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const size = 256;
        const g = new Graphics();
        // Concrete base
        g.rect(0, 0, size, size);
        g.fill(0xc0bab0);

        // Subtle concrete surface variation
        const rng = seededRng(91);
        const speckleColors = [0xb5afa5, 0xccc6bc, 0xada79d, 0xd1cbc3];
        for (let s = 0; s < 200; s++) {
            const sx = 2 + rng() * (size - 4);
            const sy = 2 + rng() * (size - 4);
            const sw = 1 + rng() * 3;
            const sh = 1 + rng() * 2;
            g.ellipse(sx, sy, sw, sh);
            g.fill({ color: speckleColors[Math.floor(rng() * speckleColors.length)], alpha: 0.4 });
        }
        // A few hairline cracks
        for (let c = 0; c < 3; c++) {
            const cx = 10 + rng() * (size - 20);
            const cy = rng() * size;
            g.moveTo(cx, cy);
            g.lineTo(cx + (rng() - 0.5) * 30, cy + 20 + rng() * 40);
            g.stroke({ color: 0x8a847a, alpha: 0.3, width: 0.5 });
        }

        this._slabBallastTexture = renderer.generateTexture({ target: g });
        const source = this._slabBallastTexture.source;
        source.addressMode = 'repeat';
        source.style.update();
        return this._slabBallastTexture;
    }

    /** Create or return the shared slab-style rail texture (short concrete ties that don't span the full gauge). */
    private _getOrCreateSlabRailTexture(): Texture | null {
        if (this._slabRailTexture !== null) return this._slabRailTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        g.rect(0, 0, TRACK_TEX_SIZE, TRACK_TEX_SIZE);
        g.fill({ color: 0xffffff, alpha: 0 });

        // Short concrete tie blocks under each rail — they don't span the full width.
        const railW = 5;
        const railL = railW / 2;
        const railR = TRACK_TEX_SIZE - railW / 2;
        const tieBlockWidth = 14;
        const tieBlockHeight = 8;
        const tieY = TRACK_TEX_SIZE * 0.5 - tieBlockHeight / 2;
        // Left rail tie block
        g.rect(railL - tieBlockWidth / 2, tieY, tieBlockWidth, tieBlockHeight);
        g.fill(0xa09a90);
        g.rect(railL - tieBlockWidth / 2, tieY, tieBlockWidth, tieBlockHeight);
        g.stroke({ color: 0x888278, width: 0.5 });
        // Right rail tie block
        g.rect(railR - tieBlockWidth / 2, tieY, tieBlockWidth, tieBlockHeight);
        g.fill(0xa09a90);
        g.rect(railR - tieBlockWidth / 2, tieY, tieBlockWidth, tieBlockHeight);
        g.stroke({ color: 0x888278, width: 0.5 });

        // Rails
        for (const rx of [railL, railR]) {
            // Rusty brown rail body
            g.rect(rx - railW / 2, 0, railW, TRACK_TEX_SIZE);
            g.fill(0x6b3a1f);
            // Darker rust edges
            g.rect(rx - railW / 2, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0x4a2810, alpha: 0.6 });
            g.rect(rx + railW / 2 - 1, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0x4a2810, alpha: 0.6 });
            // Silver running line (wheel contact strip)
            g.rect(rx - 0.5, 0, 1, TRACK_TEX_SIZE);
            g.fill({ color: 0xd0d0d0, alpha: 0.8 });
        }

        this._slabRailTexture = renderer.generateTexture({ target: g });
        const railSource = this._slabRailTexture.source;
        railSource.addressMode = 'repeat';
        railSource.style.update();
        return this._slabRailTexture;
    }

    /**
     * Build a mesh that draws the rail texture (rails + ties) along the curve.
     * Tiles the shared texture along arc length. Returns null if texture generation is not available.
     *
     * The texture has rails at the edges (0–64px) and ties extending past (tieOverhang on each side).
     * We use a mesh wider than the gauge so that rails span the gauge and ties extend beyond it.
     */
    private _buildRailMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const style = drawData.trackStyle ?? 'ballasted';
        const texture = style === 'slab'
            ? this._getOrCreateSlabRailTexture()
            : this._getOrCreateRailTexture();
        if (texture === null) return null;

        const { curve } = drawData;
        const hw = railHalfWidth(drawData);
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];
        let arcLen = 0;

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            if (i > 0) {
                const prevT = (i - 1) / steps;
                const prev = i === 1 ? startPoint : curve.getPointbyPercentage(prevT);
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                arcLen += Math.sqrt(dx * dx + dy * dy);
            }
            const v = arcLen / TRACK_TEXTURE_TILE_LEN;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(1, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    /** Create or return the shared 1D elevation gradient texture. */
    private _getOrCreateElevationGradientTexture(): Texture | null {
        if (this._elevationGradientTexture !== null) return this._elevationGradientTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        for (let y = 0; y < ELEVATION_GRADIENT_HEIGHT; y++) {
            const normalizedV = y / (ELEVATION_GRADIENT_HEIGHT - 1);
            const rawElevation = ELEVATION_RAW_MIN + normalizedV * (ELEVATION_RAW_MAX - ELEVATION_RAW_MIN);
            const rgb = findElevationColorStop(rawElevation);
            const color = rgbToHex(rgb);
            g.rect(0, y, ELEVATION_GRADIENT_WIDTH, 1);
            g.fill(color);
        }

        this._elevationGradientTexture = renderer.generateTexture({ target: g });
        return this._elevationGradientTexture;
    }

    /** Create or return the shared solid-black texture for shadow meshes. */
    private _getOrCreateShadowTexture(): Texture | null {
        if (this._shadowTexture !== null) return this._shadowTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        g.rect(0, 0, SHADOW_TEX_SIZE, SHADOW_TEX_SIZE);
        g.fill(0x000000);

        this._shadowTexture = renderer.generateTexture({ target: g });
        return this._shadowTexture;
    }

    /** Create a tiny solid-color texture, or return null if the renderer is not ready. */
    private _createSolidTexture(color: number): Texture | null {
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;
        const g = new Graphics();
        g.rect(0, 0, TUNNEL_TEX_SIZE, TUNNEL_TEX_SIZE);
        g.fill(color);
        return renderer.generateTexture({ target: g });
    }

    private _getOrCreateTunnelWallTexture(): Texture | null {
        return (this._tunnelWallTexture ??= this._createSolidTexture(0x808080));
    }

    private _getOrCreateTunnelCeilingTexture(): Texture | null {
        return (this._tunnelCeilingTexture ??= this._createSolidTexture(0x707070));
    }

    private _getOrCreateCuttingWallTexture(): Texture | null {
        return (this._cuttingWallTexture ??= this._createSolidTexture(0xA0A0A0));
    }

    private _getOrCreateCuttingCoverTexture(): Texture | null {
        return (this._cuttingCoverTexture ??= this._createSolidTexture(0x888888));
    }

    /**
     * Build a MeshSimple triangle strip from two parallel point arrays (left and right edges).
     * Returns null if the texture is unavailable or there are fewer than 2 points.
     */
    private static _buildStripMesh(
        left: { x: number; y: number }[],
        right: { x: number; y: number }[],
        texture: Texture,
        alpha = 1,
    ): MeshSimple | null {
        const count = Math.min(left.length, right.length);
        if (count < 2) return null;

        const verts = new Float32Array(count * 4);
        const uvs = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            const vi = i * 4;
            verts[vi] = left[i].x;
            verts[vi + 1] = left[i].y;
            verts[vi + 2] = right[i].x;
            verts[vi + 3] = right[i].y;
            uvs[vi] = 0;
            uvs[vi + 1] = i / (count - 1);
            uvs[vi + 2] = 1;
            uvs[vi + 3] = i / (count - 1);
        }

        const indices = new Uint32Array((count - 1) * 6);
        for (let i = 0; i < count - 1; i++) {
            const b = i * 2;
            const ii = i * 6;
            indices[ii] = b;
            indices[ii + 1] = b + 1;
            indices[ii + 2] = b + 2;
            indices[ii + 3] = b + 1;
            indices[ii + 4] = b + 3;
            indices[ii + 5] = b + 2;
        }

        const mesh = new MeshSimple({ texture, vertices: verts, uvs, indices });
        mesh.alpha = alpha;
        return mesh;
    }

    /** Create or return the shared bed texture (wider gravel/dirt foundation). */
    private _getOrCreateBedTexture(): Texture | null {
        if (this._bedTexture !== null) return this._bedTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const size = 256;
        const g = new Graphics();
        g.rect(0, 0, size, size);
        g.fill(0x5a5248);

        const rng = seededRng(59);
        const bedRockColors = [0x4a4238, 0x3e3830, 0x524a40, 0x605850, 0x3a3228];
        for (let r = 0; r < 350; r++) {
            const rw = 3 + rng() * 6;
            const rh = 2 + rng() * 5;
            const rx = rng() * size;
            const ry = rng() * size;
            const cw = Math.min(rw, size - rx);
            const ch = Math.min(rh, size - ry);
            if (cw > 0 && ch > 0) {
                const color = bedRockColors[Math.floor(rng() * bedRockColors.length)];
                g.rect(rx, ry, cw, ch);
                g.fill(color);
            }
        }

        this._bedTexture = renderer.generateTexture({ target: g });
        const source = this._bedTexture.source;
        source.addressMode = 'repeat';
        source.style.update();
        return this._bedTexture;
    }

    /**
     * Build a bed mesh strip along the curve. The bed is wider than the ballast
     * to create a visible foundation/shoulder on each side.
     */
    private _buildBedMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const texture = this._getOrCreateBedTexture();
        if (texture === null) return null;

        const { curve } = drawData;
        const hw = (drawData.bedWidth ?? 3) / 2;
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];
        let arcLen = 0;

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            if (i > 0) {
                const prevT = (i - 1) / steps;
                const prev = i === 1 ? startPoint : curve.getPointbyPercentage(prevT);
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                arcLen += Math.sqrt(dx * dx + dy * dy);
            }
            const v = arcLen / BALLAST_TEXTURE_TILE_LEN;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(1, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    /**
     * Build a shadow mesh strip along a curve.
     *
     * @param curve - The bezier curve to trace
     * @param halfWidth - Half-width of the shadow in world units (should cover ballast + bed)
     * @param elevation - Elevation range for shadow offset calculation
     * @param sunAngle - Sun angle in degrees
     * @param baseShadowLength - Base shadow length multiplier
     * @returns The mesh plus auxiliary data for efficient sun-angle updates,
     *          or null if the texture renderer is unavailable
     */
    private _buildShadowMesh(
        curve: BCurve,
        halfWidth: number,
        elevation: { from: number; to: number },
        sunAngle: number,
        baseShadowLength: number,
    ): { mesh: MeshSimple; baseVerts: Float32Array; elevationFactors: Float32Array } | null {
        const texture = this._getOrCreateShadowTexture();
        if (texture === null) return null;

        const steps = 10;
        const sunAngleRad = (sunAngle * Math.PI) / 180;
        const cosA = Math.cos(sunAngleRad);
        const sinA = Math.sin(sunAngleRad);

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        const vertCount = (steps + 1) * 2;
        const baseVerts = new Float32Array(vertCount * 2);
        const elevationFactors = new Float32Array(steps + 1);
        const verts = new Float32Array(vertCount * 2);
        const uvs = new Float32Array(vertCount * 2);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const tangent = PointCal.unitVector(curve.derivativeByPercentage(t));
            const nx = -tangent.y;
            const ny = tangent.x;

            const elevationAtT = elevation.from + (elevation.to - elevation.from) * t;
            const shadowLen = elevationAtT > 0 ? baseShadowLength * (elevationAtT / 100) : 0;
            const offsetX = cosA * shadowLen;
            const offsetY = sinA * shadowLen;

            const bi = i * 4;
            // Left edge base (no sun offset)
            baseVerts[bi] = point.x + nx * halfWidth;
            baseVerts[bi + 1] = point.y + ny * halfWidth;
            // Right edge base
            baseVerts[bi + 2] = point.x - nx * halfWidth;
            baseVerts[bi + 3] = point.y - ny * halfWidth;

            elevationFactors[i] = shadowLen;

            // Apply sun offset
            verts[bi] = baseVerts[bi] + offsetX;
            verts[bi + 1] = baseVerts[bi + 1] + offsetY;
            verts[bi + 2] = baseVerts[bi + 2] + offsetX;
            verts[bi + 3] = baseVerts[bi + 3] + offsetY;

            const ui = i * 4;
            uvs[ui] = 0; uvs[ui + 1] = 0;
            uvs[ui + 2] = 1; uvs[ui + 3] = 0;
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        const mesh = new MeshSimple({
            texture,
            vertices: verts,
            uvs,
            indices: new Uint32Array(indices),
        });

        return { mesh, baseVerts, elevationFactors };
    }

    /**
     * Build a mesh strip along the curve colored by the elevation gradient.
     * Uses a single shared gradient texture with UV V coordinates mapping
     * from normalised(elevation.from) to normalised(elevation.to).
     */
    private _buildElevationMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const texture = this._getOrCreateElevationGradientTexture();
        if (texture === null) return null;

        const { curve, elevation } = drawData;
        const hw = ballastHalfWidth(drawData);
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];

        const vFrom = normalizeElevation(elevation.from);
        const vTo = normalizeElevation(elevation.to);

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            const v = vFrom + (vTo - vFrom) * t;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0.5, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(0.5, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    private _onRemoveTrackSegment(curveNumber: number) {
        const entry = this._simplifiedTrackGraphicsMap.get(curveNumber);
        if (entry !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(entry.bandKey);
            removed?.destroy({ children: true });
            this._simplifiedTrackGraphicsMap.delete(curveNumber);
        }

        const ugEntry = this._undergroundIndicatorMap.get(curveNumber);
        if (ugEntry !== undefined) {
            const removed = this._worldRenderSystem.removeFromBand(ugEntry.bandKey);
            removed?.destroy({ children: true });
            this._undergroundIndicatorMap.delete(curveNumber);
        }
    }

    private _onAddTrackSegment(curveNumber: number, trackSegment: TrackSegmentWithCollision) {
        const simplifiedTrackGraphics = new Graphics();
        const controlPoints = trackSegment.curve.getControlPoints();

        simplifiedTrackGraphics.moveTo(controlPoints[0].x, controlPoints[0].y);
        if (controlPoints.length === 3) {
            simplifiedTrackGraphics.quadraticCurveTo(controlPoints[1].x, controlPoints[1].y, controlPoints[2].x, controlPoints[2].y);
        } else {
            simplifiedTrackGraphics.bezierCurveTo(controlPoints[1].x, controlPoints[1].y, controlPoints[2].x, controlPoints[2].y, controlPoints[3].x, controlPoints[3].y);
        }
        simplifiedTrackGraphics.stroke({ color: 0x000000, pixelLine: true });

        const rawElevation = Math.max(
            trackSegment.elevation.from * LEVEL_HEIGHT,
            trackSegment.elevation.to * LEVEL_HEIGHT,
        );
        const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);
        const bandKey = `__simplified__${curveNumber}`;
        this._worldRenderSystem.addToBand(bandKey, simplifiedTrackGraphics, bandIndex, 'rail');
        this._simplifiedTrackGraphicsMap.set(curveNumber, { graphics: simplifiedTrackGraphics, bandKey });

        // Draw a dashed outline for underground track segments (where track
        // elevation is below terrain height) so tunnels/subways are visible
        // from the surface. The indicator is placed at the terrain surface band.
        {
            const curve = trackSegment.curve;
            const startPoint = curve.getPointbyPercentage(0);
            const endPoint = curve.getPointbyPercentage(1);
            const startTerrainH = this._terrainData?.getHeight(startPoint.x, startPoint.y) ?? 0;
            const endTerrainH = this._terrainData?.getHeight(endPoint.x, endPoint.y) ?? 0;
            const startTrackElev = trackSegment.elevation.from * LEVEL_HEIGHT;
            const endTrackElev = trackSegment.elevation.to * LEVEL_HEIGHT;

            // Track is underground when its elevation is below terrain at that point.
            if (startTrackElev < startTerrainH && endTrackElev < endTerrainH) {
                const undergroundGraphics = new Graphics();
                const dashLen = 3;
                const gapLen = 2;
                const cycleLen = dashLen + gapLen;
                const totalLen = curve.fullLength;
                let dist = 0;

                while (dist < totalLen) {
                    const segEnd = Math.min(dist + dashLen, totalLen);
                    const tStart = dist / totalLen;
                    const tEnd = segEnd / totalLen;
                    const steps = Math.max(2, Math.ceil((segEnd - dist) / 1));

                    const p0 = curve.getPointbyPercentage(tStart);
                    undergroundGraphics.moveTo(p0.x, p0.y);
                    for (let s = 1; s <= steps; s++) {
                        const t = tStart + (tEnd - tStart) * (s / steps);
                        const p = curve.getPointbyPercentage(t);
                        undergroundGraphics.lineTo(p.x, p.y);
                    }

                    dist += cycleLen;
                }
                undergroundGraphics.stroke({ color: 0x555555, width: 0.8, pixelLine: true });

                // Place at the terrain surface elevation band so it appears on top of the terrain.
                const surfaceElev = Math.max(startTerrainH, endTerrainH);
                const surfaceBandIndex = this._worldRenderSystem.getElevationBandIndex(surfaceElev);
                const ugKey = `__underground__${curveNumber}`;
                this._worldRenderSystem.addToBand(ugKey, undergroundGraphics, surfaceBandIndex, 'rail');
                this._undergroundIndicatorMap.set(curveNumber, { graphics: undergroundGraphics, bandKey: ugKey });
            }
        }
    }

    private _onNewTrackData(index: number, drawDataList: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]) {

        drawDataList.forEach((drawData) => {
            // Stamp the current track style and electrification onto the draw data
            // so each segment retains the options that were active when it was laid down.
            if (drawData.trackStyle === undefined) {
                drawData.trackStyle = this._trackStyle;
            }
            if (drawData.electrified === undefined) {
                drawData.electrified = this._electrified;
            }
            if (drawData.bedWidth === undefined) {
                drawData.bedWidth = this._bedWidth;
            }
            if (drawData.bed === undefined) {
                drawData.bed = this._bed;
            }

            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });

            const segmentsContainer = new Container();

            const ballastNode = new Container();
            const elevationMeshContainer = new Container();
            const elevationMesh = this._buildElevationMeshForDrawData(drawData);
            if (elevationMesh !== null) {
                elevationMeshContainer.addChild(elevationMesh);
            }
            elevationMeshContainer.visible = this._showElevationGradient;
            ballastNode.addChild(elevationMeshContainer);

            const solidBallastMeshContainer = new Container();
            const solidBallastMesh = this._buildSolidBallastMeshForDrawData(drawData);
            if (solidBallastMesh !== null) {
                solidBallastMeshContainer.addChild(solidBallastMesh);
            }
            solidBallastMeshContainer.visible = !this._showElevationGradient;
            ballastNode.addChild(solidBallastMeshContainer);

            segmentsContainer.addChild(ballastNode);

            const railMesh = this._buildRailMeshForDrawData(drawData);
            if (railMesh !== null) {
                const railContainer = new Container();
                railContainer.addChild(railMesh);
                this._offsetRailMap.set(key, railContainer);
            }

            this._ballastStyleNodes.set(key, {
                elevationMesh: elevationMeshContainer,
                solidBallastMesh: solidBallastMeshContainer,
            });

            const isConstant = drawData.elevation.from === drawData.elevation.to;
            const hasPositiveElevation =
                drawData.elevation.from > 0 || drawData.elevation.to > 0;

            const ballastHw = ballastHalfWidth(drawData);
            const shadowHw = drawData.bed
                ? Math.max(ballastHw, (drawData.bedWidth ?? 3) / 2)
                : ballastHw;
            const shadowResult = hasPositiveElevation
                ? this._buildShadowMesh(
                    drawData.curve, shadowHw, drawData.elevation, this._sunAngle, this._baseShadowLength,
                )
                : null;

            if (shadowResult !== null) {
                const { mesh: shadowMesh, baseVerts, elevationFactors } = shadowResult;

                if (isConstant && hasPositiveElevation) {
                    const shadowLen = this._baseShadowLength * (drawData.elevation.from / 100);
                    // Use base vertices (no baked sun offset); position handles the offset
                    shadowMesh.vertices = new Float32Array(baseVerts);
                    const sunAngleRad = (this._sunAngle * Math.PI) / 180;
                    shadowMesh.position.set(
                        Math.cos(sunAngleRad) * shadowLen,
                        Math.sin(sunAngleRad) * shadowLen,
                    );
                    this._shadowRecords.set(key, {
                        drawData,
                        mesh: shadowMesh,
                        constantElevation: true,
                        shadowLength: shadowLen,
                    });
                } else {
                    this._shadowRecords.set(key, {
                        drawData,
                        mesh: shadowMesh,
                        constantElevation: false,
                        shadowLength: 0,
                        baseVerts,
                        elevationFactors,
                    });
                }

                // Place shadow one elevation band below the track so terrain
                // occlusion at the track's own level properly hides it.
                // e.g. ABOVE_2 track shadow → ABOVE_1 band; hidden by ABOVE_2+ terrain.
                const trackBandIndex = this._worldRenderSystem.getElevationBandIndex(
                    Math.max(drawData.elevation.from, drawData.elevation.to)
                );
                const shadowBandIndex = Math.max(0, trackBandIndex - 1);
                const shadowElevation = ELEVATION_VALUES[shadowBandIndex] as ELEVATION;
                this._worldRenderSystem.addShadow(key, shadowMesh, shadowElevation);
            }

            // Build bed mesh (gravel foundation) if enabled for this segment.
            if (drawData.bed) {
                const bedMesh = this._buildBedMeshForDrawData(drawData);
                if (bedMesh !== null) {
                    const bedElevation = this._worldRenderSystem.resolveElevationLevel(
                        Math.max(drawData.elevation.from, drawData.elevation.to)
                    );
                    this._worldRenderSystem.addBed(key, bedMesh, bedElevation);
                    this._bedMeshMap.set(key, bedMesh);
                }
            }

            this._drawableKeys.add(key);

            // Determine band index for this segment.
            const rawElevation = Math.max(drawData.elevation.from, drawData.elevation.to);
            const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);

            this._worldRenderSystem.addToBand(key, segmentsContainer, bandIndex, 'drawable');

            // Add rail to same band.
            const railContainer = this._offsetRailMap.get(key);
            if (railContainer !== undefined) {
                this._worldRenderSystem.addToBand(`__rail__${key}`, railContainer, bandIndex, 'rail');
            }

            // Build catenary poles if this segment is electrified.
            if (drawData.electrified) {
                const catenaryContainer = this._buildCatenaryForDrawData(drawData);
                const catenaryKey = `__catenary__${key}`;
                this._worldRenderSystem.addToBand(catenaryKey, catenaryContainer, bandIndex, 'catenary');
                this._catenaryMap.set(key, catenaryContainer);
            }

            // Build tunnel-entrance graphics for ramp segments that go below terrain.
            const cuttingResult = this._buildCuttingForDrawData(drawData);
            if (cuttingResult !== null) {
                const cuttingKey = `__cutting__${key}`;
                this._worldRenderSystem.addToBand(cuttingKey, cuttingResult.mesh, cuttingResult.surfaceBandIndex, 'drawable');
                this._cuttingMap.set(key, cuttingResult.mesh);
            }
            const coverResult = this._buildCuttingCoverForDrawData(drawData);
            if (coverResult !== null) {
                const coverKey = `__cutting_cover__${key}`;
                this._worldRenderSystem.addToBand(coverKey, coverResult.mesh, coverResult.surfaceBandIndex, 'catenary');
                this._cuttingCoverMap.set(key, coverResult.mesh);
            }

            // Build tunnel enclosure for fully underground segments.
            const tunnelWalls = this._buildTunnelWallsForDrawData(drawData);
            if (tunnelWalls !== null) {
                const wallKey = `__tunnel_wall__${key}`;
                this._worldRenderSystem.addToBand(wallKey, tunnelWalls, bandIndex, 'drawable');
                this._tunnelWallMap.set(key, tunnelWalls);
            }
            const tunnelCeiling = this._buildTunnelCeilingForDrawData(drawData);
            if (tunnelCeiling !== null) {
                const ceilingKey = `__tunnel_ceiling__${key}`;
                this._worldRenderSystem.addToBand(ceilingKey, tunnelCeiling, bandIndex, 'catenary');
                this._tunnelCeilingMap.set(key, tunnelCeiling);
            }
        });

        this._reindexDrawData();
        this._applyZoomLod(this._camera.zoomLevel);
    }

    /**
     * Recompute z-indices for all persisted track drawables based on the
     * current draw order from the track curve manager.
     *
     * Within each elevation band, drawables and rails are sorted by minimum
     * elevation so ramps draw below constant-elevation tracks.
     */
    private _reindexDrawData() {
        const drawDataOrder = this._trackCurveManager.persistedDrawData;
        this._drawDataBandMap.clear();

        // Group draw data by elevation band, then sort within each band
        // by minimum elevation so ramps draw below constant-elevation tracks.
        const bandGroups = new Map<number, { drawData: TrackSegmentDrawData; key: string; minElevation: number }[]>();

        drawDataOrder.forEach((drawData) => {
            const rawElevation = Math.max(drawData.elevation.from, drawData.elevation.to);
            const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const minElevation = Math.min(drawData.elevation.from, drawData.elevation.to);

            let group = bandGroups.get(bandIndex);
            if (!group) {
                group = [];
                bandGroups.set(bandIndex, group);
            }
            group.push({ drawData, key, minElevation });
        });

        for (const [bandIndex, group] of bandGroups) {
            group.sort((a, b) => a.minElevation - b.minElevation);
            for (let n = 0; n < group.length; n++) {
                const { key } = group[n];
                // Set draw order within the band's drawable and rail sublayers.
                this._worldRenderSystem.setOrderInBand(key, n);
                this._drawDataBandMap.set(key, bandIndex);
                this._worldRenderSystem.setOrderInBand(`__rail__${key}`, n);
            }
        }

        this._worldRenderSystem.sortChildren();
    }

    private _onDuplicateHighlightChange(state: DuplicateHighlightState) {
        const g = this._duplicateHighlightGraphics;
        g.clear();
        if (state === null) {
            return;
        }
        const curve = this._trackCurveManager.getTrackSegment(state.segmentNumber);
        if (curve === null) {
            return;
        }

        const SAMPLE_COUNT = 32;
        const first = curve.get(0);
        g.moveTo(first.x, first.y);
        for (let i = 1; i <= SAMPLE_COUNT; i++) {
            const pt = curve.get(i / SAMPLE_COUNT);
            g.lineTo(pt.x, pt.y);
        }

        // Hover: soft cyan. Selected: warm gold, thicker + fully opaque so
        // the user can tell at a glance that the source is now locked in and
        // F will flip its side.
        if (state.kind === 'hover') {
            g.stroke({ color: 0x33ddff, width: 0.6, alpha: 0.75 });
        } else {
            g.stroke({ color: 0xffc107, width: 1.0, alpha: 0.95 });
        }
    }

    private _onDeletionHighlightChange(state: DeletionHighlightState) {
        const g = this._deletionHighlightGraphics;
        g.clear();
        if (state === null) {
            return;
        }
        const curve = this._trackCurveManager.getTrackSegment(state.segmentNumber);
        if (curve === null) {
            return;
        }

        const SAMPLE_COUNT = 32;
        const first = curve.get(0);
        g.moveTo(first.x, first.y);
        for (let i = 1; i <= SAMPLE_COUNT; i++) {
            const pt = curve.get(i / SAMPLE_COUNT);
            g.lineTo(pt.x, pt.y);
        }
        g.stroke({ color: 0xff3b30, width: 0.9, alpha: 0.85 });
    }

    private _onCatenaryHighlightChange(state: CatenaryHighlightState) {
        const g = this._catenaryHighlightGraphics;
        g.clear();
        if (state === null) {
            return;
        }
        const curve = this._trackCurveManager.getTrackSegment(state.segmentNumber);
        if (curve === null) {
            return;
        }

        const SAMPLE_COUNT = 32;
        const first = curve.get(0);
        g.moveTo(first.x, first.y);
        for (let i = 1; i <= SAMPLE_COUNT; i++) {
            const pt = curve.get(i / SAMPLE_COUNT);
            g.lineTo(pt.x, pt.y);
        }

        if (state.kind === 'hover') {
            g.stroke({ color: 0x66bb6a, width: 0.6, alpha: 0.75 });
        } else {
            g.stroke({ color: 0x43a047, width: 1.0, alpha: 0.95 });
        }
    }

    private _onCatenaryPreviewChange(state: CatenaryPreviewState) {
        const g = this._catenaryPreviewGraphics;
        g.clear();
        if (state === null) {
            return;
        }

        const curve = this._trackCurveManager.getTrackSegment(state.segmentNumber);
        if (curve === null) {
            return;
        }

        // Draw a preview of poles on the chosen side.
        const curveLength = curve.fullLength;
        const poleSpacing = 25;
        const poleCount = Math.max(1, Math.floor(curveLength / poleSpacing));
        const visualProps = this._trackCurveManager.getVisualPropsForSegment(state.segmentNumber);
        const gauge = visualProps?.gauge ?? 1.067;
        const tieOverhang = 4;
        const tieHw = (gauge / 2) * ((TRACK_TEX_SIZE + tieOverhang * 2) / TRACK_TEX_SIZE);
        const bHw = tieHw + 0.15;
        const mastOffset = visualProps?.bed
            ? Math.max(bHw, (visualProps.bedWidth ?? 3) / 2)
            : bHw;
        const side = state.side;

        for (let i = 0; i <= poleCount; i++) {
            const t = poleCount === 0 ? 0.5 : i / poleCount;
            const point = curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            const mastX = point.x + nx * mastOffset * side;
            const mastY = point.y + ny * mastOffset * side;

            g.circle(mastX, mastY, 0.15);
            g.fill({ color: 0x43a047, alpha: 0.7 });

            g.moveTo(mastX, mastY);
            g.lineTo(point.x, point.y);
            g.stroke({ color: 0x66bb6a, width: 0.08, alpha: 0.6 });
        }

        // Draw wire preview.
        const wireSteps = Math.max(10, Math.ceil(curveLength / 1));
        const first = curve.get(0);
        g.moveTo(first.x, first.y);
        for (let i = 1; i <= wireSteps; i++) {
            const t = i / wireSteps;
            const p = curve.getPointbyPercentage(t);
            g.lineTo(p.x, p.y);
        }
        g.stroke({ color: 0x43a047, width: 0.05, alpha: 0.5 });
    }

    private _onPreviewDrawDataChange(drawDataList: { index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined) {
        this._latestPreviewDrawDataList = drawDataList;
        this._previewKeys.forEach(key => {
            const container = this._worldRenderSystem.removeFromBand(key);
            container?.destroy({ children: true });
        });
        this._previewKeys = [];
        this._previewRailContainers.forEach((c, idx) => {
            const removed = this._worldRenderSystem.removeFromBand(`__preview_rail__${idx}`);
            removed?.destroy({ children: true });
        });
        this._previewRailContainers = [];
        this._previewCuttingKeys.forEach(ck => {
            const removed = this._worldRenderSystem.removeFromBand(ck);
            removed?.destroy({ children: true });
        });
        this._previewCuttingKeys = [];
        this._previewCoverKeys.forEach(ck => {
            const removed = this._worldRenderSystem.removeFromBand(ck);
            removed?.destroy({ children: true });
        });
        this._previewCoverKeys = [];
        this._previewTunnelWallKeys.forEach(tk => {
            const removed = this._worldRenderSystem.removeFromBand(tk);
            removed?.destroy({ children: true });
        });
        this._previewTunnelWallKeys = [];
        this._previewTunnelCeilingKeys.forEach(tk => {
            const removed = this._worldRenderSystem.removeFromBand(tk);
            removed?.destroy({ children: true });
        });
        this._previewTunnelCeilingKeys = [];
        this._previewBedKeys.forEach(bk => {
            this._worldRenderSystem.removeBed(bk);
        });
        this._previewBedKeys = [];

        if (drawDataList == undefined) {
            return;
        }

        drawDataList.forEach(({ drawData, index }, i) => {
            const key = `__preview__${i}`;

            // Stamp current settings so texture builders use the active style.
            if (drawData.trackStyle === undefined) {
                drawData.trackStyle = this._trackStyle;
            }
            if (drawData.electrified === undefined) {
                drawData.electrified = this._electrified;
            }
            if (drawData.bedWidth === undefined) {
                drawData.bedWidth = this._bedWidth;
            }
            if (drawData.bed === undefined) {
                drawData.bed = this._bed;
            }

            const segmentsContainer = new Container();

            // Build textured ballast mesh (same as committed tracks).
            const ballastNode = new Container();
            const elevationMeshContainer = new Container();
            const elevationMesh = this._buildElevationMeshForDrawData(drawData);
            if (elevationMesh !== null) {
                elevationMeshContainer.addChild(elevationMesh);
            }
            elevationMeshContainer.visible = this._showElevationGradient;
            ballastNode.addChild(elevationMeshContainer);

            const solidBallastMeshContainer = new Container();
            const solidBallastMesh = this._buildSolidBallastMeshForDrawData(drawData);
            if (solidBallastMesh !== null) {
                solidBallastMeshContainer.addChild(solidBallastMesh);
            }
            solidBallastMeshContainer.visible = !this._showElevationGradient;
            ballastNode.addChild(solidBallastMeshContainer);

            segmentsContainer.addChild(ballastNode);

            // Build bed mesh for preview if enabled.
            if (drawData.bed) {
                const bedMesh = this._buildBedMeshForDrawData(drawData);
                if (bedMesh !== null) {
                    const bedKey = `__preview_bed__${this._previewBedKeys.length}`;
                    const bedElevation = this._worldRenderSystem.resolveElevationLevel(
                        Math.max(drawData.elevation.from, drawData.elevation.to)
                    );
                    this._worldRenderSystem.addBed(bedKey, bedMesh, bedElevation);
                    this._previewBedKeys.push(bedKey);
                }
            }

            // Build textured rail mesh.
            const railMesh = this._buildRailMeshForDrawData(drawData);
            if (railMesh !== null) {
                const railContainer = new Container();
                railContainer.addChild(railMesh);
                const railKey = `__preview_rail__${this._previewRailContainers.length}`;
                const railBandIndex = this._worldRenderSystem.getElevationBandIndex(
                    Math.max(drawData.elevation.from, drawData.elevation.to)
                );
                this._worldRenderSystem.addToBand(railKey, railContainer, railBandIndex, 'rail');
                this._previewRailContainers.push(railContainer);
            }

            // Arc visualization overlay (optional).
            if (this._showPreviewCurveArcs) {
                const arcFanContainer = new Container();
                // For straight lines, arc fitting is not meaningful (circle radius -> ∞)
                // and can produce noisy results. Skip entirely.
                if (!curveIsNearlyStraight(drawData.curve)) {
                const arcs = drawData.curve.getArcs(0.5);
                for (const arc of arcs) {
                    const a0 = Math.atan2(arc.startPoint.y - arc.center.y, arc.startPoint.x - arc.center.x);
                    const a1 = Math.atan2(arc.endPoint.y - arc.center.y, arc.endPoint.x - arc.center.x);

                    // Choose direction that best matches the curve by sampling a midpoint.
                    const midT = (arc.startT + arc.endT) / 2;
                    const midPoint = drawData.curve.get(midT);
                    const am = Math.atan2(midPoint.y - arc.center.y, midPoint.x - arc.center.x);

                    const cwErr = arcDirectionFitError(arc.center, arc.radius, a0, a1, am, 'cw');
                    const ccwErr = arcDirectionFitError(arc.center, arc.radius, a0, a1, am, 'ccw');
                    const direction: 'cw' | 'ccw' = cwErr <= ccwErr ? 'cw' : 'ccw';

                    const wedge = new Graphics();
                    // Build a "fan" (sector) shape: center -> start -> arc -> back to center.
                    // Use polyline instead of Graphics.arc() to avoid full-circle ambiguity.
                    const span = angleDelta(a0, a1, direction);
                    if (span > Math.PI * 1.9) continue; // Skip near-full-circle arcs
                    wedge.moveTo(arc.center.x, arc.center.y);
                    wedge.lineTo(arc.startPoint.x, arc.startPoint.y);
                    drawArcPolyline(wedge, arc.center, arc.radius, a0, a1, direction);
                    wedge.lineTo(arc.center.x, arc.center.y);
                    wedge.closePath();
                    wedge.fill({ color: 0x1d4ed8, alpha: 0.18 });
                    wedge.stroke({ color: 0x1d4ed8, alpha: 0.55, pixelLine: true, width: 1 });
                    arcFanContainer.addChild(wedge);

                    // CAD-style radius label: position near the arc (not at center).
                    const labelDist = arc.radius * 0.7; // ~70% from center toward arc
                    const midAngle = direction === 'ccw' ? a0 + span / 2 : a0 - span / 2;
                    const labelX = arc.center.x + Math.cos(midAngle) * labelDist;
                    const labelY = arc.center.y + Math.sin(midAngle) * labelDist;
                    const zoomLevel = this._camera.zoomLevel;
                    // Use fixed pixel font + scale container by 1/zoom so text stays crisp and constant screen size.
                    const labelContainer = new Container();
                    labelContainer.position.set(labelX, labelY);
                    labelContainer.scale.set(1 / zoomLevel, 1 / zoomLevel);
                    const radiusLabel = new Text({
                        text: `R ${arc.radius.toFixed(1)}`,
                        style: {
                            fontFamily: 'sans-serif',
                            fontSize: 14,
                            fill: 0x1d4ed8,
                            fontWeight: '600',
                        },
                    });
                    radiusLabel.anchor.set(0.5, 0.5);
                    radiusLabel.position.set(0, 0);
                    labelContainer.addChild(radiusLabel);
                    arcFanContainer.addChild(labelContainer);
                }
                }
                // Put the fan wedges behind the preview meshes.
                segmentsContainer.addChildAt(arcFanContainer, 0);
            }

            const bandIndex = this._worldRenderSystem.getElevationBandIndex(
                Math.max(drawData.elevation.from, drawData.elevation.to)
            );
            this._worldRenderSystem.addToBand(key, segmentsContainer, bandIndex, 'drawable');
            this._worldRenderSystem.setOrderInBand(key, index);
            this._previewKeys.push(key);

            // Build tunnel-entrance graphics for preview segments that go below terrain.
            const cuttingResult = this._buildCuttingForDrawData(drawData);
            if (cuttingResult !== null) {
                const cuttingKey = `__preview_cutting__${i}`;
                this._worldRenderSystem.addToBand(cuttingKey, cuttingResult.mesh, cuttingResult.surfaceBandIndex, 'drawable');
                this._previewCuttingKeys.push(cuttingKey);
            }
            const coverResult = this._buildCuttingCoverForDrawData(drawData);
            if (coverResult !== null) {
                const coverKey = `__preview_cover__${i}`;
                this._worldRenderSystem.addToBand(coverKey, coverResult.mesh, coverResult.surfaceBandIndex, 'catenary');
                this._previewCoverKeys.push(coverKey);
            }

            // Build tunnel enclosure for fully underground preview segments.
            const tunnelWalls = this._buildTunnelWallsForDrawData(drawData);
            if (tunnelWalls !== null) {
                const wallKey = `__preview_tunnel_wall__${i}`;
                this._worldRenderSystem.addToBand(wallKey, tunnelWalls, bandIndex, 'drawable');
                this._previewTunnelWallKeys.push(wallKey);
            }
            const tunnelCeiling = this._buildTunnelCeilingForDrawData(drawData);
            if (tunnelCeiling !== null) {
                const ceilingKey = `__preview_tunnel_ceiling__${i}`;
                this._worldRenderSystem.addToBand(ceilingKey, tunnelCeiling, bandIndex, 'catenary');
                this._previewTunnelCeilingKeys.push(ceilingKey);
            }
        });
    }

    /**
     * Return the elevation band index for the given draw data identifier.
     *
     * Used by the train render system to place on-track objects (bogies, cars)
     * in the correct elevation band's onTrack sublayer.
     *
     * @param drawDataIdentifier - Identifier of the draw data the object sits on
     * @returns The elevation band index, or null if the identifier is unknown
     */
    getTrackBandIndex(drawDataIdentifier: { trackSegmentNumber: number, tValInterval: { start: number, end: number } }): number | null {
        const key = JSON.stringify(drawDataIdentifier);
        return this._drawDataBandMap.get(key) ?? null;
    }
}

const normalizeAngle0ToTau = (a: number): number => {
    const TAU = Math.PI * 2;
    let x = a % TAU;
    if (x < 0) x += TAU;
    return x;
};

const angleDelta = (from: number, to: number, direction: 'cw' | 'ccw'): number => {
    const TAU = Math.PI * 2;
    const a0 = normalizeAngle0ToTau(from);
    const a1 = normalizeAngle0ToTau(to);
    if (direction === 'ccw') {
        // Increase angle (wrapping) from a0 to a1
        return (a1 - a0 + TAU) % TAU;
    }
    // Decrease angle (wrapping) from a0 to a1
    return (a0 - a1 + TAU) % TAU;
};

const drawArcPolyline = (
    g: Graphics,
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    direction: 'cw' | 'ccw',
): void => {
    const span = angleDelta(startAngle, endAngle, direction);
    const steps = Math.max(8, Math.ceil((span * radius) / 8)); // ~1 point per 8px of arc length
    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const a =
            direction === 'ccw'
                ? startAngle + span * t
                : startAngle - span * t;
        const x = center.x + Math.cos(a) * radius;
        const y = center.y + Math.sin(a) * radius;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
};

const arcDirectionFitError = (
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    desiredMidAngle: number,
    direction: 'cw' | 'ccw',
): number => {
    // Compare the mid-angle produced by traversing the arc to the curve’s mid-angle.
    const span = angleDelta(startAngle, endAngle, direction);
    const candidateMidAngle =
        direction === 'ccw'
            ? startAngle + span / 2
            : startAngle - span / 2;
    const a = normalizeAngle0ToTau(candidateMidAngle);
    const b = normalizeAngle0ToTau(desiredMidAngle);
    const d = Math.abs(a - b);
    // Smallest angular distance on circle.
    const TAU = Math.PI * 2;
    const angularDist = Math.min(d, TAU - d);
    // Scale by radius so larger arcs penalize mismatch more.
    return angularDist * radius;
};

const curveIsNearlyStraight = (curve: BCurve): boolean => {
    const cps = curve.getControlPoints();
    if (cps.length < 2) return true;
    const a = cps[0];
    const b = cps[cps.length - 1];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const denom = Math.hypot(ab.x, ab.y);
    if (denom < 1e-6) return true; // Degenerate (all points on top of each other)

    // Max perpendicular distance of control points to the chord AB.
    // If small relative to chord length, treat as straight.
    let maxDist = 0;
    for (let i = 1; i < cps.length - 1; i++) {
        const p = cps[i];
        const ap = { x: p.x - a.x, y: p.y - a.y };
        const cross = Math.abs(ab.x * ap.y - ab.y * ap.x);
        const dist = cross / denom;
        if (dist > maxDist) maxDist = dist;
    }

    // Threshold tuned for world-space coordinates: allow tiny curvature jitter.
    return maxDist / denom < 0.002;
};

type ShadowRecord = {
    drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] };
    mesh: MeshSimple;
    /** True when from === to and elevation > 0 — position-only update is sufficient. */
    constantElevation: boolean;
    /** For constant-elevation entries, the pre-computed shadow length used with the position offset. */
    shadowLength: number;
    /**
     * For varying-elevation shadows: base vertex positions (curve ± ortho * hw,
     * no sun offset) stored flat [x0,y0, x1,y1, …] so sun-angle updates can
     * recompute vertices without re-evaluating the curve.
     */
    baseVerts?: Float32Array;
    /** Per-vertex-pair elevation factor (shadowLength / baseShadowLength) for sun-angle updates. */
    elevationFactors?: Float32Array;
};

const cutBezierCurveIntoEqualSegments = (curve: BCurve, segmentElevation: { from: number, to: number }, length: number) => {
    const segments: { point: Point, elevation: number }[] = [];
    const cps = curve.getControlPoints();
    segments.push({ point: cps[0], elevation: segmentElevation.from });
    const steps = Math.ceil(curve.fullLength / length);
    for (let i = 0; i <= steps; i++) {
        const percentage = i / steps;
        const point = curve.getPointbyPercentage(percentage);
        const elevation = segmentElevation.from + (segmentElevation.to - segmentElevation.from) * percentage;
        segments.push({ point, elevation });
    }
    return segments;
}

/** RGB components 0–255 for interpolation. */
export type Rgb = { r: number; g: number; b: number };

const rgbToHex = (rgb: Rgb): number =>
    (Math.round(rgb.r) << 16) | (Math.round(rgb.g) << 8) | Math.round(rgb.b);

/**
 * Linear interpolation between two RGB colors.
 * @param a - Start color
 * @param b - End color
 * @param t - Interpolation factor in [0, 1]
 * @returns Interpolated RGB
 */
export const interpolateRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
});

const findElevationColorStop = (elevation: number): Rgb => {
    const interval = findElevationInterval(elevation);
    if (interval === null) {
        return { r: 0, g: 0, b: 0 };
    }

    return interpolateRgb(getElevationColorRgb(interval.interval[0]), getElevationColorRgb(interval.interval[1]), interval.ratio);
};

/** Elevation colors as RGB (0–255) for interpolation. */
export const getElevationColorRgb = (elevation: ELEVATION): Rgb => {
    switch (elevation) {
        case ELEVATION.SUB_3:
            return { r: 255, g: 0, b: 0 };
        case ELEVATION.SUB_2:
            return { r: 255, g: 165, b: 0 };
        case ELEVATION.SUB_1:
            return { r: 255, g: 255, b: 0 };
        case ELEVATION.GROUND:
            return { r: 0, g: 255, b: 0 };
        case ELEVATION.ABOVE_1:
            return { r: 0, g: 255, b: 255 };
        case ELEVATION.ABOVE_2:
            return { r: 255, g: 0, b: 255 };
        case ELEVATION.ABOVE_3:
            return { r: 0, g: 0, b: 255 };
        default:
            return { r: 128, g: 128, b: 128 };
    }
};

/** Seeded RNG for deterministic procedural texture (mulberry32-style). */
function seededRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const getProjectionTypeColor = (type: ProjectionPositiveResult['hitType']): number => {
    switch (type) {
        case 'joint':
            return 0x3BA429;
        case 'curve':
            return 0xB23737;
        case 'edge':
            return 0x2711EE;
    }
};
