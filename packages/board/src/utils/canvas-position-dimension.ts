// Track position changes with ResizeObserver
import { Observable, Observer, SubscriptionOptions } from "../utils/observable";

export type CanvasUpdateObserver = (rect: DOMRect) => void;

export class CanvasPositionDimensionPublisher {

    private lastRect: DOMRect;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private scrollHandler: () => void;
    private resizeHandler: () => void;
    private _observers: Observable<Parameters<CanvasUpdateObserver>>;

    constructor(canvas: HTMLCanvasElement) {
        this._observers = new Observable<Parameters<CanvasUpdateObserver>>();
        this.lastRect = canvas.getBoundingClientRect();

        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const newRect = entry.target.getBoundingClientRect();
                const trueRect = getTrueRect(newRect, window.getComputedStyle(entry.target));
                if (rectChanged(this.lastRect, trueRect)) {
                    this.publishPositionUpdate(trueRect);
                    this.lastRect = trueRect;
                }
            }
        });

        this.intersectionObserver = new IntersectionObserver(entries => {
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
        });
        
        // Add scroll handler to detect position changes during scrolling
        this.scrollHandler = (() => {
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);

        // Add window resize handler to detect position changes when window size changes
        this.resizeHandler = (() => {
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
        window.addEventListener('resize', this.resizeHandler, { passive: true });
    }
    
    // Add a cleanup method to remove event listeners
    public dispose(): void {
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        window.removeEventListener('scroll', this.scrollHandler);
        window.removeEventListener('resize', this.resizeHandler);
    }

    attach(canvas: HTMLCanvasElement) {
        this.dispose();
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        this.scrollHandler = (() => {
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        }).bind(this);
        this.resizeHandler = (() => {
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

    onPositionUpdate(observer: Observer<[DOMRect]>, options?: SubscriptionOptions) {
        this._observers.subscribe(observer, options);
    }
}

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

function rectChanged(r1: DOMRect, r2: DOMRect) {
  return r1.top !== r2.top || r1.left !== r2.left || 
         r1.width !== r2.width || r1.height !== r2.height;
}

/**
 * This is for proxying the canvas context methods that need to flip the y-coordinates.
 * @internal
 */
const methodsToFlip: Record<string, number[]> = {
    fillRect: [1],        // [yIndex] - indices of y-coordinates to flip
    strokeRect: [1],
    fillText: [2],
    strokeText: [1],
    lineTo: [1],
    moveTo: [1],
    quadraticCurveTo: [1, 3],
    bezierCurveTo: [1, 3, 5],
    arc: [1],
    drawImage: [2],        // Base case for first two signatures
    rect: [1],
    roundRect: [1],
};

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

