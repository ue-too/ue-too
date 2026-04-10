import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
                    className={cn(
                        "[&_svg:not([class*='size-'])]:size-5",
                        !active &&
                            !destructive &&
                            'hover:bg-foreground/15 hover:text-foreground dark:hover:bg-foreground/20',
                        destructiveMuted &&
                            !active &&
                            'text-destructive/70 hover:text-destructive hover:bg-destructive/10'
                    )}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    );
}
