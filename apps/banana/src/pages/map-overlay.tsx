import { useCallback, useState } from 'react';
import { Graphics, Text } from 'pixi.js';
import {
    Wrapper,
    type ResolvedComponents,
} from '@ue-too/board-pixi-react-integration';
import {
    baseInitApp,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';
import { MapTileLayer, MapTileLayerSync, BASE_ZOOM, type MapInstance } from '@/components/map-tile-layer';

/**
 * Init function for the map overlay page.
 * Uses baseInitApp — no banana-specific systems needed.
 */
const initMapOverlayApp = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<ResolvedComponents> => {
    const components = await baseInitApp(canvas, option);

    const { stage } = components.app;

    // -- Demo graphics (coordinates in meters from Taipei 101) --

    const originDot = new Graphics();
    originDot.circle(0, 0, 8);
    originDot.fill({ color: 0x00dcff });
    stage.addChild(originDot);

    const originRing = new Graphics();
    originRing.circle(0, 0, 50);
    originRing.stroke({ color: 0x00dcff, width: 3 });
    stage.addChild(originRing);

    const crosshair = new Graphics();
    crosshair.moveTo(-80, 0);
    crosshair.lineTo(-20, 0);
    crosshair.moveTo(20, 0);
    crosshair.lineTo(80, 0);
    crosshair.moveTo(0, -80);
    crosshair.lineTo(0, -20);
    crosshair.moveTo(0, 20);
    crosshair.lineTo(0, 80);
    crosshair.stroke({ color: 0x00dcff, width: 2 });
    stage.addChild(crosshair);

    const originLabel = new Text({
        text: 'TAIPEI 101 (0, 0)',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0x00dcff },
    });
    originLabel.position.set(60, -60);
    stage.addChild(originLabel);

    const square = new Graphics();
    square.rect(400, -100, 200, 200);
    square.fill({ color: 0x00ffaa, alpha: 0.15 });
    stage.addChild(square);

    const squareBorder = new Graphics();
    squareBorder.rect(400, -100, 200, 200);
    squareBorder.stroke({ color: 0x00ffaa, width: 2 });
    stage.addChild(squareBorder);

    const squareLabel = new Text({
        text: '200m square',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0x00ffaa },
    });
    squareLabel.position.set(420, -130);
    stage.addChild(squareLabel);

    const northFill = new Graphics();
    northFill.circle(0, -500, 100);
    northFill.fill({ color: 0xff6644, alpha: 0.15 });
    stage.addChild(northFill);

    const northBorder = new Graphics();
    northBorder.circle(0, -500, 100);
    northBorder.stroke({ color: 0xff6644, width: 2 });
    stage.addChild(northBorder);

    const northLabel = new Text({
        text: '100m radius\n500m north',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xff6644 },
    });
    northLabel.position.set(110, -530);
    stage.addChild(northLabel);

    const scaleBar = new Graphics();
    scaleBar.moveTo(-400, 300);
    scaleBar.lineTo(100, 300);
    scaleBar.moveTo(-400, 290);
    scaleBar.lineTo(-400, 310);
    scaleBar.moveTo(100, 290);
    scaleBar.lineTo(100, 310);
    scaleBar.stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
    stage.addChild(scaleBar);

    const scaleLabel = new Text({
        text: '500m',
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff },
    });
    scaleLabel.position.set(-180, 310);
    stage.addChild(scaleLabel);

    return components as unknown as ResolvedComponents;
};

/**
 * Map overlay page: a map tile layer controlled by a @ue-too/board-pixi canvas overlay.
 */
export function MapOverlayPage(): React.ReactNode {
    const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
    const handleMapDestroy = useCallback(() => setMapInstance(null), []);

    return (
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                background: '#06080f',
                overflow: 'hidden',
            }}
        >
            <MapTileLayer
                visible={true}
                onMapReady={setMapInstance}
                onMapDestroy={handleMapDestroy}
            />

            <div style={{ position: 'absolute', inset: 0 }}>
                <Wrapper
                    option={{
                        fullScreen: true,
                        boundaries: {
                            min: { x: -50_000, y: -50_000 },
                            max: { x: 50_000, y: 50_000 },
                        },
                    }}
                    initFunction={initMapOverlayApp}
                >
                    {mapInstance && (
                        <MapTileLayerSync map={mapInstance} />
                    )}
                </Wrapper>
            </div>
        </div>
    );
}
