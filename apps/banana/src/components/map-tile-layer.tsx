import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers, LIGHT } from '@protomaps/basemaps';
import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

/**
 * The map instance type exposed to consumers.
 */
export type MapInstance = maplibregl.Map;

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6_378_137;
const TAIPEI_LAT_RAD = (25.0330 * Math.PI) / 180;

/**
 * The base zoom level where 1 tile pixel ≈ 1 meter at Taipei's latitude.
 * Computed for the 256 px tile convention used by the board's coordinate system.
 */
export const BASE_ZOOM =
    Math.log2((EARTH_CIRCUMFERENCE * Math.cos(TAIPEI_LAT_RAD)) / 256);

const ORIGIN_LNG = 121.5654;
const ORIGIN_LAT = 25.0330;

/**
 * Origin in MapLibre's normalised Mercator space ([0,1] × [0,1]).
 * Pre-computed once so every sync call is a cheap add + divide.
 */
const ORIGIN_MERC = maplibregl.MercatorCoordinate.fromLngLat(
    { lng: ORIGIN_LNG, lat: ORIGIN_LAT },
);

/**
 * Number of 256 px-tile-convention pixels that span the full world at BASE_ZOOM.
 * Dividing a board-pixel offset by this value converts it to the [0,1] Mercator
 * coordinate space that MapLibre uses internally.
 */
const WORLD_SIZE_PX = 256 * Math.pow(2, BASE_ZOOM);

function syncBoardToMapLibre(
    map: maplibregl.Map,
    boardPosition: { x: number; y: number },
    boardZoom: number,
): void {
    // Board pixels → normalised Mercator → LngLat
    const merc = new maplibregl.MercatorCoordinate(
        ORIGIN_MERC.x + boardPosition.x / WORLD_SIZE_PX,
        ORIGIN_MERC.y + boardPosition.y / WORLD_SIZE_PX,
        0,
    );
    const center = merc.toLngLat();

    // Board zoom 1× = BASE_ZOOM in 256 px-tile convention.
    // MapLibre internally uses 512 px tiles, so its zoom is offset by −1.
    const mapZoom = Math.log2(boardZoom) + BASE_ZOOM - 1;
    const clampedZoom = Math.max(0, Math.min(19, mapZoom));

    map.jumpTo({ center, zoom: clampedZoom });
}

// Register the PMTiles protocol once globally.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

/**
 * PMTiles URL. Set `VITE_PMTILES_URL` for production (e.g. a Cloudflare R2 URL).
 * Falls back to local `/tiles/taipei.pmtiles` for development.
 */
const PMTILES_URL =
    import.meta.env.VITE_PMTILES_URL ?? 'https://bucket.vntchang.dev/taipei/taipei.pmtiles';
const STYLE: maplibregl.StyleSpecification = {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
        protomaps: {
            type: 'vector',
            url: `pmtiles://${PMTILES_URL}`,
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
            interactive: false,
            attributionControl: false,
            fadeDuration: 0,
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
            {visible && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        zIndex: 1000,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.6)',
                        pointerEvents: 'auto',
                    }}
                >
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                        &copy; OpenStreetMap contributors
                    </a>
                    {' | '}
                    <a
                        href="https://protomaps.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                        Protomaps
                    </a>
                </div>
            )}
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

        // Clamp board zoom so map zoom never exceeds max (19).
        // MapLibre zoom = log2(boardZoom) + BASE_ZOOM − 1, so
        // boardZoom_max = 2^(19 − BASE_ZOOM + 1).
        const MAX_MAP_ZOOM = 19;
        const maxBoardZoom = Math.pow(2, MAX_MAP_ZOOM - BASE_ZOOM + 1);
        camera.setMaxZoomLevel(maxBoardZoom);

        syncBoardToMapLibre(map, camera.position, camera.zoomLevel);

        const unsubscribe = camera.on(
            'all',
            (_event: unknown, cameraState: { position: { x: number; y: number }; zoomLevel: number }) => {
                syncBoardToMapLibre(map, cameraState.position, cameraState.zoomLevel);
            },
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
