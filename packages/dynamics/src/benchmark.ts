import { QuadTree, RectangleBound } from "./quadtree";
import { DynamicTree, SweepAndPrune } from "./dynamic-tree";
import { Point } from "@ue-too/math";

interface MockRigidBody {
    AABB: { min: Point, max: Point };
    id: number;
    velocity: Point;
    isStatic(): boolean;
}

class MockStaticBody implements MockRigidBody {
    AABB: { min: Point, max: Point };
    id: number;
    velocity: Point = { x: 0, y: 0 };

    constructor(id: number, x: number, y: number, width: number, height: number) {
        this.id = id;
        this.AABB = {
            min: { x, y },
            max: { x: x + width, y: y + height }
        };
    }

    isStatic(): boolean {
        return true;
    }
}

class MockDynamicBody implements MockRigidBody {
    AABB: { min: Point, max: Point };
    id: number;
    velocity: Point;

    constructor(id: number, x: number, y: number, width: number, height: number, vx: number = 0, vy: number = 0) {
        this.id = id;
        this.velocity = { x: vx, y: vy };
        this.AABB = {
            min: { x, y },
            max: { x: x + width, y: y + height }
        };
    }

    isStatic(): boolean {
        return false;
    }

    update(dt: number): void {
        this.AABB.min.x += this.velocity.x * dt;
        this.AABB.min.y += this.velocity.y * dt;
        this.AABB.max.x += this.velocity.x * dt;
        this.AABB.max.y += this.velocity.y * dt;
    }
}

interface BenchmarkResult {
    insertTime: number;
    queryTime: number;
    totalCollisionPairs: number;
    averageQueriesPerObject: number;
    treeHeight?: number;
    nodeCount?: number;
}

interface TestScenario {
    name: string;
    bodies: MockRigidBody[];
    iterations: number;
}

class SpatialIndexBenchmark {
    private scenarios: TestScenario[] = [];

    constructor() {
        this.setupScenarios();
    }

    private setupScenarios(): void {
        // Scenario 1: Dense cluster
        this.scenarios.push({
            name: "Dense Cluster (100 objects)",
            bodies: this.createDenseCluster(100, 500, 500, 200),
            iterations: 100
        });

        // Scenario 2: Sparse distribution
        this.scenarios.push({
            name: "Sparse Distribution (200 objects)",
            bodies: this.createRandomDistribution(200, 2000, 2000),
            iterations: 100
        });

        // Scenario 3: Moving objects
        this.scenarios.push({
            name: "Moving Objects (150 objects)",
            bodies: this.createMovingObjects(150, 1000, 1000),
            iterations: 50
        });

        // Scenario 4: Line formation
        this.scenarios.push({
            name: "Line Formation (100 objects)",
            bodies: this.createLineFormation(100, 2000, 50),
            iterations: 100
        });

        // Scenario 5: Large scale
        this.scenarios.push({
            name: "Large Scale (500 objects)",
            bodies: this.createRandomDistribution(500, 3000, 3000),
            iterations: 20
        });

        // Scenario 6: Mixed sizes
        this.scenarios.push({
            name: "Mixed Sizes (200 objects)",
            bodies: this.createMixedSizes(200, 1500, 1500),
            iterations: 50
        });
    }

    private createDenseCluster(count: number, centerX: number, centerY: number, radius: number): MockRigidBody[] {
        const bodies: MockRigidBody[] = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI;
            const r = Math.random() * radius;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            const size = 10 + Math.random() * 20;
            
            bodies.push(new MockDynamicBody(i, x, y, size, size, 
                (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50));
        }
        return bodies;
    }

    private createRandomDistribution(count: number, worldWidth: number, worldHeight: number): MockRigidBody[] {
        const bodies: MockRigidBody[] = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * (worldWidth - 50);
            const y = Math.random() * (worldHeight - 50);
            const size = 10 + Math.random() * 30;
            
            if (Math.random() < 0.3) {
                bodies.push(new MockStaticBody(i, x, y, size, size));
            } else {
                bodies.push(new MockDynamicBody(i, x, y, size, size, 
                    (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100));
            }
        }
        return bodies;
    }

