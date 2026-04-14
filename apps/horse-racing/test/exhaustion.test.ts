import { applyExhaustion, effectiveRatio, KNEE, FLOOR, MAX_SPEED_KNEE, MAX_SPEED_FLOOR } from '../src/simulation/exhaustion';
import { createDefaultAttributes } from '../src/simulation/attributes';
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
        lastDrain: 0,
        ...overrides,
    };
}

describe('effectiveRatio', () => {
    it('full stamina returns ~1.0', () => {
        expect(effectiveRatio(1.0)).toBeCloseTo(1.0, 2);
    });

    it('zero stamina returns floor', () => {
        expect(effectiveRatio(0.0)).toBeCloseTo(FLOOR, 2);
    });

    it('monotonically increasing', () => {
        for (let p = 1; p <= 100; p++) {
            expect(effectiveRatio(p / 100)).toBeGreaterThanOrEqual(effectiveRatio((p - 1) / 100));
        }
    });

    it('knee region has steep drop', () => {
        const high = effectiveRatio(0.2);
        const low = effectiveRatio(0.05);
        expect(high - low).toBeGreaterThan(0.15);
    });

    it('above knee is gentle', () => {
        const high = effectiveRatio(0.8);
        const low = effectiveRatio(0.6);
        expect(high - low).toBeLessThan(0.01);
    });

    it('floor is respected', () => {
        expect(effectiveRatio(0.0)).toBeGreaterThanOrEqual(FLOOR);
        expect(effectiveRatio(0.01)).toBeGreaterThanOrEqual(FLOOR);
    });
});

describe('applyExhaustion', () => {
    it('full stamina — no degradation', () => {
        const horse = makeHorse({ currentStamina: 100.0 });
        const eff = applyExhaustion(horse);
        const base = horse.baseAttributes;
        expect(eff.cruiseSpeed).toBeCloseTo(base.cruiseSpeed, 0);
        expect(eff.maxSpeed).toBeCloseTo(base.maxSpeed, 0);
        expect(eff.forwardAccel).toBeCloseTo(base.forwardAccel, 1);
        expect(eff.turnAccel).toBeCloseTo(base.turnAccel, 1);
    });

    it('zero stamina hits floor', () => {
        const horse = makeHorse({ currentStamina: 0.0 });
        const eff = applyExhaustion(horse);
        const base = horse.baseAttributes;
        expect(eff.cruiseSpeed).toBeCloseTo(base.cruiseSpeed * FLOOR, 0);
        expect(eff.maxSpeed).toBeCloseTo(base.maxSpeed * MAX_SPEED_FLOOR, 0);
    });

    it('half stamina — mild degradation', () => {
        const horse = makeHorse({ currentStamina: 50.0 });
        const eff = applyExhaustion(horse);
        const base = horse.baseAttributes;
        expect(eff.cruiseSpeed).toBeGreaterThan(base.cruiseSpeed * 0.9);
        expect(eff.cruiseSpeed).toBeLessThan(base.cruiseSpeed);
    });

    it('max_speed degrades faster than cruise', () => {
        const horseFull = makeHorse({ currentStamina: 100.0 });
        const horseLow = makeHorse({ currentStamina: 40.0 });
        const full = applyExhaustion(horseFull);
        const low = applyExhaustion(horseLow);
        const fullGap = full.maxSpeed - full.cruiseSpeed;
        const lowGap = low.maxSpeed - low.cruiseSpeed;
        expect(lowGap).toBeLessThan(fullGap * 0.8);
    });

    it('stateless — same stamina always gives same result', () => {
        const horse = makeHorse({ currentStamina: 30.0 });
        const r1 = applyExhaustion(horse);
        horse.effectiveAttributes = r1;
        const r2 = applyExhaustion(horse);
        expect(r1.cruiseSpeed).toBeCloseTo(r2.cruiseSpeed);
    });

    it('cornering grip unchanged', () => {
        const horse = makeHorse({ currentStamina: 0.0 });
        const eff = applyExhaustion(horse);
        expect(eff.corneringGrip).toBe(horse.baseAttributes.corneringGrip);
    });

    it('weight unchanged', () => {
        const horse = makeHorse({ currentStamina: 0.0 });
        const eff = applyExhaustion(horse);
        expect(eff.weight).toBe(horse.baseAttributes.weight);
    });
});
