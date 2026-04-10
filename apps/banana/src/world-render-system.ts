import { Container } from 'pixi.js';
import { ELEVATION, ELEVATION_VALUES } from './trains/tracks/types';
import { LEVEL_HEIGHT } from './trains/tracks/constants';

const getElevationIndex = (elevation: ELEVATION): number => {
    const i = ELEVATION_VALUES.indexOf(elevation);
    return i >= 0 ? i : 0;
};

/** Use upper bound when between levels so higher-elevation shadow draws on top of lower-elevation content. */
const getElevationForLayer = (
    interval: { interval: [ELEVATION, ELEVATION]; ratio: number } | null
): ELEVATION =>
    interval
        ? interval.ratio > 0
            ? interval.interval[1]
            : interval.interval[0]
        : ELEVATION.GROUND;

/**
 * Find which two ELEVATION levels a raw elevation value falls between.
 *
 * @param elevation - Raw elevation in world units (e.g. 10 for ABOVE_1 when LEVEL_HEIGHT=10)
 * @returns The bounding ELEVATION interval and interpolation ratio, or null if out of range
 */
export const findElevationInterval = (elevation: number): { interval: [ELEVATION, ELEVATION]; ratio: number } | null => {
    const elevations = Object.values(ELEVATION).filter((v): v is number => typeof v === "number");
    let left = 0;
    let right = elevations.length - 1;
    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        const midValue = elevations[mid];
        if (midValue * LEVEL_HEIGHT <= elevation && mid + 1 < elevations.length && elevations[mid + 1] * LEVEL_HEIGHT >= elevation) {
            return { interval: [elevations[mid], elevations[mid + 1]], ratio: (elevation - midValue * LEVEL_HEIGHT) / (elevations[mid + 1] * LEVEL_HEIGHT - midValue * LEVEL_HEIGHT) };
        } else if (elevation < midValue * LEVEL_HEIGHT) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return null;
};

/**
 * Sublayer types within each elevation band.
 *
 * Draw order (bottom to top): bed → drawable → rail → onTrack → catenary → shadow.
 *
 * Shadow is drawn last within its band so a higher track's shadow (placed in
 * the band one level below the track) paints over tracks/rails at that lower
 * level. Terrain occlusion for the next band still hides it because occlusion
 * containers sit between bands in the parent z-order.
 */
export type BandSublayer = 'drawable' | 'rail' | 'onTrack' | 'catenary';

/** Z-index constants for band sublayers. Shadow and bed are shared containers; the rest are sortable. */
const SUBLAYER_BED = 0;
const SUBLAYER_DRAWABLE = 1;
const SUBLAYER_RAIL = 2;
const SUBLAYER_ON_TRACK = 3;
const SUBLAYER_CATENARY = 4;
const SUBLAYER_SHADOW = 5;

const SUBLAYER_MAP: Record<BandSublayer, number> = {
    drawable: SUBLAYER_DRAWABLE,
    rail: SUBLAYER_RAIL,
    onTrack: SUBLAYER_ON_TRACK,
    catenary: SUBLAYER_CATENARY,
};

/**
 * An elevation band groups all render layers for a single elevation level.
 *
 * Each sublayer is a separate Container with its own z-index space,
 * so there is no hard cap on the number of items per sublayer.
 */
type ElevationBand = {
    container: Container;
    shadow: Container;
    bed: Container;
    drawable: Container;
    rail: Container;
    onTrack: Container;
    catenary: Container;
};

/**
 * Generic render system that manages elevation-based draw ordering for all
 * world objects (tracks, buildings, trains, etc.).
 *
 * Objects are organized into elevation bands. Each band contains sublayer
 * containers (shadow, bed, drawable, rail, onTrack, catenary) that enforce
 * draw order within the band. Band containers are sorted relative to each
 * other so higher-elevation content draws on top of lower-elevation content.
 *
 * Sub-renderers (TrackRenderSystem, BuildingRenderSystem, etc.) create
 * their own Graphics/Containers and register them here for unified draw ordering.
 */
/** Draw order (bottom to top): below (bands) → overlays. */
const Z_INDEX_BELOW = 0;
const Z_INDEX_OVERLAYS = 3;

export class WorldRenderSystem {

