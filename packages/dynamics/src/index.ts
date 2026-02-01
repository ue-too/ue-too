/**
 * @packageDocumentation
 * 2D physics engine with rigid body dynamics and collision detection.
 *
 * @remarks
 * The `@ue-too/dynamics` package provides a complete 2D physics simulation engine
 * featuring rigid body dynamics, collision detection, constraint solving, and performance
 * optimizations like spatial indexing and sleeping bodies.
 *
 * ## Core Components
 *
 * - **{@link World}**: Main physics world managing all simulation
 * - **{@link RigidBody}**: Physical objects with mass, velocity, and rotation
 * - **{@link Circle}**: Circular rigid body shape
 * - **{@link Polygon}**: Polygonal rigid body shape
 * - **{@link Constraint}**: Physics constraints (pin joints, etc.)
 *
 * ## Key Features
 *
 * ### Rigid Body Physics
 * - Linear and angular velocity
 * - Mass and moment of inertia
 * - Static, dynamic, and kinematic bodies
 * - Friction simulation (static and dynamic)
 * - Gravity and force application
 *
 * ### Collision Detection
 * - **Broad Phase**: Spatial indexing (QuadTree, Dynamic Tree, Sweep-and-Prune)
 * - **Narrow Phase**: Separating Axis Theorem (SAT) for precise collision
 * - AABB (Axis-Aligned Bounding Box) optimization
 * - Collision filtering by category, mask, and group
 *
 * ### Collision Response
 * - Impulse-based resolution
 * - Rotation and angular momentum
 * - Contact manifold generation
 * - Restitution (bounciness)
 *
 * ### Performance Optimizations
 * - **Sleeping System**: Automatically disable resting bodies
 * - **Spatial Indexing**: Three algorithms with different trade-offs
 *   - QuadTree: Good for static worlds
 *   - Dynamic Tree: Good for mixed static/dynamic
 *   - Sweep-and-Prune: Best for many dynamic bodies
 * - **Pair Management**: Efficient collision pair tracking
 *
 * ### Constraints
 * - Pin joints between bodies
 * - Fixed pin joints to world
 * - Baumgarte stabilization
 *
 * ## Main Exports
 *
 * - {@link World} - Physics world container
 * - {@link RigidBody} - Base rigid body interface
 * - {@link Circle} - Circle shape
 * - {@link Polygon} - Polygon shape
 * - {@link Constraint} - Constraint interface
 * - {@link PinJoint} - Pin joint constraint
 * - {@link CollisionFilter} - Collision filtering system
 * - {@link PairManager} - Collision pair tracking
 * - {@link QuadTree} - QuadTree spatial index
 * - {@link DynamicTree} - Dynamic AABB tree
 * - {@link SweepAndPrune} - Sweep-and-prune algorithm
 *
 * @example
 * Basic physics simulation
 * ```typescript
 * import { World, Circle, Polygon } from '@ue-too/dynamics';
 *
 * // Create a physics world (2000x2000)
 * const world = new World(2000, 2000, 'dynamictree');
 *
 * // Create a static ground
 * const ground = new Polygon(
 *   { x: 0, y: -100 },
 *   [{ x: -1000, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 50 }, { x: -1000, y: 50 }],
 *   0,
 *   100,
 *   true  // isStatic
 * );
 * world.addRigidBody('ground', ground);
 *
 * // Create a dynamic circle
 * const ball = new Circle({ x: 0, y: 200 }, 20, 0, 10, false);
 * world.addRigidBody('ball', ball);
 *
 * // Simulation loop
 * function update(deltaTime: number) {
 *   world.step(deltaTime);
 * }
 *
 * // Run at 60 FPS
 * setInterval(() => update(1/60), 16);
 * ```
 *
 * @example
 * Collision filtering
 * ```typescript
 * import { Circle, CollisionCategory } from '@ue-too/dynamics';
 *
 * // Create player (collides with everything except other players)
 * const player = new Circle({ x: 0, y: 0 }, 20);
 * player.collisionFilter = {
 *   category: CollisionCategory.PLAYER,
 *   mask: ~CollisionCategory.PLAYER & 0xFFFF,
 *   group: 0
 * };
 *
 * // Create enemy (collides with player and static objects)
 * const enemy = new Circle({ x: 100, y: 0 }, 20);
 * enemy.collisionFilter = {
 *   category: CollisionCategory.ENEMY,
 *   mask: CollisionCategory.PLAYER | CollisionCategory.STATIC,
 *   group: 0
 * };
 *
 * // Create sensor (doesn't physically collide, just detects)
 * const sensor = new Circle({ x: 200, y: 0 }, 50);
 * sensor.collisionFilter = {
 *   category: CollisionCategory.SENSOR,
 *   mask: CollisionCategory.PLAYER,
 *   group: -1  // Negative group = never physically collide
 * };
 * ```
 *
 * @example
 * Constraints and joints
 * ```typescript
 * import { World, Circle, PinJoint, FixedPinJoint } from '@ue-too/dynamics';
 *
 * const world = new World(2000, 2000);
 *
 * // Create a pendulum with fixed pin joint
 * const bob = new Circle({ x: 0, y: 100 }, 20, 0, 10, false);
 * world.addRigidBody('bob', bob);
 *
 * const fixedJoint = new FixedPinJoint(
 *   bob,
 *   { x: 0, y: 0 },  // Local anchor on bob (center)
 *   { x: 0, y: 0 }   // World anchor (fixed point)
 * );
 * world.addConstraint(fixedJoint);
 *
 * // Create a chain with pin joints between bodies
 * const link1 = new Circle({ x: 50, y: 0 }, 10, 0, 5, false);
 * const link2 = new Circle({ x: 100, y: 0 }, 10, 0, 5, false);
 * world.addRigidBody('link1', link1);
 * world.addRigidBody('link2', link2);
 *
 * const joint = new PinJoint(
 *   link1,
 *   link2,
 *   { x: 10, y: 0 },   // Anchor on link1 (right edge)
 *   { x: -10, y: 0 }   // Anchor on link2 (left edge)
 * );
 * world.addConstraint(joint);
 * ```
 *
 * @example
 * Performance tuning
 * ```typescript
 * import { World } from '@ue-too/dynamics';
 *
 * const world = new World(2000, 2000, 'sap');  // Use sweep-and-prune
 *
 * // Enable sleeping for performance
 * world.sleepingEnabled = true;
 *
 * // Adjust sleeping thresholds on individual bodies
 * body.sleepThreshold = 0.01;  // Velocity threshold
 * body.sleepTime = 0.5;        // Time at rest before sleeping
 *
 * // Change spatial index algorithm at runtime
 * world.setSpatialIndexType('dynamictree');
 *
 * // Get performance statistics
 * const stats = world.getCollisionStats();
 * console.log('Active pairs:', stats.activePairs);
 * console.log('Sleeping bodies:', stats.sleepingBodies);
 *
 * const spatialStats = world.getSpatialIndexStats();
 * console.log('Spatial index:', spatialStats);
 * ```
 *
 * @see {@link World} for the main physics engine
 * @see {@link RigidBody} for physics objects
 * @see {@link Constraint} for joints and constraints
 */

export * from './rigidbody';
export * from './quadtree';
export * from './dynamic-tree';
export * from './collision';
export * from './world';
export * from './constraint';
export * from './collision-filter';
export * from './pair-manager';
