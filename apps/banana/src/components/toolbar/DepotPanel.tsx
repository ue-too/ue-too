import { Pencil, Plus, Trash2 } from '@/assets/icons';
import { type Dispatch, type SetStateAction, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { CarStockManager } from '@/trains/car-stock-manager';
import type { CarStockEntry } from '@/trains/car-stock-manager';
import type { CarImageRegistry } from '@/trains/car-image-registry';
import type { CarTemplate } from '@/trains/car-template';
import { CarType } from '@/trains/cars';

const CAR_TYPES = Object.values(CarType);

type DepotPanelProps = {
    carStockManager: CarStockManager;
    carImageRegistry: CarImageRegistry;
    carTemplates: CarTemplate[];
    onCarTemplatesChange: Dispatch<SetStateAction<CarTemplate[]>>;
    onClose: () => void;
};

export function DepotPanel({
    carStockManager,
    carImageRegistry,
    carTemplates,
    onCarTemplatesChange,
    onClose,
}: DepotPanelProps) {
    const subscribe = useCallback(
        (cb: () => void) => carStockManager.subscribe(cb),
        [carStockManager]
    );
    const getSnapshot = useCallback(
        (): readonly CarStockEntry[] => carStockManager.getAvailableCars(),
        [carStockManager]
    );
    const availableCars = useSyncExternalStore(subscribe, getSnapshot);
    const { t } = useTranslation();
    const [newCarType, setNewCarType] = useState<CarType>(CarType.COACH);

    return (
        <DraggablePanel
            title={t('depot')}
            onClose={onClose}
            className="w-56"
        >
            <Separator className="mb-2" />
            <div className="flex items-center gap-1 mb-2">
                <Select
                    value={newCarType}
                    onValueChange={(value: string) => setNewCarType(value as CarType)}
                >
                    <SelectTrigger size="sm" className="h-6 flex-1 text-[10px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CAR_TYPES.map(ct => (
                            <SelectItem key={ct} value={ct}>
                                {t(`carType_${ct}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => carStockManager.createCar(undefined, undefined, undefined, newCarType)}
                >
                    <Plus className="size-3.5" />
                </Button>
            </div>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {availableCars.length === 0 ? (
                    <span className="text-muted-foreground py-4 text-center text-xs">
                        {t('noCarsInStock')}
                    </span>
                ) : (
                    availableCars.map(entry => (
                        <DepotCarRow
                            key={entry.id}
                            entry={entry}
                            carStockManager={carStockManager}
                        />
                    ))
                )}
            </div>

            {carTemplates.length > 0 && (
                <>
                    <Separator className="my-2" />
                    <span className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">
                        {t('templates')}
                    </span>
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                        {carTemplates.map(tpl => (
                            <div
                                key={tpl.id}
                                className="bg-muted/50 flex items-center justify-between rounded-lg px-2.5 py-1.5"
                            >
                                <div className="flex flex-col gap-0.5">
                                    {tpl.image && (
                                        <img
                                            src={tpl.image.src}
                                            alt="car"
                                            className="h-6 w-auto rounded object-contain"
                                        />
                                    )}
                                    <span className="text-muted-foreground text-[10px]">
                                        {t('bogieCount', { count: tpl.bogieOffsets.length + 1 })}
                                        {' · '}
                                        {tpl.edgeToBogie +
                                            tpl.bogieOffsets.reduce(
                                                (a, b) => a + b,
                                                0
                                            ) +
                                            tpl.bogieToEdge}
                                        m
                                    </span>
                                </div>
                                <div className="flex gap-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => {
                                            const newCar =
                                                carStockManager.createCar(
                                                    [...tpl.bogieOffsets],
                                                    tpl.edgeToBogie,
                                                    tpl.bogieToEdge,
                                                    tpl.type
                                                );
                                            if (tpl.image) {
                                                carImageRegistry.set(
                                                    newCar.id,
                                                    tpl.image.src
                                                );
                                            }
                                        }}
                                    >
                                        <Plus className="size-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                            onCarTemplatesChange(prev =>
                                                prev.filter(t => t.id !== tpl.id)
                                            )
                                        }
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </DraggablePanel>
    );
}

function DepotCarRow({
    entry,
    carStockManager,
}: {
    entry: CarStockEntry;
    carStockManager: CarStockManager;
}) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const startEditing = useCallback(() => {
        setEditValue(entry.car.name);
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [entry.car.name]);

    const commitRename = useCallback(() => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== entry.car.name) {
            carStockManager.renameCar(entry.id, trimmed);
        }
        setIsEditing(false);
    }, [editValue, entry.car.name, entry.id, carStockManager]);

    return (
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-2.5 py-1.5">
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 min-w-0">
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
                        />
                    ) : (
                        <span
                            className="text-foreground font-mono text-xs truncate"
                            title={t('renameCar')}
                            onDoubleClick={startEditing}
                        >
                            {entry.car.name}
                        </span>
                    )}
                    {!isEditing && (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={startEditing}
                        >
                            <Pencil className="size-2.5" />
                        </Button>
                    )}
                </div>
                <span className="text-muted-foreground text-[10px]">
                    {t(`carType_${entry.car.type}`)}
                    {' · '}
                    {t('bogieCount', { count: entry.car.bogieOffsets().length + 1 })}
                    {' · '}
                    {entry.car.edgeToBogie +
                        entry.car
                            .bogieOffsets()
                            .reduce((a, b) => a + b, 0) +
                        entry.car.bogieToEdge}
                    m
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => carStockManager.removeCar(entry.id)}
            >
                <Trash2 className="size-3" />
            </Button>
        </div>
    );
}
