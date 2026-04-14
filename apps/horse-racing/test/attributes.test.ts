import { createDefaultAttributes, TRAIT_RANGES } from '../src/simulation/attributes';
import type { CoreAttributes } from '../src/simulation/attributes';

describe('createDefaultAttributes', () => {
    it('returns an object with all 8 traits', () => {
        const attrs = createDefaultAttributes();
        const keys: (keyof CoreAttributes)[] = [
            'cruiseSpeed',
            'maxSpeed',
            'forwardAccel',
            'turnAccel',
            'corneringGrip',
            'maxStamina',
            'drainRateMult',
            'weight',
        ];
        for (const k of keys) {
            expect(typeof attrs[k]).toBe('number');
        }
    });

    it('default values match spec', () => {
        const attrs = createDefaultAttributes();
        expect(attrs.cruiseSpeed).toBe(13);
        expect(attrs.maxSpeed).toBe(20);
        expect(attrs.forwardAccel).toBe(1.0);
        expect(attrs.turnAccel).toBe(1.0);
        expect(attrs.corneringGrip).toBe(1.0);
        expect(attrs.maxStamina).toBe(100);
        expect(attrs.drainRateMult).toBe(1.0);
        expect(attrs.weight).toBe(500);
    });

    it('every default falls within its TRAIT_RANGES', () => {
        const attrs = createDefaultAttributes();
        for (const [key, [min, max]] of Object.entries(TRAIT_RANGES)) {
            const val = attrs[key as keyof CoreAttributes];
            expect(val).toBeGreaterThanOrEqual(min);
            expect(val).toBeLessThanOrEqual(max);
        }
    });
});
