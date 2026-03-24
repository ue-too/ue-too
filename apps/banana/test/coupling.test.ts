import { TrainManager } from '../src/trains/train-manager';
import { Formation, Train, MAX_FORMATION_DEPTH } from '../src/trains/formation';
import { Car, CarType, generateCarId, generateFormationId } from '../src/trains/cars';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { JointDirectionManager } from '../src/trains/input-state-machine/train-kmt-state-machine';
import type { ProximityMatch } from '../src/trains/proximity-detector';

const mockTrackGraph = {} as unknown as TrackGraph;
const mockJointDirectionManager = {} as unknown as JointDirectionManager;

function makeCar(): Car {
    return new Car(generateCarId(), [20], 2.5, 2.5);
}

function makeFormation(carCount: number): Formation {
    const cars = Array.from({ length: carCount }, () => makeCar());
    return new Formation(generateFormationId(), cars);
}

function makeTrain(formation: Formation): Train {
    return new Train(null, mockTrackGraph, mockJointDirectionManager, formation);
}

function makeMatch(
    idA: number, endA: 'head' | 'tail',
    idB: number, endB: 'head' | 'tail',
    distance = 1,
): ProximityMatch {
    return {
        trainA: { id: idA, end: endA },
        trainB: { id: idB, end: endB },
        distance,
    };
}

