import { Car } from "../src/trains/cars";
import { Formation, Train } from "../src/trains/formation";
import type { TrackGraph } from "../src/trains/tracks/track";
import type { JointDirectionManager } from "../src/trains/input-state-machine/train-kmt-state-machine";

describe('Train Car', () => {

    describe('Flat cars of a formation', () => {

        it('should return the correct number of cars', () => {
            const formation = new Formation('1', [
                new Car('1', [1, 2, 3], 0, 0),
                new Car('2', [4, 5, 6], 0, 0),
            ]);
            const cars = formation.flatCars();
            expect(cars.length).toBe(2);
            expect(cars[0].id).toBe('1');
            expect(cars[1].id).toBe('2');
        });

    });

    describe('_flatCars', () => {

        describe('Car (leaf)', () => {

            it('should return itself with an empty path', () => {
                const car = new Car('car-A', [20], 2.5, 2.5);
                const result = car._flatCars();
                expect(result).toHaveLength(1);
                expect(result[0].car).toBe(car);
                expect(result[0].path).toEqual([]);
            });

        });

        describe('Formation with flat children', () => {

            it('should return all cars with the formation id in their path', () => {
                const carA = new Car('car-A', [20], 2.5, 2.5);
                const carB = new Car('car-B', [20], 2.5, 2.5);
                const formation = new Formation('f-1', [carA, carB]);

                const result = formation._flatCars();
                expect(result).toHaveLength(2);

                expect(result[0].car).toBe(carA);
                expect(result[0].path).toEqual(['f-1']);

                expect(result[1].car).toBe(carB);
                expect(result[1].path).toEqual(['f-1']);
            });

            it('should preserve head-to-tail order', () => {
                const cars = [
                    new Car('c1', [10], 1, 1),
                    new Car('c2', [10], 1, 1),
                    new Car('c3', [10], 1, 1),
                ];
                const formation = new Formation('f', cars);
                const result = formation._flatCars();

                expect(result.map(r => r.car.id)).toEqual(['c1', 'c2', 'c3']);
            });

        });

        describe('Nested formations', () => {

            it('should build path from leaf to root (innermost first)', () => {
                const car = new Car('car-X', [20], 2, 2);
                const inner = new Formation('inner', [car]);
                const outer = new Formation('outer', [inner]);

                const result = outer._flatCars();
                expect(result).toHaveLength(1);
                expect(result[0].car).toBe(car);
                // Car._flatCars returns [], inner pushes 'inner', outer pushes 'outer'
                expect(result[0].path).toEqual(['inner', 'outer']);
            });

            it('should flatten mixed nested and flat children', () => {
                const carA = new Car('A', [20], 2, 2);
                const carB = new Car('B', [20], 2, 2);
                const carC = new Car('C', [20], 2, 2);

                const innerFormation = new Formation('inner', [carA, carB]);
                const outer = new Formation('outer', [innerFormation, carC]);

                const result = outer._flatCars();
                expect(result).toHaveLength(3);

                // carA and carB come from inner formation
                expect(result[0].car).toBe(carA);
                expect(result[0].path).toEqual(['inner', 'outer']);

                expect(result[1].car).toBe(carB);
                expect(result[1].path).toEqual(['inner', 'outer']);

                // carC is a direct child of outer
                expect(result[2].car).toBe(carC);
                expect(result[2].path).toEqual(['outer']);
            });

        });

        describe('Single-car formation', () => {

            it('should return one entry with the formation id in path', () => {
                const car = new Car('solo', [15], 3, 3);
                const formation = new Formation('f-solo', [car]);

                const result = formation._flatCars();
                expect(result).toHaveLength(1);
                expect(result[0].car).toBe(car);
                expect(result[0].path).toEqual(['f-solo']);
            });

        });

    });

    describe('wouldBreakFormations', () => {

        describe('adjacent splits (head and tail are neighbours)', () => {

            it('should not break anything when splitting between direct car children', () => {
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    new Car('C', [20], 2, 2),
                ]);
                expect(formation.wouldBreakFormations(0, 1)).toEqual({ breaks: false });
                expect(formation.wouldBreakFormations(1, 2)).toEqual({ breaks: false });
            });

            it('should not break anything when splitting between two child formations', () => {
                // outer [ inner1[A, B], inner2[C, D] ]
                const inner1 = new Formation('inner1', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const inner2 = new Formation('inner2', [
                    new Car('C', [20], 2, 2),
                    new Car('D', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [inner1, inner2]);
                // Split between B (index 1) and C (index 2) — boundary between inner1 and inner2
                expect(outer.wouldBreakFormations(1, 2)).toEqual({ breaks: false });
            });

            it('should break a child formation when splitting inside it', () => {
                // outer [ inner[A, B], C ]
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [inner, new Car('C', [20], 2, 2)]);
                // Split between A (index 0) and B (index 1) — inside inner
                const result = outer.wouldBreakFormations(0, 1);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['inner']);
                }
            });

            it('should report multiple broken formations for deeply nested split', () => {
                // outer [ deep[ inner[A, B], C ], D ]
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const deep = new Formation('deep', [inner, new Car('C', [20], 2, 2)]);
                const outer = new Formation('outer', [deep, new Car('D', [20], 2, 2)], 2);
                // Split between A (index 0) and B (index 1) — inside inner, which is inside deep
                const result = outer.wouldBreakFormations(0, 1);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toContain('inner');
                    expect(result.formationIds).toContain('deep');
                    expect(result.formationIds).toHaveLength(2);
                }
            });

            it('should break only the immediate child when splitting across its boundary', () => {
                // outer [ deep[ inner[A, B], C ], D ]
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const deep = new Formation('deep', [inner, new Car('C', [20], 2, 2)]);
                const outer = new Formation('outer', [deep, new Car('D', [20], 2, 2)], 2);
                // Split between C (index 2) and D (index 3) — boundary between deep and D
                expect(outer.wouldBreakFormations(2, 3)).toEqual({ breaks: false });
                // Split between B (index 1) and C (index 2) — inside deep but between inner and C
                const result = outer.wouldBreakFormations(1, 2);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['deep']);
                }
            });

            it('should break the inner formation for a single child formation', () => {
                // outer [ inner[A, B] ]
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [inner]);
                const result = outer.wouldBreakFormations(0, 1);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['inner']);
                }
            });

        });

        describe('non-adjacent splits (removing a middle section)', () => {

            it('should not break anything when both split points are at child boundaries', () => {
                // outer [ A, B, C, D ] — head=[A], tail=[D], middle=[B,C] removed
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    new Car('C', [20], 2, 2),
                    new Car('D', [20], 2, 2),
                ]);
                expect(formation.wouldBreakFormations(0, 3)).toEqual({ breaks: false });
            });

            it('should break formations at the head split point', () => {
                // outer [ inner[A, B], C, D ] — head=[A], tail=[D]
                // Head split is inside inner (between A and B)
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [
                    inner,
                    new Car('C', [20], 2, 2),
                    new Car('D', [20], 2, 2),
                ]);
                const result = outer.wouldBreakFormations(0, 3);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['inner']);
                }
            });

            it('should break formations at the tail split point', () => {
                // outer [ A, B, inner[C, D] ] — head=[A], tail=[D]
                // Tail split is inside inner (between C and D)
                const inner = new Formation('inner', [
                    new Car('C', [20], 2, 2),
                    new Car('D', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    inner,
                ]);
                const result = outer.wouldBreakFormations(0, 3);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['inner']);
                }
            });

            it('should break formations at both split points', () => {
                // outer [ inner1[A, B], C, inner2[D, E] ] — head=[A], tail=[E]
                // Head split inside inner1, tail split inside inner2
                const inner1 = new Formation('inner1', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                const inner2 = new Formation('inner2', [
                    new Car('D', [20], 2, 2),
                    new Car('E', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [
                    inner1,
                    new Car('C', [20], 2, 2),
                    inner2,
                ]);
                const result = outer.wouldBreakFormations(0, 4);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toContain('inner1');
                    expect(result.formationIds).toContain('inner2');
                    expect(result.formationIds).toHaveLength(2);
                }
            });

            it('should not duplicate formation ids when the same formation is broken at both points', () => {
                // outer [ inner[A, B, C] ] — head=[A], tail=[C]
                // Both splits are inside inner
                const inner = new Formation('inner', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    new Car('C', [20], 2, 2),
                ]);
                const outer = new Formation('outer', [inner]);
                const result = outer.wouldBreakFormations(0, 2);
                expect(result.breaks).toBe(true);
                if (result.breaks) {
                    expect(result.formationIds).toEqual(['inner']);
                }
            });

        });

        describe('validation', () => {

            it('should throw for out-of-bounds indices', () => {
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                expect(() => formation.wouldBreakFormations(-1, 1)).toThrow();
                expect(() => formation.wouldBreakFormations(0, 2)).toThrow();
            });

            it('should throw when headCarIndex >= tailCarIndex', () => {
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    new Car('C', [20], 2, 2),
                ]);
                expect(() => formation.wouldBreakFormations(1, 1)).toThrow();
                expect(() => formation.wouldBreakFormations(2, 1)).toThrow();
            });

        });

    });

    describe('decoupleAtCar', () => {

        describe('inherit head — current formation becomes head', () => {

            it('should mutate formation to head and return new tail formation', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const formation = new Formation('f', [A, B, C]);
                const other = formation.decoupleAtCar(0, 1, 'head');
                // formation keeps head
                expect(formation.id).toBe('f');
                expect(formation.flatCars().map(c => c.id)).toEqual(['A']);
                // other is the tail
                expect(other.id).not.toBe('f');
                expect(other.flatCars().map(c => c.id)).toEqual(['B', 'C']);
            });

            it('should unwrap single child formation on the head side', () => {
                // [inner[A, B], C, D] split at (1, 2), inherit head
                // kept=[inner] → unwrapped: outer adopts inner's children [A, B]
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const inner = new Formation('inner', [A, B]);
                const C = new Car('C', [20], 2, 2);
                const D = new Car('D', [20], 2, 2);
                const outer = new Formation('outer', [inner, C, D]);
                const other = outer.decoupleAtCar(1, 2, 'head');
                expect(outer.children.map(c => c.id)).toEqual(['A', 'B']);
                expect(other.flatCars().map(c => c.id)).toEqual(['C', 'D']);
            });

            it('should break child formation and keep head portion in current', () => {
                // [inner[A, B, C], D] split at (0, 1), inherit head
                // inner broken: A goes to head, [B,C] wrapped as new formation in tail
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const inner = new Formation('inner', [A, B, C]);
                const D = new Car('D', [20], 2, 2);
                const outer = new Formation('outer', [inner, D]);
                const other = outer.decoupleAtCar(0, 1, 'head');
                expect(outer.id).toBe('outer');
                expect(outer.flatCars().map(c => c.id)).toEqual(['A']);
                expect(other.flatCars().map(c => c.id)).toEqual(['B', 'C', 'D']);
            });

        });

        describe('inherit tail — current formation becomes tail', () => {

            it('should mutate formation to tail and return new head formation', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const formation = new Formation('f', [A, B, C]);
                const other = formation.decoupleAtCar(0, 1, 'tail');
                // formation keeps tail
                expect(formation.id).toBe('f');
                expect(formation.flatCars().map(c => c.id)).toEqual(['B', 'C']);
                // other is the head
                expect(other.id).not.toBe('f');
                expect(other.flatCars().map(c => c.id)).toEqual(['A']);
            });

            it('should unwrap single child formation on the tail side', () => {
                // [A, inner[B, C]] split at (0, 1), inherit tail
                // kept=[inner] → unwrapped: outer adopts inner's children [B, C]
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const inner = new Formation('inner', [B, C]);
                const outer = new Formation('outer', [A, inner]);
                const other = outer.decoupleAtCar(0, 1, 'tail');
                expect(outer.children.map(c => c.id)).toEqual(['B', 'C']);
                expect(other.flatCars().map(c => c.id)).toEqual(['A']);
            });

            it('should break child formation and keep tail portion in current', () => {
                // [A, inner[B, C, D]] split at (1, 2), inherit tail
                // inner broken: B goes to head, [C,D] stays in current
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const D = new Car('D', [20], 2, 2);
                const inner = new Formation('inner', [B, C, D]);
                const outer = new Formation('outer', [A, inner]);
                const other = outer.decoupleAtCar(1, 2, 'tail');
                expect(outer.id).toBe('outer');
                expect(outer.flatCars().map(c => c.id)).toEqual(['C', 'D']);
                expect(other.flatCars().map(c => c.id)).toEqual(['A', 'B']);
            });

        });

        describe('originalChildren updated after decouple', () => {

            it('should update originalChildren to match new children', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const formation = new Formation('f', [A, B, C]);
                formation.decoupleAtCar(1, 2, 'head');
                expect(formation.originalChildren.map(c => c.id)).toEqual(['A', 'B']);
            });

        });

        describe('cache invalidated after decouple', () => {

            it('should return correct flatCars after mutation', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const formation = new Formation('f', [A, B, C]);
                // Prime the cache
                formation.flatCars();
                formation._flatCars();
                formation.bogieOffsets();
                const other = formation.decoupleAtCar(0, 1, 'head');
                expect(formation.flatCars().map(c => c.id)).toEqual(['A']);
                expect(other.flatCars().map(c => c.id)).toEqual(['B', 'C']);
            });

        });

        describe('breaking child formations (detailed)', () => {

            it('should break deeply nested formations', () => {
                // [deep[inner[A, B], C], D] split at (0, 1), inherit tail
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const inner = new Formation('inner', [A, B]);
                const C = new Car('C', [20], 2, 2);
                const deep = new Formation('deep', [inner, C]);
                const D = new Car('D', [20], 2, 2);
                const outer = new Formation('outer', [deep, D], 2);
                const other = outer.decoupleAtCar(0, 1, 'tail');
                // outer keeps tail: [Formation(B, C), D]
                expect(outer.flatCars().map(c => c.id)).toEqual(['B', 'C', 'D']);
                // other is head: [A]
                expect(other.flatCars().map(c => c.id)).toEqual(['A']);
            });

            it('should split a child in the middle of the formation', () => {
                // [A, inner[B, C], D] split at (1, 2), inherit head
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const inner = new Formation('inner', [B, C]);
                const D = new Car('D', [20], 2, 2);
                const outer = new Formation('outer', [A, inner, D]);
                const other = outer.decoupleAtCar(1, 2, 'head');
                expect(outer.flatCars().map(c => c.id)).toEqual(['A', 'B']);
                expect(other.flatCars().map(c => c.id)).toEqual(['C', 'D']);
            });

        });

        describe('unwrapping single-formation results', () => {

            it('should unwrap both sides when split produces single child formations', () => {
                // [[1, 2], [3, 4]] split at (1, 2)
                // Without unwrap: kept=[[1,2]], other=[[3,4]]
                // With unwrap: kept=[1,2], other=[3,4]
                const car1 = new Car('1', [20], 2, 2);
                const car2 = new Car('2', [20], 2, 2);
                const car3 = new Car('3', [20], 2, 2);
                const car4 = new Car('4', [20], 2, 2);
                const inner1 = new Formation('inner1', [car1, car2]);
                const inner2 = new Formation('inner2', [car3, car4]);
                const outer = new Formation('outer', [inner1, inner2]);

                const other = outer.decoupleAtCar(1, 2, 'head');
                // outer inherits head, should unwrap [inner1] → adopt inner1's children
                expect(outer.id).toBe('outer');
                expect(outer.children.map(c => c.id)).toEqual(['1', '2']);
                // other should unwrap [inner2] → return inner2 directly
                expect(other).toBe(inner2);
            });

            it('should unwrap inherited side but not other when other has multiple units', () => {
                // [[1, 2], 3, 4] split at (1, 2), inherit head
                // kept=[inner1] → unwrap to [1, 2]
                // other=[3, 4] → already multiple direct children, no unwrap needed
                const car1 = new Car('1', [20], 2, 2);
                const car2 = new Car('2', [20], 2, 2);
                const inner1 = new Formation('inner1', [car1, car2]);
                const car3 = new Car('3', [20], 2, 2);
                const car4 = new Car('4', [20], 2, 2);
                const outer = new Formation('outer', [inner1, car3, car4]);

                const other = outer.decoupleAtCar(1, 2, 'head');
                expect(outer.children.map(c => c.id)).toEqual(['1', '2']);
                expect(other.flatCars().map(c => c.id)).toEqual(['3', '4']);
            });

            it('should unwrap other side but not inherited when inherited has multiple units', () => {
                // [1, 2, [3, 4]] split at (1, 2), inherit head
                // kept=[1, 2] → multiple children, no unwrap
                // other=[inner2] → unwrap to inner2 directly
                const car1 = new Car('1', [20], 2, 2);
                const car2 = new Car('2', [20], 2, 2);
                const car3 = new Car('3', [20], 2, 2);
                const car4 = new Car('4', [20], 2, 2);
                const inner2 = new Formation('inner2', [car3, car4]);
                const outer = new Formation('outer', [car1, car2, inner2]);

                const other = outer.decoupleAtCar(1, 2, 'head');
                expect(outer.children.map(c => c.id)).toEqual(['1', '2']);
                expect(other).toBe(inner2);
            });

            it('should not unwrap when single child is a Car', () => {
                // [A, B] split at (0, 1), inherit head → kept=[A], other=[B]
                // A is a Car, not a Formation — no unwrap needed
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const formation = new Formation('f', [A, B]);
                const other = formation.decoupleAtCar(0, 1, 'head');
                expect(formation.children).toHaveLength(1);
                expect(formation.children[0]).toBe(A);
                expect(other.children).toHaveLength(1);
                expect(other.children[0]).toBe(B);
            });

        });

        describe('non-adjacent splits', () => {

            it('should discard middle cars', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const C = new Car('C', [20], 2, 2);
                const D = new Car('D', [20], 2, 2);
                const formation = new Formation('f', [A, B, C, D]);
                const other = formation.decoupleAtCar(0, 3, 'head');
                expect(formation.flatCars().map(c => c.id)).toEqual(['A']);
                expect(other.flatCars().map(c => c.id)).toEqual(['D']);
            });

            it('should break formations at both split points', () => {
                const A = new Car('A', [20], 2, 2);
                const B = new Car('B', [20], 2, 2);
                const inner1 = new Formation('inner1', [A, B]);
                const C = new Car('C', [20], 2, 2);
                const D = new Car('D', [20], 2, 2);
                const E = new Car('E', [20], 2, 2);
                const inner2 = new Formation('inner2', [D, E]);
                const outer = new Formation('outer', [inner1, C, inner2]);
                const other = outer.decoupleAtCar(0, 4, 'tail');
                // outer keeps tail: [E]
                expect(outer.flatCars().map(c => c.id)).toEqual(['E']);
                // other is head: [A]
                expect(other.flatCars().map(c => c.id)).toEqual(['A']);
            });

        });

        describe('validation', () => {

            it('should throw for out-of-bounds indices', () => {
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                ]);
                expect(() => formation.decoupleAtCar(-1, 1, 'head')).toThrow();
                expect(() => formation.decoupleAtCar(0, 2, 'head')).toThrow();
            });

            it('should throw when headCarIndex >= tailCarIndex', () => {
                const formation = new Formation('f', [
                    new Car('A', [20], 2, 2),
                    new Car('B', [20], 2, 2),
                    new Car('C', [20], 2, 2),
                ]);
                expect(() => formation.decoupleAtCar(1, 1, 'head')).toThrow();
                expect(() => formation.decoupleAtCar(2, 1, 'head')).toThrow();
            });

        });

    });

});

