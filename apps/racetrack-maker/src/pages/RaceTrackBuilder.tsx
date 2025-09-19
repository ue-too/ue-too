import Board from "../components/Board";
import { useCallback } from "react";

export default function RaceTrackBuilder() {

    const animationCallback = useCallback((timestamp: number, ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, 100, 100);
        
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(200, 200, 50, 0, 2 * Math.PI);
        ctx.fill();
    }, []);

    return (
        <Board  fullScreen animationCallback={animationCallback}/>
    );
}
