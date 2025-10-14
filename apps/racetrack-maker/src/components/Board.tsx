import { useRef, useEffect } from "react";
import { Board as Boardify } from "@ue-too/board";


export type BoardProps = {
    fullScreen?: boolean;
    width?: number;
    height?: number;
}

export default function Board({width, height, fullScreen}: BoardProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const boardRef = useRef<Boardify | null>(null);

    if(boardRef.current == null){
        boardRef.current = new Boardify();
    }

    boardRef.current.fullScreen = fullScreen ?? false;

    useEffect(() => {
        if (!canvasRef.current) return;

        boardRef.current?.attach(canvasRef.current);
        // Initialize the board only once using the conditional pattern
        
        // Set up the animation loop
        const step = (timestamp: number) => {
            // Example drawing - you can replace this with your own drawing logic
            boardRef.current?.step(timestamp);
            const ctx = boardRef.current?.context;
            if(ctx == undefined){
                return;
            }
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.fillStyle = '#2196F3';
            ctx.beginPath();
            ctx.arc(200, 200, 50, 0, 2 * Math.PI);
            ctx.fill();
            
            animationFrameRef.current = requestAnimationFrame(step);
        };

        // Start the animation loop
        animationFrameRef.current = requestAnimationFrame(step);

        // Cleanup function
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
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
