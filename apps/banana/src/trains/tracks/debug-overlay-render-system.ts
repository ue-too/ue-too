import { Container, Graphics, Text } from 'pixi.js';
import { CameraState, CameraZoomEventPayload, ObservableBoardCamera } from '@ue-too/board';
import { PointCal } from '@ue-too/math';
import { WorldRenderSystem } from '@/world-render-system';
import type { TrackGraph } from './track';

/** Base radius of the circle (world units); effective size = this / zoomLevel for constant screen size. */
const LABEL_CIRCLE_RADIUS = 8;

/** Arrow length in local units (scales with label for constant screen size). */
const ARROW_LENGTH = 22;

/** Arrowhead size (length from tip back along shaft). */
const ARROW_HEAD_SIZE = 8;

/** Arrowhead half-width (perpendicular to shaft). */
const ARROW_HEAD_HALF_WIDTH = 5;

/** Base font size for debug labels; effective size scales with 1/zoom for constant screen size. */
const LABEL_FONT_SIZE = 14;

/** Fill color for joint label circles (debug). */
const JOINT_CIRCLE_FILL = 0x2563eb;

/** Fill color for segment label circles (debug). */
const SEGMENT_CIRCLE_FILL = 0x16a34a;

/**
 * Renders debug overlays for joints (joint number in a circle) and track segments
 * (segment id in a circle) on the world overlay layer. For debug only; can be
 * toggled on or off.
 */
export class DebugOverlayRenderSystem {
    private _worldRenderSystem: WorldRenderSystem;
    private _trackGraph: TrackGraph;
    private _camera: ObservableBoardCamera;
    private _overlayContainer: Container;
    private _jointContainer: Container;
    private _segmentContainer: Container;
    private _showJointNumbers = false;
    private _showSegmentIds = false;
    private _zoomLevel = 1;
    private _abortController = new AbortController();

    constructor(
        worldRenderSystem: WorldRenderSystem,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._overlayContainer = new Container();
        this._jointContainer = new Container();
        this._segmentContainer = new Container();
        this._overlayContainer.addChild(this._jointContainer);
        this._overlayContainer.addChild(this._segmentContainer);
        this._worldRenderSystem.addOverlayContainer(this._overlayContainer);

        this._zoomLevel = this._camera.zoomLevel;
        this._camera.on('zoom', this._onZoom.bind(this), { signal: this._abortController.signal });

        const tcm = trackGraph.trackCurveManager;
        tcm.onAdd(() => this.refresh(), { signal: this._abortController.signal });
        tcm.onDelete(() => this.refresh(), { signal: this._abortController.signal });
        trackGraph.onSegmentSplit(() => this.refresh(), { signal: this._abortController.signal });
    }

    private _onZoom(_event: CameraZoomEventPayload, state: CameraState): void {
        this._zoomLevel = state.zoomLevel;
        this._updateLabelScales();
    }

    /** Set scale on all label nodes to 1/zoom so circles and text stay constant screen size. */
    private _updateLabelScales(): void {
        const scale = 1 / this._zoomLevel;
        for (const child of this._jointContainer.children) {
            child.scale.set(scale);
        }
        for (const child of this._segmentContainer.children) {
            child.scale.set(scale);
        }
    }

    /** Whether joint numbers are visible. */
    get showJointNumbers(): boolean {
        return this._showJointNumbers;
    }

    /** Show or hide joint number labels. */
    setShowJointDebug(show: boolean): void {
        if (this._showJointNumbers === show) return;
        this._showJointNumbers = show;
        this._jointContainer.visible = show;
        if (show) this._rebuildJointLabels();
    }

    /** Whether segment IDs are visible. */
    get showSegmentIds(): boolean {
        return this._showSegmentIds;
    }

    /** Show or hide track segment ID labels. */
    setShowSegmentDebug(show: boolean): void {
        if (this._showSegmentIds === show) return;
        this._showSegmentIds = show;
        this._segmentContainer.visible = show;
        if (show) this._rebuildSegmentLabels();
    }

