/**
 * Type definition for an observer callback function.
 *
 * @typeParam T - Tuple type of arguments passed to the observer
 *
 * @remarks
 * Observers are callbacks that get notified when an Observable emits data.
 * The generic type T is a tuple representing the arguments passed to the callback.
 *
 * @example
 * ```typescript
 * // Observer that receives a single string
 * const stringObserver: Observer<[string]> = (message) => {
 *   console.log(message);
 * };
 *
 * // Observer that receives multiple arguments
 * const multiObserver: Observer<[number, string, boolean]> = (num, str, flag) => {
 *   console.log(num, str, flag);
 * };
 * ```
 *
 * @category Observable Pattern
 */
export type Observer<T extends any[]> = (...data: T) => void;

/**
 * Options for subscribing to an Observable.
 *
 * @property signal - Optional AbortSignal for automatic unsubscription
 *
 * @remarks
 * Subscription options allow for automatic cleanup of subscriptions using
 * the AbortController API. When the signal is aborted, the subscription
 * is automatically removed.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * observable.subscribe(
 *   (data) => console.log(data),
 *   { signal: controller.signal }
 * );
 *
 * // Later, abort to unsubscribe
 * controller.abort();
 * ```
 *
 * @category Observable Pattern
 */
export interface SubscriptionOptions {
    signal?: AbortSignal;
}

/**
 * Interface for the Observable pattern implementation.
 *
 * @typeParam T - Tuple type of data emitted to observers
 *
 * @remarks
 * Observables allow multiple observers to subscribe and receive notifications
 * when data is emitted. This is the pub-sub pattern for event handling.
 *
 * Implementations can be synchronous or asynchronous:
 * - {@link SynchronousObservable}: Notifies observers immediately
 * - {@link AsyncObservable}: Notifies observers via microtasks
 *
 * @category Observable Pattern
 */
export interface Observable<T extends any[]> {
    subscribe(observer: Observer<T>, options?: SubscriptionOptions): () => void;
    notify(...data: T): void;
}

/**
 * Asynchronous Observable implementation that notifies observers via microtasks.
 *
 * @typeParam T - Tuple type of data emitted to observers
 *
 * @remarks
 * This Observable uses `queueMicrotask` to defer observer notifications,
 * ensuring they execute after the current execution context completes but
 * before the next task. This prevents recursive notification issues and
 * allows the notifier to complete before observers run.
 *
 * Use AsyncObservable when:
 * - You want to prevent recursion issues in notifications
 * - Observer execution should not block the notifier
 * - You need guaranteed async behavior
 *
 * @example
 * ```typescript
 * const observable = new AsyncObservable<[string]>();
 *
 * observable.subscribe((message) => {
 *   console.log('Observer received:', message);
 * });
 *
 * console.log('Before notify');
 * observable.notify('Hello');
 * console.log('After notify');
 *
 * // Output:
 * // Before notify
 * // After notify
 * // Observer received: Hello
 * ```
 *
 * @category Observable Pattern
 * @see {@link SynchronousObservable} for synchronous notifications
 */
export class AsyncObservable<T extends any[]> implements Observable<T> {
    private observers: Observer<T>[] = [];

    /**
     * Subscribes an observer to receive notifications.
     *
     * @param observer - The callback function to be notified
     * @param options - Optional subscription options including AbortSignal
     * @returns Unsubscribe function to remove this observer
     *
     * @remarks
     * If an AbortSignal is provided and is already aborted, the observer
     * is not added and the returned unsubscribe function is a no-op.
     */
    subscribe(
        observer: Observer<T>,
        options?: SubscriptionOptions
    ): () => void {
        this.observers.push(observer);

        // Handle AbortSignal
        if (options?.signal) {
            // If signal is already aborted, don't add the observer
            if (options.signal.aborted) {
                this.observers = this.observers.filter(o => o !== observer);
                return () => { };
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

    /**
     * Notifies all observers with the provided data asynchronously.
     *
     * @param data - The data to pass to all observers
     *
     * @remarks
     * Each observer is called via `queueMicrotask`, ensuring async execution.
     * This method returns immediately; observers run later in the event loop.
     */
    notify(...data: T): void {
        this.observers.forEach(observer =>
            queueMicrotask(() => observer(...data))
        );
    }
}

/**
 * Synchronous Observable implementation that notifies observers immediately.
 *
 * @typeParam T - Tuple type of data emitted to observers
 *
 * @remarks
 * This Observable calls all observers synchronously and immediately when
 * `notify()` is called. The notify method doesn't return until all observers
 * have executed.
 *
 * Use SynchronousObservable when:
 * - You need immediate, guaranteed execution of observers
 * - Observer execution order matters and must be predictable
 * - You're in a performance-critical path (no async overhead)
 *
 * Caution: Can lead to recursion issues if observers trigger notifications.
 *
 * @example
 * ```typescript
 * const observable = new SynchronousObservable<[string]>();
 *
 * observable.subscribe((message) => {
 *   console.log('Observer received:', message);
 * });
 *
 * console.log('Before notify');
 * observable.notify('Hello');
 * console.log('After notify');
 *
 * // Output:
 * // Before notify
 * // Observer received: Hello
 * // After notify
 * ```
 *
 * @category Observable Pattern
 * @see {@link AsyncObservable} for asynchronous notifications
 */
export class SynchronousObservable<T extends any[]> implements Observable<T> {
    private observers: Observer<T>[] = [];

    /**
     * Subscribes an observer to receive notifications.
     *
     * @param observer - The callback function to be notified
     * @param options - Optional subscription options including AbortSignal
     * @returns Unsubscribe function to remove this observer
     *
     * @remarks
     * If an AbortSignal is provided and is already aborted, the observer
     * is not added and the returned unsubscribe function is a no-op.
     */
    subscribe(
        observer: Observer<T>,
        options?: SubscriptionOptions
    ): () => void {
        this.observers.push(observer);

        // Handle AbortSignal
        if (options?.signal) {
            // If signal is already aborted, don't add the observer
            if (options.signal.aborted) {
                this.observers = this.observers.filter(o => o !== observer);
                return () => { };
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

    /**
     * Notifies all observers with the provided data synchronously.
     *
     * @param data - The data to pass to all observers
     *
     * @remarks
     * Each observer is called immediately in order. This method blocks until
     * all observers have completed execution.
     */
    notify(...data: T): void {
        this.observers.forEach(observer => observer(...data));
    }
}

// Usage example
// const observable = new Observable<[string]>();

// Create an AbortController
// const controller = new AbortController();

// Subscribe with AbortSignal
// const unsubscribe = observable.subscribe(
//   (data) => console.log('Received:', data),
//   { signal: controller.signal }
// );

// Example notifications
// observable.notify('Hello!'); // Observer will receive this

// Abort the subscription
// controller.abort();

// Observer won't receive this notification
// observable.notify('World!');

// Alternative way to unsubscribe using the returned function
// unsubscribe();
