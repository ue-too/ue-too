import { useCallback, useState } from 'react';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import type L from 'leaflet';

import { BananaToolbar } from '@/components/toolbar';
import { MapTileLayer, MapTileLayerSync } from '@/components/map-tile-layer';
import { initApp } from '@/utils/init-app';

import './App.css';

const App = (): React.ReactNode => {
    const [showMap, setShowMap] = useState(false);
    const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
    const handleMapDestroy = useCallback(() => setLeafletMap(null), []);

    return (
        <div className="app" style={{ position: 'relative' }}>
            {showMap && (
                <MapTileLayer
                    onMapReady={setLeafletMap}
                    onMapDestroy={handleMapDestroy}
                />
            )}
            <Wrapper
                option={{
                    fullScreen: true,
                    boundaries: {
                        min: { x: -5000, y: -5000 },
                        max: { x: 5000, y: 5000 },
                    },
                }}
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
};

export default App;
