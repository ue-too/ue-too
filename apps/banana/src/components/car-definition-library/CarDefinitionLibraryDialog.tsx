import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Trash2, X } from '@/assets/icons';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    type CarDefinitionMetadata,
    type StoredCarDefinition,
    getCarDefinitionStorage,
} from '@/storage';

function formatRelativeTime(
    timestamp: number,
    t: (key: string, opts?: Record<string, unknown>) => string
): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return t('justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('daysAgo', { count: days });
}

type CarDefinitionLibraryDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the user picks a saved entry. Dialog closes afterwards. */
    onPick: (stored: StoredCarDefinition) => void;
    /** Highlight this entry if present (e.g. the currently loaded one in the train editor). */
    highlightedId?: string | null;
};

export function CarDefinitionLibraryDialog({
    open,
    onOpenChange,
    onPick,
    highlightedId,
}: CarDefinitionLibraryDialogProps) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState<CarDefinitionMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await getCarDefinitionStorage().listCarDefinitions();
            setEntries(list);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            setConfirmDeleteId(null);
            refresh();
        }
    }, [open, refresh]);

    const handleSelect = useCallback(
        async (id: string) => {
            const stored =
                await getCarDefinitionStorage().loadCarDefinition(id);
            if (!stored) {
                await refresh();
                return;
            }
            onPick(stored);
            onOpenChange(false);
        },
        [onPick, onOpenChange, refresh]
    );

    const handleDelete = useCallback(
        async (id: string) => {
            await getCarDefinitionStorage().deleteCarDefinition(id);
            setConfirmDeleteId(null);
            await refresh();
        },
        [refresh]
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('carDefinitionLibraryTitle')}</DialogTitle>
                    <DialogDescription>
                        {t('carDefinitionLibraryDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
                    {entries.map(entry => {
                        const confirming = confirmDeleteId === entry.id;
                        const highlighted = entry.id === highlightedId;
                        return (
                            <div
                                key={entry.id}
                                className={cn(
                                    'hover:bg-accent/50 flex items-center gap-3 rounded-md border p-3 transition-colors',
                                    highlighted && 'border-primary bg-accent/30'
                                )}
                            >
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
                                    onClick={() => handleSelect(entry.id)}
                                >
                                    <span className="truncate text-sm font-medium">
                                        {entry.name}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {formatRelativeTime(entry.updatedAt, t)}
                                    </span>
                                </button>

                                {confirming ? (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleDelete(entry.id);
                                            }}
                                        >
                                            {t('confirmDelete')}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            onClick={e => {
                                                e.stopPropagation();
                                                setConfirmDeleteId(null);
                                            }}
                                        >
                                            <X className="size-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                                        onClick={e => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(entry.id);
                                        }}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}

                    {!loading && entries.length === 0 && (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            {t('noSavedCarDefinitions')}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
