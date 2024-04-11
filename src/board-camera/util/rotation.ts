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
