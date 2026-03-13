import { useCallback, useMemo, useState } from 'react';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import type L from 'leaflet';

import { BananaToolbar } from '@/components/toolbar';
import { MapTileLayer, MapTileLayerSync } from '@/components/map-tile-layer';
import { initApp } from '@/utils/init-app';

import '../App.css';

/**
 * Experimental page: banana app with a toggleable map tile layer underneath.
 */
export function ExpPage(): React.ReactNode {
    const [showMap, setShowMap] = useState(false);
    const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
    const handleMapDestroy = useCallback(() => setLeafletMap(null), []);

    const wrapperOption = useMemo(
        () => ({
            fullScreen: true,
            boundaries: {
                min: { x: -5000, y: -5000 },
                max: { x: 5000, y: 5000 },
            },
        }),
        [],
    );

    return (
        <div className="app" style={{ position: 'relative' }}>
            <MapTileLayer
                visible={showMap}
                onMapReady={setLeafletMap}
                onMapDestroy={handleMapDestroy}
            />
            <Wrapper
                option={wrapperOption}
                initFunction={initApp}
            >
                {showMap && leafletMap && (
                    <MapTileLayerSync leafletMap={leafletMap} />
                )}
                <ScrollBarDisplay />
                <BananaToolbar
                    showMap={showMap}
                    onToggleMap={() => setShowMap((s) => !s)}
                />
            </Wrapper>
        </div>
    );
}
