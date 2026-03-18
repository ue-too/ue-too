import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Plus, Scissors, Trash2, TrainFront } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { CarStockManager } from '@/trains/car-stock-manager';
import type { FormationManager } from '@/trains/formation-manager';
import type { TrainManager } from '@/trains/train-manager';
import type { Formation } from '@/trains/formation';
import type { TrainUnit } from '@/trains/cars';

type FormationEditorProps = {
    formationManager: FormationManager;
    carStockManager: CarStockManager;
    trainManager: TrainManager;
    onClose: () => void;
};

/** Returns true if the TrainUnit is a nested Formation (has depth > 0). */
function isNestedFormation(unit: TrainUnit): boolean {
    return unit.depth > 0;
}

export function FormationEditor({
    formationManager,
    carStockManager,
    trainManager,
    onClose,
}: FormationEditorProps) {
    const [version, setVersion] = useState(0);
    /** For unplaced: formation id. For placed: `placed-${trainIndex}` */
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    // Which car in stock is selected to be added to a formation
    const [selectedStockCarId, setSelectedStockCarId] = useState<
        string | null
    >(null);

    useEffect(() => {
        const unsub1 = formationManager.subscribe(() =>
            setVersion(v => v + 1)
        );
        const unsub2 = carStockManager.subscribe(() =>
            setVersion(v => v + 1)
        );
        const unsub3 = trainManager.subscribe(() =>
            setVersion(v => v + 1)
        );
        return () => {
            unsub1();
            unsub2();
            unsub3();
        };
    }, [formationManager, carStockManager, trainManager]);

    // Placed formations: from trains on track
    const placedFormations = trainManager
        .getPlacedTrains()
        .map((entry, index) => ({
            trainIndex: index + 1,
            trainId: entry.id,
            formation: entry.train.formation,
        }));

    // Unplaced formations: in depot (formation manager)
    const unplacedFormations = formationManager.getFormations();

    // Resolve selected formation from selectedKey
    const selectedFormation =
        selectedKey === null
            ? null
            : selectedKey.startsWith('placed-')
              ? (() => {
                    const trainIndex = parseInt(
                        selectedKey.replace('placed-', ''),
                        10
                    );
                    const entry = placedFormations.find(
                        p => p.trainIndex === trainIndex
                    );
                    return entry?.formation ?? null;
                })()
              : formationManager.getFormation(selectedKey);
    if (selectedKey !== null && selectedFormation === null) {
        setSelectedKey(null);
    }

    const availableCars = carStockManager.getAvailableCars();

    const handleCreateFormation = useCallback(() => {
        if (availableCars.length === 0) return;
        // Create a formation with the first available car
        const firstCar = availableCars[0];
        const formation = formationManager.createFormation([firstCar.id]);
        setSelectedKey(formation.id);
    }, [formationManager, availableCars]);

    const handleDeleteFormation = useCallback(
        (id: string) => {
            formationManager.deleteFormation(id);
            if (selectedKey === id) {
                setSelectedKey(null);
            }
        },
        [formationManager, selectedKey]
    );

    const handleAppendCar = useCallback(
        (formationId: string, carId: string) => {
            formationManager.appendCar(formationId, carId);
            setSelectedStockCarId(null);
        },
        [formationManager]
    );

    const handlePrependCar = useCallback(
        (formationId: string, carId: string) => {
            formationManager.prependCar(formationId, carId);
            setSelectedStockCarId(null);
        },
        [formationManager]
    );

    const handleRemoveChild = useCallback(
        (formationId: string, childIndex: number) => {
            formationManager.removeChild(formationId, childIndex);
        },
        [formationManager]
    );

    return (
        <DraggablePanel
            title="Formations"
            onClose={onClose}
            className="w-72"
            defaultPosition={{
                x: window.innerWidth - 320,
                y: 60,
            }}
            headerActions={
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCreateFormation}
                    disabled={availableCars.length === 0}
                >
                    <Plus className="size-3.5" />
                </Button>
            }
        >
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
                {/* Placed formations (on trains) */}
                {placedFormations.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                            <TrainFront className="size-3" />
                            On track
                        </span>
                        {placedFormations.map(({ trainIndex, trainId, formation }) => {
                            const key = `placed-${trainIndex}`;
                            return (
                                <FormationCard
                                    key={key}
                                    formation={formation}
                                    trainLabel={trainIndex}
                                    isSelected={key === selectedKey}
                                    onSelect={() =>
                                        setSelectedKey(
                                            key === selectedKey ? null : key
                                        )
                                    }
                                    readOnly
                                    onDelete={() => {}}
                                    availableCars={[]}
                                    selectedStockCarId={null}
                                    onSelectStockCar={() => {}}
                                    onAppendCar={() => {}}
                                    onPrependCar={() => {}}
                                    onRemoveChild={() => {}}
                                    onDecouple={
                                        formation.flatCars().length > 1
                                            ? (headCarIndex, tailCarIndex) => {
                                                trainManager.decoupleTrainAtCar(
                                                    trainId,
                                                    headCarIndex,
                                                    tailCarIndex,
                                                    'head',
                                                );
                                            }
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </div>
                )}

                {/* Unplaced formations (in depot) */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                        <Layers className="size-3" />
                        In depot
                    </span>
                    {unplacedFormations.length === 0 ? (
                        <span className="text-muted-foreground block py-2 text-center text-xs">
                            No formations in depot.
                            {availableCars.length > 0
                                ? ' Click + to create one.'
                                : ' Add cars to the depot first.'}
                        </span>
                    ) : (
                        unplacedFormations.map(({ id, formation }) => (
                            <FormationCard
                                key={id}
                                formation={formation}
                                isSelected={id === selectedKey}
                                onSelect={() =>
                                    setSelectedKey(
                                        id === selectedKey ? null : id
                                    )
                                }
                                readOnly={false}
                                onDelete={() => handleDeleteFormation(id)}
                                availableCars={availableCars}
                                selectedStockCarId={selectedStockCarId}
                                onSelectStockCar={setSelectedStockCarId}
                                onAppendCar={carId =>
                                    handleAppendCar(id, carId)
                                }
                                onPrependCar={carId =>
                                    handlePrependCar(id, carId)
                                }
                                onRemoveChild={childIndex =>
                                    handleRemoveChild(id, childIndex)
                                }
                            />
                        ))
                    )}
                </div>
            </div>
        </DraggablePanel>
    );
}

type FormationCardProps = {
    formation: Formation;
    /** When set, shows "Train N" label (for placed formations). */
    trainLabel?: number;
    isSelected: boolean;
    onSelect: () => void;
    readOnly?: boolean;
    onDelete: () => void;
    availableCars: readonly { id: string; car: import('@/trains/cars').Car }[];
    selectedStockCarId: string | null;
    onSelectStockCar: (id: string | null) => void;
    onAppendCar: (carId: string) => void;
    onPrependCar: (carId: string) => void;
    onRemoveChild: (childIndex: number) => void;
    /** When set, decouple buttons appear between children. Args: (headCarIndex, tailCarIndex). */
    onDecouple?: (headCarIndex: number, tailCarIndex: number) => void;
};

function FormationCard({
    formation,
    trainLabel,
    isSelected,
    onSelect,
    readOnly = false,
    onDelete,
    availableCars,
    selectedStockCarId,
    onSelectStockCar,
    onAppendCar,
    onPrependCar,
    onRemoveChild,
    onDecouple,
}: FormationCardProps) {
    const cars = formation.flatCars();
    // Use operational order when decouple is available so indices match flatCars()
    const children = onDecouple ? formation.children : formation.originalChildren;
    const hasNestedFormations = children.some(isNestedFormation);

    return (
        <div className="bg-muted/50 rounded-lg border">
            {/* Header row */}
            <div
                className="flex cursor-pointer items-center justify-between px-2.5 py-1.5"
                onClick={onSelect}
            >
                <div className="flex items-center gap-1.5">
                    {isSelected ? (
                        <ChevronUp className="text-muted-foreground size-3" />
                    ) : (
                        <ChevronDown className="text-muted-foreground size-3" />
                    )}
                    {trainLabel !== undefined && (
                        <span className="text-muted-foreground text-[10px]">
                            Train {trainLabel}
                        </span>
                    )}
                    <span className="text-foreground text-xs font-mono">
                        {formation.id}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                        ({cars.length} car{cars.length !== 1 ? 's' : ''})
                    </span>
                    {hasNestedFormations && (
                        <span
                            className="text-muted-foreground rounded bg-muted px-1 text-[9px]"
                            title="Contains nested formations"
                        >
                            nested
                        </span>
                    )}
                </div>
                {!readOnly && (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={e => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 className="size-3" />
                    </Button>
                )}
            </div>

            {/* Expanded detail */}
            {isSelected && (
                <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                    <Separator />

                    {/* Car composition list */}
                    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                        Composition
                    </span>
                    <div className="flex flex-col gap-0.5">
                        {children.map((child, index) => {
                            const isNested = isNestedFormation(child);
                            // Compute flat car index at the boundary after this child
                            let flatCarOffset = 0;
                            for (let i = 0; i <= index; i++) {
                                flatCarOffset += children[i].flatCars().length;
                            }
                            const headCarIndex = flatCarOffset - 1;
                            const tailCarIndex = flatCarOffset;
                            return (
                                <div key={child.id}>
                                    <div
                                        className="bg-background/60 flex items-center justify-between rounded px-2 py-1"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground text-[10px] font-mono w-4 text-center">
                                                {index + 1}
                                            </span>
                                            <span className="text-foreground text-[11px] font-mono">
                                                {child.id}
                                            </span>
                                            {isNested && (
                                                <span
                                                    className="text-muted-foreground rounded bg-muted px-1 text-[9px]"
                                                    title="Nested formation"
                                                >
                                                    {child.flatCars().length} car
                                                    {child.flatCars().length !== 1
                                                        ? 's'
                                                        : ''}
                                                </span>
                                            )}
                                        </div>
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                disabled={children.length <= 1}
                                                onClick={() =>
                                                    onRemoveChild(index)
                                                }
                                            >
                                                <Trash2 className="size-2.5" />
                                            </Button>
                                        )}
                                    </div>
                                    {onDecouple && index < children.length - 1 && (
                                        <button
                                            className="group flex w-full items-center gap-1 py-0.5 px-2"
                                            onClick={() => onDecouple(headCarIndex, tailCarIndex)}
                                        >
                                            <div className="bg-border group-hover:bg-destructive/50 h-px flex-1 transition-colors" />
                                            <Scissors className="text-muted-foreground group-hover:text-destructive size-2.5 transition-colors" />
                                            <div className="bg-border group-hover:bg-destructive/50 h-px flex-1 transition-colors" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Add car from stock */}
                    {!readOnly && availableCars.length > 0 && (
                        <>
                            <Separator />
                            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                                Add from stock
                            </span>
                            <div className="flex flex-col gap-0.5">
                                {availableCars.map(entry => (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                                            selectedStockCarId === entry.id
                                                ? 'bg-primary/20 border border-primary/40'
                                                : 'bg-background/60 hover:bg-background/80'
                                        }`}
                                        onClick={() =>
                                            onSelectStockCar(
                                                selectedStockCarId ===
                                                    entry.id
                                                    ? null
                                                    : entry.id
                                            )
                                        }
                                    >
                                        <span className="text-foreground text-[11px] font-mono">
                                            {entry.id}
                                        </span>
                                        {selectedStockCarId === entry.id && (
                                            <div className="flex gap-0.5">
                                                <Button
                                                    variant="outline"
                                                    size="icon-xs"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onPrependCar(
                                                            entry.id
                                                        );
                                                    }}
                                                >
                                                    <ChevronUp className="size-2.5" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon-xs"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onAppendCar(
                                                            entry.id
                                                        );
                                                    }}
                                                >
                                                    <ChevronDown className="size-2.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
