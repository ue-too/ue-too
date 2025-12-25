import { PointCal } from "@ue-too/math";
import { Line } from "./line";

const T = [
    -0.0640568928626056260850430826247450385909,
    0.0640568928626056260850430826247450385909,
    -0.1911188674736163091586398207570696318404,
    0.1911188674736163091586398207570696318404,
    -0.3150426796961633743867932913198102407864,
    0.3150426796961633743867932913198102407864,
    -0.4337935076260451384870842319133497124524,
    0.4337935076260451384870842319133497124524,
    -0.5454214713888395356583756172183723700107,
    0.5454214713888395356583756172183723700107,
    -0.6480936519369755692524957869107476266696,
    0.6480936519369755692524957869107476266696,
    -0.7401241915785543642438281030999784255232,
    0.7401241915785543642438281030999784255232,
    -0.8200019859739029219539498726697452080761,
    0.8200019859739029219539498726697452080761,
    -0.8864155270044010342131543419821967550873,
    0.8864155270044010342131543419821967550873,
    -0.9382745520027327585236490017087214496548,
    0.9382745520027327585236490017087214496548,
    -0.9747285559713094981983919930081690617411,
    0.9747285559713094981983919930081690617411,
    -0.9951872199970213601799974097007368118745,
    0.9951872199970213601799974097007368118745,
];

const C = [
    0.1279381953467521569740561652246953718517,
    0.1279381953467521569740561652246953718517,
    0.1258374563468282961213753825111836887264,
    0.1258374563468282961213753825111836887264,
    0.121670472927803391204463153476262425607,
    0.121670472927803391204463153476262425607,
    0.1155056680537256013533444839067835598622,
    0.1155056680537256013533444839067835598622,
    0.1074442701159656347825773424466062227946,
    0.1074442701159656347825773424466062227946,
    0.0976186521041138882698806644642471544279,
    0.0976186521041138882698806644642471544279,
    0.086190161531953275917185202983742667185,
    0.086190161531953275917185202983742667185,
    0.0733464814110803057340336152531165181193,
    0.0733464814110803057340336152531165181193,
    0.0592985849154367807463677585001085845412,
    0.0592985849154367807463677585001085845412,
    0.0442774388174198061686027482113382288593,
    0.0442774388174198061686027482113382288593,
    0.0285313886289336631813078159518782864491,
    0.0285313886289336631813078159518782864491,
    0.0123412297999871995468056670700372915759,
    0.0123412297999871995468056670700372915759,
];

type ArcLengthLUT = {
    controlPoints: Point[];
    arcLengthLUT: {tVal: number, length: number}[];
}

type AdvanceAtTWithLengthWithinCurveRes = {
    type: "withinCurve";
    tVal: number;
    point: Point;
}

type AdvanceAtWithLengthBeforeCurveRes = {
    type: "beforeCurve";
    remainLength: number;
}

type AdvanceAtWithLengthAfterCurveRes = {
    type: "afterCurve";
    remainLength: number;
}

type AdvanceAtTWithLengthOutofCurveRes = AdvanceAtWithLengthBeforeCurveRes | AdvanceAtWithLengthAfterCurveRes;

type AdvanceAtTWithLengthRes = AdvanceAtTWithLengthWithinCurveRes | AdvanceAtTWithLengthOutofCurveRes;

/**
 * Bezier curve class supporting quadratic (3 points) and cubic (4 points) curves.
 *
 * @remarks
 * BCurve provides a comprehensive implementation of Bezier curves with:
 * - Curve evaluation at any parameter t (0 to 1)
 * - Arc-length calculation with caching for performance
 * - Curve splitting and subdivision
 * - Geometric queries (projection, intersection, extrema)
 * - Advanced operations (offset, arc fitting, curvature)
 *
 * ## Performance Optimizations
 * - Optimized formulas for quadratic and cubic curves
 * - Arc-length caching to avoid recomputation
 * - Lazy computation of lookup tables (LUT)
 * - Gauss-Legendre quadrature for arc-length calculation
 *
 * ## Coordinate System
 * - Parameter t ranges from 0 (start) to 1 (end)
 * - Points use {x, y} coordinates
 * - Supports 2D curves (z-coordinate optional but not used)
 *
 * @example
 * Create and evaluate a cubic Bezier curve
 * ```typescript
 * const curve = new BCurve([
 *   { x: 0, y: 0 },     // Start point
 *   { x: 33, y: 100 },  // Control point 1
 *   { x: 66, y: 100 },  // Control point 2
 *   { x: 100, y: 0 }    // End point
 * ]);
 *
 * // Evaluate at different positions
 * const start = curve.get(0);    // { x: 0, y: 0 }
 * const mid = curve.get(0.5);    // Midpoint
 * const end = curve.get(1);      // { x: 100, y: 0 }
 *
 * // Get curve length
 * console.log('Length:', curve.fullLength);
 *
 * // Get derivative (tangent vector)
 * const tangent = curve.derivative(0.5);
 * ```
 *
 * @category Bezier Curves
 */
export class BCurve{

    private controlPoints: Point[];
    private dControlPoints: Point[] = [];
    private arcLengthLUT: ArcLengthLUT = {controlPoints: [], arcLengthLUT: []};
    private _fullLength: number;
    private lengthCache: Map<number, number> = new Map(); // Cache for lengthAtT results

    /**
     * Gets cache statistics for performance monitoring
     * @returns Object containing cache size and hit rate information
     */
    public getCacheStats(): {size: number, hitRate: number} {
        return {
            size: this.lengthCache.size,
            hitRate: 0 // This would need to be tracked separately if needed
        };
    }

    /**
     * Pre-warms the cache with commonly used t values for better performance
     * @param steps Number of steps to pre-cache (default: 100)
     */
    public preWarmCache(steps: number = 100): void {
        const tSteps = 1 / steps;
        for (let tVal = 0; tVal <= 1; tVal += tSteps) {
            this.lengthAtT(tVal);
        }
    }

    private clearCache(): void {
        this.lengthCache.clear();
    }

    constructor(controlPoints: Point[]){
        this.controlPoints = controlPoints;
        this.dControlPoints = this.getDerivativeControlPoints(this.controlPoints);
        this._fullLength = this.calculateFullLength();
        // Make arc length LUT lazy - only compute when needed
        this.arcLengthLUT = { controlPoints: [], arcLengthLUT: [] };
        this.clearCache(); // Clear cache on initialization
    }

