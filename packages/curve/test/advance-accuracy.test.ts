import { BCurve } from '../src/b-curve';

describe('AdvanceAtTWithLength Accuracy Tests', () => {
    test('Should be accurate near t=0', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        // Test advancing from very near t=0
        const startT = 0.001;
        const advanceLength = 5;

        const result = curve.advanceAtTWithLength(startT, advanceLength);

        expect(result.type).toBe('withinCurve');
        if (result.type === 'withinCurve') {
            const actualAdvance =
                curve.lengthAtT(result.tVal) - curve.lengthAtT(startT);
            const error = Math.abs(actualAdvance - advanceLength);

            // Error should be very small (less than 1% of advance length)
            expect(error).toBeLessThan(advanceLength * 0.01);
            expect(result.tVal).toBeGreaterThan(startT);
        }
    });

    test('Should be accurate near t=1', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        // Test advancing backward from very near t=1
        const startT = 0.999;
        const advanceLength = -5;

        const result = curve.advanceAtTWithLength(startT, advanceLength);

        expect(result.type).toBe('withinCurve');
        if (result.type === 'withinCurve') {
            const actualAdvance =
                curve.lengthAtT(result.tVal) - curve.lengthAtT(startT);
            const error = Math.abs(actualAdvance - advanceLength);

            // Error should be very small (less than 1% of advance length)
            expect(error).toBeLessThan(Math.abs(advanceLength) * 0.01);
            expect(result.tVal).toBeLessThan(startT);
        }
    });

    test('Should be accurate exactly at t=0', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        const startT = 0;
        const advanceLength = 3;

        const result = curve.advanceAtTWithLength(startT, advanceLength);

        expect(result.type).toBe('withinCurve');
        if (result.type === 'withinCurve') {
            const actualAdvance =
                curve.lengthAtT(result.tVal) - curve.lengthAtT(startT);
            const error = Math.abs(actualAdvance - advanceLength);

            // Error should be very small
            expect(error).toBeLessThan(advanceLength * 0.01);
            expect(result.tVal).toBeGreaterThan(0);
        }
    });

    test('Should be accurate exactly at t=1', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        const startT = 1;
        const advanceLength = -3;

        const result = curve.advanceAtTWithLength(startT, advanceLength);

        expect(result.type).toBe('withinCurve');
        if (result.type === 'withinCurve') {
            const actualAdvance =
                curve.lengthAtT(result.tVal) - curve.lengthAtT(startT);
            const error = Math.abs(actualAdvance - advanceLength);

            // Error should be very small
            expect(error).toBeLessThan(Math.abs(advanceLength) * 0.01);
            expect(result.tVal).toBeLessThan(1);
        }
    });

    test('Should handle very small advances accurately', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        const startT = 0.01;
        const smallAdvance = 0.1;

        const result = curve.advanceAtTWithLength(startT, smallAdvance);

        expect(result.type).toBe('withinCurve');
        if (result.type === 'withinCurve') {
            const actualAdvance =
                curve.lengthAtT(result.tVal) - curve.lengthAtT(startT);
            const error = Math.abs(actualAdvance - smallAdvance);

            // Even for very small advances, error should be proportionally small
            expect(error).toBeLessThan(smallAdvance * 0.05); // 5% tolerance for very small values
        }
    });

    test('Should interpolate correctly between LUT points', () => {
        const curve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);

        // Test multiple advances to ensure consistent accuracy
        const testCases = [
            { startT: 0.1, advance: 2 },
            { startT: 0.2, advance: 5 },
            { startT: 0.8, advance: -3 },
            { startT: 0.9, advance: -1 },
        ];

        for (const testCase of testCases) {
            const result = curve.advanceAtTWithLength(
                testCase.startT,
                testCase.advance
            );

            expect(result.type).toBe('withinCurve');
            if (result.type === 'withinCurve') {
                const actualAdvance =
                    curve.lengthAtT(result.tVal) -
                    curve.lengthAtT(testCase.startT);
                const error = Math.abs(actualAdvance - testCase.advance);

                // Error should be small for all cases
                expect(error).toBeLessThan(Math.abs(testCase.advance) * 0.02); // 2% tolerance
            }
        }
    });
});
