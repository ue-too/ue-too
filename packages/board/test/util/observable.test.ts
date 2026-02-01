import {
    AsyncObservable,
    SynchronousObservable,
} from '../../src/utils/observable';

describe('observable', () => {
    it('should notify observers when data is changed', async () => {
        const observable = new AsyncObservable<[number]>();
        const observer = jest.fn();
        observable.subscribe(observer);
        observable.notify(1);

        // Wait for microtasks to complete
        await Promise.resolve();

        expect(observer).toHaveBeenCalledWith(1);
    });

    it('should unsubscribe observer when unsubscribe function is called', async () => {
        const observable = new AsyncObservable<[number]>();
        const observer = jest.fn();
        const unsubscribe = observable.subscribe(observer);
        observable.notify(1);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledWith(1);
        unsubscribe();
        observable.notify(2);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe observer when signal is aborted', async () => {
        const observable = new AsyncObservable<[number]>();
        const observer = jest.fn();
        const abortController = new AbortController();
        observable.subscribe(observer, { signal: abortController.signal });
        observable.notify(1);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledWith(1);
        abortController.abort();
        observable.notify(2);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledTimes(1);
    });
});

describe('SynchronousObservable', () => {
    it('should notify observers immediately when data is changed', () => {
        const observable = new SynchronousObservable<[number]>();
        const observer = jest.fn();
        observable.subscribe(observer);
        observable.notify(1);

        // Synchronous observable should call immediately, no need to wait
        expect(observer).toHaveBeenCalledWith(1);
        expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should notify multiple observers immediately', () => {
        const observable = new SynchronousObservable<[string]>();
        const observer1 = jest.fn();
        const observer2 = jest.fn();
        const observer3 = jest.fn();

        observable.subscribe(observer1);
        observable.subscribe(observer2);
        observable.subscribe(observer3);

        observable.notify('test data');

        // All observers should be called immediately
        expect(observer1).toHaveBeenCalledWith('test data');
        expect(observer2).toHaveBeenCalledWith('test data');
        expect(observer3).toHaveBeenCalledWith('test data');
        expect(observer1).toHaveBeenCalledTimes(1);
        expect(observer2).toHaveBeenCalledTimes(1);
        expect(observer3).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe observer when unsubscribe function is called', () => {
        const observable = new SynchronousObservable<[number]>();
        const observer = jest.fn();
        const unsubscribe = observable.subscribe(observer);
        observable.notify(1);
        expect(observer).toHaveBeenCalledWith(1);
        expect(observer).toHaveBeenCalledTimes(1);

        unsubscribe();
        observable.notify(2);
        expect(observer).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should unsubscribe observer when signal is aborted', () => {
        const observable = new SynchronousObservable<[number]>();
        const observer = jest.fn();
        const abortController = new AbortController();
        observable.subscribe(observer, { signal: abortController.signal });
        observable.notify(1);
        expect(observer).toHaveBeenCalledWith(1);
        expect(observer).toHaveBeenCalledTimes(1);

        abortController.abort();
        observable.notify(2);
        expect(observer).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should not add observer if signal is already aborted', () => {
        const observable = new SynchronousObservable<[number]>();
        const observer = jest.fn();
        const abortController = new AbortController();

        // Abort the signal before subscribing
        abortController.abort();
        observable.subscribe(observer, { signal: abortController.signal });

        observable.notify(1);
        expect(observer).not.toHaveBeenCalled();
    });

    it('should handle multiple data parameters', () => {
        const observable = new SynchronousObservable<
            [string, number, boolean]
        >();
        const observer = jest.fn();
        observable.subscribe(observer);

        observable.notify('hello', 42, true);

        expect(observer).toHaveBeenCalledWith('hello', 42, true);
        expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should handle no data parameters', () => {
        const observable = new SynchronousObservable<[]>();
        const observer = jest.fn();
        observable.subscribe(observer);

        observable.notify();

        expect(observer).toHaveBeenCalledWith();
        expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple notifications in sequence', () => {
        const observable = new SynchronousObservable<[number]>();
        const observer = jest.fn();
        observable.subscribe(observer);

        observable.notify(1);
        observable.notify(2);
        observable.notify(3);

        expect(observer).toHaveBeenCalledTimes(3);
        expect(observer).toHaveBeenNthCalledWith(1, 1);
        expect(observer).toHaveBeenNthCalledWith(2, 2);
        expect(observer).toHaveBeenNthCalledWith(3, 3);
    });

    it('should handle mixed subscription and unsubscription', () => {
        const observable = new SynchronousObservable<[string]>();
        const observer1 = jest.fn();
        const observer2 = jest.fn();
        const observer3 = jest.fn();

        // Subscribe all observers
        const unsubscribe1 = observable.subscribe(observer1);
        const unsubscribe2 = observable.subscribe(observer2);
        const unsubscribe3 = observable.subscribe(observer3);

        observable.notify('first');
        expect(observer1).toHaveBeenCalledTimes(1);
        expect(observer2).toHaveBeenCalledTimes(1);
        expect(observer3).toHaveBeenCalledTimes(1);

        // Unsubscribe observer2
        unsubscribe2();
        observable.notify('second');
        expect(observer1).toHaveBeenCalledTimes(2);
        expect(observer2).toHaveBeenCalledTimes(1); // Should not be called
        expect(observer3).toHaveBeenCalledTimes(2);

        // Unsubscribe observer1
        unsubscribe1();
        observable.notify('third');
        expect(observer1).toHaveBeenCalledTimes(2); // Should not be called
        expect(observer2).toHaveBeenCalledTimes(1); // Should not be called
        expect(observer3).toHaveBeenCalledTimes(3);

        // Unsubscribe observer3
        unsubscribe3();
        observable.notify('fourth');
        expect(observer1).toHaveBeenCalledTimes(2); // Should not be called
        expect(observer2).toHaveBeenCalledTimes(1); // Should not be called
        expect(observer3).toHaveBeenCalledTimes(3); // Should not be called
    });
});
