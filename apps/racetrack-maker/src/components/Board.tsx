import { useRef, useEffect, useCallback } from "react";
import { Board as Boardify } from "@ue-too/board";
import { useAnimationFrame } from "../hooks/useAnimationFrame";

export type BoardProps = {
    fullScreen?: boolean;
    width?: number;
    height?: number;
    animationCallback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void;
}

export default function Board({width, height, fullScreen, animationCallback: animationCallbackProp}: BoardProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boardRef = useRef<Boardify | null>(null);

    if(boardRef.current == null){
        boardRef.current = new Boardify();
    }

    boardRef.current.fullScreen = fullScreen ?? false;

    useEffect(() => {
        if (!canvasRef.current) return;
        boardRef.current?.attach(canvasRef.current);
    }, []);

    const animationCallback = useCallback((timestamp: number) => {
        boardRef.current?.step(timestamp);
        const ctx = boardRef.current?.context;
        if(ctx == undefined){
            return;
        }
        
        if(animationCallbackProp != undefined){
            animationCallbackProp(timestamp, ctx);
        }
    }, []);

    useAnimationFrame(animationCallback);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (boardRef.current) {
                boardRef.current.tearDown();
            }
        };
    }, []);

    return (
        <canvas 
            width={width}
            height={height}
            ref={canvasRef} 
        />
    );
}
