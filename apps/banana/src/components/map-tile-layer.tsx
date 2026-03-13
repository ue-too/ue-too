import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

/**
 * A tile layer that prevents white flashes during externally-driven zoom.
 *
 * Removes the `viewprereset` → `_invalidateAll()` binding so tile updates
 * flow through `_pruneTiles()` → `_retainParent()`, keeping lower-zoom
 * tiles visible as a CSS-scaled background while new tiles load.
 */
const RetainingTileLayer = L.TileLayer.extend({
    getEvents: function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events = (L.TileLayer.prototype as any).getEvents.call(this);
        delete events.viewprereset;
        return events;
    },
});

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6_378_137;
const TAIPEI_LAT_RAD = (25.0330 * Math.PI) / 180;

/**
 * The base Leaflet zoom level where 1 tile pixel ≈ 1 meter at Taipei's latitude.
 */
export const BASE_ZOOM =
    Math.log2((EARTH_CIRCUMFERENCE * Math.cos(TAIPEI_LAT_RAD)) / 256);

const ORIGIN_LATLNG = L.latLng(25.0330, 121.5654);
const ORIGIN_PIXEL = L.CRS.EPSG3857.latLngToPoint(ORIGIN_LATLNG, BASE_ZOOM);

function syncBoardToLeaflet(
    map: L.Map,
    boardPosition: { x: number; y: number },
    boardZoom: number,
): void {
    const leafletZoom = Math.log2(boardZoom) + BASE_ZOOM;
    const clampedZoom = Math.max(1, Math.min(19, leafletZoom));

    const absolutePixel: L.PointExpression = [
        ORIGIN_PIXEL.x + boardPosition.x,
        ORIGIN_PIXEL.y + boardPosition.y,
    ];
    const centerLatLng = map.unproject(absolutePixel, BASE_ZOOM);

    map.setView(centerLatLng, clampedZoom, { animate: false });
}

/**
 * The visual Leaflet map layer. Renders the map container div and attribution.
 * Must be placed as a **sibling before** the Wrapper so it sits behind the canvas.
 *
 * Communicates with {@link MapTileLayerSync} via the `onMapReady` / `onMapDestroy`
 * callbacks which pass the Leaflet map instance.
 *
 * @example
 * ```tsx
 * const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
 *
 * <MapTileLayer onMapReady={setLeafletMap} onMapDestroy={() => setLeafletMap(null)} />
 * <Wrapper ...>
 *     {leafletMap && <MapTileLayerSync leafletMap={leafletMap} />}
 * </Wrapper>
 * ```
 */
export function MapTileLayer({
    onMapReady,
    onMapDestroy,
}: {
    onMapReady: (map: L.Map) => void;
    onMapDestroy: () => void;
}) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current || leafletMapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: ORIGIN_LATLNG,
            zoom: BASE_ZOOM,
            zoomSnap: 0,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            boxZoom: false,
            keyboard: false,
            zoomControl: false,
            attributionControl: false,
        });

        new RetainingTileLayer(
            'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            {
                maxZoom: 19,
                keepBuffer: 4,
            },
        ).addTo(map);

        leafletMapRef.current = map;
        onMapReady(map);

        return () => {
            map.remove();
            leafletMapRef.current = null;
            onMapDestroy();
        };
    }, [onMapReady, onMapDestroy]);

    return (
        <>
            <div
                ref={mapContainerRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    filter: 'brightness(0.9) saturate(0.8)',
                }}
            />
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
                    href="https://carto.com/attributions"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                    &copy; CARTO
                </a>
            </div>
        </>
    );
}

/**
 * Camera sync component. Subscribes to board camera changes and syncs them
 * to the Leaflet map. Must be rendered inside a `Wrapper` (needs `usePixiCanvas`).
 *
 * Also clamps the board camera's max zoom so it doesn't exceed Leaflet's max (19).
 */
export function MapTileLayerSync({ leafletMap }: { leafletMap: L.Map }) {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (!result.initialized || !result.success) return;
        const camera = result.components.camera;

        // Clamp board zoom so leaflet zoom never exceeds its max (19).
        const MAX_LEAFLET_ZOOM = 19;
        const maxBoardZoom = Math.pow(2, MAX_LEAFLET_ZOOM - BASE_ZOOM);
        camera.setMaxZoomLevel(maxBoardZoom);

        syncBoardToLeaflet(leafletMap, camera.position, camera.zoomLevel);

        const unsubscribe = camera.on('all', (_event, cameraState) => {
            syncBoardToLeaflet(
                leafletMap,
                cameraState.position,
                cameraState.zoomLevel,
            );
        });

        return () => {
            unsubscribe();
        };
    }, [result, leafletMap]);

    return null;
}
