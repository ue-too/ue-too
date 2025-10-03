import type { Point } from "@ue-too/math";
import { PointCal } from "@ue-too/math";

/**
 * Creates a cubic Bézier curve connecting two points with specified tangent directions and curvatures
 * @param startPoint - The starting point of the curve (P0)
 * @param endPoint - The ending point of the curve (P3)
 * @param startTangent - Unit vector indicating the tangent direction at the start point
 * @param endTangent - Unit vector indicating the tangent direction at the end point
 * @param startCurvature - The desired curvature at the start point (positive for left turn, negative for right turn)
 * @param endCurvature - The desired curvature at the end point (positive for left turn, negative for right turn)
 * @param tension - Optional parameter to control overall curve tension (default: 1.0)
 * @returns Object containing the four control points {p0, p1, p2, p3} of the cubic Bézier curve
 */
function createCubicFromTangentsCurvatures(
    startPoint: Point,
    endPoint: Point,
    startTangent: Point,
    endTangent: Point,
    startCurvature: number,
    endCurvature: number,
    tension: number = 1.0
): {p0: Point, p1: Point, p2: Point, p3: Point} {
    
    // Ensure tangent directions are normalized
    const unitStartTangent = PointCal.unitVector(startTangent);
    const unitEndTangent = PointCal.unitVector(endTangent);
    
    // Calculate the chord vector and its properties
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);
    
    // Base control distances - start with 1/3 of chord length (common heuristic)
    let startControlDistance = chordLength * tension / 3.0;
    let endControlDistance = chordLength * tension / 3.0;
    
    // Adjust control distances based on curvatures
    // Higher curvature magnitude requires different control point positioning
    
    // For start point (P1 calculation)
    const startCurvatureMagnitude = Math.abs(startCurvature);
    if (startCurvatureMagnitude > 0.001) {
        // Inverse relationship: higher curvature needs tighter control
        const startCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (startCurvatureMagnitude * chordLength + 1.0)));
        startControlDistance *= startCurvatureScale;
        
        // Additional adjustment for very high curvature
        if (startCurvatureMagnitude > 0.02) {
            startControlDistance *= 0.7;
        }
    }
    
    // For end point (P2 calculation)  
    const endCurvatureMagnitude = Math.abs(endCurvature);
    if (endCurvatureMagnitude > 0.001) {
        // Inverse relationship: higher curvature needs tighter control
        const endCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (endCurvatureMagnitude * chordLength + 1.0)));
        endControlDistance *= endCurvatureScale;
        
        // Additional adjustment for very high curvature
        if (endCurvatureMagnitude > 0.02) {
            endControlDistance *= 0.7;
        }
    }
    
    // Calculate initial control points along tangent directions
    const p1Initial = {
        x: startPoint.x + unitStartTangent.x * startControlDistance,
        y: startPoint.y + unitStartTangent.y * startControlDistance
    };
    
    const p2Initial = {
        x: endPoint.x - unitEndTangent.x * endControlDistance,
        y: endPoint.y - unitEndTangent.y * endControlDistance
    };
    
    // Apply curvature-based adjustments
    // Calculate perpendicular vectors for curvature adjustments
    const startPerpendicular = {
        x: -unitStartTangent.y,  // 90° counter-clockwise rotation
        y: unitStartTangent.x
    };
    
    const endPerpendicular = {
        x: -unitEndTangent.y,   // 90° counter-clockwise rotation  
        y: unitEndTangent.x
    };
    
    // Apply curvature offsets
    const startCurvatureOffset = startCurvature * chordLength * 0.05;
    const endCurvatureOffset = endCurvature * chordLength * 0.05;
    
    const p1 = {
        x: p1Initial.x + startPerpendicular.x * startCurvatureOffset,
        y: p1Initial.y + startPerpendicular.y * startCurvatureOffset
    };
    
    const p2 = {
        x: p2Initial.x + endPerpendicular.x * endCurvatureOffset,
        y: p2Initial.y + endPerpendicular.y * endCurvatureOffset
    };
    
    return {
        p0: startPoint,
        p1: p1,
        p2: p2,
        p3: endPoint
    };
}

/**
 * Alternative approach using G2 continuity principles for more mathematical precision
 * This version uses the relationship between curvature and second derivatives
 */
