import { useTranslation } from 'react-i18next';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { TrackStyle } from '@/trains/tracks/types';

import { GaugeSelector } from './GaugeSelector';

type TrackStyleSelectorProps = {
    value: TrackStyle;
    onChange: (style: TrackStyle) => void;
    electrified: boolean;
    onElectrifiedChange: (value: boolean) => void;
    projectionBuffer: number;
    onProjectionBufferChange: (value: number) => void;
    bed: boolean;
    onBedChange: (value: boolean) => void;
    bedWidth: number;
    onBedWidthChange: (value: number) => void;
    gaugePresetId: string;
    onGaugePresetChange: (presetId: string) => void;
    customGaugeWidth: number | null;
    onCustomGaugeChange: (width: number) => void;
};

export function TrackStyleSelector({
    value,
    onChange,
    electrified,
    onElectrifiedChange,
    projectionBuffer,
    onProjectionBufferChange,
    bed,
    onBedChange,
    bedWidth,
    onBedWidthChange,
    gaugePresetId,
    onGaugePresetChange,
    customGaugeWidth,
    onCustomGaugeChange,
}: TrackStyleSelectorProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
            <div className="bg-background/80 flex flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                <GaugeSelector
                    gaugePresetId={gaugePresetId}
                    onGaugePresetChange={onGaugePresetChange}
                    customGaugeWidth={customGaugeWidth}
                    onCustomGaugeChange={onCustomGaugeChange}
                />
                <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                        {t('trackStyle')}
                    </span>
                    <Select
                        value={value}
                        onValueChange={val => onChange(val as TrackStyle)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ballasted">
                                {t('ballasted')}
                            </SelectItem>
                            <SelectItem value="slab">
                                {t('slabElevated')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input
                            type="checkbox"
                            checked={electrified}
                            onChange={e => e.target.blur()}
                            onClick={() => onElectrifiedChange(!electrified)}
                            className="size-3.5 rounded"
                        />
                        <span className="text-foreground">
                            {t('electrified')}
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input
                            type="checkbox"
                            checked={bed}
                            onChange={e => e.target.blur()}
                            onClick={() => onBedChange(!bed)}
                            className="size-3.5 rounded"
                        />
                        <span className="text-foreground">{t('bed')}</span>
                    </label>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                        {t('bedWidth')}
                    </span>
                    <input
                        type="range"
                        min="1"
                        max="6"
                        step="0.1"
                        value={bedWidth}
                        onChange={e => onBedWidthChange(Number(e.target.value))}
                        onPointerUp={e => (e.target as HTMLInputElement).blur()}
                        className="h-1.5 w-24 cursor-pointer"
                    />
                    <span className="text-muted-foreground text-center text-[10px]">
                        {bedWidth.toFixed(1)}m
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                        {t('snapBuffer')}
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={projectionBuffer}
                        onChange={e =>
                            onProjectionBufferChange(Number(e.target.value))
                        }
                        onPointerUp={e => (e.target as HTMLInputElement).blur()}
                        className="h-1.5 w-24 cursor-pointer"
                    />
                    <span className="text-muted-foreground text-center text-[10px]">
                        {projectionBuffer.toFixed(1)}m
                    </span>
                </div>
            </div>
        </div>
    );
}
