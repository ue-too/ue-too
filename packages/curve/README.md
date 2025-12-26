# @ue-too/curve

Bezier curve and geometric path library for TypeScript canvas applications.

[![npm version](https://img.shields.io/npm/v/@ue-too/curve.svg)](https://www.npmjs.com/package/@ue-too/curve)
[![license](https://img.shields.io/npm/l/@ue-too/curve.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE)

## Overview

`@ue-too/curve` provides comprehensive tools for working with Bezier curves, lines, and composite paths. Inspired by Pomax's [Primer on Bezier Curves](https://pomax.github.io/bezierinfo/), this library includes advanced features like curve intersection detection, offset curves, arc fitting, and arc-length parameterization.

### Key Features

- **Bezier Curves**: Quadratic and cubic Bezier curves with full geometric operations
- **Curve Evaluation**: Evaluate curves at any parameter `t` with caching for performance
- **Arc-Length Parameterization**: Uniform spacing along curves for animations and path following
- **Intersection Detection**: Self-intersections, curve-to-curve, curve-to-line, and curve-to-circle
- **Geometric Queries**: Project points, find closest points, calculate bounding boxes
- **Advanced Operations**: Split curves, offset curves, reduce complexity, fit arcs
- **Composite Curves**: Multi-segment curves with control points and tangent handles
- **Paths**: Sequential line segment paths with utilities

## Installation

Using Bun:
```bash
bun add @ue-too/curve
```

Using npm:
```bash
npm install @ue-too/curve
```

## Quick Start

Here's a simple example creating and evaluating a Bezier curve:

```typescript
import { BCurve } from '@ue-too/curve';

// Create a quadratic Bezier curve
const curve = new BCurve([
  { x: 0, y: 0 },      // Start point
  { x: 50, y: 100 },   // Control point
  { x: 100, y: 0 }     // End point
]);

// Evaluate at midpoint (t = 0.5)
const midpoint = curve.get(0.5);
console.log('Midpoint:', midpoint); // { x: 50, y: 50 }

// Get total arc length
console.log('Length:', curve.fullLength);

// Split curve at t = 0.5
const [left, right] = curve.splitIntoCurves(0.5);
```

## Core Concepts

### Bezier Curves

Bezier curves are parametric curves defined by control points. This library supports:

- **Linear Bezier** (2 control points): Straight line
- **Quadratic Bezier** (3 control points): Simple curve with one control point
- **Cubic Bezier** (4 control points): Complex curve with two control points

```typescript
// Linear Bezier (line)
const line = new BCurve([
  { x: 0, y: 0 },
  { x: 100, y: 100 }
]);

// Quadratic Bezier
const quadratic = new BCurve([
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 100, y: 0 }
]);

// Cubic Bezier
const cubic = new BCurve([
  { x: 0, y: 0 },
  { x: 33, y: 100 },
  { x: 66, y: 100 },
  { x: 100, y: 0 }
]);
```

### Parameter `t`

Bezier curves are evaluated using a parameter `t` from 0.0 (start) to 1.0 (end):

```typescript
const start = curve.get(0);    // Start point
const mid = curve.get(0.5);    // Midpoint
const end = curve.get(1);      // End point
const quarter = curve.get(0.25); // 25% along the curve
```

## Core APIs

### BCurve Class

Main Bezier curve class with extensive geometric operations.

**Constructor:**
```typescript
const curve = new BCurve(controlPoints: Point[]);
```

**Curve Evaluation:**
- `get(t: number): Point` - Get point at parameter t
- `derivative(t: number): Point` - Get derivative vector at t
- `normal(t: number): Point` - Get normal vector at t
- `tangent(t: number): Point` - Get tangent vector at t

**Geometric Properties:**
- `fullLength: number` - Total arc length (cached)
- `bbox(): {x: {min: number, max: number}, y: {min: number, max: number}}` - Axis-aligned bounding box
- `extrema(): {x: number[], y: number[]}` - Find extrema (min/max) points
- `curvature(t: number): number` - Calculate curvature at t

**Curve Manipulation:**
- `splitIntoCurves(t: number): [BCurve, BCurve]` - Split into two curves at t
- `scale(factor: number, origin?: Point): BCurve` - Scale curve around origin
- `offset(distance: number): BCurve | BCurve[]` - Create offset (parallel) curve

**Intersection Detection:**
- `getCurveIntersections(other: BCurve): {selfT: number, otherT: number}[]` - Find curve-curve intersections
- `getLineIntersections(line: Line): number[]` - Find curve-line intersection points
- `getCircleIntersections(center: Point, radius: number): number[]` - Find curve-circle intersections
- `getSelfIntersections(): {t1: number, t2: number}[]` - Detect self-intersections

**Point Queries:**
- `project(point: Point): {t: number, point: Point, distance: number}` - Project point onto curve
- `closestPoint(point: Point): Point` - Find closest point on curve

**Arc-Length Functions:**
- `length(t: number): number` - Arc length from start to parameter t
- `parameter(length: number): number` - Find parameter t for a given arc length

### Line Class

Straight line segment utilities.

**Constructor:**
```typescript
const line = new Line(start: Point, end: Point);
```

**Properties:**
- `start: Point` - Starting point
- `end: Point` - Ending point
- `length: number` - Line length

**Methods:**
- `get(t: number): Point` - Get point at parameter t (0-1)
- `intersects(other: Line): Point | null` - Find intersection point with another line
- `project(point: Point): {t: number, point: Point}` - Project point onto line
- `distanceToPoint(point: Point): number` - Distance from point to line

### CompositeBCurve Class

Composite curve made of multiple Bezier segments with control points and tangent handles.

**Constructor:**
```typescript
const composite = new CompositeBCurve(controlPoints: ControlPoint[]);
```

**Control Point Structure:**
```typescript
type ControlPoint = {
  point: Point;              // Anchor point
  leftHandle?: Point;        // Left tangent handle
  rightHandle?: Point;       // Right tangent handle
};
```

### Path Class

Path composed of sequential line segments.

**Constructor:**
```typescript
const path = new Path(points: Point[]);
```

**Methods:**
- `get(index: number): Line` - Get line segment at index
- `length(): number` - Total path length
- `bbox(): {x: {min, max}, y: {min, max}}` - Bounding box

## Common Use Cases

### Draw a Curve on Canvas

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 50, y: 200 },
  { x: 150, y: 50 },
  { x: 250, y: 200 }
]);

// Draw using canvas API
ctx.beginPath();
ctx.moveTo(curve.points[0].x, curve.points[0].y);

if (curve.points.length === 3) {
  // Quadratic curve
  ctx.quadraticCurveTo(
    curve.points[1].x, curve.points[1].y,
    curve.points[2].x, curve.points[2].y
  );
} else if (curve.points.length === 4) {
  // Cubic curve
  ctx.bezierCurveTo(
    curve.points[1].x, curve.points[1].y,
    curve.points[2].x, curve.points[2].y,
    curve.points[3].x, curve.points[3].y
  );
}

ctx.stroke();
```

### Animate Object Along Curve

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 0, y: 100 },
  { x: 100, y: 0 },
  { x: 200, y: 100 }
]);

let t = 0;

function animate() {
  t += 0.01;
  if (t > 1) t = 0;

  const position = curve.get(t);
  const tangent = curve.tangent(t);

  // Draw object at position with rotation from tangent
  const angle = Math.atan2(tangent.y, tangent.x);
  drawSprite(position.x, position.y, angle);

  requestAnimationFrame(animate);
}
```

### Uniform Spacing with Arc-Length Parameterization

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: 200, y: 0 }
]);

