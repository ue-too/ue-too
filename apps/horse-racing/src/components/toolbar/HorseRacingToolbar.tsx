import { BarChart3, Bot, BotOff, Download, Eye, EyeOff, Gamepad2, Home, Play, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import { parseTrackJson } from '@/simulation/track-from-json';
import type { HorseRacingAppComponents } from '@/utils/init-app';
import type { HorseRacingSimHandle } from '@/simulation/horse-racing-sim';
import type { HorseObservation } from '@/simulation/horse-racing-engine';
const TRACK_PRESETS = [
    { label: 'Tokyo', url: '/tracks/tokyo.json' },
    { label: 'Hanshin', url: '/tracks/hanshin.json' },
    { label: 'Kokura', url: '/tracks/kokura.json' },
    { label: 'Kyoto', url: '/tracks/kyoto.json' },
    { label: 'Tokyo 2600', url: '/tracks/tokyo_2600.json' },
    { label: 'Test Oval', url: '/tracks/test_oval.json' },
    { label: 'exp_track_8', url: '/tracks/exp_track_8.json' },
];

const FALLBACK_MODELS = [
    { label: 'V35 Phase 2', url: '/models/v35_phase2.onnx' },
    { label: 'V38 Phase1 S2', url: '/models/v38_phase1_s2.onnx' },
    { label: 'V42 Phase1 S1', url: '/models/v42_phase1_s1.onnx' },
    { label: 'V43 Phase1', url: '/models/v43_phase1.onnx' },
];

const BT_OPTIONS = [
    { label: 'BT: Front Runner', url: 'bt:front_runner' },
    { label: 'BT: Stalker', url: 'bt:stalker' },
    { label: 'BT: Closer', url: 'bt:closer' },
    { label: 'BT: Presser', url: 'bt:presser' },
    { label: 'BT: Full Throttle', url: 'bt:full_throttle' },
    { label: 'BT: Passive', url: 'bt:passive' },
    { label: 'BT: Blocker', url: 'bt:blocker' },
];

const DEFAULT_MODEL_URL = '/models/v43_phase1.onnx';

function useAvailableModels() {
    const [models, setModels] = useState<{ label: string; url: string }[]>(FALLBACK_MODELS);
    useEffect(() => {
        fetch('/models/manifest.json')
            .then((r) => r.json())
            .then((data: { label: string; url: string }[]) => {
                if (Array.isArray(data) && data.length > 0) setModels(data);
            })
            .catch(() => { /* use fallback */ });
    }, []);
    return models;
}

const HORSE_NAMES = [
    'Gold', 'Brown', 'Blue', 'White', 'Red', 'Green',
    'Purple', 'Orange', 'Cyan', 'Pink', 'Lime', 'Teal',
    'Coral', 'Indigo', 'Salmon', 'Turquoise', 'Maroon', 'Olive',
    'Navy', 'Rose',
];

type RaceState = 'idle' | 'racing' | 'finished';

export function HorseRacingToolbar() {
    const { t } = useTranslation();
    const { result } = usePixiCanvas<HorseRacingAppComponents>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handle = result.initialized && result.success ? result.components.simHandle : null;
    const availableModels = useAvailableModels();
    const [arcFanVisible, setArcFanVisible] = useState(() => handle?.arcFanVisible() ?? true);
    const [horseCount, setHorseCount] = useState(4);
    const [raceState, setRaceState] = useState<RaceState>('idle');
    const [statsOpen, setStatsOpen] = useState(false);

    const toggleArcFan = useCallback(() => {
        if (!handle) return;
        const next = !handle.arcFanVisible();
        handle.setArcFanVisible(next);
        setArcFanVisible(next);
    }, [handle]);

    const reload = async (url: string) => {
        if (!result.initialized || !result.success) return;
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const segments = parseTrackJson(await res.json());
            result.components.simHandle.reloadTrack(segments);
            setRaceState('idle');
        } catch {
            // ignore bad tracks
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !result.initialized || !result.success) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const segments = parseTrackJson(JSON.parse(reader.result as string));
                result.components.simHandle.reloadTrack(segments);
                setRaceState('idle');
            } catch {
                // ignore bad files
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    const handleHorseCountChange = (n: number) => {
        setHorseCount(n);
        handle?.setHorseCount(n);
        setRaceState('idle');
    };

    const handleReset = () => {
        handle?.resetRace();
        setRaceState('idle');
    };

    const handleExport = () => {
        if (!handle) return;
        const data = handle.exportRaceData();
        if (!data) return;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `race_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="border-border bg-card/90 pointer-events-auto fixed top-4 left-4 z-20 flex flex-col gap-2 rounded-lg border px-3 py-2 shadow-sm backdrop-blur">
            {/* Row 1: Track, horse count, arc fan, start/reset */}
            <div className="flex items-center gap-2">
                <Link
                    to="/"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                >
                    <Home className="size-4 shrink-0" aria-hidden />
                    <span>{t('toolbarHome')}</span>
                </Link>

                <span className="bg-border mx-1 h-4 w-px" />

                <label className="text-muted-foreground text-xs">
                    {t('trackLabel')}
                </label>
                <select
                    className="border-border bg-background text-foreground rounded border px-1.5 py-0.5 text-xs"
                    defaultValue={TRACK_PRESETS[0].url}
                    onChange={(e) => reload(e.target.value)}
                >
                    {TRACK_PRESETS.map((p) => (
                        <option key={p.url} value={p.url}>
                            {p.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="size-3.5 shrink-0" aria-hidden />
                    <span>{t('uploadTrack')}</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileUpload}
                />

                <span className="bg-border mx-1 h-4 w-px" />

                <label className="text-muted-foreground text-xs">Horses</label>
                <select
                    className="border-border bg-background text-foreground rounded border px-1.5 py-0.5 text-xs"
                    value={horseCount}
                    onChange={(e) => handleHorseCountChange(parseInt(e.target.value, 10))}
                >
                    {Array.from({ length: 19 }, (_, i) => i + 2).map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>

                <span className="bg-border mx-1 h-4 w-px" />

                <button
                    type="button"
                    className={`inline-flex items-center gap-1 text-xs transition-colors ${
                        arcFanVisible
                            ? 'text-blue-600'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={toggleArcFan}
                    title="Toggle fitted-arc fan overlay"
                >
                    {arcFanVisible ? (
                        <Eye className="size-3.5" aria-hidden />
                    ) : (
                        <EyeOff className="size-3.5" aria-hidden />
                    )}
                    <span>Arc Fan</span>
                </button>

                <span className="bg-border mx-1 h-4 w-px" />

                <StartRaceButton handle={handle} raceState={raceState} setRaceState={setRaceState} />
                <ResetButton handle={handle} raceState={raceState} onReset={handleReset} />
            </div>

            {/* Row 2: Player horse selector + AI toggles + model selectors */}
            <div className="flex items-center gap-2 flex-wrap">
                <PlayerSelector handle={handle} horseCount={horseCount} />

                <span className="bg-border mx-1 h-4 w-px" />

                <AIToggle handle={handle} horseCount={horseCount} />

                <span className="bg-border mx-1 h-4 w-px" />

                <ModelSelector handle={handle} horseCount={horseCount} availableModels={availableModels} />
            </div>

            {/* Row 3: stats + export */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    className={`inline-flex items-center gap-1 text-xs transition-colors ${
                        statsOpen ? 'text-cyan-500' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setStatsOpen(v => !v)}
                    title="Toggle debug stats panel"
                >
                    <BarChart3 className="size-3.5" aria-hidden />
                    <span>Stats</span>
                </button>

                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                    onClick={handleExport}
                    title="Export race data as JSON"
                >
                    <Download className="size-3.5" aria-hidden />
                    <span>Export</span>
                </button>
            </div>

            {/* Row 4: Debug stats panel (collapsible) */}
            {statsOpen && (
                <StatsPanel handle={handle} horseCount={horseCount} availableModels={availableModels} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// StartRaceButton
// ---------------------------------------------------------------------------

function StartRaceButton({
    handle,
    raceState,
    setRaceState,
}: {
    handle: HorseRacingSimHandle | null;
    raceState: RaceState;
    setRaceState: (s: RaceState) => void;
}) {
    // Poll for race finish while racing
    useEffect(() => {
        if (raceState !== 'racing' || !handle) return;
        const interval = setInterval(() => {
            if (handle.isRaceFinished()) setRaceState('finished');
        }, 500);
        return () => clearInterval(interval);
    }, [raceState, handle, setRaceState]);

    const start = () => {
        if (!handle || raceState === 'racing') return;
        handle.startRace();
        setRaceState('racing');
    };

    const className =
        raceState === 'idle'
            ? 'bg-green-600 text-white hover:bg-green-700'
            : raceState === 'racing'
              ? 'bg-muted text-muted-foreground cursor-default'
              : 'bg-amber-600 text-white cursor-default';

    const label =
        raceState === 'idle'
            ? 'Start Race'
            : raceState === 'racing'
              ? 'Racing...'
              : 'Finished';

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${className}`}
            onClick={start}
            disabled={raceState !== 'idle'}
        >
            <Play className="size-3.5" aria-hidden />
            <span>{label}</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// ResetButton
// ---------------------------------------------------------------------------

function ResetButton({
    handle,
    raceState,
    onReset,
}: {
    handle: HorseRacingSimHandle | null;
    raceState: RaceState;
    onReset: () => void;
}) {
    return (
        <button
            type="button"
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                raceState === 'idle'
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            onClick={onReset}
            disabled={raceState === 'idle' || !handle}
        >
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Reset</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// PlayerSelector
// ---------------------------------------------------------------------------

function PlayerSelector({
    handle,
    horseCount,
}: {
    handle: HorseRacingSimHandle | null;
    horseCount: number;
}) {
    const [playerHorse, setPlayerHorse] = useState(-1);

    // Reset when horse count changes
    useEffect(() => {
        setPlayerHorse(-1);
        handle?.setPlayerHorse(-1);
    }, [horseCount, handle]);

    const selectHorse = (idx: number) => {
        if (!handle) return;
        const next = idx === playerHorse ? -1 : idx; // toggle off if clicking same horse
        setPlayerHorse(next);
        handle.setPlayerHorse(next);
    };

    const clearPlayer = () => {
        if (!handle) return;
        setPlayerHorse(-1);
        handle.setPlayerHorse(-1);
    };

    return (
        <div className="flex items-center gap-1 flex-wrap">
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    playerHorse >= 0 ? 'text-yellow-500' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={clearPlayer}
                title={playerHorse >= 0 ? `Controlling ${HORSE_NAMES[playerHorse] ?? `Horse ${playerHorse}`} (click to release)` : 'No player control (arrow keys)'}
            >
                <Gamepad2 className="size-3.5" aria-hidden />
                <span>Player</span>
            </button>
            {Array.from({ length: horseCount }, (_, i) => (
                <button
                    key={i}
                    type="button"
                    className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                        playerHorse === i
                            ? 'bg-yellow-500 text-black'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => selectHorse(i)}
                    title={`Control ${HORSE_NAMES[i] ?? `Horse ${i}`} with arrow keys`}
                >
                    {HORSE_NAMES[i] ?? `H${i}`}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// AIToggle
// ---------------------------------------------------------------------------

function AIToggle({
    handle,
    horseCount,
}: {
    handle: HorseRacingSimHandle | null;
    horseCount: number;
}) {
    const [aiHorses, setAiHorses] = useState<Set<number>>(() => new Set(Array.from({ length: horseCount }, (_, i) => i)));

    // Reset AI state when horse count changes
    useEffect(() => {
        const all = new Set(Array.from({ length: horseCount }, (_, i) => i));
        setAiHorses(all);
    }, [horseCount]);

    const toggleHorse = (idx: number) => {
        if (!handle) return;
        const next = new Set(aiHorses);
        if (next.has(idx)) {
            next.delete(idx);
            handle.disableAI(idx);
        } else {
            next.add(idx);
            handle.enableAI(idx);
        }
        setAiHorses(next);
    };

    const toggleAll = () => {
        if (!handle) return;
        const indices = Array.from({ length: horseCount }, (_, i) => i);
        const allEnabled = indices.every(i => aiHorses.has(i));
        const next = new Set(aiHorses);
        for (const i of indices) {
            if (allEnabled) {
                next.delete(i);
                handle.disableAI(i);
            } else {
                next.add(i);
                handle.enableAI(i);
            }
        }
        setAiHorses(next);
    };

    const anyEnabled = aiHorses.size > 0;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    anyEnabled ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={toggleAll}
                title="Toggle AI for all horses"
            >
                {anyEnabled ? <Bot className="size-3.5" aria-hidden /> : <BotOff className="size-3.5" aria-hidden />}
                <span>AI</span>
            </button>
            {Array.from({ length: horseCount }, (_, i) => (
                <button
                    key={i}
                    type="button"
                    className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                        aiHorses.has(i)
                            ? 'bg-green-600 text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => toggleHorse(i)}
                    title={`Toggle AI for ${HORSE_NAMES[i] ?? `Horse ${i}`}`}
                >
                    {HORSE_NAMES[i] ?? `H${i}`}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// ModelSelector
// ---------------------------------------------------------------------------

function ModelSelector({
    handle,
    horseCount,
    availableModels,
}: {
    handle: HorseRacingSimHandle | null;
    horseCount: number;
    availableModels: { label: string; url: string }[];
}) {
    const [models, setModels] = useState<string[]>(() =>
        Array.from({ length: 20 }, () => DEFAULT_MODEL_URL),
    );

    const allOptions = [...availableModels, ...BT_OPTIONS];

    const changeModel = (horseIndex: number, value: string) => {
        const next = [...models];
        next[horseIndex] = value;
        setModels(next);
        if (value.startsWith('bt:')) {
            handle?.setBTForHorse(horseIndex, value.slice(3));
        } else {
            handle?.setModelForHorse(horseIndex, value);
        }
    };

    return (
        <div className="flex items-center gap-1 flex-wrap">
            <span className="text-muted-foreground text-xs">Models</span>
            {Array.from({ length: horseCount }, (_, i) => (
                <div key={i} className="flex items-center gap-0.5">
                    <span className="text-muted-foreground text-[10px]">{HORSE_NAMES[i] ?? `H${i}`}:</span>
                    <select
                        className="border-border bg-background text-foreground rounded border px-1 py-0.5 text-[10px]"
                        value={models[i]}
                        onChange={(e) => changeModel(i, e.target.value)}
                        title={`Model for ${HORSE_NAMES[i] ?? `Horse ${i}`}`}
                    >
                        <optgroup label="ONNX Models">
                            {availableModels.map(m => (
                                <option key={m.url} value={m.url}>{m.label}</option>
                            ))}
                        </optgroup>
                        <optgroup label="BT Scripted">
                            {BT_OPTIONS.map(m => (
                                <option key={m.url} value={m.url}>{m.label}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function modelLabel(url: string | undefined, models: { label: string; url: string }[]): string {
    if (!url) return 'default';
    const m = models.find((m) => m.url === url);
    return m ? m.label : url.split('/').pop() ?? url;
}

// ---------------------------------------------------------------------------
// StatsPanel
// ---------------------------------------------------------------------------

function StatsPanel({
    handle,
    horseCount,
    availableModels,
}: {
    handle: HorseRacingSimHandle | null;
    horseCount: number;
    availableModels: { label: string; url: string }[];
}) {
    const [observations, setObservations] = useState<HorseObservation[] | null>(null);

    useEffect(() => {
        if (!handle) return;
        const interval = setInterval(() => {
            setObservations(handle.getObservations());
        }, 200);
        return () => clearInterval(interval);
    }, [handle]);

    if (!observations || observations.length === 0) {
        return (
            <div className="text-muted-foreground text-[10px]">
                No observations yet — start the race to see stats.
            </div>
        );
    }

    const fmt = (v: number, d = 1) => v.toFixed(d);
    const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

    return (
        <div className="max-h-60 overflow-auto">
            <table className="text-[10px] w-full border-collapse">
                <thead>
                    <tr className="text-muted-foreground text-left">
                        <th className="px-1 py-0.5 font-medium">Horse</th>
                        <th className="px-1 py-0.5 font-medium">Model</th>
                        <th className="px-1 py-0.5 font-medium">Speed</th>
                        <th className="px-1 py-0.5 font-medium">Top Spd</th>
                        <th className="px-1 py-0.5 font-medium">Accel</th>
                        <th className="px-1 py-0.5 font-medium">Stamina</th>
                        <th className="px-1 py-0.5 font-medium">Grip L/R</th>
                        <th className="px-1 py-0.5 font-medium">Climb</th>
                        <th className="px-1 py-0.5 font-medium">Displ</th>
                        <th className="px-1 py-0.5 font-medium">Progress</th>
                        <th className="px-1 py-0.5 font-medium">Place</th>
                    </tr>
                </thead>
                <tbody>
                    {observations.slice(0, horseCount).map((obs, i) => {
                        const staminaPct = obs.maxStamina > 0
                            ? obs.currentStamina / obs.maxStamina
                            : 0;
                        const placement = Math.round(obs.placementNorm * (obs.numHorses - 1)) + 1;
                        const mUrl = handle?.getModelAssignment(i);

                        return (
                            <tr
                                key={i}
                                className={`border-border border-t`}
                            >
                                <td className="px-1 py-0.5 font-medium">
                                    {HORSE_NAMES[i] ?? `H${i}`}
                                </td>
                                <td className="px-1 py-0.5 text-muted-foreground">
                                    {modelLabel(mUrl, availableModels)}
                                </td>
                                <td className="px-1 py-0.5 font-mono">
                                    {fmt(obs.tangentialVel)}/{fmt(obs.normalVel)}
                                </td>
                                <td className="px-1 py-0.5 font-mono">{fmt(obs.effectiveMaxSpeed)}</td>
                                <td className="px-1 py-0.5 font-mono">{fmt(obs.forwardAccel, 2)}</td>
                                <td className="px-1 py-0.5">
                                    <div className="flex items-center gap-1">
                                        <div className="bg-muted h-1.5 w-10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${
                                                    staminaPct > 0.4 ? 'bg-green-500' :
                                                    staminaPct > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: pct(staminaPct) }}
                                            />
                                        </div>
                                        <span className="font-mono">{fmt(obs.currentStamina, 0)}</span>
                                    </div>
                                </td>
                                <td className="px-1 py-0.5 font-mono">
                                    {fmt(obs.corneringGrip, 2)}/{fmt(obs.corneringGrip, 2)}
                                </td>
                                <td className="px-1 py-0.5 font-mono">{fmt(1.0, 2)}</td>
                                <td className="px-1 py-0.5 font-mono">{fmt(obs.displacement ?? 0, 1)}</td>
                                <td className="px-1 py-0.5 font-mono">{pct(obs.trackProgress)}</td>
                                <td className="px-1 py-0.5 font-mono font-medium">{placement}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
