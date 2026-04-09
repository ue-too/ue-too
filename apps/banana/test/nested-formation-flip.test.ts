import { Car, generateCarId, generateFormationId } from '../src/trains/cars';
import { Formation } from '../src/trains/formation';
import { FormationManager } from '../src/trains/formation-manager';
import { CarStockManager } from '../src/trains/car-stock-manager';

function makeCar(id: string): Car {
    return new Car(id, [10], 2, 2);
}

describe('Nested formation flip operations', () => {
    let carStock: CarStockManager;
    let manager: FormationManager;

    beforeEach(() => {
        carStock = new CarStockManager();
        manager = new FormationManager(carStock);
    });

    describe('reverseNestedChildren', () => {
        it('reverses the order of children in a nested formation without flipping direction', () => {
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');

            const nested = new Formation(generateFormationId(), [carA, carB]);
            carStock.addCar(carC);
            const parent = manager.createFormation(['C']);
            manager.addFormation(nested);
            manager.appendFormation(parent.id, nested.id);

            const nestedChild = parent.originalChildren.find(c => c.depth > 0)!;
            expect(nestedChild.flatCars().map(c => c.id)).toEqual(['A', 'B']);

            const nestedIndex = parent.originalChildren.indexOf(nestedChild);
            manager.reverseNestedChildren(parent.id, nestedIndex);

            // Order reversed, but cars NOT flipped
            expect(nestedChild.flatCars().map(c => c.id)).toEqual(['B', 'A']);
            expect(nestedChild.flipped).toBe(false);
            expect(carA.flipped).toBe(false);
            expect(carB.flipped).toBe(false);
        });

        it('throws when child at index is not a nested formation', () => {
            const carA = makeCar('A');
            carStock.addCar(carA);
            const parent = manager.createFormation(['A']);

            expect(() => manager.reverseNestedChildren(parent.id, 0)).toThrow(
                /not a nested formation/
            );
        });

        it('throws when formation id is not found', () => {
            expect(() => manager.reverseNestedChildren('nonexistent', 0)).toThrow(
                /not found/
            );
        });

        it('throws when child index is out of bounds', () => {
            const carA = makeCar('A');
            carStock.addCar(carA);
            const parent = manager.createFormation(['A']);

            expect(() => manager.reverseNestedChildren(parent.id, 5)).toThrow(
                /out of bounds/
            );
        });

        it('notifies observers on change', () => {
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');

            const nested = new Formation(generateFormationId(), [carA, carB]);
            carStock.addCar(carC);
            const parent = manager.createFormation(['C']);
            manager.addFormation(nested);
            manager.appendFormation(parent.id, nested.id);

            const nestedIndex = parent.originalChildren.findIndex(c => c.depth > 0);

            let notified = false;
            manager.subscribe(() => { notified = true; });

            manager.reverseNestedChildren(parent.id, nestedIndex);
            expect(notified).toBe(true);
        });
    });

    describe('flipChildDirection', () => {
        it('flips a single car direction without affecting others', () => {
            const carA = makeCar('A');
            const carB = makeCar('B');
            carStock.addCar(carA);
            carStock.addCar(carB);
            const parent = manager.createFormation(['A', 'B']);

            expect(carA.flipped).toBe(false);
            expect(carB.flipped).toBe(false);

            // Flip only car A (index 0)
            manager.flipChildDirection(parent.id, 0);

            expect(carA.flipped).toBe(true);
            expect(carB.flipped).toBe(false);
            // Order unchanged
            expect(parent.flatCars().map(c => c.id)).toEqual(['A', 'B']);
        });

        it('flips direction of all cars in a nested formation without reordering', () => {
            // Parent: [C, nested=[A, B]]
            // Flip nested → [C, nested=[A(f), B(f)]] — order preserved, cars flipped
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');

            const nested = new Formation(generateFormationId(), [carA, carB]);
            carStock.addCar(carC);
            const parent = manager.createFormation(['C']);
            manager.addFormation(nested);
            manager.appendFormation(parent.id, nested.id);

            const nestedIndex = parent.originalChildren.findIndex(c => c.depth > 0);
            manager.flipChildDirection(parent.id, nestedIndex);

            // Order preserved, but each car is flipped
            expect(nested.flatCars().map(c => c.id)).toEqual(['A', 'B']);
            expect(carA.flipped).toBe(true);
            expect(carB.flipped).toBe(true);
            // C is untouched
            expect(carC.flipped).toBe(false);
        });

        it('flipping only one child leaves others untouched', () => {
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');
            carStock.addCar(carA);
            carStock.addCar(carB);
            carStock.addCar(carC);
            const parent = manager.createFormation(['A', 'B', 'C']);

            manager.flipChildDirection(parent.id, 1); // flip B only

            expect(carA.flipped).toBe(false);
            expect(carB.flipped).toBe(true);
            expect(carC.flipped).toBe(false);
        });

        it('double flip restores original direction', () => {
            const carA = makeCar('A');
            carStock.addCar(carA);
            const parent = manager.createFormation(['A']);

            manager.flipChildDirection(parent.id, 0);
            expect(carA.flipped).toBe(true);

            manager.flipChildDirection(parent.id, 0);
            expect(carA.flipped).toBe(false);
        });

        it('throws when formation id is not found', () => {
            expect(() => manager.flipChildDirection('nonexistent', 0)).toThrow(
                /not found/
            );
        });

        it('throws when child index is out of bounds', () => {
            const carA = makeCar('A');
            carStock.addCar(carA);
            const parent = manager.createFormation(['A']);

            expect(() => manager.flipChildDirection(parent.id, 5)).toThrow(
                /out of bounds/
            );
        });

        it('invalidates parent formation cache', () => {
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');

            const nested = new Formation(generateFormationId(), [carA, carB]);
            carStock.addCar(carC);
            const parent = manager.createFormation(['C']);
            manager.addFormation(nested);
            manager.appendFormation(parent.id, nested.id);

            // Populate cache
            parent.flatCars();
            parent.bogieOffsets();

            const nestedIndex = parent.originalChildren.findIndex(c => c.depth > 0);
            manager.flipChildDirection(parent.id, nestedIndex);

            // Cache should be invalidated — flatCars still returns correct data
            expect(parent.flatCars().map(c => c.id)).toEqual(['C', 'A', 'B']);
        });

        it('notifies observers on change', () => {
            const carA = makeCar('A');
            carStock.addCar(carA);
            const parent = manager.createFormation(['A']);

            let notified = false;
            manager.subscribe(() => { notified = true; });

            manager.flipChildDirection(parent.id, 0);
            expect(notified).toBe(true);
        });
    });

    describe('composing reverse + flip achieves switch direction', () => {
        it('reverse then flip produces same result as switchDirection', () => {
            // [A, B] → reverse → [B, A] → flip → [B(f), A(f)]
            // This is equivalent to switchDirection: reverse order + flip each car
            const carA = makeCar('A');
            const carB = makeCar('B');
            const carC = makeCar('C');

            const nested = new Formation(generateFormationId(), [carA, carB]);
            carStock.addCar(carC);
            const parent = manager.createFormation(['C']);
            manager.addFormation(nested);
            manager.appendFormation(parent.id, nested.id);

            const nestedIndex = parent.originalChildren.findIndex(c => c.depth > 0);

            manager.reverseNestedChildren(parent.id, nestedIndex);
            manager.flipChildDirection(parent.id, nestedIndex);

            expect(nested.flatCars().map(c => c.id)).toEqual(['B', 'A']);
            expect(carA.flipped).toBe(true);
            expect(carB.flipped).toBe(true);
        });
    });
});
