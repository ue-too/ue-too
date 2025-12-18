import {useRef, useCallback, useSyncExternalStore, useMemo} from "react";
import {useAnimationFrame, useAnimationFrameWithBoard} from "../hooks/useAnimationFrame";
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

function Board({width, height, fullScreen, animationCallback: animationCallbackProp}: BoardProps) {

    console.log('Board rendered');

    const board = useBoard();

    useAnimationFrameWithBoard(animationCallbackProp);

    return (
        <canvas
            width={width}
            height={height}
            ref={(ref) => {
                if (ref == null) {
                    board.tearDown();
                    return;
                }

                console.log('Board attached');
                board.attach(ref);
            }}
            onPointerDown={(e)=>{
                const worldPosition = board.convertWindowPoint2WorldCoord({
                    x: e.clientX,
                    y: e.clientY,
                });
                console.log('worldPosition', worldPosition);
            }}
        />
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
