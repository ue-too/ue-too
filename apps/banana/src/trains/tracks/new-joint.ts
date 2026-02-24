import { BCurve } from '@ue-too/curve';
import type { Point } from '@ue-too/math';
import { PointCal, normalizeAngleZero2TwoPI } from '@ue-too/math';

import { BrandNewJoint, NewJointType } from '../kmt-state-machine';

type PreviewCurveType =
    | PreviewStraightLine
    | PreviewQuadratic
    | PreviewReversedQuadratic
    | PreviewCubic;

type PreviewStraightLine = {
    type: 'straight';
    startJoint: NewJointType;
    endJoint: NewJointType;
};

type PreviewQuadratic = {
    type: 'quadratic';
    startJoint: Exclude<NewJointType, BrandNewJoint>;
    endJoint: BrandNewJoint;
};

type PreviewReversedQuadratic = {
    type: 'reversedQuadratic';
    startJoint: BrandNewJoint;
    endJoint: Exclude<NewJointType, BrandNewJoint>;
};

type PreviewCubic = {
    type: 'cubic';
    startJoint: Exclude<NewJointType, BrandNewJoint>;
    endJoint: Exclude<NewJointType, BrandNewJoint>;
};

export type PreivewCurve = {
    cps: Point[];
    curve: BCurve;
    previewStartAndEndSwitched: boolean;
};

export type PreviewCurveResult = {
    cps: Point[]; // including start and end preview points
    startAndEndSwitched: boolean; // sometimes the new curve would go from end (as t = 0) to start (as t = 1)
    shouldToggleStartTangentFlip: boolean;
    shouldToggleEndTangentFlip: boolean;
};

export class PreviewCurveCalculator {
    private _previewStartTangentFlipped: boolean = false;
    private _previewEndTangentFlipped: boolean = false;

    private _extendAsStraightLine: boolean = false;

    constructor() {}

    toggleStraightLine() {
        this._extendAsStraightLine = !this._extendAsStraightLine;
    }

    toggleStartTangentFlip() {
        this._previewStartTangentFlipped = !this._previewStartTangentFlipped;
    }

    toggleEndTangentFlip() {
        this._previewEndTangentFlipped = !this._previewEndTangentFlipped;
    }

    getPreviewCurve(
        startJoint: NewJointType,
        endJoint: NewJointType
    ): PreviewCurveResult {
        const previewCurveType = determinePreviewCurveType(
            startJoint,
            endJoint,
            this._extendAsStraightLine
        );

        const res = getPreviewCurveExp(
            previewCurveType,
            this._previewStartTangentFlipped,
            this._previewEndTangentFlipped
        );

        if (res.shouldToggleEndTangentFlip) {
            this._previewEndTangentFlipped = !this._previewEndTangentFlipped;
        }
        if (res.shouldToggleStartTangentFlip) {
            this._previewStartTangentFlipped =
                !this._previewStartTangentFlipped;
        }
        return res;
    }
}

/**
 * | start \ end | new      | constrained | extend     | branch joint | branch curve |
 * |-------------|----------|-------------|------------|--------------|--------------|
 * | new         | straight | straight    | straight   | straight     | straight     |
 * |             | line     | line/       | line/      | line/        | line/        |
 * |             |          | quadratic   | quadratic  | quadratic    | quadratic    |
 * |             |          | curve       | curve      | curve        | curve        |
 * |-------------|----------|-------------|------------|--------------|--------------|
 * | constrained | reversed | cubic       | cubic      | cubic        | cubic        |
 * |             | quadratic| curve       | curve      | curve        | curve        |
 * |             | curve    |             |            |              |              |
 * |-------------|----------|-------------|------------|--------------|--------------|
 * | extend      | reversed | cubic       | cubic      | cubic        | cubic        |
 * |             | quadratic| curve       | curve      | curve        | curve        |
 * |             | curve    |             |            |              |              |
 * |-------------|----------|-------------|------------|--------------|--------------|
 * | branch joint| reversed | cubic       | cubic      | cubic        | cubic        |
 * |             | quadratic| curve       | curve      | curve        | curve        |
 * |             | curve    |             |            |              |              |
 * |-------------|----------|-------------|------------|--------------|--------------|
 * | branch curve| reversed | cubic       | cubic      | cubic        | cubic        |
 * |             | quadratic| curve       | curve      | curve        | curve        |
 * |             | curve    |             |            |              |              |
 */

/**
 * Determine the preview curve type based on the start and end joint types.
 * */
