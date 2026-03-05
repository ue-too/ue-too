import { Point, approximately } from '@ue-too/curve';

import { TrackGraph, SegmentSplitInfo } from './tracks/track';
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
    private _expandDirection: 'same' | 'reverse' = 'reverse';
    /** True when position is the tail (after switchDirection()); advance uses negated distance. */
    private _positionIsTail: boolean = false;
    private _offsets: number[] = [40];
    private _trackGraph: TrackGraph;
    private _jointDirectionManager: JointDirectionManager;
    private _speed: number = 0;
    private _acceleration: number = 0;
    private _throttle: ThrottleSteps = 'N';
    private _previewPositions: TrainPosition[] | null = null;
    private _previewPositionCache: TrainPosition | null = null;

    private _cachedBogiePositions: TrainPosition[] | null = null;

    constructor(
        position: TrainPosition | null,
        bogieOffsets: number[],
        trackGraph: TrackGraph,
        jointDirectionManager: JointDirectionManager
    ) {
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
        const bogieDirection = this._expandDirection === 'same' ? position.direction : flipDirection(position.direction);
        const positions: TrainPosition[] = [position];

        let accuOffset = 0;

        // When expandDirection is 'same', expand from the tail (furthest bogie) so that
        // end-of-track is detected at the tail and the same stopping mechanism works.
        // We still return [head, ..., tail] so render order is unchanged.
        if (this._expandDirection === 'same') {
            const totalOffset = this._offsets.reduce((a, b) => a + b, 0);
            const tailPos = getPosition(
                totalOffset,
                { ...position, direction: bogieDirection },
                this._trackGraph,
                this._jointDirectionManager
            );
            if (tailPos === null) {
                return null;
            }
            // Allow tail at path start (stop at junction with no path segment ahead).
            // Walk from tail back to head so we get all bogie positions in order tail → head.
            const positionsTailToHead: TrainPosition[] = [tailPos];
            let current: TrainPosition = { ...tailPos, direction: flipDirection(tailPos.direction) };
            for (let i = this._offsets.length - 1; i >= 0; i--) {
                const stepOffset = this._offsets[i];
                const nextPos = getPosition(
                    stepOffset,
                    current,
                    this._trackGraph,
                    this._jointDirectionManager
                );
                if (nextPos === null || nextPos.stop) {
                    return null;
                }
                positionsTailToHead.push(nextPos);
                current = nextPos;
            }
            // Return [head, ..., tail] for consistent render order.
            const result = positionsTailToHead.reverse();
            // Head (first element) must match the train position so segment, tValue, and direction are correct.
            if (result.length > 0) {
                result[0] = { ...position, point: result[0].point };
            }
            return result;
        }

        for (let index = 0; index < this._offsets.length; index++) {
            accuOffset += this._offsets[index];
            const bogiePosition = getPosition(
                accuOffset,
                { ...position, direction: bogieDirection },
                this._trackGraph,
                this._jointDirectionManager
            );
            if (bogiePosition === null) {
                return null;
            }
            positions.push(bogiePosition);
            if (bogiePosition.stop) {
                // Clamp remaining bogies at the end-of-track position.
                for (let j = index + 1; j < this._offsets.length; j++) {
                    positions.push(bogiePosition);
                }
                break;
            }
        }
        return positions;
    }

    setPosition(position: TrainPosition) {
        this._position = position;
        this._positionIsTail = false;
        this._cachedBogiePositions = null;
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
            console.warn(
                '[Train.update] track segment not found!',
                { trackSegment: this._position.trackSegment, tValue: this._position.tValue }
            );
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
        // After switchDirection(), position is the tail (leading end); advance it in the opposite direction.
        if (this._positionIsTail) {
            distanceToAdvance = -distanceToAdvance;
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
        // When expanding in same direction, the tail is the leading end; stop before it hits end-of-track.
        if (this._expandDirection === 'same') {
            const bogies = this._getBogiePositions(nextPosition, false);
            if (bogies === null) {
                this._speed = 0;
                this._throttle = 'N';
                return;
            }
            this._cachedBogiePositions = bogies;
        }

        this._position = nextPosition;
        if (this._expandDirection === 'reverse') {
            this._cachedBogiePositions = this._getBogiePositions(
                nextPosition,
                false
            );
        }
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
        this._positionIsTail = !this._positionIsTail;
        this._offsets = this._offsets.reverse();
        this._cachedBogiePositions = this._getBogiePositions(
            this._position,
            false
        );
    }

    switchDirectionOnly() {
        if (this._position == null) {
            return;
        }
        this._position.direction = flipDirection(this._position.direction);
        this._expandDirection = this._expandDirection === 'same' ? 'reverse' : 'same';
        this._cachedBogiePositions = null;
        let bogiePositions = this._getBogiePositions(this._position, false);
        // If any bogie (not the head) got clamped at a dead end (squished), fall back to the other expand mode.
        const anyBogieStopped = bogiePositions !== null
            && bogiePositions.slice(1).some(b => (b as AdvancedTrainPositionRes).stop === true);
        if (anyBogieStopped) {
            this._expandDirection = this._expandDirection === 'same' ? 'reverse' : 'same';
            bogiePositions = this._getBogiePositions(this._position, false);
        }
        if (bogiePositions === null) {
            return;
        }
        this._cachedBogiePositions = bogiePositions;
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
                console.warn(
                    '[remapOnSegmentSplit] new segment not found!',
                    { trackSegment: this._position.trackSegment, origT, splitT, firstNewSegment, secondNewSegment }
                );
            }
            this._position.point = seg?.curve.get(this._position.tValue) ?? this._position.point;

            console.log(
                '[remapOnSegmentSplit] remapped',
                {
                    oldSegmentNumber, splitT, origT,
                    newSegment: this._position.trackSegment,
                    newT: this._position.tValue,
                    direction: this._position.direction,
                    point: this._position.point
                }
            );
        } else {
            console.log(
                '[remapOnSegmentSplit] position not on split segment',
                { positionSegment: this._position?.trackSegment, oldSegmentNumber }
            );
        }

        this._cachedBogiePositions = null;
    }
}

export function getPosition(
    distance: number,
    position: TrainPosition,
    trackGraph: TrackGraph,
    jointDirectionManager: JointDirectionManager
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
            nextJointDirection
        );

        if (nextDirection === null) {
            console.warn(
                '[getPosition] end of track at joint',
                {
                    enteringJointNumber, nextJointDirection,
                    segment: xTrackSegment, direction: xDirection,
                    remainLength: nextPosition.remainLength
                }
            );

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
