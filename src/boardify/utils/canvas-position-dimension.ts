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
                if (rectChanged(this.lastRect, newRect)) {
                    this.publishPositionUpdate(newRect);
                    this.lastRect = newRect;
                }
            }
        });

        this.intersectionObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const newRect = entry.boundingClientRect;
                    if (rectChanged(this.lastRect, newRect)) {
                        this.publishPositionUpdate(newRect);
                        this.lastRect = newRect;
                    }
                }
            }
        });
        
        // Add scroll handler to detect position changes during scrolling
        this.scrollHandler = () => {
            const newRect = canvas.getBoundingClientRect();
            if (rectChanged(this.lastRect, newRect)) {
                this.publishPositionUpdate(newRect);
                this.lastRect = newRect;
            }
        };
        
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
        console.log("CanvasPositionDimensionPublisher initialized");
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

function rectChanged(r1: DOMRect, r2: DOMRect) {
  return r1.top !== r2.top || r1.left !== r2.left || 
         r1.width !== r2.width || r1.height !== r2.height;
}
