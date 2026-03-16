import { Download, Gauge } from 'lucide-react';
import { useRef, useEffect } from 'react';

import { ExportSceneIcon } from '@/assets/icons/export-scene';
import { ExportTrackIcon } from '@/assets/icons/export-track';
import { ExportTrainIcon } from '@/assets/icons/export-train';
import { ImportSceneIcon } from '@/assets/icons/import-scene';
import { ImportTrackIcon } from '@/assets/icons/import-track';
import { ImportTrainIcon } from '@/assets/icons/import-train';
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
    onImportCarDefinition,
}: ExportSubmenuProps) {
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
                    <ToolbarButton tooltip="Export Tracks" onClick={onExportTracks}>
                        <ExportTrackIcon />
                    </ToolbarButton>
                    <ToolbarButton tooltip="Import Tracks" onClick={onImportTracks}>
                        <ImportTrackIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Export Trains (cars, formations, positions)"
                        onClick={onExportTrains}
                    >
                        <ExportTrainIcon />
                    </ToolbarButton>
                    <ToolbarButton tooltip="Import Trains" onClick={onImportTrains}>
                        <ImportTrainIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Export All (tracks + trains)"
                        onClick={onExportAll}
                    >
                        <ExportSceneIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Import All (tracks + trains)"
                        onClick={onImportAll}
                    >
                        <ImportSceneIcon />
                    </ToolbarButton>
                    <Separator />
                    <ToolbarButton
                        tooltip="Import Car Definition (from Train Editor)"
                        onClick={onImportCarDefinition}
                    >
                        <Gauge />
                    </ToolbarButton>
                </div>
            )}
        </div>
    );
}
