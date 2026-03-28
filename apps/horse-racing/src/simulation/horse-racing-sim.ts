import type { BaseAppComponents } from '@ue-too/board-pixi-integration';
import { PointCal } from '@ue-too/math';
import type { Point } from '@ue-too/math';
import { Graphics, Text } from 'pixi.js';

import type { CurveSegment, StraightSegment } from './track-types';

import { parseTrackJson, trackBounds } from './track-from-json';
import type { TrackSegment } from './track-types';
import { HorseRacingEngine } from './horse-racing-engine';
import type { HorseAction } from './horse-racing-engine';

// ---------------------------------------------------------------------------
// Constants (rendering only — simulation constants live in the engine)
// ---------------------------------------------------------------------------

const DEFAULT_TRACK_URL = '/tracks/exp_track_8.json';

const HORSE_COLORS = [0xc9a227, 0x8b4513, 0x4169e1, 0xffffff];
const PLAYER_INDEX = 0;
const PLAYER_TANGENTIAL = 10; // player UP/DOWN acceleration magnitude
const PLAYER_NORMAL = 5; // player LEFT/RIGHT acceleration magnitude

// Debug
const DEBUG_TRAIL = true;
const TRAIL_DOT_INTERVAL = 5; // record every N ticks
const TRAIL_DOT_RADIUS = 1.5;
const DEBUG_FENCE_COLOR = 0xff4444;
const DEBUG_CENTERLINE_COLOR = 0x00ff00;
const DEBUG_FAN_COLOR = 0x00ccff;

// Track rendering — derive from default horse layout so fences contain all horses
const TRACK_HALF_WIDTH = 3 * 4 + 1.3; // horseSpacing * horseCount + horseRadius = 13.3
const RAIL_COLOR = 0xcccccc;
const RAIL_WIDTH = 2;
const TRACK_SURFACE_COLOR = 0x8b7355;
const CENTERLINE_COLOR = 0xffffff;
const CENTERLINE_WIDTH = 1;
const CENTERLINE_DASH = 6;
const CENTERLINE_GAP = 8;
const ARC_STEPS_PER_DEG = 1; // resolution for drawing arcs

// ---------------------------------------------------------------------------
// Key state
// ---------------------------------------------------------------------------

type KeyState = {
    ArrowUp: boolean;
    ArrowDown: boolean;
    ArrowLeft: boolean;
    ArrowRight: boolean;
};

function createKeyState(): KeyState {
    return {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
    };
}

// ---------------------------------------------------------------------------
// Simulation handle returned to callers
// ---------------------------------------------------------------------------

