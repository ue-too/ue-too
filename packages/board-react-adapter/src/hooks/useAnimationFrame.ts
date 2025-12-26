import { useCallback, useEffect, useRef } from 'react';
import { useBoard } from './useBoardify';

/**
 * Hook to run a callback on every animation frame.
 *
 * @remarks
 * This hook uses `requestAnimationFrame` to execute a callback repeatedly for smooth animations.
 * The animation loop starts when the component mounts and stops when it unmounts, automatically
 * cleaning up the animation frame request.
 *
 * **Performance Note**: The callback is called on every frame, so ensure your callback is
 * optimized to avoid performance issues. The callback dependency should be stable to prevent
 * restarting the animation loop unnecessarily.
 *
 * @param callback - Function to call on each animation frame, receives the current timestamp
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const [rotation, setRotation] = useState(0);
 *
 *   useAnimationFrame((timestamp) => {
 *     // Rotate 45 degrees per second
 *     setRotation((prev) => prev + (Math.PI / 4) * (1 / 60));
 *   });
 *
 *   return <div style={{ transform: `rotate(${rotation}rad)` }}>Spinning!</div>;
 * }
 * ```
 *
 * @category Hooks
 * @see {@link useAnimationFrameWithBoard} for board-integrated animation loop
 */
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

/**
 * Hook to run an animation loop integrated with the Board's step function.
 *
 * @remarks
 * This hook automatically calls `board.step(timestamp)` on every frame to update the board's
 * camera transform, then invokes your callback with the timestamp and canvas context.
 * This is the recommended way to implement drawing logic for board-based applications.
 *
 * The hook handles:
 * - Calling `board.step()` to update camera transforms
 * - Providing the canvas context for drawing
 * - Warning if context is not available
 * - Cleaning up the animation loop on unmount
 *
 * **Typical Usage Pattern**:
 * 1. Board calls `step()` to update transforms
 * 2. Your callback draws on the canvas
 * 3. Browser paints the frame
 * 4. Repeat next frame
 *
 * @param callback - Optional function to call after board.step(), receives timestamp and canvas context
 *
 * @example
 * ```tsx
 * function MyBoard() {
 *   useAnimationFrameWithBoard((timestamp, ctx) => {
 *     // Draw a rectangle at world position (0, 0)
 *     ctx.fillStyle = 'red';
 *     ctx.fillRect(0, 0, 100, 100);
 *
 *     // Draw a circle that moves
 *     const x = Math.sin(timestamp / 1000) * 200;
 *     const y = Math.cos(timestamp / 1000) * 200;
 *     ctx.fillStyle = 'blue';
 *     ctx.beginPath();
 *     ctx.arc(x, y, 20, 0, Math.PI * 2);
 *     ctx.fill();
 *   });
 *
 *   return <Board width={800} height={600} />;
 * }
 * ```
 *
 * @category Hooks
 * @see {@link useAnimationFrame} for generic animation frame hook
 */
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
