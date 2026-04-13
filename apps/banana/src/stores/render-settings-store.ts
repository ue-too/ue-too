import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { TrackStyle } from '@/trains/tracks/types';

type RenderSettingsState = {
    sunAngle: number;
    showElevationGradient: boolean;
    showPreviewCurveArcs: boolean;
    trackStyle: TrackStyle;
    electrified: boolean;
    projectionBuffer: number;
    bed: boolean;
    bedWidth: number;
    terrainXray: boolean;
    terrainFillVisible: boolean;
    terrainOpacity: number;
    whiteOcclusion: boolean;
    showJointNumbers: boolean;
    showSegmentIds: boolean;
    showGaugeLabels: boolean;
    showFormationIds: boolean;
    showStationStops: boolean;
    showStationLocations: boolean;
    showProximityLines: boolean;
    showBogies: boolean;
    showStats: boolean;
};

type RenderSettingsActions = {
    setSunAngle: (v: number) => void;
    setShowElevationGradient: (v: boolean) => void;
    setShowPreviewCurveArcs: (v: boolean) => void;
    setTrackStyle: (v: TrackStyle) => void;
    setElectrified: (v: boolean) => void;
    setProjectionBuffer: (v: number) => void;
    setBed: (v: boolean) => void;
    setBedWidth: (v: number) => void;
    setTerrainXray: (v: boolean) => void;
    setTerrainFillVisible: (v: boolean) => void;
    setTerrainOpacity: (v: number) => void;
    setWhiteOcclusion: (v: boolean) => void;
    setShowJointNumbers: (v: boolean) => void;
    setShowSegmentIds: (v: boolean) => void;
    setShowGaugeLabels: (v: boolean) => void;
    setShowFormationIds: (v: boolean) => void;
    setShowStationStops: (v: boolean) => void;
    setShowStationLocations: (v: boolean) => void;
    setShowProximityLines: (v: boolean) => void;
    setShowBogies: (v: boolean) => void;
    setShowStats: (v: boolean) => void;
};

export type RenderSettingsStore = RenderSettingsState & RenderSettingsActions;

export const useRenderSettingsStore = create<RenderSettingsStore>()(
    devtools(
        (set) => ({
            // State
            sunAngle: 135,
            showElevationGradient: false,
            showPreviewCurveArcs: false,
            trackStyle: 'ballasted',
            electrified: false,
            projectionBuffer: 0.5,
            bed: false,
            bedWidth: 3,
            terrainXray: false,
            terrainFillVisible: true,
            terrainOpacity: 1,
            whiteOcclusion: false,
            showJointNumbers: false,
            showSegmentIds: false,
            showGaugeLabels: false,
            showFormationIds: false,
            showStationStops: false,
            showStationLocations: false,
            showProximityLines: false,
            showBogies: true,
            showStats: true,

            // Actions
            setSunAngle: (v) => set({ sunAngle: v }),
            setShowElevationGradient: (v) => set({ showElevationGradient: v }),
            setShowPreviewCurveArcs: (v) => set({ showPreviewCurveArcs: v }),
            setTrackStyle: (v) => set({ trackStyle: v }),
            setElectrified: (v) => set({ electrified: v }),
            setProjectionBuffer: (v) => set({ projectionBuffer: v }),
            setBed: (v) => set({ bed: v }),
            setBedWidth: (v) => set({ bedWidth: v }),
            setTerrainXray: (v) => set({ terrainXray: v }),
            setTerrainFillVisible: (v) => set({ terrainFillVisible: v }),
            setTerrainOpacity: (v) => set({ terrainOpacity: v }),
            setWhiteOcclusion: (v) => set({ whiteOcclusion: v }),
            setShowJointNumbers: (v) => set({ showJointNumbers: v }),
            setShowSegmentIds: (v) => set({ showSegmentIds: v }),
            setShowGaugeLabels: (v) => set({ showGaugeLabels: v }),
            setShowFormationIds: (v) => set({ showFormationIds: v }),
            setShowStationStops: (v) => set({ showStationStops: v }),
            setShowStationLocations: (v) => set({ showStationLocations: v }),
            setShowProximityLines: (v) => set({ showProximityLines: v }),
            setShowBogies: (v) => set({ showBogies: v }),
            setShowStats: (v) => set({ showStats: v }),
        }),
        { name: 'banana-render-settings' }
    )
);
