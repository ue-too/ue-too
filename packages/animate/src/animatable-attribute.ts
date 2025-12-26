import { PointCal, Point } from "@ue-too/math";

/**
 * Represents a keyframe in an animation timeline.
 *
 * @remarks
 * A keyframe defines a value at a specific point in the animation's progress.
 * Keyframes are defined with a percentage from 0.0 (start) to 1.0 (end), along
 * with the value at that point and an optional easing function for interpolation
 * to the next keyframe.
 *
 * @typeParam T - The type of value being animated (number, Point, RGB, etc.)
 *
 * @example
 * ```typescript
 * const keyframe: Keyframe<number> = {
 *   percentage: 0.5,
 *   value: 50,
 *   easingFn: (t) => t * t // Ease-in quadratic
 * };
 * ```
 *
 * @category Types
 */
export type Keyframe<T> = {
    /** Animation progress from 0.0 (start) to 1.0 (end) */
    percentage: number;
    /** Value at this keyframe */
    value: T;
    /** Optional easing function for interpolation to next keyframe */
    easingFn?: (percentage: number) => number;
}

/**
 * Interface for type-specific interpolation helpers.
 *
 * @remarks
 * Animation helpers provide the `lerp` (linear interpolation) logic for specific types.
 * Different types require different interpolation strategies:
 * - Numbers: Simple linear interpolation
 * - Points: Component-wise interpolation
 * - Colors (RGB): Component-wise color interpolation
 * - Strings: Step-based (threshold) interpolation
 *
 * @typeParam T - The type of value being interpolated
 *
 * @example
 * ```typescript
 * const myHelper: AnimatableAttributeHelper<number> = {
 *   lerp: (ratio, start, end) => {
 *     const t = (ratio - start.percentage) / (end.percentage - start.percentage);
 *     return start.value + t * (end.value - start.value);
 *   }
 * };
 * ```
 *
 * @category Helpers
 */
export interface AnimatableAttributeHelper<T> {
    /**
     * Interpolates between two keyframes at a given ratio.
     *
     * @param ratio - Current animation progress (0.0 to 1.0)
     * @param start - Starting keyframe
     * @param end - Ending keyframe
     * @returns Interpolated value at the given ratio
     */
    lerp(ratio: number, start: Keyframe<T>, end: Keyframe<T>): T;
}

/**
 * Built-in interpolation helper for animating Point values.
 *
 * @remarks
 * Provides linear interpolation for 2D points with optional easing.
 * Interpolates both x and y components independently.
 *
 * @category Helpers
 */
export const pointHelperFunctions: AnimatableAttributeHelper<Point> = {
    lerp: (ratio: number, start: Keyframe<Point>, end: Keyframe<Point>): Point => {
        const inbetweenRatio = (ratio - start.percentage) / (end.percentage - start.percentage);
        let transformed = inbetweenRatio;
        if(start.easingFn){
            transformed = start.easingFn(inbetweenRatio);
        }
        const res = PointCal.addVector(start.value, PointCal.multiplyVectorByScalar(PointCal.subVector(end.value, start.value), transformed));
        return res;
    }
};

export class PointAnimationHelper implements AnimatableAttributeHelper<Point> {

    constructor(){

    }

    lerp(ratio: number, start: Keyframe<Point>, end: Keyframe<Point>): Point {
        const inbetweenRatio = (ratio - start.percentage) / (end.percentage - start.percentage);
        let transformed = inbetweenRatio;
        if(start.easingFn){
            transformed = start.easingFn(inbetweenRatio);
        }
        const res = PointCal.addVector(start.value, PointCal.multiplyVectorByScalar(PointCal.subVector(end.value, start.value), transformed));
        return res;
    }

}

/**
 * Built-in interpolation helper for animating number values.
 *
 * @remarks
 * Provides linear interpolation for numeric values with optional easing.
 *
 * @category Helpers
 */
export const numberHelperFunctions: AnimatableAttributeHelper<number> = {
    lerp: (ratio: number, start: Keyframe<number>, end: Keyframe<number>): number => {
        const inbetweenRatio = (ratio - start.percentage) / (end.percentage - start.percentage);
        let transformed = inbetweenRatio;
        if(start.easingFn){
            transformed = start.easingFn(inbetweenRatio);
        }
        const res = start.value + transformed * (end.value - start.value);
        return res;
    }
}

export class NumberAnimationHelper implements AnimatableAttributeHelper<number>{

    constructor(){

    }

