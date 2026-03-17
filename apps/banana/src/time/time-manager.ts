import { Observable, Observer, SubscriptionOptions, SynchronousObservable } from "@ue-too/board";
import { Application } from "pixi.js";

class TimeManager {

    private _currentTime: number = 0; // the current time in milliseconds
    private _syncTimeObservable: Observable<[number, number]> = new SynchronousObservable<[number, number]>();
    private _pauseObservable: Observable<[boolean]> = new SynchronousObservable<[boolean]>();
    private _speedObservable: Observable<[number]> = new SynchronousObservable<[number]>();

    private _lastTime: number = 0;
    private _interval: number = 0;
    private _paused: boolean = false;
    private _speed: number = 1;

    private _fixDeltaTime: number = 16.667;

    constructor(pixixApp: Application) {

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._lastTime = performance.now();
                this._interval = setInterval(() => {
                    const now = performance.now();
                    const deltaTime = now - this._lastTime;
                    this._lastTime = now;
                    this.update(deltaTime);
                }, this._fixDeltaTime);
            } else {
                clearInterval(this._interval);
            }
        });

        pixixApp.ticker.add((time) => {
            this.update(time.deltaMS);
        });

    }

    get paused(): boolean {
        return this._paused;
    }

    get speed(): number {
        return this._speed;
    }

    setSpeed(speed: number): void {
        if (speed === this._speed) return;
        this._speed = speed;
        this._speedObservable.notify(speed);
    }

    pause(): void {
        if (this._paused) return;
        this._paused = true;
        this._pauseObservable.notify(true);
    }

    resume(): void {
        if (!this._paused) return;
        this._paused = false;
        this._pauseObservable.notify(false);
    }

    update(deltaTime: number) {
        if (this._paused) return;
        const scaled = deltaTime * this._speed;
        this._currentTime += scaled;
        this._syncTimeObservable.notify(this._currentTime, scaled);
    }

    subscribe(observer: Observer<[number, number]>, options?: SubscriptionOptions): () => void {
        return this._syncTimeObservable.subscribe(observer, options);
    }

    subscribePause(observer: Observer<[boolean]>, options?: SubscriptionOptions): () => void {
        return this._pauseObservable.subscribe(observer, options);
    }

    subscribeSpeed(observer: Observer<[number]>, options?: SubscriptionOptions): () => void {
        return this._speedObservable.subscribe(observer, options);
    }
}

export { TimeManager };
