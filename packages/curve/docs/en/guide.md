# Getting Started

`@ue-too/curve` is a Bezier curve and geometric path library with intersection detection, arc-length parameterization, and curve operations.

## Installation

```bash
npm install @ue-too/curve
```

## Basic Usage

```typescript
import { CubicBezierCurve } from "@ue-too/curve";

const curve = new CubicBezierCurve(
    { x: 0, y: 0 },     // start
    { x: 50, y: 100 },   // control point 1
    { x: 150, y: 100 },  // control point 2
    { x: 200, y: 0 },    // end
);

// Get a point at t = 0.5
const midPoint = curve.getPoint(0.5);

// Get the total arc length
const length = curve.getLength();
```
