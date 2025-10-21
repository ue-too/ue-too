import { Point } from "@ue-too/math";
import { BrandNewJoint, NewJointType } from "./kmt-state-machine";

type PreviewCurveType = 'straight' | 'quadratic' | 'cubic';

const CURVE_TYPE_FOR_JOINT_COMBINATIONS: Record<NewJointType['type'], Record<NewJointType['type'], PreviewCurveType>> = {
    "new": {
        "new": 'straight',
        "branchJoint": 'quadratic',
        "extendingTrack": 'straight',
        "branchCurve": 'cubic',
    },
    "branchJoint": {
        "new": 'quadratic',
        "branchJoint": 'cubic',
        "extendingTrack": 'quadratic',
        "branchCurve": 'cubic',
    },
    "extendingTrack": {
        "new": 'straight',
        "branchJoint": 'quadratic',
        "extendingTrack": 'cubic',
        "branchCurve": 'cubic',
    },
    "branchCurve": {
        "new": 'cubic',
        "branchJoint": 'cubic',
        "extendingTrack": 'cubic',
        "branchCurve": 'cubic',
    },
}

function getPreviewCurveType(startJoint: NewJointType, endJoint: NewJointType): PreviewCurveType {
    return CURVE_TYPE_FOR_JOINT_COMBINATIONS[startJoint.type][endJoint.type];
}

function test(startJoint: NewJointType, endJoint: NewJointType) {
    const curveType = getPreviewCurveType(startJoint, endJoint);
    switch(curveType) {
        case 'straight':
            break;
        case 'quadratic':
            break;
        case 'cubic':
            break;
        default:
            break;
    }
}


