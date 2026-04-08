import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';

import { getSceneStorage } from '@/storage';

const DEFAULT_AUTO_SAVE_MS = 3 * 60 * 1000; // 3 minutes

// ---------------------------------------------------------------------------
// Scene context — identity, picker, pending restore
// ---------------------------------------------------------------------------

export type SceneContextValue = {
    activeSceneId: string | null;
    activeSceneName: string;
    setActiveScene: (id: string, name: string) => void;
    createNewScene: () => void;
    showScenePicker: () => void;
    scenePickerOpen: boolean;
    hideScenePicker: () => void;
    initialized: boolean;
    pendingSceneId: string | null;
    setPendingSceneId: (id: string | null) => void;
    clearPendingScene: () => void;
};

const SceneContext = createContext<SceneContextValue | null>(null);

export function useSceneContext(): SceneContextValue {
    const ctx = useContext(SceneContext);
    if (!ctx) {
        throw new Error('useSceneContext must be used within a SceneProvider');
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// Auto-save interval context — separate so changes don't re-render the world
// ---------------------------------------------------------------------------

type AutoSaveIntervalContextValue = {
    autoSaveIntervalMs: number;
    setAutoSaveIntervalMs: (ms: number) => void;
};

const AutoSaveIntervalContext =
    createContext<AutoSaveIntervalContextValue | null>(null);

export function useAutoSaveInterval(): AutoSaveIntervalContextValue {
    const ctx = useContext(AutoSaveIntervalContext);
    if (!ctx) {
        throw new Error(
            'useAutoSaveInterval must be used within a SceneProvider'
        );
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// Combined provider
// ---------------------------------------------------------------------------

type SceneProviderProps = {
    children: ReactNode;
};

export function SceneProvider({ children }: SceneProviderProps) {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [activeSceneName, setActiveSceneName] = useState('Untitled Scene');
    const [scenePickerOpen, setScenePickerOpen] = useState(false);
    const [autoSaveIntervalMs, setAutoSaveIntervalMsState] =
        useState(DEFAULT_AUTO_SAVE_MS);
    const [initialized, setInitialized] = useState(false);
    const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);

    // Load persisted preferences on mount
    useEffect(() => {
        const storage = getSceneStorage();
        Promise.all([
            storage.getPreference('autoSaveIntervalMs'),
            storage.listScenes(),
            storage.getActiveSceneId(),
        ]).then(([savedInterval, scenes, lastActiveId]) => {
            if (savedInterval) {
                const ms = parseInt(savedInterval, 10);
                if (!isNaN(ms) && ms > 0) {
                    setAutoSaveIntervalMsState(ms);
                }
            }

            if (scenes.length > 0) {
                setScenePickerOpen(true);
                if (lastActiveId) {
                    const found = scenes.find((s) => s.id === lastActiveId);
                    if (found) {
                        setActiveSceneId(found.id);
                        setActiveSceneName(found.name);
                    }
                }
            }

            setInitialized(true);
        });
    }, []);

    const setActiveScene = useCallback((id: string, name: string) => {
        setActiveSceneId(id);
        setActiveSceneName(name);
        getSceneStorage().setActiveSceneId(id);
    }, []);

    const createNewScene = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('new', '1');
        window.location.href = url.toString();
    }, []);

    const showScenePicker = useCallback(() => {
        setScenePickerOpen(true);
    }, []);

    const hideScenePicker = useCallback(() => {
        setScenePickerOpen(false);
    }, []);

    const setAutoSaveIntervalMs = useCallback((ms: number) => {
        setAutoSaveIntervalMsState(ms);
        getSceneStorage().setPreference('autoSaveIntervalMs', String(ms));
    }, []);

    const clearPendingScene = useCallback(() => {
        setPendingSceneId(null);
    }, []);

    const sceneValue: SceneContextValue = {
        activeSceneId,
        activeSceneName,
        setActiveScene,
        createNewScene,
        showScenePicker,
        scenePickerOpen,
        hideScenePicker,
        initialized,
        pendingSceneId,
        setPendingSceneId,
        clearPendingScene,
    };

    const autoSaveValue: AutoSaveIntervalContextValue = {
        autoSaveIntervalMs,
        setAutoSaveIntervalMs,
    };

    return (
        <SceneContext.Provider value={sceneValue}>
            <AutoSaveIntervalContext.Provider value={autoSaveValue}>
                {children}
            </AutoSaveIntervalContext.Provider>
        </SceneContext.Provider>
    );
}
