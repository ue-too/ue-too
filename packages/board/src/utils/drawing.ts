import { Point, PointCal } from '@ue-too/math';

import { calculateOrderOfMagnitude } from './ruler';

/**
 * Draws an arrow from start to end point with an arrowhead.
 *
 * @param context - The canvas 2D rendering context
 * @param cameraZoomLevel - Current camera zoom level for scale-independent sizing
 * @param startPoint - Arrow tail position in world coordinates
 * @param endPoint - Arrow head position in world coordinates
 * @param width - Line width in world units (default: 1)
 * @param arrowRatio - Ratio of arrowhead size to total length (default: 0.3, unused in implementation)
 *
 * @remarks
 * The arrow consists of a line segment and a triangular arrowhead. The arrowhead
 * size is adaptive:
 * - Maximum 10 pixels in viewport space
 * - Minimum half the arrow length
 *
 * This ensures arrows look good at all zoom levels and lengths.
 *
 * The arrowhead is constructed perpendicular to the arrow direction, creating
 * a filled triangle at the end point.
 *
 * @example
 * ```typescript
 * const ctx = canvas.getContext('2d');
 * const zoom = 1.5;
 *
 * // Draw a simple arrow
 * ctx.fillStyle = 'blue';
 * ctx.strokeStyle = 'blue';
 * drawArrow(ctx, zoom, { x: 0, y: 0 }, { x: 100, y: 50 });
 *
 * // Draw a thicker arrow
 * ctx.fillStyle = 'red';
 * ctx.strokeStyle = 'red';
 * drawArrow(ctx, zoom, { x: 0, y: 0 }, { x: 100, y: -50 }, 3);
 * ```
 *
 * @category Drawing Utilities
 */
export function drawArrow(
    context: CanvasRenderingContext2D,
    cameraZoomLevel: number,
    startPoint: Point,
    endPoint: Point,
    width: number = 1,
    arrowRatio: number = 0.3
) {
    const length = PointCal.distanceBetweenPoints(startPoint, endPoint);
    const arrowHeight =
        10 < length * cameraZoomLevel * 0.5
            ? 10 / cameraZoomLevel
            : length * 0.5;
    const offsetLength = length - arrowHeight;
    const offsetPoint = PointCal.linearInterpolation(
        startPoint,
        endPoint,
        offsetLength / length
    );
    context.beginPath();
    context.lineWidth = width / cameraZoomLevel;
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(offsetPoint.x, offsetPoint.y);
    context.stroke();
    const unitVector = PointCal.rotatePoint(
        PointCal.unitVectorFromA2B(endPoint, startPoint),
        Math.PI / 2
    );
    const arrowPoint1 = PointCal.addVector(
        offsetPoint,
        PointCal.multiplyVectorByScalar(unitVector, arrowHeight * 0.5)
    );
    const arrowPoint2 = PointCal.subVector(
        offsetPoint,
        PointCal.multiplyVectorByScalar(unitVector, arrowHeight * 0.5)
    );
    context.beginPath();
    context.moveTo(endPoint.x, endPoint.y);
    context.lineTo(arrowPoint1.x, arrowPoint1.y);
    context.lineTo(arrowPoint2.x, arrowPoint2.y);
    context.closePath();
    context.fill();
}

/**
 * Length of major tick marks in pixels (viewport space).
 * @category Drawing Utilities
 */
export const MAJOR_TICK_LENGTH = 30;

/**
 * Length of minor tick marks in pixels (viewport space).
 * @category Drawing Utilities
 */
export const MINOR_TICK_LENGTH = MAJOR_TICK_LENGTH * 0.3;

/**
 * Length of half-step tick marks in pixels (viewport space).
 * @category Drawing Utilities
 */
export const HALF_TICK_LENGTH = MAJOR_TICK_LENGTH * 0.5;

/**
 * Offset for major tick labels in pixels (viewport space).
 * @category Drawing Utilities
 */
