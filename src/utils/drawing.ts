import { Point, PointCal } from "point2point";
import { calculateOrderOfMagnitude } from "./ruler";

export function drawArrow(context: CanvasRenderingContext2D, cameraZoomLevel: number, startPoint: Point, endPoint: Point, width: number = 1, arrowRatio: number = 0.3) {
    const length = PointCal.distanceBetweenPoints(startPoint, endPoint);
    const arrowHeight = 10 < length * cameraZoomLevel * 0.5 ? 10 / cameraZoomLevel : length * 0.5;
    const offsetLength = length - arrowHeight;
    const offsetPoint = PointCal.linearInterpolation(startPoint, endPoint, offsetLength / length);
    context.beginPath();
    context.lineWidth = width / cameraZoomLevel;
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(offsetPoint.x, offsetPoint.y);
    context.stroke();
    const unitVector = PointCal.rotatePoint(PointCal.unitVectorFromA2B(endPoint, startPoint), Math.PI / 2);
    const arrowPoint1 = PointCal.addVector(offsetPoint, PointCal.multiplyVectorByScalar(unitVector, arrowHeight*0.5));
    const arrowPoint2 = PointCal.subVector(offsetPoint, PointCal.multiplyVectorByScalar(unitVector, arrowHeight*0.5));
    context.beginPath();
    context.moveTo(endPoint.x, endPoint.y);
    context.lineTo(arrowPoint1.x, arrowPoint1.y);
    context.lineTo(arrowPoint2.x, arrowPoint2.y);
    context.closePath();
    context.fill();
}

export const MAJOR_TICK_LENGTH = 30;
export const MINOR_TICK_LENGTH = MAJOR_TICK_LENGTH * 0.3;
export const HALF_TICK_LENGTH = MAJOR_TICK_LENGTH * 0.5;

/**
 * @description Draws a ruler on the canvas.
 * argument points are in world space
 * 
 * @category Utils
 * 
 */
export function drawRuler(
    context: CanvasRenderingContext2D, 
    topLeftCorner: Point, 
    topRightCorner: Point, 
    bottomLeftCorner: Point, 
    bottomRightCorner: Point, 
    alignCoordinateSystem: boolean, 
    cameraZoomLevel: number,
    showMinorTicks: boolean = true,
    showHalfTicks: boolean = true,
): void{

    // NOTE horizontal ruler
    const {
        minMajorTickValue, 
        maxMajorTickValue, 
        majorTickStep, 
        minMinTickValue, 
        maxMaxTickValue, 
        minTickStep, 
        minHalfTickValue, 
        maxHalfTickValue, 
        halfTickStep, 
        calibrationMultiplier, 
        normalizedOrderOfMagnitude,
    } = calculateTickValues(topLeftCorner.x, topRightCorner.x);

    context.save();
    context.strokeStyle = 'red';
    for(let i = minMajorTickValue; i <= maxMajorTickValue; i += majorTickStep){
        const majorTickPoint = {x: i * calibrationMultiplier, y: topLeftCorner.y};
        const majorTickLength = alignCoordinateSystem ? MAJOR_TICK_LENGTH / cameraZoomLevel : -MAJOR_TICK_LENGTH / cameraZoomLevel;
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(majorTickPoint.x, majorTickPoint.y);
        context.lineTo(majorTickPoint.x, majorTickPoint.y + majorTickLength);
        context.stroke();
        context.restore();
    }

    for(let i = minMinTickValue; i <= maxMaxTickValue; i += minTickStep){
        if(i % majorTickStep === 0){
            continue;
        }
        if(i % halfTickStep === 0){
            continue;
        }
        const minTickPoint = {x: i * calibrationMultiplier, y: topLeftCorner.y};
        const minTickLength = alignCoordinateSystem ? MINOR_TICK_LENGTH / cameraZoomLevel : -MINOR_TICK_LENGTH / cameraZoomLevel;
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(minTickPoint.x, minTickPoint.y);
        context.lineTo(minTickPoint.x, minTickPoint.y + minTickLength);
        context.stroke();
        context.restore();
    }

    for(let i = minHalfTickValue; i <= maxHalfTickValue; i += halfTickStep){
        if(i % majorTickStep === 0){
            continue;
        }
        const halfTickPoint = {x: i * calibrationMultiplier, y: topLeftCorner.y};
        const halfTickLength = alignCoordinateSystem ? HALF_TICK_LENGTH / cameraZoomLevel : -HALF_TICK_LENGTH / cameraZoomLevel;
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(halfTickPoint.x, halfTickPoint.y);
        context.lineTo(halfTickPoint.x, halfTickPoint.y + halfTickLength);
        context.stroke();
        context.restore();
    }

    context.restore();

    // NOTE vertical ruler
    const {
        minMajorTickValue: vMinMajorTickValue, maxMajorTickValue: vMaxMajorTickValue, majorTickStep: vMajorTickStep, 
        minMinTickValue: vMinMinTickValue, maxMaxTickValue: vMaxMaxTickValue, 
        minTickStep: vMinTickStep, 
        minHalfTickValue: vMinHalfTickValue, maxHalfTickValue: vMaxHalfTickValue, 
        halfTickStep: vHalfTickStep, 
        calibrationMultiplier: vCalibrationMultiplier,
    } = calculateTickValues(topLeftCorner.y, bottomLeftCorner.y, normalizedOrderOfMagnitude);

    context.save();
    context.strokeStyle = 'green';
    for(let i = vMinMajorTickValue; i <= vMaxMajorTickValue; i += vMajorTickStep){
        const majorTickPoint = {x: topLeftCorner.x, y: i * vCalibrationMultiplier};
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(majorTickPoint.x, majorTickPoint.y);
        context.lineTo(majorTickPoint.x + MAJOR_TICK_LENGTH / cameraZoomLevel, majorTickPoint.y);
        context.stroke();
        context.restore();
    }

    for(let i = vMinMinTickValue; i <= vMaxMaxTickValue; i += vMinTickStep){
        if(i % vMajorTickStep === 0){
            continue;
        }
        const minTickPoint = {x: topLeftCorner.x, y: i * vCalibrationMultiplier};
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(minTickPoint.x, minTickPoint.y);
        context.lineTo(minTickPoint.x + MINOR_TICK_LENGTH / cameraZoomLevel, minTickPoint.y);
        context.stroke();
        context.restore();
    }

    for(let i = vMinHalfTickValue; i <= vMaxHalfTickValue; i += vHalfTickStep){
        if(i % vMajorTickStep === 0){
            continue;
        }
        const halfTickPoint = {x: topLeftCorner.x, y: i * vCalibrationMultiplier};
        context.save();
        context.lineWidth = 1 / cameraZoomLevel;
        context.beginPath();
        context.moveTo(halfTickPoint.x, halfTickPoint.y);
        context.lineTo(halfTickPoint.x + HALF_TICK_LENGTH / cameraZoomLevel, halfTickPoint.y);
        context.stroke();
        context.restore();
    }
    context.restore();
}

