// Simple benchmark runner for testing
import { QuadTree, RectangleBound } from "./quadtree";
import { DynamicTree } from "./dynamic-tree";

interface TestBody {
    AABB: { min: { x: number, y: number }, max: { x: number, y: number } };
    id: number;
}

function createTestBodies(count: number): TestBody[] {
    const bodies: TestBody[] = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * 1000;
        const y = Math.random() * 1000;
        const size = 10 + Math.random() * 20;
        
        bodies.push({
            id: i,
            AABB: {
                min: { x, y },
                max: { x: x + size, y: y + size }
            }
        });
    }
    return bodies;
}

function benchmarkQuadTree(bodies: TestBody[], iterations: number): number {
    const bounds = new RectangleBound({ x: 0, y: 0 }, 1200, 1200);
    let totalTime = 0;
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const quadTree = new QuadTree<TestBody>(0, bounds);
        bodies.forEach(body => quadTree.insert(body));
        
        // Perform queries
        bodies.forEach(body => {
            quadTree.retrieve(body);
        });
        
        totalTime += performance.now() - start;
    }
    
    return totalTime / iterations;
}

function benchmarkDynamicTree(bodies: TestBody[], iterations: number): number {
    let totalTime = 0;
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const dynamicTree = new DynamicTree<TestBody>();
        bodies.forEach(body => dynamicTree.insert(body));
        
        // Perform queries
        bodies.forEach(body => {
            dynamicTree.retrieve(body);
        });
        
        totalTime += performance.now() - start;
    }
    
    return totalTime / iterations;
}

function runSimpleBenchmark() {
    console.log("🌳 Simple Spatial Index Benchmark");
    console.log("=".repeat(50));

    const scenarios = [
        { name: "Small (50 objects)", count: 50, iterations: 100 },
        { name: "Medium (200 objects)", count: 200, iterations: 50 },
        { name: "Large (500 objects)", count: 500, iterations: 20 }
    ];

    scenarios.forEach(scenario => {
        console.log(`\n📊 ${scenario.name}`);
        console.log("-".repeat(30));

        const bodies = createTestBodies(scenario.count);
        
        const quadTime = benchmarkQuadTree(bodies, scenario.iterations);
        const dynamicTime = benchmarkDynamicTree(bodies, scenario.iterations);
        
        console.log(`QuadTree:     ${quadTime.toFixed(3)}ms`);
        console.log(`DynamicTree:  ${dynamicTime.toFixed(3)}ms`);
        
        const speedup = quadTime / dynamicTime;
        if (speedup > 1.1) {
            console.log(`🚀 DynamicTree is ${speedup.toFixed(2)}x FASTER`);
        } else if (speedup < 0.9) {
            console.log(`🐌 DynamicTree is ${(1/speedup).toFixed(2)}x SLOWER`);
        } else {
            console.log(`⚖️  Similar performance`);
        }
    });

    console.log("\n✅ Simple benchmark completed!");
}

// Export for external use
export { runSimpleBenchmark };