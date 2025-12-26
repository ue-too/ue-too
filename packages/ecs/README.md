# @ue-too/ecs

High-performance Entity Component System (ECS) architecture for TypeScript.

[![npm version](https://img.shields.io/npm/v/@ue-too/ecs.svg)](https://www.npmjs.com/package/@ue-too/ecs)
[![license](https://img.shields.io/npm/l/@ue-too/ecs.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

> **Experimental**: This package is an experimental implementation based on [Austin Morlan's ECS tutorial](https://austinmorlan.com/posts/entity_component_system/). Please **DO NOT** use this in production.

## Overview

`@ue-too/ecs` provides a lightweight Entity Component System implementation for TypeScript. ECS is an architectural pattern commonly used in game development that promotes composition over inheritance and enables high-performance iteration over game objects.

### Key Features

- **Efficient Storage**: Component arrays using sparse-set data structure for O(1) lookups
- **Fast Iteration**: Dense packing enables cache-friendly iteration over components
- **Type Safety**: Full TypeScript generics for component type safety
- **Signature Matching**: Automatic system updates when entity component composition changes
- **Entity Pooling**: Entity ID recycling for memory efficiency
- **Minimal Overhead**: Lightweight architecture with predictable performance

## Installation

Using Bun:
```bash
bun add @ue-too/ecs
```

Using npm:
```bash
npm install @ue-too/ecs
```

## Quick Start

Here's a simple example demonstrating the core ECS workflow:

```typescript
import { Coordinator } from '@ue-too/ecs';

// 1. Define component types
type Position = { x: number; y: number };
type Velocity = { x: number; y: number };
type Health = { current: number; max: number };

// 2. Create coordinator
const ecs = new Coordinator();

// 3. Register components
ecs.registerComponent<Position>('Position');
ecs.registerComponent<Velocity>('Velocity');
ecs.registerComponent<Health>('Health');

// 4. Create entities and add components
const player = ecs.createEntity();
ecs.addComponentToEntity('Position', player, { x: 0, y: 0 });
ecs.addComponentToEntity('Velocity', player, { x: 5, y: 0 });
ecs.addComponentToEntity('Health', player, { current: 100, max: 100 });

const enemy = ecs.createEntity();
ecs.addComponentToEntity('Position', enemy, { x: 50, y: 50 });
ecs.addComponentToEntity('Health', enemy, { current: 50, max: 50 });

// 5. Query and update components
const playerPos = ecs.getComponentFromEntity<Position>('Position', player);
const playerVel = ecs.getComponentFromEntity<Velocity>('Velocity', player);

if (playerPos && playerVel) {
  playerPos.x += playerVel.x;
  playerPos.y += playerVel.y;
}

// 6. Clean up
ecs.destroyEntity(enemy);
```

## ECS Architecture

The Entity Component System pattern separates data from logic:

- **Entities**: Unique identifiers (numbers) representing game objects
- **Components**: Plain data containers (no logic)
- **Systems**: Functions that operate on entities with specific component combinations

### Why ECS?

Traditional object-oriented hierarchies can become complex and rigid. ECS promotes:

- **Composition over inheritance**: Build entities by combining components
- **Data locality**: Components are stored in dense arrays for better cache performance
- **Flexibility**: Easy to add/remove behaviors by adding/removing components
- **Parallelization**: Systems can operate independently on entity subsets

## Core APIs

### Coordinator

The main ECS coordinator that manages all subsystems.

```typescript
const ecs = new Coordinator();
```

**Entity Management:**
- `createEntity(): Entity` - Creates a new entity, returns entity ID
- `destroyEntity(entity: Entity): void` - Destroys entity and removes all components

**Component Management:**
- `registerComponent<T>(name: string): void` - Registers a component type
- `addComponentToEntity<T>(name: string, entity: Entity, component: T): void` - Adds component to entity
- `removeComponentFromEntity<T>(name: string, entity: Entity): void` - Removes component from entity
- `getComponentFromEntity<T>(name: string, entity: Entity): T | null` - Retrieves component data
- `getComponentType(name: string): ComponentType | null` - Gets component type ID

**System Management:**
- `registerSystem(name: string, system: System): void` - Registers a system
- `setSystemSignature(name: string, signature: ComponentSignature): void` - Sets which components a system requires

### System Interface

Systems maintain a set of entities that match their component signature:

```typescript
interface System {
  entities: Set<Entity>;
}
```

### Component Signature

Bit flags indicating which components an entity has:

```typescript
type ComponentSignature = number;  // Bit field
type ComponentType = number;       // Component type ID (0-31)
type Entity = number;              // Entity ID
```

## Common Use Cases

### Movement System

Update positions based on velocities:

```typescript
import { Coordinator, System } from '@ue-too/ecs';

const ecs = new Coordinator();

// Register components
ecs.registerComponent<Position>('Position');
ecs.registerComponent<Velocity>('Velocity');

// Create movement system
const movementSystem: System = {
  entities: new Set()
};

ecs.registerSystem('Movement', movementSystem);

// Set signature: entities with Position AND Velocity
const posType = ecs.getComponentType('Position')!;
const velType = ecs.getComponentType('Velocity')!;
const signature = (1 << posType) | (1 << velType);
ecs.setSystemSignature('Movement', signature);

// Update loop
function update(deltaTime: number) {
  movementSystem.entities.forEach(entity => {
    const pos = ecs.getComponentFromEntity<Position>('Position', entity)!;
    const vel = ecs.getComponentFromEntity<Velocity>('Velocity', entity)!;

    pos.x += vel.x * deltaTime;
    pos.y += vel.y * deltaTime;
  });
}

// Game loop
setInterval(() => update(0.016), 16); // ~60 FPS
```

### Damage System

Process health and damage components:

```typescript
type Health = { current: number; max: number };
type Damage = { amount: number; source: Entity };

ecs.registerComponent<Health>('Health');
ecs.registerComponent<Damage>('Damage');

const damageSystem: System = { entities: new Set() };
ecs.registerSystem('Damage', damageSystem);

const healthType = ecs.getComponentType('Health')!;
const damageType = ecs.getComponentType('Damage')!;
const damageSignature = (1 << healthType) | (1 << damageType);
ecs.setSystemSignature('Damage', damageSignature);

function processDamage() {
  damageSystem.entities.forEach(entity => {
    const health = ecs.getComponentFromEntity<Health>('Health', entity)!;
    const damage = ecs.getComponentFromEntity<Damage>('Damage', entity)!;

    health.current -= damage.amount;

    if (health.current <= 0) {
      console.log(`Entity ${entity} destroyed`);
      ecs.destroyEntity(entity);
    } else {
      // Remove damage component after processing
      ecs.removeComponentFromEntity<Damage>('Damage', entity);
    }
  });
}
```

### Rendering System

Render entities with position and sprite components:

```typescript
type Sprite = { imageSrc: string; width: number; height: number };

ecs.registerComponent<Sprite>('Sprite');

const renderSystem: System = { entities: new Set() };
ecs.registerSystem('Render', renderSystem);

const spriteType = ecs.getComponentType('Sprite')!;
const renderSignature = (1 << posType) | (1 << spriteType);
ecs.setSystemSignature('Render', renderSignature);

function render(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  renderSystem.entities.forEach(entity => {
    const pos = ecs.getComponentFromEntity<Position>('Position', entity)!;
    const sprite = ecs.getComponentFromEntity<Sprite>('Sprite', entity)!;

    // Draw sprite at position
    const img = new Image();
    img.src = sprite.imageSrc;
    ctx.drawImage(img, pos.x, pos.y, sprite.width, sprite.height);
  });
}
```

### Component Signature Building

Build complex component requirements:

```typescript
// Entities that have Position, Velocity, AND Sprite
const movingRenderables =
  (1 << ecs.getComponentType('Position')!) |
  (1 << ecs.getComponentType('Velocity')!) |
  (1 << ecs.getComponentType('Sprite')!);

// Helper function for cleaner syntax
function buildSignature(ecs: Coordinator, ...componentNames: string[]): number {
  return componentNames.reduce((signature, name) => {
    const type = ecs.getComponentType(name);
    return type !== null ? signature | (1 << type) : signature;
  }, 0);
}

// Usage
const signature = buildSignature(ecs, 'Position', 'Velocity', 'Health');
ecs.setSystemSignature('MySystem', signature);
```

## Configuration

The package provides configuration constants:

```typescript
export const MAX_ENTITIES = 10000;    // Maximum simultaneous entities
export const MAX_COMPONENTS = 32;      // Maximum component types (bit limit)
```

To customize, you can create your own EntityManager:

```typescript
import { EntityManager } from '@ue-too/ecs';

const entityManager = new EntityManager(5000); // Custom max entities
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/ecs/).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```typescript
// Component types are fully typed
type Position = { x: number; y: number };
ecs.registerComponent<Position>('Position');

// Type-safe component retrieval
const pos = ecs.getComponentFromEntity<Position>('Position', entity);
if (pos) {
  pos.x += 10; // TypeScript knows pos has x and y properties
}

// Generic component arrays
import { ComponentArray } from '@ue-too/ecs';
const positions = new ComponentArray<Position>(1000);
```

## Design Principles

This ECS implementation follows these principles:

- **Simplicity**: Minimal API surface for easy learning
- **Performance**: Sparse-set data structure for O(1) operations
- **Type Safety**: Leverage TypeScript's type system
- **Flexibility**: Components are plain data objects
- **Explicit**: No magic, predictable behavior

## Performance Considerations

- **Entity Creation**: O(1) - pops from available entity pool
- **Component Lookup**: O(1) - sparse-set provides constant-time access
- **Component Iteration**: O(n) - dense array iteration for cache efficiency
- **Signature Matching**: O(m) where m is number of systems (typically small)

**Performance Tips:**
- Keep component data small and focused
- Process components in batches (system-by-system) rather than entity-by-entity
- Reuse entities when possible instead of create/destroy cycles
- Limit number of component types (max 32 due to bit signature)

## Limitations

- **Max 32 component types**: Component signatures use 32-bit integers
- **No component queries**: Must register systems with signatures upfront
- **No hierarchical entities**: Flat entity structure only
- **No built-in serialization**: Component data must be manually serialized

## Related Packages

- **[@ue-too/being](/being/)**: State machine library for entity AI and behavior
- **[@ue-too/math](/math/)**: Vector and transformation utilities for component data
- **[@ue-too/board](/board/)**: Canvas rendering system that can integrate with ECS

## Further Reading

- [Austin Morlan's ECS Tutorial](https://austinmorlan.com/posts/entity_component_system/) - Original tutorial this implementation is based on
- [ECS FAQ](https://github.com/SanderMertens/ecs-faq) - Comprehensive ECS concepts and patterns
- [Data-Oriented Design](https://www.dataorienteddesign.com/dodbook/) - Principles behind ECS architecture

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
