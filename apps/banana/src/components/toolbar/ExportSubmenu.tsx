import { useRef, useEffect } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { ToolbarButton } from './ToolbarButton';

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
}: ExportSubmenuProps) {
    const { t } = useTranslation();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const clearTimeoutAndShow = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        onShowChange(true);
    };

    const scheduleHide = (delay: number) => {
        timeoutRef.current = setTimeout(() => onShowChange(false), delay);
    };

    return (
        <div
            className="relative"
            onMouseEnter={clearTimeoutAndShow}
            onMouseLeave={() => scheduleHide(400)}
        >
            <Button
                variant="ghost"
                size="icon"
                className={cn(show && 'bg-accent')}
            >
                <Download />
            </Button>
            {show && (
                <div
                    className="bg-background/80 absolute top-0 left-full z-50 flex translate-x-4 flex-col gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
                    onMouseEnter={clearTimeoutAndShow}
                    onMouseLeave={() => scheduleHide(150)}
                >
                    <ToolbarButton tooltip={t('exportTracksStations')} onClick={onExportTracks}>
                        <ExportTrackIcon />
                    </ToolbarButton>
                    <ToolbarButton tooltip={t('importTracksStations')} onClick={onImportTracks}>
                        <ImportTrackIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={t('exportTrains')}
                        onClick={onExportTrains}
                    >
                        <ExportTrainIcon />
                    </ToolbarButton>
                    <ToolbarButton tooltip={t('importTrains')} onClick={onImportTrains}>
                        <ImportTrainIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={t('exportAll')}
                        onClick={onExportAll}
                    >
                        <ExportSceneIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={t('importAll')}
                        onClick={onImportAll}
                    >
                        <ImportSceneIcon />
                    </ToolbarButton>
                    <Separator />
                    <ToolbarButton
                        tooltip={t('importTerrain')}
                        onClick={onImportTerrain}
                    >
                        <Mountain />
                    </ToolbarButton>
                    <Separator />
                    <ToolbarButton
                        tooltip={t('importCarDefinitionFromEditor')}
                        onClick={onImportCarDefinition}
                    >
                        <Gauge />
                    </ToolbarButton>
                </div>
            )}
        </div>
    );
}