    /**
     * Rebuild joint and segment labels (e.g. after track graph changes).
     * Only rebuilds the layers that are currently visible.
     */
    refresh(): void {
        if (this._showJointNumbers) this._rebuildJointLabels();
        if (this._showSegmentIds) this._rebuildSegmentLabels();
    }

    private _rebuildJointLabels(): void {
        const removed = this._jointContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        const joints = this._trackGraph.getJoints();
        for (const { jointNumber, joint } of joints) {
            const { position, tangent } = joint;
            const arrowDir =
                PointCal.magnitude(tangent) > 1e-6 ? PointCal.unitVector(tangent) : null;
            const node = this._makeLabelNode(
                String(jointNumber),
                position.x,
                position.y,
                JOINT_CIRCLE_FILL,
                arrowDir,
            );
            this._jointContainer.addChild(node);
        }
    }

    private _rebuildSegmentLabels(): void {
        const removed = this._segmentContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        const segmentIds = this._trackGraph.trackCurveManager.livingEntities;
        for (const segmentNumber of segmentIds) {
            const segment = this._trackGraph.getTrackSegmentWithJoints(segmentNumber);
            if (segment === null) continue;
            const mid = segment.curve.get(0.5);
            const derivative = segment.curve.derivative(0.5);
            const positiveDir =
                PointCal.magnitude(derivative) > 1e-6 ? PointCal.unitVector(derivative) : null;
            const node = this._makeLabelNode(
                String(segmentNumber),
                mid.x,
                mid.y,
                SEGMENT_CIRCLE_FILL,
                positiveDir,
            );
            this._segmentContainer.addChild(node);
        }
    }

    private _makeLabelNode(
        textStr: string,
        x: number,
        y: number,
        circleFill: number,
        arrowDirection: { x: number; y: number } | null = null,
    ): Container {
        const container = new Container();
        container.position.set(x, y);
        container.scale.set(1 / this._zoomLevel);

        if (arrowDirection !== null) {
            const arrow = this._makeArrowGraphic(arrowDirection.x, arrowDirection.y, circleFill);
            container.addChild(arrow);
        }

        const circle = new Graphics();
        circle.circle(0, 0, LABEL_CIRCLE_RADIUS);
        circle.fill({ color: circleFill, alpha: 0.9 });
        circle.stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
        container.addChild(circle);

        const text = new Text({
            text: textStr,
            style: {
                fontFamily: 'sans-serif',
                fontSize: LABEL_FONT_SIZE,
                fill: 0xffffff,
            },
        });
        text.anchor.set(0.5, 0.5);
        text.position.set(0, 0);
        container.addChild(text);

        return container;
    }

    /**
     * Draws an arrow from (0,0) in the given unit direction. Used for joint tangent and segment positive direction.
     */
    private _makeArrowGraphic(dx: number, dy: number, color: number): Graphics {
        const g = new Graphics();
        const tipX = ARROW_LENGTH * dx;
        const tipY = ARROW_LENGTH * dy;
        const backX = tipX - ARROW_HEAD_SIZE * dx;
        const backY = tipY - ARROW_HEAD_SIZE * dy;
        const perpX = -dy;
        const perpY = dx;
        const leftX = backX + ARROW_HEAD_HALF_WIDTH * perpX;
        const leftY = backY + ARROW_HEAD_HALF_WIDTH * perpY;
        const rightX = backX - ARROW_HEAD_HALF_WIDTH * perpX;
        const rightY = backY - ARROW_HEAD_HALF_WIDTH * perpY;

        g.moveTo(0, 0);
        g.lineTo(backX, backY);
        g.stroke({ color, width: 2, alpha: 0.95 });
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.closePath();
        g.fill({ color, alpha: 0.95 });
        g.stroke({ color: 0xffffff, width: 1, alpha: 0.8 });

        return g;
    }

    /** Remove overlay and release resources. */
    cleanup(): void {
        this._abortController.abort();
        this._worldRenderSystem.removeOverlayContainer(this._overlayContainer);
        this._overlayContainer.destroy({ children: true });
    }
}
