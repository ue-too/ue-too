import { useEffect } from 'react';

import { useRenderSettingsStore } from '@/stores/render-settings-store';
import type { BananaAppComponents } from '@/utils/init-app';

/**
 * Subscribes to the render settings store and syncs changes to PIXI systems.
 * Replaces the 15+ individual useEffect blocks that were in BananaToolbar.
 */
export function useRenderSync(app: BananaAppComponents | null): void {
    useEffect(() => {
        if (!app) return;

        // Apply initial state
        const initial = useRenderSettingsStore.getState();
        applyAll(app, initial);

        // Subscribe to changes
        return useRenderSettingsStore.subscribe((state, prev) => {
            if (state.sunAngle !== prev.sunAngle) {
                app.trackRenderSystem.sunAngle = state.sunAngle;
                app.buildingRenderSystem.sunAngle = state.sunAngle;
            }
            if (
                state.showElevationGradient !== prev.showElevationGradient
            ) {
                app.trackRenderSystem.showElevationGradient =
                    state.showElevationGradient;
            }
            if (state.showPreviewCurveArcs !== prev.showPreviewCurveArcs) {
                app.trackRenderSystem.showPreviewCurveArcs =
                    state.showPreviewCurveArcs;
            }
            if (state.trackStyle !== prev.trackStyle) {
                app.trackRenderSystem.trackStyle = state.trackStyle;
            }
            if (state.electrified !== prev.electrified) {
                app.trackRenderSystem.electrified = state.electrified;
            }
            if (state.projectionBuffer !== prev.projectionBuffer) {
                app.curveEngine.trackGraph.projectionBuffer =
                    state.projectionBuffer;
            }
            if (state.bed !== prev.bed) {
                app.trackRenderSystem.bed = state.bed;
                app.curveEngine.trackGraph.bedEnabled = state.bed;
            }
            if (state.bedWidth !== prev.bedWidth) {
                app.trackRenderSystem.bedWidth = state.bedWidth;
                app.curveEngine.trackGraph.bedWidth = state.bedWidth;
            }
            if (state.terrainXray !== prev.terrainXray) {
                app.terrainRenderSystem.xray = state.terrainXray;
            }
            if (state.terrainFillVisible !== prev.terrainFillVisible) {
                app.terrainRenderSystem.fillVisible =
                    state.terrainFillVisible;
            }
            if (state.terrainOpacity !== prev.terrainOpacity) {
                app.terrainRenderSystem.fillOpacity = state.terrainOpacity;
            }
            if (state.whiteOcclusion !== prev.whiteOcclusion) {
                app.terrainRenderSystem.whiteOcclusion =
                    state.whiteOcclusion;
            }
            if (state.showJointNumbers !== prev.showJointNumbers) {
                app.debugOverlayRenderSystem.setShowJointDebug(
                    state.showJointNumbers
                );
            }
            if (state.showSegmentIds !== prev.showSegmentIds) {
                app.debugOverlayRenderSystem.setShowSegmentDebug(
                    state.showSegmentIds
                );
            }
            if (state.showGaugeLabels !== prev.showGaugeLabels) {
                app.debugOverlayRenderSystem.setShowGaugeDebug(
                    state.showGaugeLabels
                );
            }
            if (state.showFormationIds !== prev.showFormationIds) {
                app.debugOverlayRenderSystem.setShowFormationDebug(
                    state.showFormationIds
                );
            }
            if (state.showStationStops !== prev.showStationStops) {
                app.debugOverlayRenderSystem.setShowStationStopDebug(
                    state.showStationStops
                );
            }
            if (state.showStationLocations !== prev.showStationLocations) {
                app.debugOverlayRenderSystem.setShowStationLocationDebug(
                    state.showStationLocations
                );
            }
            if (state.showProximityLines !== prev.showProximityLines) {
                app.debugOverlayRenderSystem.setShowProximityDebug(
                    state.showProximityLines
                );
            }
            if (state.showBogies !== prev.showBogies) {
                app.trainRenderSystem.showBogies = state.showBogies;
            }
            if (state.showStats !== prev.showStats) {
                app.statsDom.style.display = state.showStats
                    ? 'block'
                    : 'none';
            }
        });
    }, [app]);
}

function applyAll(
    app: BananaAppComponents,
    state: ReturnType<typeof useRenderSettingsStore.getState>
): void {
    app.trackRenderSystem.sunAngle = state.sunAngle;
    app.buildingRenderSystem.sunAngle = state.sunAngle;
    app.trackRenderSystem.showElevationGradient =
        state.showElevationGradient;
    app.trackRenderSystem.showPreviewCurveArcs =
        state.showPreviewCurveArcs;
    app.trackRenderSystem.trackStyle = state.trackStyle;
    app.trackRenderSystem.electrified = state.electrified;
    app.curveEngine.trackGraph.projectionBuffer = state.projectionBuffer;
    app.trackRenderSystem.bed = state.bed;
    app.curveEngine.trackGraph.bedEnabled = state.bed;
    app.trackRenderSystem.bedWidth = state.bedWidth;
    app.curveEngine.trackGraph.bedWidth = state.bedWidth;
    app.terrainRenderSystem.xray = state.terrainXray;
    app.terrainRenderSystem.fillVisible = state.terrainFillVisible;
    app.terrainRenderSystem.fillOpacity = state.terrainOpacity;
    app.terrainRenderSystem.whiteOcclusion = state.whiteOcclusion;
    app.debugOverlayRenderSystem.setShowJointDebug(state.showJointNumbers);
    app.debugOverlayRenderSystem.setShowSegmentDebug(state.showSegmentIds);
    app.debugOverlayRenderSystem.setShowGaugeDebug(state.showGaugeLabels);
    app.debugOverlayRenderSystem.setShowFormationDebug(
        state.showFormationIds
    );
    app.debugOverlayRenderSystem.setShowStationStopDebug(
        state.showStationStops
    );
    app.debugOverlayRenderSystem.setShowStationLocationDebug(
        state.showStationLocations
    );
    app.debugOverlayRenderSystem.setShowProximityDebug(
        state.showProximityLines
    );
    app.trainRenderSystem.showBogies = state.showBogies;
    app.statsDom.style.display = state.showStats ? 'block' : 'none';
}
