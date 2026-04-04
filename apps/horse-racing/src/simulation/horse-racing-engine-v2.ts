/**
 * V2 Horse Racing Engine — effort+lane action space with organic movement.
 *
 * Key differences from V1:
 * - Action: effort [-1,1] + lane [-1,1] instead of raw acceleration
 * - Horse model: 8 physical traits (no genome/modifiers/skills)
 * - Movement smoothing: response lag, stride oscillation, fatigue wobble
 * - Stamina: speed-efficiency quadratic drain curve
 * - L/R cornering grip differentiation
 */

import { Polygon, World } from '@ue-too/dynamics';
import { PointCal } from '@ue-too/math';
import type { Point } from '@ue-too/math';

import {
    trackBounds,
    trackStartFrame,
} from './track-from-json';
import { TrackNavigator } from './track-navigator';
import type { TrackSegment } from './track-types';

import type {
    JockeyAction,
    JockeyStyle,
    HorseProfile,
    V2Observation,
} from './ai-jockey-v2';

// ---------------------------------------------------------------------------
// Constants (must match Python core/types.py)
// ---------------------------------------------------------------------------

const PHYS_HZ = 240;
const PHYS_SUBSTEPS = 8;
const NORMAL_DAMP = 0.5;
const HORSE_HALF_LENGTH = 1.25;
const HORSE_HALF_WIDTH = 0.325;
const HORSE_SPACING = 1.0;
const MAX_HORSE_COUNT = 20;
const HALF_TRACK_WIDTH = HORSE_SPACING * MAX_HORSE_COUNT / 2 + HORSE_HALF_WIDTH;
const WALL_RESTITUTION = 0.4;
const GRAVITY = 9.81;

// Movement smoothing
const RESPONSE_TAU = 0.3;
const STRIDE_AMPLITUDE = 0.2;
const STRIDE_FREQUENCY = 2.5;
const FATIGUE_WOBBLE_SCALE = 0.1;

// Stamina
const BASE_DRAIN_RATE = 0.001;
const EXCESS_DRAIN_RATE = 0.003;
const LATERAL_DRAIN_RATE = 0.0005;
const FATIGUE_THRESHOLD = 0.3;
const CRITICAL_THRESHOLD = 0.15;

// Drafting
const DRAFT_DISTANCE = 15.0;
const DRAFT_SPEED_BONUS = 0.08;

// ---------------------------------------------------------------------------
// Per-horse runtime state
// ---------------------------------------------------------------------------

type HorseState = {
    profile: HorseProfile;
    currentStamina: number;
    smoothedForwardForce: number;
    smoothedLateralForce: number;
    jockeyStyle: JockeyStyle;
};

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

export type V2SimConfig = {
    horseCount: number;
};

const DEFAULT_CONFIG: V2SimConfig = {
    horseCount: 4,
};

// ---------------------------------------------------------------------------
// Random horse profile generation
// ---------------------------------------------------------------------------

function randomProfile(rng: () => number): HorseProfile {
    const rand = (lo: number, hi: number) => lo + rng() * (hi - lo);
    return {
        topSpeed: rand(16, 20),
        acceleration: rand(0.5, 1.5),
        staminaPool: rand(60, 150),
        staminaEfficiency: rand(0.7, 1.3),
        corneringGripLeft: rand(0.5, 1.5),
        corneringGripRight: rand(0.5, 1.5),
        weight: rand(430, 550),
        climbingPower: rand(0.5, 1.5),
    };
}

