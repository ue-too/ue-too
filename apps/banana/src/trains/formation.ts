import { Point, approximately } from '@ue-too/curve';

import { SegmentSplitInfo, TrackGraph } from './tracks/track';
import {
    JointDirectionManager,
    WalkBackJointDirectionManager,
    flipDirection,
} from './input-state-machine/train-kmt-state-machine';
import { Car, TrainUnit, generateCarId, generateFormationId } from './cars';

// export type Car = {
//     id: number;
//     position: {
//         trackNumber: number;
//         tVal: number;
//         extendPositionOnTrack: 'positive' | 'negative';
//     };
//     bogieOffsets: number[];
// };

export const MAX_FORMATION_DEPTH = 3;

/**
 * If `units` has more than one element, wrap them in a new Formation
 * inheriting the depth of `original`. Otherwise return as-is.
 */
function wrapIfMultiple(units: TrainUnit[], original: Formation): TrainUnit[] {
    if (units.length <= 1) return units;
    return [new Formation(generateFormationId(), units, original.depth)];
}

/**
 * Composite node in the train unit hierarchy.
 * A Formation holds an ordered list of TrainUnit children (Cars or nested Formations).
 * Position is always determined from the head (first child) outward.
 */
export class Formation implements TrainUnit {

    readonly id: string;
    private _name: string;
    private _children: TrainUnit[];
    /** Stable insertion-order list for UI display. Not affected by switchDirection. */
    private _originalChildren: TrainUnit[];
    private _flipped: boolean = false;
    private _depth: number;

    private _bogieOffsetsCache: number[] | null = null;
    private _flatCarsCache: readonly Car[] | null = null;
    private _flatCarsWithPathCache: readonly { car: Car; path: string[] }[] | null = null;

    constructor(id: string, children: TrainUnit[], depth: number = 1) {
        if (depth > MAX_FORMATION_DEPTH) {
            throw new Error(`Formation nesting depth exceeds maximum of ${MAX_FORMATION_DEPTH}`);
        }
        if (children.length === 0) {
            throw new Error('Formation must have at least one child');
        }
        this.id = id;
        this._name = id;
        this._children = children;
        this._originalChildren = [...children];
        this._depth = depth;
    }

    /** Display name for UI. Defaults to the formation id. */
    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get edgeToBogie(): number {
        return this._children[0].edgeToBogie;
    }

    get bogieToEdge(): number {
        return this._children[this._children.length - 1].bogieToEdge;
    }

    get headCouplerLength(): number {
        return this._children[0].headCouplerLength;
    }

    get tailCouplerLength(): number {
        return this._children[this._children.length - 1].tailCouplerLength;
    }

    get flipped(): boolean {
        return this._flipped;
    }

    get depth(): number {
        return this._depth;
    }

    /** Operational children order (affected by switchDirection). */
    get children(): readonly TrainUnit[] {
        return this._children;
    }

    /** Stable insertion-order children list for UI display. Not affected by switchDirection. */
    get originalChildren(): readonly TrainUnit[] {
        return this._originalChildren;
    }

