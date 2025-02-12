export type Observer<T extends any[]> = (...data: T) => void;

export interface SubscriptionOptions {
    signal?: AbortSignal;
}

export class Observable<T extends any[]> {
    private observers: Observer<T>[] = [];

    subscribe(observer: Observer<T>, options?: SubscriptionOptions): () => void {
        this.observers.push(observer);

        // Handle AbortSignal
        if (options?.signal) {
            // If signal is already aborted, don't add the observer
            if (options.signal.aborted) {
            this.observers = this.observers.filter(o => o !== observer);
            return () => {};
            }

            // Add abort handler
            const abortHandler = () => {
            this.observers = this.observers.filter(o => o !== observer);
            options.signal?.removeEventListener('abort', abortHandler);
            };

            options.signal.addEventListener('abort', abortHandler);
        }

        // Return unsubscribe function
        return () => {
            this.observers = this.observers.filter(o => o !== observer);
        };
    }

    notify(...data: T): void {
        this.observers.forEach(observer => queueMicrotask(() => observer(...data)));
    }
}

// Usage example
const observable = new Observable<[string]>();

// Create an AbortController
const controller = new AbortController();

// Subscribe with AbortSignal
const unsubscribe = observable.subscribe(
  (data) => console.log('Received:', data),
  { signal: controller.signal }
);

// Example notifications
observable.notify('Hello!'); // Observer will receive this

// Abort the subscription
controller.abort();

// Observer won't receive this notification
observable.notify('World!');

// Alternative way to unsubscribe using the returned function
// unsubscribe();