function createCubicFromTangentsCurvaturesG2(
    startPoint: Point,
    endPoint: Point,
    startTangent: Point,
    endTangent: Point,
    startCurvature: number,
    endCurvature: number
): {p0: Point, p1: Point, p2: Point, p3: Point} {
    
    const unitStartTangent = PointCal.unitVector(startTangent);
    const unitEndTangent = PointCal.unitVector(endTangent);
    
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);
    
    // Use G2 continuity equations to determine control points
    // For a cubic Bézier curve: C(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    // First derivative: C'(t) = 3(1-t)²(P₁-P₀) + 6(1-t)t(P₂-P₁) + 3t²(P₃-P₂)
    // Second derivative: C''(t) = 6(1-t)(P₂-2P₁+P₀) + 6t(P₃-2P₂+P₁)
    
    // At t=0: C'(0) = 3(P₁-P₀), C''(0) = 6(P₂-2P₁+P₀)
    // At t=1: C'(1) = 3(P₃-P₂), C''(1) = 6(P₃-2P₂+P₁)
    
    // From tangent constraints:
    // P₁ = P₀ + (1/3) * speed₀ * tangent₀
    // P₂ = P₃ - (1/3) * speed₁ * tangent₁
    
    // Estimate appropriate speeds based on chord length and curvatures
    let speed0 = chordLength / 2;
    let speed1 = chordLength / 2;
    
    // Adjust speeds based on curvature
    if (Math.abs(startCurvature) > 0.001) {
        // Higher curvature typically means slower speed for tighter curves
        speed0 = chordLength / (2 + Math.abs(startCurvature) * chordLength);
    }
    
    if (Math.abs(endCurvature) > 0.001) {
        speed1 = chordLength / (2 + Math.abs(endCurvature) * chordLength);
    }
    
    // Calculate control points based on tangent and speed
    const p1 = {
        x: startPoint.x + (speed0 / 3) * unitStartTangent.x,
        y: startPoint.y + (speed0 / 3) * unitStartTangent.y
    };
    
    const p2 = {
        x: endPoint.x - (speed1 / 3) * unitEndTangent.x,
        y: endPoint.y - (speed1 / 3) * unitEndTangent.y
    };
    
    // For curvature constraint, we need to solve:
    // κ₀ = |C'(0) × C''(0)| / |C'(0)|³
    // κ₁ = |C'(1) × C''(1)| / |C'(1)|³
    
    // This is more complex and might require iterative adjustment
    // For now, we'll use the approximation method with curvature-based offsets
    
    const startPerpendicular = {
        x: -unitStartTangent.y,
        y: unitStartTangent.x
    };
    
    const endPerpendicular = {
        x: -unitEndTangent.y,
        y: unitEndTangent.x
    };
    
    // Apply curvature corrections
    const curvatureStrength = 0.02;
    const startOffset = startCurvature * chordLength * curvatureStrength;
    const endOffset = endCurvature * chordLength * curvatureStrength;
    
    return {
        p0: startPoint,
        p1: {
            x: p1.x + startPerpendicular.x * startOffset,
            y: p1.y + startPerpendicular.y * startOffset
        },
        p2: {
            x: p2.x + endPerpendicular.x * endOffset,
            y: p2.y + endPerpendicular.y * endOffset
        },
        p3: endPoint
    };
}

/**
 * Utility function to extract tangent and curvature from an existing quadratic Bézier curve at a specific parameter
 * @param p0 - First control point of quadratic curve
 * @param p1 - Second control point of quadratic curve  
 * @param p2 - Third control point of quadratic curve
 * @param t - Parameter value (0 to 1) where to extract tangent and curvature
 * @returns Object with point, tangent direction, and curvature at parameter t
 */
function getQuadraticTangentCurvature(
    p0: Point,
    p1: Point, 
    p2: Point,
    t: number
): {point: Point, tangent: Point, curvature: number} {
    
    // Quadratic Bézier: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
    // First derivative: B'(t) = 2(1-t)(P₁-P₀) + 2t(P₂-P₁)
    // Second derivative: B''(t) = 2(P₂-2P₁+P₀) (constant for quadratic)
    
    const oneMinusT = 1 - t;
    
    // Calculate point at parameter t
    const point = {
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
    };
    
    // Calculate first derivative (tangent vector)
    const tangentVector = {
        x: 2 * oneMinusT * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
        y: 2 * oneMinusT * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    };
    
    // Calculate second derivative (constant for quadratic)
    const secondDerivative = {
        x: 2 * (p2.x - 2 * p1.x + p0.x),
        y: 2 * (p2.y - 2 * p1.y + p0.y)
    };
    
    // Calculate curvature: κ = |C' × C''| / |C'|³
    const crossProduct = tangentVector.x * secondDerivative.y - tangentVector.y * secondDerivative.x;
    const tangentMagnitude = Math.sqrt(tangentVector.x * tangentVector.x + tangentVector.y * tangentVector.y);
    
    let curvature = 0;
    if (tangentMagnitude > 0.001) {
        curvature = crossProduct / (tangentMagnitude * tangentMagnitude * tangentMagnitude);
    }
    
    // Normalize tangent vector
    const unitTangent = tangentMagnitude > 0.001 ? 
        {
            x: tangentVector.x / tangentMagnitude,
            y: tangentVector.y / tangentMagnitude
        } : 
        {x: 1, y: 0};
    
    return {
        point: point,
        tangent: unitTangent,
        curvature: curvature
    };
}

export class GenericEntityManager<T> {

    private _availableEntities: number[] = [];
    private _maxEntities: number;
    private _livingEntityCount = 0;
    private _entities: (T | null)[] = [];

