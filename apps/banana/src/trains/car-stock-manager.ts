import { Observable, SynchronousObservable } from '@ue-too/board';
import { Car, type CarType, generateCarId } from './cars';

export type CarStockEntry = { id: string; car: Car };

type CarStockChangeType = 'add' | 'remove' | 'update';

/**
 * Manages a pool of available cars not currently assigned to any formation.
 * Cars live here until they are placed into a formation, and return here
 * when decoupled.
 */
export class CarStockManager {
    private _cars: Map<string, Car> = new Map();
    private _listeners: (() => void)[] = [];
    private _observable: Observable<[string, { type: CarStockChangeType }]> =
        new SynchronousObservable<[string, { type: CarStockChangeType }]>();
    private _snapshot: readonly CarStockEntry[] = [];

    /** All cars currently in stock. */
    getAvailableCars(): readonly CarStockEntry[] {
        return this._snapshot;
    }

    /** Get a specific car by its ID, or null if not in stock. */
    getCar(id: string): Car | null {
        return this._cars.get(id) ?? null;
    }

    /** Add a car to stock. Returns its ID. */
    addCar(car: Car): string {
        if (this._cars.has(car.id)) {
            throw new Error(`Car with ID ${car.id} is already in stock`);
        }
        this._cars.set(car.id, car);
        this._observable.notify(car.id, { type: 'add' });
        this._notify();
        return car.id;
    }

    /** Create a new car with default parameters and add it to stock. */
    createCar(bogieOffsets: number[] = [20], edgeToBogie: number = 2.5, bogieToEdge: number = 2.5, type?: CarType): Car {
        const car = new Car(generateCarId(), bogieOffsets, edgeToBogie, bogieToEdge, undefined, type);
        this.addCar(car);
        return car;
    }

    /** Change a car's type and notify subscribers. */
    setCarType(carId: string, type: CarType): void {
        const car = this._cars.get(carId);
        if (car === undefined) {
            throw new Error(`Car ${carId} is not in stock`);
        }
        car.type = type;
        this._observable.notify(carId, { type: 'update' });
        this._notify();
    }

    /**
     * Remove a car from stock (e.g. when assigning to a formation).
     * Returns the removed car, or null if not found.
     */
    removeCar(id: string): Car | null {
        const car = this._cars.get(id);
        if (car === undefined) return null;
        this._cars.delete(id);
        this._observable.notify(id, { type: 'remove' });
        this._notify();
        return car;
    }

    /** Rename a car's display name. */
    renameCar(carId: string, name: string): void {
        const car = this._cars.get(carId);
        if (car === undefined) {
            throw new Error(`Car ${carId} is not in stock`);
        }
        car.name = name;
        this._observable.notify(carId, { type: 'update' });
        this._notify();
    }

    /** Whether a car with the given ID exists in stock. */
    has(id: string): boolean {
        return this._cars.has(id);
    }

    /** Clear all cars from stock. Used when loading from serialized data. */
    clearForLoad(): void {
        this._cars.clear();
        this._notify();
    }

    /** Number of cars currently in stock. */
    get count(): number {
        return this._cars.size;
    }

    /** Subscribe to any stock change. Returns unsubscribe function. */
    subscribe(listener: () => void): () => void {
        this._listeners.push(listener);
        return () => {
            const i = this._listeners.indexOf(listener);
            if (i >= 0) this._listeners.splice(i, 1);
        };
    }

    /** Subscribe to typed change events. Returns unsubscribe function. */
    subscribeToChanges(listener: (id: string, type: CarStockChangeType) => void): () => void {
        return this._observable.subscribe((id, { type }) => listener(id, type));
    }

    private _notify(): void {
        this._snapshot = Array.from(this._cars.entries()).map(([id, car]) => ({ id, car }));
        for (const fn of this._listeners) fn();
    }
}
