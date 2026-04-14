import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useBananaApp } from '@/contexts/pixi';
import { useSceneStore } from '@/stores/scene-store';
import {
    deserializeSceneData,
    validateSerializedSceneData,
} from '@/scene-serialization';
import { getSceneStorage } from '@/storage';

/**
 * Loads the pending scene from IndexedDB after the PIXI app initializes.
 * Renders nothing — purely a side-effect component.
 */
export function SceneRestorer(): null {
    const app = useBananaApp();
    const { t } = useTranslation();
    const pendingSceneId = useSceneStore((s) => s.pendingSceneId);
    const clearPendingScene = useSceneStore((s) => s.clearPendingScene);
    const loaded = useRef(false);

    useEffect(() => {
        if (!app || !pendingSceneId || loaded.current) return;
        loaded.current = true;

        const restore = async () => {
            const stored = await getSceneStorage().loadScene(pendingSceneId);
            if (!stored) {
                toast.error(t('sceneNotFound'));
                return;
            }

            const validation = validateSerializedSceneData(stored.data);
            if (!validation.valid) {
                toast.error(t('sceneDataInvalid', { error: validation.error }));
                return;
            }

            useSceneStore.getState().setSceneLoading(true);
            useSceneStore.getState().setSceneLoadProgress(0);

            await deserializeSceneData(app, stored.data, {
                onProgress: (loaded, total) =>
                    useSceneStore.getState().setSceneLoadProgress(
                        total > 0 ? loaded / total : 1
                    ),
            });

            useSceneStore.getState().setSceneLoading(false);
            toast.success(t('sceneLoaded', { name: stored.metadata.name }), {
                duration: 2000,
            });
        };

        restore()
            .catch((err) => {
                console.error('Failed to restore scene:', err);
                toast.error(t('sceneRestoreFailed'));
                useSceneStore.getState().setSceneLoading(false);
            })
            .finally(() => {
                clearPendingScene();
            });
    }, [app, pendingSceneId, clearPendingScene, t]);

    return null;
}
