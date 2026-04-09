import { Observable, SynchronousObservable } from '@ue-too/board';
import { TrainUnit, generateFormationId } from './cars';
import { Formation } from './formation';
import { CarStockManager } from './car-stock-manager';

function isFormation(unit: TrainUnit): unit is Formation {
    return unit.depth > 0;
}

export type FormationEntry = { id: string; formation: Formation };

type FormationChangeType = 'add' | 'remove' | 'update';

/**
 * Manages saved formations. Coordinates with CarStockManager to move
 * cars between stock and formations.
 */
export class FormationManager {
    private _formations: Map<string, Formation> = new Map();
    private _carStockManager: CarStockManager;
    private _listeners: (() => void)[] = [];
    private _observable: Observable<[string, { type: FormationChangeType }]> =
        new SynchronousObservable<[string, { type: FormationChangeType }]>();

    constructor(carStockManager: CarStockManager) {
        this._carStockManager = carStockManager;
    }

    /** All saved formations. */
    getFormations(): readonly FormationEntry[] {
        return Array.from(this._formations.entries()).map(([id, formation]) => ({
            id,
            formation,
        }));
    }

    /** Get a specific formation by its ID. */
    getFormation(id: string): Formation | null {
        return this._formations.get(id) ?? null;
    }

    /**
     * Create a new formation from car IDs.
     * Cars are removed from stock and placed into the formation.
     */
    createFormation(carIds: string[]): Formation {
        if (carIds.length === 0) {
            throw new Error('Formation must have at least one car');
        }
        const children: TrainUnit[] = [];
        for (const carId of carIds) {
            const car = this._carStockManager.removeCar(carId);
            if (car === null) {
                // Roll back: return already-removed cars to stock
                for (const child of children) {
                    for (const c of child.flatCars()) {
                        this._carStockManager.addCar(c);
                    }
                }
                throw new Error(`Car ${carId} is not available in stock`);
            }
            children.push(car);
        }
        const formation = new Formation(generateFormationId(), children);
        this._formations.set(formation.id, formation);
        this._observable.notify(formation.id, { type: 'add' });
        this._notify();
        return formation;
    }

    /** Add an existing formation to the manager. */
    addFormation(formation: Formation): void {
        if (this._formations.has(formation.id)) {
            throw new Error(`Formation with ID ${formation.id} already exists`);
        }
        this._formations.set(formation.id, formation);
        this._observable.notify(formation.id, { type: 'add' });
        this._notify();
    }

    /**
     * Delete a formation and return all its cars to stock.
     */
    deleteFormation(id: string): void {
        const formation = this._formations.get(id);
        if (formation === undefined) return;
        // Return all cars to stock
        for (const car of formation.flatCars()) {
            this._carStockManager.addCar(car);
        }
        this._formations.delete(id);
        this._observable.notify(id, { type: 'remove' });
        this._notify();
    }

    /**
     * Detach a formation from the manager without returning cars to stock.
     * Used when a formation is being assigned to a train on the track.
     * Returns the detached formation, or null if not found.
     */
    detachFormation(id: string): Formation | null {
        const formation = this._formations.get(id);
        if (formation === undefined) return null;
        this._formations.delete(id);
        this._observable.notify(id, { type: 'remove' });
        this._notify();
        return formation;
    }

    /**
     * Append a car from stock to the tail of a formation.
     */
    appendCar(formationId: string, carId: string): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        const car = this._carStockManager.removeCar(carId);
        if (car === null) {
            throw new Error(`Car ${carId} is not available in stock`);
        }
        formation.append(car);
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Prepend a car from stock to the head of a formation.
     */
    prependCar(formationId: string, carId: string): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        const car = this._carStockManager.removeCar(carId);
        if (car === null) {
            throw new Error(`Car ${carId} is not available in stock`);
        }
        formation.prepend(car);
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Append another depot formation as a nested child of the target formation.
     * The source formation is removed from the manager (not returned to stock).
     */
    appendFormation(targetId: string, sourceId: string): void {
        const target = this._formations.get(targetId);
        if (target === undefined) {
            throw new Error(`Target formation ${targetId} not found`);
        }
        const source = this._formations.get(sourceId);
        if (source === undefined) {
            throw new Error(`Source formation ${sourceId} not found`);
        }
        target.append(source);
        this._formations.delete(sourceId);
        this._observable.notify(sourceId, { type: 'remove' });
        this._observable.notify(targetId, { type: 'update' });
        this._notify();
    }