describe('TrainManager.coupleTrains', () => {

    let tm: TrainManager;

    beforeEach(() => {
        tm = new TrainManager();
    });

    describe('tail-head (same direction)', () => {
        it('should keep train A and append B as nested child', () => {
            const fA = makeFormation(2);
            const fB = makeFormation(3);
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            const result = tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.keepTrainId).toBe(idA);

            // A's formation now has its original children + B's formation as a nested child
            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!;
            expect(keepTrain).toBeDefined();
            expect(keepTrain.train.formation.flatCars()).toHaveLength(5);
            // B's formation should be the last child
            const children = keepTrain.train.formation.children;
            expect(children[children.length - 1]).toBe(fB);
        });
    });

    describe('head-tail (same direction)', () => {
        it('should keep train B and append A as nested child', () => {
            const fA = makeFormation(2);
            const fB = makeFormation(3);
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            const result = tm.coupleTrains(makeMatch(idA, 'head', idB, 'tail'));

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.keepTrainId).toBe(idB);

            const keepTrain = tm.getPlacedTrains().find(e => e.id === idB)!;
            expect(keepTrain.train.formation.flatCars()).toHaveLength(5);
            const children = keepTrain.train.formation.children;
            expect(children[children.length - 1]).toBe(fA);
        });
    });

    describe('tail-tail (flip needed)', () => {
        it('should keep train A, flip B, and append B as nested child', () => {
            const fA = makeFormation(2);
            const fB = makeFormation(2);
            const bCarsBeforeFlip = [...fB.flatCars()];
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            const result = tm.coupleTrains(makeMatch(idA, 'tail', idB, 'tail'));

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.keepTrainId).toBe(idA);

            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!;
            expect(keepTrain.train.formation.flatCars()).toHaveLength(4);
            // B's formation was flipped — its cars should be in reversed order
            const bChildren = fB.flatCars();
            expect(bChildren[0]).toBe(bCarsBeforeFlip[1]);
            expect(bChildren[1]).toBe(bCarsBeforeFlip[0]);
        });
    });

    describe('head-head (keep train flipped)', () => {
        it('should keep train A (flipped), append B unflipped', () => {
            const fA = makeFormation(2);
            const fB = makeFormation(2);
            const aCarsBeforeFlip = [...fA.flatCars()];
            const bCarsOriginal = [...fB.flatCars()];
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            const result = tm.coupleTrains(makeMatch(idA, 'head', idB, 'head'));

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.keepTrainId).toBe(idA);

            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!;
            expect(keepTrain.train.formation.flatCars()).toHaveLength(4);
            // A's formation was flipped (switchDirection on kept train)
            const aChildren = fA.flatCars();
            expect(aChildren[0]).toBe(aCarsBeforeFlip[1]);
            expect(aChildren[1]).toBe(aCarsBeforeFlip[0]);
            // B's formation was NOT flipped
            const bChildren = fB.flatCars();
            expect(bChildren[0]).toBe(bCarsOriginal[0]);
            expect(bChildren[1]).toBe(bCarsOriginal[1]);
        });
    });

    describe('single-car trains', () => {
        it('should produce a formation with 2 cars', () => {
            const fA = makeFormation(1);
            const fB = makeFormation(1);
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            const result = tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            expect(result.success).toBe(true);
            if (!result.success) return;
            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!;
            expect(keepTrain.train.formation.flatCars()).toHaveLength(2);
        });
    });

    describe('preserved as sub-formation', () => {
        it('should restore original formations when decoupled at the boundary', () => {
            const fA = makeFormation(2);
            const fB = makeFormation(3);
            const originalACars = [...fA.flatCars()];
            const originalBCars = [...fB.flatCars()];
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            // Couple: A keeps, B appended
            const result = tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));
            expect(result.success).toBe(true);

            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!.train;
            expect(keepTrain.formation.flatCars()).toHaveLength(5);

            // Decouple at boundary: headCarIndex=1 (last of A), tailCarIndex=2 (first of B)
            const otherFormation = keepTrain.formation.decoupleAtCar(1, 2, 'head');

            // A's formation should have its original cars
            expect(keepTrain.formation.flatCars()).toHaveLength(2);
            expect(keepTrain.formation.flatCars()[0]).toBe(originalACars[0]);
            expect(keepTrain.formation.flatCars()[1]).toBe(originalACars[1]);

            // Other formation should be B's original
            expect(otherFormation.flatCars()).toHaveLength(3);
            expect(otherFormation.flatCars()[0]).toBe(originalBCars[0]);
            expect(otherFormation.flatCars()[1]).toBe(originalBCars[1]);
            expect(otherFormation.flatCars()[2]).toBe(originalBCars[2]);
        });
    });

    describe('bogieOffsets after coupling', () => {
        it('should produce correct bogie offsets without double-counting edgeToBogie', () => {
            const fA = makeFormation(2); // 2 cars: [2.5, 20, 5, 20]
            const fB = makeFormation(2); // 2 cars: [2.5, 20, 5, 20]
            const idA = tm.addTrain(makeTrain(fA));
            const idB = tm.addTrain(makeTrain(fB));

            tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            const keepTrain = tm.getPlacedTrains().find(e => e.id === idA)!.train;
            const offsets = keepTrain.formation.bogieOffsets();

            // 4 cars × 2 bogies = 8 bogies → 8 offset values
            expect(offsets).toHaveLength(8);
            // Expected: [edgeToBogie, intraCar, gap, intraCar, gap, intraCar, gap, intraCar]
            expect(offsets).toEqual([2.5, 20, 5, 20, 5, 20, 5, 20]);
        });
    });

    describe('depth overflow rejected', () => {
        it('should return depth_exceeded when merging would exceed MAX_FORMATION_DEPTH', () => {
            // Create a formation with depth 2 (nested sub-formation)
            const innerFormation = new Formation(generateFormationId(), [makeCar(), makeCar()]);
            const outerFormation = new Formation(generateFormationId(), [innerFormation], 2);
            const fB = makeFormation(2);

            const idA = tm.addTrain(makeTrain(outerFormation));
            const idB = tm.addTrain(makeTrain(fB));

            // depth 2 + depth 1 = 3 >= MAX_FORMATION_DEPTH (3) → rejected
            const result = tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.reason).toBe('depth_exceeded');

            // Both trains should still exist
            expect(tm.getPlacedTrains()).toHaveLength(2);
        });
    });

    describe('removed train gone from list', () => {
        it('should only have the keep train after coupling', () => {
            const idA = tm.addTrain(makeTrain(makeFormation(2)));
            const idB = tm.addTrain(makeTrain(makeFormation(2)));

            tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            const placed = tm.getPlacedTrains();
            expect(placed).toHaveLength(1);
            expect(placed[0].id).toBe(idA);
        });

        it('should not return the removed train formation to depot', () => {
            let removedFormations: Formation[] = [];
            tm.setOnBeforeRemove((train) => {
                removedFormations.push(train.formation);
            });

            const idA = tm.addTrain(makeTrain(makeFormation(2)));
            const idB = tm.addTrain(makeTrain(makeFormation(2)));

            tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            // _onBeforeRemove should NOT have been called for coupling
            expect(removedFormations).toHaveLength(0);
        });
    });

    describe('selection updated', () => {
        it('should select the keep train when removed train was selected', () => {
            const idA = tm.addTrain(makeTrain(makeFormation(2)));
            const idB = tm.addTrain(makeTrain(makeFormation(2)));
            tm.setSelectedIndex(idB);

            // B is removed in tail-head coupling (A keeps)
            tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            expect(tm.selectedIndex).toBe(idA);
        });

        it('should keep existing selection when it is not the removed train', () => {
            const idA = tm.addTrain(makeTrain(makeFormation(2)));
            const idB = tm.addTrain(makeTrain(makeFormation(2)));
            const idC = tm.addTrain(makeTrain(makeFormation(2)));
            tm.setSelectedIndex(idC);

            tm.coupleTrains(makeMatch(idA, 'tail', idB, 'head'));

            expect(tm.selectedIndex).toBe(idC);
        });
    });

    describe('invalid inputs', () => {
        it('should return invalid when train A does not exist', () => {
            const idB = tm.addTrain(makeTrain(makeFormation(2)));
            const result = tm.coupleTrains(makeMatch(999, 'tail', idB, 'head'));

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.reason).toBe('invalid');
        });

        it('should return invalid when train B does not exist', () => {
            const idA = tm.addTrain(makeTrain(makeFormation(2)));
            const result = tm.coupleTrains(makeMatch(idA, 'tail', 999, 'head'));

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.reason).toBe('invalid');
        });
    });
});