function determinePreviewCurveType(
    startJoint: NewJointType,
    endJoint: NewJointType,
    extendAsStraightLine: boolean
): PreviewCurveType {
    if (startJoint.type === 'new') {
        return determinePreviewCurveForBrandNewStartJoint(
            startJoint,
            endJoint,
            extendAsStraightLine
        );
    }
    return determinePreviewCurveForNotNewStartJoint(
        startJoint,
        endJoint,
        extendAsStraightLine
    );
}

function determinePreviewCurveForBrandNewStartJoint(
    startJoint: BrandNewJoint,
    endJoint: NewJointType,
    extendAsStraightLine: boolean
): PreviewCurveType {
    if (extendAsStraightLine || endJoint.type === 'new') {
        return {
            type: 'straight',
            startJoint,
            endJoint,
        };
    }

    return {
        type: 'reversedQuadratic',
        startJoint,
        endJoint,
    };
}

function determinePreviewCurveForNotNewStartJoint(
    startJoint: Exclude<NewJointType, BrandNewJoint>,
    endJoint: NewJointType,
    extendAsStraightLine: boolean
): PreviewCurveType {
    if (extendAsStraightLine) {
        return {
            type: 'straight',
            startJoint,
            endJoint,
        };
    }
    if (endJoint.type === 'new') {
        return {
            type: 'quadratic',
            startJoint,
            endJoint,
        };
    }
    return {
        type: 'cubic',
        startJoint,
        endJoint,
    };
}

function getPreviewCurveExp(
    previewCurveType: PreviewCurveType,
    previewStartTangentFlipped: boolean,
    previewEndTangentFlipped: boolean
): PreviewCurveResult {
    if (previewCurveType.type === 'straight') {
        return getStraightLinePreviewCurve(
            previewCurveType.startJoint,
            previewCurveType.endJoint,
            previewStartTangentFlipped
        );
    }
    if (previewCurveType.type === 'quadratic') {
        return getQuadraticPreviewCurve(
            previewCurveType.startJoint,
            previewCurveType.endJoint,
            previewStartTangentFlipped
        );
    }
    if (previewCurveType.type === 'cubic') {
        return getCubicPreviewCurve(
            previewCurveType.startJoint,
            previewCurveType.endJoint,
            previewStartTangentFlipped,
            previewEndTangentFlipped
        );
    }
    return getReversedQuadraticPreviewCurve(
        previewCurveType.startJoint,
        previewCurveType.endJoint,
        previewEndTangentFlipped
    );
}

function getStraightLinePreviewCurve(
    startJoint: NewJointType,
    endJoint: NewJointType,
    previewStartTangentFlipped: boolean
): PreviewCurveResult {
    let { flipped: tangentCalibrated, tangent: startTangent } =
        calibrateTangent(
            startJoint.type !== 'new'
                ? startJoint.constraint.tangent
                : PointCal.unitVectorFromA2B(
                      startJoint.position,
                      endJoint.position
                  ),
            startJoint.position,
            endJoint.position
        );
    startTangent = previewStartTangentFlipped
        ? PointCal.multiplyVectorByScalar(startTangent, -1)
        : startTangent;

    startTangent = PointCal.unitVector(startTangent);

    const rawEndPositionRelativeToStart = PointCal.subVector(
        endJoint.position,
        startJoint.position
    );
    const adjustedEndPosition = PointCal.addVector(
        startJoint.position,
        PointCal.multiplyVectorByScalar(
            startTangent,
            PointCal.dotProduct(startTangent, rawEndPositionRelativeToStart)
        )
    );

    const midPoint = {
        x:
            startJoint.position.x +
            (adjustedEndPosition.x - startJoint.position.x) / 2,
        y:
            startJoint.position.y +
            (adjustedEndPosition.y - startJoint.position.y) / 2,
    };

    return {
        cps: [startJoint.position, midPoint, adjustedEndPosition],
        startAndEndSwitched: false,
        shouldToggleEndTangentFlip: false,
        shouldToggleStartTangentFlip:
            tangentCalibrated && previewStartTangentFlipped,
    };
}

function getReversedQuadraticPreviewCurve(
    startJoint: NewJointType,
    endJoint: Exclude<NewJointType, BrandNewJoint>,
    previewEndTangentFlipped: boolean
): PreviewCurveResult {
    let { flipped: tangentCalibrated, tangent } = calibrateTangent(
        endJoint.constraint.tangent,
        endJoint.position,
        startJoint.position
    );
    tangent = previewEndTangentFlipped
        ? PointCal.multiplyVectorByScalar(tangent, -1)
        : tangent;
    const curvature = endJoint.constraint.curvature;
    const previewCurveCPs = createQuadraticFromTangentCurvature(
        endJoint.position,
        startJoint.position,
        tangent,
        curvature
    );
    // const previewCurveCPs = createCubicFromTangentsCurvaturesV2(newEndJointType.position, newStartJointType.position, {tangent, curvature});
    return {
        cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
        startAndEndSwitched: true,
        shouldToggleStartTangentFlip: false,
        shouldToggleEndTangentFlip:
            tangentCalibrated && previewEndTangentFlipped,
    };
}

