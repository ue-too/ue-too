import { Bot, BotOff, Eye, EyeOff, Gamepad2, Home, Play, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import { parseTrackJson } from '@/simulation/track-from-json';
import type { HorseRacingAppComponents } from '@/utils/init-app';
import type { HorseRacingSimHandle } from '@/simulation/horse-racing-sim';

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
    { label: 'Baseline Jockey', url: '/models/baseline_jockey.onnx' },
];

const DEFAULT_MODEL_FOR_INDEX: Record<number, string> = {
    0: '/models/jockey_front_runner.onnx',
    1: '/models/jockey_stalker.onnx',
    2: '/models/jockey_closer.onnx',
    3: '/models/jockey_presser.onnx',
};

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
        Array.from({ length: 20 }, (_, i) => DEFAULT_MODEL_FOR_INDEX[i] ?? '/models/baseline_jockey.onnx'),
    );

    const changeModel = (horseIndex: number, modelUrl: string) => {
        const next = [...models];
        next[horseIndex] = modelUrl;
        setModels(next);
        handle?.setModelForHorse(horseIndex, modelUrl);
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
                        {availableModels.map(m => (
                            <option key={m.url} value={m.url}>{m.label}</option>
                        ))}
                    </select>
                </div>
            ))}
        </div>
    );
}
