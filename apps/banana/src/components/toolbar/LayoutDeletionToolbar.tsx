import { useTranslation } from 'react-i18next';

import { BulldozerIcon } from '@/assets/icons';
import { ToolbarButton } from './ToolbarButton';

type LayoutDeletionToolbarProps = {
    isDeletionMode: boolean;
    onToggle: () => void;
};

export function LayoutDeletionToolbar({
    isDeletionMode,
    onToggle,
}: LayoutDeletionToolbarProps) {
    const { t } = useTranslation();
    return (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">

            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                <ToolbarButton
                    tooltip={
                        isDeletionMode ? t('endDeletion') : t('deleteTrack')
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
