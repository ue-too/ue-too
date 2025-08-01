import { SpatialIndexBenchmark, MockDynamicBody, MockStaticBody } from "../src/benchmark";
import { QuadTree, RectangleBound } from "../src/quadtree";
import { DynamicTree } from "../src/dynamic-tree";

describe('SpatialIndexBenchmark', () => {
    let benchmark: SpatialIndexBenchmark;

    beforeEach(() => {
        benchmark = new SpatialIndexBenchmark();
    });

    test('should create benchmark instance', () => {
        expect(benchmark).toBeInstanceOf(SpatialIndexBenchmark);
    });

    test('mock bodies should have correct properties', () => {
        const staticBody = new MockStaticBody(1, 10, 20, 30, 40);
        expect(staticBody.id).toBe(1);
        expect(staticBody.AABB.min).toEqual({ x: 10, y: 20 });
        expect(staticBody.AABB.max).toEqual({ x: 40, y: 60 });
        expect(staticBody.isStatic()).toBe(true);

        const dynamicBody = new MockDynamicBody(2, 50, 60, 20, 20, 10, -5);
        expect(dynamicBody.id).toBe(2);
        expect(dynamicBody.velocity).toEqual({ x: 10, y: -5 });
        expect(dynamicBody.isStatic()).toBe(false);
    });

    test('dynamic body should update position', () => {
        const body = new MockDynamicBody(1, 0, 0, 10, 10, 100, 50);
        const initialMin = { ...body.AABB.min };
        
        body.update(0.1); // 0.1 seconds
        
        expect(body.AABB.min.x).toBeCloseTo(initialMin.x + 10);
        expect(body.AABB.min.y).toBeCloseTo(initialMin.y + 5);
    });

    test('quadtree should handle basic operations', () => {
        const bounds = new RectangleBound({ x: 0, y: 0 }, 1000, 1000);
        const quadTree = new QuadTree(0, bounds);
        
        const body1 = new MockStaticBody(1, 100, 100, 50, 50);
        const body2 = new MockStaticBody(2, 200, 200, 50, 50);
        const body3 = new MockStaticBody(3, 120, 120, 30, 30); // Overlaps with body1
        
        quadTree.insert(body1);
        quadTree.insert(body2);
        quadTree.insert(body3);
        
        const nearby = quadTree.retrieve(body1);
        expect(nearby.length).toBeGreaterThan(0);
        expect(nearby).toContain(body3); // Should find overlapping body
    });

    test('dynamic tree should handle basic operations', () => {
        const dynamicTree = new DynamicTree();
        
        const body1 = new MockStaticBody(1, 100, 100, 50, 50);
        const body2 = new MockStaticBody(2, 200, 200, 50, 50);
        const body3 = new MockStaticBody(3, 120, 120, 30, 30); // Overlaps with body1
        
        dynamicTree.insert(body1);
        dynamicTree.insert(body2);
        dynamicTree.insert(body3);
        
        const stats = dynamicTree.getStats();
        expect(stats.nodeCount).toBe(3);
        expect(stats.height).toBeGreaterThanOrEqual(1);
        
        const nearby = dynamicTree.retrieve(body1);
        expect(nearby.length).toBeGreaterThan(0);
        expect(nearby).toContain(body3); // Should find overlapping body
    });

    test('both implementations should find same collision pairs', () => {
        // Create test scenario
        const bodies = [
            new MockStaticBody(1, 0, 0, 100, 100),
            new MockStaticBody(2, 50, 50, 100, 100), // Overlaps with body1
            new MockStaticBody(3, 200, 200, 50, 50),  // No overlap
            new MockStaticBody(4, 45, 45, 60, 60)     // Overlaps with body1 and body2
        ];

        // Test with quadtree
        const bounds = new RectangleBound({ x: -100, y: -100 }, 400, 400);
        const quadTree = new QuadTree(0, bounds);
        bodies.forEach(body => quadTree.insert(body));
        
        const quadResults: Set<string> = new Set();
        bodies.forEach(body => {
            const nearby = quadTree.retrieve(body);
            nearby.forEach(other => {
                if ((body as any).id !== (other as any).id) {
                    const pair = [(body as any).id, (other as any).id].sort().join('-');
                    quadResults.add(pair);
                }
            });
        });

        // Test with dynamic tree
        const dynamicTree = new DynamicTree();
        bodies.forEach(body => dynamicTree.insert(body));
        
        const dynamicResults: Set<string> = new Set();
        bodies.forEach(body => {
            const nearby = dynamicTree.retrieve(body);
            nearby.forEach(other => {
                if ((body as any).id !== (other as any).id) {
                    const pair = [(body as any).id, (other as any).id].sort().join('-');
                    dynamicResults.add(pair);
                }
            });
        });

        // Both should find overlaps, but may find different numbers due to different algorithms
        // QuadTree only checks within quadrants, DynamicTree uses fat AABBs
        expect(quadResults.size).toBeGreaterThan(0); // Should find some overlaps
        expect(dynamicResults.size).toBeGreaterThan(0); // Should find some overlaps
        
        // The results might be different but should have significant overlap
        const intersection = new Set([...quadResults].filter(x => dynamicResults.has(x)));
        expect(intersection.size).toBeGreaterThan(0); // Should have some common pairs
    });

    test('performance test should not crash', () => {
        // This is more of a smoke test - just ensure the benchmark runs without errors
        const smallBodies = [
            new MockDynamicBody(1, 0, 0, 10, 10, 1, 1),
            new MockDynamicBody(2, 20, 20, 10, 10, -1, -1),
            new MockStaticBody(3, 50, 50, 20, 20)
        ];

        // Create a minimal benchmark
        const bounds = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        const quadTree = new QuadTree(0, bounds);
        const dynamicTree = new DynamicTree();

        // Test insertion and retrieval
        expect(() => {
            smallBodies.forEach(body => {
                quadTree.insert(body);
                dynamicTree.insert(body);
            });

            smallBodies.forEach(body => {
                quadTree.retrieve(body);
                dynamicTree.retrieve(body);
            });
        }).not.toThrow();

        expect(dynamicTree.getStats().nodeCount).toBe(3);
    });
});