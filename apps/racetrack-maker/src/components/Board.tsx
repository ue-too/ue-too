import { useRef, useEffect } from "react";
import { Board as Boardify } from "@ue-too/board";

export default function Board() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boardRef = useRef<Boardify | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize the board only once using the conditional pattern
        if (boardRef.current === null) {
            boardRef.current = new Boardify(canvasRef.current);
            boardRef.current.setup();
            boardRef.current.fullScreen = true;
        }
        
        // Set up the animation loop
        const step = (timestamp: number) => {
            if (boardRef.current) {
                boardRef.current.step(timestamp);
                
                // Example drawing - you can replace this with your own drawing logic
                const ctx = boardRef.current.context;
                ctx.fillStyle = '#4CAF50';
                ctx.fillRect(0, 0, 100, 100);
                
                ctx.fillStyle = '#2196F3';
                ctx.beginPath();
                ctx.arc(200, 200, 50, 0, 2 * Math.PI);
                ctx.fill();
            }
            
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
            ref={canvasRef} 
            id="graph"
        />
    );
}
