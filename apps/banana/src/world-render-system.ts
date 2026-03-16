import { Container } from 'pixi.js';
import { ELEVATION, ELEVATION_VALUES } from './trains/tracks/types';
import { LEVEL_HEIGHT } from './trains/tracks/constants';

/** zIndex range per elevation so shadow at elevation E draws after segments at elevations < E. */
const LAYERS_PER_ELEVATION = 1000;

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
 * Generic render system that manages elevation-based draw ordering and shadows
 * for all world objects (tracks, buildings, etc.).
 *
 * Objects are sorted into elevation bands. Within each band, shadow containers
 * draw first (zIndex = bandIndex * LAYERS_PER_ELEVATION), followed by drawable
 * containers (zIndex = bandIndex * LAYERS_PER_ELEVATION + 1 + n).
 *
 * Sub-renderers (TrackRenderSystem, future BuildingRenderSystem, etc.) create
 * their own Graphics/Containers and register them here for unified draw ordering.
 */
/** Draw order (bottom to top): below (tracks, rails, shadows, buildings) → above (bogies) → other overlays. */
const Z_INDEX_BELOW = 0;
const Z_INDEX_ABOVE = 2;
const Z_INDEX_OVERLAYS = 3;

/**
 * Within each elevation band (LAYERS_PER_ELEVATION slots), the sub-ranges are:
 *   0          : shadow container
 *   1..499     : ballast / track drawables
 *   500..999   : rail overlay drawables (above ballast, below next band's shadows)
 */
const RAIL_OFFSET_WITHIN_BAND = 500;

export type DrawableLayer = 'below' | 'above';

export class WorldRenderSystem {

    private _mainContainer: Container;
    /** Tracks, shadows, buildings. Draws below offset rails. */
    private _drawDataBelow: Container;
    /** Bogies and other on-track objects. Draws above offset rails. */
    private _drawDataAbove: Container;
    private _drawableMap: Map<string, Container> = new Map();
    private _drawableLayer: Map<string, DrawableLayer> = new Map();
    private _shadowMap: Map<string, { container: Container; elevation: ELEVATION }> = new Map();
    private _shadowContainerMap: Map<ELEVATION, Container> = new Map();

    /** Number of track drawables registered in each elevation band (updated by sub-renderers after reindexing). */
    private _bandTrackCount: Map<number, number> = new Map();

    get container(): Container {
        return this._mainContainer;
    }

