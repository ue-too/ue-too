import { calculateOrderOfMagnitude } from "../../src/utils";

describe("Ruler related utility functions", () => {
    describe("calculateOrderOfMagnitude", () => {
        test("should return 0 for 1", () => {
            expect(calculateOrderOfMagnitude(1)).toBe(0);
        });

        test("should return 0 for 9", () => {
            expect(calculateOrderOfMagnitude(9)).toBe(0);
        });

        test("should return 1 for 10", () => {
            expect(calculateOrderOfMagnitude(10)).toBe(1);
        });

        test("should return 1 for 99", () => {
            expect(calculateOrderOfMagnitude(99)).toBe(1);
        });

        test("should return 2 for 100", () => {
            expect(calculateOrderOfMagnitude(100)).toBe(2);
        });

        test("should return -1 for 0.1", () => {
            expect(calculateOrderOfMagnitude(0.1)).toBe(-1);
        });
        
        test("should return -1 for 0.9", () => {
            expect(calculateOrderOfMagnitude(0.9)).toBe(-1);
        });

        test("should return -2 for 0.01", () => {
            expect(calculateOrderOfMagnitude(0.01)).toBe(-2);
        });

        test("should return -3 for 0.001", () => {
            expect(calculateOrderOfMagnitude(0.001)).toBe(-3);
        });
    });
});
