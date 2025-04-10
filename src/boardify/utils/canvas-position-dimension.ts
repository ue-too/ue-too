// Track position changes with ResizeObserver
import { Observable, Observer, SubscriptionOptions } from "src/util/observable";

export type CanvasUpdateObserver = (rect: DOMRect) => void;

export class CanvasPositionDimensionPublisher {

    private lastRect: DOMRect;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private scrollHandler: () => void;
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
        this.scrollHandler = () => {
            const newRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(newRect, window.getComputedStyle(canvas));
            if (rectChanged(this.lastRect, trueRect)) {
                this.publishPositionUpdate(trueRect);
                this.lastRect = trueRect;
            }
        };
        
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
    
    // Add a cleanup method to remove event listeners
    public dispose(): void {
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        window.removeEventListener('scroll', this.scrollHandler);
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