export const TEXT_MAJOR_TICK_OFFSET = 10;

/**
 * Offset for half-step tick labels in pixels (viewport space).
 * @category Drawing Utilities
 */
export const TEXT_HALF_TICK_OFFSET = 2.5;

/**
 * Font size for major tick labels in pixels (viewport space).
 * @category Drawing Utilities
 */
export const TEXT_MAJOR_TICK_FONT_SIZE = 20;

/**
 * Font size for half-step tick labels in pixels (viewport space).
 * @category Drawing Utilities
 */
export const TEXT_HALF_TICK_FONT_SIZE = 10;

/**
 * Draws calibrated rulers along the edges of the viewport.
 *
 * @param context - The canvas 2D rendering context
 * @param topLeftCorner - Top-left corner of viewport in world coordinates
 * @param topRightCorner - Top-right corner of viewport in world coordinates
 * @param bottomLeftCorner - Bottom-left corner of viewport in world coordinates
 * @param alignCoordinateSystem - Whether coordinates align with canvas (y-down) or are mathematical (y-up)
 * @param cameraZoomLevel - Current camera zoom level
 *
 * @remarks
 * This function draws rulers with three levels of tick marks:
 * - Major ticks: At powers of 10 (1, 10, 100, etc.) with large labels
 * - Half ticks: At half-steps (5, 50, 500, etc.) with small labels
 * - Minor ticks: At 1/10 steps with no labels
 *
 * The ruler automatically adapts to the zoom level by calculating appropriate
 * tick spacing using {@link calculateOrderOfMagnitude} and {@link calculateTickValues}.
 *
 * Rulers are drawn along:
 * - Top edge (horizontal ruler, red)
 * - Left edge (vertical ruler, green)
 *
 * Tick positions are calibrated to align with round numbers in world space,
 * making it easy to read coordinates at any zoom level.
 *
 * @example
 * ```typescript
 * const ctx = canvas.getContext('2d');
 * const zoom = 2.0;
 *
 * // Viewport corners in world space
 * const topLeft = { x: -100, y: 100 };
 * const topRight = { x: 100, y: 100 };
 * const bottomLeft = { x: -100, y: -100 };
 *
 * drawRuler(ctx, topLeft, topRight, bottomLeft, false, zoom);
 * // Draws rulers with ticks at -100, -50, 0, 50, 100
 * ```
 *
 * @category Drawing Utilities
 * @see {@link calculateTickValues} for tick calculation logic
 * @see {@link calculateOrderOfMagnitude} for order of magnitude calculation
 */
