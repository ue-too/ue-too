/**
 * @description The limits of the rotation.
 * 
 * @category Camera
 */
export type RotationLimits = {start: number, end: number, ccw: boolean, startAsTieBreaker: boolean};

/**
 * @description The boundary of the rotation. (experimental)
 * 
 * @category Camera
 */
export type RotationBoundary = {start: number, end: number, positiveDirection: boolean, startAsTieBreaker: boolean};

/**
 * @description Clamps the rotation within the limits.
 * 
 * @category Camera
 */
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

/**
 * @description Checks if the rotation is within the limits.
 * 
 * @category Camera
 */
export function rotationWithinLimits(rotation: number, rotationLimits?: RotationLimits): boolean{
    if(rotationLimits === undefined){
        return true;
    }
    if(normalizeAngleZero2TwoPI(rotationLimits.start) === normalizeAngleZero2TwoPI(rotationLimits.end)){
        return true;
    }
    if(normalizeAngleZero2TwoPI(rotationLimits.start + 0.01) === normalizeAngleZero2TwoPI(rotationLimits.end + 0.01)){
        return true;
    }
    const normalizedRotation = normalizeAngleZero2TwoPI(rotation);
    const angleSpanFromStart = angleSpan(rotationLimits.start, normalizedRotation);
    const angleSpanFromEnd = angleSpan(rotationLimits.end, normalizedRotation);
    if((rotationLimits.ccw && (angleSpanFromStart < 0 || angleSpanFromEnd > 0)) || (!rotationLimits.ccw && (angleSpanFromStart > 0 || angleSpanFromEnd < 0))){
        return false;
    }
    return true;
}

/**
 * @description Checks if the rotation is within the boundary. (experimental)
 * 
 * @category Camera
 */
export function rotationWithinBoundary(rotation: number, rotationBoundary: RotationBoundary): boolean {
    if(normalizeAngleZero2TwoPI(rotationBoundary.start) === normalizeAngleZero2TwoPI(rotationBoundary.end)){
        return true;
    }
    if(normalizeAngleZero2TwoPI(rotationBoundary.start + 0.01) === normalizeAngleZero2TwoPI(rotationBoundary.end + 0.01)){
        return true;
    }
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

/**
 * @description Normalizes the angle to be between 0 and 2π.
 * 
 * @category Camera
 */
export function normalizeAngleZero2TwoPI(angle: number){
    // reduce the angle  
    angle = angle % (Math.PI * 2);

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI 
    angle = (angle + Math.PI * 2) % (Math.PI * 2); 
    return angle;
}

/**
 * @description Gets the smaller angle span between two angles. (in radians)
 * 
 * @category Camera
 */
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

/**
 * @description Converts degrees to radians.
 * 
 * @category Camera
 */
export function deg2rad(deg: number): number{
    return deg * Math.PI / 180;
}

/**
 * @description Converts radians to degrees.
 * 
 * @category Camera
 */
export function rad2deg(rad: number): number{
    return rad * 180 / Math.PI;
}
