import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight, ChevronDown, ChevronUp, FlipVertical2, Layers, Link2, Merge, Pencil, Plus, Scissors, Trash2, TrainFront } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { CarStockManager } from '@/trains/car-stock-manager';
import type { FormationManager } from '@/trains/formation-manager';
import type { TrainManager } from '@/trains/train-manager';
import type { Formation } from '@/trains/formation';
import type { Car, TrainUnit } from '@/trains/cars';
import type { ProximityMatch } from '@/trains/proximity-detector';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/analytics';

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
    const { t } = useTranslation();
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
        const unsub4 = trainManager.subscribeToProximityChanges(() =>
            setVersion(v => v + 1)
        );
        return () => {
            unsub1();
            unsub2();
            unsub3();
            unsub4();
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
        trackEvent('create-formation');
    }, [formationManager, availableCars]);

    const handleDeleteFormation = useCallback(
        (id: string) => {
            formationManager.deleteFormation(id);
            trackEvent('delete-formation');
            if (selectedKey === id) {
                setSelectedKey(null);
            }
        },
        [formationManager, selectedKey]
    );

    const handleAppendCar = useCallback(
        (formationId: string, carId: string) => {
            formationManager.appendCar(formationId, carId);
            trackEvent('add-car-to-formation');
            setSelectedStockCarId(null);
        },
        [formationManager]
    );

    const handlePrependCar = useCallback(
        (formationId: string, carId: string) => {
            formationManager.prependCar(formationId, carId);
            trackEvent('add-car-to-formation');
            setSelectedStockCarId(null);
        },
        [formationManager]
    );

    const handleRemoveChild = useCallback(
        (formationId: string, childIndex: number) => {
            formationManager.removeChild(formationId, childIndex);
            trackEvent('remove-car-from-formation');
        },
        [formationManager]
    );

    const handleConsolidate = useCallback(
        (formationId: string) => {
            formationManager.consolidateFormation(formationId);
        },
        [formationManager]
    );

    const handleSwapChildren = useCallback(
        (formationId: string, index: number) => {
            formationManager.swapChildren(formationId, index);
        },
        [formationManager]
    );

    const handleReverseChildren = useCallback(
        (formationId: string) => {
            formationManager.reverseChildren(formationId);
        },
        [formationManager]
    );

    const handleReverseNestedChildren = useCallback(
        (formationId: string, childIndex: number) => {
            formationManager.reverseNestedChildren(formationId, childIndex);
        },
        [formationManager]
    );

    const handleFlipChildDirection = useCallback(
        (formationId: string, childIndex: number) => {
            formationManager.flipChildDirection(formationId, childIndex);
        },
        [formationManager]
    );

    const handleRenameFormation = useCallback(
        (formationId: string, name: string) => {
            formationManager.renameFormation(formationId, name);
        },
        [formationManager]
    );

    const handleAppendFormation = useCallback(
        (targetId: string, sourceId: string) => {
            formationManager.appendFormation(targetId, sourceId);
        },
        [formationManager]
    );

    const handlePrependFormation = useCallback(
        (targetId: string, sourceId: string) => {
            formationManager.prependFormation(targetId, sourceId);
        },
        [formationManager]
    );

    return (
        <DraggablePanel
            title={t('formations')}
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
                            {t('onTrack')}
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
                                    couplableCandidates={trainManager.getCouplableCandidates(trainId)}
                                    onCouple={(match) => {
                                        const result = trainManager.coupleTrains(match);
                                        if (!result.success && result.reason === 'depth_exceeded') {
                                            toast.warning(t('couplingDepthExceeded'));
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Unplaced formations (in depot) */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                        <Layers className="size-3" />
                        {t('inDepot')}
                    </span>
                    {unplacedFormations.length === 0 ? (
                        <span className="text-muted-foreground block py-2 text-center text-xs">
                            {t('noFormationsInDepot')}
                            {availableCars.length > 0
                                ? ` ${t('clickPlusToCreate')}`
                                : ` ${t('addCarsToDepotFirst')}`}
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
                                onRename={name =>
                                    handleRenameFormation(id, name)
                                }
                                onConsolidate={() => handleConsolidate(id)}
                                onReverseChildren={() => handleReverseChildren(id)}
                                onSwapChildren={index =>
                                    handleSwapChildren(id, index)
                                }
                                onReverseNestedChildren={childIndex =>
                                    handleReverseNestedChildren(id, childIndex)
                                }
                                onFlipChildDirection={childIndex =>
                                    handleFlipChildDirection(id, childIndex)
                                }
                                otherFormations={unplacedFormations
                                    .filter(f => f.id !== id)
                                    .map(f => ({ id: f.id, formation: f.formation }))}
                                onAppendFormation={sourceId =>
                                    handleAppendFormation(id, sourceId)
                                }
                                onPrependFormation={sourceId =>
                                    handlePrependFormation(id, sourceId)
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
    /** Proximity matches for coupling candidates. */
    couplableCandidates?: readonly ProximityMatch[];
    /** Called when user clicks the couple button. */
    onCouple?: (match: ProximityMatch) => void;
    /** Called to rename the formation. */
    onRename?: (name: string) => void;
    /** Called to flatten all nested formations into direct cars. */
    onConsolidate?: () => void;
    /** Called to reverse the order of children. */
    onReverseChildren?: () => void;
    /** Swap child at index with child at index+1. */
    onSwapChildren?: (index: number) => void;
    /** Reverse the children order of a nested formation at the given child index. */
    onReverseNestedChildren?: (childIndex: number) => void;
    /** Flip the direction of any child (car or nested formation) at the given index. */
    onFlipChildDirection?: (childIndex: number) => void;
    /** Other depot formations available to nest into this one. */
    otherFormations?: readonly { id: string; formation: Formation }[];
    /** Append another formation as a nested child. */
    onAppendFormation?: (sourceId: string) => void;
    /** Prepend another formation as a nested child. */
    onPrependFormation?: (sourceId: string) => void;
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
    couplableCandidates,
    onCouple,
    onRename,
    onConsolidate,
    onReverseChildren,
    onSwapChildren,
    onReverseNestedChildren,
    onFlipChildDirection,
    otherFormations,
    onAppendFormation,
    onPrependFormation,
}: FormationCardProps) {
    const { t } = useTranslation();
    const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const cars = formation.flatCars();
    // Use operational order when decouple is available so indices match flatCars()
    const children = onDecouple ? formation.children : formation.originalChildren;
    const hasNestedFormations = children.some(isNestedFormation);

    const startEditing = useCallback(() => {
        if (readOnly || !onRename) return;
        setEditValue(formation.name);
        setIsEditing(true);
        // Focus after render
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [readOnly, onRename, formation.name]);

    const commitRename = useCallback(() => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== formation.name && onRename) {
            onRename(trimmed);
        }
        setIsEditing(false);
    }, [editValue, formation.name, onRename]);

    return (
        <div className="bg-muted/50 rounded-lg border">
            {/* Header row */}
            <div
                className="flex cursor-pointer items-center justify-between px-2.5 py-1.5"
                onClick={onSelect}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    {isSelected ? (
                        <ChevronUp className="text-muted-foreground size-3 shrink-0" />
                    ) : (
                        <ChevronDown className="text-muted-foreground size-3 shrink-0" />
                    )}
                    {trainLabel !== undefined && (
                        <span className="text-muted-foreground text-[10px] shrink-0">
                            {t('trainLabel', { number: trainLabel })}
                        </span>
                    )}
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            className="text-foreground text-xs font-mono bg-background border border-primary/40 rounded px-1 py-0 w-24 outline-none"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="text-foreground text-xs font-mono truncate"
                            title={onRename ? t('renameFormation') : formation.name}
                            onDoubleClick={e => {
                                e.stopPropagation();
                                startEditing();
                            }}
                        >
                            {formation.name}
                        </span>
                    )}
                    <span className="text-muted-foreground text-[10px] shrink-0">
                        ({t('car', { count: cars.length })})
                    </span>
                    {hasNestedFormations && (
                        <span
                            className="text-muted-foreground rounded bg-muted px-1 text-[9px] shrink-0"
                            title={t('containsNestedFormations')}
                        >
                            {t('nested')}
                        </span>
                    )}
                    {couplableCandidates != null && couplableCandidates.length > 0 && (
                        <span
                            className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-600 dark:text-emerald-400 shrink-0"
                            title={t('couplable')}
                        >
                            <Link2 className="size-2" />
                            {t('couplable')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    {onCouple && couplableCandidates && couplableCandidates.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            title={t('couple')}
                            onClick={e => {
                                e.stopPropagation();
                                onCouple(couplableCandidates[0]);
                            }}
                        >
                            <Link2 className="size-3" />
                        </Button>
                    )}
                    {!readOnly && onRename && (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={e => {
                                e.stopPropagation();
                                startEditing();
                            }}
                        >
                            <Pencil className="size-2.5" />
                        </Button>
                    )}
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
            </div>

            {/* Expanded detail */}
            {isSelected && (
                <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                    <Separator />

                    {/* Composition header with consolidate button */}
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                            {t('composition')}
                        </span>
                        <div className="flex items-center gap-0.5">
                            {!readOnly && onReverseChildren && children.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={onReverseChildren}
                                    title={t('reverseTooltip')}
                                >
                                    <ArrowLeftRight className="size-3" />
                                </Button>
                            )}
                            {!readOnly && hasNestedFormations && onConsolidate && (
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={onConsolidate}
                                    title={t('consolidateTooltip')}
                                >
                                    <Merge className="size-3" />
                                </Button>
                            )}
                        </div>
                    </div>
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
                                                {isNested ? child.id : (child as Car).name}
                                            </span>
                                            {isNested && (
                                                <span
                                                    className="text-muted-foreground rounded bg-muted px-1 text-[9px]"
                                                    title={t('nestedFormation')}
                                                >
                                                    {t('car', { count: child.flatCars().length })}
                                                </span>
                                            )}
                                        </div>
                                        {!readOnly && (
                                            <div className="flex items-center gap-0.5">
                                                {isNested && onReverseNestedChildren && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() =>
                                                            onReverseNestedChildren(index)
                                                        }
                                                        title={t('reverseNestedTooltip')}
                                                    >
                                                        <ArrowLeftRight className="size-2.5" />
                                                    </Button>
                                                )}
                                                {onFlipChildDirection && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() =>
                                                            onFlipChildDirection(index)
                                                        }
                                                        title={t('flipChildDirectionTooltip')}
                                                    >
                                                        <FlipVertical2 className="size-2.5" />
                                                    </Button>
                                                )}
                                                {onSwapChildren && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            disabled={index === 0}
                                                            onClick={() =>
                                                                onSwapChildren(index - 1)
                                                            }
                                                        >
                                                            <ArrowUp className="size-2.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            disabled={index >= children.length - 1}
                                                            onClick={() =>
                                                                onSwapChildren(index)
                                                            }
                                                        >
                                                            <ArrowDown className="size-2.5" />
                                                        </Button>
                                                    </>
                                                )}
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
                                            </div>
                                        )}
                                    </div>
                                    {/* Show nested formation's sub-children */}
                                    {isNested && (
                                        <div className="border-l border-border ml-5 pl-2 my-0.5">
                                            {child.flatCars().map(subCar => (
                                                <div
                                                    key={subCar.id}
                                                    className="flex items-center gap-1.5 px-1 py-0.5"
                                                >
                                                    <span className="text-muted-foreground text-[10px] font-mono">
                                                        {subCar.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                {t('addFromStock')}
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
                                            {entry.car.name}
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

                    {/* Add formation from depot */}
                    {!readOnly && otherFormations && otherFormations.length > 0 && onAppendFormation && onPrependFormation && (
                        <>
                            <Separator />
                            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                                {t('addFormation')}
                            </span>
                            <div className="flex flex-col gap-0.5">
                                {otherFormations.map(entry => (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer transition-colors ${
                                            selectedFormationId === entry.id
                                                ? 'bg-primary/20 border border-primary/40'
                                                : 'bg-background/60 hover:bg-background/80'
                                        }`}
                                        onClick={() =>
                                            setSelectedFormationId(
                                                selectedFormationId === entry.id
                                                    ? null
                                                    : entry.id
                                            )
                                        }
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-foreground text-[11px] font-mono">
                                                {entry.formation.name}
                                            </span>
                                            <span className="text-muted-foreground text-[9px]">
                                                ({t('car', { count: entry.formation.flatCars().length })})
                                            </span>
                                        </div>
                                        {selectedFormationId === entry.id && (
                                            <div className="flex gap-0.5">
                                                <Button
                                                    variant="outline"
                                                    size="icon-xs"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onPrependFormation(entry.id);
                                                        setSelectedFormationId(null);
                                                    }}
                                                >
                                                    <ChevronUp className="size-2.5" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon-xs"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onAppendFormation(entry.id);
                                                        setSelectedFormationId(null);
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
