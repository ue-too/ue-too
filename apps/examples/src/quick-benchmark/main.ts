import { Board } from "@ue-too/board";
import { Point } from "@ue-too/math";
import { World, VisualPolygonBody, PhysicsSystem, CollisionSystem, RigidBodyComponent, RIGID_BODY_COMPONENT, updateAABBForPolygonRaw, PhysicsComponent, PHYSICS_COMPONENT, Canvas2DContextRenderSystem, RenderComponent, RENDER_COMPONENT } from "@ue-too/dynamics";
import { Coordinator } from "@ue-too/ecs";

// Quick benchmark configuration
const QUICK_BENCHMARK_CONFIG = {
    objectCounts: [10, 50, 100], // Smaller test set
    testDuration: 2000, // 2 seconds per test
    iterations: 2, // Run each test 2 times
};

interface QuickMetrics {
    objectCount: number;
    systemType: 'original' | 'ecs';
    averageFPS: number;
    averageFrameTime: number;
    physicsTime: number;
}

class QuickPhysicsBenchmark {
    private board: Board;
    private metrics: QuickMetrics[] = [];
    private currentObjectCount: number = 0;

    constructor() {
        const element = document.getElementById("graph") as HTMLCanvasElement;
        this.board = new Board(element);
        this.board.fullScreen = true;
    }

    async runQuickBenchmark(): Promise<void> {
        console.log("Starting Quick Physics Benchmark...");
        console.log("Testing object counts:", QUICK_BENCHMARK_CONFIG.objectCounts);
        
        for (const objectCount of QUICK_BENCHMARK_CONFIG.objectCounts) {
            for (let iteration = 0; iteration < QUICK_BENCHMARK_CONFIG.iterations; iteration++) {
                console.log(`\n--- Quick Test: ${objectCount} Objects, Iteration ${iteration + 1} ---`);
                
                // Test original system
                await this.testOriginalSystem(objectCount);
                
                // Test ECS system
                await this.testECSSystem(objectCount);
            }
        }
        
        this.printQuickResults();
    }

    private async testOriginalSystem(objectCount: number): Promise<void> {
        this.currentObjectCount = objectCount;
        const world = new World(1000, 1000);
        world._context = this.board.context;
        
        // Create objects
        const vertices = [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}];
        for (let i = 0; i < objectCount; i++) {
            const center = this.getRandomPoint(100, 900);
            center.z = Math.random() * 100 + 50;
            const body = new VisualPolygonBody(center, vertices, this.board.context, Math.random() * Math.PI * 2, Math.random() * 50 + 10, false);
            world.addRigidBody(i.toString(), body);
        }
        
