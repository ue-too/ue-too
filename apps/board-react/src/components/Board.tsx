import {useRef, useCallback, useSyncExternalStore, useMemo} from "react";
import {useAnimationFrame} from "../hooks/useAnimationFrame";
import {BoardProvider, useBoard, useBoardCameraState, useBoardify, useCustomCameraMux} from "../hooks/useBoardify";
import { Point } from "@ue-too/math";
import type { CameraMux } from "@ue-too/board/camera";

export type BoardProps = {
    fullScreen?: boolean;
    width?: number;
    height?: number;
    animationCallback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void;
    children?: React.ReactNode;
}

export function Board({width, height, fullScreen, animationCallback: animationCallbackProp}: BoardProps) {

    console.log('Board rendered');

    const board = useBoard();

    const animationCallback = useCallback((timestamp: number) => {
        board.step(timestamp);
        const ctx = board.context;
        if (ctx == undefined) {
            console.warn('Canvas context not available');
            return;
        }

        if (animationCallbackProp != undefined) {
            animationCallbackProp(timestamp, ctx);
        }
    }, [animationCallbackProp, board]); 

    const cameraMux = useMemo<CameraMux>(()=>{
        return {
            notifyPanInput: (value: Point) => {
                console.log('notifyPanInput', value);
                return {
                    allowPassThrough: false,
                }
            },
            notifyZoomInput: (value: number) => {
                console.log('notifyZoomInput', value);
                return {
                    allowPassThrough: false,
                }
            },
            notifyRotationInput: (value: number) => {
                console.log('notifyRotateInput', value);
                return {
                    allowPassThrough: false,
                }
            },
        }
    }, []);

    useCustomCameraMux(cameraMux);

    useAnimationFrame(animationCallback);

    return (
        <>
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
            />
        </>
    );
}

export default function BoardWrapperWithChildren({width, height, fullScreen, animationCallback: animationCallbackProp, children}: BoardProps) {
    return (
        <BoardProvider>
            <Board width={width} height={height} fullScreen={fullScreen} animationCallback={animationCallbackProp} />
            {children}
        </BoardProvider>
    );
}
