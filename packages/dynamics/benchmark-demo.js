import { QuadTree, RectangleBound, DynamicTree } from './dist/index.js';

console.log('🌳 Quick Spatial Index Demo');
console.log('='.repeat(40));

// Create test objects
function createTestBodies(count) {
    const bodies = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * 800;
        const y = Math.random() * 600;
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

// Quick performance test
function quickBenchmark(bodies, iterations = 50) {
    console.log(`\nTesting with ${bodies.length} objects over ${iterations} iterations`);
    
    // Test QuadTree
    const bounds = new RectangleBound({ x: 0, y: 0 }, 1000, 800);
    let quadTime = 0;
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const quadTree = new QuadTree(0, bounds);
        
        bodies.forEach(body => quadTree.insert(body));
        bodies.forEach(body => quadTree.retrieve(body));
        
        quadTime += performance.now() - start;
    }
    
    // Test DynamicTree
    let dynamicTime = 0;
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const dynamicTree = new DynamicTree();
        
        bodies.forEach(body => dynamicTree.insert(body));
        bodies.forEach(body => dynamicTree.retrieve(body));
        
        dynamicTime += performance.now() - start;
    }
    
    const avgQuadTime = quadTime / iterations;
    const avgDynamicTime = dynamicTime / iterations;
    
    console.log(`QuadTree avg:     ${avgQuadTime.toFixed(3)}ms`);
    console.log(`DynamicTree avg:  ${avgDynamicTime.toFixed(3)}ms`);
    
    const speedup = avgQuadTime / avgDynamicTime;
    if (speedup > 1.1) {
        console.log(`🚀 DynamicTree is ${speedup.toFixed(2)}x FASTER`);
    } else if (speedup < 0.9) {
        console.log(`🐌 DynamicTree is ${(1/speedup).toFixed(2)}x SLOWER`);
    } else {
        console.log(`⚖️  Similar performance (${speedup.toFixed(2)}x)`);
    }
    
    return { quadTime: avgQuadTime, dynamicTime: avgDynamicTime, speedup };
}

// Run tests
const scenarios = [
    { name: "Small", count: 50 },
    { name: "Medium", count: 150 },
    { name: "Large", count: 400 }
];

console.log('\n📊 Performance Comparison Results:');

scenarios.forEach(scenario => {
    console.log(`\n${scenario.name} (${scenario.count} objects):`);
    console.log('-'.repeat(30));
    
    const bodies = createTestBodies(scenario.count);
    quickBenchmark(bodies, 30);
});

console.log('\n✅ Demo completed!');
console.log('\nKey Insights:');
console.log('• QuadTree: Good for static/slow-moving objects');
console.log('• DynamicTree: Better for dynamic objects and varying sizes');
console.log('• DynamicTree uses "fat AABBs" to reduce tree updates');
console.log('• Both have O(log n) query time in optimal cases');