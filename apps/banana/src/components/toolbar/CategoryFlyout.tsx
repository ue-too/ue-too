import type { ReactNode, RefObject } from 'react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToolbarCategory } from '@/stores/toolbar-ui-store';

export type FlyoutRow =
    | {
          kind: 'button';
          id: string;
          icon: ReactNode;
          label: string;
          active?: boolean;
          disabled?: boolean;
          onClick: () => void;
      }
    | {
          kind: 'custom';
          id: string;
          node: ReactNode;
      };

export type FlyoutCategory = {
    title: string;
    rows: FlyoutRow[];
};

type CategoryFlyoutProps = {
    category: ToolbarCategory | null;
    categories: Record<ToolbarCategory, FlyoutCategory>;
    onClose: () => void;
    shellRef: RefObject<HTMLElement | null>;
};

export function CategoryFlyout({
    category,
    categories,
    onClose,
    shellRef,
}: CategoryFlyoutProps) {
    useEffect(() => {
        if (!category) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as Element | null;
            if (!target) return;
            if (shellRef.current?.contains(target)) return;
            // Radix dropdowns portal their content outside the shell.
            if (target.closest('[data-radix-popper-content-wrapper]')) return;
            if (target.closest('[role="menu"]')) return;
            onClose();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [category, onClose, shellRef]);

    if (!category) return null;

    const { title, rows } = categories[category];

    return (
        <div
            className="bg-background/80 absolute top-0 left-full ml-3 flex w-60 flex-col rounded-xl border shadow-lg backdrop-blur-sm"
            role="menu"
            aria-label={title}
        >
            <div className="text-muted-foreground border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase">
                {title}
            </div>
            <div className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto p-1.5">
                {rows.map(row =>
                    row.kind === 'button' ? (
                        <Button
                            key={row.id}
                            variant={row.active ? 'default' : 'ghost'}
                            size="sm"
                            disabled={row.disabled}
                            onClick={row.onClick}
                            className={cn(
                                "h-9 w-full justify-start gap-2.5 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-4",
                                !row.active &&
                                    'hover:bg-foreground/15 hover:text-foreground dark:hover:bg-foreground/20'
                            )}
                        >
                            {row.icon}
                            <span className="truncate">{row.label}</span>
                        </Button>
                    ) : (
                        <div key={row.id} className="flex w-full items-center">
                            {row.node}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
