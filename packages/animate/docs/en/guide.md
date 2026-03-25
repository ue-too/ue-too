# Getting Started

`@ue-too/animate` is a keyframe-based animation library with composable animations, easing functions, and lifecycle hooks.

## Installation

```bash
npm install @ue-too/animate
```

## Basic Usage

```typescript
import { AnimationGroup } from "@ue-too/animate";

const group = new AnimationGroup();
const animation = group.add({
    duration: 1000,
    from: { x: 0, y: 0 },
    to: { x: 100, y: 200 },
});

animation.onUpdate((value) => {
    // Animate an element
    element.style.transform = `translate(${value.x}px, ${value.y}px)`;
});
```
