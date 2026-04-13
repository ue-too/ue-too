import { Activity, ArrowLeftRight, CircleIcon, Crosshair, Eye, Gauge, Hash, Landmark, Link2, ListOrdered, OctagonXIcon, TrainFront, MapPin } from '@/assets/icons';
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
    showGaugeLabels: boolean;
    onShowGaugeLabelsChange: (value: boolean) => void;
    showFormationIds: boolean;
    onShowFormationIdsChange: (value: boolean) => void;
    showStationStops: boolean;
    onShowStationStopsChange: (value: boolean) => void;
    showStationLocations: boolean;
    onShowStationLocationsChange: (value: boolean) => void;
    showProximityLines: boolean;
    onShowProximityLinesChange: (value: boolean) => void;
    showBogies: boolean;
    onShowBogiesChange: (value: boolean) => void;
    showStats: boolean;
    onShowStatsChange: (value: boolean) => void;
    terrainXray: boolean;
    onTerrainXrayChange: (value: boolean) => void;
    onSpawnStressTest?: (count: number, startX?: number, startY?: number) => void;
    onThrottleAll?: (step: string) => void;
    onSwitchDirectionAll?: () => void;
    onBrakeAll?: (step: string) => void;
    stressStartX?: number;
    stressStartY?: number;
    onStressStartXChange?: (value: number) => void;
    onStressStartYChange?: (value: number) => void;
    onPickStressStart?: () => void;
    isPicking?: boolean;
    onGenerateTracks?: (count: number) => void;
    onClose: () => void;
};

export function DebugPanel({
    showJointNumbers,
    onShowJointNumbersChange,
    showSegmentIds,
    onShowSegmentIdsChange,
    showGaugeLabels,
    onShowGaugeLabelsChange,
    showFormationIds,
    onShowFormationIdsChange,
    showStationStops,
    onShowStationStopsChange,
    showStationLocations,
    onShowStationLocationsChange,
    showProximityLines,
    onShowProximityLinesChange,
    showBogies,
    onShowBogiesChange,
    showStats,
    onShowStatsChange,
    terrainXray,
    onTerrainXrayChange,
    onSpawnStressTest,
    onThrottleAll,
    onSwitchDirectionAll,
    onBrakeAll,
    stressStartX = 0,
    stressStartY = 0,
    onStressStartXChange,
    onStressStartYChange,
    onPickStressStart,
    isPicking = false,
    onGenerateTracks,
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
                    <span className="text-foreground">{t('gaugeLabels')}</span>
                    <Toggle
                        size="sm"
                        pressed={showGaugeLabels}
                        onPressedChange={onShowGaugeLabelsChange}
                        aria-label="Toggle gauge labels"
                    >
                        <Gauge className="size-3.5" />
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
                    <span className="text-foreground">{t('showBogies')}</span>
                    <Toggle
                        size="sm"
                        pressed={showBogies}
                        onPressedChange={onShowBogiesChange}
                        aria-label="Toggle bogies rendering"
                    >
                        <CircleIcon className="size-3.5" />
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
                        <div className="flex items-center gap-1 text-[10px]">
                            <label className="text-muted-foreground w-5 shrink-0">X</label>
                            <input
                                type="number"
                                className="bg-background border-input h-6 w-full rounded border px-1 text-[10px]"
                                value={stressStartX}
                                onChange={e => onStressStartXChange?.(parseFloat(e.target.value) || 0)}
                            />
                            <label className="text-muted-foreground w-5 shrink-0">Y</label>
                            <input
                                type="number"
                                className="bg-background border-input h-6 w-full rounded border px-1 text-[10px]"
                                value={stressStartY}
                                onChange={e => onStressStartYChange?.(parseFloat(e.target.value) || 0)}
                            />
                            {onPickStressStart && (
                                <Button
                                    variant={isPicking ? 'default' : 'outline'}
                                    size="xs"
                                    onClick={onPickStressStart}
                                    title="Click on viewport to pick starting point"
                                    className="shrink-0 px-1"
                                >
                                    <Crosshair className="size-3" />
                                </Button>
                            )}
                        </div>
                        {isPicking && (
                            <span className="text-[10px] text-amber-500">
                                Click on the viewport to set start point...
                            </span>
                        )}
                        <div className="flex flex-wrap gap-1">
                            {[30, 50, 100].map(n => (
                                <Button
                                    key={n}
                                    variant="outline"
                                    size="xs"
                                    onClick={() => onSpawnStressTest(
                                        n,
                                        stressStartX,
                                        stressStartY,
                                    )}
                                >
                                    {n} trains
                                </Button>
                            ))}
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
                {(onSwitchDirectionAll || onBrakeAll) && (
                    <>
                        <span className="text-muted-foreground text-[10px]">
                            Train Controls
                        </span>
                        <div className="flex gap-1">
                            {onSwitchDirectionAll && (
                                <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={onSwitchDirectionAll}
                                    title="Switch direction for all trains"
                                >
                                    <ArrowLeftRight className="mr-1 size-3" />
                                    Reverse
                                </Button>
                            )}
                            {onBrakeAll && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        onClick={() => onBrakeAll('er')}
                                        title="Emergency brake all trains"
                                    >
                                        <OctagonXIcon className="mr-1 size-3" />
                                        EB
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        onClick={() => onBrakeAll('b3')}
                                        title="Service brake (B3) all trains"
                                    >
                                        B3
                                    </Button>
                                </>
                            )}
                        </div>
                    </>
                )}
                {onGenerateTracks && (
                    <>
                        <Separator />
                        <span className="text-muted-foreground text-[10px]">
                            Generate Tracks
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {[50, 200, 500, 1000].map(n => (
                                <Button
                                    key={n}
                                    variant="outline"
                                    size="xs"
                                    onClick={() => onGenerateTracks(n)}
                                >
                                    {n} segs
                                </Button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </DraggablePanel>
    );
}
