import { Train } from './formation';

export type PlacedTrainEntry = { id: number; train: Train };

/**
 * Manages a list of placed trains and the currently selected train.
 * Notifies subscribers when the list or selection changes so UI can re-render.
 *
 * @group Train System
 */
export class TrainManager {
  private _placedTrains: PlacedTrainEntry[] = [];
  private _nextId = 0;
  private _selectedIndex = 0;
  private _listeners: (() => void)[] = [];

  /** Current list of placed trains (do not mutate). */
  getPlacedTrains(): readonly PlacedTrainEntry[] {
    return this._placedTrains;
  }

  /** Index of the currently selected train, or 0 if none. */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  setSelectedIndex(index: number): void {
    const next = Math.max(0, Math.min(index, this._placedTrains.length - 1));
    if (next === this._selectedIndex) return;
    this._selectedIndex = next;
    this._notify();
  }

  /** The currently selected train, or null if there are no placed trains. */
  getSelectedTrain(): Train | null {
    if (this._placedTrains.length === 0) return null;
    const i = Math.min(this._selectedIndex, this._placedTrains.length - 1);
    return this._placedTrains[i].train;
  }

  /** Add a train to the list (e.g. after placement). Returns the assigned id. */
  addTrain(train: Train): number {
    const id = this._nextId++;
    this._placedTrains.push({ id, train });
    if (this._placedTrains.length === 1) this._selectedIndex = 0;
    this._notify();
    return id;
  }

  /** Remove the train at the given list index. */
  removeTrainAtIndex(index: number): void {
    if (index < 0 || index >= this._placedTrains.length) return;
    this._placedTrains.splice(index, 1);
    if (this._selectedIndex >= this._placedTrains.length) {
      this._selectedIndex = Math.max(0, this._placedTrains.length - 1);
    } else if (this._selectedIndex > index) {
      this._selectedIndex -= 1;
    }
    this._notify();
  }

  /** Remove the currently selected train. */
  removeSelectedTrain(): boolean {
    if (this._placedTrains.length === 0) return false;
    this.removeTrainAtIndex(this._selectedIndex);
    return true;
  }

  /** Subscribe to list/selection changes. Returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    this._listeners.push(listener);
    return () => {
      const i = this._listeners.indexOf(listener);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}
