import { Activity, Hash, Landmark, ListOrdered, TrainFront, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

type DebugPanelProps = {
    showJointNumbers: boolean;
    onShowJointNumbersChange: (value: boolean) => void;
    showSegmentIds: boolean;
    onShowSegmentIdsChange: (value: boolean) => void;
    showFormationIds: boolean;
    onShowFormationIdsChange: (value: boolean) => void;
    showStationStops: boolean;
    onShowStationStopsChange: (value: boolean) => void;
    showStationLocations: boolean;
    onShowStationLocationsChange: (value: boolean) => void;
    showStats: boolean;
    onShowStatsChange: (value: boolean) => void;
    onClose: () => void;
};

export function DebugPanel({
    showJointNumbers,
    onShowJointNumbersChange,
    showSegmentIds,
    onShowSegmentIdsChange,
    showFormationIds,
    onShowFormationIdsChange,
    showStationStops,
    onShowStationStopsChange,
    showStationLocations,
    onShowStationLocationsChange,
    showStats,
    onShowStatsChange,
    onClose,
}: DebugPanelProps) {
    const { t } = useTranslation();
    return (
        <DraggablePanel
            title={t('debug')}
            onClose={onClose}
            className="w-56"
        >
            <Separator className="mb-2" />
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('jointNumbers')}</span>
                    <Toggle
                        size="sm"
                        pressed={showJointNumbers}
                        onPressedChange={onShowJointNumbersChange}
                        aria-label="Toggle joint numbers"
                    >
                        <Hash className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('segmentIds')}</span>
                    <Toggle
                        size="sm"
                        pressed={showSegmentIds}
                        onPressedChange={onShowSegmentIdsChange}
                        aria-label="Toggle segment IDs"
                    >
                        <ListOrdered className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('formationIds')}</span>
                    <Toggle
                        size="sm"
                        pressed={showFormationIds}
                        onPressedChange={onShowFormationIdsChange}
                        aria-label="Toggle formation IDs"
                    >
                        <TrainFront className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('stationStops')}</span>
                    <Toggle
                        size="sm"
                        pressed={showStationStops}
                        onPressedChange={onShowStationStopsChange}
                        aria-label="Toggle station stop positions"
                    >
                        <MapPin className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('stationLocations')}</span>
                    <Toggle
                        size="sm"
                        pressed={showStationLocations}
                        onPressedChange={onShowStationLocationsChange}
                        aria-label="Toggle station locations"
                    >
                        <Landmark className="size-3.5" />
                    </Toggle>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('fpsStats')}</span>
                    <Toggle
                        size="sm"
                        pressed={showStats}
                        onPressedChange={onShowStatsChange}
                        aria-label="Toggle FPS stats"
                    >
                        <Activity className="size-3.5" />
                    </Toggle>
                </div>
            </div>
        </DraggablePanel>
    );
}
