// Track position changes with ResizeObserver
import { Observable, Observer, SubscriptionOptions, SynchronousObservable } from "../utils/observable";

export type CanvasUpdateObserver = (rect: DOMRect) => void;

export class CanvasPositionDimensionPublisher {

    private lastRect?: DOMRect;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private mutationObserver: MutationObserver;
    private scrollHandler?: (() => void);
    private resizeHandler?: (() => void);
    private _observers: SynchronousObservable<Parameters<CanvasUpdateObserver>>;

    constructor(canvas?: HTMLCanvasElement) {
        this._observers = new SynchronousObservable<Parameters<CanvasUpdateObserver>>();

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

    onPositionUpdate(observer: Observer<[DOMRect]>, options?: SubscriptionOptions) {
        return this._observers.subscribe(observer, options);
    }

    private attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    const canvas = mutation.target as HTMLCanvasElement;
                    canvas.style.width = canvas.width / window.devicePixelRatio + "px";
                    const newRect = (mutation.target as HTMLCanvasElement).getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(mutation.target as HTMLCanvasElement));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                } else if(mutation.attributeName === "height"){
                    const canvas = mutation.target as HTMLCanvasElement;
                    canvas.style.height = canvas.height / window.devicePixelRatio + "px";
                    const newRect = canvas.getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(mutation.target as HTMLCanvasElement));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                } else if (mutation.attributeName === "style"){
                    const canvas = mutation.target as HTMLCanvasElement;
                    const styleWidth = parseFloat((mutation.target as HTMLCanvasElement).style.width);
                    const styleHeight = parseFloat((mutation.target as HTMLCanvasElement).style.height);
                    const newWidth = styleWidth * window.devicePixelRatio;
                    const newHeight = styleHeight * window.devicePixelRatio;
                    if(newWidth != canvas.width){
                        canvas.width = newWidth;
                    }
                    if(newHeight != canvas.height){
                        canvas.height = newHeight;
                    }
                    const newRect = (mutation.target as HTMLCanvasElement).getBoundingClientRect();
                    const trueRect = getTrueRect(newRect, window.getComputedStyle(mutation.target as HTMLCanvasElement));
                    if (rectChanged(this.lastRect, trueRect)) {
                        this.publishPositionUpdate(trueRect);
                        this.lastRect = trueRect;
                    }
                }
            }
        }
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

function rectChanged(r1: DOMRect | undefined, r2: DOMRect) {
    if(r1 === undefined){
        return true;
    }
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
