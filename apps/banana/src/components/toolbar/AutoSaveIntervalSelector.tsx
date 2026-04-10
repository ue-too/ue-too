import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Check, Timer } from '@/assets/icons';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSceneStore } from '@/stores/scene-store';

const INTERVAL_OPTIONS = [
    { labelKey: 'autoSave1Min', value: 60_000 },
    { labelKey: 'autoSave3Min', value: 180_000 },
    { labelKey: 'autoSave5Min', value: 300_000 },
    { labelKey: 'autoSave10Min', value: 600_000 },
] as const;

type AutoSaveIntervalSelectorProps = {
    show: boolean;
    onShowChange: (show: boolean) => void;
    /** Custom trigger element — overrides the default icon button. */
    trigger?: ReactElement;
};

export function AutoSaveIntervalSelector({
    show,
    onShowChange,
    trigger,
}: AutoSaveIntervalSelectorProps) {
    const { t } = useTranslation();
    const autoSaveIntervalMs = useSceneStore(s => s.autoSaveIntervalMs);
    const setAutoSaveIntervalMs = useSceneStore(s => s.setAutoSaveIntervalMs);

    return (
        <DropdownMenu open={show} onOpenChange={onShowChange}>
            <DropdownMenuTrigger asChild>
                {trigger ?? (
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className={cn(
                            "[&_svg:not([class*='size-'])]:size-5",
                            show && 'bg-accent'
                        )}
                    >
                        <Timer />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={12}
                className="bg-background/80 backdrop-blur-sm"
            >
                {INTERVAL_OPTIONS.map(opt => (
                    <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setAutoSaveIntervalMs(opt.value)}
                    >
                        <Check
                            className={cn(
                                'size-4',
                                autoSaveIntervalMs !== opt.value && 'invisible'
                            )}
                        />
                        {t(opt.labelKey)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
