import { GenericEntityManager } from '@/utils';
import { MAX_FORMATION_DEPTH, Train } from './formation';
import { Observable, SynchronousObservable } from '@ue-too/board';
import type { ProximityDetector, ProximityMatch } from './proximity-detector';

export type PlacedTrainEntry = { id: number; train: Train };

/**
 * Result of a coupling operation.
 *
 * @group Train System
 */
export type CoupleResult =
  | { success: true; keepTrainId: number }
  | { success: false; reason: 'depth_exceeded' }
  | { success: false; reason: 'invalid' };

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
  private _proximityDetector: ProximityDetector | null = null;

  /** Register a callback invoked before a train is removed. */
  setOnBeforeRemove(callback: (train: Train) => void): void {
    this._onBeforeRemove = callback;
  }

  /** Set the proximity detector (owned by TrainRenderSystem, shared here for queries). */
  setProximityDetector(detector: ProximityDetector): void {
    this._proximityDetector = detector;
  }

  /**
   * Get proximity matches for a specific train — trains close enough to couple.
   * Returns an empty array if no proximity detector is set or no matches exist.
   */
  getCouplableCandidates(trainId: number): readonly ProximityMatch[] {
    if (!this._proximityDetector) return [];
    return this._proximityDetector.getMatchesForTrain(trainId);
  }

  /**
   * Subscribe to proximity match changes. The listener fires only when the set
   * of couplable pairs actually changes. Returns an unsubscribe function.
   */
  subscribeToProximityChanges(listener: () => void): () => void {
    if (!this._proximityDetector) return () => {};
    return this._proximityDetector.subscribe(listener);
  }

  /** Current list of placed trains (do not mutate). */
  getPlacedTrains(): readonly PlacedTrainEntry[] {
    return this._placedTrains;
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

  /** O(1) train lookup by entity id. Returns null if not found. */
  getTrainById(id: number): Train | null {
    return this._internalTrainManager.getEntity(id);
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

  /**
   * Decouple a train at the given car indices, splitting it into two trains.
   * The original train keeps the `inherit` side; the new train is registered
   * and its id is returned.
   *
   * @param trainId - Entity id of the train to split.
   * @param headCarIndex - Index of the last car in the head portion.
   * @param tailCarIndex - Index of the first car in the tail portion.
   * @param inherit - Which side the original train keeps.
   * @returns The entity id of the newly created train, or null if the train was not found.
   */
  decoupleTrainAtCar(
    trainId: number,
    headCarIndex: number,
    tailCarIndex: number,
    inherit: 'head' | 'tail',
  ): number | null {
    const train = this._internalTrainManager.getEntity(trainId);
    if (!train) return null;

    const newTrain = train.decoupleAtCar(headCarIndex, tailCarIndex, inherit);
    const newId = this.addTrain(newTrain);
    this._notify();
    return newId;
  }

  /**
   * Couple two trains identified by a proximity match. The train whose tail
   * is at the coupling point keeps its head position; the other train's
   * formation is appended as a nested child and its entity is removed.
   *
   * Returns a typed result — check `success` and `reason` to handle errors.
   */
  coupleTrains(match: ProximityMatch): CoupleResult {
    const trainA = this._internalTrainManager.getEntity(match.trainA.id);
    const trainB = this._internalTrainManager.getEntity(match.trainB.id);
    if (!trainA || !trainB) return { success: false, reason: 'invalid' };

    // Determine which train keeps its head position (the one whose tail is at the junction)
    let keepId: number;
    let removeId: number;
    let keepTrain: Train;
    let removeTrain: Train;
    let needsFlip = false;
    let needsKeepFlip = false;

    const endA = match.trainA.end;
    const endB = match.trainB.end;

    if (endA === 'tail' && endB === 'head') {
      keepId = match.trainA.id; removeId = match.trainB.id;
      keepTrain = trainA; removeTrain = trainB;
    } else if (endA === 'head' && endB === 'tail') {
      keepId = match.trainB.id; removeId = match.trainA.id;
      keepTrain = trainB; removeTrain = trainA;
    } else if (endA === 'tail' && endB === 'tail') {
      keepId = match.trainA.id; removeId = match.trainB.id;
      keepTrain = trainA; removeTrain = trainB;
      needsFlip = true;
    } else {
      // head-head: keep A, flip A so its old head becomes the tail,
      // then append B (unflipped) — B's head connects to A's new tail
      keepId = match.trainA.id; removeId = match.trainB.id;
      keepTrain = trainA; removeTrain = trainB;
      needsKeepFlip = true;
    }

    // Check depth before merging
    if (keepTrain.formation.depth + removeTrain.formation.depth >= MAX_FORMATION_DEPTH) {
      return { success: false, reason: 'depth_exceeded' };
    }

    // For head-to-head: flip the kept train so its head position moves to the
    // old tail end, making the old head the new tail where the other train attaches
    if (needsKeepFlip) {
      keepTrain.switchDirection();
    }

    // Flip the removed train's formation if endpoints face the same way
    if (needsFlip) {
      removeTrain.formation.switchDirection();
    }

    // Append the removed train's entire formation as a nested sub-formation
    keepTrain.formation.append(removeTrain.formation);
    keepTrain.resetMotionState();

    // Remove the other train without returning its formation to depot
    this._destroyTrainEntity(removeId, keepId);

    return { success: true, keepTrainId: keepId };
  }

  /**
   * Remove a train entity without calling _onBeforeRemove.
   * Used by coupleTrains where the formation has been merged, not returned to depot.
   */
  private _destroyTrainEntity(id: number, fallbackSelectionId: number): void {
    const entryIndex = this._placedTrains.findIndex((e) => e.id === id);
    if (entryIndex === -1) return;
    this._internalTrainManager.destroyEntity(id);
    this._placedTrains.splice(entryIndex, 1);
    if (this._selectedIndex === id) {
      this._selectedIndex = fallbackSelectionId;
    }
    this._observable.notify(id, { type: 'remove' });
    this._notify();
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