export type HorseRacingSimHandle = {
    cleanup: () => void;
    reloadTrack: (segments: TrackSegment[]) => void;
    /** Toggle visibility of the fitted-arc fan debug overlay. */
    setArcFanVisible: (visible: boolean) => void;
    /** Current visibility of the fitted-arc fan overlay. */
    arcFanVisible: () => boolean;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Loads (or receives) track data, builds the dynamics world, and wires Pixi
 * graphics + ticker with centripetal-force horse control.
 *
 * @param components - Result of `baseInitApp`
 * @param preloadedSegments - Optional pre-parsed segments (skips fetch)
 * @returns Handle with cleanup and track-reload functions
 */
export async function attachHorseRacingSim(
    components: BaseAppComponents,
    preloadedSegments?: TrackSegment[],
): Promise<HorseRacingSimHandle> {
    const { app, cleanups } = components;
    const stage = app.stage;

    let segments: TrackSegment[];
    if (preloadedSegments) {
        segments = preloadedSegments;
    } else {
        const res = await fetch(DEFAULT_TRACK_URL);
        if (!res.ok) {
            throw new Error(`Failed to load ${DEFAULT_TRACK_URL}: ${res.status}`);
        }
        segments = parseTrackJson(await res.json());
    }

    // Mutable sim state — replaced on reload
    let sim = buildSim(stage, segments);

    // Key listeners
    const keys = createKeyState();
    const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key in keys) (keys as Record<string, boolean>)[e.key] = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
        if (e.key in keys) (keys as Record<string, boolean>)[e.key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Track stage scale so we can mark pixelLine graphics dirty on change
    let prevScale = stage.localTransform.a;

    // Ticker
    const onTick = (): void => {
        // When zoom changes, pixelLine graphics need their context marked dirty
        // so PixiJS rebuilds vertex data with the updated scale.
        const curScale = stage.localTransform.a;
        if (curScale !== prevScale) {
            prevScale = curScale;
            sim.trackGfx.context.dirty = true;
            sim.debugGfx.context.dirty = true;
            sim.arcFanGfx.context.dirty = true;
        }

        const engine = sim.engine;
        const horseCount = engine.horseIds.length;

        // Map keyboard → actions
        const actions: HorseAction[] = [];
        for (let i = 0; i < horseCount; i++) {
            if (i === PLAYER_INDEX) {
                let extraTangential = 0;
                let extraNormal = 0;
                if (keys.ArrowUp) extraTangential = PLAYER_TANGENTIAL;
                if (keys.ArrowDown) extraTangential = -PLAYER_TANGENTIAL;
                if (keys.ArrowLeft) extraNormal = -PLAYER_NORMAL;
                if (keys.ArrowRight) extraNormal = PLAYER_NORMAL;
                actions.push({ extraTangential, extraNormal });
            } else {
                actions.push({ extraTangential: 0, extraNormal: 0 });
            }
        }

        // Step simulation
        engine.step(actions);

        // Update graphics from engine state
        const positions = engine.getHorsePositions();
        const orientations = engine.getHorseOrientations();
        for (let i = 0; i < horseCount; i++) {
            const id = engine.horseIds[i];
            const gr = sim.horseGfx.get(id);
            if (gr) {
                gr.position.set(positions[i].x, positions[i].y);
                gr.rotation = orientations[i];
            }
        }

        // --- Debug: racing line trail + target arc overlay ---
        if (DEBUG_TRAIL) {
            sim.trailCounter += 1;

            // Dot trail (sampled)
            if (sim.trailCounter % TRAIL_DOT_INTERVAL === 0) {
                for (let i = 0; i < horseCount; i++) {
                    sim.trailGfx
                        .circle(positions[i].x, positions[i].y, TRAIL_DOT_RADIUS)
                        .fill({ color: HORSE_COLORS[i % HORSE_COLORS.length], alpha: 0.7 });
                }
            }

            // Target arc (redrawn each frame so it tracks the current segment)
            sim.targetArcGfx.clear();
            for (let i = 0; i < horseCount; i++) {
                const nav = engine.navigators[i];
                const seg = nav.segment;
                if (seg.tracktype !== 'CURVE') continue;
                const tR = nav.targetRadius;
                if (!isFinite(tR)) continue;

                const center: Point = { x: seg.center.x, y: seg.center.y };
                const startA = Math.atan2(
                    seg.startPoint.y - seg.center.y,
                    seg.startPoint.x - seg.center.x,
                );
                const span = seg.angleSpan;
                const steps = Math.max(
                    Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
                    4,
                );
                const pts = arcPoints(center, tR, startA, span, steps);
                sim.targetArcGfx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) {
                    sim.targetArcGfx.lineTo(pts[j].x, pts[j].y);
                }
                sim.targetArcGfx.stroke({
                    width: 1,
                    color: HORSE_COLORS[i % HORSE_COLORS.length],
                    alpha: 0.5,
                });
            }
        }
    };

    app.ticker.add(onTick);

    // Cleanup helper
    const teardownSim = (): void => {
        sim.teardown();
    };

    const cleanup = (): void => {
        app.ticker.remove(onTick);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        teardownSim();
    };

    const reloadTrack = (newSegments: TrackSegment[]): void => {
        app.ticker.remove(onTick);
        teardownSim();
        sim = buildSim(stage, newSegments);
        app.ticker.add(onTick);
    };

    const setArcFanVisible = (visible: boolean): void => {
        sim.arcFanGfx.visible = visible;
    };

    const arcFanVisible = (): boolean => sim.arcFanGfx.visible;

    cleanups.push(cleanup);

    return { cleanup, reloadTrack, setArcFanVisible, arcFanVisible };
}

// ---------------------------------------------------------------------------
// Track drawing
// ---------------------------------------------------------------------------

/**
 * Draws the track surface, rail lines, and dashed centerline into a
 * Pixi Graphics object.
 */
function drawTrack(g: Graphics, segments: TrackSegment[]): void {
    const hw = TRACK_HALF_WIDTH;

    // --- Pass 1: track surface (brown fill) ---
    g.beginPath();
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightSurface(g, seg, hw);
        } else {
            drawCurveSurface(g, seg, hw);
        }
    }
    g.fill({ color: TRACK_SURFACE_COLOR });

    // --- Pass 2: inner + outer rail lines ---
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightRails(g, seg, hw);
        } else {
            drawCurveRails(g, seg, hw);
        }
    }

    // --- Pass 3: dashed centerline ---
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightCenterline(g, seg);
        } else {
            drawCurveCenterline(g, seg);
        }
    }
}