    /**
     * Returns the inter-bogie distances for the entire formation.
     * The first element is the leading edgeToBogie of the first child.
     * Subsequent elements alternate between intra-child bogie offsets
     * and inter-child gaps (prevChild.bogieToEdge + nextChild.edgeToBogie).
     */
    bogieOffsets(): number[] {
        if (this._bogieOffsetsCache !== null) return this._bogieOffsetsCache;
        const res: number[] = [];
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            const childOffsets = child.bogieOffsets();
            // A Formation child's bogieOffsets() already starts with its edgeToBogie,
            // so we must avoid double-counting it.
            const isNestedFormation = child.depth > 0;

            if (i === 0) {
                if (isNestedFormation) {
                    // Formation child: bogieOffsets already starts with edgeToBogie
                    for (const offset of childOffsets) {
                        res.push(offset);
                    }
                } else {
                    // Car child: manually prepend edgeToBogie
                    res.push(child.edgeToBogie);
                    for (const offset of childOffsets) {
                        res.push(offset);
                    }
                }
            } else {
                const prevChild = this._children[i - 1];
                if (isNestedFormation) {
                    // Formation child: gap from prev's last bogie to this child's edge,
                    // then skip first childOffset (edgeToBogie, folded into the gap)
                    res.push(prevChild.bogieToEdge + child.edgeToBogie);
                    for (let j = 1; j < childOffsets.length; j++) {
                        res.push(childOffsets[j]);
                    }
                } else {
                    // Car child: gap + all bogie offsets
                    res.push(prevChild.bogieToEdge + child.edgeToBogie);
                    for (const offset of childOffsets) {
                        res.push(offset);
                    }
                }
            }
        }
        this._bogieOffsetsCache = res;
        return res;
    }

    flatCars(): readonly Car[] {
        if (this._flatCarsCache !== null) return this._flatCarsCache;
        const result: Car[] = [];
        for (const child of this._children) {
            for (const car of child.flatCars()) {
                result.push(car);
            }
        }
        this._flatCarsCache = result;
        return result;
    }

    _flatCars(): readonly { car: Car, path: string[] }[] {
        if (this._flatCarsWithPathCache !== null) return this._flatCarsWithPathCache;
        const result: { car: Car, path: string[] }[] = [];
        for (const child of this._children) {
            for (const entry of child._flatCars()) {
                result.push({ car: entry.car, path: [...entry.path, this.id] });
            }
        }
        this._flatCarsWithPathCache = result;
        return result;
    }

    switchDirection(): void {
        this._children.reverse();
        for (const child of this._children) {
            child.switchDirection();
        }
        this._flipped = !this._flipped;
        this._invalidateCache();
    }

    /** Flip the direction of each direct child without changing their order. */
    flipChildrenDirection(): void {
        for (const child of this._children) {
            child.switchDirection();
        }
        this._invalidateCache();
    }

    /** Reverse the order of direct children in both operational and original lists. */
    reverseChildren(): void {
        this._children.reverse();
        this._originalChildren.reverse();
        this._invalidateCache();
    }

    /** Couple a unit to the tail of this formation. */
    append(unit: TrainUnit): void {
        this._validateDepth(unit);
        this._children.push(unit);
        this._originalChildren.push(unit);
        this._invalidateCache();
    }

    /** Couple a unit to the head of this formation. */
    prepend(unit: TrainUnit): void {
        this._validateDepth(unit);
        this._children.unshift(unit);
        this._originalChildren.unshift(unit);
        this._invalidateCache();
    }

    /**
     * Check whether decoupling would break any child formations.
     *
     * The split produces a head portion [0..headCarIndex] and a tail portion
     * [tailCarIndex..end]. Any child formation that has cars on both sides of
     * a split point would be broken.
     *
     * @param headCarIndex - Index of the last car in the head portion.
     * @param tailCarIndex - Index of the first car in the tail portion.
     * @returns An object indicating whether child formations would break, and if so which ones.
     */
    wouldBreakFormations(headCarIndex: number, tailCarIndex: number): { breaks: false } | { breaks: true; formationIds: string[] } {
        const cars = this._flatCars();
        if (headCarIndex < 0 || headCarIndex >= cars.length) {
            throw new Error(`headCarIndex ${headCarIndex} out of bounds for formation with ${cars.length} cars`);
        }
        if (tailCarIndex < 0 || tailCarIndex >= cars.length) {
            throw new Error(`tailCarIndex ${tailCarIndex} out of bounds for formation with ${cars.length} cars`);
        }
        if (headCarIndex >= tailCarIndex) {
            throw new Error(`headCarIndex (${headCarIndex}) must be less than tailCarIndex (${tailCarIndex})`);
        }
        const broken = new Set<string>();

        // Check the head split: between car[headCarIndex] and car[headCarIndex + 1]
        const headLeftPath = new Set(cars[headCarIndex].path);
        for (const id of cars[headCarIndex + 1].path) {
            if (id !== this.id && headLeftPath.has(id)) {
                broken.add(id);
            }
        }

        // Check the tail split: between car[tailCarIndex - 1] and car[tailCarIndex]
        if (tailCarIndex - 1 > headCarIndex) {
            const tailLeftPath = new Set(cars[tailCarIndex - 1].path);
            for (const id of cars[tailCarIndex].path) {
                if (id !== this.id && tailLeftPath.has(id)) {
                    broken.add(id);
                }
            }
        }

        return broken.size === 0
            ? { breaks: false }
            : { breaks: true, formationIds: [...broken] };
    }

    /**
     * Decouple this formation at the given car indices.
     *
     * The `inherit` parameter determines which side this formation becomes:
     * - `'head'`: this formation is mutated to contain cars [0..headCarIndex],
     *   and a **new** Formation for [tailCarIndex..end] is returned.
     * - `'tail'`: this formation is mutated to contain cars [tailCarIndex..end],
     *   and a **new** Formation for [0..headCarIndex] is returned.
     *
     * Child formations that span a split point are recursively split.
     * When a broken child has only one unit remaining, it is unwrapped.
     *
     * @param headCarIndex - Index of the last car in the head portion (in the flattened car list).
     * @param tailCarIndex - Index of the first car in the tail portion.
     * @param inherit - Which side this formation keeps.
     * @returns A new Formation for the non-inherited side.
     */
    decoupleAtCar(headCarIndex: number, tailCarIndex: number, inherit: 'head' | 'tail'): Formation {
        const { head, tail } = this._splitUnits(headCarIndex, tailCarIndex);

        const kept = inherit === 'head' ? head : tail;
        const other = inherit === 'head' ? tail : head;

        // Unwrap inherited side: if it's a single Formation child, adopt its children
        if (kept.length === 1 && kept[0] instanceof Formation) {
            this._children = [...(kept[0] as Formation)._children];
        } else {
            this._children = kept;
        }
        this._originalChildren = [...this._children];
        this._invalidateCache();

        // Unwrap other side: if it's a single Formation child, return it directly
        if (other.length === 1 && other[0] instanceof Formation) {
            return other[0] as Formation;
        }

        return new Formation(generateFormationId(), other, this._depth);
    }

    /**
     * Compute the head and tail unit arrays for a split without mutating this formation.
     */
    private _splitUnits(headCarIndex: number, tailCarIndex: number): { head: TrainUnit[]; tail: TrainUnit[] } {
        const totalCars = this.flatCars().length;
        if (headCarIndex < 0 || headCarIndex >= totalCars) {
            throw new Error(`headCarIndex ${headCarIndex} out of bounds for formation with ${totalCars} cars`);
        }
        if (tailCarIndex < 0 || tailCarIndex >= totalCars) {
            throw new Error(`tailCarIndex ${tailCarIndex} out of bounds for formation with ${totalCars} cars`);
        }
        if (headCarIndex >= tailCarIndex) {
            throw new Error(`headCarIndex (${headCarIndex}) must be less than tailCarIndex (${tailCarIndex})`);
        }

        const head: TrainUnit[] = [];
        const tail: TrainUnit[] = [];
        let flatOffset = 0;

        for (const child of this._children) {
            const childCarCount = child.flatCars().length;
            const childStart = flatOffset;
            const childEnd = flatOffset + childCarCount - 1;
            flatOffset += childCarCount;

            // Entirely in head portion
            if (childEnd <= headCarIndex) {
                head.push(child);
                continue;
            }
            // Entirely in tail portion
            if (childStart >= tailCarIndex) {
                tail.push(child);
                continue;
            }
            // Entirely in the discarded middle
            if (childStart > headCarIndex && childEnd < tailCarIndex) {
                continue;
            }

            // Child spans a split point — must be a Formation to contain multiple cars
            if (!(child instanceof Formation)) {
                // Single car can only be in one region; already handled above
                continue;
            }

            const localHeadIdx = headCarIndex - childStart;
            const localTailIdx = tailCarIndex - childStart;

            // Child spans both split points
            if (childStart <= headCarIndex && childEnd >= tailCarIndex) {
                const { head: childHead, tail: childTail } = child._splitUnits(localHeadIdx, localTailIdx);
                head.push(...wrapIfMultiple(childHead, child));
                tail.push(...wrapIfMultiple(childTail, child));
                continue;
            }

            // Child spans only the head split (childStart <= headCarIndex < childEnd < tailCarIndex)
            if (childStart <= headCarIndex && childEnd < tailCarIndex) {
                const localSplit = localHeadIdx;
                const { head: childHead } = child._splitUnits(localSplit, localSplit + 1);
                head.push(...wrapIfMultiple(childHead, child));
                continue;
            }

            // Child spans only the tail split (headCarIndex < childStart < tailCarIndex <= childEnd)
            if (childStart < tailCarIndex && childEnd >= tailCarIndex) {
                const localSplit = localTailIdx;
                const { tail: childTail } = child._splitUnits(localSplit - 1, localSplit);
                tail.push(...wrapIfMultiple(childTail, child));
                continue;
            }
        }

        return { head, tail };
    }

    /**
     * Flatten all nested formations so every child is a direct Car.
     * After consolidation the formation has depth 1 with only Car children.
     */
    consolidate(): void {
        const flatCars = this.flatCars();
        this._children = [...flatCars];
        this._originalChildren = [...flatCars];
        this._invalidateCache();
    }

    /**
     * Swap two adjacent children. `index` is swapped with `index + 1`.
     * @param index - Index of the first child to swap (0-based).
     */
    swapChildren(index: number): void {
        if (index < 0 || index >= this._children.length - 1) {
            throw new Error(
                `Cannot swap at index ${index}: need two adjacent children (length ${this._children.length})`
            );
        }
        [this._children[index], this._children[index + 1]] = [
            this._children[index + 1], this._children[index],
        ];
        [this._originalChildren[index], this._originalChildren[index + 1]] = [
            this._originalChildren[index + 1], this._originalChildren[index],
        ];
        this._invalidateCache();
    }

    /** Decouple and return the child at the given index. */
    removeAt(index: number): TrainUnit {
        if (index < 0 || index >= this._children.length) {
            throw new Error(`Index ${index} out of bounds for formation with ${this._children.length} children`);
        }
        if (this._children.length <= 1) {
            throw new Error('Cannot remove the last child from a formation');
        }
        const removed = this._children.splice(index, 1)[0];
        const origIndex = this._originalChildren.indexOf(removed);
        if (origIndex >= 0) {
            this._originalChildren.splice(origIndex, 1);
        }
        this._invalidateCache();
        return removed;
    }

    /** Create a default 4-car formation for backwards compatibility. */
    static createDefault(): Formation {
        return new Formation(generateFormationId(), [
            new Car(generateCarId(), [20], 2.5, 2.5),
            new Car(generateCarId(), [20], 2.5, 2.5),
            new Car(generateCarId(), [20], 2.5, 2.5),
            new Car(generateCarId(), [20], 2.5, 2.5),
        ]);
    }

    /** Invalidate cached values. Called when a child is mutated externally. */
    invalidateCache(): void {
        this._invalidateCache();
    }

    private _invalidateCache(): void {
        this._bogieOffsetsCache = null;
        this._flatCarsCache = null;
        this._flatCarsWithPathCache = null;
    }

    private _validateDepth(unit: TrainUnit): void {
        const unitDepth = unit.depth;
        if (this._depth + unitDepth >= MAX_FORMATION_DEPTH) {
            throw new Error(
                `Adding unit with depth ${unitDepth} to formation at depth ${this._depth} would exceed maximum nesting depth of ${MAX_FORMATION_DEPTH}`
            );
        }
    }
}

