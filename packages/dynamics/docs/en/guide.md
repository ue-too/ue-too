# Getting Started

`@ue-too/dynamics` is a 2D physics engine with rigid body dynamics, collision detection, constraints, and spatial indexing.

## Installation

```bash
npm install @ue-too/dynamics
```

## Basic Usage

```typescript
import { World, RigidBody } from "@ue-too/dynamics";

const world = new World();

// Create a rigid body
const body = new RigidBody({
    position: { x: 100, y: 100 },
    mass: 1,
});

world.addBody(body);

// Step the simulation
world.step(1 / 60);
```
