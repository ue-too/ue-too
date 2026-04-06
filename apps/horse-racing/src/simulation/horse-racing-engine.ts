import { Polygon, World } from '@ue-too/dynamics';
import { PointCal } from '@ue-too/math';
import type { Point } from '@ue-too/math';

import {
    trackBounds,
    trackStartFrame,
} from './track-from-json';
import { TrackNavigator } from './track-navigator';
import type { TrackSegment } from './track-types';

import type { HorseGenome } from './horse-genome';
import { generateDefaultGenome } from './horse-genome';
import type {
    CoreAttributes,
    EffectiveAttributes,
    ActiveModifier,
} from './horse-attributes';
import {
    expressGenome,
    expressModifiers,
    resolveEffectiveAttributes,
    evaluateModifierConditions,
    DEFAULT_CORE_ATTRIBUTES,
} from './horse-attributes';
import type { RaceContext } from './modifiers';
import { MODIFIER_REGISTRY, SKILL_MODIFIER_IDS } from './modifiers';
import { updateStamina, applyExhaustion, corneringForceMargin } from './stamina';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Continuous action input for a single horse.
 *
 * @example
 * ```typescript
 * const action: HorseAction = { extraTangential: 5, extraNormal: -2 };
 * ```
 *
 * @group Simulation
 */
export type HorseAction = {
    /** Extra tangential (forward/backward) acceleration. Range: [-10, 10]. */
    extraTangential: number;
    /** Extra normal (left/right) acceleration. Range: [-5, 5]. */
    extraNormal: number;
};

/**
 * Observation output for a single horse after a simulation step.
 *
 * @group Simulation
 */
export type HorseObservation = {
    // Track-relative state
    /** Speed along the track direction. */
    tangentialVel: number;
    /** Lateral speed (positive = outward). */
    normalVel: number;
    /** Lane offset: turnRadius - targetRadius (0 = on target lane). */
    displacement: number;
    /** Current distance from curve center (Infinity on straights). */
    turnRadius: number;
    /** Target distance from curve center (Infinity on straights). */
    targetRadius: number;
    /** Index of the current track segment. */
    segmentIndex: number;

    // World-space state
    position: Point;
    velocity: Point;
    orientationAngle: number;

    // Track frame vectors
    tangential: Point;
    normal: Point;

    // Attribute state
    /** Current stamina level. */
    currentStamina: number;
    /** Maximum stamina (from base attributes). */
    maxStamina: number;
    /** Post-modifier cruise speed (useful for RL agent). */
    effectiveCruiseSpeed: number;
    /** Post-modifier max speed (useful for RL agent). */
    effectiveMaxSpeed: number;
    /** Cornering force margin: positive = comfortable, negative = draining stamina. */
    corneringMargin: number;
    /** Grade of current segment (rise/run). 0 = flat. */
    slope: number;
    /** Fraction [0, 1] of track completed. */
    trackProgress: number;
    /** Effective pushing power attribute. */
    pushingPower: number;
    /** Effective push resistance attribute. */
    pushResistance: number;
    /** Effective forward acceleration multiplier. */
    forwardAccel: number;
    /** Effective turn acceleration multiplier. */
    turnAccel: number;
    /** Effective cornering grip. */
    corneringGrip: number;
    /** Drain rate multiplier (lower = more efficient). */
    drainRateMult: number;
    /** Normalized placement: 0 = first, 1 = last. */
    placementNorm: number;
    /** Total number of horses in the race. */
    numHorses: number;
    /** Curvature of the next upcoming curve segment (0 if none ahead). */
    nextCurvature: number;
    /** Distance in meters to the next curve segment (0 if already on a curve). */
    distanceToNextCurve: number;
    /** Total track length in meters. */
    trackLength: number;
    /** Set of modifier IDs whose conditions are met this tick. */
    activeModifierIds: Set<string>;
    /** Set of skill IDs active for this jockey (conditioning flags). */
    activeSkillIds?: Set<string>;
};

/**
 * Configuration for the simulation engine. Fields not related to per-horse
 * attributes (which come from genomes).
 *
 * @group Simulation
 */