export type TrainPosition = {
    trackSegment: number;
    tValue: number;
    direction: 'tangent' | 'reverseTangent'; // the direction of the train on the bezier curve; forward is t = 0 -> t = 1; backward is t = 1 -> t = 0
    point: Point;
};

export type AdvancedTrainPositionRes = {
    stop: boolean;
    trackSegment: number;
    tValue: number;
    direction: 'tangent' | 'reverseTangent'; // the direction of the train on the bezier curve; forward is t = 0 -> t = 1; backward is t = 1 -> t = 0
    point: Point;
    passedJointNumbers: {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent'; // the direction to travel
    }[];
    enteringTrackSegments: {
        trackNumber: number;
        fromJointNumber: number;
        toJointNumber: number;
        inTrackDirection: 'tangent' | 'reverseTangent';
    }[];
};

const THROTTLE_STEPS_KEYS = [
    'er',
    'b7',
    'b6',
    'b5',
    'b4',
    'b3',
    'b2',
    'b1',
    'N',
    'p1',
    'p2',
    'p3',
    'p4',
    'p5',
] as const;

export type ThrottleStepValues<T extends readonly string[]> = {
    [K in T[number]]: number;
};

type CreateStateType<ArrayLiteral extends readonly string[]> =
    ArrayLiteral[number];

