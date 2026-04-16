import { Container, Graphics } from 'pixi.js';
import type { CurveSegment, StraightSegment, TrackSegment } from './track-types';

import { TRACK_HALF_WIDTH, type Horse } from './types';
import type { HorseFrame, RaceFrame } from './sim';

const RAIL_COLOR = 0xcccccc;
const RAIL_WIDTH = 2;
const TRACK_SURFACE_COLOR = 0x8b7355;
const CENTERLINE_COLOR = 0xffffff;
const CENTERLINE_WIDTH = 1;
const CENTERLINE_DASH = 6;
const CENTERLINE_GAP = 8;
const ARC_STEPS_PER_DEG = 1;
const HORSE_LENGTH = 2.0;
const HORSE_WIDTH = 0.65;
const PLAYER_OUTLINE_COLOR = 0xffff00;
const PLAYER_OUTLINE_WIDTH = 0.25;
const TRACE_WIDTH = 5;
const TRACE_ALPHA = 0.55;

// ---- Geometry helpers ----

function straightOffsetLine(
    seg: StraightSegment,
    offset: number,
): { sx: number; sy: number; ex: number; ey: number } {
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { sx: seg.startPoint.x, sy: seg.startPoint.y, ex: seg.endPoint.x, ey: seg.endPoint.y };
    // outward = rotate forward by -90° → (dy/len, -dx/len)
    const nx = (dy / len) * offset;
    const ny = (-dx / len) * offset;
    return {
        sx: seg.startPoint.x + nx,
        sy: seg.startPoint.y + ny,
        ex: seg.endPoint.x + nx,
        ey: seg.endPoint.y + ny,
    };
}

function arcPoints(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    span: number,
    steps: number,
): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + (span * i) / steps;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    return pts;
}

function curveStartAngle(seg: CurveSegment): number {
    return Math.atan2(
        seg.startPoint.y - seg.center.y,
        seg.startPoint.x - seg.center.x,
    );
}

function curveSteps(span: number): number {
    return Math.max(Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG), 4);
}

// ---- Straight drawing ----

function drawStraightSurface(g: Graphics, seg: StraightSegment, hw: number): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.sx, outer.sy);
    g.lineTo(outer.ex, outer.ey);
    g.lineTo(inner.ex, inner.ey);
    g.lineTo(inner.sx, inner.sy);
    g.closePath();
}

function drawStraightRails(g: Graphics, seg: StraightSegment, hw: number): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.sx, outer.sy);
    g.lineTo(outer.ex, outer.ey);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
    g.moveTo(inner.sx, inner.sy);
    g.lineTo(inner.ex, inner.ey);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawStraightCenterline(g: Graphics, seg: StraightSegment): void {
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const fx = dx / len;
    const fy = dy / len;
    let d = 0;
    let drawing = true;
    while (d < len) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, len - d);
        if (drawing) {
            g.moveTo(seg.startPoint.x + fx * d, seg.startPoint.y + fy * d);
            g.lineTo(seg.startPoint.x + fx * (d + segLen), seg.startPoint.y + fy * (d + segLen));
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---- Curve drawing ----

function drawCurveSurface(g: Graphics, seg: CurveSegment, hw: number): void {
    const startA = curveStartAngle(seg);
    const steps = curveSteps(seg.angleSpan);
    const outerPts = arcPoints(seg.center.x, seg.center.y, seg.radius + hw, startA, seg.angleSpan, steps);
    const innerPts = arcPoints(seg.center.x, seg.center.y, seg.radius - hw, startA, seg.angleSpan, steps);

    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) g.lineTo(outerPts[i].x, outerPts[i].y);
    for (let i = innerPts.length - 1; i >= 0; i--) g.lineTo(innerPts[i].x, innerPts[i].y);
    g.closePath();
}

