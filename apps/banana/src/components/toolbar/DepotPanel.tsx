import { Plus, Trash2 } from 'lucide-react';
import { type Dispatch, type SetStateAction, useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { CarStockManager } from '@/trains/car-stock-manager';
import type { CarStockEntry } from '@/trains/car-stock-manager';
import type { CarImageRegistry } from '@/trains/car-image-registry';
import type { CarTemplate } from '@/trains/car-template';

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

    return (
        <DraggablePanel
            title={t('depot')}
            onClose={onClose}
            className="w-56"
            headerActions={
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => carStockManager.createCar()}
                >
                    <Plus className="size-3.5" />
                </Button>
            }
        >
            <Separator className="mb-2" />
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {availableCars.length === 0 ? (
                    <span className="text-muted-foreground py-4 text-center text-xs">
                        {t('noCarsInStock')}
                    </span>
                ) : (
                    availableCars.map(entry => (
                        <div
                            key={entry.id}
                            className="bg-muted/50 flex items-center justify-between rounded-lg px-2.5 py-1.5"
                        >
                            <div className="flex flex-col">
                                <span className="text-foreground font-mono text-xs">
                                    {entry.id}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
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
                                onClick={() =>
                                    carStockManager.removeCar(entry.id)
                                }
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
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
                                                    tpl.bogieToEdge
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