export function calculateTickValues(minValue: number, maxValue: number, orderOfMagnitude?: number){
    const trueMinValue = Math.min(minValue, maxValue);
    const trueMaxValue = Math.max(minValue, maxValue);

    const width = trueMaxValue - trueMinValue;
    const trueOrderOfMagnitude = orderOfMagnitude ? orderOfMagnitude : calculateOrderOfMagnitude(width);

    const normalizedOrderOfMagnitude = Math.max(1, trueOrderOfMagnitude);
    const calibrationMultiplier = Math.pow(10, normalizedOrderOfMagnitude - trueOrderOfMagnitude); // this is the multiplier to calibrate the ruler to the correct length

    const minMajorTickMultiplier = 
        minValue > 0 ? 
        Math.floor(trueMinValue * calibrationMultiplier / Math.pow(10, normalizedOrderOfMagnitude)) : 
        Math.ceil(trueMinValue * calibrationMultiplier / Math.pow(10, normalizedOrderOfMagnitude));
    const minMajorTickValue = minMajorTickMultiplier * Math.pow(10, normalizedOrderOfMagnitude);
    const maxMajorTickMultiplier = 
        maxValue > 0 ? 
        Math.floor(trueMaxValue * calibrationMultiplier / Math.pow(10, normalizedOrderOfMagnitude)) : 
        Math.ceil(trueMaxValue * calibrationMultiplier / Math.pow(10, normalizedOrderOfMagnitude));
    const maxMajorTickValue = maxMajorTickMultiplier * Math.pow(10, normalizedOrderOfMagnitude);
    const majorTickStep = Math.pow(10, normalizedOrderOfMagnitude);

    // minor tick
    const minTickOrderOfMagnitude = normalizedOrderOfMagnitude - 1;
    const minMinTickMultiplier = 
        minValue > 0 ? 
        Math.floor(trueMinValue * calibrationMultiplier / Math.pow(10, minTickOrderOfMagnitude)) : 
        Math.ceil(trueMinValue * calibrationMultiplier / Math.pow(10, minTickOrderOfMagnitude));
    const minMinTickValue = minMinTickMultiplier * Math.pow(10, minTickOrderOfMagnitude);
    const maxMaxTickMultiplier = 
        maxValue > 0 ? 
        Math.floor(trueMaxValue * calibrationMultiplier / Math.pow(10, minTickOrderOfMagnitude)) :
        Math.ceil(trueMaxValue * calibrationMultiplier / Math.pow(10, minTickOrderOfMagnitude));
    const maxMaxTickValue = maxMaxTickMultiplier * Math.pow(10, minTickOrderOfMagnitude);
    const minTickStep = Math.pow(10, minTickOrderOfMagnitude);

    const halfTickStep = majorTickStep / 2;
    const minHalfTickMultiplier = 
        minValue > 0 ? 
        Math.floor(trueMinValue * calibrationMultiplier / halfTickStep) : 
        Math.ceil(trueMinValue * calibrationMultiplier / halfTickStep);
    const minHalfTickValue = minHalfTickMultiplier * halfTickStep;
    const maxHalfTickMultiplier = 
        maxValue > 0 ? 
        Math.floor(trueMaxValue * calibrationMultiplier / halfTickStep) : 
        Math.ceil(trueMaxValue * calibrationMultiplier / halfTickStep);
    const maxHalfTickValue = maxHalfTickMultiplier * halfTickStep;

    return {
        minMajorTickValue,
        maxMajorTickValue,
        majorTickStep,
        minMinTickValue,
        maxMaxTickValue,
        minTickStep,
        minHalfTickValue,
        maxHalfTickValue,
        halfTickStep,
        calibrationMultiplier: 1 / calibrationMultiplier,
        normalizedOrderOfMagnitude,
    }
}
