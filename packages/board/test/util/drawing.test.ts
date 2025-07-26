import { calculateTickValues } from '../../src/utils/drawing';

describe('calculateTickValues', () => {
    it('should calculate correct tick values for a basic range', () => {
        const result = calculateTickValues(0, 100);
        
        expect(result.minMajorTickValue).toBe(0);
        expect(result.maxMajorTickValue).toBe(100);
        expect(result.majorTickStep).toBe(100);
        expect(result.minMinTickValue).toBe(0);
        expect(result.maxMaxTickValue).toBe(100);
        expect(result.minTickStep).toBe(10);
        expect(result.minHalfTickValue).toBe(0);
        expect(result.maxHalfTickValue).toBe(100);
        expect(result.halfTickStep).toBe(50);
        expect(result.calibrationMultiplier).toBe(1);
        expect(result.normalizedOrderOfMagnitude).toBe(2);
    });

    it('should handle negative ranges correctly', () => {
        const result = calculateTickValues(-100, 0);
        
        expect(result.minMajorTickValue).toBe(-100);
        expect(result.maxMajorTickValue).toBe(0);
        expect(result.majorTickStep).toBe(100);
        expect(result.minMinTickValue).toBe(-100);
        expect(result.maxMaxTickValue).toBe(0);
        expect(result.minTickStep).toBe(10);
        expect(result.minHalfTickValue).toBe(-100);
        expect(result.maxHalfTickValue).toBe(0);
        expect(result.halfTickStep).toBe(50);
        expect(result.calibrationMultiplier).toBe(1);
        expect(result.normalizedOrderOfMagnitude).toBe(2);
    });

    it('should handle large ranges with appropriate order of magnitude', () => {
        const result = calculateTickValues(0, 1000);
        
        expect(result.minMajorTickValue).toBe(0);
        expect(result.maxMajorTickValue).toBe(1000);
        expect(result.majorTickStep).toBe(1000);
        expect(result.minMinTickValue).toBe(0);
        expect(result.maxMaxTickValue).toBe(1000);
        expect(result.minTickStep).toBe(100);
        expect(result.minHalfTickValue).toBe(0);
        expect(result.maxHalfTickValue).toBe(1000);
        expect(result.halfTickStep).toBe(500);
        expect(result.calibrationMultiplier).toBe(1);
        expect(result.normalizedOrderOfMagnitude).toBe(3);
    });

    it('should respect provided order of magnitude', () => {
        const result = calculateTickValues(0, 100, 2);
        
        expect(result.minMajorTickValue).toBe(0);
        expect(result.maxMajorTickValue).toBe(100);
        expect(result.majorTickStep).toBe(100);
        expect(result.minMinTickValue).toBe(0);
        expect(result.maxMaxTickValue).toBe(100);
        expect(result.minTickStep).toBe(10);
        expect(result.minHalfTickValue).toBe(0);
        expect(result.maxHalfTickValue).toBe(100);
        expect(result.halfTickStep).toBe(50);
        expect(result.calibrationMultiplier).toBe(1);
        expect(result.normalizedOrderOfMagnitude).toBe(2);
    });

    it('should handle small ranges with appropriate precision', () => {
        const result = calculateTickValues(0, 0.1);
        
        expect(result.minMajorTickValue).toBe(0);
        expect(result.maxMajorTickValue).toBe(10);
        expect(result.majorTickStep).toBe(10);
        expect(result.minMinTickValue).toBe(0);
        expect(result.maxMaxTickValue).toBe(10);
        expect(result.minTickStep).toBe(1);
        expect(result.minHalfTickValue).toBe(0);
        expect(result.maxHalfTickValue).toBe(10);
        expect(result.halfTickStep).toBe(5);
        expect(result.calibrationMultiplier).toBe(0.01);
        expect(result.normalizedOrderOfMagnitude).toBe(1);
    });
}); 
