import { translationHeightOf, translationWidthOf } from '@ue-too/board';
import { convertFromWindow2Canvas } from '@ue-too/board/utils/coordinate-conversions/';
import { useCallback, useMemo, useRef } from 'react';

import { usePixiCanvas } from '../../contexts/pixi';
import { useViewportScrollBar } from '../../hooks/pixi/utils';

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

    const horizontalKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                return;
            }

            const boundaries = result.components.camera.boundaries;
            if (!boundaries) {
                return;
            }

            const width = translationWidthOf(boundaries);
            if (width == null) {
                return;
            }

            const viewportWidth = result.components.camera.viewPortWidth;
            const scrollStep = viewportWidth * 0.05; // 10% of viewport width
            const scrollPercentage = scrollStep / viewportWidth;
            const worldStep = scrollPercentage * width;

            let worldDelta = { x: 0, y: 0 };

            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    worldDelta = { x: -worldStep, y: 0 };
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    worldDelta = { x: worldStep, y: 0 };
                    break;
                case 'Home':
                    event.preventDefault();
                    // Move to leftmost position
                    if (boundaries.min?.x != null) {
                        const currentLeft = boundaries.min.x;
                        const viewportLeft =
                            result.components.camera.convertFromViewPort2WorldSpace(
                                {
                                    x: -viewportWidth / 2,
                                    y: 0,
                                }
                            ).x;
                        worldDelta = { x: currentLeft - viewportLeft, y: 0 };
                    }
                    break;
                case 'End':
                    event.preventDefault();
                    // Move to rightmost position
                    if (boundaries.max?.x != null) {
                        const currentRight = boundaries.max.x;
                        const viewportRight =
                            result.components.camera.convertFromViewPort2WorldSpace(
                                {
                                    x: viewportWidth / 2,
                                    y: 0,
                                }
                            ).x;
                        worldDelta = { x: currentRight - viewportRight, y: 0 };
                    }
                    break;
                default:
                    return;
            }

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

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

    const verticalKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                return;
            }

            const boundaries = result.components.camera.boundaries;
            if (!boundaries) {
                return;
            }

            const height = translationHeightOf(boundaries);
            if (height == null) {
                return;
            }

            const viewportHeight = result.components.camera.viewPortHeight;
            const scrollStep = viewportHeight * 0.05; // 10% of viewport height
            const scrollPercentage = scrollStep / viewportHeight;
            const worldStep = scrollPercentage * height;

            let worldDelta = { x: 0, y: 0 };

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    worldDelta = { x: 0, y: -worldStep };
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    worldDelta = { x: 0, y: worldStep };
                    break;
                case 'Home':
                    event.preventDefault();
                    // Move to topmost position
                    if (boundaries.max?.y != null) {
                        const currentTop = boundaries.max.y;
                        const viewportTop =
                            result.components.camera.convertFromViewPort2WorldSpace(
                                {
                                    x: 0,
                                    y: -viewportHeight / 2,
                                }
                            ).y;
                        worldDelta = { x: 0, y: currentTop - viewportTop };
                    }
                    break;
                case 'End':
                    event.preventDefault();
                    // Move to bottommost position
                    if (boundaries.min?.y != null) {
                        const currentBottom = boundaries.min.y;
                        const viewportBottom =
                            result.components.camera.convertFromViewPort2WorldSpace(
                                {
                                    x: 0,
                                    y: viewportHeight / 2,
                                }
                            ).y;
                        worldDelta = {
                            x: 0,
                            y: currentBottom - viewportBottom,
                        };
                    }
                    break;
                default:
                    return;
            }

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

    // Calculate scroll position percentages for ARIA attributes
    const horizontalScrollPercentage = useMemo(() => {
        if (
            scrollBar.horizontal == null ||
            scrollBar.horizontalLength == null ||
            result.initialized == false ||
            result.success == false ||
            result.components.camera == null
        ) {
            return undefined;
        }
        const viewportWidth = result.components.camera.viewPortWidth;
        const maxPosition = viewportWidth - scrollBar.horizontalLength;
        if (maxPosition <= 0) return 0;
        return Math.round((scrollBar.horizontal / maxPosition) * 100);
    }, [scrollBar.horizontal, scrollBar.horizontalLength, result]);

    const verticalScrollPercentage = useMemo(() => {
        if (
            scrollBar.vertical == null ||
            scrollBar.verticalLength == null ||
            result.initialized == false ||
            result.success == false ||
            result.components.camera == null
        ) {
            return undefined;
        }
        const viewportHeight = result.components.camera.viewPortHeight;
        const maxPosition = viewportHeight - scrollBar.verticalLength;
        if (maxPosition <= 0) return 0;
        return Math.round((scrollBar.vertical / maxPosition) * 100);
    }, [scrollBar.vertical, scrollBar.verticalLength, result]);

    return (
        <>
            {/* Horizontal scroll bar */}
            <div
                className="pointer-events-auto"
                tabIndex={0}
                role="scrollbar"
                aria-label="Horizontal scrollbar"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={horizontalScrollPercentage ?? 0}
                style={{
                    width: scrollBar.horizontalLength ?? 0,
                    height: 10,
                    left: scrollBar.horizontal ?? 0,
                    bottom: 0,
                    backgroundColor: 'red',
                    position: 'absolute',
                    outline: 'none',
                }}
                onPointerDown={horizontalPointerDown}
                onPointerMove={horizontalPointerMove}
                onPointerUp={horizontalPointerUp}
                onKeyDown={horizontalKeyDown}
                onFocus={e => {
                    e.currentTarget.style.outline = '2px solid #0066cc';
                    e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                }}
            />
            {/* Vertical scroll bar */}
            <div
                className="pointer-events-auto"
                tabIndex={0}
                role="scrollbar"
                aria-label="Vertical scrollbar"
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={verticalScrollPercentage ?? 0}
                style={{
                    width: 10,
                    height: scrollBar.verticalLength ?? 0,
                    right: 0,
                    top: scrollBar.vertical ?? 0,
                    backgroundColor: 'blue',
                    position: 'absolute',
                    pointerEvents: 'auto',
                    outline: 'none',
                }}
                onPointerDown={verticalPointerDown}
                onPointerMove={verticalPointerMove}
                onPointerUp={verticalPointerUp}
                onKeyDown={verticalKeyDown}
                onFocus={e => {
                    e.currentTarget.style.outline = '2px solid #0066cc';
                    e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                }}
            />
        </>
    );
};
