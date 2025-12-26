# @ue-too/border

Geodesy and map projection library for TypeScript.

[![npm version](https://img.shields.io/npm/v/@ue-too/border.svg)](https://www.npmjs.com/package/@ue-too/border)
[![license](https://img.shields.io/npm/l/@ue-too/border.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

## Overview

`@ue-too/border` provides geodesy calculations and map projections for working with geographic coordinates on the Earth's surface. Based on algorithms from [Movable Type Scripts](https://www.movable-type.co.uk/scripts/latlong.html) by Chris Veness, this library includes utilities for great circle navigation, rhumb line navigation, and coordinate transformations.

### Key Features

- **Great Circle Navigation**: Shortest path calculations on a sphere
- **Rhumb Line Navigation**: Constant bearing paths for easier navigation
- **Map Projections**: Mercator and orthographic projections with inverse transformations
- **Distance Calculations**: Accurate distances between geographic coordinates
- **Bearing Calculations**: Initial and constant bearings for navigation
- **Intermediate Points**: Find points along paths
- **Midpoint Calculation**: Find midpoints between coordinates

## Installation

Using Bun:
```bash
bun add @ue-too/border
```

Using npm:
```bash
npm install @ue-too/border
```

## Quick Start

Here's a simple example calculating distance and bearing between two cities:

```typescript
import {
  greatCircleDistance,
  initialBearingOfGreatCircle
} from '@ue-too/border';

// New York to London
const nyc = { latitude: 40.7128, longitude: -74.0060 };
const london = { latitude: 51.5074, longitude: -0.1278 };

// Calculate great circle distance (in meters)
const distance = greatCircleDistance(nyc, london);
console.log('Distance:', (distance / 1000).toFixed(0), 'km'); // ~5570 km

// Calculate initial bearing (in degrees)
const bearing = initialBearingOfGreatCircle(nyc, london);
console.log('Bearing:', bearing.toFixed(1), '°'); // ~51.4° (northeast)
```

## Core Concepts

### Great Circles

A great circle is the shortest path between two points on a sphere (like the Earth). Airlines typically fly great circle routes to minimize distance.

- **Advantages**: Shortest distance, fuel-efficient
- **Characteristics**: Bearing changes continuously along the path (except when traveling due north/south or along the equator)

### Rhumb Lines

A rhumb line (loxodrome) is a path of constant bearing. While slightly longer than great circles, they're easier to navigate.

- **Advantages**: Constant bearing, simpler navigation
- **Characteristics**: Spirals toward poles, longer distance than great circles (except along equator or meridians)

### Map Projections

Map projections transform spherical coordinates (latitude/longitude) to flat 2D coordinates for display.

- **Mercator**: Preserves angles, distorts size at high latitudes
- **Orthographic**: Perspective view from space, shows one hemisphere

## Core APIs

### Great Circle Functions

#### `greatCircleDistance(from, to)`

Calculate the great circle distance between two points.

```typescript
function greatCircleDistance(
  from: GeoCoord,
  to: GeoCoord
): number; // Returns distance in meters
```

**Example:**
```typescript
const distance = greatCircleDistance(
  { latitude: 51.5074, longitude: -0.1278 }, // London
  { latitude: 48.8566, longitude: 2.3522 }   // Paris
);
console.log(distance / 1000, 'km'); // ~344 km
```

#### `initialBearingOfGreatCircle(from, to)`

Calculate the initial bearing (direction) for a great circle path.

```typescript
function initialBearingOfGreatCircle(
  from: GeoCoord,
  to: GeoCoord
): number; // Returns bearing in degrees (0-360)
```

**Example:**
```typescript
const bearing = initialBearingOfGreatCircle(
  { latitude: 40.7128, longitude: -74.0060 }, // NYC
  { latitude: 51.5074, longitude: -0.1278 }   // London
);
console.log(bearing, '°'); // ~51.4° (northeast)
```

#### `destinationFromOriginOnGreatCircle(origin, bearing, distance)`

Find the destination point given origin, bearing, and distance.

```typescript
function destinationFromOriginOnGreatCircle(
  origin: GeoCoord,
  bearing: number,  // Degrees
  distance: number  // Meters
): GeoCoord;
```

**Example:**
```typescript
const start = { latitude: 51.5074, longitude: -0.1278 };
const destination = destinationFromOriginOnGreatCircle(start, 90, 100000);
console.log('100km east:', destination);
```

#### `midpointOnGreatCircle(from, to)`

Find the midpoint along a great circle path.

```typescript
function midpointOnGreatCircle(
  from: GeoCoord,
  to: GeoCoord
): GeoCoord;
```

#### `intermediatePointOnGreatCircle(from, to, fraction)`

Find a point at a given fraction along the great circle path.

```typescript
function intermediatePointOnGreatCircle(
  from: GeoCoord,
  to: GeoCoord,
  fraction: number  // 0.0 to 1.0
): GeoCoord;
```

**Example:**
```typescript
// Find the point 25% of the way from NYC to London
const point = intermediatePointOnGreatCircle(nyc, london, 0.25);
```

### Rhumb Line Functions

#### `rhumbDistance(from, to)`

Calculate the rhumb line distance (constant bearing path).

```typescript
function rhumbDistance(
  from: GeoCoord,
  to: GeoCoord
): number; // Returns distance in meters
```

#### `rhumbBearing(from, to)`

Calculate the constant bearing for a rhumb line.

```typescript
function rhumbBearing(
  from: GeoCoord,
  to: GeoCoord
): number; // Returns bearing in degrees (0-360)
```

#### `destinationFromOriginOnRhumbLine(origin, bearing, distance)`

Find the destination on a rhumb line given origin, bearing, and distance.

```typescript
function destinationFromOriginOnRhumbLine(
  origin: GeoCoord,
  bearing: number,  // Degrees
  distance: number  // Meters
): GeoCoord;
```

#### `midpointOnRhumbLine(from, to)`

Find the midpoint along a rhumb line.

```typescript
function midpointOnRhumbLine(
  from: GeoCoord,
  to: GeoCoord
): GeoCoord;
```

### Map Projection Functions

#### `mercatorProjection(coord)`

Convert geographic coordinates to Mercator projection.

```typescript
function mercatorProjection(
  coord: GeoCoord
): Point; // Returns {x, y} in normalized coordinates
```

**Example:**
```typescript
const point = mercatorProjection({ latitude: 51.5074, longitude: -0.1278 });
console.log('Mercator coordinates:', point);
```

#### `inverseMercatorProjection(point)`

Convert Mercator coordinates back to geographic.

```typescript
function inverseMercatorProjection(
  point: Point
): GeoCoord; // Returns {latitude, longitude}
```

#### `orthoProjection(coord, origin)`

Convert geographic coordinates to orthographic projection (hemisphere view).

```typescript
function orthoProjection(
  coord: GeoCoord,
  origin: GeoCoord  // Center of projection
): {
  coord: Point;     // Projected point
  clipped: boolean; // True if coord is on the back hemisphere
};
```

**Example:**
```typescript
// Project London as seen from the North Pole
const result = orthoProjection(
  { latitude: 51.5074, longitude: -0.1278 },
  { latitude: 90, longitude: 0 }
);

if (!result.clipped) {
  console.log('Visible at:', result.coord);
}
```

### Type Definitions

```typescript
type GeoCoord = {
  latitude: number;   // Degrees, -90 to 90
  longitude: number;  // Degrees, -180 to 180
};

type Point = {
  x: number;
  y: number;
};
```

## Common Use Cases

### Calculate Flight Distance and Route

```typescript
import {
  greatCircleDistance,
  initialBearingOfGreatCircle,
  intermediatePointOnGreatCircle
} from '@ue-too/border';

const departure = { latitude: 40.6413, longitude: -73.7781 }; // JFK
const arrival = { latitude: 51.4700, longitude: -0.4543 };    // LHR

// Total distance
const distance = greatCircleDistance(departure, arrival);
console.log('Flight distance:', (distance / 1000).toFixed(0), 'km');

// Initial heading
const heading = initialBearingOfGreatCircle(departure, arrival);
console.log('Initial heading:', heading.toFixed(1), '°');

// Waypoint halfway through
const midpoint = intermediatePointOnGreatCircle(departure, arrival, 0.5);
console.log('Midpoint:', midpoint);
```

### Display Map with Mercator Projection

```typescript
import { mercatorProjection } from '@ue-too/border';

const cities = [
  { name: 'New York', latitude: 40.7128, longitude: -74.0060 },
  { name: 'London', latitude: 51.5074, longitude: -0.1278 },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 }
];

// Project to screen coordinates
cities.forEach(city => {
  const point = mercatorProjection(city);

  // Scale to canvas (assuming 1000x600 canvas)
  const x = (point.x + 180) / 360 * 1000;
  const y = (1 - (point.y + 90) / 180) * 600;

  drawCity(x, y, city.name);
});
```

### Navigate with Constant Bearing

```typescript
import {
  rhumbBearing,
  destinationFromOriginOnRhumbLine
} from '@ue-too/border';

const start = { latitude: 50.0, longitude: -5.0 };
const target = { latitude: 58.0, longitude: 3.0 };

// Get constant bearing to maintain
const bearing = rhumbBearing(start, target);
console.log('Sail on bearing:', bearing.toFixed(1), '°');

// Calculate positions every 50 nautical miles
const nauticalMileInMeters = 1852;
let currentPos = start;

for (let i = 1; i <= 10; i++) {
  currentPos = destinationFromOriginOnRhumbLine(
    currentPos,
    bearing,
    50 * nauticalMileInMeters
  );
  console.log(`Waypoint ${i}:`, currentPos);
}
```

### Find Nearest City

```typescript
import { greatCircleDistance } from '@ue-too/border';

const userLocation = { latitude: 48.8566, longitude: 2.3522 }; // Paris

const cities = [
  { name: 'London', coord: { latitude: 51.5074, longitude: -0.1278 } },
  { name: 'Berlin', coord: { latitude: 52.5200, longitude: 13.4050 } },
  { name: 'Madrid', coord: { latitude: 40.4168, longitude: -3.7038 } },
  { name: 'Rome', coord: { latitude: 41.9028, longitude: 12.4964 } }
];

const distances = cities.map(city => ({
  ...city,
  distance: greatCircleDistance(userLocation, city.coord)
}));

distances.sort((a, b) => a.distance - b.distance);
console.log('Nearest city:', distances[0].name,
            '- ', (distances[0].distance / 1000).toFixed(0), 'km');
```

### Globe Visualization with Orthographic Projection

```typescript
import { orthoProjection } from '@ue-too/border';

// View centered on Europe
const viewCenter = { latitude: 50, longitude: 10 };

const cities = [
  { name: 'London', coord: { latitude: 51.5074, longitude: -0.1278 } },
  { name: 'Paris', coord: { latitude: 48.8566, longitude: 2.3522 } },
  { name: 'Berlin', coord: { latitude: 52.5200, longitude: 13.4050 } }
];

cities.forEach(city => {
  const result = orthoProjection(city.coord, viewCenter);

  if (!result.clipped) {
    // City is visible on this hemisphere
    const screenX = result.coord.x * 400 + 400; // Scale to canvas
    const screenY = result.coord.y * 400 + 400;

    drawCityOnGlobe(screenX, screenY, city.name);
  }
});
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/border/).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```typescript
import { GeoCoord, Point, greatCircleDistance } from '@ue-too/border';

// Coordinates are fully typed
const coord: GeoCoord = { latitude: 51.5074, longitude: -0.1278 };

// Function signatures are type-safe
const distance: number = greatCircleDistance(coord1, coord2);

// Projection results are typed
const point: Point = mercatorProjection(coord);
```

## Design Philosophy

This library follows these principles:

- **Accuracy**: Uses proven geodesy algorithms from academic sources
- **Simplicity**: Clean, focused API for common geodesy tasks
- **Type Safety**: Full TypeScript type definitions
- **Performance**: Efficient calculations suitable for real-time applications
- **Practicality**: Focused on real-world mapping and navigation use cases

## Performance Considerations

- **Distance calculations**: O(1) - simple trigonometric calculations
- **Projections**: O(1) - direct mathematical transformations
- **Intermediate points**: O(1) - no iteration required

**Performance Tips:**
- Cache distance and bearing calculations if coordinates don't change
- For many points, batch projection calculations
- Use appropriate projection for your use case (Mercator for general mapping, orthographic for globes)

## Limitations

- **Earth model**: Assumes spherical Earth (not ellipsoidal) - sufficient for most applications but less accurate for high-precision surveying
- **Coordinate range**: Latitude must be in [-90, 90], longitude in [-180, 180]
- **Polar regions**: Some calculations may be less accurate near poles
- **Mercator distortion**: Mercator projection heavily distorts areas near poles

## Related Packages

- **[@ue-too/math](/math/)**: Vector operations for point calculations
- **[@ue-too/curve](/curve/)**: Bezier curves for drawing map features
- **[@ue-too/board](/board/)**: Canvas board for rendering maps

## Further Reading

- [Movable Type Scripts](https://www.movable-type.co.uk/scripts/latlong.html) - Comprehensive geodesy reference
- [Map Projections](https://en.wikipedia.org/wiki/Map_projection) - Understanding different projections
- [Great Circle Navigation](https://en.wikipedia.org/wiki/Great-circle_navigation) - Theory and applications
- [Rhumb Line](https://en.wikipedia.org/wiki/Rhumb_line) - Constant bearing navigation

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
