import { describe, it, expect } from 'bun:test';
import { computePlatformOffset } from '../src/stations/platform-offset';

describe('computePlatformOffset', () => {
    it('should compute offset from gauge when no bed width', () => {
        // gauge=1.067, ballastHalfWidth = tieHw + 0.15
        // tieHw = (1.067/2) * ((64 + 8) / 64) = 0.5335 * 1.125 = ~0.6002
        // ballastHw = 0.6002 + 0.15 = ~0.7502
        // offset = 0.7502 + 0.15 (clearance) + 1.5 (carHalfWidth) = ~2.4002
        const offset = computePlatformOffset(1.067, undefined);
        expect(offset).toBeCloseTo(2.4, 0);
    });

    it('should use bed width when larger than ballast', () => {
        // bedWidth=5, bedWidth/2=2.5 > ballastHw (~0.75)
        // offset = 2.5 + 0.15 + 1.5 = 4.15
        const offset = computePlatformOffset(1.067, 5);
        expect(offset).toBeCloseTo(4.15, 1);
    });

    it('should use custom car half width and clearance', () => {
        const offset = computePlatformOffset(1.067, undefined, 2.0, 0.2);
        // ballastHw (~0.75) + 0.2 + 2.0 = ~2.95
        expect(offset).toBeCloseTo(2.95, 0);
    });

    it('should produce larger offset for wider gauge', () => {
        const narrowGauge = computePlatformOffset(1.067, undefined);
        const standardGauge = computePlatformOffset(1.435, undefined);
        expect(standardGauge).toBeGreaterThan(narrowGauge);
    });

    it('should increase offset proportionally with car half width', () => {
        const small = computePlatformOffset(1.435, undefined, 1.0);
        const large = computePlatformOffset(1.435, undefined, 2.0);
        expect(large - small).toBeCloseTo(1.0, 5);
    });

    it('should handle zero bed width', () => {
        const offset = computePlatformOffset(1.435, 0);
        // ballastHw > 0 since gauge > 0, so offset should be ballastHw + clearance + carHalfWidth
        expect(offset).toBeGreaterThan(0);
    });
});