// ---- Straight helpers ----

function straightOffsetLine(
    seg: StraightSegment,
    offset: number,
): { start: Point; end: Point } {
    const s: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const e: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const fwd = PointCal.unitVector(PointCal.subVector(e, s));
    const outward = PointCal.rotatePoint(fwd, -Math.PI / 2);
    const off = PointCal.multiplyVectorByScalar(outward, offset);
    return {
        start: PointCal.addVector(s, off),
        end: PointCal.addVector(e, off),
    };
}

function drawStraightSurface(
    g: Graphics,
    seg: StraightSegment,
    hw: number,
): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.start.x, outer.start.y);
    g.lineTo(outer.end.x, outer.end.y);
    g.lineTo(inner.end.x, inner.end.y);
    g.lineTo(inner.start.x, inner.start.y);
    g.closePath();
}

function drawStraightRails(
    g: Graphics,
    seg: StraightSegment,
    hw: number,
): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.start.x, outer.start.y);
    g.lineTo(outer.end.x, outer.end.y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
    g.moveTo(inner.start.x, inner.start.y);
    g.lineTo(inner.end.x, inner.end.y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawStraightCenterline(g: Graphics, seg: StraightSegment): void {
    const s: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const e: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const ab = PointCal.subVector(e, s);
    const len = PointCal.magnitude(ab);
    const fwd = PointCal.unitVector(ab);
    let d = 0;
    let drawing = true;
    while (d < len) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, len - d);
        const p0 = PointCal.addVector(s, PointCal.multiplyVectorByScalar(fwd, d));
        const p1 = PointCal.addVector(s, PointCal.multiplyVectorByScalar(fwd, d + segLen));
        if (drawing) {
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---- Curve helpers ----

function arcPoints(
    center: Point,
    radius: number,
    startAngle: number,
    span: number,
    steps: number,
): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + (span * i) / steps;
        pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
    }
    return pts;
}

function curveStartAngle(seg: CurveSegment): number {
    const dx = seg.startPoint.x - seg.center.x;
    const dy = seg.startPoint.y - seg.center.y;
    return Math.atan2(dy, dx);
}

function drawCurveSurface(g: Graphics, seg: CurveSegment, hw: number): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG), 4);

    const outerPts = arcPoints(center, seg.radius + hw, startA, span, steps);
    const innerPts = arcPoints(center, seg.radius - hw, startA, span, steps);

    // Draw outer arc forward, then inner arc backward to form a closed shape
    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
        g.lineTo(outerPts[i].x, outerPts[i].y);
    }
    for (let i = innerPts.length - 1; i >= 0; i--) {
        g.lineTo(innerPts[i].x, innerPts[i].y);
    }
    g.closePath();
}

function drawCurveRails(g: Graphics, seg: CurveSegment, hw: number): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG), 4);

    const outerPts = arcPoints(center, seg.radius + hw, startA, span, steps);
    const innerPts = arcPoints(center, seg.radius - hw, startA, span, steps);

    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
        g.lineTo(outerPts[i].x, outerPts[i].y);
    }
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });

    g.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) {
        g.lineTo(innerPts[i].x, innerPts[i].y);
    }
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawCurveCenterline(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const arcLen = Math.abs(span) * seg.radius;

    // Walk the arc in dashes
    let d = 0;
    let drawing = true;
    while (d < arcLen) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, arcLen - d);
        if (drawing) {
            const a0 = startA + (span * d) / arcLen;
            const a1 = startA + (span * (d + segLen)) / arcLen;
            const dashSpan = a1 - a0;
            const dashSteps = Math.max(Math.ceil(Math.abs(dashSpan) * (180 / Math.PI)), 2);
            const pts = arcPoints(center, seg.radius, a0, dashSpan, dashSteps);
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].x, pts[i].y);
            }
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---------------------------------------------------------------------------
// Debug overlay: fences, centerline, fitted-arc fans
// ---------------------------------------------------------------------------

const DEBUG_FENCE_HW = TRACK_HALF_WIDTH; // matches physics halfTrackWidth
const DEBUG_FENCE_THICK = 3; // must match DEFAULT_BUILD.railThickness
const DEBUG_FENCE_STEP_DEG = 5;

