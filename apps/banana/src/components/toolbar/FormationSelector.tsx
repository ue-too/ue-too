import { TrainFront } from '@/assets/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FormationManager } from '@/trains/formation-manager';

const NONE = '__none__';
import type { TrainPlacementEngine } from '@/trains/input-state-machine/train-kmt-state-machine';

type FormationSelectorProps = {
    formationManager: FormationManager;
    trainPlacementEngine: TrainPlacementEngine;
};

export function FormationSelector({
    formationManager,
    trainPlacementEngine,
}: FormationSelectorProps) {
    const { t } = useTranslation();
    const [formations, setFormations] = useState(formationManager.getFormations());
    // Derive selected value from the engine so it stays in sync after placement resets
    const selectedId = trainPlacementEngine.pendingFormation?.id ?? '';

    useEffect(() => {
        return formationManager.subscribe(() => {
            setFormations(formationManager.getFormations());
        });
    }, [formationManager]);

    return (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="bg-background/80 flex items-center gap-2 rounded-xl border p-2 shadow-lg backdrop-blur-sm">
                <TrainFront className="text-muted-foreground size-4" />
                <span className="text-muted-foreground whitespace-nowrap text-xs font-medium">
                    {t('formation')}
                </span>
                <Select
                    value={selectedId || NONE}
                    onValueChange={(val) => {
                        const formation = val === NONE
                            ? null
                            : formationManager.getFormation(val);
                        trainPlacementEngine.setFormation(formation);
                    }}
                >
                    <SelectTrigger className="min-w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>{t('defaultFormation')}</SelectItem>
                        {formations.map(entry => (
                            <SelectItem key={entry.id} value={entry.id}>
                                {entry.formation.name} (
                                {t('car', { count: entry.formation.flatCars().length })}
                                )
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
