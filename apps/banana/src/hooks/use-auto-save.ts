import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useBananaApp } from '@/contexts/pixi';
import { useSceneStore } from '@/stores/scene-store';
import { serializeSceneData } from '@/scene-serialization';
import { getSceneStorage, SCENE_DATA_VERSION } from '@/storage';

const requestIdle =
    typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 0);

/**
 * Periodically auto-saves the current scene to IndexedDB.
 * Also saves on `beforeunload` for crash resilience.
 *
 * Returns `saveNow` for triggering a manual save from the UI.
 */
export function useAutoSave(): { saveNow: () => void } {
    const { t } = useTranslation();
    const app = useBananaApp();
    const activeSceneId = useSceneStore((s) => s.activeSceneId);
    const activeSceneName = useSceneStore((s) => s.activeSceneName);
    const autoSaveIntervalMs = useSceneStore((s) => s.autoSaveIntervalMs);
    const hasShownToast = useRef(false);
    const savingRef = useRef(false);
    const createdAtRef = useRef<number>(Date.now());

    // Load createdAt from existing scene metadata
    useEffect(() => {
        if (!activeSceneId) return;
        getSceneStorage()
            .loadScene(activeSceneId)
            .then((stored) => {
                if (stored) {
                    createdAtRef.current = stored.metadata.createdAt;
                }
            });
    }, [activeSceneId]);

    const doSave = useCallback(() => {
        if (!app || !activeSceneId || savingRef.current || useSceneStore.getState().sceneLoading) return;
        savingRef.current = true;

        try {
            const data = serializeSceneData(app);
            const storage = getSceneStorage();

            requestIdle(() => {
                storage
                    .saveScene({
                        metadata: {
                            id: activeSceneId,
                            name: activeSceneName,
                            createdAt: createdAtRef.current,
                            updatedAt: Date.now(),
                            version: SCENE_DATA_VERSION,
                        },
                        data,
                    })
                    .then(() => {
                        if (!hasShownToast.current) {
                            toast.success(t('autoSaveToast', { name: activeSceneName }), {
                                duration: 2000,
                            });
                            hasShownToast.current = true;
                        }
                    })
                    .catch((err) => {
                        console.error('Auto-save failed:', err);
                    })
                    .finally(() => {
                        savingRef.current = false;
                    });
            });
        } catch (err) {
            console.error('Auto-save serialization failed:', err);
            savingRef.current = false;
        }
    }, [app, activeSceneId, activeSceneName]);

    const saveNow = useCallback(() => {
        if (!app || !activeSceneId || savingRef.current || useSceneStore.getState().sceneLoading) return;
        savingRef.current = true;

        try {
            const data = serializeSceneData(app);
            const storage = getSceneStorage();

            storage
                .saveScene({
                    metadata: {
                        id: activeSceneId,
                        name: activeSceneName,
                        createdAt: createdAtRef.current,
                        updatedAt: Date.now(),
                        version: SCENE_DATA_VERSION,
                    },
                    data,
                })
                .then(() => {
                    toast.success(`"${activeSceneName}" saved`, { duration: 2000 });
                })
                .catch((err) => {
                    console.error('Manual save failed:', err);
                    toast.error('Save failed');
                })
                .finally(() => {
                    savingRef.current = false;
                });
        } catch (err) {
            console.error('Manual save serialization failed:', err);
            savingRef.current = false;
        }
    }, [app, activeSceneId, activeSceneName]);

    // Periodic save
    useEffect(() => {
        if (!app || !activeSceneId) return;

        const id = setInterval(doSave, autoSaveIntervalMs);
        return () => clearInterval(id);
    }, [app, activeSceneId, autoSaveIntervalMs, doSave]);

    // Save on beforeunload
    useEffect(() => {
        if (!app || !activeSceneId) return;

        const handler = () => doSave();
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [app, activeSceneId, doSave]);

    return { saveNow };
}
