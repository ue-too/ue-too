import { Point, approximately } from '@ue-too/curve';

import { TrackGraph } from './tracks/track';
import {
    JointDirectionManager,
    flipDirection,
} from './input-state-machine/train-kmt-state-machine';

export type Car = {
    id: number;
    position: {
        trackNumber: number;
        tVal: number;
        extendPositionOnTrack: 'positive' | 'negative';
    };
    bogieOffsets: number[];
};

export interface Formation {
    cars(): Car[];
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

export class Train {
    private _position: TrainPosition | null;
    private _carNumber: number;
    private _offsets: number[] = [40, 10, 40, 10, 40];
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

    constructor(
        carNumber: number,
        position: TrainPosition | null,
        bogieOffsets: number[],
        trackGraph: TrackGraph,
        jointDirectionManager: JointDirectionManager
    ) {
        this._carNumber = carNumber;
        this._position = position;
        this._trackGraph = trackGraph;
        this._offsets = bogieOffsets;
        this._jointDirectionManager = jointDirectionManager;
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
        console.log('get bogie positions', position, preview);
        const expandDirection = flipDirection(position.direction);
        const positions: TrainPosition[] = [position];

        let accuOffset = 0;

        for (let index = 0; index < this._offsets.length; index++) {
            accuOffset += this._offsets[index];
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
                    index === this._offsets.length - 1 &&
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
                    index === this._offsets.length - 1 &&
                    this._occupiedJointNumbers.length == 0 &&
                    bogiePosition.passedJointNumbers.length > 0
                ) {
                    this._occupiedJointNumbers = [
                        ...bogiePosition.passedJointNumbers.reverse(),
                    ];
                }
                if (
                    index === this._offsets.length - 1 &&
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
                    index === this._offsets.length - 1 &&
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
            console.warn('track segment where the train is on is not found');
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
        const bogiePositions = this.getBogiePositions(true);
        if (bogiePositions === null) {
            return;
        }
        const lastBogiePosition = bogiePositions[bogiePositions.length - 1];
        this._position = lastBogiePosition;
        this._offsets = this._offsets.reverse();
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
