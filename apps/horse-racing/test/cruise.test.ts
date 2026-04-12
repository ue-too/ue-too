import { computeCruiseForce } from '../src/simulation/cruise';
import { K_CRUISE } from '../src/simulation/types';

const CRUISE_SPEED = 13;

describe('computeCruiseForce', () => {
    it('returns zero at the cruise velocity', () => {
        expect(computeCruiseForce(CRUISE_SPEED, CRUISE_SPEED)).toBeCloseTo(0);
    });

    it('returns positive force when below cruise', () => {
        expect(computeCruiseForce(0, CRUISE_SPEED)).toBeCloseTo(K_CRUISE * CRUISE_SPEED);
    });

    it('returns negative force when above cruise', () => {
        expect(computeCruiseForce(2 * CRUISE_SPEED, CRUISE_SPEED))
            .toBeCloseTo(-K_CRUISE * CRUISE_SPEED);
    });
});
