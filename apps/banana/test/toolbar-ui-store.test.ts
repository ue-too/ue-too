import { describe, it, expect, beforeEach } from 'bun:test';

import {
    useToolbarUIStore,
    type PanelName,
} from '../src/stores/toolbar-ui-store';

const ALL_PANELS: PanelName[] = [
    'depot',
    'trainPanel',
    'formationEditor',
    'debugPanel',
    'stationList',
    'timetable',
    'signalPanel',
    'exportSubmenu',
    'autoSaveMenu',
];

const PANEL_STATE_KEYS: Record<PanelName, string> = {
    depot: 'showDepot',
    trainPanel: 'showTrainPanel',
    formationEditor: 'showFormationEditor',
    debugPanel: 'showDebugPanel',
    stationList: 'showStationList',
    timetable: 'showTimetable',
    signalPanel: 'showSignalPanel',
    exportSubmenu: 'showExportSubmenu',
    autoSaveMenu: 'showAutoSaveMenu',
};

function resetStore() {
    useToolbarUIStore.setState({
        mode: 'idle',
        activeCategory: null,
        showDepot: false,
        showTrainPanel: false,
        showFormationEditor: false,
        showDebugPanel: false,
        showStationList: false,
        showTimetable: false,
        showSignalPanel: false,
        showExportSubmenu: false,
        showAutoSaveMenu: false,
    });
}

describe('toolbar-ui-store', () => {
    beforeEach(() => {
        resetStore();
    });

    describe('initial state', () => {
        it('starts in idle mode with all panels closed', () => {
            const state = useToolbarUIStore.getState();
            expect(state.mode).toBe('idle');
            for (const panel of ALL_PANELS) {
                const key = PANEL_STATE_KEYS[panel];
                expect((state as any)[key]).toBe(false);
            }
        });
    });

    describe('setMode', () => {
        it('changes the mode', () => {
            useToolbarUIStore.getState().setMode('layout');
            expect(useToolbarUIStore.getState().mode).toBe('layout');
        });

        it('closes the flyout when activating a tool', () => {
            useToolbarUIStore.setState({ activeCategory: 'drawing' });
            useToolbarUIStore.getState().setMode('layout');
            expect(useToolbarUIStore.getState().mode).toBe('layout');
            expect(useToolbarUIStore.getState().activeCategory).toBeNull();
        });

        it('supports all app modes', () => {
            const modes = [
                'idle',
                'layout',
                'layout-deletion',
                'train-placement',
                'building-placement',
                'building-deletion',
                'station-placement',
                'stress-pick',
            ] as const;

            for (const mode of modes) {
                useToolbarUIStore.getState().setMode(mode);
                expect(useToolbarUIStore.getState().mode).toBe(mode);
            }
        });
    });

    describe('togglePanel', () => {
        for (const panel of ALL_PANELS) {
            it(`toggles ${panel} from closed to open`, () => {
                useToolbarUIStore.getState().togglePanel(panel);
                const key = PANEL_STATE_KEYS[panel];
                expect((useToolbarUIStore.getState() as any)[key]).toBe(true);
            });

            it(`toggles ${panel} from open to closed`, () => {
                const key = PANEL_STATE_KEYS[panel];
                useToolbarUIStore.setState({ [key]: true });
                useToolbarUIStore.getState().togglePanel(panel);
                expect((useToolbarUIStore.getState() as any)[key]).toBe(false);
            });
        }

        it('only affects the targeted panel', () => {
            useToolbarUIStore.getState().togglePanel('depot');
            const state = useToolbarUIStore.getState();
            expect(state.showDepot).toBe(true);
            expect(state.showTrainPanel).toBe(false);
            expect(state.showDebugPanel).toBe(false);
        });

        it('closes the flyout when opening a panel', () => {
            useToolbarUIStore.setState({ activeCategory: 'trains' });
            useToolbarUIStore.getState().togglePanel('trainPanel');
            expect(useToolbarUIStore.getState().showTrainPanel).toBe(true);
            expect(useToolbarUIStore.getState().activeCategory).toBeNull();
        });

        it('does not reopen the flyout when closing a panel', () => {
            useToolbarUIStore.setState({
                showDepot: true,
                activeCategory: null,
            });
            useToolbarUIStore.getState().togglePanel('depot');
            expect(useToolbarUIStore.getState().showDepot).toBe(false);
            expect(useToolbarUIStore.getState().activeCategory).toBeNull();
        });
    });

    describe('setPanel', () => {
        it('opens a panel', () => {
            useToolbarUIStore.getState().setPanel('timetable', true);
            expect(useToolbarUIStore.getState().showTimetable).toBe(true);
        });

        it('closes a panel', () => {
            useToolbarUIStore.setState({ showTimetable: true });
            useToolbarUIStore.getState().setPanel('timetable', false);
            expect(useToolbarUIStore.getState().showTimetable).toBe(false);
        });

        it('is idempotent when setting same value', () => {
            useToolbarUIStore.getState().setPanel('depot', true);
            useToolbarUIStore.getState().setPanel('depot', true);
            expect(useToolbarUIStore.getState().showDepot).toBe(true);
        });
    });

    describe('closeAllPanels', () => {
        it('closes all open panels', () => {
            useToolbarUIStore.setState({
                showDepot: true,
                showTrainPanel: true,
                showDebugPanel: true,
                showTimetable: true,
            });

            useToolbarUIStore.getState().closeAllPanels();

            const state = useToolbarUIStore.getState();
            for (const panel of ALL_PANELS) {
                const key = PANEL_STATE_KEYS[panel];
                expect((state as any)[key]).toBe(false);
            }
        });

        it('does not affect the mode', () => {
            useToolbarUIStore.setState({
                mode: 'layout',
                showDepot: true,
            });

            useToolbarUIStore.getState().closeAllPanels();

            expect(useToolbarUIStore.getState().mode).toBe('layout');
        });
    });

    describe('independence of mode and panels', () => {
        it('mode changes do not affect panel state', () => {
            useToolbarUIStore.setState({ showDepot: true });
            useToolbarUIStore.getState().setMode('train-placement');

            expect(useToolbarUIStore.getState().showDepot).toBe(true);
            expect(useToolbarUIStore.getState().mode).toBe('train-placement');
        });
    });
});
