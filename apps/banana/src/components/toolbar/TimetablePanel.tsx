import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Trash2, Upload, X } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const NONE = '__none__';
import { useBananaApp } from '@/contexts/pixi';
import { TimetableManager } from '@/timetable/timetable-manager';
import { downloadJson, uploadJson } from './utils';
import type { StationManager } from '@/stations/station-manager';
import type { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { FormationManager } from '@/trains/formation-manager';
import type { TrackGraph } from '@/trains/tracks/track';
import type { Route, ShiftTemplate, ShiftAssignment, SerializedTimetableData } from '@/timetable/types';
import { DayOfWeek, type ScheduledStop } from '@/timetable/types';
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_DAY } from '@/timetable/schedule-clock';
import { weekdaysMask } from '@/timetable/shift-template-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nextId = 0;
function uid(prefix: string): string {
    return `${prefix}-${Date.now()}-${_nextId++}`;
}

function formatWeekMs(ms: number | null): string {
    if (ms === null) return '--:--';
    const totalMinutes = Math.floor((ms % MS_PER_DAY) / MS_PER_MINUTE);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTimeString(str: string): number | null {
    const match = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h > 23 || m > 59) return null;
    return h * MS_PER_HOUR + m * MS_PER_MINUTE;
}

/** Unified platform option for the shift stop selector. */
type PlatformOption = {
    /** Encoded value: `island:<id>` or `trackAligned:<id>` */
    value: string;
    label: string;
    kind: 'island' | 'trackAligned';
    platformId: number;
};

/** Build a list of all platforms (island + track-aligned) for a given station. */
function buildPlatformOptions(
    stationId: number,
    stationManager: StationManager,
    trackAlignedPlatformManager: TrackAlignedPlatformManager,
): PlatformOption[] {
    const station = stationManager.getStation(stationId);
    if (station === null) return [];
    const options: PlatformOption[] = [];
    for (const p of station.platforms) {
        options.push({
            value: `island:${p.id}`,
            label: `P${p.id} (S${p.track})`,
            kind: 'island',
            platformId: p.id,
        });
    }
    for (const tapId of station.trackAlignedPlatforms) {
        const tap = trackAlignedPlatformManager.getPlatform(tapId);
        if (tap === null) continue;
        const segments = tap.spineA.map((e) => e.trackSegment).join(',');
        options.push({
            value: `trackAligned:${tapId}`,
            label: `T${tapId} (S${segments})`,
            kind: 'trackAligned',
            platformId: tapId,
        });
    }
    return options;
}

/** Parse an encoded platform value back into kind + id. */
function parsePlatformValue(value: string): { kind: 'island' | 'trackAligned'; platformId: number } | null {
    const m = value.match(/^(island|trackAligned):(\d+)$/);
    if (!m) return null;
    return { kind: m[1] as 'island' | 'trackAligned', platformId: parseInt(m[2], 10) };
}

type Tab = 'routes' | 'shifts' | 'assign';

// ---------------------------------------------------------------------------
// RouteSection
// ---------------------------------------------------------------------------

