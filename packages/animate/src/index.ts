/**
 * @packageDocumentation
 * Keyframe-based animation library for TypeScript.
 *
 * @remarks
 * The `@ue-too/animate` package provides a flexible, composable animation system based on keyframes.
 * It supports animating various types (numbers, points, colors, strings) with easing functions,
 * delays, and complex animation sequencing through composition.
 *
 * ## Core Concepts
 *
 * - **Keyframes**: Define animation values at specific points in time (0.0 to 1.0)
 * - **Animation**: Interpolates between keyframes to animate a single value
 * - **Composite Animation**: Sequences and overlaps multiple animations
 * - **Animation Helpers**: Type-specific interpolation logic (lerp functions)
 * - **Easing Functions**: Transform animation timing curves
 *
 * ## Key Features
 *
 * - **Type-Safe Interpolation**: Built-in helpers for numbers, points, colors, strings
 * - **Composite Animations**: Sequence, overlap, and synchronize multiple animations
 * - **Lifecycle Hooks**: `onStart`, `onEnd`, `setUp`, `tearDown` callbacks
 * - **Looping**: Support for finite and infinite loops
 * - **Delays and Drag**: Add delays before animation start and drag time after completion
 * - **Reverse Playback**: Animations can play in reverse
 * - **Hierarchical Composition**: Nest composite animations to create complex sequences
 *
 * ## Main Exports
 *
 * - {@link Animation}: Single keyframe animation for a value
 * - {@link CompositeAnimation}: Container for sequencing multiple animations
 * - {@link Keyframe}: Type defining a value at a percentage point in time
 * - {@link AnimatableAttributeHelper}: Interface for type-specific interpolation
 * - Helper functions: {@link pointHelperFunctions}, {@link numberHelperFunctions}, {@link rgbHelperFunctions}
 *
 * @example
 * Basic number animation
 * ```typescript
 * import { Animation, numberHelperFunctions } from '@ue-too/animate';
 *
 * let currentValue = 0;
 *
 * const animation = new Animation(
 *   [
 *     { percentage: 0, value: 0 },
 *     { percentage: 0.5, value: 50 },
 *     { percentage: 1, value: 100 }
 *   ],
 *   (value) => { currentValue = value; }, // Apply function
 *   numberHelperFunctions,
 *   1000 // Duration in ms
 * );
 *
 * animation.start();
 *
 * // In your animation loop
 * function animate(deltaTime: number) {
 *   animation.animate(deltaTime);
 *   console.log('Current value:', currentValue);
 *   requestAnimationFrame(animate);
 * }
 * ```
 *
 * @example
 * Composite animation sequence
 * ```typescript
 * import { Animation, CompositeAnimation, numberHelperFunctions } from '@ue-too/animate';
 *
 * let x = 0, y = 0;
 *
 * const moveRight = new Animation(
 *   [{ percentage: 0, value: 0 }, { percentage: 1, value: 100 }],
 *   (value) => { x = value; },
 *   numberHelperFunctions,
 *   500
 * );
 *
 * const moveDown = new Animation(
 *   [{ percentage: 0, value: 0 }, { percentage: 1, value: 100 }],
 *   (value) => { y = value; },
 *   numberHelperFunctions,
 *   500
 * );
 *
 * const sequence = new CompositeAnimation();
 * sequence.addAnimation('moveRight', moveRight, 0);
 * sequence.addAnimationAfter('moveDown', moveDown, 'moveRight');
 *
 * sequence.start();
 *
 * // Animate in your loop
 * function loop(deltaTime: number) {
 *   sequence.animate(deltaTime);
 *   requestAnimationFrame(loop);
 * }
 * ```
 *
 * @see {@link Animation} for single value animations
 * @see {@link CompositeAnimation} for animation sequencing
 */

export * from "./animatable-attribute";
export * from "./composite-animation";
