import { Board } from "@ue-too/board";
import { Point, PointCal } from "@ue-too/math";
import { World, VisualPolygonBody, PhysicsSystem, CollisionSystem, RigidBodyComponent, RIGID_BODY_COMPONENT, updateAABBForPolygonRaw, PhysicsComponent, PHYSICS_COMPONENT, Canvas2DContextRenderSystem, RenderComponent, RENDER_COMPONENT } from "@ue-too/dynamics";
import { Coordinator } from "@ue-too/ecs";

// Benchmark configuration
const BENCHMARK_CONFIG = {
    objectCounts: [500], // Test with different object counts
    testDuration: 5000, // 5 seconds per test
    warmupDuration: 1000, // 1 second warmup
    iterations: 3, // Run each test 3 times for averaging
};

// Performance metrics
interface PerformanceMetrics {
    objectCount: number;
    systemType: 'original' | 'ecs';
    averageFPS: number;
    averageFrameTime: number;
    totalFrames: number;
    physicsTime: number;
    collisionTime: number;
    renderTime: number;
}

class PhysicsBenchmark {
    private board: Board;
    private coordinator: Coordinator;
    private world: World;
    private physicsSystem: PhysicsSystem;
    private collisionSystem: CollisionSystem;
    private renderSystem: Canvas2DContextRenderSystem;
    private metrics: PerformanceMetrics[] = [];
    private currentTest: number = 0;
    private currentIteration: number = 0;
    private testStartTime: number = 0;
    private frameCount: number = 0;
    private lastFrameTime: number = 0;
    private frameTimes: number[] = [];
    private physicsTimes: number[] = [];
    private collisionTimes: number[] = [];
    private renderTimes: number[] = [];

    constructor() {
        const element = document.getElementById("graph") as HTMLCanvasElement;
        this.board = new Board(element);
        this.board.fullScreen = true;
        
        this.coordinator = new Coordinator();
        this.physicsSystem = new PhysicsSystem(this.coordinator);
        this.collisionSystem = new CollisionSystem(this.coordinator);
        this.renderSystem = new Canvas2DContextRenderSystem(this.coordinator, this.board.context);
        
        this.world = new World(1000, 1000);
        this.world._context = this.board.context;
    }

    async runBenchmark(): Promise<void> {
        console.log("Starting Physics Benchmark...");
        console.log("Testing object counts:", BENCHMARK_CONFIG.objectCounts);
        
        for (const objectCount of BENCHMARK_CONFIG.objectCounts) {
            for (let iteration = 0; iteration < BENCHMARK_CONFIG.iterations; iteration++) {
                console.log(`\n--- Test ${this.currentTest + 1}/${BENCHMARK_CONFIG.objectCounts.length * BENCHMARK_CONFIG.iterations} ---`);
                console.log(`Objects: ${objectCount}, Iteration: ${iteration + 1}`);
                
                // Test original system
                await this.testOriginalSystem(objectCount);
                
                // Test ECS system
                await this.testECSSystem(objectCount);
            }
        }
        
        this.printResults();
    }

    private async testOriginalSystem(objectCount: number): Promise<void> {
        this.resetSystems();
        this.createOriginalObjects(objectCount);
        
        const metrics = await this.runPerformanceTest('original');
        this.metrics.push(metrics);
    }

    private async testECSSystem(objectCount: number): Promise<void> {
        this.resetSystems();
        this.createECSObjects(objectCount);
        
        const metrics = await this.runPerformanceTest('ecs');
        this.metrics.push(metrics);
    }

    private resetSystems(): void {
        // Clear original world
        this.world = new World(1000, 1000);
        this.world._context = this.board.context;
        
        // Clear ECS coordinator
        this.coordinator = new Coordinator();
        this.physicsSystem = new PhysicsSystem(this.coordinator);
        this.collisionSystem = new CollisionSystem(this.coordinator);
        this.renderSystem = new Canvas2DContextRenderSystem(this.coordinator, this.board.context);
    }

    private createOriginalObjects(count: number): void {
        const vertices = [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}];
        
