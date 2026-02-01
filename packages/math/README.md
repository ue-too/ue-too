<h1 align="center">
    @ue-too/math
</h1>
<p align="center">
    Mathematical utilities for 2D and 3D point operations and transformations
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@ue-too/math.svg?style=for-the-badge)](https://www.npmjs.com/package/@ue-too/math)
[![License](https://img.shields.io/github/license/ue-too/ue-too?style=for-the-badge)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

</div>

## Overview

`@ue-too/math` provides essential mathematical operations for canvas-based applications, including vector arithmetic, geometric transformations, angle calculations, and point comparisons. It seamlessly handles both 2D and 3D coordinates.

### Key Features

- **Vector Operations**: Addition, subtraction, scaling, dot product, cross product
- **Geometric Transformations**: Rotation, axis transformation, coordinate conversion
- **Angle Utilities**: Normalization, angular difference calculation
- **Point Utilities**: Distance, interpolation, intersection detection
- **Comparison Functions**: Approximate equality with configurable precision
- **2D/3D Support**: All operations work with optional z-coordinates

## Installation

```bash
npm install @ue-too/math
```

## Quick Start

```typescript
import { Point, PointCal } from '@ue-too/math';

// Vector addition
const a: Point = { x: 1, y: 2 };
const b: Point = { x: 3, y: 4 };
const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }

// Calculate magnitude
const magnitude = PointCal.magnitude(a); // 2.236...

// Rotate a point
const point: Point = { x: 10, y: 0 };
const rotated = PointCal.rotatePoint(point, Math.PI / 2); // 90 degrees
// Result: { x: ~0, y: 10 }

// Get distance between points
const distance = PointCal.distanceBetweenPoints(a, b); // 2.828...
```

## Core APIs

### PointCal Class

The `PointCal` class provides static methods for all point and vector operations.

#### Vector Arithmetic

```typescript
// Add two vectors
PointCal.addVector(a, b);

// Subtract vectors
PointCal.subVector(a, b);

// Scale by scalar
PointCal.multiplyVectorByScalar(v, 2.5);

// Divide by scalar
PointCal.divideVectorByScalar(v, 2);
```

#### Vector Operations

```typescript
// Magnitude (length) of vector
PointCal.magnitude(v);

// Unit vector (normalized to length 1)
PointCal.unitVector(v);

// Dot product
PointCal.dotProduct(a, b);

// Cross product
PointCal.crossProduct(a, b);

// Unit vector from point a to point b
PointCal.unitVectorFromA2B(a, b);
```

#### Transformations

```typescript
// Rotate point around origin
PointCal.rotatePoint(point, angleInRadians);

// Rotate point around custom anchor
PointCal.transformPointWRTAnchor(point, anchor, angleInRadians);

// Transform to new axis system
PointCal.transform2NewAxis(point, angleInRadians);

// Flip y-axis (useful for coordinate system conversion)
PointCal.flipYAxis(point);
```

#### Geometric Calculations

```typescript
// Distance between points
PointCal.distanceBetweenPoints(a, b);

// Linear interpolation (lerp)
PointCal.linearInterpolation(a, b, 0.5); // Midpoint

// Angle from vector a to vector b
PointCal.angleFromA2B(a, b);

// Line segment intersection
PointCal.getLineIntersection(line1Start, line1End, line2Start, line2End);
```

### Angle Utilities

```typescript
import { angleSpan, normalizeAngleZero2TwoPI } from '@ue-too/math';

// Normalize angle to [0, 2π)
const normalized = normalizeAngleZero2TwoPI(Math.PI * 3); // π

// Calculate smallest angle difference
const diff = angleSpan(fromAngle, toAngle); // Range: (-π, π]
```

### Comparison Functions

```typescript
import { approximatelyTheSame, sameDirection, samePoint } from '@ue-too/math';

// Check if points are approximately equal
samePoint(a, b); // Uses default precision (0.000001)
samePoint(a, b, 0.01); // Custom precision

// Check if vectors have same direction
sameDirection(v1, v2);

// Approximate number equality
approximatelyTheSame(1.0, 1.0000001); // true
```

## Common Use Cases

### Canvas Transformations

```typescript
import { Point, PointCal } from '@ue-too/math';

// Transform mouse coordinates to rotated canvas space
const mousePos: Point = { x: 150, y: 200 };
const canvasCenter: Point = { x: 100, y: 100 };
const canvasRotation = Math.PI / 4; // 45 degrees

const transformedPos = PointCal.transformPointWRTAnchor(
    mousePos,
    canvasCenter,
    -canvasRotation // Inverse rotation
);
```

### Path Following

```typescript
import { Point, PointCal } from '@ue-too/math';

// Calculate direction from current position to target
const current: Point = { x: 10, y: 20 };
const target: Point = { x: 50, y: 80 };

const direction = PointCal.unitVectorFromA2B(current, target);
const speed = 5;

// Move toward target
const newPosition = PointCal.addVector(
    current,
    PointCal.multiplyVectorByScalar(direction, speed)
);
```

### Smooth Interpolation

```typescript
import { Point, PointCal } from '@ue-too/math';

// Animate between two positions
const start: Point = { x: 0, y: 0 };
const end: Point = { x: 100, y: 100 };
const progress = 0.3; // 30% through animation

const currentPos = PointCal.linearInterpolation(start, end, progress);
```

## API Reference

For complete API documentation with detailed examples, see:

- [Full TypeDoc Documentation](/math/) (generated from source)
- [Source Code](https://github.com/ue-too/ue-too/blob/main/packages/math/src/index.ts) with inline JSDoc comments

## TypeScript Support

This package is written in TypeScript and includes full type definitions:

```typescript
import { Point, PointCal } from '@ue-too/math';

const point: Point = { x: 10, y: 20 }; // z is optional
const point3d: Point = { x: 10, y: 20, z: 30 };
```

## Performance Considerations

- All operations are pure functions with no side effects
- Static methods minimize object allocation overhead
- Suitable for tight animation loops (60fps)
- For performance-critical code, consider using the operations directly rather than chaining

### Performance Tips

```typescript
// ✅ Good: Single operation
const mag = PointCal.magnitude(vector);

// ⚠️ Less optimal: Multiple magnitude calls
const unit = PointCal.unitVector(vector); // Calls magnitude twice internally

// ✅ Better: Calculate magnitude once if needed separately
const mag = PointCal.magnitude(vector);
const unit = PointCal.divideVectorByScalar(vector, mag);
```

## Related Packages

- `@ue-too/board` - Canvas viewport management with pan, zoom, rotate
- `@ue-too/animate` - Animation system using these math utilities
- `@ue-too/dynamics` - Physics engine built on these operations

## License

MIT License - see [LICENSE.txt](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt) for details.

## Contributing

> Currently not accepting contributions. If you have feature requests or bug reports, please [create an issue](https://github.com/ue-too/ue-too/issues).
