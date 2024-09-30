export type RotationLimits = {start: number, end: number, ccw: boolean, startAsTieBreaker: boolean};
export type RotationBoundary = {start: number, end: number, positiveDirection: boolean, startAsTieBreaker: boolean};

export function clampRotation(rotation: number, rotationLimits?: RotationLimits): number{
    if(rotationWithinLimits(rotation, rotationLimits) || rotationLimits === undefined){
        return rotation;
    }
    rotation = normalizeAngleZero2TwoPI(rotation);
    const angleSpanFromStart = angleSpan(rotationLimits.start, rotation);
    const angleSpanFromEnd = angleSpan(rotationLimits.end, rotation);
    if((rotationLimits.ccw && (angleSpanFromStart < 0 || angleSpanFromEnd > 0)) || (!rotationLimits.ccw && (angleSpanFromStart > 0 || angleSpanFromEnd < 0))){
        // ccw out of bounds
        if(Math.abs(angleSpanFromStart) === Math.abs(angleSpanFromEnd)){
            // console.log("tie", "start:", rotationLimits.start, "end:", rotationLimits.end, "rotation:", rotation);
            return rotationLimits.startAsTieBreaker ? rotationLimits.start : rotationLimits.end;
        }
        const closerToStart = Math.abs(angleSpanFromStart) < Math.abs(angleSpanFromEnd);
        return closerToStart ? rotationLimits.start : rotationLimits.end;
    }
    return rotation;
}

export function rotationWithinLimits(rotation: number, rotationLimits?: RotationLimits): boolean{
    if(rotationLimits === undefined){
        return true;
    }
    const angleSpanFromStart = angleSpan(rotationLimits.start, rotation);
    const angleSpanFromEnd = angleSpan(rotationLimits.end, rotation);
    if((rotationLimits.ccw && (angleSpanFromStart < 0 || angleSpanFromEnd > 0)) || (!rotationLimits.ccw && (angleSpanFromStart > 0 || angleSpanFromEnd < 0))){
        return false;
    }
    return true;
}

export function rotationWithinBoundary(rotation: number, rotationBoundary: RotationBoundary): boolean {
    const normalizedRotation = normalizeAngleZero2TwoPI(rotation);

    let angleFromStart = normalizedRotation - normalizeAngleZero2TwoPI(rotationBoundary.start);
    if (angleFromStart < 0){
        angleFromStart += (Math.PI * 2);
    }
    if (!rotationBoundary.positiveDirection && angleFromStart > 0){
        angleFromStart = Math.PI * 2 - angleFromStart;
    }

    let angleRange = normalizeAngleZero2TwoPI(rotationBoundary.end) - normalizeAngleZero2TwoPI(rotationBoundary.start);
    if(angleRange < 0){
        angleRange += (Math.PI * 2);
    }
    if(!rotationBoundary.positiveDirection && angleRange > 0){
        angleRange = Math.PI * 2 - angleRange;
    }

    return angleRange >= angleFromStart;
}

export function normalizeAngleZero2TwoPI(angle: number){
    // reduce the angle  
    angle = angle % (Math.PI * 2);

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI 
    angle = (angle + Math.PI * 2) % (Math.PI * 2); 
    return angle;
}

export function angleSpan(from: number, to: number): number{
    // in radians
    from = normalizeAngleZero2TwoPI(from);
    to = normalizeAngleZero2TwoPI(to);
    let angleDiff = to - from;
    
    if(angleDiff > Math.PI){
        angleDiff = - (Math.PI * 2 - angleDiff);
    }

    if(angleDiff < -Math.PI){
        angleDiff += (Math.PI * 2);
    }
    return angleDiff;
}

export function deg2rad(deg: number): number{
    return deg * Math.PI / 180;
}

export function rad2deg(rad: number): number{
    return rad * 180 / Math.PI;
}