export type ThrottleSteps = CreateStateType<typeof THROTTLE_STEPS_KEYS>;

/**
 * Utility type that creates an object type mapping each key from a string union type to a value type.
 * @template Keys - The string union type to use as keys
 * @template Value - The type to map each key to (defaults to number)
 *
 * @example
 * type MyKeys = "a" | "b" | "c";
 * type MyMap = MapStringUnionToValue<MyKeys, number>;
 * // Results in: { a: number; b: number; c: number; }
 */
export type MapStringUnionToValue<Keys extends string, Value = number> = {
    [K in Keys]: Value;
};

export type ThrottleAccelerationMap = MapStringUnionToValue<ThrottleSteps>;

export const DEFAULT_THROTTLE_STEPS: ThrottleAccelerationMap = {
    er: -1.3,
    b7: -1.2,
    b6: -1.0,
    b5: -0.7,
    b4: -0.5,
    b3: -0.3,
    b2: -0.2,
    b1: -0.1,
    N: 0,
    p1: 0.1,
    p2: 0.2,
    p3: 0.3,
    p4: 0.5,
    p5: 0.7,
};

/**
 * Linear drag while **not** in neutral: each `Train.update` tick, after throttle acceleration is applied,
 * if speed is positive and raw acceleration is greater than `-0.5`, subtract `coefficient * speed`.
 *
 * Default **`0`** avoids a cruise equilibrium under power (e.g. old `0.1` gave ~7 world units/s at `p5`).
 * Use {@link TRAIN_NEUTRAL_COAST_DRAG_COEFFICIENT} for coast-down in neutral instead.
 *
 * @remarks
 * If positive and a finite `maxSpeed` is set, the lower of drag equilibrium and `maxSpeed` wins.
 *
 * @group Train physics
 */
export const TRAIN_LINEAR_DRAG_COEFFICIENT: number = 0;

/**
 * Linear coast-down in **neutral** (`N`): while moving, subtract `coefficient * speed` from acceleration
 * each tick so the train slows smoothly without power.
 *
 * Does not apply on power notches (`p1`–`p5`), so it does not recreate the old full-throttle speed cap.
 *
 * @remarks
 * Default is intentionally modest (`0.03`); `0.1` matches the legacy combined drag and feels harsh in neutral.
 *
 * @group Train physics
 */
export const TRAIN_NEUTRAL_COAST_DRAG_COEFFICIENT: number = 0.015;

/**
 * Default upper speed limit in world units per second when none is passed to {@link Train}'s constructor.
 * `Infinity` means no cap from this field (stops and track still apply; a positive {@link TRAIN_LINEAR_DRAG_COEFFICIENT} can still create a cruise equilibrium below this value).
 *
 * @group Train physics
 */
export const DEFAULT_TRAIN_MAX_SPEED: number = Number.POSITIVE_INFINITY;

function normalizeTrainMaxSpeed(value: number | undefined): number {
    if (value === undefined) {
        return DEFAULT_TRAIN_MAX_SPEED;
    }
    if (!Number.isFinite(value)) {
        return DEFAULT_TRAIN_MAX_SPEED;
    }
    return Math.max(0, value);
}

export class Train {
    private _position: TrainPosition | null;
    private _trackGraph: TrackGraph;
    private _jointDirectionManager: JointDirectionManager;
    private _walkBackResolver: WalkBackJointDirectionManager;
    private _speed: number = 0;
    private _acceleration: number = 0;
    private _throttle: ThrottleSteps = 'N';
    private _collisionLocked: boolean = false;
    private _maxSpeed: number;
    private _previewPositions: TrainPosition[] | null = null;
    private _previewPositionCache: TrainPosition | null = null;
    private _occupiedJointNumbers: {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
    }[] = [];

