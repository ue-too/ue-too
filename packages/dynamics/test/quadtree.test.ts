import { QuadTree, QuadTreeObject, RectangleBound } from '../src/quadtree';
import { Circle, Polygon } from '../src/rigidbody';

describe('RectangleBound', () => {
    test('RectangleBound creation', () => {
        const bound = new RectangleBound({ x: 10, y: 20 }, 100, 50);

        expect(bound.getbottomLeft()).toEqual({ x: 10, y: 20 });
        expect(bound.getWidth()).toBe(100);
        expect(bound.getHeight()).toBe(50);
    });

    test('RectangleBound with negative coordinates', () => {
        const bound = new RectangleBound({ x: -50, y: -30 }, 80, 60);

        expect(bound.getbottomLeft()).toEqual({ x: -50, y: -30 });
        expect(bound.getWidth()).toBe(80);
        expect(bound.getHeight()).toBe(60);
    });
});

describe('QuadTree', () => {
    let quadTree: QuadTree<Circle>;
    let bound: RectangleBound;

    beforeEach(() => {
        bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        quadTree = new QuadTree<Circle>(0, bound);
    });

    test('QuadTree initialization', () => {
        expect(quadTree).toBeInstanceOf(QuadTree);
        // We can't directly access private properties, but we can test behavior
    });

    test('Insert single object', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);

        expect(() => quadTree.insert(circle)).not.toThrow();
    });

    test('Insert multiple objects within capacity', () => {
        // Insert objects within the MAX_OBJECTS limit (10)
        for (let i = 0; i < 5; i++) {
            const circle = new Circle({ x: i * 10, y: i * 10 }, 5);
            quadTree.insert(circle);
        }

        expect(() =>
            quadTree.retrieve(new Circle({ x: 0, y: 0 }, 5))
        ).not.toThrow();
    });

    test('Insert objects causing subdivision', () => {
        // Insert more than MAX_OBJECTS (10) to trigger subdivision
        const circles: Circle[] = [];
        for (let i = 0; i < 15; i++) {
            const circle = new Circle({ x: i * 5, y: i * 5 }, 2);
            circles.push(circle);
            quadTree.insert(circle);
        }

        // QuadTree should handle subdivision internally
        expect(() => quadTree.retrieve(circles[0])).not.toThrow();
    });

    test('Retrieve objects from same region', () => {
        const circle1 = new Circle({ x: 10, y: 10 }, 5);
        const circle2 = new Circle({ x: 15, y: 15 }, 5);
        const circle3 = new Circle({ x: -50, y: -50 }, 5); // Different region

        quadTree.insert(circle1);
        quadTree.insert(circle2);
        quadTree.insert(circle3);

        const retrieved = quadTree.retrieve(circle1);

        // Should retrieve objects in the same region
        expect(retrieved).toContain(circle1);
        expect(retrieved).toContain(circle2);
        // May or may not contain circle3 depending on subdivision
    });

    test('Retrieve from empty quadtree', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);

        const retrieved = quadTree.retrieve(circle);

        expect(Array.isArray(retrieved)).toBe(true);
        expect(retrieved).toHaveLength(0);
    });

    test('Clear quadtree', () => {
        // Insert some objects
        for (let i = 0; i < 5; i++) {
            const circle = new Circle({ x: i * 10, y: i * 10 }, 5);
            quadTree.insert(circle);
        }

        quadTree.clear();

        const retrieved = quadTree.retrieve(new Circle({ x: 0, y: 0 }, 5));
        expect(retrieved).toHaveLength(0);
    });

    test('Objects in different quadrants', () => {
        const circle1 = new Circle({ x: 25, y: 25 }, 5); // Top-right
        const circle2 = new Circle({ x: -25, y: 25 }, 5); // Top-left
        const circle3 = new Circle({ x: -25, y: -25 }, 5); // Bottom-left
        const circle4 = new Circle({ x: 25, y: -25 }, 5); // Bottom-right

        quadTree.insert(circle1);
        quadTree.insert(circle2);
        quadTree.insert(circle3);
        quadTree.insert(circle4);

        // Each circle should retrieve itself and possibly others depending on subdivision
        const retrieved1 = quadTree.retrieve(circle1);
        const retrieved3 = quadTree.retrieve(circle3);

        expect(retrieved1).toContain(circle1);
        expect(retrieved3).toContain(circle3);
    });

    test('Objects spanning multiple quadrants', () => {
        // Large object that spans the center
        const largeCircle = new Circle({ x: 0, y: 0 }, 50);

        quadTree.insert(largeCircle);

        const retrieved = quadTree.retrieve(largeCircle);
        expect(retrieved).toContain(largeCircle);
    });

    test('QuadTree with polygon objects', () => {
        const vertices = [
            { x: 5, y: 5 },
            { x: -5, y: 5 },
            { x: -5, y: -5 },
            { x: 5, y: -5 },
        ];
        const polygon1 = new Polygon({ x: 20, y: 20 }, vertices);
        const polygon2 = new Polygon({ x: -20, y: -20 }, vertices);

        const polygonQuadTree = new QuadTree<Polygon>(0, bound);

        polygonQuadTree.insert(polygon1);
        polygonQuadTree.insert(polygon2);

        const retrieved = polygonQuadTree.retrieve(polygon1);
        expect(retrieved).toContain(polygon1);
    });

    test('Deep subdivision scenario', () => {
        // Create a scenario that forces deep subdivision
        const objects: Circle[] = [];

        // Create many objects in a small area to force deep subdivision
        for (let i = 0; i < 50; i++) {
            const circle = new Circle({ x: i, y: i }, 1);
            objects.push(circle);
            quadTree.insert(circle);
        }

        // Should still be able to retrieve objects
        const retrieved = quadTree.retrieve(objects[0]);
        expect(Array.isArray(retrieved)).toBe(true);
        expect(retrieved.length).toBeGreaterThan(0);
    });

    test('QuadTree getIndex behavior', () => {
        // We can't directly test getIndex since it's private,
        // but we can test its effects through insertion and retrieval

        const topLeft = new Circle({ x: -25, y: 25 }, 5);
        const topRight = new Circle({ x: 25, y: 25 }, 5);
        const bottomLeft = new Circle({ x: -25, y: -25 }, 5);
        const bottomRight = new Circle({ x: 25, y: -25 }, 5);

        quadTree.insert(topLeft);
        quadTree.insert(topRight);
        quadTree.insert(bottomLeft);
        quadTree.insert(bottomRight);

        // Force subdivision by adding more objects
        for (let i = 0; i < 10; i++) {
            quadTree.insert(new Circle({ x: i, y: i }, 1));
        }

        // Objects in different quadrants should be retrievable
        expect(quadTree.retrieve(topLeft)).toContain(topLeft);
        expect(quadTree.retrieve(bottomRight)).toContain(bottomRight);
    });

    test('QuadTree bounds checking', () => {
        // Objects outside the bounds
        const outsideCircle = new Circle({ x: 150, y: 150 }, 5); // Outside the 200x200 bounds
        const insideCircle = new Circle({ x: 50, y: 50 }, 5);

        quadTree.insert(outsideCircle);
        quadTree.insert(insideCircle);

        // Both should be insertable, but outside objects might not be optimally placed
        expect(() => quadTree.retrieve(outsideCircle)).not.toThrow();
        expect(() => quadTree.retrieve(insideCircle)).not.toThrow();
    });

    test('QuadTree with overlapping AABBs', () => {
        const circle1 = new Circle({ x: 10, y: 10 }, 15); // AABB overlaps center
        const circle2 = new Circle({ x: 5, y: 5 }, 10);

        quadTree.insert(circle1);
        quadTree.insert(circle2);

        const retrieved1 = quadTree.retrieve(circle1);
        const retrieved2 = quadTree.retrieve(circle2);

        // Both should be retrievable
        expect(retrieved1).toContain(circle1);
        expect(retrieved2).toContain(circle2);
    });
});

