import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, X } from '@/assets/icons';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SceneMetadata } from '@/storage';

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

type SceneCardProps = {
    scene: SceneMetadata;
    isActive: boolean;
    confirmingDelete: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onCancelDelete: () => void;
    onRename: (name: string) => void;
};

export function SceneCard({
    scene,
    isActive,
    confirmingDelete,
    onSelect,
    onDelete,
    onCancelDelete,
    onRename,
}: SceneCardProps) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(scene.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEditing = () => {
        setEditName(scene.name);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitRename = () => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== scene.name) {
            onRename(trimmed);
        }
        setEditing(false);
    };

    return (
        <div
            className={cn(
                'hover:bg-accent/50 flex items-center gap-3 rounded-md border p-3 transition-colors',
                isActive && 'border-primary bg-accent/30'
            )}
        >
            <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
                onClick={editing ? undefined : onSelect}
            >
                {editing ? (
                    <input
                        ref={inputRef}
                        className="bg-background w-full rounded border px-1 text-sm font-medium"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditing(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate text-sm font-medium">
                        {scene.name}
                    </span>
                )}
                <span className="text-muted-foreground text-xs">
                    {formatRelativeTime(scene.updatedAt, t)}
                    {isActive && (
                        <span className="text-primary ml-2 font-medium">
                            {t('lastActive')}
                        </span>
                    )}
                </span>
            </button>

            {confirmingDelete ? (
                <div className="flex items-center gap-1">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        {t('confirmDelete')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelDelete();
                        }}
                    >
                        <X className="size-3" />
                    </Button>
                </div>
            ) : (
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground size-7 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            startEditing();
                        }}
                    >
                        <Pencil className="size-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
