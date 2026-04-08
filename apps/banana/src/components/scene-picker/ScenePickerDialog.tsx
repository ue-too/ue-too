import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus, Trash2 } from '@/assets/icons';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useSceneStore } from '@/stores/scene-store';
import { getSceneStorage, type SceneMetadata } from '@/storage';

import { SceneCard } from './SceneCard';

type ScenePickerDialogProps = {
    /** Called when a scene is selected or a new scene is created. */
    onSceneSelected: (sceneId: string | null) => void;
};

export function ScenePickerDialog({ onSceneSelected }: ScenePickerDialogProps) {
    const { t } = useTranslation();
    const scenePickerOpen = useSceneStore((s) => s.scenePickerOpen);
    const hideScenePicker = useSceneStore((s) => s.hideScenePicker);
    const activeSceneId = useSceneStore((s) => s.activeSceneId);
    const setActiveScene = useSceneStore((s) => s.setActiveScene);
    const [scenes, setScenes] = useState<SceneMetadata[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadScenes = useCallback(async () => {
        const list = await getSceneStorage().listScenes();
        setScenes(list);
    }, []);

    useEffect(() => {
        if (scenePickerOpen) {
            loadScenes();
        }
    }, [scenePickerOpen, loadScenes]);

    const handleSelect = useCallback(
        (scene: SceneMetadata) => {
            setActiveScene(scene.id, scene.name);
            hideScenePicker();
            onSceneSelected(scene.id);
        },
        [setActiveScene, hideScenePicker, onSceneSelected]
    );

    const handleNewScene = useCallback(() => {
        hideScenePicker();
        onSceneSelected(null);
    }, [hideScenePicker, onSceneSelected]);

    const handleDelete = useCallback(
        async (id: string) => {
            await getSceneStorage().deleteScene(id);
            if (activeSceneId === id) {
                await getSceneStorage().setActiveSceneId(null);
            }
            setConfirmDeleteId(null);
            await loadScenes();
        },
        [activeSceneId, loadScenes]
    );

    const handleRename = useCallback(
        async (id: string, newName: string) => {
            const stored = await getSceneStorage().loadScene(id);
            if (!stored) return;
            stored.metadata.name = newName;
            await getSceneStorage().saveScene(stored);
            await loadScenes();
        },
        [loadScenes]
    );

    return (
        <Dialog
            open={scenePickerOpen}
            onOpenChange={(open) => {
                if (!open) {
                    // If no scene is active and user closes dialog, create new scene
                    if (!activeSceneId) {
                        onSceneSelected(null);
                    }
                    hideScenePicker();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('scenePickerTitle')}</DialogTitle>
                    <DialogDescription>
                        {t('scenePickerDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {scenes.map((scene) => (
                        <SceneCard
                            key={scene.id}
                            scene={scene}
                            isActive={scene.id === activeSceneId}
                            confirmingDelete={confirmDeleteId === scene.id}
                            onSelect={() => handleSelect(scene)}
                            onDelete={() => {
                                if (confirmDeleteId === scene.id) {
                                    handleDelete(scene.id);
                                } else {
                                    setConfirmDeleteId(scene.id);
                                }
                            }}
                            onCancelDelete={() => setConfirmDeleteId(null)}
                            onRename={(name) => handleRename(scene.id, name)}
                        />
                    ))}

                    {scenes.length === 0 && (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            {t('noSavedScenes')}
                        </p>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={handleNewScene}
                    >
                        <FilePlus className="mr-2 size-4" />
                        {t('newScene')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
