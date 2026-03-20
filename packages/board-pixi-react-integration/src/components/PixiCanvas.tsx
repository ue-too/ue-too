import {
    BaseAppComponents,
    InitAppOptions,
    baseInitApp,
} from '@ue-too/board-pixi-integration';

import { PixiCanvasProvider } from '../contexts';
import { useInitializePixiApp } from '../hooks';
import { useCanvasSize } from '../hooks/pixi/utils';
import { ScrollBarDisplay } from './canvas/scrollbar';

/**
 * PixiCanvas Component
 * Integrates PixiJS with React, setting up the canvas, camera, and input handling
 * @returns {JSX.Element} Canvas element for PixiJS rendering
 */
export const PixiCanvas = ({
    option,
    initFunction,
    className,
}: {
    option: Partial<InitAppOptions>;
    initFunction: (
        canvas: HTMLCanvasElement,
        option: Partial<InitAppOptions>
    ) => Promise<BaseAppComponents>;
    className?: string;
}): React.ReactNode => {
    const { canvasRef } = useInitializePixiApp(option, initFunction);

    return <canvas ref={canvasRef} className={className} />;
};

export const OverlayContainer = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const { width, height } = useCanvasSize();

    // Before Pixi initializes, useCanvasSize returns 0x0. Use 100% to fill the
    // parent so overlay children (e.g. TimeDisplay) are positioned correctly.
    const isReady = width > 0 && height > 0;

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                ...(isReady ? { width, height } : { width: '100%', height: '100%' }),
                pointerEvents: 'none',
            }}
        >
            {children}
        </div>
    );
};

export const PixiCanvasApp = ({
    option,
    initFunction,
    canvasClassName,
    children,
}: {
    option: Partial<InitAppOptions>;
    initFunction: (
        canvas: HTMLCanvasElement,
        option: Partial<InitAppOptions>
    ) => Promise<BaseAppComponents>;
    canvasClassName?: string;
    children?: React.ReactNode;
}) => {
    return (
        <div style={{ position: 'relative' }}>
            <PixiCanvasProvider>
                <PixiCanvas
                    option={option}
                    initFunction={initFunction}
                    className={canvasClassName}
                />
                <OverlayContainer>{children}</OverlayContainer>
            </PixiCanvasProvider>
        </div>
    );
};

export { PixiCanvasApp as Wrapper };