/**
 * Draws debug overlay showing physics collider boundaries, the track
 * centerline, and the fitted-arc fans (Crescent coverage area).
 */
function drawDebugOverlay(g: Graphics, arcFanG: Graphics, segments: TrackSegment[]): void {
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawDebugStraightFences(g, seg);
            drawDebugStraightCenterline(g, seg);
        } else {
            drawDebugFittedArcFan(arcFanG, seg);
            drawDebugCurveOuterFence(g, seg);
            drawDebugCurveCenterline(g, seg);
            drawDebugCurveInnerRail(g, seg);
        }
    }
}

// ---- Straight fence colliders (inner + outer rail rectangles) ----

function drawDebugStraightFences(g: Graphics, seg: StraightSegment): void {
    const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const ab = PointCal.subVector(end, start);
    const len = PointCal.magnitude(ab);
    const fwd = PointCal.unitVector(ab);
    const outward = PointCal.unitVector(PointCal.rotatePoint(fwd, -Math.PI / 2));
    const mid = PointCal.multiplyVectorByScalar(PointCal.addVector(start, end), 0.5);
    const angle = Math.atan2(fwd.y, fwd.x);
    const hl = len / 2;
    const hw = DEBUG_FENCE_THICK / 2;

    const railOffset = DEBUG_FENCE_HW + DEBUG_FENCE_THICK / 2;
    for (const sign of [1, -1]) {
        const railCenter = PointCal.addVector(
            mid,
            PointCal.multiplyVectorByScalar(outward, sign * railOffset),
        );
        const local: Point[] = [
            { x: hl, y: hw },
            { x: hl, y: -hw },
            { x: -hl, y: -hw },
            { x: -hl, y: hw },
        ];
        const world = local.map((p) => {
            const rot = PointCal.rotatePoint(p, angle);
            return PointCal.addVector(railCenter, rot);
        });
        g.moveTo(world[0].x, world[0].y);
        for (let i = 1; i < world.length; i++) {
            g.lineTo(world[i].x, world[i].y);
        }
        g.closePath();
        g.fill({ color: DEBUG_FENCE_COLOR, alpha: 0.15 });
        g.stroke({ width: 1, color: DEBUG_FENCE_COLOR, alpha: 0.5, pixelLine: true });
    }
}

// ---- Curve outer-fence quad strips ----

function drawDebugCurveOuterFence(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const outerRadius = seg.radius + DEBUG_FENCE_HW;
    const extendedRadius = outerRadius + DEBUG_FENCE_THICK;

    const fromCenterStart = PointCal.subVector(
        { x: seg.startPoint.x, y: seg.startPoint.y },
        center,
    );
    let orientAngle = PointCal.angleFromA2B({ x: 1, y: 0 }, fromCenterStart);
    let span = seg.angleSpan;
    if (span < 0) {
        orientAngle += span;
        span = -span;
    }

    const maxStep = (DEBUG_FENCE_STEP_DEG * Math.PI) / 180;
    const numSteps = Math.max(Math.ceil(span / maxStep), 1);
    const stepAngle = span / numSteps;

    for (let i = 0; i < numSteps; i++) {
        const a0 = orientAngle + stepAngle * i;
        const a1 = orientAngle + stepAngle * (i + 1);

        const p0 = PointCal.addVector(center, PointCal.rotatePoint({ x: outerRadius, y: 0 }, a0));
        const p1 = PointCal.addVector(center, PointCal.rotatePoint({ x: outerRadius, y: 0 }, a1));
        const p2 = PointCal.addVector(center, PointCal.rotatePoint({ x: extendedRadius, y: 0 }, a1));
        const p3 = PointCal.addVector(center, PointCal.rotatePoint({ x: extendedRadius, y: 0 }, a0));

        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.lineTo(p3.x, p3.y);
        g.closePath();
        g.fill({ color: DEBUG_FENCE_COLOR, alpha: 0.15 });
        g.stroke({ width: 1, color: DEBUG_FENCE_COLOR, alpha: 0.5, pixelLine: true });
    }
}

// ---- Curve inner rail (Crescent at nominal radius) ----

function drawDebugCurveInnerRail(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const innerRadius = seg.radius - DEBUG_FENCE_HW;
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(
        Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, innerRadius, startA, span, steps);
    // Draw closed crescent: arc + chord
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.closePath();
    g.fill({ color: 0xff8800, alpha: 0.1 });
    g.stroke({ width: 1, color: 0xff8800, alpha: 0.7, pixelLine: true });
}

