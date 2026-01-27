import {
    BaseRigidBody,
    Circle,
    Polygon,
    VisaulCircleBody,
    VisualPolygonBody,
} from '../src/rigidbody';

describe('Polygon Rigidbody', () => {
    test('Initializing a polygon rigidbody', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const testPolygon = new Polygon({ x: 0, y: 0 }, vertices);

        expect(testPolygon.center).toEqual({ x: 0, y: 0 });
        expect(testPolygon.orientationAngle).toBe(0);
        expect(testPolygon.mass).toBe(50);
        expect(testPolygon.linearVelocity).toEqual({ x: 0, y: 0 });
        expect(testPolygon.angularVelocity).toBe(0);
        expect(testPolygon.isStatic()).toBe(false);
    });

    test('Polygon with custom parameters', () => {
        const vertices = [
            { x: 5, y: 5 },
            { x: -5, y: 5 },
            { x: -5, y: -5 },
            { x: 5, y: -5 },
        ];
        const polygon = new Polygon(
            { x: 10, y: 20 },
            vertices,
            Math.PI / 4,
            100,
            true,
            true
        );

        expect(polygon.center).toEqual({ x: 10, y: 20 });
        expect(polygon.orientationAngle).toBe(Math.PI / 4);
        expect(polygon.mass).toBe(100);
        expect(polygon.isStatic()).toBe(true);
        expect(polygon.staticFrictionCoeff).toBe(0.3);
    });

    test('Polygon getVerticesAbsCoord', () => {
        const vertices = [
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: -10, y: 0 },
            { x: 0, y: -10 },
        ];
        const polygon = new Polygon({ x: 5, y: 5 }, vertices);

        const absVertices = polygon.getVerticesAbsCoord();
        expect(absVertices[0]).toEqual({ x: 15, y: 5 });
        expect(absVertices[1]).toEqual({ x: 5, y: 15 });
        expect(absVertices[2]).toEqual({ x: -5, y: 5 });
        expect(absVertices[3]).toEqual({ x: 5, y: -5 });
    });

    test('Polygon AABB calculation', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const polygon = new Polygon({ x: 5, y: 5 }, vertices);

        const aabb = polygon.AABB;
        expect(aabb.min).toEqual({ x: -5, y: -5 });
        expect(aabb.max).toEqual({ x: 15, y: 15 });
    });

    test('Polygon movement', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const polygon = new Polygon({ x: 0, y: 0 }, vertices);

        polygon.move({ x: 5, y: 10 });
        expect(polygon.center).toEqual({ x: 5, y: 10 });
    });

    test('Static polygon does not move', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const polygon = new Polygon({ x: 0, y: 0 }, vertices, 0, 50, true);

        polygon.move({ x: 5, y: 10 });
        expect(polygon.center).toEqual({ x: 0, y: 0 });
    });

    test('Polygon force application', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const polygon = new Polygon(
            { x: 0, y: 0 },
            vertices,
            0,
            50,
            false,
            false
        ); // Disable friction

        polygon.applyForce({ x: 100, y: 50 });
        polygon.step(0.016); // 60 FPS

        expect(polygon.linearVelocity.x).toBeGreaterThan(0);
        expect(polygon.linearVelocity.y).toBeGreaterThan(0);
        expect(polygon.center.x).toBeGreaterThan(0);
        expect(polygon.center.y).toBeGreaterThan(0);
    });

    test('Polygon getMinMaxProjection', () => {
        const vertices = [
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: -10, y: 0 },
            { x: 0, y: -10 },
        ];
        const polygon = new Polygon({ x: 0, y: 0 }, vertices);

        const projection = polygon.getMinMaxProjection({ x: 1, y: 0 });
        expect(projection.min).toBe(-10);
        expect(projection.max).toBe(10);
    });

    test('Polygon getCollisionAxes', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const polygon = new Polygon({ x: 0, y: 0 }, vertices);
        const otherPolygon = new Polygon({ x: 20, y: 0 }, vertices);

        const axes = polygon.getCollisionAxes(otherPolygon);
        expect(axes).toHaveLength(4);
        axes.forEach(axis => {
            expect(Math.abs(axis.x * axis.x + axis.y * axis.y)).toBeCloseTo(
                1,
                5
            ); // Unit vector
        });
    });
});

