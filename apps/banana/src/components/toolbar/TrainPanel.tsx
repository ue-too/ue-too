import { BoardCamera } from '@ue-too/board';
import type { Point } from '@ue-too/math';
import { ArrowLeftRight, Crosshair, Focus, Gauge, Pause, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { TrainManager } from '@/trains/train-manager';
import type { FocusAnimationParams } from '@/utils/init-app';

import { ToolbarButton } from './ToolbarButton';

type TrainPanelProps = {
    trainManager: TrainManager;
    onClose: () => void;
    startFocusAnimation: (params: FocusAnimationParams) => void;
    startFollowAnimation: (
        params: FocusAnimationParams,
        getPosition: () => Point | null
    ) => void;
    stopFollowing: () => void;
    isFollowing: () => boolean;
    camera: BoardCamera;
};

export function TrainPanel({
    trainManager,
    startFocusAnimation,
    startFollowAnimation,
    stopFollowing,
    isFollowing,
    onClose,
    camera,
}: TrainPanelProps) {
    const { t } = useTranslation();
    const [following, setFollowing] = useState(isFollowing());
    const placedTrains = trainManager.getPlacedTrains();
    const selectedTrain = trainManager.getSelectedTrain();
    const selectedIndex = trainManager.selectedIndex;

    return (
        <DraggablePanel title={t('trains')} onClose={onClose} className="w-60">
            <Separator className="mb-2" />
            <div className="flex flex-col gap-2">
                {placedTrains.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            {t('placedTrains')}
                        </span>
                        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                            {placedTrains.map((entry, index) => {
                                const formation = entry.train.formation;
                                const carCount = formation.flatCars().length;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() =>
                                            trainManager.setSelectedIndex(
                                                entry.id
                                            )
                                        }
                                        className={cn(
                                            'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors',
                                            entry.id === selectedIndex
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted/50 hover:bg-muted'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-medium">
                                                {index + 1}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-xs">
                                                    {formation.id}
                                                </span>
                                                <span
                                                    className={
                                                        entry.id ===
                                                        selectedIndex
                                                            ? 'text-primary-foreground/80'
                                                            : 'text-muted-foreground'
                                                    }
                                                >
                                                    {t('car', {
                                                        count: carCount,
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {placedTrains.length > 0 && (
                    <div className="flex w-full flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            {t('controls')}
                        </span>
                        <div className="flex w-full flex-wrap gap-1">
                            <ToolbarButton
                                tooltip={t('throttleP5')}
                                disabled={!selectedTrain}
                                onClick={() =>
                                    selectedTrain?.setThrottleStep('p5')
                                }
                            >
                                <Gauge />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={t('neutral')}
                                disabled={!selectedTrain}
                                onClick={() =>
                                    selectedTrain?.setThrottleStep('N')
                                }
                            >
                                <Pause />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={t('focusOnSelectedTrain')}
                                disabled={!selectedTrain}
                                onClick={() => {
                                    const point =
                                        selectedTrain?.position?.point;

                                    if (!point) return;

                                    startFocusAnimation({
                                        startWorldPoint: camera.position,
                                        targetWorldPoint: point,
                                        startZoom: camera.zoomLevel,
                                        targetZoom: 5,
                                    });
                                }}
                            >
                                <Focus />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={
                                    following
                                        ? t('stopFollowing')
                                        : t('followSelectedTrain')
                                }
                                active={following}
                                disabled={!selectedTrain && !following}
                                onClick={() => {
                                    if (following) {
                                        stopFollowing();
                                        setFollowing(false);
                                        return;
                                    }

                                    const point =
                                        selectedTrain?.position?.point;

                                    if (!point) return;

                                    startFollowAnimation(
                                        {
                                            startWorldPoint: camera.position,
                                            targetWorldPoint: point,
                                            startZoom: camera.zoomLevel,
                                            targetZoom: 5,
                                        },
                                        () =>
                                            selectedTrain?.position?.point ??
                                            null
                                    );
                                    setFollowing(true);
                                }}
                            >
                                <Crosshair />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={t('switchDirection')}
                                disabled={!selectedTrain}
                                onClick={() => selectedTrain?.switchDirection()}
                            >
                                <ArrowLeftRight />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={t('removeSelectedTrain')}
                                destructive
                                onClick={() =>
                                    trainManager.removeSelectedTrain()
                                }
                            >
                                <Trash2 />
                            </ToolbarButton>
                        </div>
                    </div>
                )}
            </div>
        </DraggablePanel>
    );
}
