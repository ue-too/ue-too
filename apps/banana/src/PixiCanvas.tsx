import {
    CameraState,
    getScrollBar,
    translationHeightOf,
    translationWidthOf,
} from '@ue-too/board';
import {
    convertFromCanvas2ViewPort,
    convertFromViewport2World,
    convertFromWindow2Canvas,
} from '@ue-too/board/utils/coordinate-conversions/';
import { Ticker } from 'pixi.js';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';

import {
    PixiCanvasProvider,
    PixiCanvasResult,
    usePixiCanvas,
} from '@/contexts/pixi';
import {
    useAllBoardCameraState,
    useAppTicker,
    useCanvasPointerDown,
    useGrid,
    useInitializePixiApp,
} from '@/hooks/pixi';
import { useBoardCameraState } from '@/hooks/pixi/camera';
import { useCanvasSize, useViewportScrollBar } from '@/hooks/pixi/utils';

/**
 * PixiCanvas Component
 * Integrates PixiJS with React, setting up the canvas, camera, and input handling
 * @returns {JSX.Element} Canvas element for PixiJS rendering
 */
export const PixiCanvas = (
    option: { fullScreen: boolean } = { fullScreen: true }
): React.ReactNode => {
    const { canvasRef } = useInitializePixiApp(option);

    // useCanvasPointerDown(() => {
    //     console.log('pointerdown');
    // });

    useGrid();

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
                </OverlayContainer>
            </PixiCanvasProvider>
        </div>
    );
};

export const ScrollBarDisplay = () => {
    const scrollBar = useViewportScrollBar();
    const initialHorizontalPositionRef = useRef<number>(0);
    const isHorizontalPointerDownRef = useRef<boolean>(false);

    const initialVerticalPositionRef = useRef<number>(0);
    const isVerticalPointerDownRef = useRef<boolean>(false);

    const { result } = usePixiCanvas();

    const horizontalPointerDown = (
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        initialHorizontalPositionRef.current = event.clientX;
        isHorizontalPointerDownRef.current = true;
    };

    const horizontalPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null ||
                isHorizontalPointerDownRef.current == false
            ) {
                initialHorizontalPositionRef.current = 0;
                return;
            }
            const delta = {
                x: event.clientX - initialHorizontalPositionRef.current,
                y: 0,
            };
            initialHorizontalPositionRef.current = event.clientX;
            const viewportDelta = convertFromWindow2Canvas(
                delta,
                result.components.canvasProxy
            );

            const percentage =
                viewportDelta.x / result.components.camera.viewPortWidth;

            const worldDelta = {
                x:
                    percentage *
                    (translationWidthOf(result.components.camera.boundaries) ??
                        0),
                y: 0,
            };

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

    const horizontalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        isHorizontalPointerDownRef.current = false;
    };

    const verticalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        initialVerticalPositionRef.current = event.clientY;
        isVerticalPointerDownRef.current = true;
    };

    const verticalPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null ||
                isVerticalPointerDownRef.current == false
            ) {
                initialVerticalPositionRef.current = 0;
                return;
            }
            const delta = {
                x: 0,
                y: event.clientY - initialVerticalPositionRef.current,
            };
            initialVerticalPositionRef.current = event.clientY;
            const viewportDelta = convertFromWindow2Canvas(
                delta,
                result.components.canvasProxy
            );

            const percentage =
                viewportDelta.y / result.components.camera.viewPortHeight;

            const worldDelta = {
                x: 0,
                y:
                    percentage *
                    (translationHeightOf(result.components.camera.boundaries) ??
                        0),
            };

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

    const verticalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        isVerticalPointerDownRef.current = false;
    };

    return (
        <>
            {/* Horizontal scroll bar */}
            <div
                className="pointer-events-auto"
                style={{
                    width: scrollBar.horizontalLength ?? 0,
                    height: 10,
                    left: scrollBar.horizontal ?? 0,
                    bottom: 0,
                    backgroundColor: 'red',
                    position: 'absolute',
                }}
                onPointerDown={horizontalPointerDown}
                onPointerMove={horizontalPointerMove}
                onPointerUp={horizontalPointerUp}
            />
            {/* Vertical scroll bar */}
            <div
                className="pointer-events-auto"
                style={{
                    width: 10,
                    height: scrollBar.verticalLength ?? 0,
                    right: 0,
                    top: scrollBar.vertical ?? 0,
                    backgroundColor: 'blue',
                    position: 'absolute',
                    pointerEvents: 'auto',
                }}
                onPointerDown={verticalPointerDown}
                onPointerMove={verticalPointerMove}
                onPointerUp={verticalPointerUp}
            />
        </>
    );
};

export const TestDiv = () => {

    const { width, height } = useCanvasSize();

    return (
        <>
            <div>
                Canvas Size: width: {width}, height: {height}
            </div>
        </>
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
