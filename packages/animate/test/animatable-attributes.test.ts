import { Point } from '@ue-too/math';

import {
    Keyframe,
    NumberAnimationHelper,
    PointAnimationHelper,
    StringAnimationHelper,
} from '../src/animatable-attribute';

describe('Point Lerping', () => {
    let testHelper = new PointAnimationHelper();

    test('Interpolating', () => {
        const startKeyframe: Keyframe<Point> = {
            percentage: 0,
            value: { x: 0, y: 0 },
        };
        const endKeyframe: Keyframe<Point> = {
            percentage: 1,
            value: { x: 10, y: 10 },
        };

        const actual = testHelper.lerp(0.5, startKeyframe, endKeyframe);
        expect(actual).toEqual({ x: 5, y: 5 });
        const midKeyframe: Keyframe<Point> = {
            percentage: 0.5,
            value: { x: 3, y: 3 },
        };
        const actual2 = testHelper.lerp(0.4, startKeyframe, midKeyframe);
        expect(actual2.x).toBeCloseTo(2.4);
        expect(actual2.y).toBeCloseTo(2.4);
    });

    test('Extrapolating beyond', () => {
        const startKeyframe: Keyframe<Point> = {
            percentage: 0,
            value: { x: 0, y: 0 },
        };
        const endKeyframe: Keyframe<Point> = {
            percentage: 1,
            value: { x: 10, y: 10 },
        };

        const actual = testHelper.lerp(1.2, startKeyframe, endKeyframe);
        expect(actual).toEqual({ x: 12, y: 12 });
    });

    test('Extrapolating below', () => {
        const startKeyframe: Keyframe<Point> = {
            percentage: 0,
            value: { x: 0, y: 0 },
        };
        const endKeyframe: Keyframe<Point> = {
            percentage: 1,
            value: { x: 10, y: 10 },
        };

        const actual = testHelper.lerp(-0.2, startKeyframe, endKeyframe);
        expect(actual).toEqual({ x: -2, y: -2 });
    });
});

describe('Number Lerping', () => {
    let testHelper = new NumberAnimationHelper();

    test('Interpolating', () => {
        const startKeyframe: Keyframe<number> = {
            percentage: 0,
            value: 0,
        };
        const endKeyframe: Keyframe<number> = {
            percentage: 1,
            value: 10,
        };

        const actual = testHelper.lerp(0.5, startKeyframe, endKeyframe);
        expect(actual).toBe(5);
        const midKeyframe: Keyframe<number> = {
            percentage: 0.5,
            value: 3,
        };
        const actual2 = testHelper.lerp(0.4, startKeyframe, midKeyframe);
        expect(actual2).toBeCloseTo(2.4);
    });

    test('Extrapolating beyond', () => {
        const startKeyframe: Keyframe<number> = {
            percentage: 0,
            value: 0,
        };
        const endKeyframe: Keyframe<number> = {
            percentage: 1,
            value: 10,
        };

        const actual = testHelper.lerp(1.2, startKeyframe, endKeyframe);
        expect(actual).toBe(12);
    });

    test('Extrapolating below', () => {
        const startKeyframe: Keyframe<number> = {
            percentage: 0,
            value: 0,
        };
        const endKeyframe: Keyframe<number> = {
            percentage: 1,
            value: 10,
        };

        const actual = testHelper.lerp(-0.2, startKeyframe, endKeyframe);
        expect(actual).toBe(-2);
    });
});

describe('String Lerping', () => {
    let testHelper = new StringAnimationHelper();

    test('Interpolating', () => {
        const startKeyframe: Keyframe<string> = {
            percentage: 0,
            value: 'start',
        };
        const endKeyframe: Keyframe<string> = {
            percentage: 1,
            value: 'end',
        };

        const actual = testHelper.lerp(0.5, startKeyframe, endKeyframe);
        expect(actual).toBe('end');
    });

    test('Extrapolating beyond', () => {
        const startKeyframe: Keyframe<string> = {
            percentage: 0,
            value: 'start',
        };
        const endKeyframe: Keyframe<string> = {
            percentage: 1,
            value: 'end',
        };

        const actual = testHelper.lerp(1.2, startKeyframe, endKeyframe);
        expect(actual).toBe('end');
    });

    test('Extrapolating below', () => {
        const startKeyframe: Keyframe<string> = {
            percentage: 0,
            value: 'start',
        };
        const endKeyframe: Keyframe<string> = {
            percentage: 1,
            value: 'end',
        };

        const actual = testHelper.lerp(-0.2, startKeyframe, endKeyframe);
        expect(actual).toBe('start');
    });
});
