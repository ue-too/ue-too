import { Bot, BotOff, Eye, EyeOff, Home, Play, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import { parseTrackJson } from '@/simulation/track-from-json';
import type { HorseRacingAppComponents } from '@/utils/init-app';

const TRACK_PRESETS = [
    { label: 'Tokyo', url: '/tracks/tokyo.json' },
    { label: 'Hanshin', url: '/tracks/hanshin.json' },
    { label: 'Kokura', url: '/tracks/kokura.json' },
    { label: 'Kyoto', url: '/tracks/kyoto.json' },
    { label: 'Tokyo 2600', url: '/tracks/tokyo_2600.json' },
    { label: 'Test Oval', url: '/tracks/test_oval.json' },
    { label: 'exp_track_8', url: '/tracks/exp_track_8.json' },
];

export function HorseRacingToolbar() {
    const { t } = useTranslation();
    const { result } = usePixiCanvas<HorseRacingAppComponents>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handle = result.initialized && result.success ? result.components.simHandle : null;
    const [arcFanVisible, setArcFanVisible] = useState(() => handle?.arcFanVisible() ?? true);

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
            } catch {
                // ignore bad files
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    return (
        <div className="border-border bg-card/90 pointer-events-auto fixed top-4 left-4 z-20 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm backdrop-blur">
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

            <AIToggle />

            <span className="bg-border mx-1 h-4 w-px" />

            <StartRaceButton />
        </div>
    );
}

const HORSE_NAMES = ['Gold', 'Brown', 'Blue', 'White'];
const PLAYER_INDEX = 0;

function StartRaceButton() {
    const { result } = usePixiCanvas<HorseRacingAppComponents>();
    const [started, setStarted] = useState(false);

    const handle = result.initialized && result.success ? result.components.simHandle : null;

    const start = () => {
        if (!handle || started) return;
        handle.startRace();
        setStarted(true);
    };

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                started
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            onClick={start}
            disabled={started}
        >
            <Play className="size-3.5" aria-hidden />
            <span>{started ? 'Racing...' : 'Start Race'}</span>
        </button>
    );
}

function AIToggle() {
    const { result } = usePixiCanvas<HorseRacingAppComponents>();
    // All horses start AI-enabled (matching sim default)
    const [aiHorses, setAiHorses] = useState<Set<number>>(new Set([0, 1, 2, 3]));

    const handle = result.initialized && result.success ? result.components.simHandle : null;

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
        // Toggle all non-player horses
        const nonPlayer = [1, 2, 3];
        const allEnabled = nonPlayer.every(i => aiHorses.has(i));
        const next = new Set(aiHorses);
        for (const i of nonPlayer) {
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
        <div className="flex items-center gap-1">
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    anyEnabled ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={toggleAll}
                title="Toggle AI for all non-player horses"
            >
                {anyEnabled ? <Bot className="size-3.5" aria-hidden /> : <BotOff className="size-3.5" aria-hidden />}
                <span>AI</span>
            </button>
            {[1, 2, 3].map((idx) => (
                <button
                    key={idx}
                    type="button"
                    className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                        aiHorses.has(idx)
                            ? 'bg-green-600 text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => toggleHorse(idx)}
                    title={`Toggle AI for ${HORSE_NAMES[idx]}`}
                >
                    {HORSE_NAMES[idx]}
                </button>
            ))}
        </div>
    );
}
