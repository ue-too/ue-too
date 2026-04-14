import { useState } from 'react';
import { Check, Columns2, Crosshair, PanelLeft, Plus, Settings2, Trash2, X } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { StationManager } from '@/stations/station-manager';
import type { StationRenderSystem } from '@/stations/station-render-system';
import type { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { TrackGraph } from '@/trains/tracks/track';
import { ELEVATION } from '@/trains/tracks/types';
import type { Platform, Station } from '@/stations/types';
import type { CameraRig } from '@ue-too/board';

/** Max distance (world units) from station position to be a reassignment candidate. */
const NEARBY_RADIUS = 50;

type StationListPanelProps = {
    stationManager: StationManager;
    stationRenderSystem: StationRenderSystem;
    trackGraph: TrackGraph;
    trackAlignedPlatformManager: TrackAlignedPlatformManager;
    cameraRig: CameraRig;
    onClose: () => void;
    /** Called after any station mutation (rename, delete, reassign) so callers can refresh debug overlays etc. */
    onStationChange?: () => void;
    /** Activate single-spine platform tool for the given station. */
    onAddSingleSpinePlatform?: (stationId: number) => void;
    /** Activate dual-spine platform tool for the given station. */
    onAddDualSpinePlatform?: (stationId: number) => void;
};

/**
 * Compute distance between a station position and a platform's track midpoint.
 */
function platformDistanceToStation(
    trackGraph: TrackGraph,
    platform: Platform,
    stationPos: { x: number; y: number },
): number | null {
    const curve = trackGraph.getTrackSegmentCurve(platform.track);
    if (curve === null) return null;
    const mid = curve.get(0.5);
    const dx = mid.x - stationPos.x;
    const dy = mid.y - stationPos.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Collect all platforms from all stations, tagged with their owner station ID.
 */
function collectAllPlatforms(
    stationManager: StationManager,
): { stationId: number; platform: Platform }[] {
    const result: { stationId: number; platform: Platform }[] = [];
    for (const { id, station } of stationManager.getStations()) {
        for (const platform of station.platforms) {
            result.push({ stationId: id, platform });
        }
    }
    return result;
}

/**
 * Find nearby platforms from OTHER stations that could be reassigned to the target station.
 */
function findNearbyPlatforms(
    stationManager: StationManager,
    trackGraph: TrackGraph,
    targetStationId: number,
    targetStation: Station,
): { stationId: number; platform: Platform; distance: number }[] {
    const all = collectAllPlatforms(stationManager);
    const candidates: { stationId: number; platform: Platform; distance: number }[] = [];
    for (const { stationId, platform } of all) {
        if (stationId === targetStationId) continue;
        const dist = platformDistanceToStation(trackGraph, platform, targetStation.position);
        if (dist !== null && dist <= NEARBY_RADIUS) {
            candidates.push({ stationId, platform, distance: dist });
        }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
}

/**
 * Move a platform from one station to another.
 * Also moves the platform's track segment and its joints if they aren't shared.
 * Auto-deletes the source station if it ends up with zero platforms.
 */
function reassignPlatform(
    stationManager: StationManager,
    stationRenderSystem: StationRenderSystem,
    trackGraph: TrackGraph,
    fromStationId: number,
    toStationId: number,
    platform: Platform,
): void {
    const fromStation = stationManager.getStation(fromStationId);
    const toStation = stationManager.getStation(toStationId);
    if (fromStation === null || toStation === null) return;

    // Remove platform from source
    fromStation.platforms = fromStation.platforms.filter(p => p !== platform);

    // Move track segment reference
    const segId = platform.track;
    if (!toStation.trackSegments.includes(segId)) {
        toStation.trackSegments.push(segId);
    }
    // Remove from source if no remaining platform uses it
    const srcStillUsesTrack = fromStation.platforms.some(p => p.track === segId);
    if (!srcStillUsesTrack) {
        fromStation.trackSegments = fromStation.trackSegments.filter(s => s !== segId);

        // Move joints for this segment
        const seg = trackGraph.getTrackSegmentWithJoints(segId);
        if (seg !== null) {
            for (const jId of [seg.t0Joint, seg.t1Joint]) {
                if (!toStation.joints.includes(jId)) {
                    toStation.joints.push(jId);
                }
                const srcStillUsesJoint = fromStation.trackSegments.some(sId => {
                    const s = trackGraph.getTrackSegmentWithJoints(sId);
                    return s !== null && (s.t0Joint === jId || s.t1Joint === jId);
                });
                if (!srcStillUsesJoint) {
                    fromStation.joints = fromStation.joints.filter(j => j !== jId);
                }
            }
        }
    }

    // Add to target
    toStation.platforms.push(platform);

    // Re-number platform IDs in both stations
    fromStation.platforms.forEach((p, i) => { p.id = i; });
    toStation.platforms.forEach((p, i) => { p.id = i; });

    // Rebuild render for both
    stationRenderSystem.removeStation(fromStationId);
    stationRenderSystem.removeStation(toStationId);

    if (fromStation.platforms.length === 0) {
        stationManager.destroyStation(fromStationId);
    } else {
        stationRenderSystem.addStation(fromStationId);
    }
    stationRenderSystem.addStation(toStationId);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StationListPanel({
    stationManager,
    stationRenderSystem,
    trackGraph,
    trackAlignedPlatformManager,
    cameraRig,
    onClose,
    onStationChange,
    onAddSingleSpinePlatform,
    onAddDualSpinePlatform,
}: StationListPanelProps) {
    const { t } = useTranslation();
    const stations = stationManager.getStations();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    /** Station ID currently in "pick platforms" mode. */
    const [pickingForStation, setPickingForStation] = useState<number | null>(null);
    // Force re-render after mutations
    const [, setVersion] = useState(0);

    const handleStartEdit = (id: number, currentName: string) => {
        setEditingId(id);
        setEditValue(currentName);
    };

    const handleCommitEdit = (id: number) => {
        const station = stationManager.getStation(id);
        if (station !== null && editValue.trim() !== '') {
            station.name = editValue.trim();
        }
        setEditingId(null);
        setVersion(v => v + 1);
        onStationChange?.();
    };

    const handleLocate = (pos: { x: number; y: number }) => {
        cameraRig.panToWorld(pos);
    };

    const handleDelete = (id: number) => {
        stationRenderSystem.removeStation(id);
        stationManager.destroyStation(id);
        if (pickingForStation === id) setPickingForStation(null);
        setVersion(v => v + 1);
        onStationChange?.();
    };

    const handleReassign = (
        fromStationId: number,
        platform: Platform,
    ) => {
        if (pickingForStation === null) return;
        reassignPlatform(
            stationManager,
            stationRenderSystem,
            trackGraph,
            fromStationId,
            pickingForStation,
            platform,
        );
        setVersion(v => v + 1);
        onStationChange?.();
    };

    const handleCreateEmptyStation = () => {
        const pos = cameraRig.camera.position;
        const stationId = stationManager.createStation({
            name: 'Station',
            position: { x: pos.x, y: pos.y },
            elevation: ELEVATION.GROUND,
            platforms: [],
            trackSegments: [],
            joints: [],
            trackAlignedPlatforms: [],
        });
        stationRenderSystem.addStation(stationId);
        setVersion(v => v + 1);
        onStationChange?.();
    };

    // Build nearby candidate list when picking
    const pickingStation = pickingForStation !== null
        ? stationManager.getStation(pickingForStation)
        : null;
    const nearbyCandidates = pickingStation !== null && pickingForStation !== null
        ? findNearbyPlatforms(stationManager, trackGraph, pickingForStation, pickingStation)
        : [];

    return (
        <DraggablePanel
            title={t('stations')}
            onClose={onClose}
            className="w-64"
        >
            <Separator className="mb-2" />
            <Button
                variant="outline"
                size="sm"
                className="mb-2 w-full gap-1 text-xs"
                onClick={handleCreateEmptyStation}
            >
                <Plus className="size-3" />
                {t('createEmptyStation')}
            </Button>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {stations.length === 0 ? (
                    <span className="text-muted-foreground py-4 text-center text-xs">
                        {t('noStations')}
                    </span>
                ) : (
                    stations.map(({ id, station }) => {
                        const trackAlignedCount = trackAlignedPlatformManager.getPlatformsByStation(id).length;
                        return (
                        <div
                            key={id}
                            className="bg-muted/50 flex flex-col rounded-lg px-2.5 py-1.5"
                        >
                            <div className="flex items-center justify-between">
                            <div className="flex min-w-0 flex-col">
                                {editingId === id ? (
                                    <input
                                        autoFocus
                                        className="bg-background text-foreground w-full rounded border px-1 text-xs outline-none"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={() => handleCommitEdit(id)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCommitEdit(id);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="text-foreground truncate text-left text-xs font-medium hover:underline"
                                        onClick={() => handleStartEdit(id, station.name)}
                                    >
                                        {station.name}
                                    </button>
                                )}
                                <span className="text-muted-foreground text-[10px]">
                                    ({station.position.x.toFixed(1)}, {station.position.y.toFixed(1)})
                                    {' · '}
                                    {t('platform', { count: station.platforms.length })}
                                    {trackAlignedCount > 0 && (
                                        <>
                                            {' · '}
                                            {t('trackAlignedPlatform', { count: trackAlignedCount })}
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                                {pickingForStation === id ? (
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => setPickingForStation(null)}
                                        title={t('donePickingPlatforms')}
                                    >
                                        <Check className="size-3" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => setPickingForStation(id)}
                                        title={t('pickPlatformsToAdd')}
                                        disabled={pickingForStation !== null}
                                    >
                                        <Settings2 className="size-3" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => handleLocate(station.position)}
                                    title={t('panToStation')}
                                >
                                    <Crosshair className="size-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => handleDelete(id)}
                                    title={t('deleteStation')}
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                            </div>
                            </div>
                            {/* Track-aligned platform actions */}
                            <div className="mt-1 flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 flex-1 gap-1 px-1.5 text-[10px]"
                                    onClick={() => onAddSingleSpinePlatform?.(id)}
                                    title={t('addSingleSpinePlatform')}
                                >
                                    <PanelLeft className="size-3" />
                                    {t('addSingleSpinePlatform')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 flex-1 gap-1 px-1.5 text-[10px]"
                                    onClick={() => onAddDualSpinePlatform?.(id)}
                                    title={t('addDualSpinePlatform')}
                                >
                                    <Columns2 className="size-3" />
                                    {t('addDualSpinePlatform')}
                                </Button>
                            </div>
                        </div>
                        );
                    })
                )}
            </div>

            {/* Platform reassignment picker */}
            {pickingForStation !== null && pickingStation !== null && (
                <>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                            {t('nearbyPlatforms')}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setPickingForStation(null)}
                            title={t('cancel')}
                        >
                            <X className="size-3" />
                        </Button>
                    </div>
                    <div className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto">
                        {nearbyCandidates.length === 0 ? (
                            <span className="text-muted-foreground py-2 text-center text-[10px]">
                                {t('noNearbyPlatforms')}
                            </span>
                        ) : (
                            nearbyCandidates.map(({ stationId, platform, distance }) => {
                                const srcStation = stationManager.getStation(stationId);
                                const srcName = srcStation?.name ?? t('stationFallback', { id: stationId });
                                return (
                                    <button
                                        key={`${stationId}-${platform.track}-${platform.id}`}
                                        type="button"
                                        className="bg-muted/30 hover:bg-muted flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left transition-colors"
                                        onClick={() => handleReassign(stationId, platform)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-foreground text-xs">
                                                {t('platformTrackInfo', { platformId: platform.id, trackId: platform.track })}
                                            </span>
                                            <span className="text-muted-foreground text-[10px]">
                                                {t('fromStationDistance', { name: srcName, distance: distance.toFixed(1) })}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </DraggablePanel>
    );
}
