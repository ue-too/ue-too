import {
    Download,
    GripHorizontal,
    Image,
    MousePointer2,
    Plus,
    Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { Point } from '@ue-too/math';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTrainEditorApp } from './use-train-editor-app';

type TrainEditorMode = 'idle' | 'edit-bogie' | 'add-bogie' | 'edit-image';

function ToolbarButton({
    tooltip,
    active,
    disabled,
    onClick,
    children,
}: {
    tooltip: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    const variant = active ? 'default' : 'ghost';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant={variant}
                    size="icon-lg"
                    disabled={disabled}
                    onClick={onClick}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Exported train editor state: car bogie definition + optional reference image.
 */
type TrainEditorExport = {
    bogieOffsets: number[];
    edgeToBogie: number;
    bogieToEdge: number;
    bogies: Point[];
    image?: {
        src: string;
        position: Point;
        width: number;
        height: number;
    };
};

function uploadJson(onJson: (parsed: unknown) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result as string);
                onJson(parsed);
            } catch (e) {
                alert(`Failed to parse JSON: ${(e as Error).message}`);
            }
        };
        reader.readAsText(file);
    });
    input.click();
}

function uploadImage(onLoad: (src: string, width: number, height: number) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new window.Image();
            img.onload = () => {
                // Scale image to a reasonable world size (max dimension = 10 world units)
                const maxDim = Math.max(img.width, img.height);
                const scale = 10 / maxDim;
                onLoad(dataUrl, img.width * scale, img.height * scale);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
    input.click();
}

export function TrainEditorToolbar() {
    const app = useTrainEditorApp();
    const [mode, setMode] = useState<TrainEditorMode>('idle');

    const exitAllModes = useCallback(() => {
        if (!app) return;
        app.trainEditorKmtStateMachine.happens('switchToIdle');
        setMode('idle');
    }, [app]);

    const handleEditBogieToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'edit-bogie') {
            app.trainEditorKmtStateMachine.happens('switchToIdle');
            setMode('idle');
        } else {
            exitAllModes();
            app.trainEditorKmtStateMachine.happens('switchToEditBogie');
            setMode('edit-bogie');
        }
    }, [app, mode, exitAllModes]);

    const handleAddBogieToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'add-bogie') {
            app.trainEditorKmtStateMachine.happens('switchToIdle');
            setMode('idle');
        } else {
            exitAllModes();
            app.trainEditorKmtStateMachine.happens('switchToAddBogie');
            setMode('add-bogie');
        }
    }, [app, mode, exitAllModes]);

    const handleEditImageToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'edit-image') {
            app.trainEditorKmtStateMachine.happens('switchToIdle');
            app.imageRenderSystem.showHandles = false;
            setMode('idle');
        } else {
            exitAllModes();
            app.trainEditorKmtStateMachine.happens('switchToEditImage');
            app.imageRenderSystem.showHandles = true;
            setMode('edit-image');
        }
    }, [app, mode, exitAllModes]);

    const handleImportImage = useCallback(() => {
        if (!app) return;
        uploadImage((src, width, height) => {
            app.imageEditorEngine.setImage(src, width, height);
            // Auto-switch to image edit mode
            exitAllModes();
            app.trainEditorKmtStateMachine.happens('switchToEditImage');
            app.imageRenderSystem.showHandles = true;
            setMode('edit-image');
        });
    }, [app, exitAllModes]);

    const handleExport = useCallback(() => {
        if (!app) return;
        const def = app.bogieEditorEngine.exportCarDefinition();
        if (!def) {
            alert('Need at least 2 bogies to export.');
            return;
        }
        const image = app.imageEditorEngine.getImage();
        const exportData: TrainEditorExport = {
            ...def,
            bogies: [...app.bogieEditorEngine.getBogies()],
            image: image ? { ...image } : undefined,
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `car-definition-${Date.now()}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [app]);

    const handleImport = useCallback(() => {
        if (!app) return;
        uploadJson(parsed => {
            const data = parsed as Partial<TrainEditorExport>;
            if (!data.bogieOffsets || !Array.isArray(data.bogieOffsets)) {
                alert('Invalid file: missing bogieOffsets.');
                return;
            }
            // Clear existing bogies
            const currentBogies = app.bogieEditorEngine.getBogies();
            for (let i = currentBogies.length - 1; i >= 0; i--) {
                app.bogieEditorEngine.removeBogie(i);
            }
            // Restore bogies from saved positions
            if (data.bogies && Array.isArray(data.bogies)) {
                for (const bogie of data.bogies) {
                    app.bogieEditorEngine.addBogie(bogie);
                }
            }
            // Restore image
            if (data.image) {
                app.imageEditorEngine.setImage(data.image.src, data.image.width, data.image.height);
                // Restore position (setImage resets to origin)
                const img = app.imageEditorEngine.getImage();
                if (img) {
                    img.position = { ...data.image.position };
                    img.width = data.image.width;
                    img.height = data.image.height;
                }
                // Notify render system of the restored position
                app.imageEditorEngine.notifyChange();
            }
        });
    }, [app]);

    if (!app) return null;

    const hasImage = app.imageEditorEngine.getImage() !== null;
    const hasBogies = app.bogieEditorEngine.getBogies().length >= 2;

    return (
        <TooltipProvider delayDuration={200}>
            <div
                className={cn(
                    'pointer-events-auto absolute top-1/2 left-6 flex -translate-y-1/2 flex-col items-center gap-3'
                )}
            >
                <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                    {/* Edit bogies */}
                    <ToolbarButton
                        tooltip={mode === 'edit-bogie' ? 'End Edit' : 'Edit Bogies'}
                        active={mode === 'edit-bogie'}
                        onClick={handleEditBogieToggle}
                    >
                        <MousePointer2 />
                    </ToolbarButton>

                    {/* Add bogie */}
                    <ToolbarButton
                        tooltip={mode === 'add-bogie' ? 'End Add' : 'Add Bogie'}
                        active={mode === 'add-bogie'}
                        onClick={handleAddBogieToggle}
                    >
                        <Plus />
                    </ToolbarButton>

                    <Separator />

                    {/* Import image */}
                    <ToolbarButton
                        tooltip="Import Image"
                        onClick={handleImportImage}
                    >
                        <Image />
                    </ToolbarButton>

                    {/* Edit image */}
                    <ToolbarButton
                        tooltip={mode === 'edit-image' ? 'End Image Edit' : 'Edit Image'}
                        active={mode === 'edit-image'}
                        disabled={!hasImage && mode !== 'edit-image'}
                        onClick={handleEditImageToggle}
                    >
                        <GripHorizontal />
                    </ToolbarButton>

                    <Separator />

                    {/* Export */}
                    <ToolbarButton
                        tooltip="Export Car Definition"
                        disabled={!hasBogies}
                        onClick={handleExport}
                    >
                        <Download />
                    </ToolbarButton>

                    {/* Import */}
                    <ToolbarButton
                        tooltip="Import Car Definition"
                        onClick={handleImport}
                    >
                        <Upload />
                    </ToolbarButton>
                </div>
            </div>
        </TooltipProvider>
    );
}
