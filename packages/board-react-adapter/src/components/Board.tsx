import {useRef, useCallback, useSyncExternalStore, useMemo, useState} from "react";
import {useAnimationFrame, useAnimationFrameWithBoard} from "../hooks/useAnimationFrame";
import {BoardProvider, useBoard, useBoardCameraState, useBoardify, useCustomCameraMux, useCustomInputHandling} from "../hooks/useBoardify";
import { Point, PointCal } from "@ue-too/math";
import type { CameraMux } from "@ue-too/board/camera";
import { useCanvasProxyWithRef } from "../hooks/useCanvasProxy";
import { useEffect } from "react";
import { OutputEvent } from "@ue-too/board";
/**
 * Props for the Board component.
 *
 * @category Components
 */
export type BoardProps = {
    /** Enable fullscreen mode (canvas resizes with window) */
    fullScreen?: boolean;
    /** Canvas width in pixels */
    width?: number;
    /** Canvas height in pixels */
    height?: number;
    /** Callback function for drawing on each animation frame */
    animationCallback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void;
    /** Child components that can access the board via hooks */
    children?: React.ReactNode;
}

/**
 * Internal Board component that renders the canvas element.
 *
 * @remarks
 * This component must be used within a {@link BoardProvider} to access the board instance.
 * It handles canvas attachment/detachment and integrates the animation loop.
 *
 * @internal
 */
function Board({width, height, fullScreen, animationCallback: animationCallbackProp}: BoardProps) {

    const board = useBoard();

    useEffect(() => {
        board.fullScreen = fullScreen ?? false;
    }, [fullScreen]);

    console.log('board');

    useAnimationFrameWithBoard(animationCallbackProp);

    // const {processInputEvent} = useCustomInputHandling();

    // const keyboardMouseInput = useMemo(() => {console.log("new KeyboardMouseInput"); return new KeyboardMouseInput(processInputEvent)}, [processInputEvent]);

    return (
        <canvas
            width={width}
            height={height}
            ref={(ref) => {
                if (ref == null) {
                    board.tearDown();
                    return;
                }

                board.attach(ref);
            }}
            // onPointerDown={(e: React.PointerEvent<HTMLCanvasElement>) => keyboardMouseInput.pointerdownHandler(e.nativeEvent)}
            // onPointerMove={(e: React.PointerEvent<HTMLCanvasElement>) => keyboardMouseInput.pointermoveHandler(e.nativeEvent)}
            // onPointerUp={(e: React.PointerEvent<HTMLCanvasElement>) => keyboardMouseInput.pointerupHandler(e.nativeEvent)}
        />
    );
}

/**
 * Main Board component with provider wrapper for React applications.
 *
 * @remarks
 * This component provides a complete infinite canvas solution for React. It combines:
 * - A {@link BoardProvider} to share the board instance across components
 * - A canvas element configured with the @ue-too/board package
 * - An integrated animation loop for drawing
 * - Support for child components that can access board state and controls
 *
 * ## Features
 *
 * - **Infinite Canvas**: Pan, zoom, and rotate with mouse/touch input
 * - **Animation Loop**: Automatic rendering loop with customizable draw callback
 * - **React Integration**: Use hooks to access camera state and controls
 * - **Fullscreen Support**: Optional auto-resize with window
 * - **Type-Safe**: Full TypeScript support
 *
 * ## Usage Pattern
 *
 * 1. Render the Board component
 * 2. Provide an animation callback for drawing
 * 3. Use child components with board hooks for UI controls
 * 4. Access camera state reactively via hooks
 *
 * @param props - Component props
 * @param props.width - Canvas width in pixels (default: auto)
 * @param props.height - Canvas height in pixels (default: auto)
 * @param props.fullScreen - Enable fullscreen mode (canvas resizes with window)
 * @param props.animationCallback - Function called on each frame with timestamp and context
 * @param props.children - Child components that can use board hooks
 *
 * @example
 * Basic usage with drawing
 * ```tsx
 * function App() {
 *   return (
 *     <Board
 *       width={800}
 *       height={600}
 *       animationCallback={(timestamp, ctx) => {
 *         // Draw a rectangle at world position (0, 0)
 *         ctx.fillStyle = 'blue';
 *         ctx.fillRect(0, 0, 100, 100);
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * With child components and camera controls
 * ```tsx
 * function CameraControls() {
 *   const { panToWorld, zoomTo } = useCameraInput();
 *   const position = useBoardCameraState('position');
 *
 *   return (
 *     <div style={{ position: 'absolute', top: 10, left: 10 }}>
 *       <p>Position: ({position.x.toFixed(0)}, {position.y.toFixed(0)})</p>
 *       <button onClick={() => panToWorld({ x: 0, y: 0 })}>Center</button>
 *       <button onClick={() => zoomTo(1.0)}>Reset Zoom</button>
 *     </div>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <Board width={800} height={600} animationCallback={drawScene}>
 *       <CameraControls />
 *     </Board>
 *   );
 * }
 * ```
 *
 * @example
 * Fullscreen mode
 * ```tsx
 * function App() {
 *   return (
 *     <Board
 *       fullScreen
 *       animationCallback={(timestamp, ctx) => {
 *         // Canvas automatically resizes to window size
 *         ctx.fillStyle = 'green';
 *         ctx.fillRect(-50, -50, 100, 100);
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @category Components
 * @see {@link useBoardCameraState} for accessing camera state
 * @see {@link useCameraInput} for camera control functions
 * @see {@link useBoard} for accessing the board instance
 */
export default function BoardWrapperWithChildren({width, height, fullScreen, animationCallback: animationCallbackProp, children}: BoardProps) {
    return (
        <BoardProvider>
            <Board width={width} height={height} fullScreen={fullScreen} animationCallback={animationCallbackProp} />
            {children}
        </BoardProvider>
    );
}

class KeyboardMouseInput{

    private isPanning: boolean;
    private panStartPoint: Point;
    private processInputEvent: (input: OutputEvent) => void;

    constructor(processInputEvent: (input: OutputEvent) => void){
        this.isPanning = false;
        this.panStartPoint = {x: 0, y: 0};
        this.processInputEvent = processInputEvent;
        this.bindFunctions();
    }

    bindFunctions(): void {
        this.pointerdownHandler = this.pointerdownHandler.bind(this);
        this.pointermoveHandler = this.pointermoveHandler.bind(this);
        this.pointerupHandler = this.pointerupHandler.bind(this);
    }

    pointerdownHandler(event: PointerEvent): void {
        if(event.pointerType !== "mouse"){
            return;
        }
        this.isPanning = true;
        this.panStartPoint = {x: event.clientX, y: event.clientY};
    }

    pointermoveHandler(event: PointerEvent): void {
        if(!this.isPanning){
            return;
        }
        const curPosition = {x: event.clientX, y: event.clientY};
        const diff = PointCal.subVector(this.panStartPoint, curPosition);
        this.processInputEvent({
            type: 'pan',
            delta: diff,
        });
        this.panStartPoint = curPosition;
    }

    pointerupHandler(event: PointerEvent): void {
        if(event.pointerType !== "mouse"){
            return;
        }
        this.isPanning = false;
    }

}
