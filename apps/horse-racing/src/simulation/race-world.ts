import { Polygon, World } from '@ue-too/dynamics';
import type { Point } from '@ue-too/math';

import { buildTrackIntoWorld, trackBounds } from './track-from-json';
import type { TrackSegment } from './track-types';
import { HORSE_HALF_LENGTH, HORSE_HALF_WIDTH } from './types';

const HORSE_LOCAL_VERTS: Point[] = [
    { x: HORSE_HALF_LENGTH, y: HORSE_HALF_WIDTH },
    { x: HORSE_HALF_LENGTH, y: -HORSE_HALF_WIDTH },
    { x: -HORSE_HALF_LENGTH, y: -HORSE_HALF_WIDTH },
    { x: -HORSE_HALF_LENGTH, y: HORSE_HALF_WIDTH },
];

/**
 * Wraps the dynamics `World` for a single race. Creates static rail bodies
 * from track segments and manages dynamic horse `Polygon` bodies.
 */
export class RaceWorld {
    readonly world: World;
    private horseBodies = new Map<number, Polygon>();

    constructor(segments: TrackSegment[]) {
        const bounds = trackBounds(segments, 100);
        const w = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) + 100;
        const h = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 100;
        this.world = new World(w, h, 'dynamictree');
        this.world.resolveCollision = true;
        this.world.useLinearCollisionResolution = true;
        this.world.sleepingEnabled = false;
        buildTrackIntoWorld(this.world, segments);
    }

    addHorse(id: number, pos: Point, orientationAngle: number, mass: number): Polygon {
        const body = new Polygon(
            { x: pos.x, y: pos.y },
            HORSE_LOCAL_VERTS.map((v) => ({ x: v.x, y: v.y })),
            orientationAngle,
            mass,
            false, // not static
            true, // friction enabled
        );
        body.angularVelocity = 0;
        this.world.addRigidBody(`horse-${id}`, body);
        this.horseBodies.set(id, body);
        return body;
    }

    getHorseBody(id: number): Polygon {
        const body = this.horseBodies.get(id);
        if (!body) throw new Error(`No body for horse ${id}`);
        return body;
    }

    step(dt: number): void {
        this.world.step(dt);
    }

    dispose(): void {
        this.horseBodies.clear();
    }
}
