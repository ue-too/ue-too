import { useRef, useCallback, useSyncExternalStore } from "react";
import { useAnimationFrame } from "../hooks/useAnimationFrame";
import { useBoardify } from "../hooks/useBoardify";

export type BoardProps = {
    fullScreen?: boolean;
    width?: number;
    height?: number;
    animationCallback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void;
}

export default function Board({width, height, fullScreen, animationCallback: animationCallbackProp}: BoardProps) {

    const {board, subscribe} = useBoardify(fullScreen);

    const position = useSyncExternalStore(subscribe, () => {
        return board.camera.position;
    });

    const animationCallback = useCallback((timestamp: number) => {
        board.step(timestamp);
        const ctx = board.context;
        if(ctx == undefined){
            console.warn('Canvas context not available');
            return;
        }
        
        if(animationCallbackProp != undefined){
            animationCallbackProp(timestamp, ctx);
        }
    }, [animationCallbackProp, board]);

    useAnimationFrame(animationCallback);

    return (
        <>
            <div>camera position: {position.x}, {position.y}</div>
            <canvas 
                width={width}
                height={height}
                ref={(ref)=>{
                    if(ref == null){
                        board.tearDown();
                        return;
                    }
                    board.attach(ref);
                }} 
            />
        </>
    );
}