    private createMovingObjects(count: number, worldWidth: number, worldHeight: number): MockRigidBody[] {
        const bodies: MockRigidBody[] = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * (worldWidth - 50);
            const y = Math.random() * (worldHeight - 50);
            const size = 15 + Math.random() * 25;
            
            bodies.push(new MockDynamicBody(i, x, y, size, size, 
                (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200));
        }
        return bodies;
    }

    private createLineFormation(count: number, lineLength: number, spacing: number): MockRigidBody[] {
        const bodies: MockRigidBody[] = [];
        for (let i = 0; i < count; i++) {
            const x = (i / count) * lineLength;
            const y = Math.random() * spacing;
            const size = 15 + Math.random() * 15;
            
            bodies.push(new MockDynamicBody(i, x, y, size, size, 
                (Math.random() - 0.5) * 150, (Math.random() - 0.5) * 50));
        }
        return bodies;
    }

    private createMixedSizes(count: number, worldWidth: number, worldHeight: number): MockRigidBody[] {
        const bodies: MockRigidBody[] = [];
        for (let i = 0; i < count; i++) {
            const sizeCategory = Math.random();
            let size: number;
            
            if (sizeCategory < 0.7) {
                size = 5 + Math.random() * 15; // Small objects
            } else if (sizeCategory < 0.9) {
                size = 25 + Math.random() * 35; // Medium objects
            } else {
                size = 60 + Math.random() * 80; // Large objects
            }
            
            const x = Math.random() * (worldWidth - size);
            const y = Math.random() * (worldHeight - size);
            
            bodies.push(new MockDynamicBody(i, x, y, size, size, 
                (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120));
        }
        return bodies;
    }

    private benchmarkQuadTree(bodies: MockRigidBody[], iterations: number): BenchmarkResult {
        // Calculate world bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        bodies.forEach(body => {
            minX = Math.min(minX, body.AABB.min.x);
            minY = Math.min(minY, body.AABB.min.y);
            maxX = Math.max(maxX, body.AABB.max.x);
            maxY = Math.max(maxY, body.AABB.max.y);
        });

        const margin = 100;
        const bounds = new RectangleBound(
            { x: minX - margin, y: minY - margin },
            (maxX - minX) + 2 * margin,
            (maxY - minY) + 2 * margin
        );

        let totalInsertTime = 0;
        let totalQueryTime = 0;
        let totalCollisionPairs = 0;
        let totalQueries = 0;

        for (let iter = 0; iter < iterations; iter++) {
            const quadTree = new QuadTree<MockRigidBody>(0, bounds);

            // Measure insertion time
            const insertStart = performance.now();
            bodies.forEach(body => {
                quadTree.insert(body);
            });
            const insertEnd = performance.now();
            totalInsertTime += insertEnd - insertStart;

            // Measure query time
            const queryStart = performance.now();
            let collisionPairs = 0;
            bodies.forEach(body => {
                const nearby = quadTree.retrieve(body);
                totalQueries += nearby.length;
                collisionPairs += nearby.length;
            });
            const queryEnd = performance.now();
            totalQueryTime += queryEnd - queryStart;
            totalCollisionPairs += collisionPairs;

            // Update moving objects for next iteration
            bodies.forEach(body => {
                if (!body.isStatic()) {
                    (body as MockDynamicBody).update(0.016); // 60 FPS
                }
            });
        }

