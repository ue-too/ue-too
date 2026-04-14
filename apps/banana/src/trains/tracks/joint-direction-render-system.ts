import {
    CameraState,
    CameraZoomEventPayload,
    ObservableBoardCamera,
} from '@ue-too/board';
import { Container, Graphics } from 'pixi.js';

import { WorldRenderSystem } from '@/world-render-system';

import { JointDirectionPreferenceMap } from './joint-direction-preference-map';
import type { DirectionType } from './joint-direction-preference-map';
import type { TrackGraph } from './track';

/** Base radius for the hover dot (world units); effective size = this / zoomLevel. */
const HOVER_DOT_RADIUS = 8;

/** Number of sample points for the full segment highlight polyline. */
const HIGHLIGHT_SAMPLE_COUNT = 30;

/** Number of sample points for the curved arrow polyline. */
const ARROW_SAMPLE_COUNT = 10;

/** Fraction of the curve to follow for the curved arrow. */
const ARROW_CURVE_FRACTION = 0.2;

/** Line width for highlights and arrows (world units, scaled by 1/zoom). */
const LINE_WIDTH = 6;

/** Color for the selected branch (green-500). */
const COLOR_SELECTED = 0x22c55e;

/** Color for unselected branches (gray-400). */
const COLOR_UNSELECTED = 0x9ca3af;

/** Alpha for the selected branch. */
const ALPHA_SELECTED = 1.0;

/** Alpha for unselected branches. */
const ALPHA_UNSELECTED = 0.4;

/** Color for the hover dot (blue-400). */
const HOVER_DOT_COLOR = 0x60a5fa;

/** Alpha for the hover dot. */
const HOVER_DOT_ALPHA = 0.6;

/** Arrowhead length (world units, before scaling). */
const ARROWHEAD_LENGTH = 12;

/** Arrowhead half-width (world units, before scaling). */
const ARROWHEAD_HALF_WIDTH = 7;

/**
 * Renders direction indicator overlays on switch joints.
 *
 * Shows:
 * - A hover dot when the cursor is over a joint
 * - Segment highlight polylines and curved arrows when a joint is selected
 *
 * All indicators scale with 1/zoomLevel to remain constant screen size.
 */
export class JointDirectionRenderSystem {
    private _worldRenderSystem: WorldRenderSystem;
    private _trackGraph: TrackGraph;
    private _preferenceMap: JointDirectionPreferenceMap;
    private _camera: ObservableBoardCamera;

    private _overlayContainer: Container;
    private _highlightContainer: Container;
    private _arrowContainer: Container;
    private _hoverGraphic: Graphics;

    private _zoomLevel: number;
    private _selectedJointNumber: number | null = null;
    private _abortController = new AbortController();

