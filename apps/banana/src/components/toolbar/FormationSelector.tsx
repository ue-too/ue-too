import { TrainFront } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import type { FormationManager } from '@/trains/formation-manager';
import type { TrainPlacementEngine } from '@/trains/input-state-machine/train-kmt-state-machine';

type FormationSelectorProps = {
    formationManager: FormationManager;
    trainPlacementEngine: TrainPlacementEngine;
    selectedFormationId: string | null;
    onFormationChange: (id: string | null) => void;
};

export function FormationSelector({
    formationManager,
    trainPlacementEngine,
    selectedFormationId,
    onFormationChange,
}: FormationSelectorProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="bg-background/80 flex items-center gap-2 rounded-xl border p-2 shadow-lg backdrop-blur-sm">
                <TrainFront className="text-muted-foreground size-4" />
                <span className="text-muted-foreground whitespace-nowrap text-xs font-medium">
                    {t('formation')}
                </span>
                <select
                    className="bg-background h-7 min-w-[160px] rounded-md border px-2 text-xs"
                    value={selectedFormationId ?? ''}
                    onChange={e => {
                        const val = e.target.value || null;
                        onFormationChange(val);
                        const formation = val
                            ? formationManager.getFormation(val)
                            : null;
                        trainPlacementEngine.setFormation(formation);
                    }}
                >
                    <option value="">{t('defaultFormation')}</option>
                    {formationManager.getFormations().map(entry => (
                        <option key={entry.id} value={entry.id}>
                            {entry.formation.name} (
                            {t('car', { count: entry.formation.flatCars().length })}
                            )
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
