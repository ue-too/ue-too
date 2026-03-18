import { useTranslation } from 'react-i18next';

import type { TrackStyle } from '@/trains/tracks/types';

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
}: TrackStyleSelectorProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
            <div className="bg-background/80 flex flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                        {t('trackStyle')}
                    </span>
                    <select
                        className="bg-background h-7 rounded-md border px-2 text-xs"
                        value={value}
                        onChange={e => {
                            onChange(e.target.value as TrackStyle);
                            e.target.blur();
                        }}
                    >
                        <option value="ballasted">{t('ballasted')}</option>
                        <option value="slab">{t('slabElevated')}</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={electrified}
                            onChange={e => e.target.blur()}
                            onClick={() => onElectrifiedChange(!electrified)}
                            className="size-3.5 rounded"
                        />
                        <span className="text-foreground">{t('electrified')}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
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
                        onChange={e => onProjectionBufferChange(Number(e.target.value))}
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
