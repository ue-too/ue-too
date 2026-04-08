import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BuildingPreset } from '@/buildings/types';
import { ELEVATION } from '@/trains/tracks/types';

type BuildingOptionsPanelProps = {
    preset: BuildingPreset;
    onPresetChange: (preset: BuildingPreset) => void;
    elevation: ELEVATION;
    onElevationChange: (elevation: ELEVATION) => void;
    height: number;
    onHeightChange: (height: number) => void;
};

export function BuildingOptionsPanel({
    preset,
    onPresetChange,
    elevation,
    onElevationChange,
    height,
    onHeightChange,
}: BuildingOptionsPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
            <div className="bg-background/80 flex flex-col gap-2 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                <span className="text-muted-foreground text-xs font-medium">
                    {t('building')}
                </span>
                <Select value={preset} onValueChange={(val) => onPresetChange(val as BuildingPreset)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="small">{t('small')}</SelectItem>
                        <SelectItem value="medium">{t('medium')}</SelectItem>
                        <SelectItem value="large">{t('large')}</SelectItem>
                        <SelectItem value="l-shape">{t('lShape')}</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={String(elevation)} onValueChange={(val) => onElevationChange(Number(val) as ELEVATION)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={String(ELEVATION.GROUND)}>{t('ground')}</SelectItem>
                        <SelectItem value={String(ELEVATION.ABOVE_1)}>{t('above1')}</SelectItem>
                        <SelectItem value={String(ELEVATION.ABOVE_2)}>{t('above2')}</SelectItem>
                        <SelectItem value={String(ELEVATION.ABOVE_3)}>{t('above3')}</SelectItem>
                    </SelectContent>
                </Select>
                <label className="flex flex-col gap-1 text-xs">
                    {t('height')}: {height} {t('level')}
                    <input
                        type="range"
                        min={0.5}
                        max={5}
                        step={0.5}
                        value={height}
                        onChange={e =>
                            onHeightChange(Number(e.target.value))
                        }
                        className="w-full"
                    />
                </label>
            </div>
        </div>
    );
}
