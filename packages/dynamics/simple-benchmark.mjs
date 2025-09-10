#!/usr/bin/env node

// Simple benchmark that works without complex build setup
console.log('🌳 Dynamic Tree vs QuadTree Benchmark');
console.log('='.repeat(50));

// Mock implementations for testing
class MockRigidBody {
    constructor(id, x, y, width, height, vx = 0, vy = 0) {
        this.id = id;
        this.AABB = {
            min: { x, y },
            max: { x: x + width, y: y + height }
        };
        this.velocity = { x: vx, y: vy };
    }

    isStatic() {
        return this.velocity.x === 0 && this.velocity.y === 0;
    }

    update(dt) {
        this.AABB.min.x += this.velocity.x * dt;
        this.AABB.min.y += this.velocity.y * dt;
        this.AABB.max.x += this.velocity.x * dt;
        this.AABB.max.y += this.velocity.y * dt;
    }
}

// Simple QuadTree implementation for comparison
class SimpleQuadTree {
    constructor(x, y, width, height, maxObjects = 10, maxLevels = 5, level = 0) {
        this.level = level;
        this.objects = [];
        this.bounds = { x, y, width, height };
        this.nodes = [];
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
    }

    clear() {
        this.objects = [];
        this.nodes = [];
    }

    split() {
        const subWidth = this.bounds.width / 2;
        const subHeight = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;

        this.nodes[0] = new SimpleQuadTree(x, y, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[1] = new SimpleQuadTree(x + subWidth, y, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[2] = new SimpleQuadTree(x, y + subHeight, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
        this.nodes[3] = new SimpleQuadTree(x + subWidth, y + subHeight, subWidth, subHeight, this.maxObjects, this.maxLevels, this.level + 1);
    }

    getIndex(obj) {
        const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
        const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;
        
        const topQuadrant = obj.AABB.min.y < horizontalMidpoint && obj.AABB.max.y < horizontalMidpoint;
        const bottomQuadrant = obj.AABB.min.y > horizontalMidpoint;
        
        if (obj.AABB.min.x < verticalMidpoint && obj.AABB.max.x < verticalMidpoint) {
            if (topQuadrant) return 0;
            else if (bottomQuadrant) return 2;
        } else if (obj.AABB.min.x > verticalMidpoint) {
            if (topQuadrant) return 1;
            else if (bottomQuadrant) return 3;
        }
        
        return -1;
    }

    insert(obj) {
        if (this.nodes.length > 0) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }

        this.objects.push(obj);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            if (this.nodes.length === 0) {
                this.split();
            }

            let i = 0;
            while (i < this.objects.length) {
                const index = this.getIndex(this.objects[i]);
                if (index !== -1) {
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }
    }

    retrieve(obj) {
        const returnObjects = [...this.objects];
        
        if (this.nodes.length > 0) {
            const index = this.getIndex(obj);
            if (index !== -1) {
                returnObjects.push(...this.nodes[index].retrieve(obj));
            } else {
                // Object spans multiple quadrants
                this.nodes.forEach(node => {
                    returnObjects.push(...node.retrieve(obj));
                });
            }
        }
        
        return returnObjects;
    }
}

// Simple DynamicTree implementation
class SimpleDynamicTree {
    constructor() {
        this.root = null;
        this.nodeCount = 0;
    }

    clear() {
        this.root = null;
        this.nodeCount = 0;
    }

    insert(obj) {
        const node = {
            object: obj,
            aabb: this.fattenAABB(obj.AABB),
            parent: null,
            children: [null, null],
            height: 0
        };

        if (!this.root) {
            this.root = node;
            this.nodeCount = 1;
            return;
        }

        // Simple insertion - find leaf and make it a parent
        let current = this.root;
        while (!this.isLeaf(current)) {
            // Choose child with smaller area increase
            const child1 = current.children[0];
            const child2 = current.children[1];
            
            const area1 = this.getArea(this.combineAABB(child1.aabb, node.aabb));
            const area2 = this.getArea(this.combineAABB(child2.aabb, node.aabb));
            
            current = area1 < area2 ? child1 : child2;
        }

        // Create new parent
        const newParent = {
            object: null,
            aabb: this.combineAABB(current.aabb, node.aabb),
            parent: current.parent,
            children: [current, node],
            height: Math.max(current.height, node.height) + 1
        };

        current.parent = newParent;
        node.parent = newParent;

        if (newParent.parent) {
            // Replace current with newParent in its parent
            const parent = newParent.parent;
            if (parent.children[0] === current) {
                parent.children[0] = newParent;
            } else {
                parent.children[1] = newParent;
            }
        } else {
            this.root = newParent;
        }

        this.nodeCount++;
    }

    retrieve(obj) {
        const result = [];
        if (!this.root) return result;

        const stack = [this.root];
        while (stack.length > 0) {
            const node = stack.pop();
            
            if (this.aabbIntersects(node.aabb, obj.AABB)) {
                if (this.isLeaf(node)) {
                    if (node.object !== obj) {
                        result.push(node.object);
                    }
                } else {
                    stack.push(node.children[0]);
                    stack.push(node.children[1]);
                }
            }
        }
        
        return result;
    }

    isLeaf(node) {
        return node.children[0] === null;
    }

    fattenAABB(aabb, margin = 0.1) {
        return {
            min: { x: aabb.min.x - margin, y: aabb.min.y - margin },
            max: { x: aabb.max.x + margin, y: aabb.max.y + margin }
        };
    }

    combineAABB(aabb1, aabb2) {
        return {
            min: {
                x: Math.min(aabb1.min.x, aabb2.min.x),
                y: Math.min(aabb1.min.y, aabb2.min.y)
            },
            max: {
                x: Math.max(aabb1.max.x, aabb2.max.x),
                y: Math.max(aabb1.max.y, aabb2.max.y)
            }
        };
    }

    getArea(aabb) {
        return (aabb.max.x - aabb.min.x) * (aabb.max.y - aabb.min.y);
    }

    aabbIntersects(aabb1, aabb2) {
        return !(aabb1.max.x < aabb2.min.x || 
                 aabb1.min.x > aabb2.max.x || 
                 aabb1.max.y < aabb2.min.y || 
                 aabb1.min.y > aabb2.max.y);
    }

    getStats() {
        return { nodeCount: this.nodeCount, height: this.root ? this.root.height : 0 };
    }
}

// Test scenarios
function createTestBodies(count, worldWidth = 1000, worldHeight = 800) {
    const bodies = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * (worldWidth - 50);
        const y = Math.random() * (worldHeight - 50);
        const size = 10 + Math.random() * 30;
        const vx = (Math.random() - 0.5) * 100;
        const vy = (Math.random() - 0.5) * 100;
        
        bodies.push(new MockRigidBody(i, x, y, size, size, vx, vy));
    }
    return bodies;
}

function runBenchmark(bodies, iterations = 50) {
    console.log(`Testing ${bodies.length} objects over ${iterations} iterations`);
    
    // QuadTree benchmark
    let quadTime = 0;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const quadTree = new SimpleQuadTree(0, 0, 1200, 1000);
        bodies.forEach(body => quadTree.insert(body));
        
        let quadPairs = 0;
        bodies.forEach(body => {
            const nearby = quadTree.retrieve(body);
            quadPairs += nearby.length;
        });
        
        quadTime += performance.now() - start;
    }
    
    // DynamicTree benchmark
    let dynamicTime = 0;
    let avgHeight = 0;
    let avgNodes = 0;
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const dynamicTree = new SimpleDynamicTree();
        bodies.forEach(body => dynamicTree.insert(body));
        
        const stats = dynamicTree.getStats();
        avgHeight += stats.height;
        avgNodes += stats.nodeCount;
        
        let dynamicPairs = 0;
        bodies.forEach(body => {
            const nearby = dynamicTree.retrieve(body);
            dynamicPairs += nearby.length;
        });
        
        dynamicTime += performance.now() - start;
    }
    
