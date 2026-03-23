import { describe, it, expect, beforeEach } from 'bun:test';
import { Car, seedIdGeneratorsFromSerialized } from '../src/trains/cars';
import { Formation } from '../src/trains/formation';
import type {
    SerializedCar,
    SerializedFormation,
    SerializedTrainData,
} from '../src/trains/train-serialization';
import {
    validateSerializedTrainData,
} from '../src/trains/train-serialization';

/**
 * Mirror of the private serializeCar — we replicate the logic here so the
 * test does not transitively pull in TrainManager / @/utils (which hang the
 * test runner because of heavy PixiJS / Canvas dependencies).
 */
function serializeCar(car: Car): SerializedCar {
    return {
        id: car.id,
        ...(car.name !== car.id ? { name: car.name } : {}),
        bogieOffsets: car.bogieOffsets(),
        edgeToBogie: car.edgeToBogie,
        bogieToEdge: car.bogieToEdge,
        flipped: car.flipped,
    };
}

function serializeFormation(formation: Formation): SerializedFormation {
    const children = formation.children.map((child) => {
        if (child.depth === 0) {
            return { type: 'car' as const, id: child.id };
        }
        return { type: 'formation' as const, id: child.id };
    });
    return {
        id: formation.id,
        ...(formation.name !== formation.id ? { name: formation.name } : {}),
        children,
        flipped: formation.flipped,
    };
}

function deserializeCar(data: SerializedCar): Car {
    const car = new Car(data.id, [...data.bogieOffsets], data.edgeToBogie, data.bogieToEdge);
    if (data.name !== undefined) {
        car.name = data.name;
    }
    if (data.flipped) {
        car.switchDirection();
    }
    return car;
}

function deserializeFormation(
    data: SerializedFormation,
    carById: Map<string, Car>,
    formationById: Map<string, Formation>,
): Formation {
    const children = data.children.map((child) => {
        if (child.type === 'car') {
            const car = carById.get(child.id);
            if (!car) throw new Error(`Car not found: ${child.id}`);
            return car;
        }
        const nested = formationById.get(child.id);
        if (!nested) throw new Error(`Formation not found: ${child.id}`);
        return nested;
    });
    const depth = 1 + Math.max(0, ...children.map((c) => c.depth));
    const formation = new Formation(data.id, children, depth);
    if (data.name !== undefined) {
        formation.name = data.name;
    }
    if (data.flipped) {
        formation.switchDirection();
    }
    return formation;
}

describe('Car name serialization', () => {

    beforeEach(() => {
        seedIdGeneratorsFromSerialized([], []);
    });

    it('should omit name when it equals the id', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        expect(car.name).toBe('car-0');

        const serialized = serializeCar(car);
        expect(serialized.name).toBeUndefined();
    });

    it('should include name when it differs from the id', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        car.name = 'Express Coach';

        const serialized = serializeCar(car);
        expect(serialized.name).toBe('Express Coach');
    });

    it('should restore car name on deserialization', () => {
        const data: SerializedCar = {
            id: 'car-0', name: 'My Car', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false,
        };

        const car = deserializeCar(data);
        expect(car.name).toBe('My Car');
        expect(car.id).toBe('car-0');
    });

    it('should default car name to id when name is omitted (backwards compatibility)', () => {
        const data: SerializedCar = {
            id: 'car-5', bogieOffsets: [15], edgeToBogie: 3, bogieToEdge: 3, flipped: false,
        };

        const car = deserializeCar(data);
        expect(car.name).toBe('car-5');
    });

    it('should round-trip car name through JSON', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        car.name = 'Sleeper Car';

        const json = JSON.stringify(serializeCar(car));
        const parsed: SerializedCar = JSON.parse(json);
        const restored = deserializeCar(parsed);

        expect(restored.name).toBe('Sleeper Car');
    });

    it('should preserve name when car is flipped', () => {
        const car = new Car('car-0', [20], 2.5, 3.0);
        car.name = 'Flippable';
        car.switchDirection();

        const json = JSON.stringify(serializeCar(car));
        const parsed: SerializedCar = JSON.parse(json);
        const restored = deserializeCar(parsed);

        expect(restored.name).toBe('Flippable');
        expect(restored.flipped).toBe(true);
    });

    it('should preserve bogieOffsets through serialization regardless of name', () => {
        const car = new Car('car-0', [10, 20], 2, 3);
        car.name = 'Custom';

        const serialized = serializeCar(car);
        expect(serialized.bogieOffsets).toEqual([10, 20]);
        expect(serialized.edgeToBogie).toBe(2);
        expect(serialized.bogieToEdge).toBe(3);
    });
});

