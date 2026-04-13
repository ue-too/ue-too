import { useTranslation } from 'react-i18next';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { GAUGE_PRESETS } from '@/trains/tracks/gauge-presets';

type GaugeSelectorProps = {
    gaugePresetId: string;
    onGaugePresetChange: (presetId: string) => void;
    customGaugeWidth: number | null;
    onCustomGaugeChange: (width: number) => void;
};

export function GaugeSelector({
    gaugePresetId,
    onGaugePresetChange,
    customGaugeWidth,
    onCustomGaugeChange,
}: GaugeSelectorProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium">
                {t('trackGauge')}
            </span>
            <Select
                value={gaugePresetId}
                onValueChange={val => onGaugePresetChange(val)}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {GAUGE_PRESETS.map(preset => (
                        <SelectItem key={preset.id} value={preset.id}>
                            {preset.name} ({preset.width}m)
                        </SelectItem>
                    ))}
                    <SelectItem value="custom">
                        {t('customGauge')}
                    </SelectItem>
                </SelectContent>
            </Select>
            {gaugePresetId === 'custom' && (
                <div className="flex flex-col gap-1">
                    <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.01"
                        value={customGaugeWidth ?? 1.0}
                        onChange={e =>
                            onCustomGaugeChange(Number(e.target.value))
                        }
                        onPointerUp={e =>
                            (e.target as HTMLInputElement).blur()
                        }
                        className="h-1.5 w-24 cursor-pointer"
                    />
                    <span className="text-muted-foreground text-center text-[10px]">
                        {(customGaugeWidth ?? 1.0).toFixed(3)}m
                    </span>
                </div>
            )}
        </div>
    );
}
