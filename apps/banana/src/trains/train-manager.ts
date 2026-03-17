import { GenericEntityManager } from '@/utils';
import { Formation, Train, type TrainPosition } from './formation';
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
  private _onBeforeRemove: ((train: Train) => void) | null = null;
  private _trainFactory: ((position: TrainPosition, formation: Formation) => Train) | null = null;

  /** Register a callback invoked before a train is removed. */
  setOnBeforeRemove(callback: (train: Train) => void): void {
    this._onBeforeRemove = callback;
  }

  /** Register a factory for creating trains from a position and formation. */
  setTrainFactory(factory: (position: TrainPosition, formation: Formation) => Train): void {
    this._trainFactory = factory;
  }

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

  /**
   * Add a train with a specific id. Used when restoring from serialized data.
   * The id must be available (e.g. after clearForLoad).
   */
  addTrainWithId(id: number, train: Train): void {
    this._internalTrainManager.createEntityWithId(id, train);
    this._placedTrains.push({ id, train });
    if (this._placedTrains.length === 1) this._selectedIndex = id;
    this._notify();
    this._observable.notify(id, { type: 'add' });
  }

  /**
   * Remove all trains without running onBeforeRemove. Use when replacing
   * the scene from serialized data (load).
   */
  clearForLoad(): void {
    const ids = this._internalTrainManager.getLivingEntitesIndex();
    for (const id of ids) {
      this._internalTrainManager.destroyEntity(id);
    }
    this._placedTrains = [];
    this._selectedIndex = 0;
    this._notify();
  }

  /** Remove the train with the given entity id. */
  removeTrainAtIndex(id: number): void {
    const entryIndex = this._placedTrains.findIndex((e) => e.id === id);
    if (entryIndex === -1) return;
    const train = this._internalTrainManager.getEntity(id);
    if (train && this._onBeforeRemove) {
      this._onBeforeRemove(train);
    }
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

  /**
   * Split a train at the given child index, creating a new stationary rear train.
   * @returns The new rear train's ID, or null if the split failed.
   */
  decoupleTrainAt(trainId: number, atChildIndex: number): number | null {
    const train = this._internalTrainManager.getEntity(trainId);
    if (!train || !this._trainFactory) return null;

    const result = train.decouple(atChildIndex);
    if (!result) return null;

    const newTrain = this._trainFactory(result.rearHeadPosition, result.rearFormation);
    const newId = this.addTrain(newTrain);
    return newId;
  }

  /**
   * Couple two trains together. The absorber retains its identity; the absorbed is removed.
   * @param absorberId - Train that keeps its ID
   * @param absorbedId - Train that gets merged in and removed
   * @param prependToAbsorber - If true, prepend absorbed to absorber's head; otherwise append to tail
   * @returns true if coupling succeeded
   */
  coupleTrains(absorberId: number, absorbedId: number, prependToAbsorber: boolean): boolean {
    const absorber = this._internalTrainManager.getEntity(absorberId);
    const absorbed = this._internalTrainManager.getEntity(absorbedId);
    if (!absorber || !absorbed) return false;

    // Check coupler locks
    if (prependToAbsorber && absorber.frontCouplerLocked) return false;
    if (!prependToAbsorber && absorber.rearCouplerLocked) return false;

    // Append/prepend children individually to avoid nesting depth issues
    const children = [...absorbed.formation.children];
    if (prependToAbsorber) {
      // Absorber's head moves to absorbed's head position
      const absorbedPos = absorbed.position;
      if (absorbedPos) absorber.setPosition(absorbedPos);
      for (let i = children.length - 1; i >= 0; i--) {
        absorber.formation.prepend(children[i]);
      }
    } else {
      for (const child of children) {
        absorber.formation.append(child);
      }
    }

    // Remove absorbed train without returning cars to stock
    this._removeTrainRaw(absorbedId);

    this._notify();
    return true;
  }

  /** Remove a train without invoking _onBeforeRemove (cars stay on track). */
  private _removeTrainRaw(id: number): void {
    const entryIndex = this._placedTrains.findIndex((e) => e.id === id);
    if (entryIndex === -1) return;
    this._internalTrainManager.destroyEntity(id);
    this._placedTrains.splice(entryIndex, 1);
    if (this._selectedIndex === id) {
      this._selectedIndex =
        this._placedTrains.length > 0 ? this._placedTrains[0].id : 0;
    }
    this._observable.notify(id, { type: 'remove' });
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}