    constructor(
        worldRenderSystem: WorldRenderSystem,
        trackGraph: TrackGraph,
        preferenceMap: JointDirectionPreferenceMap,
        camera: ObservableBoardCamera
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._trackGraph = trackGraph;
        this._preferenceMap = preferenceMap;
        this._camera = camera;

        this._overlayContainer = new Container();
        this._highlightContainer = new Container();
        this._arrowContainer = new Container();
        this._hoverGraphic = new Graphics();

        this._overlayContainer.addChild(this._highlightContainer);
        this._overlayContainer.addChild(this._arrowContainer);
        this._overlayContainer.addChild(this._hoverGraphic);

        this._overlayContainer.visible = false;

        this._worldRenderSystem.addOverlayContainer(this._overlayContainer);

        this._zoomLevel = this._camera.zoomLevel;
        this._camera.on('zoom', this._onZoom.bind(this), {
            signal: this._abortController.signal,
        });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** The currently selected joint number, or null if none. */
    get selectedJoint(): number | null {
        return this._selectedJointNumber;
    }

    /** Make overlay visible (tool activated). */
    show(): void {
        this._overlayContainer.visible = true;
    }

    /** Hide overlay and clear everything (tool deactivated). */
    hide(): void {
        this._overlayContainer.visible = false;
        this._clearSelection();
        this._hoverGraphic.clear();
        this._selectedJointNumber = null;
    }

    /** Draw a dot on the hovered joint. */
    showHoverIndicator(jointNumber: number): void {
        const joint = this._trackGraph.getJoint(jointNumber);
        if (joint === null) return;

        const scale = 1 / this._zoomLevel;
        const radius = HOVER_DOT_RADIUS * scale;

        this._hoverGraphic.clear();
        this._hoverGraphic.circle(joint.position.x, joint.position.y, radius);
        this._hoverGraphic.fill({
            color: HOVER_DOT_COLOR,
            alpha: HOVER_DOT_ALPHA,
        });
    }

    /** Remove the hover dot. */
    clearHoverIndicator(): void {
        this._hoverGraphic.clear();
    }

    /** Show arrows and highlights for the given joint. */
    selectJoint(jointNumber: number): void {
        this._selectedJointNumber = jointNumber;
        this._drawSelection();
    }

    /** Remove arrows and highlights. */
    deselectJoint(): void {
        this._selectedJointNumber = null;
        this._clearSelection();
    }

    /** Redraw after a direction cycle. */
    refresh(): void {
        if (this._selectedJointNumber !== null) {
            this._drawSelection();
        }
    }

    /** Cleanup listeners and destroy containers. */
    dispose(): void {
        this._abortController.abort();
        this._overlayContainer.destroy({ children: true });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private _onZoom(_event: CameraZoomEventPayload, state: CameraState): void {
        this._zoomLevel = state.zoomLevel;
        if (this._selectedJointNumber !== null) {
            this._drawSelection();
        }
        // Redraw hover if visible
        // (hover will be redrawn by the next showHoverIndicator call from the state machine)
    }

    private _clearSelection(): void {
        const removed1 = this._highlightContainer.removeChildren();
        removed1.forEach(c => c.destroy({ children: true }));
        const removed2 = this._arrowContainer.removeChildren();
        removed2.forEach(c => c.destroy({ children: true }));
    }

    private _drawSelection(): void {
        this._clearSelection();

        const jointNumber = this._selectedJointNumber;
        if (jointNumber === null) return;

        const joint = this._trackGraph.getJoint(jointNumber);
        if (joint === null) return;

        const scale = 1 / this._zoomLevel;
        const directions: DirectionType[] = ['tangent', 'reverseTangent'];

        for (const direction of directions) {
            const branches = joint.direction[direction];
            if (branches.size <= 1) continue;

            // Determine selected branch
            const pref = this._preferenceMap.get(jointNumber, direction);
            const selectedBranch =
                pref !== undefined && branches.has(pref)
                    ? pref
                    : branches.values().next().value!;

            for (const nextJointNumber of branches) {
                const segmentNumber = joint.connections.get(nextJointNumber);
                if (segmentNumber === undefined) continue;

                const segment =
                    this._trackGraph.getTrackSegmentWithJoints(segmentNumber);
                if (segment === null) continue;

                const isSelected = nextJointNumber === selectedBranch;
                const color = isSelected ? COLOR_SELECTED : COLOR_UNSELECTED;
                const alpha = isSelected ? ALPHA_SELECTED : ALPHA_UNSELECTED;
                const lineWidth = LINE_WIDTH * scale;

                // Determine which end of the curve is at this joint
                const jointIsT0 = segment.t0Joint === jointNumber;

                // --- Highlight: full segment polyline ---
                const highlightGraphic = new Graphics();
                const highlightPoints = this._sampleCurve(
                    segment.curve,
                    0,
                    1,
                    HIGHLIGHT_SAMPLE_COUNT,
                    false
                );
                if (highlightPoints.length >= 2) {
                    highlightGraphic.moveTo(
                        highlightPoints[0]!.x,
                        highlightPoints[0]!.y
                    );
                    for (let i = 1; i < highlightPoints.length; i++) {
                        highlightGraphic.lineTo(
                            highlightPoints[i]!.x,
                            highlightPoints[i]!.y
                        );
                    }
                    highlightGraphic.stroke({ width: lineWidth, color, alpha });
                }
                this._highlightContainer.addChild(highlightGraphic);

                // --- Arrow: first ~20% of the curve from the joint side ---
                const arrowStart = jointIsT0 ? 0 : 1;
                const arrowEnd = jointIsT0
                    ? ARROW_CURVE_FRACTION
                    : 1 - ARROW_CURVE_FRACTION;
                const reverse = !jointIsT0;

                const arrowPoints = this._sampleCurve(
                    segment.curve,
                    arrowStart,
                    arrowEnd,
                    ARROW_SAMPLE_COUNT,
                    reverse
                );

                if (arrowPoints.length >= 2) {
                    const arrowGraphic = new Graphics();

                    arrowGraphic.moveTo(arrowPoints[0]!.x, arrowPoints[0]!.y);
                    for (let i = 1; i < arrowPoints.length; i++) {
                        arrowGraphic.lineTo(
                            arrowPoints[i]!.x,
                            arrowPoints[i]!.y
                        );
                    }
                    arrowGraphic.stroke({ width: lineWidth, color, alpha });

                    // Arrowhead at the tip
                    const tip = arrowPoints[arrowPoints.length - 1]!;
                    const prev = arrowPoints[arrowPoints.length - 2]!;
                    const dx = tip.x - prev.x;
                    const dy = tip.y - prev.y;
                    const mag = Math.sqrt(dx * dx + dy * dy);

                    if (mag > 1e-6) {
                        const ux = dx / mag;
                        const uy = dy / mag;
                        const perpX = -uy;
                        const perpY = ux;

                        const headLen = ARROWHEAD_LENGTH * scale;
                        const headHalfWidth = ARROWHEAD_HALF_WIDTH * scale;

                        const baseX = tip.x - headLen * ux;
                        const baseY = tip.y - headLen * uy;
                        const leftX = baseX + headHalfWidth * perpX;
                        const leftY = baseY + headHalfWidth * perpY;
                        const rightX = baseX - headHalfWidth * perpX;
                        const rightY = baseY - headHalfWidth * perpY;

                        arrowGraphic.moveTo(tip.x, tip.y);
                        arrowGraphic.lineTo(leftX, leftY);
                        arrowGraphic.lineTo(rightX, rightY);
                        arrowGraphic.closePath();
                        arrowGraphic.fill({ color, alpha });
                    }

                    this._arrowContainer.addChild(arrowGraphic);
                }
            }
        }
    }

    /**
     * Sample `count` evenly-spaced points along the curve from parameter `tFrom` to `tTo`.
     * If `reverse` is true, sample from `tFrom` down to `tTo` (i.e. tFrom > tTo).
     */
    private _sampleCurve(
        curve: { get(t: number): { x: number; y: number } },
        tFrom: number,
        tTo: number,
        count: number,
        reverse: boolean
    ): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const steps = count - 1;
        for (let i = 0; i <= steps; i++) {
            const frac = i / steps;
            const t = reverse
                ? tFrom - frac * (tFrom - tTo)
                : tFrom + frac * (tTo - tFrom);
            points.push(curve.get(t));
        }
        return points;
    }
}
