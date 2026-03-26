import { Circle, World } from '@ue-too/dynamics';
import type { BaseAppComponents } from '@ue-too/board-pixi-integration';
import { PointCal } from '@ue-too/math';
import { Graphics, Text } from 'pixi.js';

import {
    buildTrackIntoWorld,
    parseTrackJson,
    trackBounds,
    trackStartFrame,
} from './track-from-json';

const TRACK_URL = '/tracks/exp_track_8.json';
const HORSE_COUNT = 4;
const HORSE_RADIUS = 9;
const HORSE_SPACING = 14;
const FORWARD_FORCE = 14000;
const DAMP_SIDE = 0.12;
const PHYS_SUBSTEPS = 8;
const PHYS_HZ = 240;

/**
 * Loads track JSON, builds the dynamics world, and wires Pixi graphics + ticker.
 *
 * @param components - Result of `baseInitApp`
 * @returns Cleanup to remove ticker and simulation graphics
 */
export async function attachHorseRacingSim(
    components: BaseAppComponents,
): Promise<{ cleanup: () => void }> {
    const { app, cleanups } = components;
    const stage = app.stage;

    const res = await fetch(TRACK_URL);
    if (!res.ok) {
        throw new Error(`Failed to load ${TRACK_URL}: ${res.status}`);
    }
    const segments = parseTrackJson(await res.json());
    const bounds = trackBounds(segments, 120);
    const absMaxX =
        Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) + 300;
    const absMaxY =
        Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 300;

    const world = new World(absMaxX, absMaxY, 'dynamictree');
    world.useLinearCollisionResolution = true;
    buildTrackIntoWorld(world, segments);

    const frame = trackStartFrame(segments);
    if (!frame) {
        throw new Error('Track has no segments');
    }

    const turf = new Graphics();
    turf.rect(
        bounds.min.x,
        bounds.min.y,
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
    );
    turf.fill({ color: 0x2d6a3e });
    stage.addChildAt(turf, 0);

    const label = new Text({
        text: 'Horse racing (dynamics demo)',
        style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fill: 0xffffff,
        },
    });
    label.anchor.set(0.5, 0);
    label.position.set(
        (bounds.min.x + bounds.max.x) / 2,
        bounds.min.y + 16,
    );
    stage.addChild(label);

    const horseIds: string[] = [];
    const horseColors = [0xc9a227, 0x8b4513, 0x4169e1, 0xffffff];
    const horseGfx = new Map<string, Graphics>();

    for (let i = 0; i < HORSE_COUNT; i++) {
        const id = `horse-${i}`;
        const pos = PointCal.addVector(
            frame.origin,
            PointCal.multiplyVectorByScalar(
                frame.outward,
                HORSE_SPACING * (i + 1),
            ),
        );
        const body = new Circle(
            pos,
            HORSE_RADIUS,
            0,
            500,
            false,
            false,
        );
        world.addRigidBody(id, body);
        horseIds.push(id);

        const g = new Graphics();
        g.circle(0, 0, HORSE_RADIUS).fill({ color: horseColors[i % horseColors.length] });
        g.stroke({ width: 1, color: 0x222222 });
        stage.addChild(g);
        horseGfx.set(id, g);
    }

    const fixedDt = 1 / PHYS_HZ;

    const onTick = (): void => {
        const map = world.getRigidBodyMap();
        for (const hid of horseIds) {
            const h = map.get(hid);
            if (!h) continue;
            const v = h.linearVelocity;
            const along = PointCal.dotProduct(v, frame.forward);
            const side = PointCal.subVector(
                v,
                PointCal.multiplyVectorByScalar(frame.forward, along),
            );
            h.linearVelocity = PointCal.subVector(
                v,
                PointCal.multiplyVectorByScalar(side, DAMP_SIDE),
            );
            h.applyForce(
                PointCal.multiplyVectorByScalar(frame.forward, FORWARD_FORCE),
            );
        }

        for (let s = 0; s < PHYS_SUBSTEPS; s++) {
            world.step(fixedDt);
        }

        for (const hid of horseIds) {
            const body = map.get(hid);
            const gr = horseGfx.get(hid);
            if (body && gr) {
                gr.position.set(body.center.x, body.center.y);
            }
        }
    };

    app.ticker.add(onTick);

    const cleanup = (): void => {
        app.ticker.remove(onTick);
        stage.removeChild(turf);
        stage.removeChild(label);
        for (const g of horseGfx.values()) {
            stage.removeChild(g);
            g.destroy();
        }
        horseGfx.clear();
    };

    cleanups.push(cleanup);

    return { cleanup };
}