function RouteSection({
    timetableManager,
    trackGraph,
}: {
    timetableManager: TimetableManager;
    trackGraph: TrackGraph;
}) {
    const { t } = useTranslation();
    const [routes, setRoutes] = useState<Route[]>(() =>
        timetableManager.routeManager.getAllRoutes(),
    );
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [jointsStr, setJointsStr] = useState('');

    useEffect(() => {
        return timetableManager.routeManager.subscribe(() => {
            setRoutes(timetableManager.routeManager.getAllRoutes());
        });
    }, [timetableManager]);

    const handleAdd = useCallback(() => {
        if (!name.trim() || !jointsStr.trim()) return;
        const nums = jointsStr
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
        if (nums.length < 2) return;

        // Auto-infer direction for each joint.  For the first joint we simply
        // pick whichever direction set contains the next joint.  For subsequent
        // joints we also verify that the departure direction is opposite to the
        // arrival side (the train can't depart in the same direction it arrived).
        const joints: Route['joints'] = [];
        for (let i = 0; i < nums.length; i++) {
            const jointNumber = nums[i];
            const joint = trackGraph.getJoint(jointNumber);
            if (!joint) {
                alert(`Joint ${jointNumber} does not exist in the track graph.`);
                return;
            }

            if (i === nums.length - 1) {
                // Last joint: direction doesn't matter for validation, default tangent
                joints.push({ jointNumber, direction: 'tangent' });
                break;
            }

            const nextJointNumber = nums[i + 1];
            let direction: 'tangent' | 'reverseTangent' | null = null;
            if (joint.direction.tangent.has(nextJointNumber)) {
                direction = 'tangent';
            } else if (joint.direction.reverseTangent.has(nextJointNumber)) {
                direction = 'reverseTangent';
            } else {
                alert(`Joint ${jointNumber} is not connected to joint ${nextJointNumber}.`);
                return;
            }

            // For intermediate joints, verify arrival and departure are on
            // opposite sides.
            if (i > 0) {
                const prevJointNumber = nums[i - 1];
                const arrivalSide = joint.direction.tangent.has(prevJointNumber)
                    ? 'tangent'
                    : joint.direction.reverseTangent.has(prevJointNumber)
                      ? 'reverseTangent'
                      : null;
                if (arrivalSide === direction) {
                    alert(
                        `Invalid route at joint ${jointNumber}: arrival (from ${prevJointNumber}) and departure (to ${nextJointNumber}) are on the same side.`,
                    );
                    return;
                }
            }

            joints.push({ jointNumber, direction });
        }

        const route: Route = {
            id: uid('route'),
            name: name.trim(),
            joints,
        };

        timetableManager.routeManager.addRoute(route);
        setName('');
        setJointsStr('');
        setAdding(false);
    }, [name, jointsStr, timetableManager, trackGraph]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{t('routes')}</span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setAdding((v) => !v)}
                >
                    {adding ? <X className="size-3" /> : <Plus className="size-3" />}
                </Button>
            </div>

            {adding && (
                <div className="bg-muted/50 flex flex-col gap-1 rounded border p-2">
                    <input
                        autoFocus
                        className="bg-background text-foreground w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                        placeholder={t('routeName')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        className="bg-background text-foreground w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                        placeholder={t('jointSequence')}
                        value={jointsStr}
                        onChange={(e) => setJointsStr(e.target.value)}
                    />
                    <Button
                        variant="default"
                        size="xs"
                        onClick={handleAdd}
                        disabled={!name.trim() || !jointsStr.trim()}
                    >
                        {t('addRoute')}
                    </Button>
                </div>
            )}

            {routes.length === 0 && !adding && (
                <span className="text-muted-foreground py-2 text-center text-xs">
                    {t('noRoutes')}
                </span>
            )}

            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                {routes.map((r) => (
                    <div
                        key={r.id}
                        className="bg-muted/50 flex items-center justify-between rounded px-2 py-1"
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-medium">{r.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                                {t('jointCount', { count: r.joints.length })}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => timetableManager.routeManager.removeRoute(r.id)}
                            title={t('removeRoute')}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// ShiftSection
// ---------------------------------------------------------------------------

function ShiftSection({
    timetableManager,
    stationManager,
    trackAlignedPlatformManager,
}: {
    timetableManager: TimetableManager;
    stationManager: StationManager;
    trackAlignedPlatformManager: TrackAlignedPlatformManager;
}) {
    const { t } = useTranslation();
    const [shifts, setShifts] = useState<ShiftTemplate[]>(() =>
        timetableManager.shiftTemplateManager.getAllTemplates(),
    );
    const [adding, setAdding] = useState(false);
    const [shiftName, setShiftName] = useState('');
    const [stopsInput, setStopsInput] = useState<
        { stationId: string; platformValue: string; arrive: string; depart: string }[]
    >([
        { stationId: '', platformValue: '', arrive: '', depart: '' },
        { stationId: '', platformValue: '', arrive: '', depart: '' },
    ]);
    const [routeIds, setRouteIds] = useState<string[]>(['']);

    const routes = timetableManager.routeManager.getAllRoutes();
    const stations = stationManager.getStations();

    useEffect(() => {
        return timetableManager.shiftTemplateManager.subscribe(() => {
            setShifts(timetableManager.shiftTemplateManager.getAllTemplates());
        });
    }, [timetableManager]);

    const addStop = () => {
        setStopsInput((prev) => [
            ...prev,
            { stationId: '', platformValue: '', arrive: '', depart: '' },
        ]);
        setRouteIds((prev) => [...prev, '']);
    };

    const removeStop = (index: number) => {
        if (stopsInput.length <= 2) return;
        setStopsInput((prev) => prev.filter((_, i) => i !== index));
        const legIdx = Math.min(index, routeIds.length - 1);
        setRouteIds((prev) => prev.filter((_, i) => i !== legIdx));
    };

    const updateStop = (
        index: number,
        field: 'stationId' | 'platformValue' | 'arrive' | 'depart',
        value: string,
    ) => {
        setStopsInput((prev) =>
            prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
        );
    };

    const handleAdd = useCallback(() => {
        if (!shiftName.trim()) return;

        const builtStops: ScheduledStop[] = stopsInput.map((s, i) => {
            const stationId = parseInt(s.stationId, 10);
            const parsed = parsePlatformValue(s.platformValue);

            const arriveMs =
                i === 0
                    ? null
                    : (() => {
                          const t = parseTimeString(s.arrive);
                          return t !== null ? DayOfWeek.Monday * MS_PER_DAY + t : null;
                      })();

            const departMs =
                i === stopsInput.length - 1
                    ? null
                    : (() => {
                          const t = parseTimeString(s.depart);
                          return t !== null ? DayOfWeek.Monday * MS_PER_DAY + t : null;
                      })();

            return {
                stationId: isNaN(stationId) ? 0 : stationId,
                platformKind: parsed?.kind ?? 'island' as const,
                platformId: parsed?.platformId ?? 0,
                stopPositionIndex: 0,
                arrivalTime: arriveMs,
                departureTime: departMs,
            };
        });

        const legs = routeIds.slice(0, stopsInput.length - 1).map((rid) => ({
            routeId: rid,
        }));

        const template: ShiftTemplate = {
            id: uid('shift'),
            name: shiftName.trim(),
            activeDays: weekdaysMask(),
            stops: builtStops,
            legs,
        };

        try {
            timetableManager.shiftTemplateManager.addTemplate(template);
            setShiftName('');
            setStopsInput([
                { stationId: '', platformValue: '', arrive: '', depart: '' },
                { stationId: '', platformValue: '', arrive: '', depart: '' },
            ]);
            setRouteIds(['']);
            setAdding(false);
        } catch (e) {
            alert(String(e));
        }
    }, [shiftName, stopsInput, routeIds, timetableManager, stationManager]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{t('shifts')}</span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setAdding((v) => !v)}
                >
                    {adding ? <X className="size-3" /> : <Plus className="size-3" />}
                </Button>
            </div>

            {adding && (
                <div className="bg-muted/50 flex flex-col gap-1.5 rounded border p-2">
                    <input
                        autoFocus
                        className="bg-background text-foreground w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                        placeholder={t('shiftName')}
                        value={shiftName}
                        onChange={(e) => setShiftName(e.target.value)}
                    />

                    <span className="text-muted-foreground text-[10px]">{t('stops')}:</span>
                    {stopsInput.map((stop, i) => {
                        const stationIdNum = parseInt(stop.stationId, 10);
                        const platformOptions = !isNaN(stationIdNum)
                            ? buildPlatformOptions(stationIdNum, stationManager, trackAlignedPlatformManager)
                            : [];
                        return (
                        <div key={i} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                                <Select
                                    value={stop.stationId || NONE}
                                    onValueChange={(val) => {
                                        updateStop(i, 'stationId', val === NONE ? '' : val);
                                        updateStop(i, 'platformValue', '');
                                    }}
                                >
                                    <SelectTrigger size="sm" className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>{t('stationPlaceholder')}</SelectItem>
                                        {stations.map(({ id, station }) => (
                                            <SelectItem key={id} value={String(id)}>
                                                {station.name || `Station ${id}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {stopsInput.length > 2 && (
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => removeStop(i)}
                                    >
                                        <X className="size-3" />
                                    </Button>
                                )}
                            </div>
                            {platformOptions.length > 0 && (
                                <Select
                                    value={stop.platformValue || NONE}
                                    onValueChange={(val) =>
                                        updateStop(i, 'platformValue', val === NONE ? '' : val)
                                    }
                                >
                                    <SelectTrigger size="sm" className="text-[10px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>{t('platformPlaceholder')}</SelectItem>
                                        {platformOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <div className="flex gap-1">
                                {i > 0 && (
                                    <input
                                        className="bg-background text-foreground w-16 rounded border px-1 py-0.5 text-[10px] outline-none"
                                        placeholder={t('arrivalTime')}
                                        value={stop.arrive}
                                        onChange={(e) =>
                                            updateStop(i, 'arrive', e.target.value)
                                        }
                                    />
                                )}
                                {i < stopsInput.length - 1 && (
                                    <input
                                        className="bg-background text-foreground w-16 rounded border px-1 py-0.5 text-[10px] outline-none"
                                        placeholder={t('departureTime')}
                                        value={stop.depart}
                                        onChange={(e) =>
                                            updateStop(i, 'depart', e.target.value)
                                        }
                                    />
                                )}
                            </div>
                            {i < stopsInput.length - 1 && (
                                <Select
                                    value={routeIds[i] || NONE}
                                    onValueChange={(val) =>
                                        setRouteIds((prev) =>
                                            prev.map((r, j) =>
                                                j === i ? (val === NONE ? '' : val) : r,
                                            ),
                                        )
                                    }
                                >
                                    <SelectTrigger size="sm" className="text-[10px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>{t('routePlaceholder')}</SelectItem>
                                        {routes.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {i < stopsInput.length - 1 && (
                                <Separator className="my-0.5" />
                            )}
                        </div>
                        );
                    })}
                    <Button variant="ghost" size="xs" onClick={addStop}>
                        {t('addStop')}
                    </Button>
                    <Button
                        variant="default"
                        size="xs"
                        onClick={handleAdd}
                        disabled={!shiftName.trim()}
                    >
                        {t('addShift')}
                    </Button>
                </div>
            )}

            {shifts.length === 0 && !adding && (
                <span className="text-muted-foreground py-2 text-center text-xs">
                    {t('noShifts')}
                </span>
            )}

            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                {shifts.map((s) => (
                    <div
                        key={s.id}
                        className="bg-muted/50 flex items-center justify-between rounded px-2 py-1"
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-medium">{s.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                                {t('stopCount', { count: s.stops.length })} ·{' '}
                                {formatWeekMs(s.stops[0]?.departureTime)} →{' '}
                                {formatWeekMs(s.stops[s.stops.length - 1]?.arrivalTime)}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                                timetableManager.shiftTemplateManager.removeTemplate(s.id)
                            }
                            title={t('removeShift')}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// AssignSection
// ---------------------------------------------------------------------------

function AssignSection({
    timetableManager,
    formationManager,
}: {
    timetableManager: TimetableManager;
    formationManager: FormationManager;
}) {
    const { t } = useTranslation();
    const [assignments, setAssignments] = useState<ShiftAssignment[]>(() =>
        timetableManager.getAssignments(),
    );
    const [selectedFormationId, setSelectedFormationId] = useState('');
    const [selectedShiftId, setSelectedShiftId] = useState('');

    useEffect(() => {
        const id = setInterval(() => {
            setAssignments(timetableManager.getAssignments());
        }, 1000);
        return () => clearInterval(id);
    }, [timetableManager]);

    const formations = formationManager.getFormations();
    const shifts = timetableManager.shiftTemplateManager.getAllTemplates();

    const handleAssign = useCallback(() => {
        if (!selectedFormationId || !selectedShiftId) return;
        timetableManager.assignShift(uid('assign'), selectedFormationId, selectedShiftId);
        setAssignments(timetableManager.getAssignments());
        setSelectedFormationId('');
        setSelectedShiftId('');
    }, [selectedFormationId, selectedShiftId, timetableManager]);

    const handleRemove = useCallback(
        (id: string) => {
            timetableManager.unassignShift(id);
            setAssignments(timetableManager.getAssignments());
        },
        [timetableManager],
    );

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t('assignments')}</span>

            <div className="flex flex-col gap-1">
                <Select
                    value={selectedFormationId || NONE}
                    onValueChange={(val) => setSelectedFormationId(val === NONE ? '' : val)}
                >
                    <SelectTrigger size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>{t('selectFormation')}</SelectItem>
                        {formations.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                                {f.formation.name ?? f.id}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={selectedShiftId || NONE}
                    onValueChange={(val) => setSelectedShiftId(val === NONE ? '' : val)}
                >
                    <SelectTrigger size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>{t('selectShift')}</SelectItem>
                        {shifts.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="default"
                    size="xs"
                    onClick={handleAssign}
                    disabled={!selectedFormationId || !selectedShiftId}
                >
                    {t('assignShift')}
                </Button>
            </div>

            {assignments.length === 0 && (
                <span className="text-muted-foreground py-2 text-center text-xs">
                    {t('noAssignments')}
                </span>
            )}

            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                {assignments.map((a) => {
                    const shift = timetableManager.shiftTemplateManager.getTemplate(
                        a.shiftTemplateId,
                    );
                    return (
                        <div
                            key={a.id}
                            className="bg-muted/50 flex items-center justify-between rounded px-2 py-1"
                        >
                            <div className="flex flex-col">
                                <span className="text-xs">
                                    {shift?.name ?? a.shiftTemplateId}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                    {a.formationId.slice(0, 8)}…
                                    {a.suspended ? ` (${t('suspended')})` : ''}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleRemove(a.id)}
                                title={t('removeAssignment')}
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// TimetablePanel (exported)
// ---------------------------------------------------------------------------

type TimetablePanelProps = {
    onClose: () => void;
};

export function TimetablePanel({ onClose }: TimetablePanelProps) {
    const { t } = useTranslation();
    const app = useBananaApp();
    const [tab, setTab] = useState<Tab>('routes');

    const handleExport = useCallback(() => {
        if (!app) return;
        const data = app.timetableManager.serialize();
        downloadJson(`timetable-${Date.now()}.json`, data);
    }, [app]);

    const handleImport = useCallback(() => {
        if (!app) return;
        uploadJson((parsed) => {
            const obj = parsed as Record<string, unknown>;
            if (!obj || typeof obj !== 'object' || !obj.clock || !Array.isArray(obj.routes) || !Array.isArray(obj.shiftTemplates) || !Array.isArray(obj.assignments)) {
                alert(t('invalidTimetableData'));
                return;
            }
            const data = parsed as SerializedTimetableData;
            const restored = TimetableManager.deserialize(
                data,
                app.curveEngine.trackGraph,
                app.trainManager,
                app.stationManager,
            );
            // Replace the current timetable manager and update the ref
            app.timetableManager.dispose();
            (app as { timetableManager: TimetableManager }).timetableManager = restored;
            app.timetableRef.current = restored;
        });
    }, [app, t]);

    if (!app) return null;

    const { timetableManager, stationManager, trackAlignedPlatformManager, formationManager } = app;
    const trackGraph = app.curveEngine.trackGraph;

    const headerActions = (
        <>
            <Button variant="ghost" size="icon-xs" onClick={handleExport} title={t('exportTimetable')}>
                <Download className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={handleImport} title={t('importTimetable')}>
                <Upload className="size-3" />
            </Button>
        </>
    );

    return (
        <DraggablePanel title={t('timetable')} onClose={onClose} className="w-72" headerActions={headerActions}>
            <div className="flex gap-0.5 pb-1">
                {(['routes', 'shifts', 'assign'] as const).map((tabKey) => (
                    <button
                        key={tabKey}
                        className={`flex-1 rounded px-2 py-0.5 text-xs ${
                            tab === tabKey
                                ? 'bg-foreground text-background font-medium'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                        onClick={() => setTab(tabKey)}
                    >
                        {tabKey === 'routes'
                            ? t('routes')
                            : tabKey === 'shifts'
                              ? t('shifts')
                              : t('assignments')}
                    </button>
                ))}
            </div>

            <Separator className="mb-2" />

            {tab === 'routes' && (
                <RouteSection
                    timetableManager={timetableManager}
                    trackGraph={trackGraph}
                />
            )}

            {tab === 'shifts' && (
                <ShiftSection
                    timetableManager={timetableManager}
                    stationManager={stationManager}
                    trackAlignedPlatformManager={trackAlignedPlatformManager}
                />
            )}

            {tab === 'assign' && (
                <AssignSection
                    timetableManager={timetableManager}
                    formationManager={formationManager}
                />
            )}
        </DraggablePanel>
    );
}
