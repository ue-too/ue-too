import { useEffect, useRef } from 'react';

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