export function drawRuler(
    context: CanvasRenderingContext2D,
    topLeftCorner: Point,
    topRightCorner: Point,
    bottomLeftCorner: Point,
    alignCoordinateSystem: boolean,
    cameraZoomLevel: number
): void {
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
    for (
        let i = minMajorTickValue;
        i <= maxMajorTickValue;
        i += majorTickStep
    ) {
        const majorTickPoint = {
            x: i * calibrationMultiplier,
            y: topLeftCorner.y,
        };
        const majorTickLength = alignCoordinateSystem
            ? MAJOR_TICK_LENGTH / cameraZoomLevel
            : -MAJOR_TICK_LENGTH / cameraZoomLevel;
        const textOffset = alignCoordinateSystem
            ? TEXT_MAJOR_TICK_OFFSET / cameraZoomLevel
            : -TEXT_MAJOR_TICK_OFFSET / cameraZoomLevel;
        drawXAxisTick(
            context,
            cameraZoomLevel,
            majorTickPoint,
            majorTickLength,
            i * calibrationMultiplier,
            { textOffset, fontSize: TEXT_MAJOR_TICK_FONT_SIZE }
        );
    }

    for (let i = minMinTickValue; i <= maxMaxTickValue; i += minTickStep) {
        if (i % majorTickStep === 0) {
            continue;
        }
        if (i % halfTickStep === 0) {
            continue;
        }
        const minTickPoint = {
            x: i * calibrationMultiplier,
            y: topLeftCorner.y,
        };
        const minTickLength = alignCoordinateSystem
            ? MINOR_TICK_LENGTH / cameraZoomLevel
            : -MINOR_TICK_LENGTH / cameraZoomLevel;
        drawXAxisTick(context, cameraZoomLevel, minTickPoint, minTickLength, i);
    }

    for (let i = minHalfTickValue; i <= maxHalfTickValue; i += halfTickStep) {
        if (i % majorTickStep === 0) {
            continue;
        }
        const halfTickPoint = {
            x: i * calibrationMultiplier,
            y: topLeftCorner.y,
        };
        const halfTickLength = alignCoordinateSystem
            ? HALF_TICK_LENGTH / cameraZoomLevel
            : -HALF_TICK_LENGTH / cameraZoomLevel;
        const textOffset = alignCoordinateSystem
            ? TEXT_HALF_TICK_OFFSET / cameraZoomLevel
            : -TEXT_HALF_TICK_OFFSET / cameraZoomLevel;
        drawXAxisTick(
            context,
            cameraZoomLevel,
            halfTickPoint,
            halfTickLength,
            i * calibrationMultiplier,
            { textOffset, fontSize: TEXT_HALF_TICK_FONT_SIZE, color: 'red' }
        );
    }

    context.restore();

    // NOTE vertical ruler
    const {
        minMajorTickValue: vMinMajorTickValue,
        maxMajorTickValue: vMaxMajorTickValue,
        majorTickStep: vMajorTickStep,
        minMinTickValue: vMinMinTickValue,
        maxMaxTickValue: vMaxMaxTickValue,
        minTickStep: vMinTickStep,
        minHalfTickValue: vMinHalfTickValue,
        maxHalfTickValue: vMaxHalfTickValue,
        halfTickStep: vHalfTickStep,
        calibrationMultiplier: vCalibrationMultiplier,
    } = calculateTickValues(
        topLeftCorner.y,
        bottomLeftCorner.y,
        normalizedOrderOfMagnitude
    );

    context.save();
    context.strokeStyle = 'green';
    for (
        let i = vMinMajorTickValue;
        i <= vMaxMajorTickValue;
        i += vMajorTickStep
    ) {
        const majorTickPoint = {
            x: topLeftCorner.x,
            y: i * vCalibrationMultiplier,
        };
        const majorTickLength = MAJOR_TICK_LENGTH / cameraZoomLevel;
        const textOffset = TEXT_MAJOR_TICK_OFFSET / cameraZoomLevel;
        drawYAxisTick(
            context,
            cameraZoomLevel,
            majorTickPoint,
            majorTickLength,
            i,
            { textOffset, fontSize: TEXT_MAJOR_TICK_FONT_SIZE }
        );
    }

    for (
        let i = vMinHalfTickValue;
        i <= vMaxHalfTickValue;
        i += vHalfTickStep
    ) {
        if (i % vMajorTickStep === 0) {
            continue;
        }
        const halfTickPoint = {
            x: topLeftCorner.x,
            y: i * vCalibrationMultiplier,
        };
        const halfTickLength = HALF_TICK_LENGTH / cameraZoomLevel;
        const textOffset = TEXT_HALF_TICK_OFFSET / cameraZoomLevel;
        drawYAxisTick(
            context,
            cameraZoomLevel,
            halfTickPoint,
            halfTickLength,
            i,
            { textOffset, fontSize: TEXT_HALF_TICK_FONT_SIZE }
        );
    }

    for (let i = vMinMinTickValue; i <= vMaxMaxTickValue; i += vMinTickStep) {
        if (i % vMajorTickStep === 0) {
            continue;
        }
        const minTickPoint = {
            x: topLeftCorner.x,
            y: i * vCalibrationMultiplier,
        };
        const minTickLength = MINOR_TICK_LENGTH / cameraZoomLevel;
        drawYAxisTick(context, cameraZoomLevel, minTickPoint, minTickLength, i);
    }
    context.restore();
}

