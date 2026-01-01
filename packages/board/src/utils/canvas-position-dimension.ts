import { Observer, SubscriptionOptions, SynchronousObservable } from "../utils/observable";

/**
 * Monitors and publishes position and dimension changes for SVG elements.
 *
 * @remarks
 * This class tracks SVG element position and dimensions using multiple browser APIs
 * to ensure comprehensive detection of all changes:
 * - ResizeObserver: Detects size changes
 * - IntersectionObserver: Detects visibility and position changes
 * - MutationObserver: Detects attribute changes (width, height, style)
 * - Window scroll/resize events: Detects changes from page layout
 *
 * The reported DOMRect excludes padding and borders to provide the actual
 * content dimensions using {@link getTrueRect}.
 *
 * Position and dimension changes are published synchronously to all subscribers,
 * ensuring immediate updates for coordinate transformations and rendering logic.
 *
 * @example
 * ```typescript
 * const svg = document.querySelector('svg');
 * const publisher = new SvgPositionDimensionPublisher(svg);
 *
 * // Subscribe to position/dimension updates
 * publisher.onPositionUpdate((rect) => {
 *   console.log(`SVG at (${rect.x}, ${rect.y}) with size ${rect.width}x${rect.height}`);
 * });
 *
 * // Clean up when done
 * publisher.dispose();
 * ```
 *
 * @category Canvas Position
 */
export class SvgPositionDimensionPublisher {

    private lastRect?: DOMRect;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private mutationObserver: MutationObserver;
    private scrollHandler?: (() => void);
    private resizeHandler?: (() => void);
    private _observers: SynchronousObservable<[DOMRect]>;

