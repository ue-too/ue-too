# @ue-too/dynamics

2D physics engine with rigid body dynamics and collision detection.

[![npm version](https://img.shields.io/npm/v/@ue-too/dynamics.svg)](https://www.npmjs.com/package/@ue-too/dynamics)
[![license](https://img.shields.io/npm/l/@ue-too/dynamics.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE)

> **Experimental**: This package is an experimental implementation. Please **DO NOT** use this in production.

## Overview

`@ue-too/dynamics` provides a complete 2D physics simulation engine featuring rigid body dynamics, collision detection, constraint solving, and performance optimizations like spatial indexing and sleeping bodies.

### Key Features

- **Rigid Body Physics**: Linear and angular velocity, mass, moment of inertia
- **Collision Detection**: Broad phase (spatial indexing) + narrow phase (SAT)
- **Collision Response**: Impulse-based resolution with friction and restitution
- **Constraints**: Pin joints (fixed and between bodies) with Baumgarte stabilization
- **Spatial Indexing**: QuadTree, Dynamic Tree, and Sweep-and-Prune algorithms
- **Sleeping System**: Automatically disable resting bodies for performance
- **Collision Filtering**: Category-based filtering with masks and groups
- **Shape Types**: Circles and convex polygons

## Installation

Using Bun:
```bash
bun add @ue-too/dynamics
```

Using npm:
```bash
npm install @ue-too/dynamics
```

## Quick Start

Here's a simple example creating a physics world with a falling ball:

```typescript
import { World, Circle, Polygon } from '@ue-too/dynamics';

// Create a physics world (2000x2000 world size)
const world = new World(2000, 2000, 'dynamictree');

// Create static ground
const ground = new Polygon(
  { x: 0, y: -100 },                      // Position
  [                                        // Vertices (local space)
    { x: -1000, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 50 },
    { x: -1000, y: 50 }
  ],
  0,      // Rotation
  100,    // Mass (ignored for static bodies)
  true    // isStatic
);
world.addRigidBody('ground', ground);

// Create dynamic ball
const ball = new Circle(
  { x: 0, y: 200 },  // Position
  20,                // Radius
  0,                 // Rotation
  10,                // Mass
  false              // isStatic
);
world.addRigidBody('ball', ball);

// Simulation loop (60 FPS)
setInterval(() => {
  world.step(1/60);  // deltaTime in seconds

  console.log('Ball position:', ball.position);
}, 16);
```

## Core Concepts

### Rigid Bodies

Rigid bodies are objects that don't deform. They have:

- **Position**: World coordinates
- **Rotation**: Angle in radians
- **Velocity**: Linear velocity vector
- **Angular Velocity**: Rotation speed in radians/second
- **Mass**: Affects how much force is needed to move the body
- **Moment of Inertia**: Resistance to rotational acceleration

### Static vs Dynamic Bodies

- **Static**: Don't move, infinite mass (walls, floors, platforms)
- **Dynamic**: Move and respond to forces (players, projectiles, debris)
- **Kinematic**: Move but don't respond to collisions (moving platforms)

### Collision Detection Phases

1. **Broad Phase**: Uses spatial indexing to quickly find potentially colliding pairs
   - QuadTree: Good for static worlds
   - Dynamic Tree: Good for mixed static/dynamic
   - Sweep-and-Prune: Best for many dynamic bodies

2. **Narrow Phase**: Precise collision detection using Separating Axis Theorem (SAT)

### Collision Filtering

Bodies can be filtered by:
- **Category**: What category this body belongs to (bit flags)
- **Mask**: Which categories this body collides with (bit flags)
- **Group**: Positive groups collide only with same group, negative never collide

## Core APIs

### World Class

Main physics world container.

**Constructor:**
```typescript
const world = new World(
  worldWidth: number,
  worldHeight: number,
  spatialIndexType?: 'quadtree' | 'dynamictree' | 'sap'
);
```

**Methods:**
- `step(deltaTime: number)`: Advance simulation by deltaTime seconds
- `addRigidBody(id: string, body: RigidBody)`: Add a rigid body
- `removeRigidBody(id: string)`: Remove a rigid body
- `addConstraint(constraint: Constraint)`: Add a constraint
- `removeConstraint(constraint: Constraint)`: Remove a constraint
- `setSpatialIndexType(type)`: Change spatial indexing algorithm
- `queryAABB(aabb): RigidBody[]`: Find all bodies in an AABB region
- `queryPoint(point): RigidBody[]`: Find all bodies containing a point
- `rayCast(from, to): RayCastResult[]`: Ray casting

**Properties:**
- `gravity: Point`: World gravity vector (default: `{x: 0, y: -9.8}`)
- `sleepingEnabled: boolean`: Enable/disable sleeping system
- `bodies: Map<string, RigidBody>`: All bodies in the world
- `constraints: Constraint[]`: All constraints

### Circle Class

Circular rigid body.

**Constructor:**
```typescript
const circle = new Circle(
  position: Point,
  radius: number,
  rotation: number,
  mass: number,
  isStatic: boolean
);
```

**Properties:**
- `position: Point`: World position
- `velocity: Point`: Linear velocity
- `rotation: number`: Rotation in radians
- `angularVelocity: number`: Rotation speed
- `mass: number`: Mass (0 for static bodies)
- `radius: number`: Circle radius
- `restitution: number`: Bounciness (0-1)
- `friction: number`: Friction coefficient
- `collisionFilter: CollisionFilter`: Filtering

### Polygon Class

Convex polygon rigid body.

**Constructor:**
```typescript
const polygon = new Polygon(
  position: Point,
  vertices: Point[],        // Local space vertices
  rotation: number,
  mass: number,
  isStatic: boolean
);
```

**Properties:**
- Same as Circle, plus:
- `vertices: Point[]`: Vertices in local space
- `worldVertices: Point[]`: Vertices in world space (computed)

**Methods:**
- `updateWorldVertices()`: Recompute world vertices after transform changes

### Constraints

#### PinJoint

Pin joint between two bodies.

```typescript
const joint = new PinJoint(
  bodyA: RigidBody,
  bodyB: RigidBody,
  anchorA: Point,  // Local anchor on bodyA
  anchorB: Point   // Local anchor on bodyB
);
```

#### FixedPinJoint

Pin joint from body to world point.

```typescript
const fixedJoint = new FixedPinJoint(
  body: RigidBody,
  localAnchor: Point,  // Local anchor on body
  worldAnchor: Point   // Fixed world position
);
```

### Collision Filter

```typescript
type CollisionFilter = {
  category: number;    // What category this body is (bit flags)
  mask: number;        // What categories to collide with (bit flags)
  group: number;       // Collision group
};
```

**Predefined Categories:**
```typescript
enum CollisionCategory {
  STATIC = 0x0001,
  PLAYER = 0x0002,
  ENEMY = 0x0004,
  PROJECTILE = 0x0008,
  SENSOR = 0x0010,
  PLATFORM = 0x0020
}
```

## Common Use Cases

### Basic Platformer Physics

```typescript
import { World, Circle, Polygon, CollisionCategory } from '@ue-too/dynamics';

const world = new World(2000, 2000, 'dynamictree');
world.gravity = { x: 0, y: -20 }; // Downward gravity

// Ground
const ground = new Polygon(
  { x: 0, y: -150 },
  [{ x: -500, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 50 }, { x: -500, y: 50 }],
  0, 0, true
);
ground.collisionFilter = {
  category: CollisionCategory.STATIC,
  mask: 0xFFFF, // Collides with everything
  group: 0
};
world.addRigidBody('ground', ground);

// Player
const player = new Circle({ x: 0, y: 0 }, 20, 0, 10, false);
player.collisionFilter = {
  category: CollisionCategory.PLAYER,
  mask: CollisionCategory.STATIC | CollisionCategory.PLATFORM | CollisionCategory.ENEMY,
  group: 0
};
player.restitution = 0; // No bounce
player.friction = 0.5;
world.addRigidBody('player', player);

// Apply jump force
function jump() {
  player.velocity.y = 15; // Upward velocity
}

// Game loop
function update(deltaTime: number) {
  world.step(deltaTime);
  // Render player at player.position
}
```

### Pendulum with Constraints

```typescript
import { World, Circle, FixedPinJoint } from '@ue-too/dynamics';

const world = new World(2000, 2000);
world.gravity = { x: 0, y: -9.8 };

// Pendulum bob
const bob = new Circle({ x: 0, y: 100 }, 20, 0, 10, false);
bob.restitution = 0.8; // Bouncy
world.addRigidBody('bob', bob);

// Fix to world origin
const joint = new FixedPinJoint(
  bob,
  { x: 0, y: 0 },  // Bob's center
  { x: 0, y: 0 }   // World origin
);
world.addConstraint(joint);

// Simulation
function update(deltaTime: number) {
  world.step(deltaTime);
}
```

### Chain of Bodies

```typescript
import { World, Circle, PinJoint } from '@ue-too/dynamics';

const world = new World(2000, 2000);
world.gravity = { x: 0, y: -9.8 };

const links: Circle[] = [];
const numLinks = 5;

// Create chain links
for (let i = 0; i < numLinks; i++) {
  const link = new Circle({ x: i * 30, y: 0 }, 10, 0, 5, false);
  world.addRigidBody(`link${i}`, link);
  links.push(link);

  if (i > 0) {
    // Connect to previous link
    const joint = new PinJoint(
      links[i - 1],
      links[i],
      { x: 10, y: 0 },  // Right edge of previous
      { x: -10, y: 0 }  // Left edge of current
    );
    world.addConstraint(joint);
  }
}

// Fix first link to world
const fixedJoint = new FixedPinJoint(
  links[0],
  { x: -10, y: 0 },
  { x: 0, y: 0 }
);
world.addConstraint(fixedJoint);
```

### Collision Sensors

```typescript
import { Circle, CollisionCategory } from '@ue-too/dynamics';

// Create a trigger zone that doesn't physically collide
const trigger = new Circle({ x: 100, y: 100 }, 50, 0, 0, true);
trigger.collisionFilter = {
  category: CollisionCategory.SENSOR,
  mask: CollisionCategory.PLAYER,
  group: -1  // Negative group = never physically collide
};
world.addRigidBody('trigger', trigger);

// Listen for collisions
world.onCollision((bodyA, bodyB, contacts) => {
  if (bodyA === trigger || bodyB === trigger) {
    console.log('Player entered trigger zone!');
  }
});
```

### Spatial Queries

```typescript
// Find all bodies in a region
const aabb = {
  min: { x: -50, y: -50 },
  max: { x: 50, y: 50 }
};
const bodiesInRegion = world.queryAABB(aabb);

// Find bodies at a point
const bodiesAtPoint = world.queryPoint({ x: 100, y: 100 });

// Ray cast
const rayResults = world.rayCast(
  { x: 0, y: 0 },     // From
  { x: 100, y: 100 }  // To
);

rayResults.forEach(result => {
  console.log('Hit:', result.body, 'at distance:', result.distance);
});
```

### Performance Tuning

```typescript
import { World } from '@ue-too/dynamics';

const world = new World(2000, 2000, 'sap'); // Sweep-and-prune for many dynamic bodies

// Enable sleeping
world.sleepingEnabled = true;

// Customize sleeping thresholds per body
body.sleepThreshold = 0.01;  // Velocity threshold
body.sleepTime = 0.5;         // Seconds at rest before sleeping

// Get performance stats
const stats = world.getCollisionStats();
console.log('Broad phase pairs:', stats.broadPhasePairs);
console.log('Narrow phase tests:', stats.narrowPhaseTests);
console.log('Active collisions:', stats.activeCollisions);
console.log('Sleeping bodies:', stats.sleepingBodies);

// Switch spatial index at runtime
world.setSpatialIndexType('dynamictree');
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](../../docs/dynamics).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```typescript
import {
  World,
  Circle,
  Polygon,
  RigidBody,
  Constraint,
  CollisionCategory,
  type Point
} from '@ue-too/dynamics';

// Bodies are fully typed
const circle: Circle = new Circle({ x: 0, y: 0 }, 20, 0, 10, false);
const polygon: Polygon = new Polygon(/* ... */);

// Constraints are typed
const joint: Constraint = new PinJoint(circle, polygon, { x: 0, y: 0 }, { x: 0, y: 0 });

// Filters are typed
circle.collisionFilter = {
  category: CollisionCategory.PLAYER,
  mask: CollisionCategory.STATIC | CollisionCategory.ENEMY,
  group: 0
};
```

## Design Philosophy

This physics engine follows these principles:

- **Simplicity**: Focus on common 2D game physics use cases
- **Performance**: Spatial indexing and sleeping for scalability
- **Modularity**: Pluggable spatial index algorithms
- **Practicality**: Designed for games, not scientific simulation
- **Type Safety**: Full TypeScript support

## Performance Considerations

- **Spatial Indexing**: Choose based on your use case:
  - QuadTree: Static worlds with few dynamic objects
  - Dynamic Tree: Mixed static/dynamic (recommended default)
  - Sweep-and-Prune: Many dynamic objects moving continuously

- **Sleeping System**: Automatically disables physics for resting bodies
- **Collision Filtering**: Reduces narrow phase tests significantly
- **Fixed Time Step**: Use fixed time steps (1/60) for stability

**Performance Tips:**
- Enable sleeping for worlds with many resting bodies
- Use collision filtering to avoid unnecessary collision tests
- Choose appropriate spatial index for your scenario
- Avoid very large mass ratios between bodies (causes instability)
- Use static bodies for immovable objects
- Limit polygon vertex counts (4-8 vertices is optimal)

## Limitations

- **2D Only**: No 3D support
- **Convex Polygons**: Concave shapes must be decomposed
- **No Continuous Collision**: Fast-moving objects may tunnel
- **Simple Friction Model**: Basic static and dynamic friction
- **Experimental**: Not production-ready, API may change

## Debugging Tips

```typescript
// Enable debug rendering
world.debugDraw = (ctx: CanvasRenderingContext2D) => {
  // Draw all bodies
  world.bodies.forEach(body => {
    ctx.strokeStyle = body.isStatic ? 'gray' : 'blue';
    if (body instanceof Circle) {
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (body instanceof Polygon) {
      ctx.beginPath();
      ctx.moveTo(body.worldVertices[0].x, body.worldVertices[0].y);
      for (let i = 1; i < body.worldVertices.length; i++) {
        ctx.lineTo(body.worldVertices[i].x, body.worldVertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  });
};
```

## Related Packages

- **[@ue-too/math](../math)**: Vector operations used throughout the physics engine
- **[@ue-too/ecs](../ecs)**: Entity Component System that can integrate with physics
- **[@ue-too/board](../board)**: Canvas board for rendering physics simulations

## Further Reading

- [2D Game Physics](https://gamedevelopment.tutsplus.com/series/how-to-create-a-custom-physics-engine--gamedev-12715) - Tutorial series on 2D physics engines
- [Impulse-Based Dynamics](https://www.myphysicslab.com/engine2D/collision-en.html) - Physics engine theory
- [Separating Axis Theorem](https://en.wikipedia.org/wiki/Hyperplane_separation_theorem) - Collision detection algorithm

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
