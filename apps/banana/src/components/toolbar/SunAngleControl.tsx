import { Sun } from 'lucide-react';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

type SunAngleControlProps = {
    value: number;
    onChange: (value: number) => void;
};

export function SunAngleControl({ value, onChange }: SunAngleControlProps) {
    return (
        <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1">
                        <Sun className="text-muted-foreground size-4" />
                        <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={value}
                            onChange={e => onChange(Number(e.target.value))}
                            className="h-20 w-1.5 appearance-none [writing-mode:vertical-lr]"
                        />
                        <span className="text-muted-foreground text-[10px]">
                            {value}°
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">Sun Angle</TooltipContent>
            </Tooltip>
        </div>
    );
}
