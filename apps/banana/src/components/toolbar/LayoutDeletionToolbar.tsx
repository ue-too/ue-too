import { BulldozerIcon } from '@/assets/icons/bulldozer';
import { TOOLBAR_LEFT } from '@/components/toolbar/types';
import { cn } from '@/lib/utils';

import { ToolbarButton } from './ToolbarButton';

type LayoutDeletionToolbarProps = {
    isDeletionMode: boolean;
    onToggle: () => void;
};

export function LayoutDeletionToolbar({
    isDeletionMode,
    onToggle,
}: LayoutDeletionToolbarProps) {
    return (
        <div
            className={cn(
                'pointer-events-auto absolute bottom-3',
                TOOLBAR_LEFT
            )}
        >
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                <ToolbarButton
                    tooltip={
                        isDeletionMode ? 'End Deletion' : 'Delete Track'
                    }
                    active={isDeletionMode}
                    destructive={isDeletionMode}
                    destructiveMuted
                    onClick={onToggle}
                >
                    <BulldozerIcon />
                </ToolbarButton>
            </div>
        </div>
    );
}
