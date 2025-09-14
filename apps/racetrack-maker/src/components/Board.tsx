import { useRef, useEffect } from "react";
import { Board as Boardify } from "@ue-too/board";


export type BoardProps = {
    fullScreen?: boolean;
    width?: number;
    height?: number;
}

const board = new Boardify();

export default function Board({width, height, fullScreen}: BoardProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    board.fullScreen = fullScreen ?? false;

    useEffect(() => {
        if (!canvasRef.current) return;

        board.attach(canvasRef.current);
        // Initialize the board only once using the conditional pattern
        
        // Set up the animation loop
        const step = (timestamp: number) => {
            // Example drawing - you can replace this with your own drawing logic
            board.step(timestamp);
            const ctx = board.context;
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
            if (board) {
                board.tearDown();
            }
        };
    }, []);

    return (
        <canvas 
            width={width}
            height={height}
            ref={canvasRef} 
            id="graph"
        />
    );
}