function drawCurveRails(g: Graphics, seg: CurveSegment, hw: number): void {
    const startA = curveStartAngle(seg);
    const steps = curveSteps(seg.angleSpan);
    const outerPts = arcPoints(seg.center.x, seg.center.y, seg.radius + hw, startA, seg.angleSpan, steps);
    const innerPts = arcPoints(seg.center.x, seg.center.y, seg.radius - hw, startA, seg.angleSpan, steps);

    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) g.lineTo(outerPts[i].x, outerPts[i].y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });

    g.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) g.lineTo(innerPts[i].x, innerPts[i].y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawCurveCenterline(g: Graphics, seg: CurveSegment): void {
    const startA = curveStartAngle(seg);
    const arcLen = Math.abs(seg.angleSpan) * seg.radius;

    let d = 0;
    let drawing = true;
    while (d < arcLen) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, arcLen - d);
        if (drawing) {
            const a0 = startA + (seg.angleSpan * d) / arcLen;
            const a1 = startA + (seg.angleSpan * (d + segLen)) / arcLen;
            const dashSpan = a1 - a0;
            const dashSteps = Math.max(Math.ceil(Math.abs(dashSpan) * (180 / Math.PI)), 2);
            const pts = arcPoints(seg.center.x, seg.center.y, seg.radius, a0, dashSpan, dashSteps);
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---- Main drawTrack ----

function drawTrack(segments: TrackSegment[]): Graphics {
    const g = new Graphics();
    const hw = TRACK_HALF_WIDTH;

    // Pass 1: track surface (brown fill)
    g.beginPath();
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightSurface(g, seg as StraightSegment, hw);
        } else {
            drawCurveSurface(g, seg as CurveSegment, hw);
        }
    }
    g.fill({ color: TRACK_SURFACE_COLOR });

    // Pass 2: inner + outer rail lines
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightRails(g, seg as StraightSegment, hw);
        } else {
            drawCurveRails(g, seg as CurveSegment, hw);
        }
    }

    // Pass 3: dashed centerline
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightCenterline(g, seg as StraightSegment);
        } else {
            drawCurveCenterline(g, seg as CurveSegment);
        }
    }

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
    private horseColors = new Map<number, number>();
    private traceGfx = new Map<number, Graphics>();
    private traceContainer: Container;
    private trackGfx: Graphics;
    private lastTraceIdx = -1;

    constructor(private stage: Container, segments: TrackSegment[]) {
        this.trackGfx = drawTrack(segments);
        stage.addChild(this.trackGfx);
        this.traceContainer = new Container();
        stage.addChild(this.traceContainer);
    }

    /**
     * Sync horse sprites.
     * @param rotations - Optional per-horse rotation overrides (from recorded
     *   playback frames). When provided, skip the navigator lookup and use the
     *   recorded angle directly — simpler and correct after seek scrubbing.
     */
    syncHorses(
        horses: Horse[],
        playerHorseId: number | null,
        rotations?: Map<number, number>
    ): void {
        for (const h of horses) {
            let gfx = this.horseGfx.get(h.id);
            if (!gfx) {
                gfx = drawHorse(h.color, h.id === playerHorseId);
                this.stage.addChild(gfx);
                this.horseGfx.set(h.id, gfx);
                this.horseColors.set(h.id, h.color);
            }
            gfx.position.set(h.pos.x, h.pos.y);
            const recorded = rotations?.get(h.id);
            if (recorded !== undefined) {
                gfx.rotation = recorded;
            } else {
                const frame = h.navigator.getTrackFrame(h.pos);
                gfx.rotation = Math.atan2(frame.tangential.y, frame.tangential.x);
            }
        }
    }

    /**
     * Draw position traces for all horses up to `frameIndex` (inclusive).
     * Skips redraw when the index hasn't changed.
     */
    drawTraces(frames: RaceFrame[], frameIndex: number): void {
        const endIdx = Math.min(frameIndex, frames.length - 1);
        if (endIdx < 0) return;
        if (endIdx === this.lastTraceIdx) return;
        this.lastTraceIdx = endIdx;

        const horseCount = frames[0]?.horses.length ?? 0;

        for (let hi = 0; hi < horseCount; hi++) {
            const id = frames[0].horses[hi].id;
            let g = this.traceGfx.get(id);
            if (!g) {
                g = new Graphics();
                this.traceContainer.addChild(g);
                this.traceGfx.set(id, g);
            }
            g.clear();

            const first = frames[0].horses[hi];
            g.moveTo(first.x, first.y);
            for (let fi = 1; fi <= endIdx; fi++) {
                const hf = frames[fi].horses[hi];
                if (!hf) break;
                g.lineTo(hf.x, hf.y);
            }
            const color = this.horseColors.get(id) ?? 0xffffff;
            g.stroke({ width: TRACE_WIDTH, color, alpha: TRACE_ALPHA });
        }
    }

    clearTraces(): void {
        for (const g of this.traceGfx.values()) {
            g.clear();
        }
        this.lastTraceIdx = -1;
    }

    dispose(): void {
        for (const g of this.horseGfx.values()) g.destroy();
        this.horseGfx.clear();
        this.horseColors.clear();
        for (const g of this.traceGfx.values()) g.destroy();
        this.traceGfx.clear();
        this.traceContainer.destroy();
        this.trackGfx.destroy();
    }
}