function drawYAxisTick(
    context: CanvasRenderingContext2D,
    cameraZoomLevel: number,
    majorTickPoint: { x: number; y: number },
    majorTickLength: number,
    tickValue: number,
    textOption?: {
        textOffset: number;
        fontSize: number;
        color?: string;
    }
) {
    const drawText = textOption !== undefined;
    context.save();
    context.lineWidth = 1 / cameraZoomLevel;
    context.beginPath();
    context.moveTo(majorTickPoint.x, majorTickPoint.y);
    context.lineTo(majorTickPoint.x + majorTickLength, majorTickPoint.y);
    context.stroke();
    context.restore();
    if (!drawText) {
        return;
    }
    const color = textOption.color ?? 'green';
    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.font = `${textOption.fontSize / cameraZoomLevel}px Arial`;
    const tickValueText = tickValue % 1 == 0 ? tickValue : tickValue.toFixed(2);
    context.fillText(
        `${tickValueText}`,
        majorTickPoint.x + majorTickLength + textOption.textOffset,
        majorTickPoint.y
    );
    context.restore();
}

function drawXAxisTick(
    context: CanvasRenderingContext2D,
    cameraZoomLevel: number,
    majorTickPoint: { x: number; y: number },
    majorTickLength: number,
    tickValue: number,
    textOption?: {
        textOffset: number;
        fontSize: number;
        color?: string;
    }
) {
    const drawText = textOption !== undefined;
    context.save();
    context.lineWidth = 1 / cameraZoomLevel;
    context.beginPath();
    context.moveTo(majorTickPoint.x, majorTickPoint.y);
    context.lineTo(majorTickPoint.x, majorTickPoint.y + majorTickLength);
    context.stroke();
    context.restore();
    if (!drawText) {
        return;
    }
    const color = textOption.color ?? 'red';
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = color;
    context.font = `${textOption.fontSize / cameraZoomLevel}px Arial`;
    const tickValueText = tickValue % 1 == 0 ? tickValue : tickValue.toFixed(2);
    context.fillText(
        `${tickValueText}`,
        majorTickPoint.x,
        majorTickPoint.y + majorTickLength + textOption.textOffset
    );
    context.restore();
}

/**
 * Calculates tick mark positions and spacing for a ruler.
 *
 * @param minValue - Minimum value on the ruler axis
 * @param maxValue - Maximum value on the ruler axis
 * @param orderOfMagnitude - Optional pre-calculated order of magnitude (for consistency across axes)
 * @returns Object containing tick positions and spacing for major, half, and minor ticks
 *
 * @remarks
 * This function determines where to place tick marks on a ruler to show round
 * numbers at appropriate intervals. It calculates three levels of ticks:
 *
 * 1. Major ticks: At powers of 10 (step = 10^n)
 * 2. Half ticks: At half the major step (step = 5×10^(n-1))
 * 3. Minor ticks: At 1/10 the major step (step = 10^(n-1))
 *
 * The calibration multiplier handles cases where the order of magnitude is very
 * small (< 1), ensuring tick positions are calculated correctly for zoomed-in views.
 *
 * For consistency between x and y axes, you can provide a pre-calculated
 * orderOfMagnitude. Otherwise, it's calculated from the range width.
 *
 * @example
 * ```typescript
 * // Ruler showing -100 to 100
 * const ticks = calculateTickValues(-100, 100);
 * // Result:
 * // majorTickStep: 100
 * // minMajorTickValue: -100, maxMajorTickValue: 100
 * // halfTickStep: 50
 * // minorTickStep: 10
 * // calibrationMultiplier: 1
 *
 * // Zoomed in view: 0.001 to 0.01
 * const zoomedTicks = calculateTickValues(0.001, 0.01);
 * // Result:
 * // majorTickStep: 10 (calibrated)
 * // calibrationMultiplier: 0.001 (multiply tick values by this)
 * ```
 *
 * @category Drawing Utilities
 * @see {@link calculateOrderOfMagnitude} for order calculation
 * @see {@link drawRuler} for usage in ruler drawing
 */
