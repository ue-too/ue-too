import { Car } from '../src/trains/cars';
import { Formation } from '../src/trains/formation';
import { FormationManager } from '../src/trains/formation-manager';
import { CarStockManager } from '../src/trains/car-stock-manager';

/**
 * Regression test for the formation placement lifecycle.
 *
 * Previously, the FormationSelector maintained its own React state for the
 * selected formation ID.  When `onPlaced` reset the placement engine to the
 * default formation, the React state still held the old ID.  After the
 * formation was returned to the depot, the UI showed it as "selected" but the
 * engine was actually using the default.  Selecting it again appeared to be a
 * no-op because the dropdown value hadn't changed.
 *
 * The fix was to derive the selected value from the engine's
 * `pendingFormation`, so the UI always reflects the engine state.  These tests
 * guard the underlying manager invariants that make the full cycle work.
 */

function makeCar(id: string): Car {
  return new Car(id, [10], 2, 2);
}

describe('Formation placement lifecycle', () => {
  let carStock: CarStockManager;
  let formationManager: FormationManager;

  beforeEach(() => {
    carStock = new CarStockManager();
    formationManager = new FormationManager(carStock);
  });

  it('formation is available in manager after creation', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);

    expect(formationManager.getFormation(formation.id)).toBe(formation);
    expect(formationManager.getFormations().length).toBe(1);
  });

  it('formation is no longer in manager after detach (simulating placement)', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);
    const id = formation.id;

    // Simulate onPlaced: detach the formation
    formationManager.detachFormation(id);

    expect(formationManager.getFormation(id)).toBeNull();
    expect(formationManager.getFormations().length).toBe(0);
  });

  it('formation is available again after being returned to depot', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);
    const id = formation.id;

    // Simulate onPlaced: detach
    formationManager.detachFormation(id);
    expect(formationManager.getFormation(id)).toBeNull();

    // Simulate onBeforeRemove: return to depot
    formationManager.addFormation(formation);
    expect(formationManager.getFormation(id)).toBe(formation);
    expect(formationManager.getFormations().length).toBe(1);
  });

  it('full cycle: create → detach → return → detach again succeeds', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);
    const id = formation.id;

    // First placement
    formationManager.detachFormation(id);
    expect(formationManager.getFormation(id)).toBeNull();

    // Return to depot
    formationManager.addFormation(formation);
    expect(formationManager.getFormation(id)).toBe(formation);

    // Second placement — this is the scenario that was broken
    const detached = formationManager.detachFormation(id);
    expect(detached).toBe(formation);
    expect(formationManager.getFormation(id)).toBeNull();

    // Return again
    formationManager.addFormation(formation);
    expect(formationManager.getFormation(id)).toBe(formation);
  });

  it('detaching a non-existent formation returns null', () => {
    expect(formationManager.detachFormation('nonexistent')).toBeNull();
  });

  it('subscribers are notified on detach and re-add', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);
    const id = formation.id;

    const events: string[] = [];
    formationManager.subscribe(() => events.push('change'));

    formationManager.detachFormation(id);
    expect(events).toEqual(['change']);

    formationManager.addFormation(formation);
    expect(events).toEqual(['change', 'change']);
  });

  it('typed change subscribers receive correct event types', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);
    const id = formation.id;

    const events: { id: string; type: string }[] = [];
    formationManager.subscribeToChanges((fId, type) =>
      events.push({ id: fId, type }),
    );

    // detach fires 'remove'
    formationManager.detachFormation(id);
    expect(events).toEqual([{ id, type: 'remove' }]);

    // re-add fires 'add'
    formationManager.addFormation(formation);
    expect(events).toEqual([
      { id, type: 'remove' },
      { id, type: 'add' },
    ]);
  });

  it('adding a formation that already exists throws', () => {
    const car = makeCar('c1');
    carStock.addCar(car);
    const formation = formationManager.createFormation(['c1']);

    expect(() => formationManager.addFormation(formation)).toThrow(
      'already exists',
    );
  });
});
