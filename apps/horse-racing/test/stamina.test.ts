import {
    drainStamina,
    OVERDRIVE_DRAIN_RATE,
    STAMINA_DRAIN_RATE,
    SPEED_DRAIN_RATE,
    LATERAL_STEERING_DRAIN_RATE,
    LATERAL_VELOCITY_DRAIN_RATE,
} from '../src/simulation/stamina';
import { createDefaultAttributes } from '../src/simulation/attributes';
import type { Horse } from '../src/simulation/types';
import type { TrackFrame } from '../src/simulation/track-navigator';

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

const STRAIGHT_FRAME: TrackFrame = {
    tangential: { x: 1, y: 0 },
    normal: { x: 0, y: -1 },
    turnRadius: Infinity,
    nominalRadius: Infinity,
    targetRadius: Infinity,
    slope: 0,
};

const ZERO_INPUT = { tangential: 0 as const, normal: 0 as const };

describe('drainStamina', () => {
    it('drains nothing when horse is stationary with no input', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 0 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        expect(horse.currentStamina).toBe(before);
    });

    it('applies speed tax proportional to tangentialVel', () => {
        const horse = makeHorse({ tangentialVel: 10, normalVel: 0 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        const expectedDrain = 10 * SPEED_DRAIN_RATE * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies overdrive drain when speed > cruiseSpeed', () => {
        const attrs = createDefaultAttributes(); // cruiseSpeed = 13
        const horse = makeHorse({
            tangentialVel: 18,
            normalVel: 0,
            effectiveAttributes: attrs,
        });
        const before = horse.currentStamina;
        drainStamina(horse, attrs, ZERO_INPUT, STRAIGHT_FRAME);
        const overdrive = (18 - 13) * OVERDRIVE_DRAIN_RATE;
        const speedTax = 18 * SPEED_DRAIN_RATE;
        const expectedDrain = (overdrive + speedTax) * attrs.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies push drain when tangential input > 0', () => {
        const horse = makeHorse({ tangentialVel: 10 });
        const pushInput = { tangential: 1 as const, normal: 0 as const };
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, pushInput, STRAIGHT_FRAME);
        const pushDrain = 1 * STAMINA_DRAIN_RATE;
        const speedTax = 10 * SPEED_DRAIN_RATE;
        const expectedDrain = (pushDrain + speedTax) * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies lateral steering drain when normal input != 0', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 0 });
        const steerInput = { tangential: 0 as const, normal: 1 as const };
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, steerInput, STRAIGHT_FRAME);
        const steerDrain = 1 * LATERAL_STEERING_DRAIN_RATE;
        const expectedDrain = steerDrain * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies lateral velocity tax', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 5 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        const latDrain = 5 * LATERAL_VELOCITY_DRAIN_RATE;
        const expectedDrain = latDrain * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('clamps stamina to 0 (never negative)', () => {
        const horse = makeHorse({ tangentialVel: 20, currentStamina: 0.001 });
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        expect(horse.currentStamina).toBe(0);
    });

    it('drainRateMult scales all drain', () => {
        const attrsLow = createDefaultAttributes();
        attrsLow.drainRateMult = 0.7;
        const attrsHigh = createDefaultAttributes();
        attrsHigh.drainRateMult = 1.3;

        const horseLow = makeHorse({
            tangentialVel: 18,
            effectiveAttributes: attrsLow,
        });
        const horseHigh = makeHorse({
            tangentialVel: 18,
            effectiveAttributes: attrsHigh,
        });

        drainStamina(horseLow, attrsLow, ZERO_INPUT, STRAIGHT_FRAME);
        drainStamina(horseHigh, attrsHigh, ZERO_INPUT, STRAIGHT_FRAME);

        expect(horseHigh.currentStamina).toBeLessThan(horseLow.currentStamina);
    });
});