function getQuadraticPreviewCurve(
    startJoint: Exclude<NewJointType, BrandNewJoint>,
    endJoint: BrandNewJoint,
    previewStartTangentFlipped: boolean
): PreviewCurveResult {
    let { flipped: tangentCalibrated, tangent } = calibrateTangent(
        startJoint.constraint.tangent,
        startJoint.position,
        endJoint.position
    );
    tangent = previewStartTangentFlipped
        ? PointCal.multiplyVectorByScalar(tangent, -1)
        : tangent;
    const curvature = startJoint.constraint.curvature;
    // branch to a new joint
    // const previewCurveCPs = createCubicFromTangentsCurvaturesV2(newStartJointType.position, newEndJointType.position, {tangent, curvature});
    const previewCurveCPs = createQuadraticFromTangentCurvature(
        startJoint.position,
        endJoint.position,
        tangent,
        curvature
    );
    return {
        cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
        startAndEndSwitched: false,
        shouldToggleEndTangentFlip: false,
        shouldToggleStartTangentFlip:
            tangentCalibrated && previewStartTangentFlipped,
    };
}

function getCubicPreviewCurve(
    startJoint: Exclude<NewJointType, BrandNewJoint>,
    endJoint: Exclude<NewJointType, BrandNewJoint>,
    previewStartTangentFlipped: boolean,
    previewEndTangentFlipped: boolean
): PreviewCurveResult {
    let { flipped: tangentCalibrated, tangent } = calibrateTangent(
        startJoint.constraint.tangent,
        startJoint.position,
        endJoint.position
    );
    tangent = previewStartTangentFlipped
        ? PointCal.multiplyVectorByScalar(tangent, -1)
        : tangent;
    const curvature = startJoint.constraint.curvature;
    let endTangentCalibrated = false;
    let endTangent = endJoint.constraint.tangent;

    if (endJoint.type === 'extendingTrack') {
        let { flipped, tangent } = calibrateTangent(
            endJoint.constraint.tangent,
            endJoint.position,
            startJoint.position
        );
        endTangent = tangent;
        endTangentCalibrated = flipped;
    }

    const previewEndTangent = previewEndTangentFlipped
        ? PointCal.multiplyVectorByScalar(endTangent, -1)
        : endTangent;
    const previewCurveCPs = createCubicFromTangentsCurvatures(
        startJoint.position,
        endJoint.position,
        tangent,
        previewEndTangent,
        curvature,
        endJoint.constraint.curvature
    );
    return {
        cps: [
            previewCurveCPs.p0,
            previewCurveCPs.p1,
            previewCurveCPs.p2,
            previewCurveCPs.p3,
        ],
        startAndEndSwitched: false,
        shouldToggleEndTangentFlip:
            endTangentCalibrated && previewEndTangentFlipped,
        shouldToggleStartTangentFlip:
            tangentCalibrated && previewStartTangentFlipped,
    };
}

function calibrateTangent(
    rawTangent: Point,
    curveStartPoint: Point,
    curveEndPoint: Point
): {
    flipped: boolean;
    tangent: Point;
} {
    const curPreviewDirection = PointCal.unitVectorFromA2B(
        curveStartPoint,
        curveEndPoint
    );
    let flipped = false;
    let tangent = rawTangent;
    const angleDiff = normalizeAngleZero2TwoPI(
        PointCal.angleFromA2B(tangent, curPreviewDirection)
    );
    if (angleDiff >= Math.PI / 2 && angleDiff <= (3 * Math.PI) / 2) {
        flipped = true;
        tangent = PointCal.multiplyVectorByScalar(tangent, -1);
    }
    return {
        flipped,
        tangent,
    };
}