    public getPointbyPercentage(percentage: number){ // this is the percentage of the curve length, not the t value
        // this leaves room for optimization
        let controlPointsChangedSinceLastArcLengthLUT = this.arcLengthLUT.controlPoints.length != this.controlPoints.length;
        controlPointsChangedSinceLastArcLengthLUT = controlPointsChangedSinceLastArcLengthLUT || this.arcLengthLUT.controlPoints.reduce((prevVal, curVal, index)=>{
            return prevVal || !PointCal.isEqual(curVal, this.controlPoints[index]);
        }, false);
        let points: number[] = [];
        if (controlPointsChangedSinceLastArcLengthLUT){
            this.arcLengthLUT = this.getArcLengthLUT(1000);
        }
        points = [...this.arcLengthLUT.arcLengthLUT.map((item)=>item.length)];
        let targetLength = percentage * this.fullLength;
        let low = 0;
        let high = points.length - 1;
        while (low <= high){
            let mid = Math.floor((low + high) / 2);
            if (points[mid] == targetLength){
                return this.get((mid + 1) / points.length);
            } else if (points[mid] < targetLength){
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return low >= points.length ? this.get(1) : this.get((low + 1) / points.length);
    }

    public getDerivativeControlPoints(controlPoints: Point[]): Point[]{
        const derivativeControlPoints: Point[] = [];
        for(let index = 1; index < controlPoints.length; index++){
            derivativeControlPoints.push(PointCal.multiplyVectorByScalar(PointCal.subVector(controlPoints[index], controlPoints[index - 1]), controlPoints.length - 1));
        }
        return derivativeControlPoints;
    }

    private validateTVal(tVal: number){
        if (tVal > 1 || tVal < 0){
            throw new TValOutofBoundError("tVal is greater than 1 or less than 0");
        }
    }

    public getControlPoints(): Point[]{
        return this.controlPoints;
    }

    setControlPoints(controlPoints: Point[]){
        this.controlPoints = controlPoints;
        this.dControlPoints = this.getDerivativeControlPoints(this.controlPoints);
        this._fullLength = this.calculateFullLength();
        // Reset LUT to trigger lazy computation when needed
        this.arcLengthLUT = { controlPoints: [], arcLengthLUT: [] };
        this.clearCache(); // Clear cache on control point change
    }

    setControlPointAtIndex(index: number, newPoint: Point): boolean{
        if (index < 0 || index >= this.controlPoints.length){
            return false;
        }
        this.controlPoints[index] = newPoint;
        this.dControlPoints = this.getDerivativeControlPoints(this.controlPoints);
        this._fullLength = this.calculateFullLength();
        // Reset LUT to trigger lazy computation when needed
        this.arcLengthLUT = { controlPoints: [], arcLengthLUT: [] };
        this.clearCache(); // Clear cache on control point change
        return true;
    }

    public compute(tVal: number): Point{
        this.validateTVal(tVal);
        let points = this.controlPoints;
        while (points.length > 1) {
            let lowerLevelPoints = points.slice(1);
            for(let index = 0; index < lowerLevelPoints.length; index++){
                lowerLevelPoints[index] = PointCal.addVector(PointCal.multiplyVectorByScalar(points[index], (1 - tVal)), PointCal.multiplyVectorByScalar(points[index + 1], tVal));
            }
            points = lowerLevelPoints;
        }
        return points[0];
    }

    public get(tVal: number): Point {
        this.validateTVal(tVal);
        if (this.controlPoints.length == 3) {
            let firstTerm = PointCal.multiplyVectorByScalar(this.controlPoints[0], (1 - tVal) * (1 - tVal));
            let secondTerm = PointCal.multiplyVectorByScalar(this.controlPoints[1], 2 * (1 - tVal) * tVal);
            let thirdTerm = PointCal.multiplyVectorByScalar(this.controlPoints[2], tVal * tVal);
            let res = PointCal.addVector(PointCal.addVector(firstTerm, secondTerm), thirdTerm);
            return res;
        }
        if (this.controlPoints.length == 4){
            let firstTerm = PointCal.multiplyVectorByScalar(this.controlPoints[0], (1 - tVal) * (1 - tVal) * (1 - tVal));
            let secondTerm = PointCal.multiplyVectorByScalar(this.controlPoints[1], 3 * (1 - tVal) * (1 - tVal) * tVal);
            let thirdTerm = PointCal.multiplyVectorByScalar(this.controlPoints[2], 3 * (1 - tVal) * tVal * tVal);
            let forthTerm = PointCal.multiplyVectorByScalar(this.controlPoints[3], tVal * tVal * tVal);
            let res = PointCal.addVector(PointCal.addVector(firstTerm, secondTerm), PointCal.addVector(thirdTerm, forthTerm));
            return res;
        }
        return this.compute(tVal);
    }

    public getLUT(steps: number = 100){
        const stepSpan = 1 / steps;
        const res: Point[] = [];
        let tVal = 0;
        res.push(this.get(tVal));
        for(let index = 0; index < steps; index += 1){
            tVal += stepSpan;
            if((tVal > 1 && tVal - stepSpan < 1) || index == steps - 1){
                tVal = 1;
            }
            res.push(this.get(tVal));
        }
        return res
    }

    public getLUTWithTVal(steps?: number){
        if (steps == undefined){
            steps = 100;
        }
        const stepSpan = 1 / steps;
        const res: {point: Point, tVal: number}[] = [];
        let tVal = 0;
        res.push({point: this.get(tVal), tVal: tVal});
        for(let index = 0; index < steps; index += 1){
            tVal += stepSpan;
            if((tVal > 1 && tVal - stepSpan < 1) || index == steps - 1){
                tVal = 1;
            }
            res.push({point: this.get(tVal), tVal: tVal});
        }
        return res
    }

    get fullLength(): number{
        return this._fullLength;
    }

    private calculateFullLength(): number{
        return this.lengthAtT(1);
    }

    public lengthAtT(tVal: number): number{
        this.validateTVal(tVal);
        
        // Check cache first
        const cacheKey = Math.round(tVal * 1000000) / 1000000; // Round to 6 decimal places for cache key
        if (this.lengthCache.has(cacheKey)) {
            return this.lengthCache.get(cacheKey)!;
        }
        
        const z = tVal / 2, len = T.length;
        let sum = 0;
        for (let i = 0, t: number; i < len; i++) {
            t = z * T[i] + z;
            sum += C[i] * PointCal.magnitude(this.derivative(t));
        }
        const result = z * sum;
        
        // Cache the result
        this.lengthCache.set(cacheKey, result);
        
        return result;
    }

    public derivative(tVal: number): Point{
        return computeWithControlPoints(tVal, this.dControlPoints);
    }

    public derivativeNormalized(tVal: number): Point{
        return PointCal.unitVector(computeWithControlPoints(tVal, this.dControlPoints));
    }

    public getArcLengthLUT(steps: number = 50): {controlPoints: Point[], arcLengthLUT: {tVal: number, length: number}[]}{
        // Check if we need to recompute the LUT
        const controlPointsChanged = this.arcLengthLUT.controlPoints.length !== this.controlPoints.length ||
            this.arcLengthLUT.controlPoints.some((cp, index) => !PointCal.isEqual(cp, this.controlPoints[index]));
        
        if (controlPointsChanged || this.arcLengthLUT.arcLengthLUT.length === 0) {
            // Clear cache when regenerating LUT to ensure consistency
            this.clearCache();
            
            let res = [];
            let tSteps = 1 / steps;
            for(let tVal = 0; tVal <= 1; tVal += tSteps){
                res.push({tVal: tVal, length: this.lengthAtT(tVal)});
            }
            this.arcLengthLUT = {controlPoints: [...this.controlPoints], arcLengthLUT: res};
        }
        
        return this.arcLengthLUT;
    }

    splitIntoCurves(tVal: number): [BCurve, BCurve]{
        const res = this.split(tVal);
        return [new BCurve(res[0]), new BCurve(res[1])];
    }

    public split(tVal: number): [Point[], Point[]]{
        this.validateTVal(tVal);
        if (this.controlPoints.length == 3){
            let newControlPoint1 = this.controlPoints[0];
            let newControlPoint2 = PointCal.subVector(PointCal.multiplyVectorByScalar(this.controlPoints[1], tVal), PointCal.multiplyVectorByScalar(this.controlPoints[0], tVal - 1));
            let newControlPoint3 = PointCal.subVector(PointCal.multiplyVectorByScalar(this.controlPoints[2], tVal * tVal), PointCal.multiplyVectorByScalar(this.controlPoints[1], 2 * tVal * (tVal - 1)));
            newControlPoint3 = PointCal.addVector(newControlPoint3, PointCal.multiplyVectorByScalar(this.controlPoints[0], (tVal - 1) * (tVal - 1)));
            let newControlPoint4 = PointCal.subVector(PointCal.multiplyVectorByScalar(this.controlPoints[2], tVal), PointCal.multiplyVectorByScalar(this.controlPoints[1], tVal - 1));
            let newControlPoint5 = this.controlPoints[2];
            return [[newControlPoint1, newControlPoint2, newControlPoint3], [newControlPoint3, newControlPoint4, newControlPoint5]];
        }
        let newControlPoint1 = this.controlPoints[0];
        let newControlPoint2 = PointCal.subVector(PointCal.multiplyVectorByScalar(this.controlPoints[1], tVal), PointCal.multiplyVectorByScalar(this.controlPoints[0], (tVal - 1)));
        let newControlPoint3 = PointCal.addVector(PointCal.multiplyVectorByScalar(this.controlPoints[2], tVal * tVal), PointCal.addVector(PointCal.multiplyVectorByScalar(this.controlPoints[1], -(2 * tVal * (tVal - 1))), PointCal.multiplyVectorByScalar(this.controlPoints[0], (tVal - 1) * (tVal - 1))));
        let term1 = PointCal.multiplyVectorByScalar(this.controlPoints[3], tVal * tVal * tVal);
        let term2 = PointCal.multiplyVectorByScalar(this.controlPoints[2], -(3 * tVal * tVal * (tVal - 1)));
        let term3 = PointCal.multiplyVectorByScalar(this.controlPoints[1], 3 * tVal * (tVal - 1) * (tVal - 1));
        let term4 = PointCal.multiplyVectorByScalar(this.controlPoints[0], -((tVal - 1) * (tVal - 1) * (tVal - 1)));
        let newControlPoint4 = PointCal.addVector(term4, PointCal.addVector(term3, PointCal.addVector(term1, term2)));
        let newControlPoint5 = PointCal.addVector(PointCal.addVector(PointCal.multiplyVectorByScalar(this.controlPoints[3], tVal * tVal), PointCal.multiplyVectorByScalar(this.controlPoints[2], -(2 *  tVal * (tVal - 1)))), PointCal.multiplyVectorByScalar(this.controlPoints[1], (tVal - 1) * (tVal - 1)));
        let newControlPoint6 = PointCal.addVector(PointCal.multiplyVectorByScalar(this.controlPoints[3], tVal), PointCal.multiplyVectorByScalar(this.controlPoints[2], -(tVal - 1)));
        let newControlPoint7 = this.controlPoints[3];

        return [[newControlPoint1, newControlPoint2, newControlPoint3, newControlPoint4], [newControlPoint4, newControlPoint5, newControlPoint6, newControlPoint7]];
    }

   splitIn3WithControlPoints(tVal: number, tVal2: number): [Point[], Point[], Point[]]{
        if(tVal2 < tVal){
            console.warn("tVal2 is less than tVal, swapping them");
            [tVal, tVal2] = [tVal2, tVal];
        }

        const firstSplit = this.split(tVal);

        const secondHalf = new BCurve(firstSplit[1]);

        const mappedTVal2 = map(tVal2, tVal, 1, 0, 1);
        
        const secondSplit = secondHalf.split(mappedTVal2);

        return [firstSplit[0], secondSplit[0], secondSplit[1]];
    }

   splitIn3Curves(tVal: number, tVal2: number): [BCurve, BCurve, BCurve]{
        if(tVal2 < tVal){
            console.warn("tVal2 is less than tVal, swapping them");
            [tVal, tVal2] = [tVal2, tVal];
        }

        const firstSplit = this.split(tVal);

        const secondHalf = new BCurve(firstSplit[1]);
        
        const mappedTVal2 = map(tVal2, tVal, 1, 0, 1);
        const secondSplit = secondHalf.split(mappedTVal2);

        return [new BCurve(firstSplit[0]), new BCurve(secondSplit[0]), new BCurve(secondSplit[1])];
    }

    splitAndTakeMidCurve(tVal: number, tVal2: number): BCurve{
        const [firstSplit, secondSplit, thirdSplit] = this.splitIn3Curves(tVal, tVal2);
        return secondSplit;
    }

    getProjection(point: Point){
        const threshold = 0.00001;
        let distance = Number.MAX_VALUE;
        let preliminaryProjectionTVal: number = 0;
        let preliminaryProjectionPoint: Point = this.get(0);
        let preliminaryProjectionIndex: number = 0;
        const LUT = this.getLUTWithTVal(500);
        LUT.forEach((curvePoint, index)=>{
            const curDistance = PointCal.distanceBetweenPoints(curvePoint.point, point);
            if(curDistance < distance){
                distance = curDistance;
                preliminaryProjectionPoint = {...curvePoint.point};
                preliminaryProjectionTVal = curvePoint.tVal;
                preliminaryProjectionIndex = index;
            }
        });
        // console.log(preliminaryProjectionIndex, preliminaryProjectionPoint, preliminaryProjectionTVal);
        let low = LUT[preliminaryProjectionIndex].tVal;
        let high = LUT[preliminaryProjectionIndex].tVal;
        if (preliminaryProjectionIndex < LUT.length - 1){
            high = LUT[preliminaryProjectionIndex + 1].tVal;
        }
        if (preliminaryProjectionIndex > 0){
            low = LUT[preliminaryProjectionIndex - 1].tVal;
        }
        while(low < high && high - low > threshold){
            let mid = low + (high - low) / 2;
            let halfSpan = mid - low;
            let lowMidMid = mid + halfSpan / 2;
            let highMidMid = mid + halfSpan / 2;
            let prevDist = distance;

            
            if(lowMidMid <= 1 && lowMidMid >= 0){
                let curDist = PointCal.distanceBetweenPoints(this.get(lowMidMid), point);
                if (curDist < distance){
                    distance = curDist;
                    preliminaryProjectionPoint = this.get(lowMidMid);
                    preliminaryProjectionTVal = lowMidMid;
                    high = lowMidMid + halfSpan / 2;
                    low = lowMidMid - halfSpan / 2;
                }
            }
            if(highMidMid <= 1 && highMidMid >= 0){
                let curDist = PointCal.distanceBetweenPoints(this.get(highMidMid), point);
                if (curDist < distance){
                    distance = curDist;
                    preliminaryProjectionPoint = this.get(highMidMid);
                    preliminaryProjectionTVal = highMidMid;
                    high = highMidMid + halfSpan / 2;
                    low = highMidMid - halfSpan / 2;
                }
            }
            if (prevDist == distance){
                break;
            }
        }
        return {projection: preliminaryProjectionPoint, tVal: preliminaryProjectionTVal};
    }

    public findArcs(errorThreshold: number){
        let low = 0;
        const res: {center: Point, radius: number, startPoint: Point, startT: number, endPoint: Point, endT: number}[] = [];

        while (low < 1){
            let loopRes = this.findArcStartingAt(errorThreshold, low);
            if (loopRes == null || loopRes.arc == undefined) {
                break;
            }
            res.push(loopRes.arc);
            low = loopRes.arc.endT;
            if(low >= 1){
                break;
            }
        }
        return res;
    }

    public findArcStartingAt(errorThreshold: number, low: number){
        let high = 1;
        let mid = low + (high - low) / 2;
        let prevArc:{good: boolean, arc?: {center: Point, radius: number, startPoint: Point, endPoint: Point, startT: number, endT: number}} = {good: false};
        let count = 0;
        while(true){
            count++;
            mid = low + (high - low) / 2;
            if (high > 1 || mid > 1){
                if (prevArc.good){
                    return prevArc;
                } else {
                    return null;
                }
                
            }
            const lowPoint = this.get(low);
            const highPoint = this.get(high);
            const midPoint = this.get(mid);
            const fitArcRes = this.fitArc(lowPoint, highPoint, midPoint);
            if (!fitArcRes.exists || fitArcRes.center == null || fitArcRes.radius == null){
                return null;
            }
            const n = high - mid;
            const e1 = mid -  n / 2;
            const e2 = mid + n / 2;
            const checkPoint1 = this.get(e1);
            const checkPoint2 = this.get(e2);
            const checkRadius = PointCal.distanceBetweenPoints(checkPoint1, fitArcRes.center);
            const checkRadius2 = PointCal.distanceBetweenPoints(checkPoint2, fitArcRes.center);
            if (Math.abs(checkRadius - fitArcRes.radius) > errorThreshold || Math.abs(checkRadius2 - fitArcRes.radius) > errorThreshold){
                // arc is bad
                if (prevArc.good == true){
                    return prevArc;
                }
                prevArc.good = false;
                high = mid
            } else {
                prevArc.good = true;
                if (fitArcRes.startPoint !== undefined && fitArcRes.endPoint !== undefined){
                    prevArc.arc = { center: fitArcRes.center, radius: fitArcRes.radius, startPoint: fitArcRes.startPoint, endPoint: fitArcRes.endPoint, startT: low, endT: high};
                }
                high = high + (mid - low);
            }
        }
    }

    public fitArc(startPoint: Point, endPoint: Point, midPoint: Point): {exists: boolean, center?: Point, radius?: number, startPoint?: Point, endPoint?: Point}{
        const M11 = [[startPoint.x, startPoint.y, 1], [midPoint.x, midPoint.y, 1], [endPoint.x, endPoint.y, 1]];
        if (this.determinant3by3(M11) == 0) {
            // three points lie on a line no circle
            return {exists: false};
        }
        const M12 = [[startPoint.x * startPoint.x + startPoint.y * startPoint.y, startPoint.y, 1], 
                     [midPoint.x * midPoint.x + midPoint.y * midPoint.y, midPoint.y, 1],
                     [endPoint.x * endPoint.x + endPoint.y * endPoint.y, endPoint.y, 1]];
        const M13 = [[startPoint.x * startPoint.x + startPoint.y * startPoint.y, startPoint.x, 1],
                     [midPoint.x * midPoint.x + midPoint.y * midPoint.y, midPoint.x, 1],
                     [endPoint.x * endPoint.x + endPoint.y * endPoint.y, endPoint.x, 1]];
        const M14 = [[startPoint.x * startPoint.x + startPoint.y * startPoint.y, startPoint.x, startPoint.y],
                     [midPoint.x * midPoint.x + midPoint.y * midPoint.y, midPoint.x, midPoint.y],
                     [endPoint.x * endPoint.x + endPoint.y * endPoint.y, endPoint.x, endPoint.y]]
        const centerX = (1 / 2) * (this.determinant3by3(M12) / this.determinant3by3(M11));
        const centerY = (-1 / 2) * (this.determinant3by3(M13) / this.determinant3by3(M11));
        const radius = Math.sqrt(centerX * centerX + centerY * centerY + (this.determinant3by3(M14) / this.determinant3by3(M11)))
        return {exists: true, center: {x: centerX, y:centerY}, radius: radius, startPoint: startPoint, endPoint: endPoint};
    }

    public determinant3by3(matrix: number[][]): number{
        const a = matrix[0][0];
        const b = matrix[0][1];
        const c = matrix[0][2];
        const d = matrix[1][0];
        const e = matrix[1][1];
        const f = matrix[1][2];
        const g = matrix[2][0];
        const h = matrix[2][1];
        const i = matrix[2][2];
        return a * (e * i - f * h) - b * (d * i - g * f) + c * (d * h - e * g);
    }

    public curvature(tVal: number): number{
        const derivative = computeWithControlPoints(tVal, this.dControlPoints);
        const secondDerivative = computeWithControlPoints(tVal, this.getDerivativeControlPoints(this.dControlPoints));
        const numerator = derivative.x * secondDerivative.y - secondDerivative.x * derivative.y;
        const denominator = Math.pow(derivative.x * derivative.x + derivative.y * derivative.y, 3 / 2);
        if (denominator == 0) return NaN;
        return numerator / denominator;
    }

    secondDerivative(tVal: number): Point{
        return computeWithControlPoints(tVal, this.getDerivativeControlPoints(this.dControlPoints));
    }

    public getCoefficientOfTTerms(): Point[]{
        return this.getCoefficientOfTTermsWithControlPoints(this.controlPoints);
    }

    public getDerivativeCoefficients(): Point[]{
        return this.getCoefficientOfTTermsWithControlPoints(this.dControlPoints);
    }

    public getCoefficientOfTTermsWithControlPoints(controlPoints: Point[]): Point[]{
        const terms: Point[] = [];
        let matrix: number[][] = [];
        if(controlPoints.length == 3){
            matrix = [[1, 0, 0], [-2, 2, 0], [1, -2, 1]];
        } else if (controlPoints.length == 4){
            matrix = [[1, 0, 0, 0], [-3, 3, 0, 0], [3, -6, 3, 0], [-1, 3, -3, 1]];
        } else if(controlPoints.length == 2){
            matrix = [[1, 0], [-1, 1]];
        } 
        else {
            throw new Error("number of control points is wrong");
        }
        for(let index = 0; index < controlPoints.length; index++){
            terms.push(controlPoints.reduce((prevVal, curVal, jindex)=>{
                return {x: prevVal.x + matrix[index][jindex] * curVal.x, y: prevVal.y + matrix[index][jindex] * curVal.y};
            }, {x: 0, y: 0}));
        }
        return terms;
    }

    getControlPointsAlignedWithXAxis(){
        const alignedAxis = PointCal.unitVectorFromA2B(this.controlPoints[0], this.controlPoints[this.controlPoints.length - 1]);
        const angle = PointCal.angleFromA2B({x:1, y:0}, alignedAxis);
        const startingPoint = this.controlPoints[0];
        const res = [{x: 0, y: 0}];
        for(let index = 1; index < this.controlPoints.length; index++){
            const vector = PointCal.subVector(this.controlPoints[index], startingPoint);
            const rotatedVector = PointCal.rotatePoint(vector, -angle);
            res.push(rotatedVector);
        }
        return res;
    }

    getExtrema():{x: number[], y: number[]}{
        const res: {x: number[], y: number[]} = {x: [], y: []};
        const derivativeCoefficients = this.getDerivativeCoefficients();
        let xCoefficients = [0, 0, 0, 0];
        let yCoefficients = [0, 0, 0, 0];
        derivativeCoefficients.forEach((coefficient, index)=>{
            xCoefficients[3 - index] = coefficient.x;
            yCoefficients[3 - index] = coefficient.y;
        });

        const xRoots = solveCubic(xCoefficients[0], xCoefficients[1], xCoefficients[2], xCoefficients[3]);
        const yRoots = solveCubic(yCoefficients[0], yCoefficients[1], yCoefficients[2], yCoefficients[3]);
        xRoots.forEach((root)=>{
            if(root >= 0 && root <= 1){
                res.x.push(root);
            }
        });
        yRoots.forEach((root)=>{
            if(root >= 0 && root <= 1){
                res.y.push(root);
            }
        });
        
        if(derivativeCoefficients.length >= 3){
            xCoefficients = [0, 0, 0, 0];
            yCoefficients = [0, 0, 0, 0];
            const secondDerivativeCoefficients = this.getCoefficientOfTTermsWithControlPoints(this.getDerivativeControlPoints(this.dControlPoints));
            secondDerivativeCoefficients.forEach((coefficient, index)=>{
                xCoefficients[3 - index] = coefficient.x;
                yCoefficients[3 - index] = coefficient.y;
            })
            const secondXRoots = solveCubic(xCoefficients[0], xCoefficients[1], xCoefficients[2], xCoefficients[3]);
            const secondYRoots = solveCubic(yCoefficients[0], yCoefficients[1], yCoefficients[2], yCoefficients[3]);
            secondXRoots.forEach((root)=>{
                if(root >= 0 && root <= 1){
                    res.x.push(root);
                }
            });
            secondYRoots.forEach((root)=>{
                if(root >= 0 && root <= 1){
                    res.y.push(root);
                }
            });

        }
        return res;        
    }

    translateRotateControlPoints(translation: Point, rotationAngle: number){
        // rotation is in radians
        const res: Point[] = [];
        for(let index = 0; index < this.controlPoints.length; index++){
            res.push(PointCal.rotatePoint(PointCal.addVector(this.controlPoints[index], translation), rotationAngle));
        }
        return res;
    }

    getLineIntersections(line: Line): number[]{
        const translationRotation = line.getTranslationRotationToAlginXAxis();
        const res: number[] = [];
        const alignedControlPoints = this.translateRotateControlPoints(translationRotation.translation, translationRotation.rotationAngle);
        const coefficients = this.getCoefficientOfTTermsWithControlPoints(alignedControlPoints);
        let yCoefficients = [0, 0, 0, 0];
        coefficients.forEach((coefficient, index)=>{
            yCoefficients[3 - index] = coefficient.y;
        });

        const yRoots = solveCubic(yCoefficients[0], yCoefficients[1], yCoefficients[2], yCoefficients[3]);
        yRoots.forEach((root)=>{
            if(root >= 0 && root <= 1){
                if(line.pointInLine(this.get(root))){
                    res.push(root);
                }
            }
        });

        return res;
    }

    getSelfIntersections(): {selfT: number, otherT: number}[]{
        const [subCurveControlPoints1, subCurveControlPoints2] = this.split(0.5);
        const subCurve1 = new BCurve(subCurveControlPoints1);
        const subCurve2 = new BCurve(subCurveControlPoints2);
        let initialRes = getIntersectionsBetweenCurves(subCurve1, subCurve2);
        initialRes.forEach((intersection)=>{
            intersection.selfT = intersection.selfT * 0.5;
            intersection.otherT = intersection.otherT * 0.5 + 0.5;
        });
        initialRes.shift();
        return initialRes;
    }

    getCircleIntersections(circleCenter: Point, circleRadius: number): {intersection: Point, tVal: number}[]{
        const LUT = this.getLUTWithTVal(500);
        let distanceError = Number.MAX_VALUE;
        let preliminaryIntersectionIndex = 0;
        let preliminaryIntersectionPoint: Point = LUT[0].point;
        let preliminaryIntersectionTVal = LUT[0].tVal;
        LUT.forEach((curvePoint, index)=>{
            let curDistanceError = Math.abs(PointCal.distanceBetweenPoints(circleCenter, curvePoint.point));
            if (curDistanceError < distanceError){
                distanceError = curDistanceError;
                preliminaryIntersectionIndex = index;
            }
        });
        const LUTD = LUT.map((curvePoint, index)=>{
            return {...curvePoint, distance: 0};
        })
        distanceError = Number.MAX_VALUE;
        let start = 0;
        let count = 0;
        let indices: number[] = [];
        while(++count < 25){
            let i = this.findClosest(circleCenter.x, circleCenter.y, LUTD, circleRadius, 5, LUTD[start - 2]?.distance, LUTD[start - 1]?.distance);
            if (i < start) break;
            if (i > 0 && i == start) break;
            indices.push(i);
            start = i + 2;
        }
        const finalList: {intersection: Point, tVal: number}[] = [];
        indices.forEach((index)=>{
            let res = this.refineBinary(this, circleCenter.x, circleCenter.y, LUTD, index, circleRadius);
            if (res != undefined){
                finalList.push({intersection: res.point, tVal: res.tVal});
            }
        })
        return finalList;
    }

    advanceAtTWithLength(tVal: number, length: number): AdvanceAtTWithLengthRes{
        const currentLength = this.lengthAtT(tVal);
        const targetLength = currentLength + length;
        
        // Handle edge cases first
        if(tVal === 0 && length < 0){
            return {type: "beforeCurve", remainLength: -length};
        }
        if(tVal === 1 && length > 0){
            return {type: "afterCurve", remainLength: length};
        }
        if(targetLength > this.fullLength){
            return {type: "afterCurve", remainLength: targetLength - this.fullLength};
        } else if(targetLength < 0){
            return {type: "beforeCurve", remainLength: -targetLength};
        }

        // Use LUT for binary search
        if(this.arcLengthLUT.arcLengthLUT.length === 0){
            this.arcLengthLUT = this.getArcLengthLUT(1000);
        }
        const points = this.arcLengthLUT.arcLengthLUT;
        let low = 0;
        let high = points.length - 1;
        
        // Binary search to find the interval containing targetLength
        while (low <= high){
            const mid = Math.floor((low + high) / 2);
            const midLength = points[mid].length;
            
            if (approximately(midLength, targetLength, 0.01)) {
                // Found exact match
                const resultTVal = points[mid].tVal;
                const point = this.get(resultTVal);
                return {type: "withinCurve", tVal: resultTVal, point: point};
            } else if (midLength < targetLength){
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        
        // After binary search, 'high' points to the largest index with length < targetLength
        // and 'low' points to the smallest index with length >= targetLength
        
        // Handle edge cases
        if (high < 0) {
            // targetLength is smaller than the first point's length
            high = 1;
            low = 0;
        }
        
        if (low >= points.length) {
            // targetLength is larger than the last point's length
            high = points.length - 1;
            low = points.length - 2;
        }
        
        // Interpolate between points[high] and points[low]
        const p1 = points[high];
        const p2 = points[low];
        
        // Linear interpolation
        const lengthRange = p2.length - p1.length;
        const tRange = p2.tVal - p1.tVal;
        
        if (lengthRange === 0) {
            // Both points have the same length, use the first one
            const point = this.get(p1.tVal);
            return {type: "withinCurve", tVal: p1.tVal, point: point};
        }
        
        const ratio = (targetLength - p1.length) / lengthRange;
        const interpolatedT = p1.tVal + ratio * tRange;
        
        // Clamp to valid range
        const clampedT = Math.max(0, Math.min(1, interpolatedT));
        const point = this.get(clampedT);
        
        return {type: "withinCurve", tVal: clampedT, point: point};
    }

    advanceByDistance(startT: number, distance: number): AdvanceAtTWithLengthRes {
        let currentT = startT;
        let remainingDistance = distance;
        const stepSize = 0.01; // Adjust for precision vs performance

        if(distance > this.fullLength){
            return {type: "afterCurve", remainLength: distance - this.fullLength};
        } else if(distance < 0){
            return {type: "beforeCurve", remainLength: -distance};
        }
        
        while (remainingDistance > 0 && currentT < 1) {
            const currentPoint = this.get(currentT);
            const nextT = Math.min(currentT + stepSize, 1);
            const nextPoint = this.get(nextT);
            
            const segmentLength = Math.sqrt(
                Math.pow(nextPoint.x - currentPoint.x, 2) + 
                Math.pow(nextPoint.y - currentPoint.y, 2)
            );
            
            if (segmentLength >= remainingDistance) {
                // Interpolate within this segment
                const ratio = remainingDistance / segmentLength;
                return {type: "withinCurve", tVal: currentT + ratio * (nextT - currentT), point: this.get(currentT + ratio * (nextT - currentT))};
            }
            
            remainingDistance -= segmentLength;
            currentT = nextT;
        }
        
        return {type: "withinCurve", tVal: currentT, point: this.get(currentT)};
    }

    refineBinary(curve: BCurve, x: number, y: number, LUT: {point: Point, tVal: number, distance: number}[], i: number, targetDistance=0, epsilon=0.01) {
        let q: {point: Point, tVal: number, distance: number} | undefined = LUT[i],
          count = 1,
          distance = Number.MAX_SAFE_INTEGER;
      
        do {
          let i1 = i === 0 ? 0 : i - 1,
              i2 = i === LUT.length - 1 ? LUT.length - 1 : i + 1,
              t1 = LUT[i1].tVal,
              t2 = LUT[i2].tVal,
              lut: {point: Point, tVal: number, distance: number}[] = [],
              step = (t2 - t1) / 4;
      
          if (step < 0.001) break;
      
          lut.push(LUT[i1]);
          for (let j = 1; j <= 3; j++) {
            let n = curve.get(t1 + j * step);
            let nDistance = Math.abs(PointCal.distanceBetweenPoints(n, {x: x, y: y}) - targetDistance);
            if (nDistance < distance) {
              distance = nDistance;
              q = {point: n, tVal: t1 + j * step, distance: nDistance};
              i = j;
            }
            lut.push({point: n, tVal: t1 + j * step, distance: nDistance});
          }
          lut.push(LUT[i2]);
      
          // update the LUT to be our new five point LUT, and run again.
          LUT = lut;
      
          // The "count" test is mostly a safety measure: it will
          // never kick in, but something that _will_ terminate is
          // always better than while(true). Never use while(true)
        } while (count++ < 25);
      
        // If we're trying to hit a target, discard the result if
        // it is not close enough to the target.
        if (targetDistance && distance > epsilon) {
          q = undefined;
        }
      
        return q;
    }

    findClosest(x: number, y: number, LUT: {point: Point, tVal: number, distance: number}[], circleRadius: number, distanceEpsilon = 5, pd2?: number, pd1?: number) {
        let distance = Number.MAX_SAFE_INTEGER,
          prevDistance2 = pd2 || distance,
          prevDistance1 = pd1 || distance,
          i = -1;
      
        for (let index=0, e=LUT.length; index<e; index++){
          let p = LUT[index].point;
          LUT[index].distance = Math.abs(PointCal.distanceBetweenPoints({x:x, y:y}, p) - circleRadius);
          
          // Realistically, there's only going to be an intersection if
          // the distance to the circle center is already approximately
          // the circle's radius.
          if (prevDistance1 < distanceEpsilon && prevDistance2 > prevDistance1 && prevDistance1 < LUT[index].distance) {
            i = index - 1;
            break;
          }
      
          if (LUT[index].distance < distance) {
            distance = LUT[index].distance;
          }
      
          prevDistance2 = prevDistance1;
          prevDistance1 = LUT[index].distance;
        }
      
        return i;
    }

    getCurveIntersections(curve: BCurve, deduplicationTolerance?: number): {selfT: number, otherT: number}[]{
        return getIntersectionsBetweenCurves(this, curve, deduplicationTolerance);
    }

    get AABB():{min: Point, max: Point}{
        const extrema = this.getExtrema();
        const tVals = [0, 1];
        let min: Point = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};
        let max: Point = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
        extrema.x.forEach((tVal)=>{
            tVals.push(tVal);
        });
        extrema.y.forEach((tVal)=>{
            tVals.push(tVal);
        });
        tVals.forEach((tVal)=>{
            const curPoint = this.get(tVal);
            min.x = Math.min(min.x, curPoint.x);
            min.y = Math.min(min.y, curPoint.y);
            max.x = Math.max(max.x, curPoint.x);
            max.y = Math.max(max.y, curPoint.y);
        });

        return {min:min, max:max};
    }

    normal(tVal: number): {tVal: number, direction: Point} {
        const d = this.derivative(tVal);
        const q = Math.sqrt(d.x * d.x + d.y * d.y);
        return {tVal, direction: {x: -d.y / q, y: d.x / q}};
    }
}

export function reduce(curve: BCurve) {
    let i: number,
      t1 = 0,
      t2 = 0,
      step = 0.01,
      segment: BCurve,
      pass1: BCurve[] = [],
      pass2: BCurve[] = [];
  
    // first pass: split on extrema
    let extrema = curve.getExtrema().x;
    if (extrema.indexOf(0) === -1) {
      extrema = [0].concat(extrema);
    }
    if (extrema.indexOf(1) === -1) {
      extrema.push(1);
    }
    for (t1 = extrema[0], i = 1; i < extrema.length; i++) {
      t2 = extrema[i];
      segment = curve.splitAndTakeMidCurve(t1, t2);
      pass1.push(segment);
      t1 = t2;
    }
  
    // second pass: further reduce these segments to simple segments
    pass1.forEach(p1 => {
      t1 = 0;
      t2 = 0;
      while (t2 <= 1) {
        for (t2 = t1 + step; t2 <= 1 + step; t2 += step) {
          // Clamp t2 to valid range
          const clampedT2 = Math.min(t2, 1);
          segment = p1.splitAndTakeMidCurve(t1, clampedT2);
          if (!curveIsSimple(segment)) {
            t2 -= step;
            if (Math.abs(t1 - t2) < step) {
              // we can never form a reduction
              return [];
            }
            const finalT2 = Math.min(t2, 1);
            segment = p1.splitAndTakeMidCurve(t1, finalT2);
            pass2.push(segment);
            t1 = finalT2;
            break;
          }
        }
      }
      if (t1 < 1) {
        segment = p1.splitAndTakeMidCurve(t1, 1);
        pass2.push(segment);
      }
    });
  
    return pass2;
}

function raiseCurveOrder(curve: BCurve): BCurve {
    const p = curve.getControlPoints(),
        np = [p[0]],
        k = p.length;
    for (let i = 1; i < k; i++) {
        const pi = p[i];
        const pim = p[i - 1];
        np[i] = {
            x: ((k - i) / k) * pi.x + (i / k) * pim.x,
            y: ((k - i) / k) * pi.y + (i / k) * pim.y,
        };
    }
    np[k] = p[k - 1];
    return new BCurve(np);
}

// Function overloads for different return types
export function offset(curve: BCurve, t: number): BCurve[];
export function offset(curve: BCurve, t: number, d: number): {c: Point, n: Point, x: number, y: number};
export function offset(curve: BCurve, t: number, d?: number | undefined) {
    if (d !== undefined) {
        const c = curve.get(t),
        n = curve.normal(t).direction;
        const ret = {
        c: c,
        n: n,
        x: c.x + n.x * d,
        y: c.y + n.y * d,
        };
        // if (this._3d) {
        // ret.z = c.z + n.z * d;
        // }
        return ret;
    }

    // Native offset implementation based on bezier-js algorithm
    const points = curve.getControlPoints();
    const linear = curveIsLinear(curve);

    if (linear) {
        const nv = curve.normal(0).direction,
        coords = points.map(function (p) {
            const ret = {
            x: p.x + t * nv.x,
            y: p.y + t * nv.y,
            };
            return ret;
        });
        return [new BCurve(coords)];
    }

    // For non-linear curves, reduce to simple segments and scale each
    return reduce(curve).map(function (s) {
        if (curveIsLinear(s)) {
            return offset(s, t)[0];
        }
        return scaleCurve(s, t);
    });
}

export function offset2(curve: BCurve, d: number): Point[]{
    const lut = curve.getLUTWithTVal(100);

    const res = lut.map((item)=>{
        const derivative = PointCal.unitVector(curve.derivative(item.tVal));
        const normal = {x: -derivative.y, y: derivative.x};
        const offsetPoint = {x: item.point.x + normal.x * d, y: item.point.y + normal.y * d};
        return offsetPoint;
    });

    return res;
}

// Helper function for line-line intersection (ported from bezier-js utils)
function lli4(p1: Point, p2: Point, p3: Point, p4: Point): Point | false {
    const x1 = p1.x, y1 = p1.y,
          x2 = p2.x, y2 = p2.y,
          x3 = p3.x, y3 = p3.y,
          x4 = p4.x, y4 = p4.y;
    return lli8(x1, y1, x2, y2, x3, y3, x4, y4);
}

function lli8(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): Point | false {
    const nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
    const ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);
    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (d == 0) {
        return false;
    }
    return { x: nx / d, y: ny / d };
}

function curveIsLinear(curve: BCurve): boolean{
    const order = curve.getControlPoints().length - 1;
    const points = curve.getControlPoints();
    const alignedPoints = alignPointsToLine(points, {p1: points[0], p2: points[order]});
    const baseLength = PointCal.distanceBetweenPoints(points[0], points[order]);

    // Sum of distances from the line (y coordinates in aligned space)
    const linear = alignedPoints.reduce((t, p) => t + Math.abs(p.y), 0) < baseLength / 50;

    return linear;
}


function scaleCurve(curve: BCurve, d: number | ((t: number) => number)): BCurve {
    const order = curve.getControlPoints().length - 1;
    let distanceFn: ((t: number) => number) | undefined = undefined;

    if (typeof d === "function") {
        distanceFn = d;
    }

    if (distanceFn && order === 2) {
        return scaleCurve(raiseCurveOrder(curve), distanceFn);
    }

    const points = curve.getControlPoints();

    // Check if curve is linear
    if (curveIsLinear(curve)) {
        return translate(
            curve,
            curve.normal(0).direction,
            distanceFn ? distanceFn(0) : d as number,
            distanceFn ? distanceFn(1) : d as number
        );
    }

    const r1 = distanceFn ? distanceFn(0) : d as number;
    const r2 = distanceFn ? distanceFn(1) : d as number;
    
    // Get offset points at endpoints to find the scaling origin
    const v = [offset(curve, 0, 10), offset(curve, 1, 10)];
    const np: Point[] = [];
    const o = lli4(v[0] as any, (v[0] as any).c, v[1] as any, (v[1] as any).c);

    if (!o) {
        // Fallback: use simple translation for problematic curves
        return translate(
            curve,
            curve.normal(0).direction,
            r1,
            r2
        );
    }

    // Move endpoint control points by distance along normal
    [0, 1].forEach(function (t) {
        const p = JSON.parse(JSON.stringify(points[t * order]));
        const vt = v[t] as any;
        p.x += (t ? r2 : r1) * vt.n.x;
        p.y += (t ? r2 : r1) * vt.n.y;
        np[t * order] = p;
    });

    if (!distanceFn) {
        // Move control points to lie on the intersection of the offset
        // derivative vector, and the origin-through-control vector
        [0, 1].forEach((t) => {
            if (order === 2 && !!t) return;
            const p = np[t * order];
            const derivativeAtT = curve.derivative(t);
            const p2 = { x: p.x + derivativeAtT.x, y: p.y + derivativeAtT.y };
            const intersection = lli4(p, p2, o, points[t + 1]);
            if (intersection) {
                np[t + 1] = intersection;
            } else {
                // Fallback: use original control point with simple offset
                const originalPoint = points[t + 1];
                const normal = curve.normal((t + 1) / order).direction;
                np[t + 1] = {
                    x: originalPoint.x + (t ? r2 : r1) * normal.x,
                    y: originalPoint.y + (t ? r2 : r1) * normal.y
                };
            }
        });
        return new BCurve(np);
    }

    // For function-based distances, move control points by distance
    // to ensure correct tangent at endpoints
    [0, 1].forEach(function (t) {
        if (order === 2 && !!t) return;
        const p = points[t + 1];
        const ov = {
            x: p.x - o.x,
            y: p.y - o.y,
        };
        let rc = distanceFn!((t + 1) / order);
        const m = Math.sqrt(ov.x * ov.x + ov.y * ov.y);
        ov.x /= m;
        ov.y /= m;
        np[t + 1] = {
            x: p.x + rc * ov.x,
            y: p.y + rc * ov.y,
        };
    });
    return new BCurve(np);
}

function alignPointsToLine(points: Point[], line: {p1: Point, p2: Point}) {
    const tx = line.p1.x,
      ty = line.p1.y,
      a = -Math.atan2(line.p2.y - ty, line.p2.x - tx),
      d = function (v: Point) {
        return {
          x: (v.x - tx) * Math.cos(a) - (v.y - ty) * Math.sin(a),
          y: (v.x - tx) * Math.sin(a) + (v.y - ty) * Math.cos(a),
        };
      };
    return points.map(d);
};

function map(v: number, ds: number, de: number, ts: number, te: number): number {
    const d1 = de - ds,      // source range size
      d2 = te - ts,          // target range size  
      v2 = v - ds,           // offset from source start
      r = v2 / d1;           // ratio within source range
    return ts + d2 * r;      // mapped value in target range
}

export class TValOutofBoundError extends Error{
    constructor(message: string){
        super(message);
    }
}

export type Point = {
    x: number;
    y: number;
    z?: number;
}

export function AABBIntersects(AABB1: {min: Point, max: Point}, AABB2: {min: Point, max: Point}): boolean{
    if ((AABB1.min.x <= AABB2.max.x && AABB2.min.x <= AABB1.max.x) && (AABB1.min.y <= AABB2.max.y && AABB2.min.y <= AABB1.max.y)){
        return true;
    }
    return false;
}

export function approximately (a: number, b: number, precision?: number) {
    const epsilon = 0.000001
    return Math.abs(a - b) <= (precision || epsilon);
}

export function cuberoot2(v:number) {
    if(v<0) return -Math.pow(-v,1/3);
    return Math.pow(v,1/3);
}

export function accept(t: number) {
    return 0 <= t && t <=1;
}

export function getCubicRoots(pa: number, pb: number, pc: number, pd: number) {
    let a = (3*pa - 6*pb + 3*pc),
        b = (-3*pa + 3*pb),
        c = pa,
        d = (-pa + 3*pb - 3*pc + pd);

    // do a check to see whether we even need cubic solving:
    if (approximately(d,0)) {
        // this is not a cubic curve.
        if (approximately(a,0)) {
            // in fact, this is not a quadratic curve either.
            if (approximately(b,0)) {
                // in fact in fact, there are no solutions.
                return [];
            }
            // linear solution
            return [-c / b].filter(accept);
        }
        // quadratic solution
        let q = Math.sqrt(b*b - 4*a*c), a2 = 2*a;
        return [(q-b)/a2, (-b-q)/a2].filter(accept)
    }

    // at this point, we know we need a cubic solution.

    a /= d;
    b /= d;
    c /= d;

    let p = (3*b - a*a)/3,
        p3 = p/3,
        q = (2*a*a*a - 9*a*b + 27*c)/27,
        q2 = q/2,
        discriminant = q2*q2 + p3*p3*p3;

    // and some variables we're going to use later on:
    let u1, v1, root1, root2, root3;

    // three possible real roots:
    if (discriminant < 0) {
        let mp3  = -p/3,
        mp33 = mp3*mp3*mp3,
        r    = Math.sqrt( mp33 ),
        t    = -q / (2*r),
        cosphi = t<-1 ? -1 : t>1 ? 1 : t,
        phi  = Math.acos(cosphi),
        crtr = cuberoot2(r),
        t1   = 2*crtr;
        root1 = t1 * Math.cos(phi/3) - a/3;
        root2 = t1 * Math.cos((phi+2*Math.PI)/3) - a/3;
        root3 = t1 * Math.cos((phi+4*Math.PI)/3) - a/3;
        return [root1, root2, root3].filter(accept);
    }

    // three real roots, but two of them are equal:
    if(discriminant === 0) {
        u1 = q2 < 0 ? cuberoot2(-q2) : -cuberoot2(q2);
        root1 = 2*u1 - a/3;
        root2 = -u1 - a/3;
        return [root1, root2].filter(accept);
    }

    // one real root, two complex roots
    var sd = Math.sqrt(discriminant);
    u1 = cuberoot2(sd - q2);
    v1 = cuberoot2(sd + q2);
    root1 = u1 - v1 - a/3;
    return [root1].filter(accept);
}

export function getIntersectionsBetweenCurves(curve: BCurve, curve2: BCurve, deduplicationTolerance: number = 0.01): {selfT: number, otherT: number}[]{
    const threshold = 0.5;
    let pairs: {curve1: {curve: BCurve, startTVal: number, endTVal: number}, curve2: {curve: BCurve, startTVal: number, endTVal: number}}[] = [{curve1: {curve: curve, startTVal: 0, endTVal: 1}, curve2: {curve: curve2, startTVal: 0, endTVal: 1}}];
    const finalRes = [];
    while (pairs.length > 0){
        let curLength = pairs.length;
        for(let index = 0; index < curLength; index++){
            let pair = pairs.shift();
            if (pair == undefined){
                break;
            }
            let aabb1 = pair.curve1.curve.AABB;
            let aabb2 = pair.curve2.curve.AABB;
            let intersects = AABBIntersects(aabb1, aabb2);
            if(pair.curve1.curve.fullLength < threshold && pair.curve2.curve.fullLength < threshold){
                finalRes.push({intersection: pair.curve1.curve.get(0.5), tVal1: (pair.curve1.startTVal + pair.curve1.endTVal) * 0.5, tVal2: (pair.curve2.startTVal + pair.curve2.endTVal) * 0.5});
                continue;
            }
            if (intersects){
                let [subCurveControlPoints1, subCurveControlPoints2] = pair.curve1.curve.split(0.5);
                let [subCurveControlPoints3, subCurveControlPoints4] = pair.curve2.curve.split(0.5);
                pairs.push({
                    curve1: {
                        curve: new BCurve(subCurveControlPoints1), 
                        startTVal: pair.curve1.startTVal, 
                        endTVal: pair.curve1.startTVal + (pair.curve1.endTVal - pair.curve1.startTVal) * 0.5
                }, curve2: {
                        curve: new BCurve(subCurveControlPoints3),
                        startTVal: pair.curve2.startTVal,
                        endTVal: pair.curve2.startTVal + (pair.curve2.endTVal - pair.curve2.startTVal) * 0.5
                }});

                pairs.push({
                    curve1: {
                        curve: new BCurve(subCurveControlPoints1), 
                        startTVal: pair.curve1.startTVal, 
                        endTVal: pair.curve1.startTVal + (pair.curve1.endTVal - pair.curve1.startTVal) * 0.5
                }, curve2: {
                        curve: new BCurve(subCurveControlPoints4),
                        startTVal: pair.curve2.startTVal + (pair.curve2.endTVal - pair.curve2.startTVal) * 0.5,
                        endTVal: pair.curve2.endTVal
                }});

                pairs.push({
                    curve1: {
                        curve: new BCurve(subCurveControlPoints2), 
                        startTVal: pair.curve1.startTVal + (pair.curve1.endTVal - pair.curve1.startTVal) * 0.5 ,
                        endTVal: pair.curve1.endTVal 
                }, curve2: {
                        curve: new BCurve(subCurveControlPoints3),
                        startTVal: pair.curve2.startTVal,
                        endTVal: pair.curve2.startTVal + (pair.curve2.endTVal - pair.curve2.startTVal) * 0.5
                }});

                pairs.push({
                    curve1: {
                        curve: new BCurve(subCurveControlPoints2), 
                        startTVal: pair.curve1.startTVal + (pair.curve1.endTVal - pair.curve1.startTVal) * 0.5 ,
                        endTVal: pair.curve1.endTVal 
                }, curve2: {
                        curve: new BCurve(subCurveControlPoints4),
                        startTVal: pair.curve2.startTVal + (pair.curve2.endTVal - pair.curve2.startTVal) * 0.5,
                        endTVal: pair.curve2.endTVal
                }});
            }

        }
    }

    // Improved deduplication logic that handles close tvals on both curves
    const tVals: {selfT: number, otherT: number}[] = [];
    
    // Sort intersections by tVal1 for more predictable deduplication
    finalRes.sort((a, b) => a.tVal1 - b.tVal1);
    
    for (const intersection of finalRes) {
        let isDuplicate = false;
        
        // Check against all existing intersections
        for (const existing of tVals) {
            // Check if this intersection is close to an existing one on either curve
            const selfTClose = approximately(intersection.tVal1, existing.selfT, deduplicationTolerance);
            const otherTClose = approximately(intersection.tVal2, existing.otherT, deduplicationTolerance);
            
            // Consider it a duplicate if both t-values are close
            if (selfTClose && otherTClose) {
                isDuplicate = true;
                break;
            }
            
            // Also check for cases where intersections might be very close on the same curve
            // This handles cases where curves are nearly tangent or have very close intersections
            const selfTVeryClose = approximately(intersection.tVal1, existing.selfT, deduplicationTolerance * 10);
            const otherTVeryClose = approximately(intersection.tVal2, existing.otherT, deduplicationTolerance * 10);
            
            if (selfTVeryClose || otherTVeryClose) {
                // Additional check: if the intersection points are very close spatially
                const point1 = curve.get(intersection.tVal1);
                const point2 = curve2.get(intersection.tVal2);
                const existingPoint1 = curve.get(existing.selfT);
                const existingPoint2 = curve2.get(existing.otherT);
                
                const distance1 = PointCal.distanceBetweenPoints(point1, existingPoint1);
                const distance2 = PointCal.distanceBetweenPoints(point2, existingPoint2);
                
                // If both intersection points are spatially very close, consider it a duplicate
                if (distance1 < deduplicationTolerance * 100 && distance2 < deduplicationTolerance * 100) {
                    isDuplicate = true;
                    break;
                }
            }
        }
        
        if (!isDuplicate) {
            tVals.push({selfT: intersection.tVal1, otherT: intersection.tVal2});
        }
    }
    
    return tVals;
}

export function solveCubic(a: number, b: number, c: number, d: number) {
    if (Math.abs(a) < 1e-8) { // Quadratic case, ax^2+bx+c=0
        a = b; b = c; c = d;
        if (Math.abs(a) < 1e-8) { // Linear case, ax+b=0
            a = b; b = c;
            if (Math.abs(a) < 1e-8) // Degenerate case
                return [];
            return [-b/a];
        }

        let D = b*b - 4*a*c;
        if (Math.abs(D) < 1e-8)
            return [-b/(2*a)];
        else if (D > 0)
            return [(-b+Math.sqrt(D))/(2*a), (-b-Math.sqrt(D))/(2*a)];
        return [];
    }

    // Convert to depressed cubic t^3+pt+q = 0 (subst x = t - b/3a)
    let p = (3*a*c - b*b)/(3*a*a);
    let q = (2*b*b*b - 9*a*b*c + 27*a*a*d)/(27*a*a*a);
    let roots: number[];

    if (Math.abs(p) < 1e-8) { // p = 0 -> t^3 = -q -> t = -q^1/3
        roots = [cuberoot(-q)];
    } else if (Math.abs(q) < 1e-8) { // q = 0 -> t^3 + pt = 0 -> t(t^2+p)=0
        roots = [0].concat(p < 0 ? [Math.sqrt(-p), -Math.sqrt(-p)] : []);
    } else {
        let D = q*q/4 + p*p*p/27;
        if (Math.abs(D) < 1e-8) {       // D = 0 -> two roots
            roots = [-1.5*q/p, 3*q/p];
        } else if (D > 0) {             // Only one real root and two complex roots
            let u = cuberoot(-q/2 - Math.sqrt(D));
            let v = cuberoot(-q/2 + Math.sqrt(D));
            //console.log("Complext Root 1 real:", -(u+v)/2.0 - a / 3.0, "imaginary:", Math.sqrt(3) / 2.0 * (v - u));
            //console.log("Complext Root 2 real:", -(u+v)/2.0 - a / 3.0, "imaginary:",-1 * Math.sqrt(3) / 2.0 * (v - u));

            roots = [u - p/(3*u)];
        } else {                        // D < 0, three roots, but needs to use complex numbers/trigonometric solution
            let u = 2*Math.sqrt(-p/3);
            let t = Math.acos(3*q/p/u)/3;  // D < 0 implies p < 0 and acos argument in [-1..1]
            let k = 2*Math.PI/3;
            roots = [u*Math.cos(t), u*Math.cos(t-k), u*Math.cos(t-2*k)];
        }
    }

    // Convert back from depressed cubic
    for (let i = 0; i < roots.length; i++)
        roots[i] -= b/(3*a);

    return roots;
}

export function cuberoot(x: number) {
    var y = Math.pow(Math.abs(x), 1/3);
    return x < 0 ? -y : y;
}

export function computeWithControlPoints(tVal: number, controlPoints: Point[]): Point{
    let points = [...controlPoints];
    while (points.length > 1) {
        let lowerLevelPoints = points.slice(1);
        for(let index = 0; index < lowerLevelPoints.length; index++){
            lowerLevelPoints[index] = PointCal.addVector(PointCal.multiplyVectorByScalar(points[index], (1 - tVal)), PointCal.multiplyVectorByScalar(points[index + 1], tVal));
        }
        points = lowerLevelPoints;
    }
    return points[0];
}

function curveIsSimple(curve: BCurve): boolean {
    if (curve.getControlPoints().length === 4) {
        const points = curve.getControlPoints();
        const p0ToP3Vector = PointCal.subVector(points[3], points[0]);
        const p0ToP1Vector = PointCal.subVector(points[1], points[0]);
        const p0ToP2Vector = PointCal.subVector(points[2], points[0]);
    
        const a1 = PointCal.angleFromA2B(p0ToP3Vector, p0ToP1Vector);
        const a2 = PointCal.angleFromA2B(p0ToP3Vector, p0ToP2Vector);
        if ((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) return false;
    }
    const n1 = curve.normal(0).direction;
    const n2 = curve.normal(1).direction;
    let s = n1.x * n2.x + n1.y * n2.y;
    // if (this._3d) {
    //     s += n1.z * n2.z;
    // }
    return Math.abs(Math.acos(s)) < Math.PI / 3;
  }



function translate(curve: BCurve, vector: Point, d1: number, d2: number){
    const order = curve.getControlPoints().length - 1;
    const points = curve.getControlPoints();
    const d = points.map((_, i: number) => (1 - i / order) * d1 + (i / order) * d2);
    return new BCurve(points.map((p, i) => ({x: p.x + d[i] * vector.x, y: p.y + d[i] * vector.y})));
}
