import { Container, Graphics } from 'pixi.js';
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
export class WorldRenderSystem {

    private _mainContainer: Container;
    private _drawDataContainer: Container;
    private _drawableMap: Map<string, Container> = new Map();
    private _shadowMap: Map<string, { graphics: Graphics; elevation: ELEVATION }> = new Map();
    private _shadowContainerMap: Map<ELEVATION, Container> = new Map();

    get container(): Container {
        return this._mainContainer;
    }

    constructor() {
        this._mainContainer = new Container();
        this._drawDataContainer = new Container();
        this._drawDataContainer.sortableChildren = true;
        this._mainContainer.addChild(this._drawDataContainer);

        ELEVATION_VALUES.forEach((elevation, i) => {
            const container = new Container();
            container.zIndex = i * LAYERS_PER_ELEVATION;
            this._drawDataContainer.addChild(container);
            this._shadowContainerMap.set(elevation as ELEVATION, container);
        });
    }

    /**
     * Add a sibling container alongside the sorted draw data container.
     * Use for overlays like track offsets or UI elements that don't participate
     * in elevation-based sorting.
     */
    addOverlayContainer(container: Container): void {
        this._mainContainer.addChild(container);
    }

    removeOverlayContainer(container: Container): void {
        this._mainContainer.removeChild(container);
    }

    /** Add a drawable container to the elevation-sorted draw data container. */
    addDrawable(key: string, container: Container): void {
        this._drawableMap.set(key, container);
        this._drawDataContainer.addChild(container);
    }

    /**
     * Remove a drawable container. Returns the container so the caller can
     * decide whether to destroy it.
     */
    removeDrawable(key: string): Container | undefined {
        const container = this._drawableMap.get(key);
        if (container !== undefined) {
            this._drawDataContainer.removeChild(container);
            this._drawableMap.delete(key);
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
    addShadow(key: string, graphics: Graphics, elevation: ELEVATION): void {
        const shadowContainer = this._shadowContainerMap.get(elevation);
        if (shadowContainer !== undefined) {
            shadowContainer.addChild(graphics);
        }
        this._shadowMap.set(key, { graphics, elevation });
    }

    removeShadow(key: string): void {
        const shadow = this._shadowMap.get(key);
        if (shadow !== undefined) {
            this._shadowContainerMap.get(shadow.elevation)?.removeChild(shadow.graphics);
            shadow.graphics.destroy({ children: true });
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

    sortChildren(): void {
        this._drawDataContainer.sortChildren();
    }

    cleanup(): void {
        this._shadowMap.forEach(({ graphics, elevation }) => {
            this._shadowContainerMap.get(elevation)?.removeChild(graphics);
            graphics.destroy({ children: true });
        });
        this._shadowMap.clear();

        this._drawableMap.forEach(container => {
            this._drawDataContainer.removeChild(container);
            container.destroy({ children: true });
        });
        this._drawableMap.clear();

        this._drawDataContainer.destroy({ children: true });
        this._mainContainer.destroy({ children: true });
    }
}
