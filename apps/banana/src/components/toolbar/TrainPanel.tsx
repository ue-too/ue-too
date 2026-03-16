import { ArrowLeftRight, Gauge, Pause, Trash2 } from 'lucide-react';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { TrainManager } from '@/trains/train-manager';
import { cn } from '@/lib/utils';

import { ToolbarButton } from './ToolbarButton';

type TrainPanelProps = {
    trainManager: TrainManager;
    onClose: () => void;
};

export function TrainPanel({ trainManager, onClose }: TrainPanelProps) {
    const placedTrains = trainManager.getPlacedTrains();
    const selectedTrain = trainManager.getSelectedTrain();
    const selectedIndex = trainManager.selectedIndex;

    return (
        <DraggablePanel
            title="Trains"
            onClose={onClose}
            className="w-56"
        >
            <Separator className="mb-2" />
            <div className="flex flex-col gap-2">
                {placedTrains.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            Placed trains
                        </span>
                        <div className="flex flex-col gap-1">
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
                                                        entry.id === selectedIndex
                                                            ? 'text-primary-foreground/80'
                                                            : 'text-muted-foreground'
                                                    }
                                                >
                                                    {carCount} car
                                                    {carCount !== 1 ? 's' : ''}
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
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            Controls
                        </span>
                        <div className="flex flex-wrap gap-1">
                            <ToolbarButton
                                tooltip="Throttle P5"
                                disabled={!selectedTrain}
                                onClick={() =>
                                    selectedTrain?.setThrottleStep('p5')
                                }
                            >
                                <Gauge />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip="Neutral"
                                disabled={!selectedTrain}
                                onClick={() =>
                                    selectedTrain?.setThrottleStep('N')
                                }
                            >
                                <Pause />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip="Switch Direction"
                                disabled={!selectedTrain}
                                onClick={() =>
                                    selectedTrain?.switchDirection()
                                }
                            >
                                <ArrowLeftRight />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip="Remove Selected Train"
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
