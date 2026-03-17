import { useState } from 'react';
import { ArrowLeftRight, Gauge, Link, Lock, Pause, Scissors, Trash2, Unlock } from 'lucide-react';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { TrainManager } from '@/trains/train-manager';
import type { CouplingSystem } from '@/trains/coupling-system';
import { cn } from '@/lib/utils';

import { ToolbarButton } from './ToolbarButton';

type TrainPanelProps = {
    trainManager: TrainManager;
    couplingSystem: CouplingSystem;
    onClose: () => void;
};

export function TrainPanel({ trainManager, couplingSystem, onClose }: TrainPanelProps) {
    const placedTrains = trainManager.getPlacedTrains();
    const selectedTrain = trainManager.getSelectedTrain();
    const selectedIndex = trainManager.selectedIndex;

    const [decoupleMode, setDecoupleMode] = useState(false);
    const [coupleMode, setCoupleMode] = useState(false);
    const [, forceUpdate] = useState(0);

    const handleDecouple = (childIndex: number) => {
        trainManager.decoupleTrainAt(selectedIndex, childIndex);
        setDecoupleMode(false);
    };

    const handleCouple = (otherId: number, orientation: 'tail-ahead' | 'head-ahead') => {
        if (orientation === 'tail-ahead') {
            // Other's tail is ahead of selected's head → append other to selected
            trainManager.coupleTrains(selectedIndex, otherId, false);
        } else {
            // Other's head is behind selected's tail → prepend other to selected
            trainManager.coupleTrains(selectedIndex, otherId, true);
        }
        setCoupleMode(false);
    };

    const adjacentTrains = coupleMode
        ? couplingSystem.getAdjacentTrains(selectedIndex)
        : [];

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
                                        onClick={() => {
                                            trainManager.setSelectedIndex(
                                                entry.id
                                            );
                                            setDecoupleMode(false);
                                            setCoupleMode(false);
                                        }}
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
                                tooltip="Decouple"
                                disabled={!selectedTrain || (selectedTrain?.formation.children.length ?? 0) < 2}
                                active={decoupleMode}
                                onClick={() => {
                                    setDecoupleMode(v => !v);
                                    setCoupleMode(false);
                                }}
                            >
                                <Scissors />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip="Couple"
                                disabled={!selectedTrain}
                                active={coupleMode}
                                onClick={() => {
                                    setCoupleMode(v => !v);
                                    setDecoupleMode(false);
                                }}
                            >
                                <Link />
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={selectedTrain?.frontCouplerLocked ? 'Unlock Front Coupler' : 'Lock Front Coupler'}
                                disabled={!selectedTrain}
                                active={selectedTrain?.frontCouplerLocked}
                                onClick={() => {
                                    if (selectedTrain) {
                                        selectedTrain.frontCouplerLocked = !selectedTrain.frontCouplerLocked;
                                        forceUpdate(v => v + 1);
                                    }
                                }}
                            >
                                {selectedTrain?.frontCouplerLocked ? <Lock /> : <Unlock />}
                            </ToolbarButton>
                            <ToolbarButton
                                tooltip={selectedTrain?.rearCouplerLocked ? 'Unlock Rear Coupler' : 'Lock Rear Coupler'}
                                disabled={!selectedTrain}
                                active={selectedTrain?.rearCouplerLocked}
                                onClick={() => {
                                    if (selectedTrain) {
                                        selectedTrain.rearCouplerLocked = !selectedTrain.rearCouplerLocked;
                                        forceUpdate(v => v + 1);
                                    }
                                }}
                            >
                                {selectedTrain?.rearCouplerLocked ? <Lock /> : <Unlock />}
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

                {decoupleMode && selectedTrain && (
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            Split between
                        </span>
                        <div className="flex flex-col gap-0.5">
                            {Array.from({ length: selectedTrain.formation.children.length }).map((_, i) => {
                                const child = selectedTrain.formation.children[i];
                                const carCount = child.flatCars().length;
                                return (
                                    <div key={child.id}>
                                        <div className="bg-muted/50 rounded px-2 py-1 text-xs">
                                            {child.id} ({carCount} car{carCount !== 1 ? 's' : ''})
                                        </div>
                                        {i < selectedTrain.formation.children.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDecouple(i + 1)}
                                                className="text-destructive hover:bg-destructive/10 my-0.5 w-full rounded border border-dashed px-2 py-0.5 text-center text-xs transition-colors"
                                            >
                                                split here
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {coupleMode && selectedTrain && (
                    <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">
                            Adjacent trains
                        </span>
                        {adjacentTrains.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                                No trains nearby
                            </span>
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                {adjacentTrains.map(({ id, orientation }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => handleCouple(id, orientation)}
                                        className="bg-muted/50 hover:bg-muted flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors"
                                    >
                                        <span>Train #{id}</span>
                                        <span className="text-muted-foreground">
                                            {orientation === 'tail-ahead' ? 'tail ahead' : 'head ahead'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DraggablePanel>
    );
}