function createCubicFromTangentsCurvatures(
    startPoint: Point,
    endPoint: Point,
    startTangent: Point,
    endTangent: Point,
    startCurvature: number,
    endCurvature: number,
    tension = 1.0
) {
    const unitStartTangent = PointCal.unitVector(startTangent);
    const unitEndTangent = PointCal.unitVector(endTangent);

    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);

    // Base control distances
    let startControlDistance = (chordLength * tension) / 3.0;
    let endControlDistance = (chordLength * tension) / 3.0;

    // Adjust based on curvatures
    const startCurvatureMagnitude = Math.abs(startCurvature);
    if (startCurvatureMagnitude > 0.001) {
        const startCurvatureScale = Math.min(
            1.5,
            Math.max(0.3, 1.0 / (startCurvatureMagnitude * chordLength + 1.0))
        );
        startControlDistance *= startCurvatureScale;

        if (startCurvatureMagnitude > 0.02) {
            startControlDistance *= 0.7;
        }
    }

    const endCurvatureMagnitude = Math.abs(endCurvature);
    if (endCurvatureMagnitude > 0.001) {
        const endCurvatureScale = Math.min(
            1.5,
            Math.max(0.3, 1.0 / (endCurvatureMagnitude * chordLength + 1.0))
        );
        endControlDistance *= endCurvatureScale;

        if (endCurvatureMagnitude > 0.02) {
            endControlDistance *= 0.7;
        }
    }

    // Calculate initial control points
    const p1Initial = {
        x: startPoint.x + unitStartTangent.x * startControlDistance,
        y: startPoint.y + unitStartTangent.y * startControlDistance,
    };

    const p2Initial = {
        x: endPoint.x - unitEndTangent.x * endControlDistance,
        y: endPoint.y - unitEndTangent.y * endControlDistance,
    };

    // Apply curvature adjustments
    const startPerpendicular = {
        x: -unitStartTangent.y,
        y: unitStartTangent.x,
    };

    const endPerpendicular = {
        x: -unitEndTangent.y,
        y: unitEndTangent.x,
    };

    const startCurvatureOffset = startCurvature * chordLength * 0.05;
    const endCurvatureOffset = endCurvature * chordLength * 0.05;

    const p1 = {
        x: p1Initial.x + startPerpendicular.x * startCurvatureOffset,
        y: p1Initial.y + startPerpendicular.y * startCurvatureOffset,
    };

    const p2 = {
        x: p2Initial.x + endPerpendicular.x * endCurvatureOffset,
        y: p2Initial.y + endPerpendicular.y * endCurvatureOffset,
    };

    return {
        p0: startPoint,
        p1: p1,
        p2: p2,
        p3: endPoint,
    };
}

/**
 * Creates a quadratic Bézier curve from start and end points with specified tangent direction and curvature
 * @param startPoint - The starting point of the curve (P0)
 * @param endPoint - The ending point of the curve (P2)
 * @param tangentDirection - Unit vector indicating the tangent direction at the start point
 * @param curvature - The desired curvature value (positive for left turn, negative for right turn)
 * @returns Object containing the three control points {p0, p1, p2} of the quadratic Bézier curve
 */
function createQuadraticFromTangentCurvature(
    startPoint: Point,
    endPoint: Point,
    tangentDirection: Point,
    curvature: number
): { p0: Point; p1: Point; p2: Point } {
    // Ensure tangent direction is normalized
    let unitTangent = PointCal.unitVector(tangentDirection);

    // Calculate the chord vector from start to end
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);

    // For a quadratic Bézier curve, the relationship between curvature and control point placement
    // can be derived from the curve's mathematical properties
    // The control point distance is inversely related to curvature magnitude

    // Base control distance as a fraction of chord length
    let controlDistance = chordLength * 0.5;

    // Adjust control distance based on curvature
    // Higher curvature magnitude requires closer control points for tighter curves
    const curvatureMagnitude = Math.abs(curvature);
    if (curvatureMagnitude > 0.001) {
        // Scale inversely with curvature, but with reasonable bounds
        const curvatureScale = Math.min(
            1.0,
            1.0 / (curvatureMagnitude * chordLength + 1.0)
        );
        controlDistance *= curvatureScale;

        // Additional scaling based on curvature sign and magnitude
        if (curvatureMagnitude > 0.01) {
            controlDistance *= 0.8; // Tighter control for high curvature
        }
    }

    // Calculate the midpoint control point (P1)
    // For quadratic curves, P1 influences both the tangent direction and curvature
    const p1 = {
        x: startPoint.x + unitTangent.x * controlDistance,
        y: startPoint.y + unitTangent.y * controlDistance,
    };

    // Fine-tune P1 position based on curvature direction
    // Positive curvature typically means curving to the left of the tangent direction
    if (Math.abs(curvature) > 0.001) {
        // Calculate perpendicular vector to tangent (90 degrees counter-clockwise)
        const perpendicular = {
            x: -unitTangent.y,
            y: unitTangent.x,
        };

        // Adjust P1 perpendicular to the tangent based on curvature
        const perpendicularOffset = curvature * chordLength * 0.1;
        p1.x += perpendicular.x * perpendicularOffset;
        p1.y += perpendicular.y * perpendicularOffset;
    }

    return {
        p0: startPoint,
        p1: p1,
        p2: endPoint,
    };
}
