import { describe, expect, it, beforeEach } from 'bun:test';

import { useGaugeStore } from '../src/stores/gauge-store';

describe('useGaugeStore', () => {
    beforeEach(() => {
        // Reset to default state between tests
        useGaugeStore.setState({
            selectedPresetId: 'narrow-cape',
            customWidth: null,
            currentGauge: 1.067,
        });
    });

    it('defaults to narrow-cape (1.067m)', () => {
        const state = useGaugeStore.getState();
        expect(state.selectedPresetId).toBe('narrow-cape');
        expect(state.currentGauge).toBe(1.067);
        expect(state.customWidth).toBeNull();
    });

    it('selectPreset changes gauge to preset width', () => {
        useGaugeStore.getState().selectPreset('standard');
        const state = useGaugeStore.getState();
        expect(state.selectedPresetId).toBe('standard');
        expect(state.currentGauge).toBe(1.435);
        expect(state.customWidth).toBeNull();
    });

    it('setCustomGauge switches to custom mode', () => {
        useGaugeStore.getState().setCustomGauge(1.2);
        const state = useGaugeStore.getState();
        expect(state.selectedPresetId).toBe('custom');
        expect(state.currentGauge).toBe(1.2);
        expect(state.customWidth).toBe(1.2);
    });

    it('clamps custom gauge to minimum 0.5', () => {
        useGaugeStore.getState().setCustomGauge(0.1);
        expect(useGaugeStore.getState().currentGauge).toBe(0.5);
    });

    it('clamps custom gauge to maximum 3.0', () => {
        useGaugeStore.getState().setCustomGauge(5.0);
        expect(useGaugeStore.getState().currentGauge).toBe(3.0);
    });

    it('selectPreset after custom resets customWidth', () => {
        useGaugeStore.getState().setCustomGauge(1.2);
        useGaugeStore.getState().selectPreset('meter');
        const state = useGaugeStore.getState();
        expect(state.selectedPresetId).toBe('meter');
        expect(state.currentGauge).toBe(1.0);
        expect(state.customWidth).toBeNull();
    });

    it('ignores unknown preset ids', () => {
        useGaugeStore.getState().selectPreset('nonexistent');
        const state = useGaugeStore.getState();
        expect(state.selectedPresetId).toBe('narrow-cape');
        expect(state.currentGauge).toBe(1.067);
    });
});