const totalLength = curve.fullLength;
const spacing = 10; // Pixels between points
const numPoints = Math.floor(totalLength / spacing);

// Place points uniformly along the curve
for (let i = 0; i <= numPoints; i++) {
  const arcLength = i * spacing;
  const t = curve.parameter(arcLength); // Convert arc-length to parameter
  const point = curve.get(t);

  drawPoint(point.x, point.y);
}
```

### Detect Curve Intersections

```typescript
import { BCurve } from '@ue-too/curve';

const curve1 = new BCurve([
  { x: 0, y: 50 },
  { x: 100, y: 150 },
  { x: 200, y: 50 }
]);

const curve2 = new BCurve([
  { x: 0, y: 100 },
  { x: 100, y: 0 },
  { x: 200, y: 100 }
]);

const intersections = curve1.getCurveIntersections(curve2);

intersections.forEach(({ selfT, otherT }) => {
  const point1 = curve1.get(selfT);
  const point2 = curve2.get(otherT);

  console.log('Intersection at:', point1);
  // point1 and point2 should be very close (within numerical precision)
});
```

### Find Closest Point on Curve

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 100, y: 0 }
]);

const mousePosition = { x: 60, y: 40 };
const { t, point, distance } = curve.project(mousePosition);

console.log('Closest point:', point);
console.log('At parameter:', t);
console.log('Distance:', distance);

// Snap mouse to curve
if (distance < 10) {
  snapToCurve(point);
}
```