describe('Circle Rigidbody', () => {
    test('Initializing a circle rigidbody', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);

        expect(circle.center).toEqual({ x: 0, y: 0 });
        expect(circle.radius).toBe(10);
        expect(circle.orientationAngle).toBe(0);
        expect(circle.mass).toBe(50);
        expect(circle.linearVelocity).toEqual({ x: 0, y: 0 });
        expect(circle.angularVelocity).toBe(0);
        expect(circle.isStatic()).toBe(false);
    });

    test('Circle with custom parameters', () => {
        const circle = new Circle(
            { x: 10, y: 20 },
            15,
            Math.PI / 2,
            80,
            true,
            false
        );

        expect(circle.center).toEqual({ x: 10, y: 20 });
        expect(circle.radius).toBe(15);
        expect(circle.orientationAngle).toBe(Math.PI / 2);
        expect(circle.mass).toBe(80);
        expect(circle.isStatic()).toBe(true);
    });

    test('Circle AABB calculation', () => {
        const circle = new Circle({ x: 10, y: 10 }, 5);

        const aabb = circle.AABB;
        expect(aabb.min).toEqual({ x: 5, y: 5 });
        expect(aabb.max).toEqual({ x: 15, y: 15 });
    });

    test('Circle getMinMaxProjection', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);

        const projection = circle.getMinMaxProjection({ x: 1, y: 0 });
        expect(projection.min).toBe(-10);
        expect(projection.max).toBe(10);
    });

    test('Circle getCollisionAxes', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);
        const otherCircle = new Circle({ x: 20, y: 0 }, 10);

        const axes = circle.getCollisionAxes(otherCircle);
        expect(axes).toHaveLength(1);
        expect(
            Math.abs(axes[0].x * axes[0].x + axes[0].y * axes[0].y)
        ).toBeCloseTo(1, 5); // Unit vector
    });

    test('Circle significantVertex', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);

        const vertex = circle.significantVertex({ x: 1, y: 0 });
        expect(vertex).toEqual({ x: 10, y: 0 });

        const vertex2 = circle.significantVertex({ x: 0, y: 1 });
        expect(vertex2).toEqual({ x: 0, y: 10 });
    });

    test('Circle moment of inertia', () => {
        const circle = new Circle({ x: 0, y: 0 }, 10, 0, 100);

        // For a circle: I = (1/2) * m * r^2
        const expectedMomentOfInertia = (100 * 10 * 10) / 2;
        expect(circle.momentOfInertia).toBe(expectedMomentOfInertia);
    });
});

describe('BaseRigidBody', () => {
    class TestRigidBody extends BaseRigidBody {
        get momentOfInertia(): number {
            return 100;
        }
        getMinMaxProjection(): { min: number; max: number } {
            return { min: 0, max: 1 };
        }
        getCollisionAxes(): any[] {
            return [];
        }
        get AABB(): { min: any; max: any } {
            return { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };
        }
        significantVertex(): any {
            return { x: 0, y: 0 };
        }
        getSignificantVertices(): any[] {
            return [];
        }
        getNormalOfSignificantFace(): any {
            return { x: 0, y: 1 };
        }
        getAdjacentFaces(): any[] {
            return [];
        }
    }

    test('BaseRigidBody initialization', () => {
        const body = new TestRigidBody(
            { x: 5, y: 10 },
            Math.PI / 4,
            75,
            false,
            true
        );

        expect(body.center).toEqual({ x: 5, y: 10 });
        expect(body.orientationAngle).toBe(Math.PI / 4);
        expect(body.mass).toBe(75);
        expect(body.isStatic()).toBe(false);
        expect(body.staticFrictionCoeff).toBe(0.3);
    });

    test('BaseRigidBody setters and getters', () => {
        const body = new TestRigidBody({ x: 0, y: 0 });

        body.linearVelocity = { x: 10, y: 20 };
        expect(body.linearVelocity).toEqual({ x: 10, y: 20 });

        body.angularVelocity = 0.5;
        expect(body.angularVelocity).toBe(0.5);

        body.staticFrictionCoeff = 0.8;
        expect(body.staticFrictionCoeff).toBe(0.8);
    });

    test('BaseRigidBody rotation', () => {
        const body = new TestRigidBody({ x: 0, y: 0 });

        body.rotateRadians(Math.PI / 2);
        expect(body.orientationAngle).toBe(Math.PI / 2);

        body.setOrientationAngle(Math.PI);
        expect(body.orientationAngle).toBe(Math.PI);
    });

    test('BaseRigidBody applyForceInOrientation', () => {
        const body = new TestRigidBody({ x: 0, y: 0 }, Math.PI / 2); // 90 degrees

        body.applyForceInOrientation(100); // Force in +x direction of body (which is +y in world)
        body.step(0.016);

        expect(body.linearVelocity.x).toBeCloseTo(0, 5);
        expect(body.linearVelocity.y).toBeGreaterThan(0);
    });
});

describe('Visual Components', () => {
    let mockContext: any;

    beforeEach(() => {
        mockContext = {
            beginPath: jest.fn(),
            arc: jest.fn(),
            stroke: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
        };
    });

    test('VisualPolygonBody creation and drawing', () => {
        const vertices = [
            { x: 10, y: 10 },
            { x: -10, y: 10 },
            { x: -10, y: -10 },
            { x: 10, y: -10 },
        ];
        const visualPolygon = new VisualPolygonBody(
            { x: 0, y: 0 },
            vertices,
            mockContext
        );

        expect(visualPolygon.center).toEqual({ x: 0, y: 0 });

        visualPolygon.draw(mockContext);
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.moveTo).toHaveBeenCalled();
        expect(mockContext.lineTo).toHaveBeenCalledTimes(5); // 4 vertices + closing line
        expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('VisaulCircleBody creation and drawing', () => {
        const visualCircle = new VisaulCircleBody(
            { x: 5, y: 5 },
            10,
            mockContext
        );

        expect(visualCircle.center).toEqual({ x: 5, y: 5 });

        visualCircle.draw(mockContext);
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.arc).toHaveBeenCalledWith(5, 5, 10, 0, 2 * Math.PI);
        expect(mockContext.stroke).toHaveBeenCalled();
    });
});