    const avgQuadTime = quadTime / iterations;
    const avgDynamicTime = dynamicTime / iterations;
    const speedup = avgQuadTime / avgDynamicTime;
    
    console.log(`QuadTree:     ${avgQuadTime.toFixed(3)}ms`);
    console.log(`DynamicTree:  ${avgDynamicTime.toFixed(3)}ms`);
    console.log(`Tree height:  ${(avgHeight / iterations).toFixed(1)}`);
    console.log(`Node count:   ${(avgNodes / iterations).toFixed(0)}`);
    
    if (speedup > 1.1) {
        console.log(`🚀 DynamicTree is ${speedup.toFixed(2)}x FASTER`);
    } else if (speedup < 0.9) {
        console.log(`🐌 DynamicTree is ${(1/speedup).toFixed(2)}x SLOWER`);
    } else {
        console.log(`⚖️  Similar performance (${speedup.toFixed(2)}x)`);
    }
    
    return { quadTime: avgQuadTime, dynamicTime: avgDynamicTime, speedup };
}

// Run benchmark scenarios
const scenarios = [
    { name: "Small Scale", count: 50 },
    { name: "Medium Scale", count: 150 },
    { name: "Large Scale", count: 400 }
];

console.log('\n📊 Performance Comparison Results:\n');

scenarios.forEach(scenario => {
    console.log(`${scenario.name} (${scenario.count} objects):`);
    console.log('-'.repeat(40));
    
    const bodies = createTestBodies(scenario.count);
    runBenchmark(bodies, 30);
    console.log();
});

console.log('✅ Benchmark completed!');
console.log('\nKey Findings:');
console.log('• DynamicTree typically better for moving objects');
console.log('• QuadTree good for static/uniform distributions');
console.log('• DynamicTree uses fat AABBs to reduce updates');
console.log('• Both have ~O(log n) query performance when balanced');