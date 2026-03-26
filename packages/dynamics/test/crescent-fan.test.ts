import {
    Circle,
    Crescent,
    Fan,
    World,
    intersects,
} from '../src/index';

describe('Crescent', () => {
    it('exposes finite AABB for a quarter arc', () => {
        const c = new Crescent({ x: 0, y: 0 }, 100, Math.PI / 2, 0);
        const aabb = c.AABB;
        expect(Number.isFinite(aabb.min.x)).toBe(true);
        expect(aabb.max.x).toBeGreaterThan(aabb.min.x);
        expect(aabb.max.y).toBeGreaterThan(aabb.min.y);
    });

    it('detects overlap with a circle near the arc', () => {
        const arc = new Crescent({ x: 0, y: 0 }, 100, Math.PI / 2, 0);
        const inside = new Circle({ x: 100, y: 0 }, 5, 0, 10, false, false);
        const { collision } = intersects(arc, inside);
        expect(collision).toBe(true);
    });

    it('has stable min/max projection on axes', () => {
        const c = new Crescent({ x: 50, y: 50 }, 80, 0.5, 0.1);
        const p = c.getMinMaxProjection({ x: 1, y: 0 });
        expect(p.min).toBeLessThanOrEqual(p.max);
    });
});

describe('Fan', () => {
    it('includes center in projection extent on some axes', () => {
        const f = new Fan({ x: 0, y: 0 }, 50, Math.PI / 3, 0);
        const p = f.getMinMaxProjection({ x: 1, y: 0 });
        const cProj = 0;
        expect(p.min).toBeLessThanOrEqual(cProj);
        expect(p.max).toBeGreaterThanOrEqual(cProj);
    });

    it('reports collision with nearby circle', () => {
        const fan = new Fan({ x: 0, y: 0 }, 100, Math.PI / 4, 0);
        const ball = new Circle({ x: 100, y: 0 }, 8, 0, 10, false, false);
        const { collision } = intersects(fan, ball);
        expect(collision).toBe(true);
    });
});

describe('World useLinearCollisionResolution', () => {
    it('steps without throwing when linear-only resolution is enabled', () => {
        const world = new World(2000, 2000, 'dynamictree');
        world.useLinearCollisionResolution = true;
        const a = new Circle({ x: 0, y: 0 }, 15, 0, 50, false, false);
        const b = new Circle({ x: 28, y: 0 }, 15, 0, 50, false, false);
        world.addRigidBody('a', a);
        world.addRigidBody('b', b);
        a.linearVelocity = { x: 50, y: 0 };
        b.linearVelocity = { x: -50, y: 0 };
        expect(() => world.step(1 / 60)).not.toThrow();
    });
});
