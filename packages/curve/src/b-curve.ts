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
        this.arcLengthLUT = this.getArcLengthLUT(1000);
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

    public setControlPointAtIndex(index: number, newPoint: Point): boolean{
        if (index < 0 || index >= this.controlPoints.length){
            return false;
        }
        this.controlPoints[index] = newPoint;
        this.dControlPoints = this.getDerivativeControlPoints(this.controlPoints);
        this._fullLength = this.calculateFullLength();
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

    public getArcLengthLUT(steps: number = 100): {controlPoints: Point[], arcLengthLUT: {tVal: number, length: number}[]}{
        // Clear cache when regenerating LUT to ensure consistency
        this.clearCache();
        
        let res = [];
        let tSteps = 1 / steps;
        for(let tVal = 0; tVal <= 1; tVal += tSteps){
            res.push({tVal: tVal, length: this.lengthAtT(tVal)});
        }
        return {controlPoints: this.controlPoints, arcLengthLUT: res};
    }

    public split(tVal: number, tVal2?: number): Point[][]{
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

        // Use LUT directly instead of copying
        const points = this.arcLengthLUT.arcLengthLUT;
        let low = 0;
        let high = points.length - 1;
        
        // Optimized binary search with early exit for exact matches
        while (low <= high){
            const mid = Math.floor((low + high) / 2);
            const midLength = points[mid].length;
            
            if (Math.abs(midLength - targetLength) < 1e-10) { // Use small epsilon for floating point comparison
                const resultTVal = points[mid].tVal;
                const point = this.get(resultTVal);
                console.log('found, using exact match', resultTVal);
                return {type: "withinCurve", tVal: resultTVal, point: point};
            } else if (midLength < targetLength){
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        
        // Handle edge cases more efficiently
        if (low >= points.length) {
            const point = this.get(1);
            return {type: "withinCurve", tVal: 1, point: point};
        }
        
        // Use linear interpolation for better accuracy
        const resultTVal = points[low].tVal;
        const point = this.get(resultTVal);
        console.log('low', low);
        const tValInterpolated = (low + length > 0 ? 1 : -1) / points.length;
        console.log('tValInterpolated', tValInterpolated);
        return {type: "withinCurve", tVal: tValInterpolated, point: this.get(tValInterpolated)};
        // return {type: "withinCurve", tVal: resultTVal, point: point};
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

    getCurveIntersections(curve: BCurve): {selfT: number, otherT: number}[]{
        return getIntersectionsBetweenCurves(this, curve);
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

export function getIntersectionsBetweenCurves(curve: BCurve, curve2: BCurve): {selfT: number, otherT: number}[]{
    const threshold = 0.0001;
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

    const tVals: {selfT: number, otherT: number}[] = [];
    const tVal1s: number[] = [];
    finalRes.forEach((intersections)=>{
        let within = false;
        for(let index = 0; index < tVal1s.length; index++){
            if (approximately(intersections.tVal1, tVal1s[index], 0.000005)){
                within = true;
                break;
            }
        }
        if (!within){
            tVal1s.push(intersections.tVal1);
            tVals.push({selfT: intersections.tVal1, otherT: intersections.tVal2});
        }
    });
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