    private _occupiedTrackSegments: {
        trackNumber: number;
        inTrackDirection: 'tangent' | 'reverseTangent'; // the direction is to go from the start of the train to the end of the train
    }[] = [];

    private _cachedBogiePositions: TrainPosition[] | null = null;

    private _formation: Formation;

    get formation(): Formation {
        return this._formation;
    }

    /** Current head position on the track, or null if not placed. */
    get position(): TrainPosition | null {
        return this._position;
    }

    get cars(): readonly Car[] {
        return this._formation.flatCars();
    }

    get carOffsets(): number[] {
        return this._formation.bogieOffsets().slice(1);
    }

    /**
     * @param maxSpeed - Upper bound on speed (world units per second). Omit or use `Infinity` for no limit from this field.
     */
    constructor(
        position: TrainPosition | null,
        trackGraph: TrackGraph,
        jointDirectionManager: JointDirectionManager,
        formation?: Formation,
        maxSpeed?: number,
    ) {
        this._position = position;
        this._trackGraph = trackGraph;
        this._jointDirectionManager = jointDirectionManager;
        this._walkBackResolver = new WalkBackJointDirectionManager(trackGraph);
        this._formation = formation ?? Formation.createDefault();
        this._maxSpeed = normalizeTrainMaxSpeed(maxSpeed);
    }

    clearPreviewPosition() {
        this._previewPositionCache = null;
        this._previewPositions = null;
    }

    getPreviewPosition(): TrainPosition | null {
        return this._previewPositionCache;
    }

    get throttleStep(): ThrottleSteps {
        return this._throttle;
    }

    get speed(): number {
        return this._speed;
    }

    get collisionLocked(): boolean {
        return this._collisionLocked;
    }

    /**
     * Speed ceiling in world units per second. `Infinity` means no clamp from this property.
     */
    get maxSpeed(): number {
        return this._maxSpeed;
    }

    /**
     * @param value - Finite values clamp to `>= 0`. Non-finite values mean no speed cap (`Infinity`). `0` freezes the train at zero speed.
     */
    setMaxSpeed(value: number): void {
        this._maxSpeed = normalizeTrainMaxSpeed(value);
        if (this._speed > this._maxSpeed) {
            this._speed = this._maxSpeed;
        }
    }

    setThrottleStep(throttleStep: ThrottleSteps) {
        if (this._collisionLocked) {
            return;
        }
        this._throttle = throttleStep;
    }

    emergencyStop(): void {
        this._speed = 0;
        this._throttle = 'er';
        this._collisionLocked = true;
    }

    clearCollisionLock(): void {
        this._collisionLocked = false;
    }

    /** Replace the junction direction manager (e.g. to use a route-aware manager for timetable driving). */
    setJointDirectionManager(manager: JointDirectionManager): void {
        this._jointDirectionManager = manager;
    }

    _getBogiePositions(
        position: TrainPosition,
        preview: boolean = false
    ): TrainPosition[] | null {
        // console.log('get bogie positions', position, preview);
        const expandDirection = flipDirection(position.direction);
        const positions: TrainPosition[] = [position];

        let accuOffset = 0;

        const testOffsets = this.carOffsets

        for (let index = 0; index < testOffsets.length; index++) {
            accuOffset += testOffsets[index];
            const bogiePosition = !preview
                ? getPosition(
                    accuOffset,
                    { ...position, direction: expandDirection },
                    this._trackGraph,
                    this._walkBackResolver,
                    this._occupiedJointNumbers,
                    this._occupiedTrackSegments
                )
                : getPosition(
                    accuOffset,
                    { ...position, direction: expandDirection },
                    this._trackGraph,
                    this._walkBackResolver
                );
            if (bogiePosition === null || bogiePosition.stop) {
                // console.warn('cannot put the whole train at the current position');
                return null;
            }
            if (!preview) {
                if (
                    index === testOffsets.length - 1 &&
                    bogiePosition.passedJointNumbers.length > 0
                ) {
                    const lastBogiePositionPassedJointNumbers =
                        bogiePosition.passedJointNumbers;
                    const lastJointNumber =
                        lastBogiePositionPassedJointNumbers[0].jointNumber;
                    let index = -1;
                    for (
                        let i = this._occupiedJointNumbers.length - 1;
                        i >= 0;
                        i--
                    ) {
                        if (
                            this._occupiedJointNumbers[i].jointNumber ===
                            lastJointNumber
                        ) {
                            index = i;
                            break;
                        }
                    }
                    if (index !== -1) {
                        this._occupiedJointNumbers =
                            this._occupiedJointNumbers.slice(0, index + 1);
                    }
                }
                if (
                    index === testOffsets.length - 1 &&
                    this._occupiedJointNumbers.length == 0 &&
                    bogiePosition.passedJointNumbers.length > 0
                ) {
                    this._occupiedJointNumbers = [
                        ...bogiePosition.passedJointNumbers.reverse(),
                    ];
                }
                if (
                    index === testOffsets.length - 1 &&
                    bogiePosition.enteringTrackSegments.length > 0
                ) {
                    const lastBogiePositionEnteringTrackSegments =
                        bogiePosition.enteringTrackSegments;
                    const lastOccupiedTrackSegment =
                        lastBogiePositionEnteringTrackSegments[0].trackNumber;
                    let trackIndex = -1;
                    for (
                        let i = this._occupiedTrackSegments.length - 1;
                        i >= 0;
                        i--
                    ) {
                        if (
                            this._occupiedTrackSegments[i].trackNumber ===
                            lastOccupiedTrackSegment
                        ) {
                            trackIndex = i;
                            break;
                        }
                    }
                    if (trackIndex !== -1) {
                        this._occupiedTrackSegments =
                            this._occupiedTrackSegments.slice(
                                0,
                                trackIndex + 1
                            );
                    }
                }
                if (
                    index === testOffsets.length - 1 &&
                    this._occupiedTrackSegments.length == 0
                ) {
                    this._occupiedTrackSegments = [
                        ...bogiePosition.enteringTrackSegments.reverse(),
                    ];
                    this._occupiedTrackSegments.unshift({
                        trackNumber: position.trackSegment,
                        inTrackDirection: flipDirection(position.direction),
                    });
                }
            }
            positions.push(bogiePosition);
        }
        return positions;
    }

