# Getting Started

`@ue-too/math` provides mathematical utilities for 2D and 3D point operations, vector arithmetic, geometric transformations, and angle calculations.

## Installation

```bash
npm install @ue-too/math
```

## Basic Usage

```typescript
import { PointCal } from "@ue-too/math";

// Vector addition
const a = { x: 1, y: 2 };
const b = { x: 3, y: 4 };
const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }

// Vector magnitude
const mag = PointCal.magnitude(a); // 2.236...

// Rotation
const rotated = PointCal.rotatePoint(a, Math.PI / 2); // 90 degrees
```
