import { Activity, Eye, Hash, Landmark, Link2, ListOrdered, TrainFront, MapPin } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
    showProximityLines: boolean;
    onShowProximityLinesChange: (value: boolean) => void;
    showStats: boolean;
    onShowStatsChange: (value: boolean) => void;
    terrainXray: boolean;
    onTerrainXrayChange: (value: boolean) => void;
    onSpawnStressTest?: (count: number) => void;
    onThrottleAll?: (step: string) => void;
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
    showProximityLines,
    onShowProximityLinesChange,
    showStats,
    onShowStatsChange,
    terrainXray,
    onTerrainXrayChange,
    onSpawnStressTest,
    onThrottleAll,
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
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('proximityLines')}</span>
                    <Toggle
                        size="sm"
                        pressed={showProximityLines}
                        onPressedChange={onShowProximityLinesChange}
                        aria-label="Toggle coupling proximity lines"
                    >
                        <Link2 className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{t('terrainXray')}</span>
                    <Toggle
                        size="sm"
                        pressed={terrainXray}
                        onPressedChange={onTerrainXrayChange}
                        aria-label="Toggle terrain X-ray"
                    >
                        <Eye className="size-3.5" />
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
                {onSpawnStressTest && (
                    <>
                        <Separator />
                        <span className="text-muted-foreground text-[10px]">
                            Stress Test
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onSpawnStressTest(30)}
                            >
                                30 trains
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onSpawnStressTest(50)}
                            >
                                50 trains
                            </Button>
                        </div>
                    </>
                )}
                {onThrottleAll && (
                    <>
                        <span className="text-muted-foreground text-[10px]">
                            Throttle All
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onThrottleAll('N')}
                            >
                                N
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onThrottleAll('p1')}
                            >
                                P1
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onThrottleAll('p3')}
                            >
                                P3
                            </Button>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => onThrottleAll('p5')}
                            >
                                P5
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </DraggablePanel>
    );
}
