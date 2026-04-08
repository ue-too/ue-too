import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { toast } from 'sonner';

import { AutoSaveProvider } from '@/components/AutoSaveProvider';
import { SceneRestorer } from '@/components/SceneRestorer';
import { ScenePickerDialog } from '@/components/scene-picker/ScenePickerDialog';
import { BananaToolbar } from '@/components/toolbar';
import { TimeDisplay } from '@/components/toolbar/TimeDisplay';
import { useBananaApp } from '@/contexts/pixi';
import { SceneProvider, useSceneContext } from '@/contexts/scene-context';
import {
    deserializeSceneData,
    validateSerializedSceneData,
} from '@/scene-serialization';
import { getSceneStorage, SCENE_DATA_VERSION } from '@/storage';
import { initApp } from '@/utils/init-app';

import './App.css';

/**
 * Handles scene switching from the toolbar picker (app already running).
 */
function InAppScenePicker() {
    const app = useBananaApp();
    const { setActiveScene, hideScenePicker, createNewScene } =
        useSceneContext();

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
    const {
        initialized,
        scenePickerOpen,
        setActiveScene,
        setPendingSceneId,
        pendingSceneId,
    } = useSceneContext();
    const mountedRef = useRef(false);
    const [readyToMount, setReadyToMount] = useState(false);

    const handleInitialSceneSelected = useCallback(
        async (sceneId: string | null) => {
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
            mountedRef.current = true;
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
            mountedRef.current = true;
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
            <ScenePickerDialog
                onSceneSelected={handleInitialSceneSelected}
            />
        );
    }

    if (!readyToMount) {
        return null;
    }

    return (
        <Wrapper
            option={{
                fullScreen: true,
                boundaries: {
                    min: { x: -5000, y: -5000 },
                    max: { x: 5000, y: 5000 },
                },
            }}
            initFunction={initApp}
        >
            {pendingSceneId && <SceneRestorer />}
            <AutoSaveProvider />
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
            <SceneProvider>
                <SceneGate />
            </SceneProvider>
        </div>
    );
};

export default App;