    private _mainContainer: Container;
    /** Contains all elevation band containers. */
    private _drawDataBelow: Container;
    /** Non-banded drawables (previews, etc.) keyed by string. */
    private _drawableMap: Map<string, Container> = new Map();
    /** Shadow items keyed by string. */
    private _shadowMap: Map<string, { container: Container; elevation: ELEVATION }> = new Map();
    /** Bed items keyed by string (shared per elevation, renders before rails). */
    private _bedMap: Map<string, { container: Container; elevation: ELEVATION }> = new Map();
    /** Band items keyed by string. */
    private _bandItemMap: Map<string, { container: Container; bandIndex: number; sublayer: BandSublayer }> = new Map();
    /** Elevation bands indexed by band index. */
    private _bands: ElevationBand[] = [];
    /** Map from ELEVATION enum value to band index. */
    private _elevationToBandIndex: Map<ELEVATION, number> = new Map();

    /** Container for the base terrain visual (shading + contour lines). Renders below all bands. */
    private _terrainBaseContainer: Container;
    /**
     * Per-band terrain occlusion containers. Each sits between band[i-1] and band[i]
     * in the z-order, drawing opaque terrain to hide lower-elevation content.
     */
    private _terrainOcclusionContainers: Container[] = [];

    get container(): Container {
        return this._mainContainer;
    }

    /** Container for the base terrain layer (rendered below all elevation bands). */
    get terrainBaseContainer(): Container {
        return this._terrainBaseContainer;
    }

    /**
     * Get the terrain occlusion container for a given band index.
     * Content added here renders between band[index-1] and band[index],
     * hiding tracks at lower elevations where terrain is higher.
     *
     * @param bandIndex - Elevation band index (0 to bands.length - 1)
     */
    getTerrainOcclusionContainer(bandIndex: number): Container | undefined {
        return this._terrainOcclusionContainers[bandIndex];
    }

    /** Number of elevation bands. */
    get bandCount(): number {
        return this._bands.length;
    }

    constructor() {
        this._mainContainer = new Container();
        this._mainContainer.sortableChildren = true;
        this._drawDataBelow = new Container();
        this._drawDataBelow.sortableChildren = true;
        this._drawDataBelow.zIndex = Z_INDEX_BELOW;
        this._mainContainer.addChild(this._drawDataBelow);

        // Terrain base container renders below all elevation bands
        this._terrainBaseContainer = new Container();
        this._terrainBaseContainer.zIndex = -1;
        this._terrainBaseContainer.sortableChildren = true;
        this._drawDataBelow.addChild(this._terrainBaseContainer);

        ELEVATION_VALUES.forEach((elevation, i) => {
            // Terrain occlusion container sits between band[i-1] and band[i]
            const occlusionContainer = new Container();
            occlusionContainer.zIndex = i - 0.5;
            this._drawDataBelow.addChild(occlusionContainer);
            this._terrainOcclusionContainers.push(occlusionContainer);

            const band = this._createBand(i);
            this._drawDataBelow.addChild(band.container);
            this._bands.push(band);
            this._elevationToBandIndex.set(elevation as ELEVATION, i);
        });
    }

    private _createBand(bandIndex: number): ElevationBand {
        const bandContainer = new Container();
        bandContainer.sortableChildren = true;
        bandContainer.zIndex = bandIndex;

        const shadow = new Container();
        shadow.zIndex = SUBLAYER_SHADOW;
        bandContainer.addChild(shadow);

        const bed = new Container();
        bed.zIndex = SUBLAYER_BED;
        bandContainer.addChild(bed);

        const drawable = new Container();
        drawable.sortableChildren = true;
        drawable.zIndex = SUBLAYER_DRAWABLE;
        bandContainer.addChild(drawable);

        const rail = new Container();
        rail.sortableChildren = true;
        rail.zIndex = SUBLAYER_RAIL;
        bandContainer.addChild(rail);

        const onTrack = new Container();
        onTrack.sortableChildren = true;
        onTrack.zIndex = SUBLAYER_ON_TRACK;
        bandContainer.addChild(onTrack);

        const catenary = new Container();
        catenary.sortableChildren = true;
        catenary.zIndex = SUBLAYER_CATENARY;
        bandContainer.addChild(catenary);

        return { container: bandContainer, shadow, bed, drawable, rail, onTrack, catenary };
    }

