import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { SceneLoadingOverlay } from '@/components/SceneLoadingOverlay';
import { SceneRestorer } from '@/components/SceneRestorer';
import { ScenePickerDialog } from '@/components/scene-picker/ScenePickerDialog';
import { BananaToolbar } from '@/components/toolbar';
import { TimeDisplay } from '@/components/toolbar/TimeDisplay';
import { useBananaApp } from '@/contexts/pixi';
import {
    deserializeSceneData,
    validateSerializedSceneData,
} from '@/scene-serialization';
import { SCENE_DATA_VERSION, getSceneStorage } from '@/storage';
import { useSceneStore } from '@/stores/scene-store';
import { initApp } from '@/utils/init-app';

import './App.css';

/**
 * Handles scene switching from the toolbar picker (app already running).
 */
function InAppScenePicker() {
    const app = useBananaApp();
    const setActiveScene = useSceneStore(s => s.setActiveScene);
    const hideScenePicker = useSceneStore(s => s.hideScenePicker);
    const createNewScene = useSceneStore(s => s.createNewScene);

    const handleSceneSelected = useCallback(
        async (sceneId: string | null) => {
            if (!sceneId) {
                createNewScene();
                return;
            }
            if (!app) return;

            const stored = await getSceneStorage().loadScene(sceneId);
            if (!stored) {
                toast.error('Scene not found');
                return;
            }
            const validation = validateSerializedSceneData(stored.data);
            if (!validation.valid) {
                toast.error(`Invalid scene: ${validation.error}`);
                return;
            }
            deserializeSceneData(app, stored.data);
            setActiveScene(stored.metadata.id, stored.metadata.name);
            hideScenePicker();
            toast.success(`Loaded "${stored.metadata.name}"`, {
                duration: 2000,
            });
        },
        [app, setActiveScene, hideScenePicker, createNewScene]
    );

    return <ScenePickerDialog onSceneSelected={handleSceneSelected} />;
}

function SceneGate() {
    const initialized = useSceneStore(s => s.initialized);
    const scenePickerOpen = useSceneStore(s => s.scenePickerOpen);
    const setActiveScene = useSceneStore(s => s.setActiveScene);
    const setPendingSceneId = useSceneStore(s => s.setPendingSceneId);
    const pendingSceneId = useSceneStore(s => s.pendingSceneId);
    const initialize = useSceneStore(s => s.initialize);
    const mountedRef = useRef(false);
    const [readyToMount, setReadyToMount] = useState(false);

    // Stable reference so Wrapper's useEffect doesn't re-initialize PIXI on every render.
    const wrapperOption = useMemo(
        () => ({
            fullScreen: true,
            boundaries: {
                min: { x: -5000, y: -5000 },
                max: { x: 5000, y: 5000 },
            },
        }),
        []
    );

    // Initialize the scene store on mount (replaces SceneProvider's useEffect)
    useEffect(() => {
        initialize();
    }, [initialize]);

    const handleInitialSceneSelected = useCallback(
        async (sceneId: string | null) => {
            // Guard: if already mounting, ignore duplicate calls from the
            // auto-create effect racing with the picker callback.
            if (mountedRef.current) return;
            mountedRef.current = true;

            if (sceneId) {
                const stored = await getSceneStorage().loadScene(sceneId);
                if (stored) {
                    setActiveScene(stored.metadata.id, stored.metadata.name);
                    setPendingSceneId(sceneId);
                }
            } else {
                const newId = crypto.randomUUID();
                const now = Date.now();
                setActiveScene(newId, 'Untitled Scene');
                await getSceneStorage().saveScene({
                    metadata: {
                        id: newId,
                        name: 'Untitled Scene',
                        createdAt: now,
                        updatedAt: now,
                        version: SCENE_DATA_VERSION,
                    },
                    data: {
                        tracks: { joints: [], segments: [] },
                        trains: {
                            cars: [],
                            formations: [],
                            carStockIds: [],
                            formationManagerIds: [],
                            placedTrains: [],
                        },
                    },
                });
            }
            setReadyToMount(true);
        },
        [setActiveScene, setPendingSceneId]
    );

    // Auto-handle ?new=1 query param
    useEffect(() => {
        if (!initialized || mountedRef.current) return;
        const isNewScene =
            new URLSearchParams(window.location.search).get('new') === '1';
        if (isNewScene) {
            const url = new URL(window.location.href);
            url.searchParams.delete('new');
            window.history.replaceState({}, '', url.toString());
            handleInitialSceneSelected(null);
        }
    }, [initialized, handleInitialSceneSelected]);

    // Auto-create scene if no saved scenes and picker wasn't shown
    useEffect(() => {
        if (!initialized || mountedRef.current || readyToMount) return;
        if (!scenePickerOpen) {
            handleInitialSceneSelected(null);
        }
    }, [
        initialized,
        scenePickerOpen,
        readyToMount,
        handleInitialSceneSelected,
    ]);

    if (!initialized) {
        return null;
    }

    // Show picker before PIXI mount
    if (scenePickerOpen && !readyToMount) {
        return (
            <ScenePickerDialog onSceneSelected={handleInitialSceneSelected} />
        );
    }

    if (!readyToMount) {
        return null;
    }

    return (
        <Wrapper option={wrapperOption} initFunction={initApp}>
            {pendingSceneId && <SceneRestorer />}
            <SceneLoadingOverlay />
            <ScrollBarDisplay />
            <BananaToolbar />
            <TimeDisplay />
            <InAppScenePicker />
        </Wrapper>
    );
}

const App = (): React.ReactNode => {
    return (
        <div className="app">
            <SceneGate />
        </div>
    );
};

export default App;
