import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function ToolbarButton({
    tooltip,
    active,
    destructive,
    destructiveMuted,
    disabled,
    onClick,
    children,
}: {
    tooltip: string;
    active?: boolean;
    destructive?: boolean;
    /** When true, normal state uses darker red; active uses bright red */
    destructiveMuted?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    const variant = destructive ? 'destructive' : active ? 'default' : 'ghost';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant={variant}
                    size="icon-lg"
                    disabled={disabled}
                    onClick={onClick}
                    className={
                        destructiveMuted && !active
                            ? 'text-destructive/70 hover:text-destructive hover:bg-destructive/10'
                            : undefined
                    }
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    );
}
