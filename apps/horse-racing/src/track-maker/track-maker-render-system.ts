/**
 * Track maker Pixi.js render system.
 *
 * Subscribes to CurveCollectionModel changes and draws bezier curves,
 * control points, handles, direction arrows, and slope labels using
 * Pixi Graphics objects.
 *
 * Replaces the legacy Canvas 2D drawing from BezierCurve.draw() and
 * drawControlPoints().
 */

import { Assets, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { Bezier } from 'bezier-js';
import { PointCal, type Point } from '@ue-too/math';

import type { CurveCollectionModel } from './curve-collection-model';
import type { BezierCurveModel } from './bezier-curve-model';
import { HandleType, type ControlPoint } from './types';

// ---------------------------------------------------------------------------
// Color constants (matching legacy)
// ---------------------------------------------------------------------------

const COLOR_CURVE_DEFAULT = 0x000000;
const COLOR_CURVE_SELECTED = 0xff4f4f;
const COLOR_HANDLE_ALIGNED = 0xedb947;
const COLOR_HANDLE_FREE = 0xbd4456;
const COLOR_HANDLE_VECTOR = 0x7c9971;
const COLOR_CONTROL_POINT = 0x000000;
const COLOR_GRABBED_POINT = 0x4488ff;
const COLOR_SLOPE_LABEL = 0x333333;
const COLOR_ARROW = 0x000000;

const POINT_RADIUS = 5;
const HANDLE_LINE_WIDTH = 2;
const CURVE_LINE_WIDTH = 2;
const ARROW_SIZE = 3;

// ---------------------------------------------------------------------------
// TrackMakerRenderSystem
// ---------------------------------------------------------------------------

export class TrackMakerRenderSystem {
    private model: CurveCollectionModel;
    private container: Container;

    // Child containers for layering
    private referenceImageContainer: Container;
    private curvesContainer: Container;
    private controlPointsContainer: Container;
    private labelsContainer: Container;
    private arcFitContainer: Container;

    // Reusable graphics
    private curveGraphics: Graphics;
    private pointGraphics: Graphics;
    private arcFitGraphics: Graphics;

    // Reference image for tracing
    private referenceSprite: Sprite | null = null;

    private unsubscribe: (() => void) | null = null;
    private isEditMode = false;

    constructor(model: CurveCollectionModel, parentContainer: Container) {
        this.model = model;
        this.container = new Container();
        parentContainer.addChild(this.container);

        // Layer order: reference image (bottom) → curves → arc fit → labels → control points (top)
        this.referenceImageContainer = new Container();
        this.curvesContainer = new Container();
        this.arcFitContainer = new Container();
        this.labelsContainer = new Container();
        this.controlPointsContainer = new Container();

        this.container.addChild(this.referenceImageContainer);
        this.container.addChild(this.curvesContainer);
        this.container.addChild(this.arcFitContainer);
        this.container.addChild(this.labelsContainer);
        this.container.addChild(this.controlPointsContainer);

        this.curveGraphics = new Graphics();
        this.curvesContainer.addChild(this.curveGraphics);

        this.pointGraphics = new Graphics();
        this.controlPointsContainer.addChild(this.pointGraphics);

        this.arcFitGraphics = new Graphics();
        this.arcFitContainer.addChild(this.arcFitGraphics);

        this.unsubscribe = model.onChange(() => this.render());
    }

    setEditMode(editMode: boolean): void {
        this.isEditMode = editMode;
        this.render();
    }

    render(): void {
        this.curveGraphics.clear();
        this.pointGraphics.clear();
        this.arcFitGraphics.clear();
        this.clearLabels();

        const grabbed = this.model.getGrabbedPoint();

        for (const [ident, item] of this.model.getAllCurves()) {
            const curve = item.curve;
            const selected = item.selected;

            curve.updatePointsCoordinates();

            this.drawBezierCurves(curve, selected);
            this.drawDirectionArrows(curve, selected);
            this.drawSegmentLabels(curve);

            if (this.model.arcFitEnabled) {
                this.drawArcFit(curve, selected);
            }

            if (selected && this.isEditMode) {
                this.drawControlPoints(curve);
            }

            // Draw grabbed point highlight
            if (
                grabbed.ident === ident &&
                grabbed.pointIndex >= 0 &&
                grabbed.pointIndex < curve.controlPoints.length
            ) {
                this.drawGrabbedPoint(curve, grabbed.pointIndex, grabbed.pointType!);
            }
        }
    }

    // ------------------------------------------------------------------
    // Reference image for tracing
    // ------------------------------------------------------------------

    async setReferenceImage(dataUrl: string): Promise<void> {
        this.clearReferenceImage();
        const texture = await Assets.load(dataUrl);
        this.referenceSprite = new Sprite(texture);
        this.referenceSprite.anchor.set(0.5, 0.5);
        this.referenceSprite.alpha = 0.3;
        this.referenceImageContainer.addChild(this.referenceSprite);
    }

    clearReferenceImage(): void {
        if (this.referenceSprite) {
            this.referenceImageContainer.removeChild(this.referenceSprite);
            this.referenceSprite.destroy();
            this.referenceSprite = null;
        }
    }

    setReferenceImageOpacity(opacity: number): void {
        if (this.referenceSprite) {
            this.referenceSprite.alpha = opacity;
        }
    }

    getReferenceImageOpacity(): number {
        return this.referenceSprite?.alpha ?? 0.3;
    }

    hasReferenceImage(): boolean {
        return this.referenceSprite != null;
    }

    cleanup(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.container.destroy({ children: true });
    }

    // ------------------------------------------------------------------
    // Bezier curves
    // ------------------------------------------------------------------

    private drawBezierCurves(curve: BezierCurveModel, selected: boolean): void {
        const g = this.curveGraphics;
        const color = selected ? COLOR_CURVE_SELECTED : COLOR_CURVE_DEFAULT;

        for (let i = 0; i < curve.controlPoints.length - 1; i++) {
            const start = curve.controlPoints[i];
            const end = curve.controlPoints[i + 1];

            g.moveTo(start.transformedCoord.x, start.transformedCoord.y);
            g.bezierCurveTo(
                start.right_handle.transformedCoord.x,
                start.right_handle.transformedCoord.y,
                end.left_handle.transformedCoord.x,
                end.left_handle.transformedCoord.y,
                end.transformedCoord.x,
                end.transformedCoord.y,
            );
        }

        g.stroke({ width: CURVE_LINE_WIDTH, color });
    }

    // ------------------------------------------------------------------
    // Direction arrows
    // ------------------------------------------------------------------

    private drawDirectionArrows(curve: BezierCurveModel, selected: boolean): void {
        const g = this.curveGraphics;
        const color = selected ? COLOR_CURVE_SELECTED : COLOR_ARROW;

        for (let i = 0; i < curve.controlPoints.length - 1; i++) {
            const start = curve.controlPoints[i];
            const end = curve.controlPoints[i + 1];

            const bCurve = new Bezier([
                start.transformedCoord,
                start.right_handle.transformedCoord,
                end.left_handle.transformedCoord,
                end.transformedCoord,
            ]);
            const { arcLengths, fullArcLength } = curve.getArcLengths(bCurve);

            for (let pct = 0; pct <= 75; pct += 25) {
                const tVal = curve.mapPercentage2TVal(pct, arcLengths, fullArcLength);
                const pos = bCurve.get(tVal);
                const dir = PointCal.unitVector(bCurve.derivative(tVal));
                const tip = PointCal.addVector(pos, PointCal.multiplyVectorByScalar(dir, ARROW_SIZE));
                const left = PointCal.addVector(pos, PointCal.multiplyVectorByScalar(PointCal.rotatePoint(dir, Math.PI / 2), ARROW_SIZE));
                const right = PointCal.addVector(pos, PointCal.multiplyVectorByScalar(PointCal.rotatePoint(dir, -Math.PI / 2), ARROW_SIZE));

                g.moveTo(tip.x, tip.y);
                g.lineTo(left.x, left.y);
                g.moveTo(tip.x, tip.y);
                g.lineTo(right.x, right.y);
            }

            g.stroke({ width: 1, color });
        }
    }

    // ------------------------------------------------------------------
    // Segment labels (length + slope)
    // ------------------------------------------------------------------

    private drawSegmentLabels(curve: BezierCurveModel): void {
        for (let i = 0; i < curve.controlPoints.length - 1; i++) {
            const start = curve.controlPoints[i];
            const end = curve.controlPoints[i + 1];

            const bCurve = new Bezier([
                start.transformedCoord,
                start.right_handle.transformedCoord,
                end.left_handle.transformedCoord,
                end.transformedCoord,
            ]);
            const { arcLengths, fullArcLength } = curve.getArcLengths(bCurve);
            const tVal = curve.mapPercentage2TVal(12, arcLengths, fullArcLength);
            const pos = bCurve.get(tVal);
            const offsetDir = PointCal.rotatePoint(PointCal.unitVector(bCurve.derivative(tVal)), Math.PI / 2);
            const labelPos = PointCal.addVector(pos, PointCal.multiplyVectorByScalar(offsetDir, 30));

            const lengthStr = (fullArcLength * curve.scale).toFixed(1);
            let labelText = `${lengthStr}m`;
            if (start.slope != null) {
                labelText += ` | slope: ${start.slope.toFixed(3)}`;
            }

            const text = new Text({
                text: labelText,
                style: new TextStyle({
                    fontSize: 12,
                    fill: COLOR_SLOPE_LABEL,
                    fontFamily: 'sans-serif',
                }),
            });
            text.position.set(labelPos.x, labelPos.y);
            text.anchor.set(0.5, 0.5);
            this.labelsContainer.addChild(text);
        }
    }

    private clearLabels(): void {
        while (this.labelsContainer.children.length > 0) {
            const child = this.labelsContainer.children[0];
            this.labelsContainer.removeChild(child);
            child.destroy();
        }
    }

    // ------------------------------------------------------------------
    // Control points and handles
    // ------------------------------------------------------------------

    private drawControlPoints(curve: BezierCurveModel): void {
        const g = this.pointGraphics;

        for (const cp of curve.controlPoints) {
            // Control point circle
            this.drawCircle(g, cp.transformedCoord, POINT_RADIUS, COLOR_CONTROL_POINT, false);
            // Handle circles
            this.drawCircle(g, cp.left_handle.transformedCoord, POINT_RADIUS, COLOR_CONTROL_POINT, false);
            this.drawCircle(g, cp.right_handle.transformedCoord, POINT_RADIUS, COLOR_CONTROL_POINT, false);

            // Left handle line
            const lhColor = handleColor(cp.left_handle.handleType);
            g.moveTo(cp.transformedCoord.x, cp.transformedCoord.y);
            g.lineTo(cp.left_handle.transformedCoord.x, cp.left_handle.transformedCoord.y);
            g.stroke({ width: HANDLE_LINE_WIDTH, color: lhColor });

            // Right handle line
            const rhColor = handleColor(cp.right_handle.handleType);
            g.moveTo(cp.transformedCoord.x, cp.transformedCoord.y);
            g.lineTo(cp.right_handle.transformedCoord.x, cp.right_handle.transformedCoord.y);
            g.stroke({ width: HANDLE_LINE_WIDTH, color: rhColor });
        }
    }

    private drawGrabbedPoint(
        curve: BezierCurveModel,
        pointIndex: number,
        pointType: string,
    ): void {
        const cp = curve.controlPoints[pointIndex];
        let pos: Point;
        if (pointType === 'cp') pos = cp.transformedCoord;
        else if (pointType === 'lh') pos = cp.left_handle.transformedCoord;
        else pos = cp.right_handle.transformedCoord;

        this.drawCircle(this.pointGraphics, pos, POINT_RADIUS + 2, COLOR_GRABBED_POINT, true);
    }

    // ------------------------------------------------------------------
    // Arc fit visualization
    // ------------------------------------------------------------------

    private drawArcFit(curve: BezierCurveModel, selected: boolean): void {
        const g = this.arcFitGraphics;
        const color = selected ? COLOR_CURVE_SELECTED : 0x999999;

        for (let i = 0; i < curve.controlPoints.length - 1; i++) {
            const start = curve.controlPoints[i];
            const end = curve.controlPoints[i + 1];

            if (
                start.right_handle.handleType === HandleType.VECTOR &&
                end.left_handle.handleType === HandleType.VECTOR
            ) {
                continue; // straight segment, no arc fit
            }

            const bCurve = new Bezier([
                start.transformedCoord,
                start.right_handle.transformedCoord,
                end.left_handle.transformedCoord,
                end.transformedCoord,
            ]);

            try {
                const arcs = bCurve.arcs(0.05);
                for (const arc of arcs) {
                    const arcStart = bCurve.get(arc.interval.start);
                    const arcEnd = bCurve.get(arc.interval.end);

                    // Draw radius lines from center to arc endpoints
                    g.moveTo(arc.x, arc.y);
                    g.lineTo(arcStart.x, arcStart.y);
                    g.moveTo(arc.x, arc.y);
                    g.lineTo(arcEnd.x, arcEnd.y);
                }
                g.stroke({ width: 1, color });
            } catch {
                // Arc fitting can fail for degenerate curves
            }
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private drawCircle(
        g: Graphics,
        center: Point,
        radius: number,
        color: number,
        fill: boolean,
    ): void {
        g.circle(center.x, center.y, radius);
        if (fill) {
            g.fill({ color });
        } else {
            g.stroke({ width: 1, color });
        }
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function handleColor(type: HandleType): number {
    switch (type) {
        case HandleType.ALIGNED:
            return COLOR_HANDLE_ALIGNED;
        case HandleType.FREE:
            return COLOR_HANDLE_FREE;
        case HandleType.VECTOR:
            return COLOR_HANDLE_VECTOR;
    }
}