describe('QuadTree Drawing', () => {
    let quadTree: QuadTree<Circle>;
    let mockContext: any;

    beforeEach(() => {
        const bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        quadTree = new QuadTree<Circle>(0, bound);

        mockContext = {
            beginPath: jest.fn(),
            rect: jest.fn(),
            stroke: jest.fn(),
        };
    });

    test('Draw empty quadtree', () => {
        quadTree.draw(mockContext);

        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.rect).toHaveBeenCalledWith(-100, -100, 200, 200);
        expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('Draw quadtree with subdivisions', () => {
        // Force subdivision by adding many objects
        for (let i = 0; i < 15; i++) {
            const circle = new Circle({ x: i * 5, y: i * 5 }, 2);
            quadTree.insert(circle);
        }

        quadTree.draw(mockContext);

        // Should draw multiple rectangles due to subdivision
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.rect).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();

        // Should be called multiple times for different nodes (exact count depends on subdivision)
        expect(mockContext.rect.mock.calls.length).toBeGreaterThan(1);
    });
});

describe('QuadTree Performance', () => {
    test('Handle large number of objects', () => {
        const bound = new RectangleBound({ x: -500, y: -500 }, 1000, 1000);
        const quadTree = new QuadTree<Circle>(0, bound);

        const objects: Circle[] = [];

        // Insert many objects
        for (let i = 0; i < 100; i++) {
            const circle = new Circle(
                {
                    x: Math.random() * 1000 - 500,
                    y: Math.random() * 1000 - 500,
                },
                Math.random() * 10 + 1
            );
            objects.push(circle);
            quadTree.insert(circle);
        }

        // Retrieval should still work efficiently
        const startTime = Date.now();
        for (let i = 0; i < 10; i++) {
            quadTree.retrieve(objects[i]);
        }
        const endTime = Date.now();

        // Should complete in reasonable time (less than 100ms for 10 retrievals)
        expect(endTime - startTime).toBeLessThan(100);
    });
});