describe('Car gangway flags', () => {

    it('should default to type-based gangway flags', () => {
        const coach = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.COACH);
        expect(coach.headHasGangway).toBe(true);
        expect(coach.tailHasGangway).toBe(true);

        const loco = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.LOCOMOTIVE);
        expect(loco.headHasGangway).toBe(false);
        expect(loco.tailHasGangway).toBe(false);

        const cab = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.CAB_CAR);
        expect(cab.headHasGangway).toBe(false);
        expect(cab.tailHasGangway).toBe(true);
    });

    it('should swap gangway flags on switchDirection', () => {
        const cab = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.CAB_CAR);
        expect(cab.headHasGangway).toBe(false);
        expect(cab.tailHasGangway).toBe(true);

        cab.switchDirection();

        expect(cab.headHasGangway).toBe(true);
        expect(cab.tailHasGangway).toBe(false);
    });

    it('should allow per-side overrides', () => {
        const coach = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.COACH);
        coach.headHasGangway = false;
        expect(coach.headHasGangway).toBe(false);
        expect(coach.tailHasGangway).toBe(true);
    });

    it('should reset gangway flags when type changes', () => {
        const car = new Car(generateCarId(), [20], 2.5, 2.5, undefined, CarType.COACH);
        car.headHasGangway = false; // override
        expect(car.headHasGangway).toBe(false);

        car.type = CarType.LOCOMOTIVE;
        expect(car.headHasGangway).toBe(false);
        expect(car.tailHasGangway).toBe(false);
        expect(car.type).toBe(CarType.LOCOMOTIVE);
    });

    it('should default to COACH when no type specified', () => {
        const car = new Car(generateCarId(), [20], 2.5, 2.5);
        expect(car.type).toBe(CarType.COACH);
        expect(car.headHasGangway).toBe(true);
        expect(car.tailHasGangway).toBe(true);
    });
});
