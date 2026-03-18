import { useTranslation } from 'react-i18next';

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
                <select
                    className="bg-background h-7 rounded-md border px-2 text-xs"
                    value={preset}
                    onChange={e =>
                        onPresetChange(e.target.value as BuildingPreset)
                    }
                >
                    <option value="small">{t('small')}</option>
                    <option value="medium">{t('medium')}</option>
                    <option value="large">{t('large')}</option>
                    <option value="l-shape">{t('lShape')}</option>
                </select>
                <select
                    className="bg-background h-7 rounded-md border px-2 text-xs"
                    value={elevation}
                    onChange={e =>
                        onElevationChange(Number(e.target.value) as ELEVATION)
                    }
                >
                    <option value={ELEVATION.GROUND}>{t('ground')}</option>
                    <option value={ELEVATION.ABOVE_1}>{t('above1')}</option>
                    <option value={ELEVATION.ABOVE_2}>{t('above2')}</option>
                    <option value={ELEVATION.ABOVE_3}>{t('above3')}</option>
                </select>
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