    /**
     * Add a sibling container alongside the draw data layers.
     *
     * @param options.zIndex - Custom z-index. Omit for overlays (drawn on top).
     */
    addOverlayContainer(container: Container, options?: { zIndex?: number }): void {
        container.zIndex = options?.zIndex ?? Z_INDEX_OVERLAYS;
        this._mainContainer.addChild(container);
        this._mainContainer.sortChildren();
    }

    removeOverlayContainer(container: Container): void {
        this._mainContainer.removeChild(container);
    }

    // -------------------------------------------------------------------------
    // Non-banded drawables (previews, ephemeral items)
    // -------------------------------------------------------------------------

    /**
     * Add a non-banded drawable directly to the below layer.
     *
     * Use this for ephemeral items (previews) that don't belong to a
     * specific elevation band. For elevation-aware items, use {@link addToBand}.
     */
    addDrawable(key: string, container: Container): void {
        this._drawableMap.set(key, container);
        this._drawDataBelow.addChild(container);
    }

    getDrawable(key: string): Container | undefined {
        return this._drawableMap.get(key) ?? this._bandItemMap.get(key)?.container;
    }

    /**
     * Remove a non-banded drawable. Returns the container so the caller
     * can decide whether to destroy it.
     */
    removeDrawable(key: string): Container | undefined {
        const container = this._drawableMap.get(key);
        if (container !== undefined) {
            this._drawDataBelow.removeChild(container);
            this._drawableMap.delete(key);
        }
        return container;
    }

    setDrawableZIndex(key: string, zIndex: number): void {
        const container = this._drawableMap.get(key);
        if (container !== undefined) {
            container.zIndex = zIndex;
        }
    }

    // -------------------------------------------------------------------------
    // Band-based items (tracks, buildings, stations, trains, catenary)
    // -------------------------------------------------------------------------

    /**
     * Add a container to a specific elevation band and sublayer.
     *
     * If the key already exists, the container is moved to the new band/sublayer
     * (efficient reparenting for items that change elevation, e.g. moving trains).
     *
     * @param key - Unique identifier for the item
     * @param container - The pixi container to add
     * @param bandIndex - Elevation band index (from {@link getElevationBandIndex})
     * @param sublayer - Which sublayer within the band
     */
    addToBand(key: string, container: Container, bandIndex: number, sublayer: BandSublayer): void {
        const existing = this._bandItemMap.get(key);
        if (existing) {
            if (existing.bandIndex === bandIndex && existing.sublayer === sublayer) {
                return; // Already in the right place
            }
            const oldBand = this._bands[existing.bandIndex];
            if (oldBand) {
                oldBand[existing.sublayer].removeChild(existing.container);
            }
        }

        const band = this._bands[bandIndex];
        if (band) {
            band[sublayer].addChild(container);
        }
        this._bandItemMap.set(key, { container, bandIndex, sublayer });
    }

    /**
     * Remove a band item. Returns the container so the caller can destroy it.
     */
    removeFromBand(key: string): Container | undefined {
        const item = this._bandItemMap.get(key);
        if (item === undefined) return undefined;

        const band = this._bands[item.bandIndex];
        if (band) {
            band[item.sublayer].removeChild(item.container);
        }
        this._bandItemMap.delete(key);
        return item.container;
    }

    /**
     * Set the draw order of a band item within its sublayer.
     */
    setOrderInBand(key: string, order: number): void {
        const item = this._bandItemMap.get(key);
        if (item !== undefined) {
            item.container.zIndex = order;
        }
    }

    /**
     * Get the band index of an item added via {@link addToBand}.
     */
    getBandIndex(key: string): number | undefined {
        return this._bandItemMap.get(key)?.bandIndex;
    }

    // -------------------------------------------------------------------------
    // Shadow (shared container per elevation)
    // -------------------------------------------------------------------------

