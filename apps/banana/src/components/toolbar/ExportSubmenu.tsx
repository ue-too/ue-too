import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import {
    Download,
    ExportSceneIcon,
    ExportTrackIcon,
    ExportTrainIcon,
    Gauge,
    ImportSceneIcon,
    ImportTrackIcon,
    ImportTrainIcon,
    Mountain,
} from '@/assets/icons';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ExportSubmenuProps = {
    show: boolean;
    onShowChange: (show: boolean) => void;
    onExportTracks: () => void;
    onImportTracks: () => void;
    onExportTrains: () => void;
    onImportTrains: () => void;
    onExportAll: () => void;
    onImportAll: () => void;
    onImportTerrain: () => void;
    onImportCarDefinition: () => void;
    onImportCarDefinitionFromLibrary: () => void;
    /** Custom trigger element — overrides the default icon button. */
    trigger?: ReactElement;
};

export function ExportSubmenu({
    show,
    onShowChange,
    onExportTracks,
    onImportTracks,
    onExportTrains,
    onImportTrains,
    onExportAll,
    onImportAll,
    onImportTerrain,
    onImportCarDefinition,
    onImportCarDefinitionFromLibrary,
    trigger,
}: ExportSubmenuProps) {
    const { t } = useTranslation();

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
                        <Download />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={12}
                className="bg-background/80 backdrop-blur-sm"
            >
                <DropdownMenuItem onClick={onExportTracks}>
                    <ExportTrackIcon />
                    {t('exportTracksStations')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onImportTracks}>
                    <ImportTrackIcon />
                    {t('importTracksStations')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportTrains}>
                    <ExportTrainIcon />
                    {t('exportTrains')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onImportTrains}>
                    <ImportTrainIcon />
                    {t('importTrains')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExportAll}>
                    <ExportSceneIcon />
                    {t('exportAll')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onImportAll}>
                    <ImportSceneIcon />
                    {t('importAll')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onImportTerrain}>
                    <Mountain />
                    {t('importTerrain')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onImportCarDefinition}>
                    <Gauge />
                    {t('importCarDefinitionFromEditor')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onImportCarDefinitionFromLibrary}>
                    <Gauge />
                    {t('importCarDefinitionFromLibrary')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
