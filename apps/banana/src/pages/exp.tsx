import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { useCallback, useMemo, useState } from 'react';

import {
    type MapInstance,
    MapTileLayer,
    MapTileLayerSync,
} from '@/components/map-tile-layer';
import { BananaToolbar } from '@/components/toolbar';
import { TimeDisplay } from '@/components/toolbar/TimeDisplay';
import { initApp } from '@/utils/init-app';

import '../App.css';

/**
 * Experimental page: banana app with a toggleable map tile layer underneath.
 */
export function ExpPage(): React.ReactNode {
    const [showMap, setShowMap] = useState(false);
    const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
    const handleMapDestroy = useCallback(() => setMapInstance(null), []);

    const wrapperOption = useMemo(
        () => ({
            fullScreen: true,
            boundaries: {
                min: { x: -5000, y: -5000 },
                max: { x: 5000, y: 5000 },
            },
        }),
        []
    );

    return (
        <div className="app" style={{ position: 'relative' }}>
            <MapTileLayer
                visible={showMap}
                onMapReady={setMapInstance}
                onMapDestroy={handleMapDestroy}
            />
            <Wrapper option={wrapperOption} initFunction={initApp}>
                {showMap && mapInstance && (
                    <MapTileLayerSync map={mapInstance} />
                )}
                <ScrollBarDisplay />
                <BananaToolbar
                    showMap={showMap}
                    onToggleMap={() => setShowMap(s => !s)}
                />
                <TimeDisplay />
            </Wrapper>
        </div>
    );
}