    setPosition(position: TrainPosition) {
        this._position = position;
    }

    getBogiePositions(preview: boolean = false): TrainPosition[] | null {
        if (this._position == null) {
            return null;
        }
        if (preview) {
            return this._getBogiePositions(this._position, preview);
        }
        if (this._cachedBogiePositions == null) {
            this._cachedBogiePositions = this._getBogiePositions(
                this._position,
                false
            );
        }
        return this._cachedBogiePositions;
    }

    get previewBogiePositions(): TrainPosition[] | null {
        return this._previewPositions;
    }

    get occupiedJointNumbers(): {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
    }[] {
        return this._occupiedJointNumbers;
    }

    get occupiedTrackSegments(): {
        trackNumber: number;
        inTrackDirection: 'tangent' | 'reverseTangent';
    }[] {
        return this._occupiedTrackSegments;
    }

    getPreviewBogiePositions(
        previewPosition: TrainPosition
    ): TrainPosition[] | null {
        if (
            this._previewPositionCache !== null &&
            this._previewPositionCache.direction ===
            previewPosition.direction &&
            this._previewPositionCache.tValue === previewPosition.tValue &&
            this._previewPositionCache.trackSegment ===
            previewPosition.trackSegment
        ) {
            return this._previewPositions;
        }
        this._previewPositionCache = previewPosition;
        this._previewPositions = this._getBogiePositions(previewPosition, true);
        return this._previewPositions;
    }

    flipTrainDirection() {
        if (this._previewPositionCache == null) {
            return;
        }
        this._previewPositionCache.direction = flipDirection(
            this._previewPositionCache.direction
        );
        this._previewPositions = this._getBogiePositions(
            this._previewPositionCache,
            true
        );
    }

    update(deltaTime: number) {
        // delta time is in millisecond
        deltaTime /= 1000;
        if (this._position === null) {
            return;
        }
        const trackSegment = this._trackGraph.getTrackSegmentWithJoints(
            this._position.trackSegment
        );
        if (trackSegment === null) {
            // console.warn('track segment where the train is on is not found');
            this._speed = 0;
            this._throttle = 'N';
            return;
        }
        this._acceleration = 0;
        this._acceleration += DEFAULT_THROTTLE_STEPS[this._throttle];
        if (this._speed > 0 && this._acceleration > -0.5) {
            this._acceleration -=
                TRAIN_LINEAR_DRAG_COEFFICIENT * this._speed;
        }
        if (
            this._speed > 0 &&
            this._throttle === 'N' &&
            TRAIN_NEUTRAL_COAST_DRAG_COEFFICIENT !== 0
        ) {
            this._acceleration -=
                TRAIN_NEUTRAL_COAST_DRAG_COEFFICIENT * this._speed;
        }
        this._speed += this._acceleration * deltaTime;
        if (this._speed < 0) {
            this._acceleration = 0;
            this._speed = 0;
        }
        if (this._speed > this._maxSpeed) {
            this._speed = this._maxSpeed;
        }
        let distanceToAdvance = this._speed * deltaTime;
        if (approximately(distanceToAdvance, 0, 1e-6)) {
            return;
        }
        const nextPosition = getPosition(
            distanceToAdvance,
            this._position,
            this._trackGraph,
            this._jointDirectionManager
        );
        if (nextPosition === null || nextPosition.stop) {
            this._speed = 0;
            this._throttle = 'N';
            if (nextPosition !== null && nextPosition.stop) {
                const flipped = nextPosition.passedJointNumbers.map(joint => ({
                    jointNumber: joint.jointNumber,
                    direction: flipDirection(joint.direction),
                }));
                this._occupiedJointNumbers = flipped.concat(this._occupiedJointNumbers);
                const flippedEntering = nextPosition.enteringTrackSegments.map(track => ({
                    trackNumber: track.trackNumber,
                    inTrackDirection: flipDirection(track.inTrackDirection),
                }));
                this._occupiedTrackSegments.unshift(...flippedEntering);
                this._position = nextPosition;
                this._cachedBogiePositions = this._getBogiePositions(nextPosition, false);
            }
            return;
        }
        const flipped = nextPosition.passedJointNumbers.map(joint => {
            return {
                jointNumber: joint.jointNumber,
                direction: flipDirection(joint.direction),
            };
        });
        this._occupiedJointNumbers = flipped.concat(this._occupiedJointNumbers);

        const flippedEnteringTrackSegments =
            nextPosition.enteringTrackSegments.map(track => {
                return {
                    trackNumber: track.trackNumber,
                    inTrackDirection: flipDirection(track.inTrackDirection),
                };
            });

        this._occupiedTrackSegments.unshift(...flippedEnteringTrackSegments);

        this._position = nextPosition;
        this._cachedBogiePositions = this._getBogiePositions(
            nextPosition,
            false
        );
    }

