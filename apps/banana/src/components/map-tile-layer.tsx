import { LIGHT, layers } from '@protomaps/basemaps';
import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';
import { Info } from '@/assets/icons';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';

const USE_LOCAL_TILES = !!import.meta.env.VITE_LOCAL_TILES;

if (USE_LOCAL_TILES) {
    const pmtilesProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
}

/**
 * The map instance type exposed to consumers.
 */
export type MapInstance = maplibregl.Map;

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6_378_137;
const TAIPEI_LAT_RAD = (25.033 * Math.PI) / 180;

/**
 * The base zoom level where 1 tile pixel ≈ 1 meter at Taipei's latitude.
 * Computed for the 256 px tile convention used by the board's coordinate system.
 */
export const BASE_ZOOM = Math.log2(
    (EARTH_CIRCUMFERENCE * Math.cos(TAIPEI_LAT_RAD)) / 256
);

const ORIGIN_LNG = 121.5654;
const ORIGIN_LAT = 25.033;

/**
 * Maximum MapLibre zoom level. Vector tiles can overzoom past the tile
 * source's native max — geometries just render at a larger scale without
 * blurring, unlike raster tiles. MapLibre supports up to 24.
 */
const MAX_MAP_ZOOM = 21;

/**
 * Origin in MapLibre's normalised Mercator space ([0,1] × [0,1]).
 * Pre-computed once so every sync call is a cheap add + divide.
 */
const ORIGIN_MERC = maplibregl.MercatorCoordinate.fromLngLat({
    lng: ORIGIN_LNG,
    lat: ORIGIN_LAT,
});

/**
 * Number of 256 px-tile-convention pixels that span the full world at BASE_ZOOM.
 * Dividing a board-pixel offset by this value converts it to the [0,1] Mercator
 * coordinate space that MapLibre uses internally.
 */
const WORLD_SIZE_PX = 256 * Math.pow(2, BASE_ZOOM);

function syncBoardToMapLibre(
    map: maplibregl.Map,
    boardPosition: { x: number; y: number },
    boardZoom: number
): void {
    // Board pixels → normalised Mercator → LngLat
    const merc = new maplibregl.MercatorCoordinate(
        ORIGIN_MERC.x + boardPosition.x / WORLD_SIZE_PX,
        ORIGIN_MERC.y + boardPosition.y / WORLD_SIZE_PX,
        0
    );
    const center = merc.toLngLat();

    // Board zoom 1× = BASE_ZOOM in 256 px-tile convention.
    // MapLibre internally uses 512 px tiles, so its zoom is offset by −1.
    const mapZoom = Math.log2(boardZoom) + BASE_ZOOM - 1;
    const clampedZoom = Math.max(0, Math.min(MAX_MAP_ZOOM, mapZoom));

    map.jumpTo({ center, zoom: clampedZoom });
}

/**
 * Base URL for the Protomaps Cloudflare Worker. Serves vector tiles, fonts, and
 * sprites from a single domain. Set `VITE_TILES_BASE` to override.
 */
const TILES_BASE =
    import.meta.env.VITE_TILES_BASE ?? 'https://map.vntchang.dev';

const BUCKET_BASE = 'https://bucket.vntchang.dev';

const STYLE: maplibregl.StyleSpecification = {
    version: 8,
    glyphs: USE_LOCAL_TILES
        ? '/fonts/{fontstack}/{range}.pbf'
        : `${TILES_BASE}/fonts/{fontstack}/{range}.pbf`,
    sprite: USE_LOCAL_TILES
        ? `${window.location.origin}/sprites/v4/light`
        : `${TILES_BASE}/sprites/v4/light`,
    sources: {
        protomaps: {
            type: 'vector',
            url: USE_LOCAL_TILES
                ? 'pmtiles:///tiles/taipei.pmtiles'
                : `${TILES_BASE}/taipei/taipei.json`,
        },
    },
    layers: layers('protomaps', LIGHT, { lang: 'en' }),
};