describe('QuadTree Edge Cases', () => {
    let quadTree: QuadTree<Circle>;

    beforeEach(() => {
        const bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        quadTree = new QuadTree<Circle>(0, bound);
    });

    test('Objects at exact boundaries', () => {
        const centerCircle = new Circle({ x: 0, y: 0 }, 5); // Exactly at center
        const edgeCircle = new Circle({ x: 100, y: 100 }, 5); // At boundary

        quadTree.insert(centerCircle);
        quadTree.insert(edgeCircle);

        expect(quadTree.retrieve(centerCircle)).toContain(centerCircle);
        expect(quadTree.retrieve(edgeCircle)).toContain(edgeCircle);
    });

    test('Very small objects', () => {
        const tinyCircle = new Circle({ x: 0, y: 0 }, 0.1);

        quadTree.insert(tinyCircle);

        expect(quadTree.retrieve(tinyCircle)).toContain(tinyCircle);
    });

    test('Objects with zero size', () => {
        // Create a mock object with zero-size AABB
        const zeroSizeObject: QuadTreeObject = {
            AABB: { min: { x: 10, y: 10 }, max: { x: 10, y: 10 } },
        };

        const genericQuadTree = new QuadTree<QuadTreeObject>(
            0,
            new RectangleBound({ x: -100, y: -100 }, 200, 200)
        );

        genericQuadTree.insert(zeroSizeObject);

        expect(genericQuadTree.retrieve(zeroSizeObject)).toContain(
            zeroSizeObject
        );
    });

    test('Maximum subdivision depth', () => {
        // Try to force maximum subdivision depth
        const objects: Circle[] = [];

        // Create many small objects in the same small area
        for (let i = 0; i < 100; i++) {
            const circle = new Circle({ x: i * 0.1, y: i * 0.1 }, 0.05);
            objects.push(circle);
            quadTree.insert(circle);
        }

        // Should still work even at maximum depth
        objects.forEach(obj => {
            expect(() => quadTree.retrieve(obj)).not.toThrow();
        });
    });
});
