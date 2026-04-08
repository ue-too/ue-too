import { useEffect, useRef } from 'react';
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
    const pendingSceneId = useSceneStore((s) => s.pendingSceneId);
    const clearPendingScene = useSceneStore((s) => s.clearPendingScene);
    const loaded = useRef(false);

    useEffect(() => {
        if (!app || !pendingSceneId || loaded.current) return;
        loaded.current = true;

        getSceneStorage()
            .loadScene(pendingSceneId)
            .then((stored) => {
                if (!stored) {
                    toast.error('Scene not found in storage');
                    return;
                }

                const validation = validateSerializedSceneData(stored.data);
                if (!validation.valid) {
                    toast.error(
                        `Scene data invalid: ${validation.error}`
                    );
                    return;
                }

                deserializeSceneData(app, stored.data);
                toast.success(`Loaded "${stored.metadata.name}"`, {
                    duration: 2000,
                });
            })
            .catch((err) => {
                console.error('Failed to restore scene:', err);
                toast.error('Failed to restore scene');
            })
            .finally(() => {
                clearPendingScene();
            });
    }, [app, pendingSceneId, clearPendingScene]);

    return null;
}