        return {
            insertTime: totalInsertTime / iterations,
            queryTime: totalQueryTime / iterations,
            totalCollisionPairs: totalCollisionPairs / iterations,
            averageQueriesPerObject: totalQueries / (iterations * bodies.length)
        };
    }

    private benchmarkDynamicTree(bodies: MockRigidBody[], iterations: number): BenchmarkResult {
        let totalInsertTime = 0;
        let totalQueryTime = 0;
        let totalCollisionPairs = 0;
        let totalQueries = 0;
        let totalHeight = 0;
        let totalNodeCount = 0;

        for (let iter = 0; iter < iterations; iter++) {
            const dynamicTree = new DynamicTree<MockRigidBody>();

            // Measure insertion time
            const insertStart = performance.now();
            bodies.forEach(body => {
                dynamicTree.insert(body);
            });
            const insertEnd = performance.now();
            totalInsertTime += insertEnd - insertStart;

            const stats = dynamicTree.getStats();
            totalHeight += stats.height;
            totalNodeCount += stats.nodeCount;

            // Measure query time
            const queryStart = performance.now();
            let collisionPairs = 0;
            bodies.forEach(body => {
                const nearby = dynamicTree.retrieve(body);
                totalQueries += nearby.length;
                collisionPairs += nearby.length;
            });
            const queryEnd = performance.now();
            totalQueryTime += queryEnd - queryStart;
            totalCollisionPairs += collisionPairs;

            // Update moving objects for next iteration
            bodies.forEach(body => {
                if (!body.isStatic()) {
                    (body as MockDynamicBody).update(0.016); // 60 FPS
                }
            });
        }

        return {
            insertTime: totalInsertTime / iterations,
            queryTime: totalQueryTime / iterations,
            totalCollisionPairs: totalCollisionPairs / iterations,
            averageQueriesPerObject: totalQueries / (iterations * bodies.length),
            treeHeight: totalHeight / iterations,
            nodeCount: totalNodeCount / iterations
        };
    }

    private benchmarkSweepAndPrune(bodies: MockRigidBody[], iterations: number): BenchmarkResult {
        let totalInsertTime = 0;
        let totalQueryTime = 0;
        let totalCollisionPairs = 0;
        let totalQueries = 0;

        for (let iter = 0; iter < iterations; iter++) {
            const sweepAndPrune = new SweepAndPrune<MockRigidBody>();

            // Measure insertion time
            const insertStart = performance.now();
            bodies.forEach(body => {
                sweepAndPrune.insert(body);
            });
            const insertEnd = performance.now();
            totalInsertTime += insertEnd - insertStart;

            // Measure query time
            const queryStart = performance.now();
            let collisionPairs = 0;
            bodies.forEach(body => {
                const nearby = sweepAndPrune.retrieve(body);
                totalQueries += nearby.length;
                collisionPairs += nearby.length;
            });
            const queryEnd = performance.now();
            totalQueryTime += queryEnd - queryStart;
            totalCollisionPairs += collisionPairs;

            // Update moving objects for next iteration
            bodies.forEach(body => {
                if (!body.isStatic()) {
                    (body as MockDynamicBody).update(0.016); // 60 FPS
                    sweepAndPrune.update(body); // Use the new update method
                }
            });
        }

        return {
            insertTime: totalInsertTime / iterations,
            queryTime: totalQueryTime / iterations,
            totalCollisionPairs: totalCollisionPairs / iterations,
            averageQueriesPerObject: totalQueries / (iterations * bodies.length)
        };
    }

    run(): void {
        console.log("=".repeat(80));
        console.log("SPATIAL INDEX BENCHMARK RESULTS");
        console.log("=".repeat(80));

        this.scenarios.forEach(scenario => {
            console.log(`\n📊 ${scenario.name}`);
            console.log("-".repeat(50));

            // Benchmark all three algorithms
            const bodiesQuad = JSON.parse(JSON.stringify(scenario.bodies)); // Deep copy
            const quadResult = this.benchmarkQuadTree(bodiesQuad, scenario.iterations);

            const bodiesDynamic = JSON.parse(JSON.stringify(scenario.bodies)); // Deep copy
            const dynamicResult = this.benchmarkDynamicTree(bodiesDynamic, scenario.iterations);

            const bodiesSAP = JSON.parse(JSON.stringify(scenario.bodies)); // Deep copy
            const sapResult = this.benchmarkSweepAndPrune(bodiesSAP, scenario.iterations);

            console.log(`Object Count: ${scenario.bodies.length}`);
            console.log(`Iterations: ${scenario.iterations}`);
            console.log();

            console.log("📦 QuadTree Results:");
            console.log(`  Insert Time: ${quadResult.insertTime.toFixed(3)}ms`);
            console.log(`  Query Time: ${quadResult.queryTime.toFixed(3)}ms`);
            console.log(`  Total Time: ${(quadResult.insertTime + quadResult.queryTime).toFixed(3)}ms`);
            console.log(`  Collision Pairs: ${quadResult.totalCollisionPairs.toFixed(0)}`);
            console.log(`  Avg Queries/Object: ${quadResult.averageQueriesPerObject.toFixed(1)}`);

            console.log();

            console.log("🌳 DynamicTree Results:");
            console.log(`  Insert Time: ${dynamicResult.insertTime.toFixed(3)}ms`);
            console.log(`  Query Time: ${dynamicResult.queryTime.toFixed(3)}ms`);
            console.log(`  Total Time: ${(dynamicResult.insertTime + dynamicResult.queryTime).toFixed(3)}ms`);
            console.log(`  Collision Pairs: ${dynamicResult.totalCollisionPairs.toFixed(0)}`);
            console.log(`  Avg Queries/Object: ${dynamicResult.averageQueriesPerObject.toFixed(1)}`);
            console.log(`  Tree Height: ${dynamicResult.treeHeight?.toFixed(1)}`);
            console.log(`  Node Count: ${dynamicResult.nodeCount?.toFixed(0)}`);

            console.log();

            console.log("🔄 Sweep-and-Prune Results:");
            console.log(`  Insert Time: ${sapResult.insertTime.toFixed(3)}ms`);
            console.log(`  Query Time: ${sapResult.queryTime.toFixed(3)}ms`);
            console.log(`  Total Time: ${(sapResult.insertTime + sapResult.queryTime).toFixed(3)}ms`);
            console.log(`  Collision Pairs: ${sapResult.totalCollisionPairs.toFixed(0)}`);
            console.log(`  Avg Queries/Object: ${sapResult.averageQueriesPerObject.toFixed(1)}`);

            console.log();

            // Performance comparison
            const totalQuadTime = quadResult.insertTime + quadResult.queryTime;
            const totalDynamicTime = dynamicResult.insertTime + dynamicResult.queryTime;
            const totalSAPTime = sapResult.insertTime + sapResult.queryTime;

            const times = [
                { name: "QuadTree", time: totalQuadTime },
                { name: "DynamicTree", time: totalDynamicTime },
                { name: "Sweep-and-Prune", time: totalSAPTime }
            ].sort((a, b) => a.time - b.time);

            console.log("🏆 Performance Ranking:");
            times.forEach((result, index) => {
                const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                const speedup = times[2].time / result.time;
                console.log(`  ${emoji} ${result.name}: ${result.time.toFixed(3)}ms ${speedup > 1.1 ? `(${speedup.toFixed(2)}x faster than slowest)` : ''}`);
            });

            // Algorithm-specific insights
            console.log();
            console.log("📈 Algorithm Insights:");
            console.log(`  QuadTree queries/object: ${quadResult.averageQueriesPerObject.toFixed(2)}`);
            console.log(`  DynamicTree queries/object: ${dynamicResult.averageQueriesPerObject.toFixed(2)}`);
            console.log(`  Sweep-and-Prune queries/object: ${sapResult.averageQueriesPerObject.toFixed(2)}`);
            
            // Find most efficient for query overhead
            const queryOverheads = [
                { name: "QuadTree", overhead: quadResult.averageQueriesPerObject },
                { name: "DynamicTree", overhead: dynamicResult.averageQueriesPerObject },
                { name: "Sweep-and-Prune", overhead: sapResult.averageQueriesPerObject }
            ].sort((a, b) => a.overhead - b.overhead);

            if (queryOverheads[0].overhead < queryOverheads[1].overhead * 0.9) {
                const efficiency = queryOverheads[1].overhead / queryOverheads[0].overhead;
                console.log(`  🎯 ${queryOverheads[0].name} has ${efficiency.toFixed(2)}x fewer false positives`);
            }
        });

        console.log("\n" + "=".repeat(80));
        console.log("BENCHMARK COMPLETED");
        console.log("=".repeat(80));
    }
}

// Export for use in other files
export { SpatialIndexBenchmark, MockRigidBody, MockDynamicBody, MockStaticBody };

// Helper function to run benchmark (can be called from anywhere)
export function runBenchmark(): void {
    const benchmark = new SpatialIndexBenchmark();
    benchmark.run();
}