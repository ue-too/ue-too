# Getting Started

`@ue-too/ecs` is a high-performance Entity Component System architecture for TypeScript using sparse-set storage and cache-friendly iteration.

## Installation

```bash
npm install @ue-too/ecs
```

## Basic Usage

```typescript
import { World, Component } from "@ue-too/ecs";

class Position extends Component {
    x = 0;
    y = 0;
}

class Velocity extends Component {
    vx = 0;
    vy = 0;
}

const world = new World();
const entity = world.createEntity();
entity.add(new Position());
entity.add(new Velocity());
```