    switchDirection() {
        if (this._position == null) {
            this._formation.switchDirection();
            return;
        }
        const bogiePositions = this.getBogiePositions(false);
        if (bogiePositions === null) {
            return;
        }
        const lastBogiePosition = bogiePositions[bogiePositions.length - 1];
        this._position = lastBogiePosition;
        this._formation.switchDirection();
        // this._occupiedJointNumbers = this._occupiedJointNumbers.reverse();
        this._occupiedJointNumbers = this._occupiedJointNumbers
            .reverse()
            .map(joint => {
                return {
                    ...joint,
                    direction: flipDirection(joint.direction),
                };
            });
        this._occupiedTrackSegments = this._occupiedTrackSegments
            .reverse()
            .map(track => {
                return {
                    ...track,
                    inTrackDirection: flipDirection(track.inTrackDirection),
                };
            });
        this._cachedBogiePositions = this._getBogiePositions(
            this._position,
            false
        );
    }

    /**
     * Decouple this train at the given car indices, splitting the formation
     * and creating a new Train for the detached portion.
     *
     * @param headCarIndex - Index of the last car in the head portion (in the flattened car list).
     * @param tailCarIndex - Index of the first car in the tail portion.
     * @param inherit - Which side this train keeps ('head' or 'tail').
     * @returns A new Train holding the non-inherited portion.
     */
    decoupleAtCar(
        headCarIndex: number,
        tailCarIndex: number,
        inherit: 'head' | 'tail',
    ): Train {
        // Capture bogie positions BEFORE the formation split
        const originalFlatCars = this._formation.flatCars();
        const bogiePositions = this._position !== null
            ? this.getBogiePositions(false)
            : null;

        // Split the formation (mutates this._formation)
        const otherFormation = this._formation.decoupleAtCar(
            headCarIndex, tailCarIndex, inherit
        );

        // Calculate position for the tail portion's head bogie
        let selfPosition = this._position;
        let otherPosition: TrainPosition | null = null;

        if (bogiePositions !== null && this._position !== null) {
            // Count bogies for cars before tailCarIndex to find the tail's first bogie
            let tailBogieIndex = 0;
            for (let i = 0; i < tailCarIndex; i++) {
                tailBogieIndex += originalFlatCars[i].bogieOffsets().length + 1;
            }

            const tailBogiePosition = bogiePositions[tailBogieIndex];
            const tailHeadPosition: TrainPosition = {
                ...tailBogiePosition,
                // Bogies are expanded backward; flip to get forward direction
                direction: flipDirection(tailBogiePosition.direction),
            };

            if (inherit === 'head') {
                // Self keeps head — position unchanged; new train gets tail position
                otherPosition = tailHeadPosition;
            } else {
                // Self keeps tail — adopt tail position; new train gets original head
                selfPosition = tailHeadPosition;
                otherPosition = this._position;
            }
        }

        // Reset self state
        this._position = selfPosition;
        this._speed = 0;
        this._acceleration = 0;
        this._throttle = 'N';
        this._cachedBogiePositions = null;
        this._occupiedJointNumbers = [];
        this._occupiedTrackSegments = [];

        // Create new train for the other portion
        const newTrain = new Train(
            otherPosition,
            this._trackGraph,
            this._jointDirectionManager,
            otherFormation,
            this._maxSpeed,
        );

        return newTrain;
    }

    /**
     * Reset speed, acceleration, throttle, and invalidate cached position/occupancy data.
     * Used after coupling to clear stale state on the train that keeps its formation.
     */
    resetMotionState(): void {
        this._speed = 0;
        this._acceleration = 0;
        this._throttle = 'N';
        this._cachedBogiePositions = null;
        this._occupiedJointNumbers = [];
        this._occupiedTrackSegments = [];
    }

