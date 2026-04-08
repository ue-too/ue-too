import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useRenderSettingsStore } from '../src/stores/render-settings-store';

function resetStore() {
    useRenderSettingsStore.setState({
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
        showFormationIds: false,
        showStationStops: false,
        showStationLocations: false,
        showProximityLines: false,
        showStats: true,
    });
}

describe('render-settings-store', () => {
    beforeEach(() => {
        resetStore();
    });

    describe('initial state', () => {
        it('has correct defaults', () => {
            const s = useRenderSettingsStore.getState();
            expect(s.sunAngle).toBe(135);
            expect(s.showElevationGradient).toBe(false);
            expect(s.showPreviewCurveArcs).toBe(false);
            expect(s.trackStyle).toBe('ballasted');
            expect(s.electrified).toBe(false);
            expect(s.projectionBuffer).toBe(0.5);
            expect(s.bed).toBe(false);
            expect(s.bedWidth).toBe(3);
            expect(s.terrainXray).toBe(false);
            expect(s.terrainFillVisible).toBe(true);
            expect(s.terrainOpacity).toBe(1);
            expect(s.whiteOcclusion).toBe(false);
            expect(s.showJointNumbers).toBe(false);
            expect(s.showSegmentIds).toBe(false);
            expect(s.showFormationIds).toBe(false);
            expect(s.showStationStops).toBe(false);
            expect(s.showStationLocations).toBe(false);
            expect(s.showProximityLines).toBe(false);
            expect(s.showStats).toBe(true);
        });
    });

    describe('numeric setters', () => {
        it('setSunAngle updates sunAngle', () => {
            useRenderSettingsStore.getState().setSunAngle(90);
            expect(useRenderSettingsStore.getState().sunAngle).toBe(90);
        });

        it('setProjectionBuffer updates projectionBuffer', () => {
            useRenderSettingsStore.getState().setProjectionBuffer(1.5);
            expect(useRenderSettingsStore.getState().projectionBuffer).toBe(
                1.5
            );
        });

        it('setBedWidth updates bedWidth', () => {
            useRenderSettingsStore.getState().setBedWidth(5);
            expect(useRenderSettingsStore.getState().bedWidth).toBe(5);
        });

        it('setTerrainOpacity updates terrainOpacity', () => {
            useRenderSettingsStore.getState().setTerrainOpacity(0.5);
            expect(useRenderSettingsStore.getState().terrainOpacity).toBe(0.5);
        });
    });

    describe('boolean setters', () => {
        const booleanFields = [
            ['setShowElevationGradient', 'showElevationGradient'],
            ['setShowPreviewCurveArcs', 'showPreviewCurveArcs'],
            ['setElectrified', 'electrified'],
            ['setBed', 'bed'],
            ['setTerrainXray', 'terrainXray'],
            ['setTerrainFillVisible', 'terrainFillVisible'],
            ['setWhiteOcclusion', 'whiteOcclusion'],
            ['setShowJointNumbers', 'showJointNumbers'],
            ['setShowSegmentIds', 'showSegmentIds'],
            ['setShowFormationIds', 'showFormationIds'],
            ['setShowStationStops', 'showStationStops'],
            ['setShowStationLocations', 'showStationLocations'],
            ['setShowProximityLines', 'showProximityLines'],
            ['setShowStats', 'showStats'],
        ] as const;

        it.each(booleanFields)(
            '%s toggles %s to true',
            (setter, field) => {
                const store = useRenderSettingsStore.getState();
                (store as any)[setter](true);
                expect((useRenderSettingsStore.getState() as any)[field]).toBe(
                    true
                );
            }
        );

        it.each(booleanFields)(
            '%s toggles %s back to false',
            (setter, field) => {
                useRenderSettingsStore.setState({ [field]: true } as any);
                (useRenderSettingsStore.getState() as any)[setter](false);
                expect((useRenderSettingsStore.getState() as any)[field]).toBe(
                    false
                );
            }
        );
    });

    describe('setTrackStyle', () => {
        it('changes from ballasted to slab', () => {
            useRenderSettingsStore.getState().setTrackStyle('slab');
            expect(useRenderSettingsStore.getState().trackStyle).toBe('slab');
        });

        it('changes back to ballasted', () => {
            useRenderSettingsStore.setState({ trackStyle: 'slab' });
            useRenderSettingsStore.getState().setTrackStyle('ballasted');
            expect(useRenderSettingsStore.getState().trackStyle).toBe(
                'ballasted'
            );
        });
    });

    describe('subscriptions', () => {
        it('fires subscriber with prev and next state on change', () => {
            const listener = vi.fn();
            const unsub = useRenderSettingsStore.subscribe(listener);

            useRenderSettingsStore.getState().setSunAngle(45);

            expect(listener).toHaveBeenCalledTimes(1);
            const [next, prev] = listener.mock.calls[0];
            expect(prev.sunAngle).toBe(135);
            expect(next.sunAngle).toBe(45);

            unsub();
        });

        it('does not fire subscriber after unsubscribe', () => {
            const listener = vi.fn();
            const unsub = useRenderSettingsStore.subscribe(listener);
            unsub();

            useRenderSettingsStore.getState().setSunAngle(0);
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('independence', () => {
        it('changing one field does not affect others', () => {
            useRenderSettingsStore.getState().setSunAngle(0);

            const s = useRenderSettingsStore.getState();
            expect(s.sunAngle).toBe(0);
            expect(s.trackStyle).toBe('ballasted');
            expect(s.terrainOpacity).toBe(1);
            expect(s.showStats).toBe(true);
        });
    });
});
