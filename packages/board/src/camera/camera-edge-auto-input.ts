import { CameraMux } from "./camera-mux";
import { PointCal } from "@ue-too/math";

/**
 * Automatic camera panning triggered by cursor proximity to viewport edges.
 * Commonly used in strategy games, map editors, and design tools.
 *
 * @remarks
 * This class implements edge-scrolling behavior where the camera automatically
 * pans when the cursor approaches the viewport edges. The panning speed is
 * constant and direction-based (no acceleration).
 *
 * The camera moves in viewport space, meaning the speed is consistent regardless
 * of zoom level. The actual world-space movement will vary with zoom.
 *
 * @example
 * ```typescript
 * const cameraMux = new CameraMux(camera);
 * const edgeScroll = new EdgeAutoCameraInput(cameraMux);
 *
 * // Track mouse position relative to viewport edges
 * canvas.addEventListener('mousemove', (e) => {
 *   const rect = canvas.getBoundingClientRect();
 *   const edgeMargin = 50; // pixels from edge
 *
 *   let horizontal: 'left' | 'right' | 'none' = 'none';
 *   let vertical: 'up' | 'down' | 'none' = 'none';
 *
 *   if (e.clientX - rect.left < edgeMargin) horizontal = 'left';
 *   if (rect.right - e.clientX < edgeMargin) horizontal = 'right';
 *   if (e.clientY - rect.top < edgeMargin) vertical = 'up';
 *   if (rect.bottom - e.clientY < edgeMargin) vertical = 'down';
 *
 *   edgeScroll.setDirection(horizontal, vertical);
 *   edgeScroll.toggleOn();
 * });
 *
 * // Stop scrolling when mouse leaves
 * canvas.addEventListener('mouseleave', () => {
 *   edgeScroll.toggleOff();
 * });
 *
 * // Update in render loop
 * function render(deltaTime: number) {
 *   edgeScroll.update(deltaTime / 1000); // convert ms to seconds
 * }
 * ```
 *
 * @category Camera
 * @see {@link CameraMux} for the camera input multiplexer this feeds into
 */
export class EdgeAutoCameraInput {

    private _cameraMux: CameraMux;
    private _state: 'idle' | 'moving' = 'idle';
    private _speed: number = 100; // pixels per second in viewport space

    private _horizontalDirection: 'left' | 'right' | 'none' = 'none';
    private _verticalDirection: 'up' | 'down' | 'none' = 'none';

    /**
     * Creates a new edge auto-scroll input controller.
     *
     * @param cameraMux - The camera multiplexer to send pan inputs to
     */
    constructor(cameraMux: CameraMux) {
        this._cameraMux = cameraMux;
    }

    /**
     * Disables edge scrolling.
     * The camera will stop panning even if direction is set.
     */
    toggleOff(){
        this._state = 'idle';
    }

    /**
     * Enables edge scrolling.
     * The camera will pan according to the current direction setting.
     */
    toggleOn(){
        this._state = 'moving';
    }

    /**
     * Sets the scrolling direction based on cursor position relative to edges.
     *
     * @param horizontalDirection - Horizontal scroll direction ('left', 'right', or 'none')
     * @param verticalDirection - Vertical scroll direction ('up', 'down', or 'none')
     *
     * @remarks
     * Directions can be combined for diagonal scrolling.
     * Set both to 'none' to stop scrolling without disabling via {@link toggleOff}.
     *
     * @example
     * ```typescript
     * edgeScroll.setDirection('left', 'none');  // Scroll left only
     * edgeScroll.setDirection('right', 'up');   // Scroll diagonally up-right
     * edgeScroll.setDirection('none', 'none');  // Stop scrolling
     * ```
     */
    setDirection(horizontalDirection: 'left' | 'right' | 'none', verticalDirection: 'up' | 'down' | 'none'): void {
        this._horizontalDirection = horizontalDirection;
        this._verticalDirection = verticalDirection;
    }

    /**
     * Updates the camera position based on elapsed time and current direction.
     * Call this in your render loop or update tick.
     *
     * @param deltaTime - Time elapsed since last update in seconds
     *
     * @remarks
     * The camera pans at a constant speed of 100 pixels/second in viewport space.
     * This is independent of zoom level - world-space movement varies with zoom.
     *
     * If the state is 'idle', this method does nothing.
     *
     * @example
     * ```typescript
     * // In animation frame callback
     * let lastTime = performance.now();
     *
     * function animate(currentTime: number) {
     *   const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
     *   lastTime = currentTime;
     *
     *   edgeScroll.update(deltaTime);
     *
     *   requestAnimationFrame(animate);
     * }
     * ```
     */
    update(deltaTime: number){

        if(this._state === 'idle') {
            return;
        }

        const direction = {
            x: this._horizontalDirection === 'left' ? -1 : this._horizontalDirection === 'right' ? 1 : 0,
            y: this._verticalDirection === 'up' ? -1 : this._verticalDirection === 'down' ? 1 : 0
        };

        const distance = this._speed * deltaTime;

        const deltaVector = PointCal.multiplyVectorByScalar(direction, distance);

        this._cameraMux.notifyPanInput(deltaVector);
    }
}
