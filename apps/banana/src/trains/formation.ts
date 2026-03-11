import { Point, approximately } from '@ue-too/curve';

import { SegmentSplitInfo, TrackGraph } from './tracks/track';
import {
    JointDirectionManager,
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

const MAX_FORMATION_DEPTH = 3;

/**
 * Composite node in the train unit hierarchy.
 * A Formation holds an ordered list of TrainUnit children (Cars or nested Formations).
 * Position is always determined from the head (first child) outward.
 */
export class Formation implements TrainUnit {

    readonly id: string;
    private _children: TrainUnit[];
    private _flipped: boolean = false;
    private _depth: number;

    constructor(id: string, children: TrainUnit[], depth: number = 1) {
        if (depth > MAX_FORMATION_DEPTH) {
            throw new Error(`Formation nesting depth exceeds maximum of ${MAX_FORMATION_DEPTH}`);
        }
        if (children.length === 0) {
            throw new Error('Formation must have at least one child');
        }
        this.id = id;
        this._children = children;
        this._depth = depth;
    }

    get edgeToBogie(): number {
        return this._children[0].edgeToBogie;
    }

    get bogieToEdge(): number {
        return this._children[this._children.length - 1].bogieToEdge;
    }

    get flipped(): boolean {
        return this._flipped;
    }

    get depth(): number {
        return this._depth;
    }

    get children(): readonly TrainUnit[] {
        return this._children;
    }

    /**
     * Returns the inter-bogie distances for the entire formation.
     * The first element is the leading edgeToBogie of the first child.
     * Subsequent elements alternate between intra-child bogie offsets
     * and inter-child gaps (prevChild.bogieToEdge + nextChild.edgeToBogie).
     */
    bogieOffsets(): number[] {
        const res: number[] = [];
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            const childOffsets = child.bogieOffsets();

            if (i === 0) {
                // First child: include its leading edgeToBogie + its bogie offsets
                res.push(child.edgeToBogie);
                for (const offset of childOffsets) {
                    res.push(offset);
                }
            } else {
                const prevChild = this._children[i - 1];
                // Gap between previous child's trailing edge and this child's leading edge
                res.push(prevChild.bogieToEdge + child.edgeToBogie);
                for (const offset of childOffsets) {
                    res.push(offset);
                }
            }
        }
        return res;
    }

    flatCars(): readonly Car[] {
        const result: Car[] = [];
        for (const child of this._children) {
            for (const car of child.flatCars()) {
                result.push(car);
            }
        }
        return result;
    }

    switchDirection(): void {
        this._children.reverse();
        for (const child of this._children) {
            child.switchDirection();
        }
        this._flipped = !this._flipped;
    }

    /** Couple a unit to the tail of this formation. */
    append(unit: TrainUnit): void {
        this._validateDepth(unit);
        this._children.push(unit);
    }

    /** Couple a unit to the head of this formation. */
    prepend(unit: TrainUnit): void {
        this._validateDepth(unit);
        this._children.unshift(unit);
    }

    /** Decouple and return the child at the given index. */
    removeAt(index: number): TrainUnit {
        if (index < 0 || index >= this._children.length) {
            throw new Error(`Index ${index} out of bounds for formation with ${this._children.length} children`);
        }
        if (this._children.length <= 1) {
            throw new Error('Cannot remove the last child from a formation');
        }
        return this._children.splice(index, 1)[0];
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
    p6: 0.9,
    p7: 1.1,
    p8: 1.3,
    p9: 1.5,
    p10: 1.7,
    p11: 1.9,
    p12: 2.1,
    p13: 2.3,
    p14: 2.5,
};

export class Train {
    private _position: TrainPosition | null;
    private _trackGraph: TrackGraph;
    private _jointDirectionManager: JointDirectionManager;
    private _speed: number = 0;
    private _acceleration: number = 0;
    private _throttle: ThrottleSteps = 'N';
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

    get cars(): readonly Car[] {
        return this._formation.flatCars();
    }

    get carOffsets(): number[] {
        const res = this._formation.bogieOffsets();
        res.shift();
        return res;
    }

    constructor(
        position: TrainPosition | null,
        trackGraph: TrackGraph,
        jointDirectionManager: JointDirectionManager,
        formation?: Formation,
    ) {
        this._position = position;
        this._trackGraph = trackGraph;
        this._jointDirectionManager = jointDirectionManager;
        this._formation = formation ?? Formation.createDefault();
    }

    clearPreviewPosition() {
        this._previewPositionCache = null;
        this._previewPositions = null;
    }

    getPreviewPosition(): TrainPosition | null {
        return this._previewPositionCache;
    }

    setThrottleStep(throttleStep: ThrottleSteps) {
        this._throttle = throttleStep;
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
                    this._jointDirectionManager,
                    this._occupiedJointNumbers,
                    this._occupiedTrackSegments
                )
                : getPosition(
                    accuOffset,
                    { ...position, direction: expandDirection },
                    this._trackGraph,
                    this._jointDirectionManager
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
            this._acceleration -= 0.1;
        }
        this._speed += this._acceleration * deltaTime;
        if (this._speed < 0) {
            this._acceleration = 0;
            this._speed = 0;
        }
        let distanceToAdvance = this._speed * deltaTime;
        if (approximately(distanceToAdvance, 0, 0.01)) {
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