    /**
     * Prepend another depot formation as a nested child of the target formation.
     * The source formation is removed from the manager (not returned to stock).
     */
    prependFormation(targetId: string, sourceId: string): void {
        const target = this._formations.get(targetId);
        if (target === undefined) {
            throw new Error(`Target formation ${targetId} not found`);
        }
        const source = this._formations.get(sourceId);
        if (source === undefined) {
            throw new Error(`Source formation ${sourceId} not found`);
        }
        target.prepend(source);
        this._formations.delete(sourceId);
        this._observable.notify(sourceId, { type: 'remove' });
        this._observable.notify(targetId, { type: 'update' });
        this._notify();
    }

    /**
     * Consolidate a formation, flattening all nested formations into direct Car children.
     */
    consolidateFormation(formationId: string): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        formation.consolidate();
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Rename a formation's display name.
     */
    renameFormation(formationId: string, name: string): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        formation.name = name;
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Reverse the children order of a formation (switch direction).
     */
    reverseChildren(formationId: string): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        formation.reverseChildren();
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Reverse the children order of a nested formation at the given child index.
     */
    reverseNestedChildren(formationId: string, childIndex: number): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        const child = formation.originalChildren[childIndex];
        if (child === undefined) {
            throw new Error(
                `Child index ${childIndex} out of bounds for formation ${formationId}`
            );
        }
        if (!isFormation(child)) {
            throw new Error(
                `Child at index ${childIndex} is not a nested formation`
            );
        }
        child.reverseChildren();
        formation.invalidateCache();
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Flip the direction of a child at the given index.
     * For a Car: flips its head/tail orientation.
     * For a nested Formation: flips each of its children's direction without reordering.
     */
    flipChildDirection(formationId: string, childIndex: number): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        const child = formation.originalChildren[childIndex];
        if (child === undefined) {
            throw new Error(
                `Child index ${childIndex} out of bounds for formation ${formationId}`
            );
        }
        if (isFormation(child)) {
            child.flipChildrenDirection();
        } else {
            child.switchDirection();
        }
        formation.invalidateCache();
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Swap two adjacent children in a formation (index with index + 1).
     */
    swapChildren(formationId: string, index: number): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        formation.swapChildren(index);
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /**
     * Remove a child at the given index from a formation and return it to stock.
     */
    removeChild(formationId: string, childIndex: number): void {
        const formation = this._formations.get(formationId);
        if (formation === undefined) {
            throw new Error(`Formation ${formationId} not found`);
        }
        const removed = formation.removeAt(childIndex);
        for (const car of removed.flatCars()) {
            this._carStockManager.addCar(car);
        }
        this._observable.notify(formationId, { type: 'update' });
        this._notify();
    }

    /** Whether a formation with the given ID exists. */
    has(id: string): boolean {
        return this._formations.has(id);
    }

    /** Clear all formations. Used when loading from serialized data. */
    clearForLoad(): void {
        this._formations.clear();
        this._notify();
    }

    /** Number of saved formations. */
    get count(): number {
        return this._formations.size;
    }

    /** Subscribe to any formation change. Returns unsubscribe function. */
    subscribe(listener: () => void): () => void {
        this._listeners.push(listener);
        return () => {
            const i = this._listeners.indexOf(listener);
            if (i >= 0) this._listeners.splice(i, 1);
        };
    }

    /** Subscribe to typed change events. Returns unsubscribe function. */
    subscribeToChanges(listener: (id: string, type: FormationChangeType) => void): () => void {
        return this._observable.subscribe((id, { type }) => listener(id, type));
    }

    private _notify(): void {
        for (const fn of this._listeners) fn();
    }
}