/**
 * The visual map layer using MapLibre GL with PMTiles.
 * Renders vector tiles via WebGL for GPU-accelerated rendering.
 *
 * Must be placed as a **sibling before** the Wrapper so it sits behind the canvas.
 *
 * @example
 * ```tsx
 * const [map, setMap] = useState<MapInstance | null>(null);
 *
 * <MapTileLayer onMapReady={setMap} onMapDestroy={() => setMap(null)} />
 * <Wrapper ...>
 *     {map && <MapTileLayerSync map={map} />}
 * </Wrapper>
 * ```
 */
export function MapTileLayer({
    visible,
    onMapReady,
    onMapDestroy,
}: {
    visible: boolean;
    onMapReady: (map: MapInstance) => void;
    onMapDestroy: () => void;
}) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Create / destroy MapLibre map based on visibility
    useEffect(() => {
        if (!visible) {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                onMapDestroy();
            }
            return;
        }

        if (!mapContainerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: STYLE,
            center: [ORIGIN_LNG, ORIGIN_LAT],
            zoom: BASE_ZOOM,
            maxZoom: MAX_MAP_ZOOM,
            interactive: false,
            attributionControl: false,
            fadeDuration: 0,
            maxTileCacheSize: 50,
            maxTileCacheZoomLevels: 2,
            pixelRatio: 1,
        });

        map.on('load', () => {
            mapRef.current = map;
            onMapReady(map);
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                onMapDestroy();
            }
        };
    }, [visible, onMapReady, onMapDestroy]);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                visibility: visible ? 'visible' : 'hidden',
            }}
        >
            <div
                ref={mapContainerRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    filter: 'brightness(0.9) saturate(0.8)',
                }}
            />
            {visible && <MapAttribution />}
        </div>
    );
}

function MapAttribution() {
    const [open, setOpen] = useState(true);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                pointerEvents: 'auto',
            }}
        >
            {open && (
                <div
                    style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.75)',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 4,
                        padding: '3px 8px',
                    }}
                >
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'rgba(255,255,255,0.75)' }}
                    >
                        &copy; OpenStreetMap contributors
                    </a>
                    {' | '}
                    <a
                        href="https://protomaps.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'rgba(255,255,255,0.75)' }}
                    >
                        Protomaps
                    </a>
                </div>
            )}
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.75)',
                    padding: 0,
                    flexShrink: 0,
                }}
                aria-label="Toggle attribution"
            >
                <Info size={14} />
            </button>
        </div>
    );
}

/**
 * Camera sync component. Subscribes to board camera changes and syncs them
 * to the MapLibre GL map. Must be rendered inside a `Wrapper` (needs `usePixiCanvas`).
 *
 * Also clamps the board camera's max zoom so it doesn't exceed the map's
 * max (19), and restores the original max zoom on unmount.
 */
export function MapTileLayerSync({ map }: { map: MapInstance }) {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (!result.initialized || !result.success) return;
        const camera = result.components.camera;

        // Save original max zoom so we can restore it on unmount
        const originalMaxZoom = camera.zoomBoundaries?.max;

        // Clamp board zoom so map zoom never exceeds the vector tile max.
        // MapLibre zoom = log2(boardZoom) + BASE_ZOOM − 1, so
        // boardZoom_max = 2^(MAX_MAP_ZOOM − BASE_ZOOM + 1).
        const maxBoardZoom = Math.pow(2, MAX_MAP_ZOOM - BASE_ZOOM + 1);
        camera.setMaxZoomLevel(maxBoardZoom);

        syncBoardToMapLibre(map, camera.position, camera.zoomLevel);

        const unsubscribe = camera.on(
            'all',
            (
                _event: unknown,
                cameraState: {
                    position: { x: number; y: number };
                    zoomLevel: number;
                }
            ) => {
                syncBoardToMapLibre(
                    map,
                    cameraState.position,
                    cameraState.zoomLevel
                );
            }
        );

        return () => {
            unsubscribe();
            if (originalMaxZoom !== undefined) {
                camera.setMaxZoomLevel(originalMaxZoom);
            }
        };
    }, [result, map]);

    return null;
}
