import { useTranslation } from 'react-i18next';

import {
    FolderOpen,
    Landmark,
    Pencil,
    Settings2,
    TrainFront,
} from '@/assets/icons';
import type { ToolbarCategory } from '@/stores/toolbar-ui-store';

import { ToolbarButton } from './ToolbarButton';

type CategoryRailProps = {
    activeCategory: ToolbarCategory | null;
    modeHolderCategory: ToolbarCategory | null;
    onToggleCategory: (category: ToolbarCategory) => void;
};

export function CategoryRail({
    activeCategory,
    modeHolderCategory,
    onToggleCategory,
}: CategoryRailProps) {
    const { t } = useTranslation();

    const entries: Array<{
        id: ToolbarCategory;
        label: string;
        icon: React.ReactNode;
    }> = [
        {
            id: 'drawing',
            label: t('toolbarCategoryDrawing'),
            icon: <Pencil />,
        },
        {
            id: 'trains',
            label: t('toolbarCategoryTrains'),
            icon: <TrainFront />,
        },
        {
            id: 'infra',
            label: t('toolbarCategoryInfra'),
            icon: <Landmark />,
        },
        {
            id: 'scene',
            label: t('toolbarCategoryScene'),
            icon: <FolderOpen />,
        },
        {
            id: 'debug',
            label: t('toolbarCategoryDebug'),
            icon: <Settings2 />,
        },
    ];

    return (
        <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
            {entries.map(entry => (
                <div key={entry.id} className="relative">
                    <ToolbarButton
                        tooltip={entry.label}
                        active={activeCategory === entry.id}
                        onClick={() => onToggleCategory(entry.id)}
                    >
                        {entry.icon}
                    </ToolbarButton>
                    {modeHolderCategory === entry.id && (
                        <span
                            className="ring-background pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full bg-orange-500 ring-2"
                            aria-hidden
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
