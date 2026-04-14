import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { AppMode } from '@/components/toolbar/types';

export type PanelName =
    | 'depot'
    | 'trainPanel'
    | 'formationEditor'
    | 'debugPanel'
    | 'stationList'
    | 'timetable'
    | 'signalPanel'
    | 'exportSubmenu'
    | 'autoSaveMenu';

export type ToolbarCategory =
    | 'drawing'
    | 'trains'
    | 'infra'
    | 'scene'
    | 'debug';

type PanelState = {
    showDepot: boolean;
    showTrainPanel: boolean;
    showFormationEditor: boolean;
    showDebugPanel: boolean;
    showStationList: boolean;
    showTimetable: boolean;
    showSignalPanel: boolean;
    showExportSubmenu: boolean;
    showAutoSaveMenu: boolean;
};

const PANEL_KEY_MAP: Record<PanelName, keyof PanelState> = {
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

type ToolbarUIState = PanelState & {
    mode: AppMode;
    activeCategory: ToolbarCategory | null;
};

type ToolbarUIActions = {
    setMode: (mode: AppMode) => void;
    togglePanel: (panel: PanelName) => void;
    setPanel: (panel: PanelName, open: boolean) => void;
    closeAllPanels: () => void;
    setActiveCategory: (category: ToolbarCategory | null) => void;
    toggleCategory: (category: ToolbarCategory) => void;
};

export type ToolbarUIStore = ToolbarUIState & ToolbarUIActions;

const INITIAL_PANEL_STATE: PanelState = {
    showDepot: false,
    showTrainPanel: false,
    showFormationEditor: false,
    showDebugPanel: false,
    showStationList: false,
    showTimetable: false,
    showSignalPanel: false,
    showExportSubmenu: false,
    showAutoSaveMenu: false,
};

export const useToolbarUIStore = create<ToolbarUIStore>()(
    devtools(
        set => ({
            mode: 'idle',
            activeCategory: null,
            ...INITIAL_PANEL_STATE,

            setMode: mode => set({ mode, activeCategory: null }),

            togglePanel: panel =>
                set(state => {
                    const key = PANEL_KEY_MAP[panel];
                    const opening = !state[key];
                    return {
                        [key]: opening,
                        // Close the flyout when opening an independent panel
                        ...(opening ? { activeCategory: null } : undefined),
                    };
                }),

            setPanel: (panel, open) => set({ [PANEL_KEY_MAP[panel]]: open }),

            closeAllPanels: () => set(INITIAL_PANEL_STATE),

            setActiveCategory: category => set({ activeCategory: category }),

            toggleCategory: category =>
                set(state => ({
                    activeCategory:
                        state.activeCategory === category ? null : category,
                    showExportSubmenu: false,
                    showAutoSaveMenu: false,
                })),
        }),
        { name: 'banana-toolbar-ui' }
    )
);