### Create Offset Curve

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 0, y: 100 },
  { x: 100, y: 0 },
  { x: 200, y: 100 }
]);

// Create curve offset by 20 pixels
const offsetCurves = curve.offset(20);

// Offset may produce multiple curve segments
offsetCurves.forEach(offsetCurve => {
  drawCurve(offsetCurve);
});
```

### Split Curve at Point

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 100, y: 0 }
]);

// Split at 30% along the curve
const [leftPart, rightPart] = curve.splitIntoCurves(0.3);

// Draw each part in different colors
drawCurve(leftPart, 'red');
drawCurve(rightPart, 'blue');
```

### Bounding Box for Culling

```typescript
import { BCurve } from '@ue-too/curve';

const curve = new BCurve([
  { x: 10, y: 20 },
  { x: 150, y: 200 },
  { x: 300, y: 50 }
]);

const bbox = curve.bbox();

// Check if curve is visible in viewport
const isVisible = (
  bbox.x.max >= viewport.left &&
  bbox.x.min <= viewport.right &&
  bbox.y.max >= viewport.top &&
  bbox.y.min <= viewport.bottom
);

if (isVisible) {
  drawCurve(curve);
}
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](../../docs/curve).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```typescript
import { BCurve, Line, Point } from '@ue-too/curve';

// Points are fully typed
const point: Point = { x: 10, y: 20 };

// Curves are generic over control point count
const quadratic: BCurve = new BCurve([
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 100, y: 0 }
]);

// Intersection results are typed
const intersections: { selfT: number; otherT: number }[] =
  curve1.getCurveIntersections(curve2);
```

## Design Philosophy

This library follows these principles:

- **Geometric correctness**: Implements algorithms from academic literature
- **Performance**: Caches expensive calculations (arc-length tables)
- **Type safety**: Leverages TypeScript for compile-time guarantees
- **Composability**: Build complex curves from simple primitives
- **Practical**: Focused on real-world canvas and graphics use cases

## Performance Considerations

- **Arc-length caching**: First call to `fullLength` builds a lookup table, subsequent calls are O(1)
- **Intersection detection**: Uses recursive subdivision (can be expensive for complex curves)
- **Curve splitting**: Fast operation using De Casteljau's algorithm
- **Offset curves**: Computationally expensive, may produce multiple segments

**Performance Tips:**
- Cache `fullLength` results if curves don't change
- Use bounding box checks before expensive intersection tests
- Reduce curve complexity with `reduce()` for long curves
- Split curves into segments for faster intersection detection

## Related Packages

- **[@ue-too/math](../math)**: Vector operations for point manipulation
- **[@ue-too/animate](../animate)**: Animate objects along curves
- **[@ue-too/border](../border)**: Border rendering that can use curves
- **[@ue-too/board](../board)**: Canvas board for rendering curves

## Further Reading

- [A Primer on Bezier Curves](https://pomax.github.io/bezierinfo/) by Pomax - Comprehensive guide this library is based on
- [bezier-js](https://github.com/Pomax/bezierjs) - Reference implementation in JavaScript
- [De Casteljau's algorithm](https://en.wikipedia.org/wiki/De_Casteljau%27s_algorithm) - Curve evaluation and splitting

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
