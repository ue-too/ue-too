import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { GAUGE_PRESETS, DEFAULT_GAUGE_PRESET } from '@/trains/tracks/gauge-presets';

const MIN_CUSTOM_GAUGE = 0.5;
const MAX_CUSTOM_GAUGE = 3.0;

type GaugeState = {
    selectedPresetId: string;
    customWidth: number | null;
    currentGauge: number;
};

type GaugeActions = {
    selectPreset: (presetId: string) => void;
    setCustomGauge: (width: number) => void;
};

export type GaugeStore = GaugeState & GaugeActions;

export const useGaugeStore = create<GaugeStore>()(
    devtools(
        (set, get) => ({
            selectedPresetId: DEFAULT_GAUGE_PRESET.id,
            customWidth: null,
            currentGauge: DEFAULT_GAUGE_PRESET.width,

            selectPreset: (presetId: string) => {
                const preset = GAUGE_PRESETS.find((p) => p.id === presetId);
                if (!preset) return;
                set({
                    selectedPresetId: preset.id,
                    customWidth: null,
                    currentGauge: preset.width,
                });
            },

            setCustomGauge: (width: number) => {
                const clamped = Math.min(
                    MAX_CUSTOM_GAUGE,
                    Math.max(MIN_CUSTOM_GAUGE, width)
                );
                set({
                    selectedPresetId: 'custom',
                    customWidth: clamped,
                    currentGauge: clamped,
                });
            },
        }),
        { name: 'banana-gauge' }
    )
);