        for (let i = 0; i < count; i++) {
            const center = this.getRandomPoint(100, 900);
            center.z = Math.random() * 100 + 50;
            const body = new VisualPolygonBody(center, vertices, this.board.context, Math.random() * Math.PI * 2, Math.random() * 50 + 10, false);
            this.world.addRigidBody(i.toString(), body);
        }
    }

    private createECSObjects(count: number): void {
        const vertices = [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}];
        
        for (let i = 0; i < count; i++) {
            const entity = this.coordinator.createEntity();
            const center = this.getRandomPoint(100, 900);
            const aabb = updateAABBForPolygonRaw(vertices, center, 0);
            
            this.coordinator.addComponentToEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity, {
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
            
            this.coordinator.addComponentToEntity<PhysicsComponent>(PHYSICS_COMPONENT, entity, {
                force: {x: 0, y: 0},
                angularDampingFactor: 0.005,
                linearAcceleration: {x: 0, y: 0},
                angularAcceleration: 0,
                linearVelocity: {x: Math.random() * 100 - 50, y: Math.random() * 100 - 50},
                angularVelocity: Math.random() * 2 - 1,
            });
            
            this.coordinator.addComponentToEntity<RenderComponent>(RENDER_COMPONENT, entity, {
                show: true,
            });
        }
    }

    private async runPerformanceTest(systemType: 'original' | 'ecs'): Promise<PerformanceMetrics> {
        return new Promise((resolve) => {
            this.frameCount = 0;
            this.frameTimes = [];
            this.physicsTimes = [];
            this.collisionTimes = [];
            this.renderTimes = [];
            this.testStartTime = performance.now();
            this.lastFrameTime = this.testStartTime;

            const step = (timestamp: number) => {
                const frameStart = performance.now();
                
                // Clear canvas
                this.board.context.clearRect(0, 0, this.board.context.canvas.width, this.board.context.canvas.height);
                
                if (systemType === 'original') {
                    const physicsStart = performance.now();
                    this.world.step(0.016);
                    this.physicsTimes.push(performance.now() - physicsStart);
                } else {
                    const physicsStart = performance.now();
                    this.physicsSystem.update(0.016);
                    this.physicsTimes.push(performance.now() - physicsStart);
                    
                    const collisionStart = performance.now();
                    this.collisionSystem.update(0.016);
                    this.collisionTimes.push(performance.now() - collisionStart);
                    
                    const renderStart = performance.now();
                    this.renderSystem.update(0.016);
                    this.renderTimes.push(performance.now() - renderStart);
                }
                
                this.board.step(timestamp);
                
                const frameTime = performance.now() - frameStart;
                this.frameTimes.push(frameTime);
                this.frameCount++;
                
                // Check if test duration is complete
                if (performance.now() - this.testStartTime >= BENCHMARK_CONFIG.testDuration) {
                    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
                    const avgFPS = 1000 / avgFrameTime;
                    const avgPhysicsTime = this.physicsTimes.reduce((a, b) => a + b, 0) / this.physicsTimes.length;
                    const avgCollisionTime = this.collisionTimes.reduce((a, b) => a + b, 0) / this.collisionTimes.length;
                    const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
                    
                    this.currentTest++;
                    resolve({
                        objectCount: this.getObjectCount(),
                        systemType,
                        averageFPS: avgFPS,
                        averageFrameTime: avgFrameTime,
                        totalFrames: this.frameCount,
                        physicsTime: avgPhysicsTime,
                        collisionTime: avgCollisionTime,
                        renderTime: avgRenderTime,
                    });
                } else {
                    requestAnimationFrame(step);
                }
            };
            
            requestAnimationFrame(step);
        });
    }

    private getObjectCount(): number {
        const testIndex = Math.floor((this.currentTest - 1) / (BENCHMARK_CONFIG.iterations * 2));
        return BENCHMARK_CONFIG.objectCounts[testIndex] || BENCHMARK_CONFIG.objectCounts[0];
    }

    private printResults(): void {
        console.log("\n" + "=".repeat(80));
        console.log("PHYSICS BENCHMARK RESULTS");
        console.log("=".repeat(80));
        
        // Group results by object count
        const groupedResults = new Map<number, { original: PerformanceMetrics[], ecs: PerformanceMetrics[] }>();
        
        for (const metric of this.metrics) {
            if (!groupedResults.has(metric.objectCount)) {
                groupedResults.set(metric.objectCount, { original: [], ecs: [] });
            }
            groupedResults.get(metric.objectCount)![metric.systemType].push(metric);
        }
        
        for (const [objectCount, results] of groupedResults) {
            console.log(`\n--- ${objectCount} Objects ---`);
            
            const originalAvg = this.averageMetrics(results.original);
            const ecsAvg = this.averageMetrics(results.ecs);
            
            console.log(`Original System:`);
            console.log(`  Average FPS: ${originalAvg.averageFPS.toFixed(2)}`);
            console.log(`  Average Frame Time: ${originalAvg.averageFrameTime.toFixed(2)}ms`);
            console.log(`  Physics Time: ${originalAvg.physicsTime.toFixed(2)}ms`);
            
            console.log(`ECS System:`);
            console.log(`  Average FPS: ${ecsAvg.averageFPS.toFixed(2)}`);
            console.log(`  Average Frame Time: ${ecsAvg.averageFrameTime.toFixed(2)}ms`);
            console.log(`  Physics Time: ${ecsAvg.physicsTime.toFixed(2)}ms`);
            console.log(`  Collision Time: ${ecsAvg.collisionTime.toFixed(2)}ms`);
            console.log(`  Render Time: ${ecsAvg.renderTime.toFixed(2)}ms`);
            
            const fpsImprovement = ((ecsAvg.averageFPS - originalAvg.averageFPS) / originalAvg.averageFPS) * 100;
            console.log(`Performance: ${fpsImprovement > 0 ? '+' : ''}${fpsImprovement.toFixed(2)}%`);
        }
    }

    private averageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
        return {
            objectCount: metrics[0].objectCount,
            systemType: metrics[0].systemType,
            averageFPS: metrics.reduce((sum, m) => sum + m.averageFPS, 0) / metrics.length,
            averageFrameTime: metrics.reduce((sum, m) => sum + m.averageFrameTime, 0) / metrics.length,
            totalFrames: metrics.reduce((sum, m) => sum + m.totalFrames, 0) / metrics.length,
            physicsTime: metrics.reduce((sum, m) => sum + m.physicsTime, 0) / metrics.length,
            collisionTime: metrics.reduce((sum, m) => sum + m.collisionTime, 0) / metrics.length,
            renderTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length,
        };
    }

    private getRandomPoint(min: number, max: number): Point {
        return {
            x: Math.random() * (max - min) + min,
            y: Math.random() * (max - min) + min
        };
    }
}

// Start the benchmark when the page loads
window.addEventListener('load', () => {
    const benchmark = new PhysicsBenchmark();
    benchmark.runBenchmark();
}); 