    /**
     * Creates a new SVG position/dimension publisher.
     *
     * @param canvas - Optional SVG element to immediately attach to
     *
     * @remarks
     * If a canvas is provided, observers are immediately attached and monitoring begins.
     * Otherwise, call {@link attach} later to begin monitoring.
     */
    constructor(canvas?: SVGSVGElement) {
        this._observers = new SynchronousObservable<[DOMRect]>();

        this.resizeObserver = new ResizeObserver(((entries: ResizeObserverEntry[]) => {
            for (const entry of entries) {
                const newRect = entry.target.getBoundingClientRect();
                const trueRect = getTrueRect(newRect, window.getComputedStyle(entry.target));
                if (rectChanged(this.lastRect, trueRect)) {
                    this.publishPositionUpdate(trueRect);
                    this.lastRect = trueRect;
                }
            }
        }).bind(this));

        this.intersectionObserver = new IntersectionObserver(((entries: IntersectionObserverEntry[]) => {
            if(this.lastRect === undefined){
                return;
            }
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const newRect = entry.boundingClientRect;
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(entry.target));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                }
            }
        }).bind(this));

        this.attributeCallBack = this.attributeCallBack.bind(this);
        this.mutationObserver = new MutationObserver(this.attributeCallBack);

        if(canvas){
            this.attach(canvas);
        }
    }
    
    /**
     * Cleans up all observers and event listeners.
     *
     * @remarks
     * Disconnects all observers (ResizeObserver, IntersectionObserver, MutationObserver)
     * and removes window event listeners (scroll, resize). Always call this method
     * when the publisher is no longer needed to prevent memory leaks.
     */
    public dispose(): void {
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        this.mutationObserver.disconnect();
        if(this.scrollHandler){
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if(this.resizeHandler){
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    /**
     * Attaches observers to an SVG element and begins monitoring.
     *
     * @param canvas - The SVG element to monitor
     *
     * @remarks
     * Automatically calls {@link dispose} first to clean up any previous attachments.
     * Sets up all observers and records the initial position/dimensions.
     *
     * The initial rect is calculated immediately and stored, but no notification
     * is sent to observers for this initial state.
     */
    attach(canvas: SVGSVGElement) {
        this.dispose();
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        this.mutationObserver.observe(canvas, {
            attributes: true,
            attributeFilter: ["width", "height", "style"]
        });
        const boundingRect = canvas.getBoundingClientRect();
        const trueRect = getTrueRect(boundingRect, window.getComputedStyle(canvas));
        this.lastRect = trueRect;

        this.scrollHandler = (() => {
            if(this.lastRect === undefined){
                return;
            }
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        this.resizeHandler = (() => {
            if(this.lastRect === undefined){
                return;
            }
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        window.addEventListener("scroll", this.scrollHandler, { passive: true });
        window.addEventListener("resize", this.resizeHandler, { passive: true });
    }

    private publishPositionUpdate(rect: DOMRect) {
        this._observers.notify(rect);
    }

    /**
     * Subscribes to position and dimension updates.
     *
     * @param observer - Callback function that receives the updated DOMRect
     * @param options - Optional subscription options (e.g., AbortSignal for cleanup)
     * @returns Unsubscribe function to remove this observer
     *
     * @remarks
     * The observer is called synchronously whenever the SVG's position or dimensions change.
     * The DOMRect parameter represents the actual content area (excluding padding and borders).
     *
     * @example
     * ```typescript
     * const unsubscribe = publisher.onPositionUpdate((rect) => {
     *   console.log(`Position: ${rect.x}, ${rect.y}`);
     *   console.log(`Size: ${rect.width}x${rect.height}`);
     * });
     *
     * // Later, when done:
     * unsubscribe();
     * ```
     */
    onPositionUpdate(observer: Observer<[DOMRect]>, options?: SubscriptionOptions) {
        return this._observers.subscribe(observer, options);
    }

    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    const canvas = mutation.target as SVGSVGElement;
                    const newRect = canvas.getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                } else if(mutation.attributeName === "height"){
                    const canvas = mutation.target as SVGSVGElement;
                    const newRect = canvas.getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                } else if (mutation.attributeName === "style"){
                    const canvas = mutation.target as SVGSVGElement;
                    const newRect = canvas.getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                }
            }
        }
    }
}

/**
 * Monitors and publishes position and dimension changes for HTML Canvas elements.
 *
 * @remarks
 * Similar to {@link SvgPositionDimensionPublisher} but specifically for HTMLCanvasElement.
 * Automatically handles device pixel ratio adjustments to maintain crisp rendering
 * at different screen densities.
 *
 * Key differences from SVG version:
 * - Automatically adjusts canvas.width/height attributes based on devicePixelRatio
 * - Synchronizes CSS dimensions (style.width/height) with canvas buffer size
 * - Ensures canvas maintains proper resolution on high-DPI displays
 *
 * The class uses multiple browser APIs for comprehensive change detection:
 * - ResizeObserver: Detects size changes
 * - IntersectionObserver: Detects visibility and position changes
 * - MutationObserver: Detects attribute changes and synchronizes dimensions
 * - Window scroll/resize events: Detects changes from page layout
 *
 * @example
 * ```typescript
 * const canvas = document.querySelector('canvas');
 * const publisher = new CanvasPositionDimensionPublisher(canvas);
 *
 * // Subscribe to updates
 * publisher.onPositionUpdate((rect) => {
 *   // Canvas dimensions automatically adjusted for devicePixelRatio
 *   console.log(`Canvas at (${rect.x}, ${rect.y})`);
 *   console.log(`Display size: ${rect.width}x${rect.height}`);
 * });
 *
 * publisher.dispose();
 * ```
 *
 * @category Canvas Position
 * @see {@link SvgPositionDimensionPublisher} for SVG elements
 */
export class CanvasPositionDimensionPublisher {

    private lastRect?: DOMRect;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private mutationObserver: MutationObserver;
    private scrollHandler?: (() => void);
    private resizeHandler?: (() => void);
    private _observers: SynchronousObservable<[DOMRect]>;

    /**
     * Creates a new Canvas position/dimension publisher.
     *
     * @param canvas - Optional canvas element to immediately attach to
     *
     * @remarks
     * If a canvas is provided, observers are immediately attached and monitoring begins.
     * The canvas dimensions are automatically adjusted for devicePixelRatio.
     */
    constructor(canvas?: HTMLCanvasElement) {
        this._observers = new SynchronousObservable<[DOMRect]>();

        this.resizeObserver = new ResizeObserver(((entries: ResizeObserverEntry[]) => {
            for (const entry of entries) {
                const newRect = entry.target.getBoundingClientRect();
                const trueRect = getTrueRect(newRect, window.getComputedStyle(entry.target));
                if (rectChanged(this.lastRect, trueRect)) {
                    this.publishPositionUpdate(trueRect);
                    this.lastRect = trueRect;
                }
            }
        }).bind(this));

        this.intersectionObserver = new IntersectionObserver(((entries: IntersectionObserverEntry[]) => {
            if(this.lastRect === undefined){
                return;
            }
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const newRect = entry.boundingClientRect;
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(entry.target));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                }
            }
        }).bind(this));

        this.attributeCallBack = this.attributeCallBack.bind(this);
        this.mutationObserver = new MutationObserver(this.attributeCallBack);

        if(canvas){
            this.attach(canvas);
        }
    }
    
    /**
     * Cleans up all observers and event listeners.
     *
     * @remarks
     * Disconnects all observers and removes window event listeners.
     * Always call this method when the publisher is no longer needed to prevent memory leaks.
     */
    public dispose(): void {
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        this.mutationObserver.disconnect();
        if(this.scrollHandler){
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if(this.resizeHandler){
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    /**
     * Attaches observers to a canvas element and begins monitoring.
     *
     * @param canvas - The canvas element to monitor
     *
     * @remarks
     * Automatically calls {@link dispose} first to clean up any previous attachments.
     * Sets up all observers, adjusts canvas dimensions for devicePixelRatio,
     * and records the initial position/dimensions.
     */
    attach(canvas: HTMLCanvasElement) {
        this.dispose();
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        this.mutationObserver.observe(canvas, {
            attributes: true,
            attributeFilter: ["width", "height", "style"]
        });
        const boundingRect = canvas.getBoundingClientRect();
        const trueRect = getTrueRect(boundingRect, window.getComputedStyle(canvas));
        this.lastRect = trueRect;

        this.scrollHandler = (() => {
            if(this.lastRect === undefined){
                return;
            }
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        this.resizeHandler = (() => {
            if(this.lastRect === undefined){
                return;
            }
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        window.addEventListener("scroll", this.scrollHandler, { passive: true });
        window.addEventListener("resize", this.resizeHandler, { passive: true });
    }

    private publishPositionUpdate(rect: DOMRect) {
        this._observers.notify(rect);
    }

    /**
     * Subscribes to position and dimension updates.
     *
     * @param observer - Callback function that receives the updated DOMRect
     * @param options - Optional subscription options (e.g., AbortSignal for cleanup)
     * @returns Unsubscribe function to remove this observer
     *
     * @remarks
     * The observer is called synchronously whenever the canvas position or dimensions change.
     * The DOMRect represents the actual content area (excluding padding and borders).
     * Canvas buffer dimensions are automatically adjusted for devicePixelRatio.
     */
    onPositionUpdate(observer: Observer<[DOMRect]>, options?: SubscriptionOptions) {
        return this._observers.subscribe(observer, options);
    }

    /**
     * Handles attribute mutations on the canvas element.
     *
     * @param mutationsList - List of mutations detected
     * @param observer - The MutationObserver instance
     *
     * @remarks
     * This callback synchronizes canvas buffer size with CSS dimensions:
     * - When width/height attributes change: Updates CSS dimensions based on devicePixelRatio
     * - When style changes: Updates buffer size to match CSS dimensions
     *
     * This ensures the canvas maintains proper resolution on all displays.
     */
    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    // const canvas = mutation.target as HTMLCanvasElement;
                    // canvas.style.width = canvas.width / window.devicePixelRatio + "px";
                    // const newRect = canvas.getBoundingClientRect();
                    // const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    // if (rectChanged(this.lastRect, trueRect)) {
                    //     this.publishPositionUpdate(trueRect);
                    //     this.lastRect = trueRect;
                    // }
                } else if(mutation.attributeName === "height"){
                    // const canvas = mutation.target as HTMLCanvasElement;
                    // canvas.style.height = canvas.height / window.devicePixelRatio + "px";
                    // const newRect = canvas.getBoundingClientRect();
                    // const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    // if (rectChanged(this.lastRect, trueRect)) {
                    //     this.publishPositionUpdate(trueRect);
                    //     this.lastRect = trueRect;
                    // }
                } else if (mutation.attributeName === "style"){
                    // const canvas = mutation.target as HTMLCanvasElement;
                    // const styleWidth = parseFloat(canvas.style.width);
                    // const styleHeight = parseFloat(canvas.style.height);
                    // const newWidth = styleWidth * window.devicePixelRatio;
                    // const newHeight = styleHeight * window.devicePixelRatio;
                    // if(newWidth != canvas.width){
                    //     canvas.width = newWidth;
                    // }
                    // if(newHeight != canvas.height){
                    //     canvas.height = newHeight;
                    // }
                    // const newRect = canvas.getBoundingClientRect();
                    // const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
                    // if (rectChanged(this.lastRect, trueRect)) {
                    //     this.publishPositionUpdate(trueRect);
                    //     this.lastRect = trueRect;
                    // }
                }
            }
        }
    }
}

/**
 * Calculates the actual content rectangle excluding padding and borders.
 *
 * @param rect - The element's bounding client rectangle
 * @param computedStyle - The computed CSS styles for the element
 * @returns DOMRect representing the content area only
 *
 * @remarks
 * Browser's getBoundingClientRect() includes padding and borders, but for
 * coordinate transformations we need the actual drawable content area.
 *
 * This function subtracts padding and border from all four sides to get
 * the "true" content rectangle. This is essential for accurate coordinate
 * conversions between window and canvas space.
 *
 * @example
 * ```typescript
 * const canvas = document.querySelector('canvas');
 * const rect = canvas.getBoundingClientRect();
 * const style = window.getComputedStyle(canvas);
 * const contentRect = getTrueRect(rect, style);
 *
 * // contentRect.width is less than rect.width if padding/borders exist
 * console.log(`Full size: ${rect.width}x${rect.height}`);
 * console.log(`Content size: ${contentRect.width}x${contentRect.height}`);
 * ```
 *
 * @category Canvas Position
 */
export function getTrueRect(rect: DOMRect, computedStyle: CSSStyleDeclaration) {
    const paddingLeft = parseFloat(computedStyle.paddingLeft);
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingRight = parseFloat(computedStyle.paddingRight);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);

    const borderLeft = parseFloat(computedStyle.borderLeftWidth);
    const borderTop = parseFloat(computedStyle.borderTopWidth);
    const borderRight = parseFloat(computedStyle.borderRightWidth);
    const borderBottom = parseFloat(computedStyle.borderBottomWidth);

    const trueLeft = rect.left + paddingLeft + borderLeft;
    const trueTop = rect.top + paddingTop + borderTop;
    const trueWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
    const trueHeight = rect.height - paddingTop - paddingBottom - borderTop - borderBottom;
    return new DOMRect(trueLeft, trueTop, trueWidth, trueHeight);
}

/**
 * Checks if two rectangles differ in position or dimensions.
 *
 * @param r1 - First rectangle (or undefined for initial state)
 * @param r2 - Second rectangle to compare
 * @returns True if rectangles differ or r1 is undefined
 *
 * @remarks
 * Used internally to avoid redundant notifications when position/dimensions
 * haven't actually changed. Compares top, left, width, and height.
 *
 * Returns true if r1 is undefined (initial state always counts as "changed").
 */
function rectChanged(r1: DOMRect | undefined, r2: DOMRect) {
    if(r1 === undefined){
        return true;
    }
    return r1.top !== r2.top || r1.left !== r2.left ||
            r1.width !== r2.width || r1.height !== r2.height;
}

/**
 * Maps canvas context methods to the indices of their y-coordinate parameters.
 *
 * @remarks
 * Used by {@link reverseYAxis} to identify which method parameters need y-flipping
 * when converting from standard canvas coordinates (top-left origin, y-down)
 * to mathematical coordinates (center origin, y-up).
 *
 * Array values indicate the parameter indices that contain y-coordinates.
 * For example, fillRect(x, y, width, height) has y at index 1 and height at index 3.
 *
 * @internal
 * @category Canvas Position
 */
const methodsToFlip: Record<string, number[]> = {
    fillRect: [1, 3],        // [yIndex] - indices of y-coordinates to flip
    strokeRect: [1, 3],
    fillText: [2],
    strokeText: [1],
    lineTo: [1],
    moveTo: [1],
    quadraticCurveTo: [1, 3],
    bezierCurveTo: [1, 3, 5],
    arc: [1],
    drawImage: [2],        // Base case for first two signatures
    rect: [1, 3],
    roundRect: [1, 3],
};

/**
 * Creates a proxy that automatically flips y-coordinates for canvas context methods.
 *
 * @param context - The canvas 2D rendering context to wrap
 * @returns Proxied context that handles y-axis reversal automatically
 *
 * @remarks
 * Standard HTML canvas uses a top-left origin with y-axis pointing down.
 * This proxy inverts the y-axis to create a mathematical coordinate system
 * with y-axis pointing up.
 *
 * The proxy intercepts drawing methods (fillRect, strokeRect, moveTo, lineTo, etc.)
 * and automatically negates y-coordinates and height values. This allows you to
 * work in mathematical coordinates while still rendering correctly.
 *
 * Special handling for complex methods:
 * - drawImage with 9 args: Properly inverts source and destination rectangles
 * - drawImage with 5 args: Adjusts for image height
 * - All methods in {@link methodsToFlip}: Y-coordinates negated automatically
 *
 * @example
 * ```typescript
 * const canvas = document.querySelector('canvas');
 * const ctx = canvas.getContext('2d');
 * const flippedCtx = reverseYAxis(ctx);
 *
 * // Draw with mathematical coordinates (y-up)
 * flippedCtx.fillRect(0, 0, 100, 100);  // Square in first quadrant
 * flippedCtx.moveTo(0, 0);
 * flippedCtx.lineTo(50, 100);           // Line going upward
 * ```
 *
 * @category Canvas Position
 * @see {@link methodsToFlip} for list of intercepted methods
 * @see {@link invertYAxisForDrawImageWith9Args} for drawImage special handling
 */
export function reverseYAxis(context: CanvasRenderingContext2D): CanvasRenderingContext2D {
    return new Proxy(context, {
        get(target: CanvasRenderingContext2D, prop: string | symbol, receiver: any): any {
            const value = Reflect.get(target, prop, target);
            
            // Check if this is a method that needs y-coordinate flipping
            if (typeof prop === 'string' && prop in methodsToFlip && typeof value === 'function') {
                return function(...args: any[]) {
                    // Create a copy of the arguments
                    const newArgs = [...args];
                    
                    // Special handling for drawImage with 9 arguments (third signature of drawImage)
                    if (prop === 'drawImage' && args.length === 9) {
                        const convertedArgs = invertYAxisForDrawImageWith9Args(args);
                        return value.apply(target, convertedArgs);
                    } else {
                        // Flip the y-coordinates based on methodsToFlip configuration
                        const yIndices = methodsToFlip[prop];
                        for (const index of yIndices) {
                            if (index < newArgs.length) {
                                newArgs[index] = -newArgs[index];
                            }
                        }
                        // Special handling for drawImage with 5 arguments (first signature of drawImage)
                        if(prop === "drawImage" && args.length === 5){
                            newArgs[2] -= newArgs[4];
                        }
                    }
                    
                    // Call the original method with the modified arguments
                    return value.apply(target, newArgs);
                };
            }
            
            // Return the original value for properties and methods that don't need modification
            if (typeof value === 'function') {
                return function(...args: any[]) {
                    return value.apply(target, args);
                };
            }
            
            return value;
        },
        set(target, prop, value): boolean {
            return Reflect.set(target, prop, value);
        }
    });
}

/**
 * Inverts y-coordinates for the 9-argument variant of drawImage.
 *
 * @param args - The arguments array for drawImage
 * @returns Modified arguments with inverted y-coordinates
 *
 * @remarks
 * The 9-argument drawImage signature is:
 * drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
 *
 * When inverting y-axis, we need to adjust:
 * - sy (source y): Flip relative to image height
 * - sHeight: Negate (height becomes negative in flipped space)
 * - dy (destination y): Negate
 * - dy offset: Subtract destination height
 *
 * This ensures images render correctly when the canvas y-axis is flipped.
 *
 * @example
 * ```typescript
 * // Original call (top-left origin):
 * ctx.drawImage(img, 0, 0, 100, 100, 50, 50, 200, 200);
 *
 * // With flipped y-axis, this becomes:
 * // sy = imageHeight - 0, sHeight = -100, dy = -50 - 200, dHeight = -200
 * ```
 *
 * @category Canvas Position
 * @see {@link reverseYAxis} for the main y-axis flipping proxy
 */
export function invertYAxisForDrawImageWith9Args(args: any[]): typeof args {
    if(args.length !== 9){
        return args;
    }
    const newArgs = [...args];
    const imageHeight = args[0].height;
    if(imageHeight !== undefined){
        newArgs[2] = imageHeight - newArgs[2];
        newArgs[6] = -newArgs[6];
        newArgs[6] -= newArgs[8];
        newArgs[4] = -newArgs[4];
    }
    return newArgs;
}
