import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { CarStockManager } from '@/trains/car-stock-manager';
import type { FormationManager } from '@/trains/formation-manager';
import type { Formation } from '@/trains/formation';

type FormationEditorProps = {
    formationManager: FormationManager;
    carStockManager: CarStockManager;
    onClose: () => void;
};

export function FormationEditor({
    formationManager,
    carStockManager,
    onClose,
}: FormationEditorProps) {
    const [version, setVersion] = useState(0);
    const [selectedFormationId, setSelectedFormationId] = useState<
        string | null
    >(null);
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
        return () => {
            unsub1();
            unsub2();
        };
    }, [formationManager, carStockManager]);

    // Clear selection if formation was deleted
    const formations = formationManager.getFormations();
    const selectedFormation =
        selectedFormationId !== null
            ? formationManager.getFormation(selectedFormationId)
            : null;
    if (selectedFormationId !== null && selectedFormation === null) {
        setSelectedFormationId(null);
    }

    const availableCars = carStockManager.getAvailableCars();

    const handleCreateFormation = useCallback(() => {
        if (availableCars.length === 0) return;
        // Create a formation with the first available car
        const firstCar = availableCars[0];
        const formation = formationManager.createFormation([firstCar.id]);
        setSelectedFormationId(formation.id);
    }, [formationManager, availableCars]);

    const handleDeleteFormation = useCallback(
        (id: string) => {
            formationManager.deleteFormation(id);
            if (selectedFormationId === id) {
                setSelectedFormationId(null);
            }
        },
        [formationManager, selectedFormationId]
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
            {/* Formation list */}
            {formations.length === 0 ? (
                <span className="text-muted-foreground block py-4 text-center text-xs">
                    No formations.
                    {availableCars.length > 0
                        ? ' Click + to create one.'
                        : ' Add cars to the depot first.'}
                </span>
            ) : (
                <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                    {formations.map(({ id, formation }) => (
                        <FormationCard
                            key={id}
                            formation={formation}
                            isSelected={id === selectedFormationId}
                            onSelect={() =>
                                setSelectedFormationId(
                                    id === selectedFormationId ? null : id
                                )
                            }
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
                    ))}
                </div>
            )}
        </DraggablePanel>
    );
}

type FormationCardProps = {
    formation: Formation;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    availableCars: readonly { id: string; car: import('@/trains/cars').Car }[];
    selectedStockCarId: string | null;
    onSelectStockCar: (id: string | null) => void;
    onAppendCar: (carId: string) => void;
    onPrependCar: (carId: string) => void;
    onRemoveChild: (childIndex: number) => void;
};

function FormationCard({
    formation,
    isSelected,
    onSelect,
    onDelete,
    availableCars,
    selectedStockCarId,
    onSelectStockCar,
    onAppendCar,
    onPrependCar,
    onRemoveChild,
}: FormationCardProps) {
    const cars = formation.flatCars();
    const children = formation.children;

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
                    <span className="text-foreground text-xs font-mono">
                        {formation.id}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                        ({cars.length} car{cars.length !== 1 ? 's' : ''})
                    </span>
                </div>
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
                            const childCars = child.flatCars();
                            return (
                                <div
                                    key={child.id}
                                    className="bg-background/60 flex items-center justify-between rounded px-2 py-1"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground text-[10px] font-mono w-4 text-center">
                                            {index + 1}
                                        </span>
                                        <span className="text-foreground text-[11px] font-mono">
                                            {child.id}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        disabled={children.length <= 1}
                                        onClick={() => onRemoveChild(index)}
                                    >
                                        <Trash2 className="size-2.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add car from stock */}
                    {availableCars.length > 0 && (
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
