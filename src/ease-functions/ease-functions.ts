
/**
 * @description The ease in sine function.
 * 
 * equation: 1 - cos((x * π) / 2)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInSine(x: number): number {
    return 1 - Math.cos((x * Math.PI) / 2);
}

/**
 * @description The ease out sine function.
 * 
 * equation: sin((x * π) / 2)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutSine(x: number): number {
    return Math.sin((x * Math.PI) / 2);
}

/**
 * @description The ease in out sine function.
 * 
 * equation: -(cos(π * x) - 1) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutSine(x: number): number {
    return -(Math.cos(Math.PI * x) - 1) / 2;
}

/**
 * @description The ease in quadratic function.
 * 
 * equation: x^2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInQuad(x: number): number {
    return x * x;
}

/**
 * @description The ease out quadratic function.
 * 
 * equation: 1 - (1 - x)^2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutQuad(x: number): number {
    return 1 - (1 - x) * (1 - x);
}

/**
 * @description The ease in out quadratic function.
 * 
 * equation: if x < 0.5 then 2 * x^2 else 1 - ((-2 * x + 2)^2) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutQuad(x: number): number {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * @description The ease in cubic function.
 * 
 * equation: x^3
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInCubic(x: number): number {
    return x * x * x;
}

/**
 * @description The ease out cubic function.
 * 
 * equation: 1 - (1 - x)^3
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutCubic(x: number): number {
    return 1 - Math.pow(1 - x, 3);    
}

/**
 * @description The ease in out cubic function.
 * 
 * equation: if x < 0.5 then 4 * x^3 else 1 - ((-2 * x + 2)^3) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * @description The ease in quartic function.
 * 
 * equation: x^4
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInQuart(x: number): number {
    return x * x * x * x;
}

/**
 * @description The ease out quartic function.
 * 
 * equation: 1 - (1 - x)^4
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutQuart(x: number): number {
    return 1 - Math.pow(1 - x, 4);
}

/**
 * @description The ease in out quartic function.
 * 
 * equation: if x < 0.5 then 8 * x^4 else 1 - ((-2 * x + 2)^4) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutQuart(x: number): number {
    return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

/**
 * @description The ease in quintic function.
 * 
 * equation: x^5
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInQuint(x: number): number {
    return x * x * x * x * x;
}

/**
 * @description The ease out quintic function.
 * 
 * equation: 1 - (1 - x)^5
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutQuint(x: number): number {
    return 1 - Math.pow(1 - x, 5);
}

/**
 * @description The ease in out quintic function.
 * 
 * equation: if x < 0.5 then 16 * x^5 else 1 - ((-2 * x + 2)^5) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutQuint(x: number): number {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

/**
 * @description The ease in exponential function.
 * 
 * equation: 2^(10 * x - 10)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInExpo(x: number): number {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

/**
 * @description The ease out exponential function.
 * 
 * equation: 1 - 2^(-10 * x)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutExpo(x: number): number {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * @description The ease in out exponential function.
 * 
 * equation: if x < 0.5 then 2^(20 * x - 10) / 2 else (2 - 2^(-20 * x + 10)) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutExpo(x: number): number {
    return x === 0
      ? 0
      : x === 1
      ? 1
      : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2
      : (2 - Math.pow(2, -20 * x + 10)) / 2;
}

/**
 * @description The ease in circular function.
 * 
 * equation: 1 - sqrt(1 - x^2)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInCirc(x: number): number {
    return 1 - Math.sqrt(1 - Math.pow(x, 2));
}

/**
 * @description The ease out circular function.
 * 
 * equation: sqrt(1 - (x - 1)^2)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutCirc(x: number): number {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

/**
 * @description The ease in out circular function.
 * 
 * equation: if x < 0.5 then (1 - sqrt(1 - (2 * x)^2)) / 2 else (sqrt(1 - ((-2 * x + 2)^2)) + 1) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutCirc(x: number): number {
    return x < 0.5
      ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
      : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
}

/**
 * @description The ease in back function.
 * 
 * equation: c3 * x^3 - c1 * x^2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    
    return c3 * x * x * x - c1 * x * x;
}

/**
 * @description The ease out back function.
 * 
 * equation: 1 + c3 * (x - 1)^3 + c1 * (x - 1)^2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * @description The ease in out back function.
 * 
 * equation: if x < 0.5 then (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 else (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutBack(x: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    
    return x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

/**
 * @description The ease in elastic function.
 * 
 * equation: -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    
    return x === 0
      ? 0
      : x === 1
      ? 1
      : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
}

/**
 * @description The ease out elastic function.
 * 
 * equation: Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    
    return x === 0
      ? 0
      : x === 1
      ? 1
      : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

/**
 * @description The ease in out elastic function.
 * 
 * equation: if x < 0.5 then -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 else (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutElastic(x: number): number {
    const c5 = (2 * Math.PI) / 4.5;
    
    return x === 0
      ? 0
      : x === 1
      ? 1
      : x < 0.5
      ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}

/**
 * @description The ease in bounce function.
 * 
 * equation: 1 - easeOutBounce(1 - x)
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInBounce(x: number): number {
    return 1 - easeOutBounce(1 - x);
}

/**
 * @description The ease out bounce function.
 * 
 * equation: n1 * x^2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeOutBounce(x: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (x < 1 / d1) {
        return n1 * x * x;
    } else if (x < 2 / d1) {
        return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
        return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
        return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
}

/**
 * @description The ease in out bounce function.
 * 
 * equation: if x < 0.5 then (1 - easeOutBounce(1 - 2 * x)) / 2 else (1 + easeOutBounce(2 * x - 1)) / 2
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function easeInOutBounce(x: number): number {
    return x < 0.5
      ? (1 - easeOutBounce(1 - 2 * x)) / 2
      : (1 + easeOutBounce(2 * x - 1)) / 2;
}

/**
 * @description The linear function.
 * 
 * equation: x
 * taken from https://github.com/ai/easings.net
 * @category Easing Functions
 */
export function linear(x: number): number{
    return x;
}

/*
Functions taken from https://github.com/ai/easings.net

Maybe a bezier curve editor to generate ease function can be the next project idea?
 */