describe('Formation name serialization', () => {

    beforeEach(() => {
        seedIdGeneratorsFromSerialized([], []);
    });

    it('should omit name when it equals the id', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        const formation = new Formation('formation-0', [car]);
        expect(formation.name).toBe('formation-0');

        const serialized = serializeFormation(formation);
        expect(serialized.name).toBeUndefined();
    });

    it('should include name when it differs from the id', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        const formation = new Formation('formation-0', [car]);
        formation.name = 'Limited Express';

        const serialized = serializeFormation(formation);
        expect(serialized.name).toBe('Limited Express');
    });

    it('should restore formation name on deserialization', () => {
        const carData: SerializedCar = {
            id: 'car-0', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false,
        };
        const car = deserializeCar(carData);

        const formationData: SerializedFormation = {
            id: 'formation-0', name: 'Shinkansen', children: [{ type: 'car', id: 'car-0' }], flipped: false,
        };
        const carById = new Map([['car-0', car]]);
        const formation = deserializeFormation(formationData, carById, new Map());

        expect(formation.name).toBe('Shinkansen');
    });

    it('should default formation name to id when name is omitted (backwards compatibility)', () => {
        const car = deserializeCar({ id: 'car-0', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false });
        const formationData: SerializedFormation = {
            id: 'formation-0', children: [{ type: 'car', id: 'car-0' }], flipped: false,
        };
        const formation = deserializeFormation(formationData, new Map([['car-0', car]]), new Map());

        expect(formation.name).toBe('formation-0');
    });

    it('should round-trip formation name through JSON', () => {
        const car = new Car('car-0', [20], 2.5, 2.5);
        const formation = new Formation('formation-0', [car]);
        formation.name = 'Rapid Service';

        const json = JSON.stringify(serializeFormation(formation));
        const parsed: SerializedFormation = JSON.parse(json);

        const restoredCar = new Car('car-0', [20], 2.5, 2.5);
        const restored = deserializeFormation(parsed, new Map([['car-0', restoredCar]]), new Map());

        expect(restored.name).toBe('Rapid Service');
    });
});

describe('Car and formation names together', () => {

    it('should preserve both car and formation names in a round-trip', () => {
        const carA = new Car('car-0', [20], 2.5, 2.5);
        carA.name = 'Motor Car A';
        const carB = new Car('car-1', [20], 2.5, 2.5);
        carB.name = 'Trailer Car B';
        const carC = new Car('car-2', [15], 3, 3);
        // carC keeps default name

        const formation = new Formation('formation-0', [carA, carB]);
        formation.name = 'Local 4-car';

        // Serialize
        const serializedCars = [serializeCar(carA), serializeCar(carB), serializeCar(carC)];
        const serializedFormation = serializeFormation(formation);

        // JSON round-trip
        const json = JSON.stringify({ cars: serializedCars, formation: serializedFormation });
        const parsed = JSON.parse(json);

        // Deserialize cars
        const restoredCarById = new Map<string, Car>();
        for (const cData of parsed.cars) {
            const c = deserializeCar(cData);
            restoredCarById.set(c.id, c);
        }

        // Deserialize formation
        const restoredFormation = deserializeFormation(parsed.formation, restoredCarById, new Map());

        expect(restoredFormation.name).toBe('Local 4-car');
        const formationCars = restoredFormation.flatCars();
        expect(formationCars[0].name).toBe('Motor Car A');
        expect(formationCars[1].name).toBe('Trailer Car B');

        // Stock car (not in formation) keeps default name
        expect(restoredCarById.get('car-2')!.name).toBe('car-2');
    });
});

describe('Nested formation name serialization', () => {

    it('should preserve names on nested formations', () => {
        const carA = new Car('car-0', [20], 2.5, 2.5);
        carA.name = 'Head Car';
        const carB = new Car('car-1', [20], 2.5, 2.5);

        const inner = new Formation('formation-0', [carA, carB]);
        inner.name = 'Inner Unit';

        const carC = new Car('car-2', [20], 2.5, 2.5);
        const outer = new Formation('formation-1', [inner, carC]);
        outer.name = 'Full Set';

        // Serialize all
        const serializedCars = [serializeCar(carA), serializeCar(carB), serializeCar(carC)];
        const serializedFormations = [serializeFormation(inner), serializeFormation(outer)];

        // JSON round-trip
        const json = JSON.stringify({ cars: serializedCars, formations: serializedFormations });
        const parsed = JSON.parse(json);

        // Deserialize
        const carById = new Map<string, Car>();
        for (const cData of parsed.cars) {
            carById.set(cData.id, deserializeCar(cData));
        }
        const formationById = new Map<string, Formation>();
        // Inner first (no nested deps)
        const restoredInner = deserializeFormation(parsed.formations[0], carById, formationById);
        formationById.set(restoredInner.id, restoredInner);
        // Outer depends on inner
        const restoredOuter = deserializeFormation(parsed.formations[1], carById, formationById);

        expect(restoredOuter.name).toBe('Full Set');

        const innerChild = restoredOuter.children[0] as Formation;
        expect(innerChild.name).toBe('Inner Unit');

        const cars = restoredOuter.flatCars();
        expect(cars[0].name).toBe('Head Car');
        expect(cars[1].name).toBe('car-1');
    });
});

describe('validateSerializedTrainData with names', () => {

    it('should accept data with car name field', () => {
        const data: SerializedTrainData = {
            cars: [{ id: 'car-0', name: 'Named Car', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false }],
            formations: [],
            carStockIds: ['car-0'],
            formationManagerIds: [],
            placedTrains: [],
        };
        expect(validateSerializedTrainData(data)).toEqual({ valid: true });
    });

    it('should accept data without car name field', () => {
        const data: SerializedTrainData = {
            cars: [{ id: 'car-0', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false }],
            formations: [],
            carStockIds: ['car-0'],
            formationManagerIds: [],
            placedTrains: [],
        };
        expect(validateSerializedTrainData(data)).toEqual({ valid: true });
    });

    it('should accept data with formation name field', () => {
        const data: SerializedTrainData = {
            cars: [{ id: 'car-0', bogieOffsets: [20], edgeToBogie: 2.5, bogieToEdge: 2.5, flipped: false }],
            formations: [{ id: 'formation-0', name: 'Express', children: [{ type: 'car', id: 'car-0' }], flipped: false }],
            carStockIds: [],
            formationManagerIds: ['formation-0'],
            placedTrains: [],
        };
        expect(validateSerializedTrainData(data)).toEqual({ valid: true });
    });
});
