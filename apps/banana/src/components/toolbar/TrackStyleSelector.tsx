import type { TrackStyle } from '@/trains/tracks/types';

type TrackStyleSelectorProps = {
    value: TrackStyle;
    onChange: (style: TrackStyle) => void;
    electrified: boolean;
    onElectrifiedChange: (value: boolean) => void;
    ballastWidth: number;
    onBallastWidthChange: (value: number) => void;
    projectionBuffer: number;
    onProjectionBufferChange: (value: number) => void;
};

export function TrackStyleSelector({
    value,
    onChange,
    electrified,
    onElectrifiedChange,
    ballastWidth,
    onBallastWidthChange,
    projectionBuffer,
    onProjectionBufferChange,
}: TrackStyleSelectorProps) {
    return (
        <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
            <div className="bg-background/80 flex flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                        Track Style
                    </span>
                    <select
                        className="bg-background h-7 rounded-md border px-2 text-xs"
                        value={value}
                        onChange={e => {
                            onChange(e.target.value as TrackStyle);
                            e.target.blur();
                        }}
                    >
                        <option value="ballasted">Ballasted</option>
                        <option value="slab">Slab (Elevated)</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={electrified}
                            onChange={e => e.target.blur()}
                            onClick={() => onElectrifiedChange(!electrified)}
                            className="size-3.5 rounded"
                        />
                        <span className="text-foreground">Electrified</span>
                    </label>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                        Ballast Width
                    </span>
                    <input
                        type="range"
                        min="0.5"
                        max="4"
                        step="0.1"
                        value={ballastWidth}
                        onChange={e => onBallastWidthChange(Number(e.target.value))}
                        onPointerUp={e => (e.target as HTMLInputElement).blur()}
                        className="h-1.5 w-24 cursor-pointer"
                    />
                    <span className="text-muted-foreground text-center text-[10px]">
                        {ballastWidth.toFixed(1)}m
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                        Snap Buffer
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
