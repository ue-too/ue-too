import { Matrix } from "../src/matrix";
import { Point } from "../src";

describe("Matrix", () => {
    describe("inverse", () => {
        it("should invert an identity matrix", () => {
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            expect(matrix.inverse).toEqual({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });
        });

        it("should invert a translation matrix", () => {
            // Translation by (5, 10)
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 5,
                f: 10,
                g: 0,
                h: 0,
                i: 1,
            });

            const inv = matrix.inverse;
            expect(inv).not.toBeNull();
            expect(inv).toEqual({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: -5,
                f: -10,
                g: 0,
                h: 0,
                i: 1,
            });
        });

        it("should invert a scaling matrix", () => {
            // Scale by (2, 3)
            const matrix = new Matrix({
                a: 2,
                b: 0,
                c: 0,
                d: 3,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const inv = matrix.inverse;
            expect(inv).not.toBeNull();
            expect(inv).toEqual({
                a: 0.5,
                b: 0,
                c: 0,
                d: 1 / 3,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });
        });

        it("should invert a rotation matrix", () => {
            // 90 degree rotation (cos(90°) = 0, sin(90°) = 1)
            const matrix = new Matrix({
                a: 0,
                b: 1,
                c: -1,
                d: 0,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const inv = matrix.inverse;
            expect(inv).not.toBeNull();
            // Inverse of 90° rotation is -90° rotation
            expect(inv!.a).toBeCloseTo(0, 10);
            expect(inv!.b).toBe(-1);
            expect(inv!.c).toBe(1);
            expect(inv!.d).toBeCloseTo(0, 10);
            expect(inv!.e).toBeCloseTo(0, 10);
            expect(inv!.f).toBeCloseTo(0, 10);
            expect(inv!.g).toBeCloseTo(0, 10);
            expect(inv!.h).toBeCloseTo(0, 10);
            expect(inv!.i).toBe(1);
        });

        it("should return null for a singular matrix", () => {
            // Matrix with zero determinant (all zeros in first two rows)
            const matrix = new Matrix({
                a: 0,
                b: 0,
                c: 0,
                d: 0,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            expect(matrix.inverse).toBeNull();
        });

        it("should return null for a matrix with near-zero determinant", () => {
            // Matrix with very small determinant
            const matrix = new Matrix({
                a: 1e-11,
                b: 0,
                c: 0,
                d: 1e-11,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            expect(matrix.inverse).toBeNull();
        });

        it("should invert a combined transformation matrix", () => {
            // Combined: scale(2, 2) then translate(3, 4)
            const matrix = new Matrix({
                a: 2,
                b: 0,
                c: 0,
                d: 2,
                e: 3,
                f: 4,
                g: 0,
                h: 0,
                i: 1,
            });

            const inv = matrix.inverse;
            expect(inv).not.toBeNull();
            // Inverse should be: translate(-3, -4) then scale(0.5, 0.5)
            expect(inv).toEqual({
                a: 0.5,
                b: 0,
                c: 0,
                d: 0.5,
                e: -1.5,
                f: -2,
                g: 0,
                h: 0,
                i: 1,
            });
        });
    });

    describe("transformPoint", () => {
        it("should transform a point with identity matrix", () => {
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 5, y: 10 };
            const result = matrix.transformPoint(point);

            expect(result).toEqual({ x: 5, y: 10 });
        });

        it("should translate a point", () => {
            // Translation by (3, 4)
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 3,
                f: 4,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 2, y: 3 };
            const result = matrix.transformPoint(point);

            expect(result).toEqual({ x: 5, y: 7 });
        });

        it("should scale a point", () => {
            // Scale by (2, 3)
            const matrix = new Matrix({
                a: 2,
                b: 0,
                c: 0,
                d: 3,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 4, y: 5 };
            const result = matrix.transformPoint(point);

            expect(result).toEqual({ x: 8, y: 15 });
        });

        it("should rotate a point 90 degrees", () => {
            // 90 degree rotation: (x, y) -> (-y, x)
            const matrix = new Matrix({
                a: 0,
                b: 1,
                c: -1,
                d: 0,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 3, y: 4 };
            const result = matrix.transformPoint(point);

            expect(result).toEqual({ x: -4, y: 3 });
        });

        it("should handle combined transformations", () => {
            // Scale(2, 2) then translate(1, 1)
            const matrix = new Matrix({
                a: 2,
                b: 0,
                c: 0,
                d: 2,
                e: 1,
                f: 1,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 2, y: 3 };
            const result = matrix.transformPoint(point);

            expect(result).toEqual({ x: 5, y: 7 });
        });

        it("should handle perspective transformation", () => {
            // Matrix with non-zero g, h values (perspective)
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0.001,
                h: 0.001,
                i: 1,
            });

            const point: Point = { x: 100, y: 100 };
            const result = matrix.transformPoint(point);

            // w = 0.001 * 100 + 0.001 * 100 + 1 = 1.2
            // x' = (1 * 100 + 0 * 100 + 0) / 1.2 = 100 / 1.2 ≈ 83.33
            // y' = (0 * 100 + 1 * 100 + 0) / 1.2 = 100 / 1.2 ≈ 83.33
            expect(result.x).toBeCloseTo(83.333, 2);
            expect(result.y).toBeCloseTo(83.333, 2);
        });
    });

    describe("invertPoint", () => {
        it("should invert a transformed point back to original", () => {
            const matrix = new Matrix({
                a: 2,
                b: 0,
                c: 0,
                d: 2,
                e: 3,
                f: 4,
                g: 0,
                h: 0,
                i: 1,
            });

            const originalPoint: Point = { x: 5, y: 10 };
            const transformed = matrix.transformPoint(originalPoint);
            const inverted = matrix.invertPoint(transformed);

            expect(inverted).not.toBeNull();
            expect(inverted!.x).toBeCloseTo(5, 10);
            expect(inverted!.y).toBeCloseTo(10, 10);
        });

        it("should return null when matrix is not invertible", () => {
            const matrix = new Matrix({
                a: 0,
                b: 0,
                c: 0,
                d: 0,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 5, y: 10 };
            const result = matrix.invertPoint(point);

            expect(result).toBeNull();
        });

        it("should handle identity transformation", () => {
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            const point: Point = { x: 7, y: 8 };
            const result = matrix.invertPoint(point);

            expect(result).toEqual({ x: 7, y: 8 });
        });

        it("should round-trip through multiple transformations", () => {
            // Complex transformation: scale + translate + slight rotation
            const matrix = new Matrix({
                a: 1.5,
                b: 0.5,
                c: -0.5,
                d: 1.5,
                e: 10,
                f: 20,
                g: 0,
                h: 0,
                i: 1,
            });

            const originalPoint: Point = { x: 10, y: 20 };
            const transformed = matrix.transformPoint(originalPoint);
            const inverted = matrix.invertPoint(transformed);

            expect(inverted).not.toBeNull();
            expect(inverted!.x).toBeCloseTo(10, 8);
            expect(inverted!.y).toBeCloseTo(20, 8);
        });
    });

    describe("setMatrix", () => {
        it("should update the matrix and recalculate inverse", () => {
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            // Update to a translation matrix
            matrix.setMatrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 5,
                f: 10,
                g: 0,
                h: 0,
                i: 1,
            });

            expect(matrix.inverse).toEqual({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: -5,
                f: -10,
                g: 0,
                h: 0,
                i: 1,
            });

            // Verify transformation works with new matrix
            const point: Point = { x: 2, y: 3 };
            const result = matrix.transformPoint(point);
            expect(result).toEqual({ x: 7, y: 13 });
        });

        it("should handle setting to singular matrix", () => {
            const matrix = new Matrix({
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            matrix.setMatrix({
                a: 0,
                b: 0,
                c: 0,
                d: 0,
                e: 0,
                f: 0,
                g: 0,
                h: 0,
                i: 1,
            });

            expect(matrix.inverse).toBeNull();
        });
    });
});