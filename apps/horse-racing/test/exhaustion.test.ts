import { applyExhaustion, EXHAUSTION_DECAY } from '../src/simulation/exhaustion';
import { createDefaultAttributes } from '../src/simulation/attributes';
import type { CoreAttributes } from '../src/simulation/attributes';
import type { Horse } from '../src/simulation/types';

function makeHorse(overrides: Partial<Horse> = {}): Horse {
    const attrs = createDefaultAttributes();
    return {
        id: 0,
        color: 0,
        pos: { x: 0, y: 0 },
        tangentialVel: 0,
        normalVel: 0,
        trackProgress: 0,
        navigator: null as any,
        finished: false,
        finishOrder: null,
        baseAttributes: attrs,
        currentStamina: attrs.maxStamina,
        effectiveAttributes: { ...attrs },
        ...overrides,
    };
}

describe('applyExhaustion', () => {
    it('returns base attributes when stamina > 0', () => {
        const horse = makeHorse({ currentStamina: 50 });
        const eff = applyExhaustion(horse);
        expect(eff.cruiseSpeed).toBe(horse.baseAttributes.cruiseSpeed);
        expect(eff.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
        expect(eff.forwardAccel).toBe(horse.baseAttributes.forwardAccel);
        expect(eff.turnAccel).toBe(horse.baseAttributes.turnAccel);
    });

    it('returns base attributes when stamina = 1 (barely above zero)', () => {
        const horse = makeHorse({ currentStamina: 1 });
        const eff = applyExhaustion(horse);
        expect(eff.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
    });

    it('begins decaying when stamina = 0', () => {
        const horse = makeHorse({ currentStamina: 0 });
        const eff = applyExhaustion(horse);
        expect(eff.maxSpeed).toBeLessThan(horse.baseAttributes.maxSpeed);
    });

    it('reaches floor values within 120 ticks (~2 seconds at 60fps)', () => {
        const horse = makeHorse({ currentStamina: 0 });
        const base = horse.baseAttributes;
        const floorMaxSpeed = base.cruiseSpeed * 0.55;
        const floorForwardAccel = base.forwardAccel * 0.15;
        const floorTurnAccel = base.turnAccel * 0.30;

        for (let i = 0; i < 120; i++) {
            const eff = applyExhaustion(horse);
            horse.effectiveAttributes = eff;
        }

        expect(horse.effectiveAttributes.maxSpeed).toBeCloseTo(floorMaxSpeed, 1);
        expect(horse.effectiveAttributes.forwardAccel).toBeCloseTo(floorForwardAccel, 1);
        expect(horse.effectiveAttributes.turnAccel).toBeCloseTo(floorTurnAccel, 1);
    });

    it('decays cruiseSpeed to 40% floor and does not decay non-degraded traits', () => {
        const horse = makeHorse({ currentStamina: 0 });
        const base = horse.baseAttributes;
        const floorCruiseSpeed = base.cruiseSpeed * 0.4;
        for (let i = 0; i < 120; i++) {
            horse.effectiveAttributes = applyExhaustion(horse);
        }
        expect(horse.effectiveAttributes.cruiseSpeed).toBeCloseTo(floorCruiseSpeed, 1);
        expect(horse.effectiveAttributes.maxStamina).toBe(base.maxStamina);
        expect(horse.effectiveAttributes.weight).toBe(base.weight);
    });

    it('resets to base if stamina goes back above 0 (edge case)', () => {
        const horse = makeHorse({ currentStamina: 0 });
        for (let i = 0; i < 30; i++) {
            horse.effectiveAttributes = applyExhaustion(horse);
        }
        expect(horse.effectiveAttributes.maxSpeed).toBeLessThan(horse.baseAttributes.maxSpeed);

        horse.currentStamina = 10;
        horse.effectiveAttributes = applyExhaustion(horse);
        expect(horse.effectiveAttributes.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
    });
});
