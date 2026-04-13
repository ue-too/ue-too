import { createDefaultAttributes } from '../src/simulation/attributes';
import {
    computeAccelerations,
    projectVelocity,
} from '../src/simulation/physics';
import type { TrackFrame } from '../src/simulation/track-navigator';
import type { InputState } from '../src/simulation/types';

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };

function straightFrame(): TrackFrame {
    return {
        tangential: { x: 1, y: 0 },
        normal: { x: 0, y: -1 },
        turnRadius: Infinity,
        nominalRadius: Infinity,
        targetRadius: Infinity,
        slope: 0,
    };
}

function curveFrame(turnRadius: number): TrackFrame {
    return {
        tangential: { x: 0, y: -1 },
        normal: { x: 1, y: 0 },
        turnRadius,
        nominalRadius: turnRadius,
        targetRadius: turnRadius,
        slope: 0,
    };
}

describe('projectVelocity', () => {
    it('decomposes world velocity onto track frame', () => {
        const { tangentialVel, normalVel } = projectVelocity(
            { x: 10, y: -3 },
            straightFrame()
        );
        expect(tangentialVel).toBeCloseTo(10);
        expect(normalVel).toBeCloseTo(3);
    });

    it('handles angled track frame', () => {
        const s = Math.SQRT1_2;
        const frame: TrackFrame = {
            tangential: { x: s, y: s },
            normal: { x: s, y: -s },
            turnRadius: Infinity,
            nominalRadius: Infinity,
            targetRadius: Infinity,
            slope: 0,
        };
        const { tangentialVel, normalVel } = projectVelocity(
            { x: 10, y: 0 },
            frame
        );
        expect(tangentialVel).toBeCloseTo(10 * s);
        expect(normalVel).toBeCloseTo(10 * s);
    });
});

describe('computeAccelerations', () => {
    const attrs = createDefaultAttributes();

    it('produces positive tangential accel at zero velocity (cruise pull)', () => {
        const [a_t] = computeAccelerations(
            0,
            0,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        expect(a_t).toBeCloseTo(26, 0);
    });

    it('produces negative tangential accel above cruise (drag dominates)', () => {
        const [a_t] = computeAccelerations(
            20,
            0,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        expect(a_t).toBeLessThan(0);
    });

    it('applies centripetal on curves: -v²/r in normal direction', () => {
        const [, a_n] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            curveFrame(100)
        );
        expect(a_n).toBeCloseTo(-1.0, 1);
    });

    it('no centripetal on straights', () => {
        const [, a_n] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        expect(a_n).toBeCloseTo(0, 5);
    });

    it('applies NORMAL_DAMP to lateral velocity', () => {
        const [, a_n] = computeAccelerations(
            0,
            5,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        expect(a_n).toBeCloseTo(-3.0, 1);
    });

    it('applies steering input', () => {
        const input: InputState = { tangential: 0, normal: 1 };
        const [, a_n] = computeAccelerations(
            0,
            0,
            attrs,
            input,
            straightFrame()
        );
        expect(a_n).toBeCloseTo(3, 0);
    });

    it('uphill slope reduces tangential acceleration', () => {
        const uphillFrame: TrackFrame = {
            ...straightFrame(),
            slope: 0.05, // 5% grade
        };
        const [a_t_flat] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        const [a_t_uphill] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            uphillFrame
        );
        // Uphill should produce less acceleration than flat
        expect(a_t_uphill).toBeLessThan(a_t_flat);
        // Difference should be g * slope = 9.81 * 0.05 ≈ 0.49
        expect(a_t_flat - a_t_uphill).toBeCloseTo(9.81 * 0.05, 2);
    });

    it('downhill slope increases tangential acceleration', () => {
        const downhillFrame: TrackFrame = {
            ...straightFrame(),
            slope: -0.05,
        };
        const [a_t_flat] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            straightFrame()
        );
        const [a_t_downhill] = computeAccelerations(
            10,
            0,
            attrs,
            ZERO_INPUT,
            downhillFrame
        );
        expect(a_t_downhill).toBeGreaterThan(a_t_flat);
        expect(a_t_downhill - a_t_flat).toBeCloseTo(9.81 * 0.05, 2);
    });

    it('clamps input values to [-1, 1]', () => {
        const input: InputState = { tangential: 5, normal: -3 };
        const clamped: InputState = { tangential: 1, normal: -1 };
        const [a_t, a_n] = computeAccelerations(
            0,
            0,
            attrs,
            input,
            straightFrame()
        );
        const [a_t_c, a_n_c] = computeAccelerations(
            0,
            0,
            attrs,
            clamped,
            straightFrame()
        );
        expect(a_t).toBeCloseTo(a_t_c);
        expect(a_n).toBeCloseTo(a_n_c);
    });
});
