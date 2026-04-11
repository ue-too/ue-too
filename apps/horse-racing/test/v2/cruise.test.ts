import { computeCruiseForce } from '../../src/simulation/v2/cruise';
import { K_CRUISE, TARGET_CRUISE } from '../../src/simulation/v2/types';

describe('computeCruiseForce', () => {
    it('returns zero at the target velocity', () => {
        expect(computeCruiseForce(TARGET_CRUISE, TARGET_CRUISE)).toBeCloseTo(0);
    });

    it('returns positive force when below target', () => {
        expect(computeCruiseForce(0, TARGET_CRUISE)).toBeCloseTo(K_CRUISE * TARGET_CRUISE);
    });

    it('returns negative force when above target', () => {
        expect(computeCruiseForce(2 * TARGET_CRUISE, TARGET_CRUISE))
            .toBeCloseTo(-K_CRUISE * TARGET_CRUISE);
    });
});