// ---- Centerline (solid, for debug contrast) ----

function drawDebugStraightCenterline(g: Graphics, seg: StraightSegment): void {
    g.moveTo(seg.startPoint.x, seg.startPoint.y);
    g.lineTo(seg.endPoint.x, seg.endPoint.y);
    g.stroke({ width: 1.5, color: DEBUG_CENTERLINE_COLOR, alpha: 0.7 });
}

function drawDebugCurveCenterline(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const steps = Math.max(
        Math.ceil(Math.abs(seg.angleSpan) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, seg.radius, startA, seg.angleSpan, steps);
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({ width: 1.5, color: DEBUG_CENTERLINE_COLOR, alpha: 0.7 });
}

// ---- Fitted-arc fan (Crescent coverage visualised as a fan / wedge) ----

function drawDebugFittedArcFan(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(
        Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, seg.radius, startA, span, steps);

    // Fan: center → arc start → ... arc end → center
    g.moveTo(center.x, center.y);
    g.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.lineTo(center.x, center.y);
    g.closePath();
    g.fill({ color: DEBUG_FAN_COLOR, alpha: 0.08 });
    g.stroke({ width: 1, color: DEBUG_FAN_COLOR, alpha: 0.35 });
}

// ---------------------------------------------------------------------------
// Internal sim builder (creates engine + graphics for a given track)
// ---------------------------------------------------------------------------

type SimState = {
    engine: HorseRacingEngine;
    trackGfx: Graphics;
    horseGfx: Map<string, Graphics>;
    trailGfx: Graphics;
    targetArcGfx: Graphics;
    debugGfx: Graphics;
    arcFanGfx: Graphics;
    trailCounter: number;
    teardown: () => void;
};

function buildSim(
    stage: import('pixi.js').Container,
    segments: TrackSegment[],
): SimState {
    const engine = new HorseRacingEngine(segments);
    const bounds = trackBounds(segments, 120);

    // Turf background
    const turf = new Graphics();
    turf.rect(
        bounds.min.x,
        bounds.min.y,
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
    );
    turf.fill({ color: 0x2d6a3e });
    stage.addChildAt(turf, 0);

    // Track visual
    const trackGfx = new Graphics();
    drawTrack(trackGfx, segments);
    stage.addChild(trackGfx);

    // Debug overlay (fences, centerline) + separate arc-fan layer
    const debugGfx = new Graphics();
    const arcFanGfx = new Graphics();
    if (DEBUG_TRAIL) {
        drawDebugOverlay(debugGfx, arcFanGfx, segments);
    }
    stage.addChild(debugGfx);
    stage.addChild(arcFanGfx);

    // Label
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

    // Horse graphics (bodies are owned by the engine)
    const horseGfx = new Map<string, Graphics>();
    const horseRadius = engine.config.horseRadius;
    const positions = engine.getHorsePositions();

    for (let i = 0; i < engine.horseIds.length; i++) {
        const id = engine.horseIds[i];
        const g = new Graphics();
        g.rect(-horseRadius, -horseRadius * 0.6, horseRadius * 2, horseRadius * 1.2).fill({
            color: HORSE_COLORS[i % HORSE_COLORS.length],
        });
        // Direction indicator line
        g.moveTo(0, 0);
        g.lineTo(horseRadius * 0.8, 0);
        g.stroke({ width: 2, color: 0x000000 });
        g.position.set(positions[i].x, positions[i].y);
        stage.addChild(g);
        horseGfx.set(id, g);
    }

    // Debug trail graphics
    const trailGfx = new Graphics();
    stage.addChild(trailGfx);
    const targetArcGfx = new Graphics();
    stage.addChild(targetArcGfx);

    const teardown = (): void => {
        stage.removeChild(turf);
        turf.destroy();
        stage.removeChild(trackGfx);
        trackGfx.destroy();
        stage.removeChild(debugGfx);
        debugGfx.destroy();
        stage.removeChild(arcFanGfx);
        arcFanGfx.destroy();
        stage.removeChild(label);
        label.destroy();
        stage.removeChild(trailGfx);
        trailGfx.destroy();
        stage.removeChild(targetArcGfx);
        targetArcGfx.destroy();
        for (const g of horseGfx.values()) {
            stage.removeChild(g);
            g.destroy();
        }
        horseGfx.clear();
    };

    return { engine, trackGfx, horseGfx, trailGfx, targetArcGfx, debugGfx, arcFanGfx, trailCounter: 0, teardown };
}