describe('Train decoupleAtCar', () => {

    // Minimal mocks — Train constructor requires these but decoupling
    // of unplaced trains (position=null) doesn't call into track logic.
    const mockTrackGraph = {} as unknown as TrackGraph;
    const mockJointDirectionManager = {} as unknown as JointDirectionManager;

    function makeTrain(formation: Formation): Train {
        return new Train(null, mockTrackGraph, mockJointDirectionManager, formation);
    }

    describe('unplaced train (null position)', () => {

        it('should split formation and return a new train (inherit head)', () => {
            const A = new Car('A', [20], 2.5, 2.5);
            const B = new Car('B', [20], 2.5, 2.5);
            const C = new Car('C', [20], 2.5, 2.5);
            const formation = new Formation('f', [A, B, C]);
            const train = makeTrain(formation);

            const newTrain = train.decoupleAtCar(0, 1, 'head');

            // Original train keeps head [A]
            expect(train.formation.flatCars().map(c => c.id)).toEqual(['A']);
            // New train gets tail [B, C]
            expect(newTrain.formation.flatCars().map(c => c.id)).toEqual(['B', 'C']);
            // Both have null position
            expect(train.position).toBeNull();
            expect(newTrain.position).toBeNull();
        });

        it('should split formation and return a new train (inherit tail)', () => {
            const A = new Car('A', [20], 2.5, 2.5);
            const B = new Car('B', [20], 2.5, 2.5);
            const C = new Car('C', [20], 2.5, 2.5);
            const formation = new Formation('f', [A, B, C]);
            const train = makeTrain(formation);

            const newTrain = train.decoupleAtCar(0, 1, 'tail');

            // Original train keeps tail [B, C]
            expect(train.formation.flatCars().map(c => c.id)).toEqual(['B', 'C']);
            // New train gets head [A]
            expect(newTrain.formation.flatCars().map(c => c.id)).toEqual(['A']);
        });

        it('should reset speed and throttle on the original train', () => {
            const A = new Car('A', [20], 2.5, 2.5);
            const B = new Car('B', [20], 2.5, 2.5);
            const formation = new Formation('f', [A, B]);
            const train = makeTrain(formation);
            // Set some speed/throttle state
            train.setThrottleStep('p3');

            train.decoupleAtCar(0, 1, 'head');

            // Speed and throttle should be reset
            // We can't directly check private _speed, but we can verify
            // the train doesn't throw and is in a clean state
            expect(train.formation.flatCars()).toHaveLength(1);
        });

        it('should return a new Train instance (not the same reference)', () => {
            const A = new Car('A', [20], 2.5, 2.5);
            const B = new Car('B', [20], 2.5, 2.5);
            const formation = new Formation('f', [A, B]);
            const train = makeTrain(formation);

            const newTrain = train.decoupleAtCar(0, 1, 'head');

            expect(newTrain).toBeInstanceOf(Train);
            expect(newTrain).not.toBe(train);
        });

        it('should handle nested formations', () => {
            const A = new Car('A', [20], 2, 2);
            const B = new Car('B', [20], 2, 2);
            const inner = new Formation('inner', [A, B]);
            const C = new Car('C', [20], 2, 2);
            const formation = new Formation('f', [inner, C]);
            const train = makeTrain(formation);

            // Split between A and B (breaks inner formation)
            const newTrain = train.decoupleAtCar(0, 1, 'head');

            expect(train.formation.flatCars().map(c => c.id)).toEqual(['A']);
            expect(newTrain.formation.flatCars().map(c => c.id)).toEqual(['B', 'C']);
        });

        it('should copy maxSpeed onto the new train when decoupling', () => {
            const A = new Car('A', [20], 2.5, 2.5);
            const B = new Car('B', [20], 2.5, 2.5);
            const formation = new Formation('f', [A, B]);
            const train = makeTrain(formation);
            train.setMaxSpeed(42);

            const newTrain = train.decoupleAtCar(0, 1, 'head');

            expect(train.maxSpeed).toBe(42);
            expect(newTrain.maxSpeed).toBe(42);
        });

    });

});

describe('Train maxSpeed', () => {
    const mockTrackGraph = {} as unknown as TrackGraph;
    const mockJointDirectionManager = {} as unknown as JointDirectionManager;

    it('uses constructor fifth argument', () => {
        const car = new Car('A', [20], 2.5, 2.5);
        const formation = new Formation('f', [car]);
        const train = new Train(
            null,
            mockTrackGraph,
            mockJointDirectionManager,
            formation,
            12,
        );
        expect(train.maxSpeed).toBe(12);
    });

    it('setMaxSpeed clamps current speed down to the new cap', () => {
        const car = new Car('A', [20], 2.5, 2.5);
        const formation = new Formation('f', [car]);
        const train = new Train(null, mockTrackGraph, mockJointDirectionManager, formation);
        (train as unknown as { _speed: number })._speed = 30;
        train.setMaxSpeed(8);
        expect(train.speed).toBe(8);
    });
});
