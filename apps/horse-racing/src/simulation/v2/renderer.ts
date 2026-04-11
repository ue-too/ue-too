import { Container, Graphics } from 'pixi.js';
import type { CurveSegment, StraightSegment, TrackSegment } from '../track-types';

import { TRACK_HALF_WIDTH, type Horse } from './types';

const RAIL_COLOR = 0xcccccc;
const RAIL_WIDTH = 0.8;
const TRACK_SURFACE_COLOR = 0x8b7355;
const CENTERLINE_COLOR = 0xffffff;
const CENTERLINE_WIDTH = 0.3;
const HORSE_LENGTH = 2.0;
const HORSE_WIDTH = 0.65;
const PLAYER_OUTLINE_COLOR = 0xffff00;
const PLAYER_OUTLINE_WIDTH = 0.25;
const ARC_STEP_RAD = Math.PI / 90; // 2-degree resolution

/** Draw the full track (surface fill + inner/outer rails + centerline) into a Graphics. */
function drawTrack(segments: TrackSegment[]): Graphics {
    const g = new Graphics();

    // --- Surface fill (outer rail polygon minus inner rail polygon) ---
    const outer: { x: number; y: number }[] = [];
    const inner: { x: number; y: number }[] = [];

    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            const ss = seg as StraightSegment;
            const dx = ss.endPoint.x - ss.startPoint.x;
            const dy = ss.endPoint.y - ss.startPoint.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) continue;
            const nx = dy / len; // left-hand normal
            const ny = -dx / len;
            outer.push({ x: ss.startPoint.x + nx * TRACK_HALF_WIDTH, y: ss.startPoint.y + ny * TRACK_HALF_WIDTH });
            outer.push({ x: ss.endPoint.x + nx * TRACK_HALF_WIDTH, y: ss.endPoint.y + ny * TRACK_HALF_WIDTH });
            inner.push({ x: ss.startPoint.x - nx * TRACK_HALF_WIDTH, y: ss.startPoint.y - ny * TRACK_HALF_WIDTH });
            inner.push({ x: ss.endPoint.x - nx * TRACK_HALF_WIDTH, y: ss.endPoint.y - ny * TRACK_HALF_WIDTH });
        } else {
            const cs = seg as CurveSegment;
            const startAng = Math.atan2(
                cs.startPoint.y - cs.center.y,
                cs.startPoint.x - cs.center.x,
            );
            const steps = Math.max(2, Math.ceil(Math.abs(cs.angleSpan) / ARC_STEP_RAD));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const a = startAng + cs.angleSpan * t;
                outer.push({
                    x: cs.center.x + (cs.radius + TRACK_HALF_WIDTH) * Math.cos(a),
                    y: cs.center.y + (cs.radius + TRACK_HALF_WIDTH) * Math.sin(a),
                });
                inner.push({
                    x: cs.center.x + (cs.radius - TRACK_HALF_WIDTH) * Math.cos(a),
                    y: cs.center.y + (cs.radius - TRACK_HALF_WIDTH) * Math.sin(a),
                });
            }
        }
    }

    // Surface: outer polygon filled, then erase-fill the inner polygon by
    // stroking it (simpler than geometry boolean ops and good enough visually).
    if (outer.length > 0) {
        g.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
        g.closePath();
        g.fill({ color: TRACK_SURFACE_COLOR });
    }

    // --- Rails ---
    const stroke = { color: RAIL_COLOR, width: RAIL_WIDTH };
    if (outer.length > 0) {
        g.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
        g.closePath();
        g.stroke(stroke);
    }
    if (inner.length > 0) {
        g.moveTo(inner[0].x, inner[0].y);
        for (let i = 1; i < inner.length; i++) g.lineTo(inner[i].x, inner[i].y);
        g.closePath();
        g.stroke(stroke);
    }

    // --- Centerline ---
    const centerStroke = { color: CENTERLINE_COLOR, width: CENTERLINE_WIDTH };
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            const ss = seg as StraightSegment;
            g.moveTo(ss.startPoint.x, ss.startPoint.y);
            g.lineTo(ss.endPoint.x, ss.endPoint.y);
        } else {
            const cs = seg as CurveSegment;
            const startAng = Math.atan2(
                cs.startPoint.y - cs.center.y,
                cs.startPoint.x - cs.center.x,
            );
            const steps = Math.max(2, Math.ceil(Math.abs(cs.angleSpan) / ARC_STEP_RAD));
            g.moveTo(cs.startPoint.x, cs.startPoint.y);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const a = startAng + cs.angleSpan * t;
                g.lineTo(cs.center.x + cs.radius * Math.cos(a), cs.center.y + cs.radius * Math.sin(a));
            }
        }
    }
    g.stroke(centerStroke);

    return g;
}

/** Draw one horse as a colored rectangle pivoted at its center. */
function drawHorse(color: number, isPlayer: boolean): Graphics {
    const g = new Graphics();
    g.rect(-HORSE_LENGTH / 2, -HORSE_WIDTH / 2, HORSE_LENGTH, HORSE_WIDTH);
    g.fill({ color });
    if (isPlayer) {
        g.rect(-HORSE_LENGTH / 2, -HORSE_WIDTH / 2, HORSE_LENGTH, HORSE_WIDTH);
        g.stroke({ color: PLAYER_OUTLINE_COLOR, width: PLAYER_OUTLINE_WIDTH });
    }
    return g;
}

/**
 * Pixi display side of the race. Reads from `Horse[]` each tick via
 * `syncHorses` — does not hold any simulation state.
 */
export class RaceRenderer {
    private horseGfx = new Map<number, Graphics>();
    private trackGfx: Graphics;

    constructor(private stage: Container, segments: TrackSegment[]) {
        this.trackGfx = drawTrack(segments);
        stage.addChild(this.trackGfx);
    }

    syncHorses(horses: Horse[], playerHorseId: number | null): void {
        for (const h of horses) {
            let gfx = this.horseGfx.get(h.id);
            if (!gfx) {
                gfx = drawHorse(h.color, h.id === playerHorseId);
                this.stage.addChild(gfx);
                this.horseGfx.set(h.id, gfx);
            }
            gfx.position.set(h.pos.x, h.pos.y);
            const frame = h.navigator.getTrackFrame(h.pos);
            gfx.rotation = Math.atan2(frame.tangential.y, frame.tangential.x);
        }
    }

    dispose(): void {
        for (const g of this.horseGfx.values()) g.destroy();
        this.horseGfx.clear();
        this.trackGfx.destroy();
    }
}
