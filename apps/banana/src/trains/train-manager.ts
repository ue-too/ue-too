import { GenericEntityManager } from '@/utils';
import { Train } from './formation';
import { Observable, SynchronousObservable } from '@ue-too/board';

export type PlacedTrainEntry = { id: number; train: Train };

type TrainChangeType = 'add' | 'remove' | 'select';

/**
 * Manages a list of placed trains and the currently selected train.
 * Notifies subscribers when the list or selection changes so UI can re-render.
 *
 * @group Train System
 */
export class TrainManager {
  private _internalTrainManager: GenericEntityManager<Train> = new GenericEntityManager<Train>(10);
  private _placedTrains: PlacedTrainEntry[] = [];
  private _selectedIndex = 0;
  private _listeners: (() => void)[] = [];
  private _observable: Observable<[number, { type: TrainChangeType }]> = new SynchronousObservable<[number, { type: TrainChangeType }]>();

  /** Current list of placed trains (do not mutate). */
  getPlacedTrains(): readonly PlacedTrainEntry[] {
    return this._internalTrainManager.getLivingEntitiesWithIndex().map(({ index, entity }) => ({
      id: index,
      train: entity,
    }));
  }

  /** Index of the currently selected train, or 0 if none. */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  setSelectedIndex(index: number): void {
    if (index === this._selectedIndex) return;
    this._selectedIndex = index;
    this._notify();
  }

  /** The currently selected train, or null if there are no placed trains. */
  getSelectedTrain(): Train | null {
    return this._internalTrainManager.getEntity(this._selectedIndex);
  }

  /** Add a train to the list (e.g. after placement). Returns the assigned id. */
  addTrain(train: Train): number {
    const id = this._internalTrainManager.createEntity(train);
    this._placedTrains.push({ id, train });
    if (this._placedTrains.length === 1) this._selectedIndex = id;
    this._notify();
    this._observable.notify(id, { type: 'add' });
    return id;
  }

  /** Remove the train with the given entity id. */
  removeTrainAtIndex(id: number): void {
    const entryIndex = this._placedTrains.findIndex((e) => e.id === id);
    if (entryIndex === -1) return;
    this._internalTrainManager.destroyEntity(id);
    this._placedTrains.splice(entryIndex, 1);
    if (this._selectedIndex === id) {
      // Select another train if available, otherwise 0
      this._selectedIndex =
        this._placedTrains.length > 0 ? this._placedTrains[0].id : 0;
    }
    this._observable.notify(id, { type: 'remove' });
    this._notify();
  }

  /** Remove the currently selected train. */
  removeSelectedTrain(): void {
    this.removeTrainAtIndex(this._selectedIndex);
    return;
  }

  /** Subscribe to list/selection changes. Returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    this._listeners.push(listener);
    return () => {
      const i = this._listeners.indexOf(listener);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  subscribeToChanges(listener: (id: number, type: TrainChangeType) => void): () => void {
    return this._observable.subscribe((id, { type }) => listener(id, type));
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}
