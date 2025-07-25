import { Observable } from "../../src/utils/observable";

describe("observable", ()=>{
    it("should notify observers when data is changed", async ()=>{
        const observable = new Observable<[number]>();
        const observer = jest.fn();
        observable.subscribe(observer);
        observable.notify(1);
        
        // Wait for microtasks to complete
        await Promise.resolve();
        
        expect(observer).toHaveBeenCalledWith(1);
    });

    it("should unsubscribe observer when unsubscribe function is called", async ()=>{
        const observable = new Observable<[number]>();
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

    it("should unsubscribe observer when signal is aborted", async ()=>{
        const observable = new Observable<[number]>();
        const observer = jest.fn();
        const abortController = new AbortController();
        observable.subscribe(observer, {signal: abortController.signal});
        observable.notify(1);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledWith(1);
        abortController.abort();
        observable.notify(2);
        await Promise.resolve();
        expect(observer).toHaveBeenCalledTimes(1);
    });
});