    /**
     * Add shadow graphics to the shadow container at the given elevation level.
     *
     * For tracks: use the track's top elevation (shadow falls just below the track).
     * For buildings: use one level above the base elevation (shadow falls on
     * the ground next to the building, below elevated objects).
     */
    addShadow(key: string, container: Container, elevation: ELEVATION): void {
        const bandIndex = this._elevationToBandIndex.get(elevation);
        if (bandIndex !== undefined) {
            this._bands[bandIndex].shadow.addChild(container);
        }
        this._shadowMap.set(key, { container, elevation });
    }

    removeShadow(key: string): void {
        const shadow = this._shadowMap.get(key);
        if (shadow !== undefined) {
            const bandIndex = this._elevationToBandIndex.get(shadow.elevation);
            if (bandIndex !== undefined) {
                this._bands[bandIndex].shadow.removeChild(shadow.container);
            }
            shadow.container.destroy({ children: true });
            this._shadowMap.delete(key);
        }
    }

    // -------------------------------------------------------------------------
    // Bed (shared container per elevation)
    // -------------------------------------------------------------------------

    /**
     * Add a bed container to the shared bed layer at the given elevation.
     *
     * All bed items at the same elevation render together before any track
     * drawables, preventing one track's bed from covering another track's
     * rails at junctions.
     */
    addBed(key: string, container: Container, elevation: ELEVATION): void {
        const bandIndex = this._elevationToBandIndex.get(elevation);
        if (bandIndex !== undefined) {
            this._bands[bandIndex].bed.addChild(container);
        }
        this._bedMap.set(key, { container, elevation });
    }

    removeBed(key: string): void {
        const bed = this._bedMap.get(key);
        if (bed !== undefined) {
            const bandIndex = this._elevationToBandIndex.get(bed.elevation);
            if (bandIndex !== undefined) {
                this._bands[bandIndex].bed.removeChild(bed.container);
            }
            bed.container.destroy({ children: true });
            this._bedMap.delete(key);
        }
    }

    // -------------------------------------------------------------------------
    // Elevation helpers
    // -------------------------------------------------------------------------

    /**
     * Map a raw elevation value (world units) to the elevation band index
     * used for z-ordering.
     */
    getElevationBandIndex(rawElevation: number): number {
        const interval = findElevationInterval(rawElevation);
        const elevation = getElevationForLayer(interval);
        return getElevationIndex(elevation);
    }

    /**
     * Resolve a raw elevation value to the ELEVATION enum level.
     * Useful for determining which shadow/bed container to use.
     */
    resolveElevationLevel(rawElevation: number): ELEVATION {
        const interval = findElevationInterval(rawElevation);
        return getElevationForLayer(interval);
    }

    // -------------------------------------------------------------------------
    // Sort / cleanup
    // -------------------------------------------------------------------------

    sortChildren(): void {
        for (const band of this._bands) {
            band.drawable.sortChildren();
            band.rail.sortChildren();
            band.onTrack.sortChildren();
            band.catenary.sortChildren();
        }
        this._drawDataBelow.sortChildren();
    }

    cleanup(): void {
        this._shadowMap.forEach(({ container, elevation }) => {
            const bandIndex = this._elevationToBandIndex.get(elevation);
            if (bandIndex !== undefined) {
                this._bands[bandIndex].shadow.removeChild(container);
            }
            container.destroy({ children: true });
        });
        this._shadowMap.clear();

        this._bedMap.forEach(({ container, elevation }) => {
            const bandIndex = this._elevationToBandIndex.get(elevation);
            if (bandIndex !== undefined) {
                this._bands[bandIndex].bed.removeChild(container);
            }
            container.destroy({ children: true });
        });
        this._bedMap.clear();

        this._bandItemMap.forEach(({ container, bandIndex, sublayer }) => {
            const band = this._bands[bandIndex];
            if (band) {
                band[sublayer].removeChild(container);
            }
            container.destroy({ children: true });
        });
        this._bandItemMap.clear();

        this._drawableMap.forEach((container) => {
            this._drawDataBelow.removeChild(container);
            container.destroy({ children: true });
        });
        this._drawableMap.clear();

        this._terrainBaseContainer.destroy({ children: true });
        for (const oc of this._terrainOcclusionContainers) {
            oc.destroy({ children: true });
        }
        this._terrainOcclusionContainers = [];

        this._drawDataBelow.destroy({ children: true });
        this._mainContainer.destroy({ children: true });
    }
}