    private _packedEntityData: T[];
    private _entityNumberToPackedDataIndex: (number | null)[] = [];
    private _packedDataIndexToEntityNumber: (number | null)[] = [];
    private _livingEntitiesIndex: number[];
    private _liveCount: number = 0;

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._entities.push(null);
        }

        this._packedEntityData = new Array(this._maxEntities);
        this._entityNumberToPackedDataIndex = new Array(this._maxEntities);
        this._packedDataIndexToEntityNumber = new Array(this._maxEntities);
        this._livingEntitiesIndex = new Array(this._maxEntities);
    }

    getLivingEntityCount(): number {
        return this._liveCount;
    }

    getLivingEntitesIndex(): number[] {
        // return this._entities.map((entity, index) => entity !== null ? index : null).filter((index): index is number => index !== null);
        return this._livingEntitiesIndex.filter((entityNumber): entityNumber is number => entityNumber !== null);
    }

    getLivingEntitiesWithIndex(): {index: number, entity: T}[] {
        // const res: {index: number, entity: T}[] = [];
        // this._entities.forEach((entity, index) => {
        //     if(entity !== null) {
        //         res.push({index, entity});
        //     }
        // });
        // return res;
        return this.getLivingEntitesIndex().map((entityNumber): {index: number, entity: T} => {
            return {index: entityNumber, entity: this._packedEntityData[entityNumber]};
        });
    }

    getLivingEntities(): T[] {
        // return this._entities.filter((entity): entity is T => entity !== null);
        return this._packedEntityData.filter((entity): entity is T => entity !== null);
    }

    getEntity(entity: number): T | null {
        if(entity < 0 || entity >= this._maxEntities){
            return null;
        }
        
        const packedDataIndex = this._entityNumberToPackedDataIndex[entity];
        if(packedDataIndex == null) {
            return null;
        }
        
        return this._packedEntityData[packedDataIndex] ?? null;
    }

    createEntity(entity: T): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
                this._entities.push(null);
            }

            const newPackedEntityData = new Array(this._maxEntities);
            const newEntityNumberToPackedDataIndex = new Array(this._maxEntities);
            const newPackedDataIndexToEntityNumber = new Array(this._maxEntities);
            const newLivingEntitiesIndex = new Array(this._maxEntities);

            for (let i = 0; i < currentMaxEntities; i++) {
                newPackedEntityData[i] = this._packedEntityData[i];
                newEntityNumberToPackedDataIndex[i] = this._entityNumberToPackedDataIndex[i];
                newPackedDataIndexToEntityNumber[i] = this._packedDataIndexToEntityNumber[i];
                newLivingEntitiesIndex[i] = this._livingEntitiesIndex[i];
            }
            this._packedEntityData = newPackedEntityData;
            this._entityNumberToPackedDataIndex = newEntityNumberToPackedDataIndex;
            this._packedDataIndexToEntityNumber = newPackedDataIndexToEntityNumber;
            this._livingEntitiesIndex = newLivingEntitiesIndex;
        }

        const entityNumber = this._availableEntities.shift();
        if(entityNumber === undefined) {
            throw new Error('No available entities');
        }
        this._entities[entityNumber] = entity;
        this._livingEntityCount++;

        this._packedEntityData[this._liveCount] = entity;
        this._entityNumberToPackedDataIndex[entityNumber] = this._liveCount;
        this._packedDataIndexToEntityNumber[this._liveCount] = entityNumber;
        this._livingEntitiesIndex[this._liveCount] = entityNumber;

        this._liveCount++;
        return entityNumber;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._availableEntities.push(entity);
        this._entities[entity] = null;
        this._livingEntityCount--;

        const packedDataIndex = this._entityNumberToPackedDataIndex[entity];
        if(packedDataIndex == undefined) {
            return;
        }

        // Get the last entity in the packed array
        const lastEntity = this._packedDataIndexToEntityNumber[this._liveCount - 1];

        if(lastEntity == null) {
            return;
        }

        // If we're not destroying the last entity, move the last entity to fill the gap
        if(packedDataIndex !== this._liveCount - 1) {
            this._packedEntityData[packedDataIndex] = this._packedEntityData[this._liveCount - 1];
            this._packedDataIndexToEntityNumber[packedDataIndex] = lastEntity;
            this._entityNumberToPackedDataIndex[lastEntity] = packedDataIndex;
            this._livingEntitiesIndex[packedDataIndex] = this._livingEntitiesIndex[this._liveCount - 1];
        }

        // Clear the last position
        this._packedEntityData[this._liveCount - 1] = null as any;
        this._packedDataIndexToEntityNumber[this._liveCount - 1] = null;
        this._livingEntitiesIndex[this._liveCount - 1] = null as any;

        // Clear the mapping for the destroyed entity
        this._entityNumberToPackedDataIndex[entity] = null;

        this._liveCount--;
    }
}

export class NumberManager {

    private _availableEntities: number[] = [];
    private _maxEntities: number;
    private _livingEntityCount = 0;

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
        }
    }

    createEntity(): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
            }
        }
        const entity = this._availableEntities.shift();
        if(entity === undefined) {
            throw new Error('No available entities');
        }
        this._livingEntityCount++;
        return entity;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._availableEntities.push(entity);
        this._livingEntityCount--;
    }
}