    lerp(ratio: number, start: Keyframe<number>, end: Keyframe<number>): number {
        const inbetweenRatio = (ratio - start.percentage) / (end.percentage - start.percentage);
        let transformed = inbetweenRatio;
        if(start.easingFn){
            transformed = start.easingFn(inbetweenRatio);
        }
        const res = start.value + transformed * (end.value - start.value);
        return res;
    }
}

/**
 * Built-in interpolation helper for animating string values.
 *
 * @remarks
 * Uses step-based interpolation with a 50% threshold. Returns start value until
 * 50% progress, then switches to end value. Useful for discrete property changes.
 *
 * @category Helpers
 */
export const stringHelperFunctions: AnimatableAttributeHelper<string> = {
    lerp: (ratio: number, start: Keyframe<string>, end: Keyframe<string>): string => {
        const percentageScale = (ratio - start.percentage) / (end.percentage - start.percentage)
        // if percentageScale is negative that means it's before the start value just return start value 
        // if percentageScale is more than 1 that means it's after the end value just return the end value
        // if percentageScale is less than 0.5 return the start value else return the end value
        return percentageScale < 0 || percentageScale < 0.5 ? start.value : end.value;
    }
}

export class StringAnimationHelper implements AnimatableAttributeHelper<string>{
    constructor(){

    }
    
    lerp(ratio: number, start: Keyframe<string>, end: Keyframe<string>): string {
        const percentageScale = (ratio - start.percentage) / (end.percentage - start.percentage)
        // if percentageScale is negative that means it's before the start value just return start value 
        // if percentageScale is more than 1 that means it's after the end value just return the end value
        // if percentageScale is less than 0.5 return the start value else return the end value
        return percentageScale < 0 || percentageScale < 0.5 ? start.value : end.value;
    }
}

/**
 * Built-in interpolation helper for animating integer values.
 *
 * @remarks
 * Uses step-based interpolation with a 50% threshold, similar to strings.
 * Useful for discrete numeric properties like indices or counts.
 *
 * @category Helpers
 */
export const integerHelperFunctions: AnimatableAttributeHelper<number> = {
    lerp: (ratio: number, start: Keyframe<number>, end: Keyframe<number>): number => {
        const percentageScale = (ratio - start.percentage) / (end.percentage - start.percentage)
        // if percentageScale is negative that means it's before the start value just return start value 
        // if percentageScale is more than 1 that means it's after the end value just return the end value
        // if percentageScale is less than 0.5 return the start value else return the end value
        return percentageScale < 0 || percentageScale < 0.5 ? start.value : end.value;
    }
}

export class IntegerAnimationHelper implements AnimatableAttributeHelper<number>{
    constructor(){

    }

    lerp(ratio: number, start: Keyframe<number>, end: Keyframe<number>): number {
        const percentageScale = (ratio - start.percentage) / (end.percentage - start.percentage)
        // if percentageScale is negative that means it's before the start value just return start value 
        // if percentageScale is more than 1 that means it's after the end value just return the end value
        // if percentageScale is less than 0.5 return the start value else return the end value
        return percentageScale < 0 || percentageScale < 0.5 ? start.value : end.value;
    }
}

/**
 * RGB color type for color animations.
 *
 * @remarks
 * Represents a color with red, green, and blue components (0-255).
 *
 * @category Types
 */
export type RGB = {r: number, g: number, b: number};

/**
 * Built-in interpolation helper for animating RGB color values.
 *
 * @remarks
 * Provides linear interpolation for RGB colors with component-wise blending.
 *
 * @category Helpers
 */
export const rgbHelperFunctions: AnimatableAttributeHelper<RGB> = {
    lerp: (ratio: number, start: Keyframe<RGB>, end: Keyframe<RGB>): RGB => {
        const res = {
            r: start.value.r + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.r - start.value.r),
            g: start.value.g + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.g - start.value.g),
            b: start.value.b + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.b - start.value.b),
        }
        return res;
    }
}

export class RGBAnimationHelper implements AnimatableAttributeHelper<RGB> {
    constructor(){

    }

    lerp(ratio: number, start: Keyframe<RGB>, end: Keyframe<RGB>): RGB {
        const res = {
            r: start.value.r + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.r - start.value.r),
            g: start.value.g + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.g - start.value.g),
            b: start.value.b + ((ratio - start.percentage) / (end.percentage - start.percentage)) * (end.value.b - start.value.b),
        }
        return res;
    }
}
