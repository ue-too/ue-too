import { BoardCamera } from '@ue-too/board';
import type { Point } from '@ue-too/math';
import { ArrowLeftRight, Crosshair, Focus, Trash2 } from '@/assets/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ThrottleSteps } from '@/trains/formation';
import type { TrainManager } from '@/trains/train-manager';
import type { FocusAnimationParams } from '@/utils/init-app';

import { ThrottleIndicator } from './ThrottleIndicator';
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

    // Poll train throttle/speed at animation-frame rate
    const [throttle, setThrottle] = useState<ThrottleSteps>('N');
    const [speed, setSpeed] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!selectedTrain) return;
        const tick = () => {
            setThrottle(selectedTrain.throttleStep);
            setSpeed(selectedTrain.speed);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [selectedTrain]);

    const handleThrottleChange = useCallback(
        (step: ThrottleSteps) => {
            selectedTrain?.setThrottleStep(step);
        },
        [selectedTrain]
    );

    return (
        <DraggablePanel title={t('trains')} onClose={onClose} className="w-52">
            <Separator className="mb-2" />
            <div className="flex flex-col gap-2">
                {/* Train list */}
                {placedTrains.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            {t('placedTrains')}
                        </span>
                        <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                            {placedTrains.map((entry, index) => {
                                const formation = entry.train.formation;
                                const carCount = formation.flatCars().length;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() =>
                                            trainManager.setSelectedIndex(entry.id)
                                        }
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
                                            entry.id === selectedIndex
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted/50 hover:bg-muted'
                                        )}
                                    >
                                        <span className="font-mono font-medium">
                                            {index + 1}
                                        </span>
                                        <span className="truncate">
                                            {formation.name}
                                        </span>
                                        <span
                                            className={cn(
                                                'ml-auto shrink-0 text-[10px]',
                                                entry.id === selectedIndex
                                                    ? 'text-primary-foreground/70'
                                                    : 'text-muted-foreground'
                                            )}
                                        >
                                            {t('car', { count: carCount })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Selected train: throttle + controls */}
                {selectedTrain && (
                    <>
                        <Separator />
                        <ThrottleIndicator
                            currentStep={throttle}
                            speed={speed}
                            onThrottleChange={handleThrottleChange}
                        />
                        <Separator />
                        <div className="flex flex-wrap gap-1">
                            <ToolbarButton
                                tooltip={t('focusOnSelectedTrain')}
                                onClick={() => {
                                    const point = selectedTrain.position?.point;
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
                                onClick={() => {
                                    if (following) {
                                        stopFollowing();
                                        setFollowing(false);
                                        return;
                                    }
                                    const point = selectedTrain.position?.point;
                                    if (!point) return;
                                    startFollowAnimation(
                                        {
                                            startWorldPoint: camera.position,
                                            targetWorldPoint: point,
                                            startZoom: camera.zoomLevel,
                                            targetZoom: 5,
                                        },
                                        () =>
                                            selectedTrain.position?.point ??
                                            null
                                    );
                                    setFollowing(true);
                                }}
                            >
                                <Crosshair />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={t('switchDirection')}
                                onClick={() => selectedTrain.switchDirection()}
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
                    </>
                )}

                {/* Controls shown when no train selected but trains exist */}
                {!selectedTrain && placedTrains.length > 0 && (
                    <span className="text-muted-foreground text-center text-xs">
                        {t('placedTrains')}
                    </span>
                )}
            </div>
        </DraggablePanel>
    );
}
