# @ue-too/animate

Keyframe-based animation library for TypeScript canvas applications.

[![npm version](https://img.shields.io/npm/v/@ue-too/animate.svg)](https://www.npmjs.com/package/@ue-too/animate)
[![license](https://img.shields.io/npm/l/@ue-too/animate.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

## Overview

`@ue-too/animate` provides a flexible, composable animation system based on keyframes. It supports animating various types (numbers, points, colors, strings) with easing functions, delays, and complex animation sequencing through composition.

### Key Features

- **Type-Safe Interpolation**: Built-in helpers for numbers, points (2D), RGB colors, strings, and integers
- **Keyframe System**: Define animations with values at specific progress points (0.0 to 1.0)
- **Composite Animations**: Sequence, overlap, and synchronize multiple animations
- **Easing Functions**: Custom timing curves for natural motion
- **Lifecycle Hooks**: `onStart`, `onEnd`, `setUp`, `tearDown` callbacks
- **Looping Support**: Finite and infinite loops with max loop counts
- **Delays and Drag**: Add delays before animation start and hold time after completion
- **Reverse Playback**: Play animations in reverse
- **Hierarchical Composition**: Nest composite animations for complex sequences

## Installation

Using Bun:
```bash
bun add @ue-too/animate
```

Using npm:
```bash
npm install @ue-too/animate
```

## Quick Start

Here's a simple number animation example:

```typescript
import { Animation, numberHelperFunctions } from '@ue-too/animate';

let opacity = 0;

// Create fade-in animation
const fadeIn = new Animation(
  [
    { percentage: 0, value: 0 },     // Start at 0% with value 0
    { percentage: 1, value: 1 }      // End at 100% with value 1
  ],
  (value) => { opacity = value; },   // Apply function updates the value
  numberHelperFunctions,             // Number interpolation helper
  1000                               // Duration in milliseconds
);

// Start the animation
fadeIn.start();

// In your animation loop (e.g., requestAnimationFrame)
function gameLoop(deltaTime: number) {
  fadeIn.animate(deltaTime);  // Update animation with elapsed time
  console.log('Opacity:', opacity);
  requestAnimationFrame(() => gameLoop(16)); // ~60 FPS
}
```

## Core Concepts

### Keyframes

Keyframes define values at specific points in an animation's progress:

```typescript
type Keyframe<T> = {
  percentage: number;      // 0.0 (start) to 1.0 (end)
  value: T;                // Value at this point
  easingFn?: (t: number) => number;  // Optional easing for this segment
};
```

**Example with easing:**
```typescript
const keyframes = [
  { percentage: 0, value: 0 },
  { percentage: 0.5, value: 100, easingFn: (t) => t * t },  // Ease-in quadratic
  { percentage: 1, value: 200 }
];
```

### Animation Helpers

Helpers provide type-specific interpolation logic:

```typescript
interface AnimatableAttributeHelper<T> {
  lerp(ratio: number, start: Keyframe<T>, end: Keyframe<T>): T;
}
```

## Core APIs

### Animation Class

Single-value keyframe animation.

```typescript
const animation = new Animation<T>(
  keyframes: Keyframe<T>[],
  applyFn: (value: T) => void,
  helper: AnimatableAttributeHelper<T>,
  duration: number
);
```

**Methods:**
- `start()`: Start the animation
- `stop()`: Stop and reset the animation
- `pause()`: Pause at current position
- `resume()`: Resume from paused state
- `animate(deltaTime: number)`: Update animation (call in your loop)
- `onStart(callback: Function)`: Subscribe to start event
- `onEnd(callback: Function)`: Subscribe to end event
- `setUp()`: Initialize animation state (called automatically)
- `tearDown()`: Clean up animation state

**Properties:**
- `loops: boolean`: Whether animation loops
- `maxLoopCount?: number`: Maximum number of loops (undefined = infinite)
- `duration: number`: Animation duration in milliseconds
- `delay: number`: Delay before animation starts
- `drag: number`: Hold time after animation completes
- `playing: boolean`: Whether animation is currently playing

### CompositeAnimation Class

Container for sequencing multiple animations.

```typescript
const composite = new CompositeAnimation(
  animations?: Map<string, {animator: Animator, startTime?: number}>,
  loop?: boolean,
  parent?: AnimatorContainer,
  setupFn?: Function,
  tearDownFn?: Function
);
```

**Methods:**
- `addAnimation(name: string, animator: Animator, startTime: number)`: Add animation at specific time
- `addAnimationAfter(name: string, animator: Animator, after: string)`: Add after another animation
- `addAnimationBefore(name: string, animator: Animator, before: string)`: Add before another animation
- `addAnimationAmidst(name: string, animator: Animator, during: string, offset: number)`: Overlap with another animation
- `start()`, `stop()`, `pause()`, `resume()`: Lifecycle control
- `animate(deltaTime: number)`: Update all child animations

### Built-in Helpers

#### `numberHelperFunctions`

Linear interpolation for numbers:

```typescript
import { Animation, numberHelperFunctions } from '@ue-too/animate';

let scale = 1;
const scaleAnimation = new Animation(
  [
    { percentage: 0, value: 1 },
    { percentage: 1, value: 2 }
  ],
  (value) => { scale = value; },
  numberHelperFunctions,
  500
);
```

#### `pointHelperFunctions`

Interpolate 2D points (requires `@ue-too/math`):

```typescript
import { Animation, pointHelperFunctions } from '@ue-too/animate';
import { Point } from '@ue-too/math';

let position: Point = { x: 0, y: 0 };

const moveAnimation = new Animation(
  [
    { percentage: 0, value: { x: 0, y: 0 } },
    { percentage: 1, value: { x: 100, y: 100 } }
  ],
  (value) => { position = value; },
  pointHelperFunctions,
  1000
);
```

#### `rgbHelperFunctions`

Interpolate RGB colors:

```typescript
import { Animation, rgbHelperFunctions, RGB } from '@ue-too/animate';

let color: RGB = { r: 255, g: 0, b: 0 };

const colorAnimation = new Animation(
  [
    { percentage: 0, value: { r: 255, g: 0, b: 0 } },    // Red
    { percentage: 0.5, value: { r: 255, g: 255, b: 0 } }, // Yellow
    { percentage: 1, value: { r: 0, g: 255, b: 0 } }     // Green
  ],
  (value) => { color = value; },
  rgbHelperFunctions,
  2000
);
```

#### `stringHelperFunctions`

Step-based interpolation for strings (switches at 50%):

```typescript
import { Animation, stringHelperFunctions } from '@ue-too/animate';

let state = 'idle';

const stateAnimation = new Animation(
  [
    { percentage: 0, value: 'idle' },
    { percentage: 1, value: 'active' }
  ],
  (value) => { state = value; },
  stringHelperFunctions,
  500
);
```

#### `integerHelperFunctions`

Step-based interpolation for discrete integers:

```typescript
import { Animation, integerHelperFunctions } from '@ue-too/animate';

let frameIndex = 0;

const frameAnimation = new Animation(
  [
    { percentage: 0, value: 0 },
    { percentage: 0.33, value: 1 },
    { percentage: 0.66, value: 2 },
    { percentage: 1, value: 3 }
  ],
  (value) => { frameIndex = value; },
  integerHelperFunctions,
  400
);
```

## Common Use Cases

### Fade In/Out Effect

```typescript
import { Animation, numberHelperFunctions } from '@ue-too/animate';

let opacity = 0;

const fadeIn = new Animation(
  [
    { percentage: 0, value: 0 },
    { percentage: 1, value: 1, easingFn: (t) => t * t } // Ease-in
  ],
  (value) => { opacity = value; },
  numberHelperFunctions,
  500
);

const fadeOut = new Animation(
  [
    { percentage: 0, value: 1 },
    { percentage: 1, value: 0, easingFn: (t) => 1 - (1 - t) * (1 - t) } // Ease-out
  ],
  (value) => { opacity = value; },
  numberHelperFunctions,
  500
);
```

### Animated Sprite Position

```typescript
import { Animation, pointHelperFunctions } from '@ue-too/animate';
import { Point } from '@ue-too/math';

let spritePosition: Point = { x: 0, y: 0 };

const bounce = new Animation(
  [
    { percentage: 0, value: { x: 0, y: 0 } },
    { percentage: 0.5, value: { x: 0, y: -50 }, easingFn: (t) => 1 - Math.pow(1 - t, 3) }, // Ease-out up
    { percentage: 1, value: { x: 0, y: 0 }, easingFn: (t) => t * t * t } // Ease-in down
  ],
  (value) => { spritePosition = value; },
  pointHelperFunctions,
  1000
);

bounce.loops = true; // Loop forever
```

### Sequential Animation Sequence

```typescript
import { Animation, CompositeAnimation, numberHelperFunctions, pointHelperFunctions } from '@ue-too/animate';

let x = 0, y = 0, opacity = 0;

// Create individual animations
const fadeIn = new Animation(
  [{ percentage: 0, value: 0 }, { percentage: 1, value: 1 }],
  (value) => { opacity = value; },
  numberHelperFunctions,
  500
);

const slideRight = new Animation(
  [{ percentage: 0, value: 0 }, { percentage: 1, value: 100 }],
  (value) => { x = value; },
  numberHelperFunctions,
  500
);

const slideDown = new Animation(
  [{ percentage: 0, value: 0 }, { percentage: 1, value: 50 }],
  (value) => { y = value; },
  numberHelperFunctions,
  300
);

// Create sequence: fade in, then slide right, then slide down
const sequence = new CompositeAnimation();
sequence.addAnimation('fadeIn', fadeIn, 0);
sequence.addAnimationAfter('slideRight', slideRight, 'fadeIn');
sequence.addAnimationAfter('slideDown', slideDown, 'slideRight');

sequence.start();

// Update in game loop
function update(deltaTime: number) {
  sequence.animate(deltaTime);
  // Render sprite at (x, y) with opacity
  requestAnimationFrame(() => update(16));
}
```

### Overlapping Animations

```typescript
const sequence = new CompositeAnimation();

// Start fade in at time 0
sequence.addAnimation('fadeIn', fadeInAnimation, 0);

// Start slide 200ms after fade in starts (overlap)
sequence.addAnimationAmidst('slide', slideAnimation, 'fadeIn', 200);

// Start scale after fade completes
sequence.addAnimationAfter('scale', scaleAnimation, 'fadeIn');
```

### Animation with Callbacks

```typescript
const animation = new Animation(/* ... */);

animation.onStart(() => {
  console.log('Animation started!');
});

animation.onEnd(() => {
  console.log('Animation completed!');
  // Trigger next action
});

animation.start();
```

### Looping with Max Count

```typescript
const bounceAnimation = new Animation(/* ... */);
bounceAnimation.loops = true;
bounceAnimation.maxLoopCount = 3; // Bounce 3 times then stop

bounceAnimation.start();
```

### Custom Easing Functions

Common easing functions:

```typescript
// Ease-in quadratic
const easeIn = (t: number) => t * t;

// Ease-out quadratic
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// Ease-in-out quadratic
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Elastic ease-out
const elasticOut = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// Use in keyframe
const keyframe = {
  percentage: 1,
  value: 100,
  easingFn: easeInOut
};
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/animate/).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```typescript
// Animations are fully typed
type Position = { x: number; y: number };

const posAnimation: Animation<Position> = new Animation(
  [{ percentage: 0, value: { x: 0, y: 0 } }],
  (value: Position) => { /* ... */ },
  pointHelperFunctions,
  1000
);

// Custom helper functions are type-safe
const myHelper: AnimatableAttributeHelper<number> = {
  lerp: (ratio, start, end) => {
    // TypeScript knows start.value and end.value are numbers
    return start.value + ratio * (end.value - start.value);
  }
};
```

## Design Philosophy

This animation library follows these principles:

- **Composition over monoliths**: Build complex animations from simple pieces
- **Type safety**: Leverage TypeScript for compile-time correctness
- **Frame-independent**: Animations work with any frame rate (use deltaTime)
- **Declarative keyframes**: Define what you want, not how to get there
- **Flexible timing**: Delays, drag, loops, and easing for fine control

## Performance Considerations

- **Update frequency**: Call `animate(deltaTime)` in your game loop at consistent intervals
- **Keyframe count**: More keyframes = more interpolation calculations (typically negligible)
- **Composite depth**: Deeply nested composites add minimal overhead
- **Memory**: Each animation retains keyframe data and callbacks

**Performance Tips:**
- Reuse animation instances when possible
- Use composite animations to group related animations
- Unsubscribe from callbacks (`onStart`, `onEnd`) when no longer needed
- For simple animations, consider direct property updates instead of keyframes

## Related Packages

- **[@ue-too/math](/math/)**: Vector operations for point animations
- **[@ue-too/curve](/curve/)**: Bezier curves that can be animated
- **[@ue-too/board](/board/)**: Canvas board that can use animations for transitions

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
