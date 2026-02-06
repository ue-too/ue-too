import { InitAppOptions, baseInitApp } from '@ue-too/board-pixi-integration';

import { PixiCanvasProvider, ResolvedComponents } from '../contexts';
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
    ) => Promise<ResolvedComponents>;
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

export const Wrapper = ({
    option,
    initFunction,
    canvasClassName,
    children,
}: {
    option: Partial<InitAppOptions>;
    initFunction: (
        canvas: HTMLCanvasElement,
        option: Partial<InitAppOptions>
    ) => Promise<ResolvedComponents>;
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
