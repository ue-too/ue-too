import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { getSceneStorage } from '@/storage';

const DEFAULT_AUTO_SAVE_MS = 3 * 60 * 1000; // 3 minutes

type SceneState = {
    activeSceneId: string | null;
    activeSceneName: string;
    scenePickerOpen: boolean;
    initialized: boolean;
    pendingSceneId: string | null;
    autoSaveIntervalMs: number;
    sceneLoading: boolean;
    sceneLoadProgress: number;
};

type SceneActions = {
    setActiveScene: (id: string, name: string) => void;
    createNewScene: () => void;
    showScenePicker: () => void;
    hideScenePicker: () => void;
    setPendingSceneId: (id: string | null) => void;
    clearPendingScene: () => void;
    setAutoSaveIntervalMs: (ms: number) => void;
    setSceneLoading: (loading: boolean) => void;
    setSceneLoadProgress: (progress: number) => void;
    initialize: () => Promise<void>;
};

export type SceneStore = SceneState & SceneActions;

export const useSceneStore = create<SceneStore>()(
    devtools(
        (set) => ({
            // State
            activeSceneId: null,
            activeSceneName: 'Untitled Scene',
            scenePickerOpen: false,
            initialized: false,
            pendingSceneId: null,
            autoSaveIntervalMs: DEFAULT_AUTO_SAVE_MS,
            sceneLoading: false,
            sceneLoadProgress: 0,

            // Actions
            setActiveScene: (id, name) => {
                set({ activeSceneId: id, activeSceneName: name });
                getSceneStorage().setActiveSceneId(id);
            },

            createNewScene: () => {
                const url = new URL(window.location.href);
                url.searchParams.set('new', '1');
                window.location.href = url.toString();
            },

            showScenePicker: () => set({ scenePickerOpen: true }),
            hideScenePicker: () => set({ scenePickerOpen: false }),

            setPendingSceneId: (id) => set({ pendingSceneId: id }),
            clearPendingScene: () => set({ pendingSceneId: null }),

            setSceneLoading: (loading) => set({ sceneLoading: loading }),
            setSceneLoadProgress: (progress) => set({ sceneLoadProgress: progress }),

            setAutoSaveIntervalMs: (ms) => {
                set({ autoSaveIntervalMs: ms });
                getSceneStorage().setPreference(
                    'autoSaveIntervalMs',
                    String(ms)
                );
            },

            initialize: async () => {
                const storage = getSceneStorage();
                const [savedInterval, scenes, lastActiveId] =
                    await Promise.all([
                        storage.getPreference('autoSaveIntervalMs'),
                        storage.listScenes(),
                        storage.getActiveSceneId(),
                    ]);

                const patch: Partial<SceneState> = { initialized: true };

                if (savedInterval) {
                    const ms = parseInt(savedInterval, 10);
                    if (!isNaN(ms) && ms > 0) {
                        patch.autoSaveIntervalMs = ms;
                    }
                }

                if (scenes.length > 0) {
                    patch.scenePickerOpen = true;
                    if (lastActiveId) {
                        const found = scenes.find(
                            (s) => s.id === lastActiveId
                        );
                        if (found) {
                            patch.activeSceneId = found.id;
                            patch.activeSceneName = found.name;
                        }
                    }
                }

                set(patch);
            },
        }),
        { name: 'banana-scene' }
    )
);