    constructor() {
        this._mainContainer = new Container();
        this._mainContainer.sortableChildren = true;
        this._drawDataBelow = new Container();
        this._drawDataBelow.sortableChildren = true;
        this._drawDataBelow.zIndex = Z_INDEX_BELOW;
        this._mainContainer.addChild(this._drawDataBelow);
        this._drawDataAbove = new Container();
        this._drawDataAbove.sortableChildren = true;
        this._drawDataAbove.zIndex = Z_INDEX_ABOVE;
        this._mainContainer.addChild(this._drawDataAbove);

        ELEVATION_VALUES.forEach((elevation, i) => {
            const container = new Container();
            container.zIndex = i * LAYERS_PER_ELEVATION;
            this._drawDataBelow.addChild(container);
            this._shadowContainerMap.set(elevation as ELEVATION, container);
        });
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

    /**
     * Add a drawable to the elevation-sorted layers.
     *
     * @param options.layer - 'below' (default): tracks, buildings, shadows. 'above': bogies and
     *   other on-track objects, drawn above offset rails.
     */
    addDrawable(key: string, container: Container, options?: { layer?: DrawableLayer }): void {
        const layer = options?.layer ?? 'below';
        this._drawableMap.set(key, container);
        this._drawableLayer.set(key, layer);
        const parent = layer === 'below' ? this._drawDataBelow : this._drawDataAbove;
        parent.addChild(container);
    }

    /**
     * Get a drawable container by key (e.g. for visibility or other updates).
     */
    getDrawable(key: string): Container | undefined {
        return this._drawableMap.get(key);
    }

    /**
     * Remove a drawable container. Returns the container so the caller can
     * decide whether to destroy it.
     */
    removeDrawable(key: string): Container | undefined {
        const container = this._drawableMap.get(key);
        const layer = this._drawableLayer.get(key);
        if (container !== undefined && layer !== undefined) {
            const parent = layer === 'below' ? this._drawDataBelow : this._drawDataAbove;
            parent.removeChild(container);
            this._drawableMap.delete(key);
            this._drawableLayer.delete(key);
        }
        return container;
    }

    getDrawableZIndex(key: string): number {
        const container = this._drawableMap.get(key);
        return container?.zIndex ?? 0;
    }

    setDrawableZIndex(key: string, zIndex: number): void {
        const container = this._drawableMap.get(key);
        if (container !== undefined) {
            container.zIndex = zIndex;
        }
    }

    /**
     * Add shadow graphics to the shadow container at the given elevation level.
     *
     * For tracks: use the track's top elevation (shadow falls just below the track).
     * For buildings: use one level above the base elevation (shadow falls on
     * the ground next to the building, below elevated objects).
     */
    addShadow(key: string, container: Container, elevation: ELEVATION): void {
        const shadowContainer = this._shadowContainerMap.get(elevation);
        if (shadowContainer !== undefined) {
            shadowContainer.addChild(container);
        }
        this._shadowMap.set(key, { container, elevation });
    }

    removeShadow(key: string): void {
        const shadow = this._shadowMap.get(key);
        if (shadow !== undefined) {
            this._shadowContainerMap.get(shadow.elevation)?.removeChild(shadow.container);
            shadow.container.destroy({ children: true });
            this._shadowMap.delete(key);
        }
    }

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
     * Useful for determining which shadow container to use.
     */
    resolveElevationLevel(rawElevation: number): ELEVATION {
        const interval = findElevationInterval(rawElevation);
        return getElevationForLayer(interval);
    }

    /**
     * Compute the z-index for a drawable in the given elevation band.
     *
     * @param elevationBandIndex - Index of the elevation band (from {@link getElevationBandIndex})
     * @param orderWithinBand - Order of this drawable within the band (0-based)
     */
    computeZIndex(elevationBandIndex: number, orderWithinBand: number): number {
        return elevationBandIndex * LAYERS_PER_ELEVATION + 1 + orderWithinBand;
    }

    /**
     * Compute the z-index for a rail overlay in the given elevation band.
     * Rails sit above ballast drawables but below the next elevation band's shadows.
     */
    computeRailZIndex(elevationBandIndex: number, orderWithinBand: number): number {
        return elevationBandIndex * LAYERS_PER_ELEVATION + RAIL_OFFSET_WITHIN_BAND + orderWithinBand;
    }

    /** Add a rail container to the elevation-sorted below layer. */
    addRail(container: Container): void {
        this._drawDataBelow.addChild(container);
    }

    /** Remove a rail container from the below layer. */
    removeRail(container: Container): void {
        this._drawDataBelow.removeChild(container);
    }

    /**
     * Record the number of track drawables in a given elevation band.
     * Call after reindexing so that {@link computeOnTrackObjectZIndex} can
     * place on-track objects (e.g. train bogies) above all tracks in the band.
     *
     * @param bandIndex - Elevation band index (from {@link getElevationBandIndex})
     * @param count - Total number of track drawables in this band
     */
    setBandTrackCount(bandIndex: number, count: number): void {
        this._bandTrackCount.set(bandIndex, count);
    }

    /**
     * Compute a z-index for an on-track object (e.g. a train bogie) that is
     * guaranteed to be above every track drawable in the same elevation band.
     *
     * The returned value leaves a gap of 2 above the highest track so that
     * callers can place sub-layers (e.g. car bodies at bogieZ − 1) that are
     * still above all tracks.
     *
     * @param bandIndex - Elevation band index (from {@link getElevationBandIndex})
     * @returns A z-index above all track drawables in that band
     */
    computeOnTrackObjectZIndex(bandIndex: number): number {
        const trackCount = this._bandTrackCount.get(bandIndex) ?? 0;
        return bandIndex * LAYERS_PER_ELEVATION + RAIL_OFFSET_WITHIN_BAND + trackCount + 2;
    }

    /**
     * Compute a z-index for catenary (overhead wire) elements that renders
     * above trains in the same elevation band.
     */
    computeCatenaryZIndex(bandIndex: number): number {
        const trackCount = this._bandTrackCount.get(bandIndex) ?? 0;
        // +10 above on-track objects (+2) to leave room for car bodies etc.
        return bandIndex * LAYERS_PER_ELEVATION + RAIL_OFFSET_WITHIN_BAND + trackCount + 10;
    }

    sortChildren(): void {
        this._drawDataBelow.sortChildren();
        this._drawDataAbove.sortChildren();
    }

    cleanup(): void {
        this._shadowMap.forEach(({ container, elevation }) => {
            this._shadowContainerMap.get(elevation)?.removeChild(container);
            container.destroy({ children: true });
        });
        this._shadowMap.clear();

        this._drawableMap.forEach((container, key) => {
            const layer = this._drawableLayer.get(key);
            const parent = layer === 'above' ? this._drawDataAbove : this._drawDataBelow;
            parent.removeChild(container);
            container.destroy({ children: true });
        });
        this._drawableMap.clear();
        this._drawableLayer.clear();
        this._bandTrackCount.clear();

        this._drawDataBelow.destroy({ children: true });
        this._drawDataAbove.destroy({ children: true });
        this._mainContainer.destroy({ children: true });
    }
}