        const metrics = await this.runQuickPerformanceTest('original', world);
        this.metrics.push(metrics);
    }

    private async testECSSystem(objectCount: number): Promise<void> {
        this.currentObjectCount = objectCount;
        const coordinator = new Coordinator();
        const physicsSystem = new PhysicsSystem(coordinator);
        const collisionSystem = new CollisionSystem(coordinator);
        const renderSystem = new Canvas2DContextRenderSystem(coordinator, this.board.context);
        
        // Create objects
        const vertices = [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}];
        for (let i = 0; i < objectCount; i++) {
            const entity = coordinator.createEntity();
            const center = this.getRandomPoint(100, 900);
            const aabb = updateAABBForPolygonRaw(vertices, center, 0);
            
            coordinator.addComponentToEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity, {
                center: center,
                orientationAngle: Math.random() * Math.PI * 2,
                mass: Math.random() * 50 + 10,
                AABB: aabb,
                staticFrictionCoeff: 0.3,
                dynamicFrictionCoeff: 0.3,
                momentOfInertia: 1,
                isStatic: false,
                isMovingStatic: false,
                shapeType: "polygon",
                vertices: vertices,
            });
            
            coordinator.addComponentToEntity<PhysicsComponent>(PHYSICS_COMPONENT, entity, {
                force: {x: 0, y: 0},
                angularDampingFactor: 0.005,
                linearAcceleration: {x: 0, y: 0},
                angularAcceleration: 0,
                linearVelocity: {x: Math.random() * 100 - 50, y: Math.random() * 100 - 50},
                angularVelocity: Math.random() * 2 - 1,
            });
            
            coordinator.addComponentToEntity<RenderComponent>(RENDER_COMPONENT, entity, {
                show: true,
            });
        }
        
        const metrics = await this.runQuickPerformanceTest('ecs', null, { coordinator, physicsSystem, collisionSystem, renderSystem });
        this.metrics.push(metrics);
    }

    private async runQuickPerformanceTest(systemType: 'original' | 'ecs', world?: World, ecsSystems?: any): Promise<QuickMetrics> {
        return new Promise((resolve) => {
            let frameCount = 0;
            const frameTimes: number[] = [];
            const physicsTimes: number[] = [];
            const testStartTime = performance.now();

            const step = (timestamp: number) => {
                const frameStart = performance.now();
                
                // Clear canvas
                this.board.context.clearRect(0, 0, this.board.context.canvas.width, this.board.context.canvas.height);
                
                if (systemType === 'original' && world) {
                    const physicsStart = performance.now();
                    world.step(0.016);
                    physicsTimes.push(performance.now() - physicsStart);
                } else if (systemType === 'ecs' && ecsSystems) {
                    const physicsStart = performance.now();
                    ecsSystems.physicsSystem.update(0.016);
                    ecsSystems.collisionSystem.update(0.016);
                    ecsSystems.renderSystem.update(0.016);
                    physicsTimes.push(performance.now() - physicsStart);
                }
                
                this.board.step(timestamp);
                
                const frameTime = performance.now() - frameStart;
                frameTimes.push(frameTime);
                frameCount++;
                
                // Check if test duration is complete
                if (performance.now() - testStartTime >= QUICK_BENCHMARK_CONFIG.testDuration) {
                    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
                    const avgFPS = 1000 / avgFrameTime;
                    const avgPhysicsTime = physicsTimes.reduce((a, b) => a + b, 0) / physicsTimes.length;
                    
                    resolve({
                        objectCount: this.getCurrentObjectCount(),
                        systemType,
                        averageFPS: avgFPS,
                        averageFrameTime: avgFrameTime,
                        physicsTime: avgPhysicsTime,
                    });
                } else {
                    requestAnimationFrame(step);
                }
            };
            
            requestAnimationFrame(step);
        });
    }

    private getCurrentObjectCount(): number {
        return this.currentObjectCount;
    }

    private printQuickResults(): void {
        console.log("\n" + "=".repeat(60));
        console.log("QUICK PHYSICS BENCHMARK RESULTS");
        console.log("=".repeat(60));
        
        // Group results by object count
        const groupedResults = new Map<number, { original: QuickMetrics[], ecs: QuickMetrics[] }>();
        
        for (const metric of this.metrics) {
            if (!groupedResults.has(metric.objectCount)) {
                groupedResults.set(metric.objectCount, { original: [], ecs: [] });
            }
            groupedResults.get(metric.objectCount)![metric.systemType].push(metric);
        }
        
        for (const [objectCount, results] of groupedResults) {
            console.log(`\n--- ${objectCount} Objects ---`);
            
            const originalAvg = this.averageQuickMetrics(results.original);
            const ecsAvg = this.averageQuickMetrics(results.ecs);
            
            console.log(`Original: ${originalAvg.averageFPS.toFixed(1)} FPS (${originalAvg.averageFrameTime.toFixed(1)}ms)`);
            console.log(`ECS:      ${ecsAvg.averageFPS.toFixed(1)} FPS (${ecsAvg.averageFrameTime.toFixed(1)}ms)`);
            
            const fpsImprovement = ((ecsAvg.averageFPS - originalAvg.averageFPS) / originalAvg.averageFPS) * 100;
            console.log(`Improvement: ${fpsImprovement > 0 ? '+' : ''}${fpsImprovement.toFixed(1)}%`);
        }
    }

    private averageQuickMetrics(metrics: QuickMetrics[]): QuickMetrics {
        return {
            objectCount: metrics[0].objectCount,
            systemType: metrics[0].systemType,
            averageFPS: metrics.reduce((sum, m) => sum + m.averageFPS, 0) / metrics.length,
            averageFrameTime: metrics.reduce((sum, m) => sum + m.averageFrameTime, 0) / metrics.length,
            physicsTime: metrics.reduce((sum, m) => sum + m.physicsTime, 0) / metrics.length,
        };
    }

    private getRandomPoint(min: number, max: number): Point {
        return {
            x: Math.random() * (max - min) + min,
            y: Math.random() * (max - min) + min
        };
    }
}

// Start the quick benchmark when the page loads
window.addEventListener('load', () => {
    const benchmark = new QuickPhysicsBenchmark();
    benchmark.runQuickBenchmark();
}); 