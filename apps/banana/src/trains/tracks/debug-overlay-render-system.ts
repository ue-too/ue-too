import {
    CameraState,
    CameraZoomEventPayload,
    ObservableBoardCamera,
} from '@ue-too/board';
import { PointCal } from '@ue-too/math';
import { Container, Graphics, Text } from 'pixi.js';

import type { StationManager } from '@/stations/station-manager';
import type { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { ProximityDetector } from '@/trains/proximity-detector';
import type { PlacedTrainEntry } from '@/trains/train-manager';
import { WorldRenderSystem } from '@/world-render-system';

import { findPresetByWidth } from './gauge-presets';
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

/** Per-gauge label colors so different gauges are visually distinct in the debug overlay. */
const GAUGE_COLOR_MAP: Record<string, number> = {
    'narrow-cape': 0x0891b2, // cyan
    meter: 0x8b5cf6, // purple
    standard: 0x2563eb, // blue
    russian: 0xd97706, // amber
    'broad-indian': 0xdc2626, // red
};

/** Fallback color for custom (non-preset) gauges. */
const GAUGE_LABEL_FILL_CUSTOM = 0x71717a; // gray

/** Fill color for formation ID label circles (debug). */
const FORMATION_CIRCLE_FILL = 0xd97706;

/** Fill color for station stop position label circles (debug). */
const STATION_STOP_CIRCLE_FILL = 0xdc2626;

/** Fill color for station location label circles (debug). */
const STATION_LOCATION_CIRCLE_FILL = 0x7c3aed;

/** Color for coupling proximity lines (debug). */
const PROXIMITY_LINE_COLOR = 0x22c55e;

/** Radius of proximity endpoint dots (world units, scaled by 1/zoom). */
const PROXIMITY_DOT_RADIUS = 6;

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
    private _formationContainer: Container;
    private _stationStopContainer: Container;
    private _stationLocationContainer: Container;
    private _proximityContainer: Container;
    private _showJointNumbers = false;
    private _showSegmentIds = false;
    private _gaugeContainer: Container;
    private _showGaugeLabels = false;
    private _showFormationIds = false;
    private _showStationStops = false;
    private _showStationLocations = false;
    private _showProximityLines = false;
    private _getPlacedTrains: (() => readonly PlacedTrainEntry[]) | null = null;
    private _stationManager: StationManager | null = null;
    private _trackAlignedPlatformManager: TrackAlignedPlatformManager | null = null;
    private _proximityDetector: ProximityDetector | null = null;
    private _zoomLevel = 1;
    private _abortController = new AbortController();

    constructor(
        worldRenderSystem: WorldRenderSystem,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._overlayContainer = new Container();
        this._jointContainer = new Container();
        this._segmentContainer = new Container();
        this._gaugeContainer = new Container();
        this._gaugeContainer.visible = false;
        this._formationContainer = new Container();
        this._stationStopContainer = new Container();
        this._stationLocationContainer = new Container();
        this._proximityContainer = new Container();
        this._formationContainer.visible = false;
        this._stationStopContainer.visible = false;
        this._stationLocationContainer.visible = false;
        this._proximityContainer.visible = false;
        this._overlayContainer.addChild(this._jointContainer);
        this._overlayContainer.addChild(this._segmentContainer);
        this._overlayContainer.addChild(this._gaugeContainer);
        this._overlayContainer.addChild(this._formationContainer);
        this._overlayContainer.addChild(this._stationStopContainer);
        this._overlayContainer.addChild(this._stationLocationContainer);
        this._overlayContainer.addChild(this._proximityContainer);
        this._worldRenderSystem.addOverlayContainer(this._overlayContainer);

        this._zoomLevel = this._camera.zoomLevel;
        this._camera.on('zoom', this._onZoom.bind(this), {
            signal: this._abortController.signal,
        });

        const tcm = trackGraph.trackCurveManager;
        tcm.onAdd(() => this.refresh(), {
            signal: this._abortController.signal,
        });
        trackGraph.onSegmentRemoved(() => this.refresh(), {
            signal: this._abortController.signal,
        });
        trackGraph.onSegmentSplit(() => this.refresh(), {
            signal: this._abortController.signal,
        });
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
        for (const child of this._gaugeContainer.children) {
            child.scale.set(scale);
        }
        for (const child of this._formationContainer.children) {
            child.scale.set(scale);
        }
        for (const child of this._stationStopContainer.children) {
            child.scale.set(scale);
        }
        for (const child of this._stationLocationContainer.children) {
            child.scale.set(scale);
        }
        for (const child of this._proximityContainer.children) {
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

    /** Whether gauge labels are visible. */
    get showGaugeLabels(): boolean {
        return this._showGaugeLabels;
    }

    /** Show or hide gauge label overlays on track segments. */
    setShowGaugeDebug(show: boolean): void {
        if (this._showGaugeLabels === show) return;
        this._showGaugeLabels = show;
        this._gaugeContainer.visible = show;
        if (show) this._rebuildGaugeLabels();
    }

    /** Show or hide formation ID labels above each car. */
    setShowFormationDebug(show: boolean): void {
        if (this._showFormationIds === show) return;
        this._showFormationIds = show;
        this._formationContainer.visible = show;
    }

    /** Provide the getter for placed trains so formation labels can be rendered. */
    setPlacedTrainsGetter(getter: () => readonly PlacedTrainEntry[]): void {
        this._getPlacedTrains = getter;
    }

    /** Provide the station manager so stop position labels can be rendered. */
    setStationManager(stationManager: StationManager): void {
        this._stationManager = stationManager;
    }

    /** Provide the track-aligned platform manager so its stop labels are rendered too. */
    setTrackAlignedPlatformManager(manager: TrackAlignedPlatformManager): void {
        this._trackAlignedPlatformManager = manager;
        manager.onChange(() => this.refresh(), {
            signal: this._abortController.signal,
        });
    }

    /** Show or hide station stop position labels. */
    setShowStationStopDebug(show: boolean): void {
        if (this._showStationStops === show) return;
        this._showStationStops = show;
        this._stationStopContainer.visible = show;
        if (show) this._rebuildStationStopLabels();
    }

    /** Show or hide station location labels. */
    setShowStationLocationDebug(show: boolean): void {
        if (this._showStationLocations === show) return;
        this._showStationLocations = show;
        this._stationLocationContainer.visible = show;
        if (show) this._rebuildStationLocationLabels();
    }

    /** Provide the proximity detector for coupling debug lines. */
    setProximityDetector(detector: ProximityDetector): void {
        this._proximityDetector = detector;
    }

    /** Whether proximity lines are visible. */
    get showProximityLines(): boolean {
        return this._showProximityLines;
    }

    /** Show or hide coupling proximity debug lines. */
    setShowProximityDebug(show: boolean): void {
        if (this._showProximityLines === show) return;
        this._showProximityLines = show;
        this._proximityContainer.visible = show;
    }

    /**
     * Update formation ID labels each frame (cars move with trains).
     * Call this from the render loop after train positions have been updated.
     */
    updateFormationLabels(): void {
        if (!this._showFormationIds || this._getPlacedTrains === null) return;
        this._rebuildFormationLabels();
    }

    /**
     * Update proximity debug lines each frame.
     * Call this from the render loop after train positions and proximity detector have been updated.
     */
    updateProximityLines(): void {
        if (!this._showProximityLines) return;
        this._rebuildProximityLines();
    }

    /**
     * Rebuild joint and segment labels (e.g. after track graph changes).
     * Only rebuilds the layers that are currently visible.
     */
    refresh(): void {
        if (this._showJointNumbers) this._rebuildJointLabels();
        if (this._showSegmentIds) this._rebuildSegmentLabels();
        if (this._showGaugeLabels) this._rebuildGaugeLabels();
        if (this._showStationStops) this._rebuildStationStopLabels();
        if (this._showStationLocations) this._rebuildStationLocationLabels();
    }

    private _rebuildJointLabels(): void {
        const removed = this._jointContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        const joints = this._trackGraph.getJoints();
        for (const { jointNumber, joint } of joints) {
            const { position, tangent } = joint;
            const arrowDir =
                PointCal.magnitude(tangent) > 1e-6
                    ? PointCal.unitVector(tangent)
                    : null;
            const node = this._makeLabelNode(
                String(jointNumber),
                position.x,
                position.y,
                JOINT_CIRCLE_FILL,
                arrowDir
            );
            this._jointContainer.addChild(node);
        }
    }

    private _rebuildSegmentLabels(): void {
        const removed = this._segmentContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        const segmentIds = this._trackGraph.trackCurveManager.livingEntities;
        for (const segmentNumber of segmentIds) {
            const segment =
                this._trackGraph.getTrackSegmentWithJoints(segmentNumber);
            if (segment === null) continue;
            const mid = segment.curve.get(0.5);
            const derivative = segment.curve.derivative(0.5);
            const positiveDir =
                PointCal.magnitude(derivative) > 1e-6
                    ? PointCal.unitVector(derivative)
                    : null;
            const node = this._makeLabelNode(
                String(segmentNumber),
                mid.x,
                mid.y,
                SEGMENT_CIRCLE_FILL,
                positiveDir
            );
            this._segmentContainer.addChild(node);
        }
    }

    private _rebuildGaugeLabels(): void {
        const removed = this._gaugeContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        const segmentIds = this._trackGraph.trackCurveManager.livingEntities;
        for (const segmentNumber of segmentIds) {
            const segment =
                this._trackGraph.getTrackSegmentWithJoints(segmentNumber);
            if (segment === null) continue;
            const mid = segment.curve.get(0.5);
            const gauge = segment.gauge;
            const preset = findPresetByWidth(gauge);
            const label = preset
                ? `${preset.name} ${gauge}m`
                : `Custom ${gauge}m`;
            const color = preset
                ? (GAUGE_COLOR_MAP[preset.id] ?? GAUGE_LABEL_FILL_CUSTOM)
                : GAUGE_LABEL_FILL_CUSTOM;
            const node = this._makeLabelNode(
                label,
                mid.x,
                mid.y,
                color,
                null,
                true
            );
            this._gaugeContainer.addChild(node);
        }
    }

    private _rebuildFormationLabels(): void {
        const removed = this._formationContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        if (this._getPlacedTrains === null) return;
        const placed = this._getPlacedTrains();
        for (const { train } of placed) {
            const positions = train.getBogiePositions();
            if (positions === null || positions.length < 2) continue;
            const formationId = train.formation.name;
            const cars = train.cars;
            for (let k = 0; 2 * k + 1 < positions.length; k++) {
                const car = cars[k];
                if (!car) continue;
                const b0 = positions[2 * k].point;
                const b1 = positions[2 * k + 1].point;
                const cx = (b0.x + b1.x) / 2;
                const cy = (b0.y + b1.y) / 2;
                const node = this._makeLabelNode(
                    formationId,
                    cx,
                    cy,
                    FORMATION_CIRCLE_FILL,
                    null,
                    true
                );
                this._formationContainer.addChild(node);
            }
        }
    }

    private _rebuildProximityLines(): void {
        const removed = this._proximityContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        if (this._proximityDetector === null || this._getPlacedTrains === null)
            return;

        const placed = this._getPlacedTrains();
        const trainMap = new Map<number, PlacedTrainEntry>();
        for (const entry of placed) trainMap.set(entry.id, entry);

        const matches = this._proximityDetector.getMatches();
        const scale = 1 / this._zoomLevel;

        for (const match of matches) {
            const entryA = trainMap.get(match.trainA.id);
            const entryB = trainMap.get(match.trainB.id);
            if (!entryA || !entryB) continue;

            const bogiesA = entryA.train.getBogiePositions();
            const bogiesB = entryB.train.getBogiePositions();
            if (
                !bogiesA ||
                bogiesA.length === 0 ||
                !bogiesB ||
                bogiesB.length === 0
            )
                continue;

            const ptA =
                match.trainA.end === 'head'
                    ? bogiesA[0].point
                    : bogiesA[bogiesA.length - 1].point;
            const ptB =
                match.trainB.end === 'head'
                    ? bogiesB[0].point
                    : bogiesB[bogiesB.length - 1].point;

            // Draw a dashed-style line between endpoints with dots at each end
            const midX = (ptA.x + ptB.x) / 2;
            const midY = (ptA.y + ptB.y) / 2;

            const container = new Container();
            container.position.set(midX, midY);
            container.scale.set(scale);

            // Line (in local coordinates relative to midpoint)
            const line = new Graphics();
            const halfDx = (ptB.x - ptA.x) / 2 / scale;
            const halfDy = (ptB.y - ptA.y) / 2 / scale;
            line.moveTo(-halfDx, -halfDy);
            line.lineTo(halfDx, halfDy);
            line.stroke({ color: PROXIMITY_LINE_COLOR, width: 2, alpha: 0.8 });

            // Dots at each endpoint
            line.circle(-halfDx, -halfDy, PROXIMITY_DOT_RADIUS);
            line.fill({ color: PROXIMITY_LINE_COLOR, alpha: 0.6 });
            line.circle(halfDx, halfDy, PROXIMITY_DOT_RADIUS);
            line.fill({ color: PROXIMITY_LINE_COLOR, alpha: 0.6 });

            container.addChild(line);
            this._proximityContainer.addChild(container);
        }
    }

    private _rebuildStationLocationLabels(): void {
        const removed = this._stationLocationContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        if (this._stationManager === null) return;
        const stations = this._stationManager.getStations();
        for (const { station } of stations) {
            const node = this._makeLabelNode(
                station.name,
                station.position.x,
                station.position.y,
                STATION_LOCATION_CIRCLE_FILL,
                null,
                true
            );
            this._stationLocationContainer.addChild(node);
        }
    }

    private _rebuildStationStopLabels(): void {
        const removed = this._stationStopContainer.removeChildren();
        removed.forEach(c => c.destroy({ children: true }));
        if (this._stationManager === null) return;
        const stations = this._stationManager.getStations();
        for (const { station } of stations) {
            for (const platform of station.platforms) {
                this._addStopLabels(platform.stopPositions, `P${platform.id}`);
            }

            // Track-aligned platforms store stop positions on the platform entity.
            if (this._trackAlignedPlatformManager !== null) {
                for (const platformId of station.trackAlignedPlatforms) {
                    const tap = this._trackAlignedPlatformManager.getPlatform(platformId);
                    if (tap === null) continue;
                    this._addStopLabels(tap.stopPositions, `T${platformId}`);
                }
            }
        }
    }

    private _addStopLabels(
        stopPositions: readonly { trackSegmentId: number; direction: string; tValue: number }[],
        platformLabel: string,
    ): void {
        for (const stop of stopPositions) {
            const curve = this._trackGraph.getTrackSegmentCurve(
                stop.trackSegmentId
            );
            if (curve === null) continue;
            const pos = curve.get(stop.tValue);
            const derivative = curve.derivative(stop.tValue);
            const mag = PointCal.magnitude(derivative);
            let arrowDir: { x: number; y: number } | null = null;
            if (mag > 1e-6) {
                const unit = PointCal.unitVector(derivative);
                // 'tangent' points in derivative direction; 'reverseTangent' points opposite
                arrowDir =
                    stop.direction === 'tangent'
                        ? unit
                        : { x: -unit.x, y: -unit.y };
            }
            const label = `${platformLabel}:S${stop.trackSegmentId}`;
            const node = this._makeLabelNode(
                label,
                pos.x,
                pos.y,
                STATION_STOP_CIRCLE_FILL,
                arrowDir
            );
            this._stationStopContainer.addChild(node);
        }
    }

    private _makeLabelNode(
        textStr: string,
        x: number,
        y: number,
        circleFill: number,
        arrowDirection: { x: number; y: number } | null = null,
        pill: boolean = false
    ): Container {
        const container = new Container();
        container.position.set(x, y);
        container.scale.set(1 / this._zoomLevel);

        if (arrowDirection !== null) {
            const arrow = this._makeArrowGraphic(
                arrowDirection.x,
                arrowDirection.y,
                circleFill
            );
            container.addChild(arrow);
        }

        const bg = new Graphics();
        if (pill) {
            const pillHalfWidth = Math.max(
                LABEL_CIRCLE_RADIUS,
                textStr.length * 4 + 6
            );
            bg.roundRect(
                -pillHalfWidth,
                -LABEL_CIRCLE_RADIUS,
                pillHalfWidth * 2,
                LABEL_CIRCLE_RADIUS * 2,
                LABEL_CIRCLE_RADIUS
            );
        } else {
            bg.circle(0, 0, LABEL_CIRCLE_RADIUS);
        }
        bg.fill({ color: circleFill, alpha: 0.9 });
        bg.stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
        container.addChild(bg);

        const text = new Text({
            text: textStr,
            style: {
                fontFamily: 'sans-serif',
                fontSize: pill ? LABEL_FONT_SIZE - 2 : LABEL_FONT_SIZE,
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