    /**
     * Remap the train's head position and invalidate cached body data when a
     * track segment is split. The body (bogies) may span the split segment
     * even when the head does not, so occupied data is always cleared.
     */
    remapOnSegmentSplit(info: SegmentSplitInfo): void {
        const { oldSegmentNumber, splitT, firstNewSegment, secondNewSegment } = info;

        if (this._position !== null && this._position.trackSegment === oldSegmentNumber) {
            const origT = this._position.tValue;
            if (this._position.tValue <= splitT) {
                this._position.trackSegment = firstNewSegment;
                this._position.tValue = splitT > 0
                    ? this._position.tValue / splitT
                    : 0;
            } else {
                this._position.trackSegment = secondNewSegment;
                this._position.tValue = splitT < 1
                    ? (this._position.tValue - splitT) / (1 - splitT)
                    : 1;
            }

            const seg = this._trackGraph
                .getTrackSegmentWithJoints(this._position.trackSegment);
            if (seg === null) {
                // console.warn(
                //     '[remapOnSegmentSplit] new segment not found!',
                //     { trackSegment: this._position.trackSegment, origT, splitT, firstNewSegment, secondNewSegment }
                // );
            }
            this._position.point = seg?.curve.get(this._position.tValue) ?? this._position.point;

            // console.log(
            //     '[remapOnSegmentSplit] remapped',
            //     {
            //         oldSegmentNumber, splitT, origT,
            //         newSegment: this._position.trackSegment,
            //         newT: this._position.tValue,
            //         direction: this._position.direction,
            //         point: this._position.point
            //     }
            // );
        } else {
            // console.log(
            //     '[remapOnSegmentSplit] position not on split segment',
            //     { positionSegment: this._position?.trackSegment, oldSegmentNumber }
            // );
        }

        this._cachedBogiePositions = null;
    }
}

export function getPosition(
    distance: number,
    position: TrainPosition,
    trackGraph: TrackGraph,
    jointDirectionManager: JointDirectionManager,
    occupiedJoints?: {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
    }[],
    occupiedTrackSegments?: {
        trackNumber: number;
        inTrackDirection: 'tangent' | 'reverseTangent';
    }[]
): AdvancedTrainPositionRes | null {
    let distanceToAdvance = distance;

    let xDirection = position.direction;
    let xTValue = position.tValue;
    let xTrackSegment = position.trackSegment;

    let trackSegment = trackGraph.getTrackSegmentWithJoints(xTrackSegment);

    if (trackSegment === null) {
        return null;
    }

    const passedJointNumbers: {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
    }[] = [];

    const enteringTrackSegment: {
        trackNumber: number;
        fromJointNumber: number;
        toJointNumber: number;
        inTrackDirection: 'tangent' | 'reverseTangent';
    }[] = [];

    const advanceLength =
        distanceToAdvance * (xDirection === 'tangent' ? 1 : -1);
    let nextPosition = trackSegment.curve.advanceAtTWithLength(
        xTValue,
        advanceLength
    );
    while (nextPosition.type !== 'withinCurve') {
        const comingFromJointNumber: number =
            xDirection === 'tangent'
                ? trackSegment.t0Joint
                : trackSegment.t1Joint;
        const enteringJointNumber: number =
            xDirection === 'tangent'
                ? trackSegment.t1Joint
                : trackSegment.t0Joint;
        const enteringJoint = trackGraph.getJoint(enteringJointNumber);

        if (enteringJoint === null) {
            return null;
        }

        const nextJointDirection = enteringJoint.direction.reverseTangent.has(
            comingFromJointNumber
        )
            ? 'tangent'
            : 'reverseTangent';
        const nextDirection = jointDirectionManager.getNextJoint(
            enteringJointNumber,
            nextJointDirection,
            occupiedJoints,
            occupiedTrackSegments
        );

        if (nextDirection === null) {
            // console.warn("end of the track");

            xTValue = xDirection === 'tangent' ? 1 : 0;
            return {
                stop: true,
                trackSegment: xTrackSegment,
                tValue: xTValue,
                direction: xDirection,
                point: trackSegment.curve.get(xTValue),
                passedJointNumbers: passedJointNumbers,
                enteringTrackSegments: enteringTrackSegment,
            };
        }

        enteringTrackSegment.unshift({
            trackNumber: nextDirection.curveNumber,
            fromJointNumber: enteringJointNumber,
            toJointNumber: nextDirection.jointNumber,
            inTrackDirection: nextDirection.direction,
        });

        passedJointNumbers.unshift({
            jointNumber: enteringJointNumber,
            direction: nextJointDirection,
        });

        trackSegment = trackGraph.getTrackSegmentWithJoints(
            nextDirection.curveNumber
        );

        if (trackSegment === null) {
            // console.warn("track segment not found");
            return null;
        }

        xDirection = nextDirection.direction;
        xTrackSegment = nextDirection.curveNumber;

        distanceToAdvance = Math.abs(nextPosition.remainLength);
        const startTValue = nextDirection.direction === 'tangent' ? 0 : 1;
        const calibratedAdvanceLength =
            distanceToAdvance *
            (nextDirection.direction === 'tangent' ? 1 : -1);
        nextPosition = trackSegment.curve.advanceAtTWithLength(
            startTValue,
            calibratedAdvanceLength
        );

        xTValue =
            nextPosition.type === 'withinCurve'
                ? nextPosition.tVal
                : nextDirection.direction === 'tangent'
                    ? 1
                    : 0;
    }
    xTValue =
        nextPosition.type === 'withinCurve'
            ? nextPosition.tVal
            : xDirection === 'tangent'
                ? 1
                : 0;

    return {
        stop: false,
        trackSegment: xTrackSegment,
        tValue: xTValue,
        direction: xDirection,
        point: nextPosition.point,
        passedJointNumbers: passedJointNumbers,
        enteringTrackSegments: enteringTrackSegment,
    };
}