export type SimConfig = {
    horseCount: number;
    /** Rectangle half-length (nose to center), meters. */
    horseHalfLength: number;
    /** Rectangle half-width (shoulder to center), meters. */
    horseHalfWidth: number;
    horseSpacing: number;
    physHz: number;
    physSubsteps: number;
    normalDamp: number;
    normalSpring: number;
    /** Track surface condition for modifier evaluation. */
    surface: 'dry' | 'wet' | 'heavy';
};

/** @internal */
const DEFAULT_CONFIG: SimConfig = {
    horseCount: 4,
    horseHalfLength: 1.25,  // 2.5 m nose-to-tail
    horseHalfWidth: 0.325,  // 0.65 m shoulder width
    horseSpacing: 1.0,      // 1 m lane spacing
    physHz: 240,
    physSubsteps: 8,
    normalDamp: 0.5,
    normalSpring: 0.8,
    surface: 'dry',
};

// ---------------------------------------------------------------------------
// Per-horse runtime state
// ---------------------------------------------------------------------------

type HorseState = {
    genome: HorseGenome;
    baseAttributes: CoreAttributes;
    activeModifiers: ActiveModifier[];
    currentStamina: number;
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Headless horse-racing simulation engine with no rendering dependencies.
 *
 * @remarks
 * Owns the physics world, horse rigid bodies, track navigators, and per-horse
 * attribute state. Each horse can have a unique genome that determines its
 * performance characteristics.
 *
 * Call {@link step} each tick with per-horse actions to advance the simulation
 * and receive observations.
 *
 * @example
 * ```typescript
 * const engine = new HorseRacingEngine(trackSegments);
 * const zeroActions = engine.horseIds.map(() => ({ extraTangential: 0, extraNormal: 0 }));
 * const observations = engine.step(zeroActions);
 * ```
 *
 * @group Simulation
 */
export class HorseRacingEngine {
    private readonly _config: SimConfig;
    private readonly _segments: TrackSegment[];
    private readonly _halfTrackWidth: number;
    private readonly _genomes: HorseGenome[];

    private _activeSkills: Set<string> = new Set();

    private _world!: World;
    private _horseIds!: string[];
    private _navigators!: TrackNavigator[];
    private _startPositions!: Point[];
    private _horseStates!: HorseState[];

    /**
     * @param segments - Track segments defining the course
     * @param config - Engine configuration overrides
     * @param genomes - Per-horse genomes. If omitted or shorter than
     *   `horseCount`, default genomes are used for missing horses.
     */
    constructor(
        segments: TrackSegment[],
        config?: Partial<SimConfig>,
        genomes?: HorseGenome[],
    ) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._segments = segments;
        // Track wide enough for max 20 horses centered + clearance
        const maxHorseCount = 20;
        this._halfTrackWidth =
            this._config.horseSpacing * maxHorseCount / 2 +
            this._config.horseHalfWidth; // ~10.325 m

        // Resolve genomes
        this._genomes = [];
        for (let i = 0; i < this._config.horseCount; i++) {
            this._genomes.push(genomes?.[i] ?? generateDefaultGenome());
        }

        this._buildWorld();
    }

    /**
     * Set active jockey skills (riding style modifiers) for horse 0.
     * These apply physics effects each tick without changing the horse's base genetics.
     */
    setActiveSkills(skills: Set<string>): void {
        this._activeSkills = skills;
    }

    /** Current active skills. */
    get activeSkills(): ReadonlySet<string> {
        return this._activeSkills;
    }

    // -- Public getters -----------------------------------------------------

    /** The track segments this engine was constructed with. */
    get segments(): readonly TrackSegment[] {
        return this._segments;
    }

    /** Resolved simulation configuration. */
    get config(): Readonly<SimConfig> {
        return this._config;
    }

    /** IDs of horse rigid bodies in the physics world. */
    get horseIds(): readonly string[] {
        return this._horseIds;
    }

    /** Track navigators (one per horse), exposed for debug/rendering. */
    get navigators(): readonly TrackNavigator[] {
        return this._navigators;
    }

    /** Half-width of the track (derived from horse layout). */
    get halfTrackWidth(): number {
        return this._halfTrackWidth;
    }

    /** The underlying physics world (exposed for advanced use / rendering). */
    get world(): World {
        return this._world;
    }

    /** Per-horse runtime state (base attributes, current stamina, etc.). */
    get horseStates(): readonly HorseState[] {
        return this._horseStates;
    }

    // -- Core API -----------------------------------------------------------

    /**
     * Advances the simulation by one tick.
     *
     * @param actions - One {@link HorseAction} per horse. Length must equal
     *   `config.horseCount`.
     * @returns One {@link HorseObservation} per horse after the step.
     */
    step(actions: HorseAction[]): HorseObservation[] {
        const { _config: cfg, _world: world, _horseIds: ids, _navigators: navs } = this;
        const map = world.getRigidBodyMap();
        const fixedDt = 1 / cfg.physHz;

        // Build race context for modifier evaluation
        const raceCtx = this._buildRaceContext();

        // Resolve effective attributes and apply forces per horse
        const effectiveAttrs: EffectiveAttributes[] = [];
        const firedModifiers: Set<string>[] = [];

        // Resolve effective attributes once per tick (expensive)
        const resolvedActions: HorseAction[] = [];
        for (let i = 0; i < ids.length; i++) {
            const h = map.get(ids[i]);
            if (!h) {
                effectiveAttrs.push(DEFAULT_CORE_ATTRIBUTES);
                firedModifiers.push(new Set());
                resolvedActions.push({ extraTangential: 0, extraNormal: 0 });
                continue;
            }

            const state = this._horseStates[i];
            const frame = navs[i].getTrackFrame(h.center);
            const v = h.linearVelocity;
            const tangentialVel = PointCal.dotProduct(v, frame.tangential);

            // Append skill modifiers for horse 0 (jockey riding style)
            let modifiers = state.activeModifiers;
            if (i === 0 && this._activeSkills.size > 0) {
                modifiers = [...state.activeModifiers];
                for (const skillModId of SKILL_MODIFIER_IDS) {
                    const defn = MODIFIER_REGISTRY[skillModId];
                    if (defn && defn.condition(raceCtx, i)) {
                        modifiers.push({ id: skillModId, strength: 1.0 });
                    }
                }
            }

            let eff = resolveEffectiveAttributes(
                state.baseAttributes,
                modifiers,
                raceCtx,
                i,
            );
            // Compute stamina drain BEFORE applying exhaustion (matches Python)
            firedModifiers.push(evaluateModifierConditions(modifiers, raceCtx, i));
            resolvedActions.push(actions[i] ?? { extraTangential: 0, extraNormal: 0 });

            // Update stamina (once per tick, using pre-exhaustion attrs)
            const speed = Math.sqrt(v.x * v.x + v.y * v.y);
            const normalVel = PointCal.dotProduct(v, frame.normal);
            const extraT = resolvedActions[i].extraTangential * eff.forwardAccel;
            const extraN = resolvedActions[i].extraNormal * eff.turnAccel;
            state.currentStamina = updateStamina(
                state.currentStamina,
                eff,
                extraT,
                extraN,
                speed,
                tangentialVel,
                normalVel,
                frame.turnRadius,
            );

            // Apply exhaustion AFTER stamina update (matches Python)
            eff = applyExhaustion(eff, state.currentStamina, state.baseAttributes.stamina);
            effectiveAttrs.push(eff);
        }

        // Precompute collision mass multipliers (push traits scale mass for collision only)
        const collisionMassMultipliers: number[] = [];
        for (let i = 0; i < ids.length; i++) {
            const eff = effectiveAttrs[i];
            collisionMassMultipliers.push((1 + eff.pushingPower) * (1 + eff.pushResistance));
        }

        // Physics substeps — recompute forces each substep so centripetal
        // direction stays accurate and the force isn't lost after step().
        for (let s = 0; s < cfg.physSubsteps; s++) {
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h) continue;
                // Skip force application for horses that have finished
                if (navs[i].completedLap) continue;

                const nav = navs[i];
                // Update segment each substep (matches Python navigator.update())
                nav.updateSegment(h.center);
                const frame = nav.getTrackFrame(h.center);
                const v = h.linearVelocity;
                const eff = effectiveAttrs[i];
                const action = resolvedActions[i];

                const tangentialVel = PointCal.dotProduct(v, frame.tangential);
                const normalVel = PointCal.dotProduct(v, frame.normal);

                // Centripetal: v²/R using actual turn radius (Python reference)
                const centripetal =
                    frame.turnRadius < 1e6
                        ? (tangentialVel * tangentialVel) / frame.turnRadius
                        : 0;

                // Auto-cruise toward cruise speed, fading out when jockey opposes it
                const speedChange = eff.cruiseSpeed - tangentialVel;
                const extraTangential = action.extraTangential * eff.forwardAccel;
                const BLEND_THRESHOLD = 1.0;
                const cruiseWeight = (speedChange * extraTangential < 0)
                    ? Math.max(0.0, 1.0 - Math.abs(extraTangential) / BLEND_THRESHOLD)
                    : 1.0;
                let tangentialAccel = cruiseWeight * speedChange + extraTangential;
                if (tangentialVel >= eff.maxSpeed && tangentialAccel > 0) {
                    tangentialAccel = 0;
                }
                if (tangentialVel <= 0 && tangentialAccel < 0) {
                    tangentialAccel = 0;
                }

                // Slope gravity: uphill decelerates, downhill accelerates
                const slopeGrade = frame.slope;
                if (slopeGrade !== 0) {
                    const slopeAngle = Math.atan(slopeGrade);
                    tangentialAccel += -9.81 * Math.sin(slopeAngle);
                }

                const normalAccel =
                    -centripetal
                    - normalVel * cfg.normalDamp
                    + action.extraNormal * eff.turnAccel;

                const totalAccel = PointCal.addVector(
                    PointCal.multiplyVectorByScalar(frame.tangential, tangentialAccel),
                    PointCal.multiplyVectorByScalar(frame.normal, normalAccel),
                );
                const totalForce = PointCal.multiplyVectorByScalar(totalAccel, eff.weight);
                // Wake body if sleeping so forces take effect (a stopped horse
                // can be put to sleep by the physics engine's sleeping system)
                if (h.isSleeping) h.setSleeping(false);
                h.applyForce(totalForce);

                // Auto-orient to face tangential direction
                (h as unknown as { setOrientationAngle(a: number): void }).setOrientationAngle(
                    Math.atan2(frame.tangential.y, frame.tangential.x),
                );
            }

            // Swap to collision masses before world.step (collision uses body._mass).
            // Scale force proportionally so integration (force/_mass * dt) still
            // produces the same acceleration as with the base weight.
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h) continue;
                const mult = collisionMassMultipliers[i];
                (h as unknown as { _mass: number })._mass = effectiveAttrs[i].weight * mult;
                // Scale force by same multiplier so accel = force/(weight*mult) = originalForce/weight
                h.force = PointCal.multiplyVectorByScalar(h.force, mult);
            }

            world.step(fixedDt);

            // Restore base weight for next substep's force calculation
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h) continue;
                (h as unknown as { _mass: number })._mass = effectiveAttrs[i].weight;
            }

            // Analytical wall collision (matches Python resolve_wall_collisions)
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h) continue;
                if (navs[i].completedLap) continue;
                const seg = this._segments[navs[i].segmentIndex];
                const pos = h.center;
                const hw = cfg.horseHalfWidth;
                const htw = this._halfTrackWidth;

                let wallNx = 0, wallNy = 0, wallDepth = 0;
                if (seg.tracktype === 'STRAIGHT') {
                    const dx = seg.endPoint.x - seg.startPoint.x;
                    const dy = seg.endPoint.y - seg.startPoint.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 1e-6) {
                        const inv = 1 / len;
                        const ox = dy * inv, oy = -dx * inv; // outward
                        const thx = pos.x - seg.startPoint.x;
                        const thy = pos.y - seg.startPoint.y;
                        const lateral = thx * ox + thy * oy;
                        const limit = htw - hw;
                        if (lateral > limit) {
                            wallNx = -ox; wallNy = -oy;
                            wallDepth = lateral - limit;
                        } else if (lateral < -limit) {
                            wallNx = ox; wallNy = oy;
                            wallDepth = -limit - lateral;
                        }
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
                        if (dist > outerLimit) {
                            wallNx = -nx; wallNy = -ny;
                            wallDepth = dist - outerLimit;
                        } else if (innerLimit > 0 && dist < innerLimit) {
                            wallNx = nx; wallNy = ny;
                            wallDepth = innerLimit - dist;
                        }
                    }
                }

                if (wallDepth > 0) {
                    // Position correction
                    h.center = {
                        x: pos.x + wallNx * wallDepth,
                        y: pos.y + wallNy * wallDepth,
                    };
                    // Velocity impulse with restitution 0.4
                    const v = h.linearVelocity;
                    const vn = v.x * wallNx + v.y * wallNy;
                    h.linearVelocity = {
                        x: v.x + wallNx * (-(1 + 0.4) * vn),
                        y: v.y + wallNy * (-(1 + 0.4) * vn),
                    };
                }
            }

            // Clamp: horses cannot reverse
            for (let i = 0; i < ids.length; i++) {
                const h = map.get(ids[i]);
                if (!h || navs[i].completedLap) continue;
                const frame = navs[i].getTrackFrame(h.center);
                const v = h.linearVelocity;
                const tangVel = PointCal.dotProduct(v, frame.tangential);
                if (tangVel < 0) {
                    h.linearVelocity = {
                        x: v.x - tangVel * frame.tangential.x,
                        y: v.y - tangVel * frame.tangential.y,
                    };
                }
            }
        }

        // Compute placements by track progress (higher = better rank)
        const progresses = ids.map((id, i) => {
            const body = map.get(id);
            return { i, progress: body ? navs[i].computeProgress(body.center) : 0 };
        });
        const sorted = [...progresses].sort((a, b) => b.progress - a.progress);
        const placements = new Array<number>(ids.length);
        for (let rank = 0; rank < sorted.length; rank++) {
            placements[sorted[rank].i] = rank + 1;
        }
        const numHorses = ids.length;

        // Update navigators and build observations
        const totalSegments = this._segments.length;
        const observations: HorseObservation[] = [];
        for (let i = 0; i < ids.length; i++) {
            const body = map.get(ids[i]);
            if (!body) {
                observations.push(this._emptyObservation(i));
                continue;
            }

            if (!navs[i].completedLap) navs[i].updateSegment(body.center);
            const frame = navs[i].getTrackFrame(body.center);

            const v = body.linearVelocity;

            const tangentialVel = PointCal.dotProduct(v, frame.tangential);
            const normalVel = PointCal.dotProduct(v, frame.normal);
            let displacement: number;
            if (frame.targetRadius < 1e6) {
                displacement = frame.turnRadius - frame.targetRadius;
            } else {
                const outward = navs[i].getOutwardNormal(navs[i].segmentIndex);
                if (outward) {
                    const seg = this._segments[navs[i].segmentIndex];
                    const dx = body.center.x - seg.startPoint.x;
                    const dy = body.center.y - seg.startPoint.y;
                    displacement = dx * outward.x + dy * outward.y;
                } else {
                    displacement = 0;
                }
            }

            const eff = effectiveAttrs[i];
            const state = this._horseStates[i];

            observations.push({
                tangentialVel,
                normalVel,
                displacement,
                turnRadius: frame.turnRadius,
                targetRadius: frame.targetRadius,
                segmentIndex: navs[i].segmentIndex,
                position: { x: body.center.x, y: body.center.y },
                velocity: { x: v.x, y: v.y },
                orientationAngle: body.orientationAngle,
                tangential: { x: frame.tangential.x, y: frame.tangential.y },
                normal: { x: frame.normal.x, y: frame.normal.y },
                currentStamina: state.currentStamina,
                maxStamina: state.baseAttributes.stamina,
                effectiveCruiseSpeed: eff.cruiseSpeed,
                effectiveMaxSpeed: eff.maxSpeed,
                corneringMargin: corneringForceMargin(
                    eff.corneringGrip,
                    tangentialVel,
                    frame.turnRadius,
                ),
                slope: frame.slope,
                trackProgress: navs[i].computeProgress(body.center),
                pushingPower: eff.pushingPower,
                pushResistance: eff.pushResistance,
                forwardAccel: eff.forwardAccel,
                turnAccel: eff.turnAccel,
                corneringGrip: eff.corneringGrip,
                drainRateMult: eff.drainRateMult,
                placementNorm: (placements[i] - 1) / Math.max(numHorses - 1, 1),
                numHorses,
                ...this._computeNextCurvature(navs[i].segmentIndex),
                trackLength: navs[i].totalLength,
                activeModifierIds: firedModifiers[i] ?? new Set(),
                activeSkillIds: i === 0 ? new Set(this._activeSkills) : undefined,
            });
        }

        return observations;
    }

    /**
     * Returns current positions of all horses.
     */
    getHorsePositions(): Point[] {
        const map = this._world.getRigidBodyMap();
        return this._horseIds.map((id) => {
            const b = map.get(id);
            return b ? { x: b.center.x, y: b.center.y } : { x: 0, y: 0 };
        });
    }

    /**
     * Returns current orientation angles of all horses.
     */
    getHorseOrientations(): number[] {
        const map = this._world.getRigidBodyMap();
        return this._horseIds.map((id) => {
            const b = map.get(id);
            return b ? b.orientationAngle : 0;
        });
    }

    /**
     * Resets all horses to their starting positions with zero velocity.
     * Rebuilds the physics world from scratch. Stamina is restored to full.
     */
    reset(): void {
        this._buildWorld();
    }

    // -- Internals ----------------------------------------------------------

    private _buildWorld(): void {
        const cfg = this._config;
        const segments = this._segments;

        const bounds = trackBounds(segments, 120);
        const absMaxX =
            Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) + 300;
        const absMaxY =
            Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 300;

        const world = new World(absMaxX, absMaxY, 'dynamictree');
        world.useLinearCollisionResolution = true;
        // Wall collision is handled analytically (matching Python) instead of
        // via static rail bodies, which caused cross-segment interference.

        const frame = trackStartFrame(segments);
        if (!frame) {
            throw new Error('Track has no segments');
        }

        const horseIds: string[] = [];
        const navigators: TrackNavigator[] = [];
        const startPositions: Point[] = [];
        const horseStates: HorseState[] = [];

        // Spawn horses from the inner rail outward.
        // outward points toward the outer rail, so the innermost
        // position is at the most negative lateral offset.
        const innerEdge = -(this._halfTrackWidth - cfg.horseSpacing);

        // Rectangle vertices in local coordinates (horse-shaped)
        const hl = cfg.horseHalfLength;
        const hw = cfg.horseHalfWidth;
        const rectVertices: Point[] = [
            { x: hl, y: hw },
            { x: hl, y: -hw },
            { x: -hl, y: -hw },
            { x: -hl, y: hw },
        ];

        for (let i = 0; i < cfg.horseCount; i++) {
            const id = `horse-${i}`;
            const lateral = innerEdge + cfg.horseSpacing * i;
            const pos = PointCal.addVector(
                frame.origin,
                PointCal.multiplyVectorByScalar(frame.outward, lateral),
            );

            const genome = this._genomes[i];
            const baseAttributes = expressGenome(genome);
            const activeModifiers = expressModifiers(genome);

            const nav = new TrackNavigator(segments, 0, this._halfTrackWidth);
            // Orient each horse along the track tangent at its spawn position
            const spawnFrame = nav.getTrackFrame(pos);
            const orientAngle = Math.atan2(spawnFrame.tangential.y, spawnFrame.tangential.x);
            const body = new Polygon(pos, rectVertices, orientAngle, baseAttributes.weight, false, false);
            world.addRigidBody(id, body);
            horseIds.push(id);
            startPositions.push({ x: pos.x, y: pos.y });
            navigators.push(nav);

            horseStates.push({
                genome,
                baseAttributes,
                activeModifiers,
                currentStamina: baseAttributes.stamina, // start fully rested
            });
        }

        this._world = world;
        this._horseIds = horseIds;
        this._navigators = navigators;
        this._startPositions = startPositions;
        this._horseStates = horseStates;
    }

    private _buildRaceContext(): RaceContext {
        const map = this._world.getRigidBodyMap();
        const ids = this._horseIds;
        const navs = this._navigators;
        const states = this._horseStates;
        const totalSegments = this._segments.length;

        const positions: Point[] = [];
        const velocities: Point[] = [];
        const staminaLevels: number[] = [];
        const maxStamina: number[] = [];
        const trackProgress: number[] = [];
        const segmentTypes: ('STRAIGHT' | 'CURVE')[] = [];

        for (let i = 0; i < ids.length; i++) {
            const body = map.get(ids[i]);
            positions.push(body ? { x: body.center.x, y: body.center.y } : { x: 0, y: 0 });
            velocities.push(body ? { x: body.linearVelocity.x, y: body.linearVelocity.y } : { x: 0, y: 0 });
            staminaLevels.push(states[i].currentStamina);
            maxStamina.push(states[i].baseAttributes.stamina);
            trackProgress.push(body ? navs[i].computeProgress(body.center) : 0);
            segmentTypes.push(navs[i].segment.tracktype);
        }

        // Compute rankings by track progress (higher progress = better rank)
        const indexed = trackProgress.map((p, i) => ({ p, i }));
        indexed.sort((a, b) => b.p - a.p);
        const rankings = new Array<number>(ids.length);
        for (let rank = 0; rank < indexed.length; rank++) {
            rankings[indexed[rank].i] = rank + 1;
        }

        return {
            positions,
            velocities,
            staminaLevels,
            maxStamina,
            trackProgress,
            segmentTypes,
            rankings,
            totalHorses: ids.length,
            surface: this._config.surface,
            activeSkills: this._activeSkills,
        };
    }

    private _emptyObservation(index: number): HorseObservation {
        const state = this._horseStates[index];
        return {
            tangentialVel: 0,
            normalVel: 0,
            displacement: 0,
            turnRadius: Infinity,
            targetRadius: Infinity,
            segmentIndex: 0,
            position: this._startPositions[index] ?? { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            orientationAngle: 0,
            tangential: { x: 1, y: 0 },
            normal: { x: 0, y: -1 },
            currentStamina: state?.currentStamina ?? 100,
            maxStamina: state?.baseAttributes.stamina ?? 100,
            effectiveCruiseSpeed: state?.baseAttributes.cruiseSpeed ?? 14.25,
            effectiveMaxSpeed: state?.baseAttributes.maxSpeed ?? 18,
            corneringMargin: Infinity,
            slope: 0,
            trackProgress: 0,
            pushingPower: state?.baseAttributes.pushingPower ?? 0.5,
            pushResistance: state?.baseAttributes.pushResistance ?? 0.5,
            forwardAccel: state?.baseAttributes.forwardAccel ?? 1.0,
            turnAccel: state?.baseAttributes.turnAccel ?? 1.0,
            corneringGrip: state?.baseAttributes.corneringGrip ?? 1.0,
            drainRateMult: state?.baseAttributes.drainRateMult ?? 1.0,
            placementNorm: 0,
            numHorses: this._horseStates.length,
            nextCurvature: 0,
            distanceToNextCurve: 0,
            trackLength: 900,
            activeModifierIds: new Set(),
            activeSkillIds: index === 0 ? new Set(this._activeSkills) : undefined,
        };
    }

    private _computeNextCurvature(segmentIndex: number): { nextCurvature: number; distanceToNextCurve: number } {
        let accDist = 0;
        for (let k = 1; k <= 5; k++) {
            const idx = segmentIndex + k;
            if (idx >= this._segments.length) break;
            const seg = this._segments[idx];
            if (seg.tracktype === 'CURVE') {
                const sign = seg.angleSpan >= 0 ? 1.0 : -1.0;
                return { nextCurvature: sign / seg.radius, distanceToNextCurve: accDist };
            }
            const dx = seg.endPoint.x - seg.startPoint.x;
            const dy = seg.endPoint.y - seg.startPoint.y;
            accDist += Math.hypot(dx, dy);
        }
        return { nextCurvature: 0, distanceToNextCurve: 0 };
    }
}