function defaultProfile(): HorseProfile {
    return {
        topSpeed: 18,
        acceleration: 1.0,
        staminaPool: 105,
        staminaEfficiency: 1.0,
        corneringGripLeft: 1.0,
        corneringGripRight: 1.0,
        weight: 490,
        climbingPower: 1.0,
    };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class HorseRacingEngineV2 {
    private readonly _config: V2SimConfig;
    private readonly _segments: TrackSegment[];
    private readonly _halfTrackWidth = HALF_TRACK_WIDTH;

    private _world!: World;
    private _horseIds!: string[];
    private _navigators!: TrackNavigator[];
    private _horseStates!: HorseState[];
    private _simTime = 0;

    constructor(
        segments: TrackSegment[],
        config?: Partial<V2SimConfig>,
        profiles?: HorseProfile[],
        jockeyStyles?: JockeyStyle[],
    ) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._segments = segments;
        this._buildWorld(profiles, jockeyStyles);
    }

    // -- Public getters -------------------------------------------------------

    get segments(): readonly TrackSegment[] { return this._segments; }
    get config(): Readonly<V2SimConfig> { return this._config; }
    get horseIds(): readonly string[] { return this._horseIds; }
    get navigators(): readonly TrackNavigator[] { return this._navigators; }
    get halfTrackWidth(): number { return this._halfTrackWidth; }
    get world(): World { return this._world; }
    get horseStates(): readonly HorseState[] { return this._horseStates; }
    get simTime(): number { return this._simTime; }

    // -- Core API -------------------------------------------------------------

    step(actions: JockeyAction[]): V2Observation[] {
        const { _config: cfg, _world: world, _horseIds: ids, _navigators: navs } = this;
        const map = world.getRigidBodyMap();
        const fixedDt = 1 / PHYS_HZ;
        const substepDt = fixedDt / PHYS_SUBSTEPS;

        // Physics substeps
        for (let s = 0; s < PHYS_SUBSTEPS; s++) {
            // Compute progresses for drafting
            const progresses = ids.map((id, i) => {
                const body = map.get(id);
                return body ? navs[i].computeProgress(body.center) : 0;
            });

            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h || navs[i].completedLap) continue;

                navs[i].updateSegment(h.center);
                const frame = navs[i].getTrackFrame(h.center);
                const state = this._horseStates[i];
                const profile = state.profile;
                const action = actions[i] ?? { effort: 0, lane: 0 };
                const v = h.linearVelocity;

                const tangVel = PointCal.dotProduct(v, frame.tangential);
                const normVel = PointCal.dotProduct(v, frame.normal);

                // 1. Compute target speed from effort
                const efficiencySpeed = profile.topSpeed * 0.75;
                let targetSpeed: number;
                if (action.effort >= 0) {
                    targetSpeed = efficiencySpeed + action.effort * (profile.topSpeed - efficiencySpeed);
                } else {
                    targetSpeed = efficiencySpeed * (1.0 + action.effort * 0.5);
                }

                // Drafting bonus
                const draftBonus = this._computeDraftBonus(i, progresses);
                targetSpeed += draftBonus * profile.topSpeed;

                // 2. Raw forward force
                let rawForward = profile.acceleration * (targetSpeed - tangVel) * profile.weight;

                // 3. Raw lateral force (use L/R grip based on turn direction)
                const turnDir = this._getTurnDirection(frame);
                let grip: number;
                if (turnDir > 0) grip = profile.corneringGripLeft;
                else if (turnDir < 0) grip = profile.corneringGripRight;
                else grip = (profile.corneringGripLeft + profile.corneringGripRight) / 2;
                let rawLateral = action.lane * grip * profile.weight * 0.5;

                // 4. Fatigue scaling
                const staminaRatio = state.currentStamina / profile.staminaPool;
                if (staminaRatio < FATIGUE_THRESHOLD) {
                    let fwdScale: number, latScale: number;
                    if (staminaRatio >= CRITICAL_THRESHOLD) {
                        const t = (staminaRatio - CRITICAL_THRESHOLD) / (FATIGUE_THRESHOLD - CRITICAL_THRESHOLD);
                        fwdScale = 0.4 + 0.6 * t;
                        latScale = 0.5 + 0.5 * t;
                    } else {
                        const t = staminaRatio / CRITICAL_THRESHOLD;
                        fwdScale = 0.2 + 0.2 * t;
                        latScale = 0.3 + 0.2 * t;
                    }
                    rawForward *= fwdScale;
                    rawLateral *= latScale;
                }

                // 5. Response lag (exponential moving average)
                const tau = RESPONSE_TAU / profile.acceleration;
                const alpha = Math.min(1.0, substepDt / tau);
                state.smoothedForwardForce += alpha * (rawForward - state.smoothedForwardForce);
                state.smoothedLateralForce += alpha * (rawLateral - state.smoothedLateralForce);

                // 6. Build total force
                let totalFx = 0, totalFy = 0;

                // Forward force
                totalFx += frame.tangential.x * state.smoothedForwardForce;
                totalFy += frame.tangential.y * state.smoothedForwardForce;

                // Lateral force
                totalFx += frame.normal.x * state.smoothedLateralForce;
                totalFy += frame.normal.y * state.smoothedLateralForce;

                // Stride oscillation
                const stride = STRIDE_AMPLITUDE * Math.sin(2 * Math.PI * STRIDE_FREQUENCY * this._simTime);
                totalFx += frame.tangential.x * stride * profile.weight;
                totalFy += frame.tangential.y * stride * profile.weight;

                // Fatigue wobble
                if (staminaRatio < FATIGUE_THRESHOLD) {
                    const severity = 1.0 - staminaRatio / FATIGUE_THRESHOLD;
                    const wobble = FATIGUE_WOBBLE_SCALE * severity * (
                        Math.sin(1.7 * this._simTime) * 0.6 +
                        Math.sin(3.1 * this._simTime + 0.8) * 0.4
                    );
                    totalFx += frame.normal.x * wobble * profile.weight;
                    totalFy += frame.normal.y * wobble * profile.weight;
                }

                // Centripetal force
                if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-6) {
                    const centripetalAccel = tangVel * tangVel / frame.turnRadius;
                    totalFx -= frame.normal.x * centripetalAccel * profile.weight;
                    totalFy -= frame.normal.y * centripetalAccel * profile.weight;
                }

                // Slope
                if (frame.slope !== 0) {
                    const slopeSin = frame.slope / Math.sqrt(1 + frame.slope * frame.slope);
                    const slopeForce = -profile.weight * GRAVITY * slopeSin / profile.climbingPower;
                    totalFx += frame.tangential.x * slopeForce;
                    totalFy += frame.tangential.y * slopeForce;
                }

                // Lateral damping
                totalFx += frame.normal.x * (-NORMAL_DAMP * normVel * profile.weight);
                totalFy += frame.normal.y * (-NORMAL_DAMP * normVel * profile.weight);

                // Apply force
                if (h.isSleeping) h.setSleeping(false);
                h.applyForce({ x: totalFx, y: totalFy });

                // Orient to face tangential
                (h as unknown as { setOrientationAngle(a: number): void }).setOrientationAngle(
                    Math.atan2(frame.tangential.y, frame.tangential.x),
                );

                // Stamina drain
                const excess = Math.max(0, Math.abs(tangVel) - efficiencySpeed);
                const invEff = 1.0 / profile.staminaEfficiency;
                let drain = BASE_DRAIN_RATE * Math.abs(tangVel) * invEff;
                drain += EXCESS_DRAIN_RATE * excess * excess * invEff;
                drain += LATERAL_DRAIN_RATE * Math.abs(normVel);
                state.currentStamina = Math.max(0, state.currentStamina - drain * substepDt);
            }

            // Step physics world
            world.step(fixedDt);

            // Wall collisions
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h || navs[i].completedLap) continue;
                this._resolveWallCollision(h, navs[i]);
            }

            // Clamp: no reversing
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h || navs[i].completedLap) continue;
                const frame = navs[i].getTrackFrame(h.center);
                const tangVel = PointCal.dotProduct(h.linearVelocity, frame.tangential);
                if (tangVel < 0) {
                    h.linearVelocity = {
                        x: h.linearVelocity.x - tangVel * frame.tangential.x,
                        y: h.linearVelocity.y - tangVel * frame.tangential.y,
                    };
                }
            }
        }

        this._simTime += fixedDt * PHYS_SUBSTEPS;

        // Compute placements
        const progresses = ids.map((id, i) => {
            const body = map.get(id);
            return { i, progress: body ? navs[i].computeProgress(body.center) : 0 };
        });
        const sorted = [...progresses].sort((a, b) => b.progress - a.progress);
        const placements = new Array<number>(ids.length);
        for (let rank = 0; rank < sorted.length; rank++) {
            placements[sorted[rank].i] = rank;
        }

        // Update navigators and build observations
        const observations: V2Observation[] = [];
        for (let i = 0; i < ids.length; i++) {
            const body = map.get(ids[i]);
            if (!body) {
                observations.push(this._emptyObservation(i));
                continue;
            }

            if (!navs[i].completedLap) navs[i].updateSegment(body.center);
            const frame = navs[i].getTrackFrame(body.center);
            const v = body.linearVelocity;
            const state = this._horseStates[i];

            const tangVel = PointCal.dotProduct(v, frame.tangential);
            const normVel = PointCal.dotProduct(v, frame.normal);
            const curvature = frame.turnRadius < 1e6 ? 1 / frame.turnRadius : 0;
            const turnDir = this._getTurnDirection(frame);

            // Displacement
            let displacement: number;
            if (frame.targetRadius < 1e6) {
                displacement = frame.turnRadius - frame.targetRadius;
            } else {
                displacement = 0;
            }

            // Build lookahead (next 3 segments)
            const lookahead: V2Observation['lookahead'] = [];
            for (let s = 0; s < 3; s++) {
                const segIdx = navs[i].segmentIndex + s;
                const seg = segIdx < this._segments.length
                    ? this._segments[segIdx]
                    : this._segments[this._segments.length - 1];
                if (seg.tracktype === 'CURVE') {
                    const segLen = Math.abs(seg.angleSpan) * seg.radius;
                    lookahead.push({
                        curvature: 1 / seg.radius,
                        turnDirection: seg.angleSpan >= 0 ? 1 : -1,
                        length: segLen,
                        slope: seg.slope ?? 0,
                    });
                } else {
                    const dx = seg.endPoint.x - seg.startPoint.x;
                    const dy = seg.endPoint.y - seg.startPoint.y;
                    lookahead.push({
                        curvature: 0,
                        turnDirection: 0,
                        length: Math.sqrt(dx * dx + dy * dy),
                        slope: seg.slope ?? 0,
                    });
                }
            }

            // Build relatives (sorted by proximity)
            const myProgress = navs[i].computeProgress(body.center);
            const relatives: V2Observation['relatives'] = [];
            const others: Array<{ dist: number; tangOff: number; normOff: number; relSpd: number; stamEst: number }> = [];

            for (let j = 0; j < ids.length; j++) {
                if (j === i) continue;
                const other = map.get(ids[j]);
                if (!other) continue;
                const dx = other.center.x - body.center.x;
                const dy = other.center.y - body.center.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const otherProgress = navs[j].computeProgress(other.center);
                const tangOff = (otherProgress - myProgress) * navs[i].trackLength;
                const normOff = dx * frame.normal.x + dy * frame.normal.y;
                const otherFrame = navs[j].getTrackFrame(other.center);
                const otherTangVel = PointCal.dotProduct(other.linearVelocity, otherFrame.tangential);
                const relSpd = otherTangVel - tangVel;
                const stamEst = this._horseStates[j].currentStamina / this._horseStates[j].profile.staminaPool * 0.8 + 0.1;
                others.push({ dist, tangOff, normOff, relSpd, stamEst });
            }
            others.sort((a, b) => a.dist - b.dist);
            for (let k = 0; k < 8 && k < others.length; k++) {
                relatives.push({
                    tangOffset: others[k].tangOff,
                    normOffset: others[k].normOff,
                    relSpeed: others[k].relSpd,
                    staminaEst: others[k].stamEst,
                });
            }

            observations.push({
                speed: tangVel,
                lateralVel: normVel,
                displacement,
                progress: myProgress,
                curvature,
                curvatureDirection: turnDir,
                staminaRatio: state.currentStamina / state.profile.staminaPool,
                profile: state.profile,
                jockeyStyle: state.jockeyStyle,
                placement: placements[i],
                numHorses: ids.length,
                raceElapsed: this._simTime,
                estRaceTime: navs[i].trackLength / 16,
                lookahead,
                relatives,
            });
        }

        return observations;
    }

    getHorsePositions(): Point[] {
        const map = this._world.getRigidBodyMap();
        return this._horseIds.map((id) => {
            const b = map.get(id);
            return b ? { x: b.center.x, y: b.center.y } : { x: 0, y: 0 };
        });
    }

    getHorseOrientations(): number[] {
        const map = this._world.getRigidBodyMap();
        return this._horseIds.map((id) => {
            const b = map.get(id);
            return b ? b.orientationAngle : 0;
        });
    }

    setJockeyStyle(horseIndex: number, style: JockeyStyle): void {
        if (horseIndex >= 0 && horseIndex < this._horseStates.length) {
            this._horseStates[horseIndex].jockeyStyle = { ...style };
        }
    }

    reset(profiles?: HorseProfile[], jockeyStyles?: JockeyStyle[]): void {
        this._simTime = 0;
        this._buildWorld(profiles, jockeyStyles);
    }

    // -- Internals ------------------------------------------------------------

    private _buildWorld(profiles?: HorseProfile[], jockeyStyles?: JockeyStyle[]): void {
        const cfg = this._config;
        const segments = this._segments;

        const bounds = trackBounds(segments, 120);
        const absMaxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) + 300;
        const absMaxY = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 300;

        const world = new World(absMaxX, absMaxY, 'dynamictree');
        world.useLinearCollisionResolution = true;

        const frame = trackStartFrame(segments);
        if (!frame) throw new Error('Track has no segments');

        const horseIds: string[] = [];
        const navigators: TrackNavigator[] = [];
        const horseStates: HorseState[] = [];

        const rng = () => Math.random();
        const innerEdge = -(this._halfTrackWidth - HORSE_SPACING);

        const hl = HORSE_HALF_LENGTH;
        const hw = HORSE_HALF_WIDTH;
        const rectVertices: Point[] = [
            { x: hl, y: hw }, { x: hl, y: -hw },
            { x: -hl, y: -hw }, { x: -hl, y: hw },
        ];

        for (let i = 0; i < cfg.horseCount; i++) {
            const id = `horse-${i}`;
            const lateral = innerEdge + HORSE_SPACING * i;
            const pos = PointCal.addVector(
                frame.origin,
                PointCal.multiplyVectorByScalar(frame.outward, lateral),
            );

            const profile = profiles?.[i] ?? randomProfile(rng);
            const style = jockeyStyles?.[i] ?? { riskTolerance: 0.5, tacticalBias: 0, skillLevel: 1 };

            const nav = new TrackNavigator(segments, 0, this._halfTrackWidth);
            const spawnFrame = nav.getTrackFrame(pos);
            const orientAngle = Math.atan2(spawnFrame.tangential.y, spawnFrame.tangential.x);
            const body = new Polygon(pos, rectVertices, orientAngle, profile.weight, false, false);
            world.addRigidBody(id, body);

            horseIds.push(id);
            navigators.push(nav);
            horseStates.push({
                profile,
                currentStamina: profile.staminaPool,
                smoothedForwardForce: 0,
                smoothedLateralForce: 0,
                jockeyStyle: { ...style },
            });
        }

        this._world = world;
        this._horseIds = horseIds;
        this._navigators = navigators;
        this._horseStates = horseStates;
    }

    private _getTurnDirection(frame: { turnRadius: number; tangential: Point; normal: Point }): number {
        if (frame.turnRadius >= 1e6) return 0;
        // Use cross product of tangential x normal to determine turn direction
        const cross = frame.tangential.x * frame.normal.y - frame.tangential.y * frame.normal.x;
        return cross > 0 ? 1 : -1;
    }

    private _computeDraftBonus(horseIdx: number, progresses: number[]): number {
        const map = this._world.getRigidBodyMap();
        const myBody = map.get(this._horseIds[horseIdx]);
        if (!myBody) return 0;

        for (let j = 0; j < this._horseIds.length; j++) {
            if (j === horseIdx) continue;
            if (progresses[j] <= progresses[horseIdx]) continue;
            const other = map.get(this._horseIds[j]);
            if (!other) continue;
            const dx = other.center.x - myBody.center.x;
            const dy = other.center.y - myBody.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < DRAFT_DISTANCE) {
                return DRAFT_SPEED_BONUS * (1.0 - dist / DRAFT_DISTANCE);
            }
        }
        return 0;
    }

    private _resolveWallCollision(
        h: { center: Point; linearVelocity: Point; isSleeping: boolean; setSleeping(v: boolean): void },
        nav: TrackNavigator,
    ): void {
        const seg = this._segments[nav.segmentIndex];
        const pos = h.center;
        const htw = this._halfTrackWidth;
        const hw = HORSE_HALF_WIDTH;

        let wallNx = 0, wallNy = 0, wallDepth = 0;
        if (seg.tracktype === 'STRAIGHT') {
            const dx = seg.endPoint.x - seg.startPoint.x;
            const dy = seg.endPoint.y - seg.startPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 1e-6) {
                const inv = 1 / len;
                const ox = dy * inv, oy = -dx * inv;
                const thx = pos.x - seg.startPoint.x;
                const thy = pos.y - seg.startPoint.y;
                const lateral = thx * ox + thy * oy;
                const limit = htw - hw;
                if (lateral > limit) { wallNx = -ox; wallNy = -oy; wallDepth = lateral - limit; }
                else if (lateral < -limit) { wallNx = ox; wallNy = oy; wallDepth = -limit - lateral; }
            }
        } else {
            const tx = pos.x - seg.center.x;
            const ty = pos.y - seg.center.y;
            const dist = Math.sqrt(tx * tx + ty * ty);
            if (dist > 1e-6) {
                const inv = 1 / dist;
                const nx = tx * inv, ny = ty * inv;
                const outerLimit = seg.radius + htw - hw;
                const innerLimit = seg.radius - htw + hw;
                if (dist > outerLimit) { wallNx = -nx; wallNy = -ny; wallDepth = dist - outerLimit; }
                else if (innerLimit > 0 && dist < innerLimit) { wallNx = nx; wallNy = ny; wallDepth = innerLimit - dist; }
            }
        }

        if (wallDepth > 0) {
            h.center = { x: pos.x + wallNx * wallDepth, y: pos.y + wallNy * wallDepth };
            const v = h.linearVelocity;
            const vn = v.x * wallNx + v.y * wallNy;
            h.linearVelocity = {
                x: v.x + wallNx * (-(1 + WALL_RESTITUTION) * vn),
                y: v.y + wallNy * (-(1 + WALL_RESTITUTION) * vn),
            };
        }
    }

    private _emptyObservation(index: number): V2Observation {
        const state = this._horseStates[index];
        return {
            speed: 0, lateralVel: 0, displacement: 0, progress: 0,
            curvature: 0, curvatureDirection: 0,
            staminaRatio: state ? state.currentStamina / state.profile.staminaPool : 1,
            profile: state?.profile ?? defaultProfile(),
            jockeyStyle: state?.jockeyStyle ?? { riskTolerance: 0.5, tacticalBias: 0, skillLevel: 1 },
            placement: 0, numHorses: this._horseStates.length,
            raceElapsed: this._simTime, estRaceTime: 100,
            lookahead: [
                { curvature: 0, turnDirection: 0, length: 100, slope: 0 },
                { curvature: 0, turnDirection: 0, length: 100, slope: 0 },
                { curvature: 0, turnDirection: 0, length: 100, slope: 0 },
            ],
            relatives: [],
        };
    }
}