export function calculateTickValues(
    minValue: number,
    maxValue: number,
    orderOfMagnitude?: number
) {
    const trueMinValue = Math.min(minValue, maxValue);
    const trueMaxValue = Math.max(minValue, maxValue);

    const width = trueMaxValue - trueMinValue;
    const trueOrderOfMagnitude = orderOfMagnitude
        ? orderOfMagnitude
        : calculateOrderOfMagnitude(width);

    const normalizedOrderOfMagnitude = Math.max(1, trueOrderOfMagnitude);
    const calibrationMultiplier = Math.pow(
        10,
        normalizedOrderOfMagnitude - trueOrderOfMagnitude
    ); // this is the multiplier to calibrate the ruler to the correct length

    const minMajorTickMultiplier =
        minValue > 0
            ? Math.floor(
                  (trueMinValue * calibrationMultiplier) /
                      Math.pow(10, normalizedOrderOfMagnitude)
              )
            : Math.ceil(
                  (trueMinValue * calibrationMultiplier) /
                      Math.pow(10, normalizedOrderOfMagnitude)
              );
    const minMajorTickValue =
        minMajorTickMultiplier * Math.pow(10, normalizedOrderOfMagnitude);
    const maxMajorTickMultiplier =
        maxValue > 0
            ? Math.floor(
                  (trueMaxValue * calibrationMultiplier) /
                      Math.pow(10, normalizedOrderOfMagnitude)
              )
            : Math.ceil(
                  (trueMaxValue * calibrationMultiplier) /
                      Math.pow(10, normalizedOrderOfMagnitude)
              );
    const maxMajorTickValue =
        maxMajorTickMultiplier * Math.pow(10, normalizedOrderOfMagnitude);
    const majorTickStep = Math.pow(10, normalizedOrderOfMagnitude);

    // minor tick
    const minTickOrderOfMagnitude = normalizedOrderOfMagnitude - 1;
    const minMinTickMultiplier =
        minValue > 0
            ? Math.floor(
                  (trueMinValue * calibrationMultiplier) /
                      Math.pow(10, minTickOrderOfMagnitude)
              )
            : Math.ceil(
                  (trueMinValue * calibrationMultiplier) /
                      Math.pow(10, minTickOrderOfMagnitude)
              );
    const minMinTickValue =
        minMinTickMultiplier * Math.pow(10, minTickOrderOfMagnitude);
    const maxMaxTickMultiplier =
        maxValue > 0
            ? Math.floor(
                  (trueMaxValue * calibrationMultiplier) /
                      Math.pow(10, minTickOrderOfMagnitude)
              )
            : Math.ceil(
                  (trueMaxValue * calibrationMultiplier) /
                      Math.pow(10, minTickOrderOfMagnitude)
              );
    const maxMaxTickValue =
        maxMaxTickMultiplier * Math.pow(10, minTickOrderOfMagnitude);
    const minTickStep = Math.pow(10, minTickOrderOfMagnitude);

    const halfTickStep = majorTickStep / 2;
    const minHalfTickMultiplier =
        minValue > 0
            ? Math.floor((trueMinValue * calibrationMultiplier) / halfTickStep)
            : Math.ceil((trueMinValue * calibrationMultiplier) / halfTickStep);
    const minHalfTickValue = minHalfTickMultiplier * halfTickStep;
    const maxHalfTickMultiplier =
        maxValue > 0
            ? Math.floor((trueMaxValue * calibrationMultiplier) / halfTickStep)
            : Math.ceil((trueMaxValue * calibrationMultiplier) / halfTickStep);
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
    };
}
