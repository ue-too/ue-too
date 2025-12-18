import { useCallback, useEffect, useRef } from 'react';
import { useBoard } from './useBoardify';

export function useAnimationFrame(callback: (timestamp: number) => void) {
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const step = (timestamp: number) => {
            callback(timestamp);
            animationFrameRef.current = requestAnimationFrame(step);
        };

        // Start the animation loop
        animationFrameRef.current = requestAnimationFrame(step);

        // Cleanup function
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [callback]);
}

export function useAnimationFrameWithBoard(callback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void) {

    const board = useBoard();

    const animationCallback = useCallback((timestamp: number) => {
        board.step(timestamp);
        const ctx = board.context;
        if (ctx == undefined) {
            console.warn('Canvas context not available');
            return;
        }
        callback?.(timestamp, ctx);
    }, [callback, board]);

    useAnimationFrame(animationCallback);
}
