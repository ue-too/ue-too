import { translationHeightOf, translationWidthOf } from '@ue-too/board';
import { convertFromWindow2Canvas } from '@ue-too/board/utils/coordinate-conversions/';
import { useCallback, useMemo, useRef } from 'react';

import { PixiCanvasProvider, usePixiCanvas } from '@/contexts/pixi';
import { useInitializePixiApp } from '@/hooks/pixi';
import { useBoardCameraState } from '@/hooks/pixi/camera';
import { useCanvasSize, useViewportScrollBar } from '@/hooks/pixi/utils';

import { appIsReady } from '../utils/pixi';
import { ScrollBarDisplay } from './canvas/scrollbar';
import { Button } from './ui/button';

import { Toolbar } from '.';

/**
 * PixiCanvas Component
 * Integrates PixiJS with React, setting up the canvas, camera, and input handling
 * @returns {JSX.Element} Canvas element for PixiJS rendering
 */
export const PixiCanvas = (
    option: { fullScreen: boolean } = { fullScreen: true }
): React.ReactNode => {
    const { canvasRef } = useInitializePixiApp(option);

    return <canvas ref={canvasRef} id="graph" />;
};

const OverlayContainer = ({ children }: { children: React.ReactNode }) => {
    const { width, height } = useCanvasSize();

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height,
                pointerEvents: 'none',
            }}
        >
            {children}
        </div>
    );
};

export const Wrapper = (
    option: { fullScreen: boolean } = { fullScreen: true }
) => {
    return (
        <div style={{ position: 'relative' }}>
            <PixiCanvasProvider>
                <PixiCanvas fullScreen={option.fullScreen} />
                <OverlayContainer>
                    <TestDiv />
                    <PositionDisplay />
                    <RotationDisplay />
                    <ZoomLevelDisplay />
                    <ScrollBarDisplay />
                    <AddRowButton />
                    <RemoveRowButton />
                    <Toolbar />
                </OverlayContainer>
            </PixiCanvasProvider>
        </div>
    );
};

export const TestDiv = () => {
    const { width, height } = useCanvasSize();

    return (
        <div>
            Canvas Size: width: {width}, height: {height}
        </div>
    );
};

export const PositionDisplay = () => {
    const position = useBoardCameraState('position');

    return (
        <div>
            PositionDisplay {position.x} {position.y}
        </div>
    );
};

export const RotationDisplay = () => {
    const rotation = useBoardCameraState('rotation');

    return <div>RotationDisplay {rotation}</div>;
};

export const ZoomLevelDisplay = () => {
    const zoomLevel = useBoardCameraState('zoomLevel');

    return <div>ZoomLevelDisplay {zoomLevel}</div>;
};

const AddRowButton = () => {
    const { result } = usePixiCanvas();

    return (
        <Button
            className="pointer-events-auto"
            onClick={() => {
                const check = appIsReady(result);
                if (check.ready) {
                    check.components.pixiGrid.addRow();
                }
            }}
        >
            Add Row
        </Button>
    );
};

const RemoveRowButton = () => {
    const { result } = usePixiCanvas();

    return (
        <Button
            className="pointer-events-auto"
            onClick={() => {
                const check = appIsReady(result);
                if (check.ready) {
                    check.components.pixiGrid.removeRow();
                }
            }}
        >
            Remove Row
        </Button>
    );
};
