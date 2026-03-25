import { Mountain, Snowflake } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

type TerrainControlProps = {
    visible: boolean;
    onVisibleChange: (value: boolean) => void;
    opacity: number;
    onOpacityChange: (value: number) => void;
    whiteOcclusion: boolean;
    onWhiteOcclusionChange: (value: boolean) => void;
};

export function TerrainControl({
    visible,
    onVisibleChange,
    opacity,
    onOpacityChange,
    whiteOcclusion,
    onWhiteOcclusionChange,
}: TerrainControlProps) {
    const { t } = useTranslation();
    return (
        <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onVisibleChange(!visible)}
                            className="flex items-center justify-center"
                        >
                            <Mountain
                                className={`size-4 ${visible ? 'text-foreground' : 'text-muted-foreground/40'}`}
                            />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(opacity * 100)}
                            onChange={e =>
                                onOpacityChange(Number(e.target.value) / 100)
                            }
                            disabled={!visible}
                            className="h-20 w-1.5 appearance-none [writing-mode:vertical-lr] disabled:opacity-30"
                        />
                        <span className="text-muted-foreground w-10 shrink-0 text-center text-[10px] tabular-nums">
                            {Math.round(opacity * 100)}%
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                    {t('terrainOpacity')}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={() => onWhiteOcclusionChange(!whiteOcclusion)}
                        className="flex items-center justify-center"
                    >
                        <Snowflake
                            className={`size-4 ${whiteOcclusion ? 'text-foreground' : 'text-muted-foreground/40'}`}
                        />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    {t('whiteOcclusion')}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
