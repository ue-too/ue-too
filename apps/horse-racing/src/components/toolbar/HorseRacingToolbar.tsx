import { Bot, BotOff, Eye, EyeOff, Home, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import { parseTrackJson } from '@/simulation/track-from-json';
import type { HorseRacingAppComponents } from '@/utils/init-app';

const TRACK_PRESETS = [
    { label: 'exp_track_8', url: '/tracks/exp_track_8.json' },
    { label: 'exp_track_7', url: '/tracks/exp_track_7.json' },
    { label: 'exp_track_6', url: '/tracks/exp_track_6.json' },
    { label: 'exp_track_5', url: '/tracks/exp_track_5.json' },
    { label: 'exp_track_4', url: '/tracks/exp_track_4.json' },
    { label: 'exp_track_3', url: '/tracks/exp_track_3.json' },
    { label: 'exp_track_2', url: '/tracks/exp_track_2.json' },
    { label: 'exp_track', url: '/tracks/exp_track.json' },
    { label: 'track', url: '/tracks/track.json' },
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
        </div>
    );
}

const AI_HORSE_INDEX = 1; // Horse 1 (brown) — horse 0 is player-controlled

function AIToggle() {
    const { result } = usePixiCanvas<HorseRacingAppComponents>();
    const [aiEnabled, setAiEnabled] = useState(false);

    const handle = result.initialized && result.success ? result.components.simHandle : null;

    const toggle = () => {
        if (!handle) return;
        if (aiEnabled) {
            handle.disableAI(AI_HORSE_INDEX);
        } else {
            handle.enableAI(AI_HORSE_INDEX);
        }
        setAiEnabled(!aiEnabled);
    };

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
                aiEnabled
                    ? 'text-green-600'
                    : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={toggle}
            title="Toggle AI control for horse 1 (brown)"
        >
            {aiEnabled ? (
                <Bot className="size-3.5" aria-hidden />
            ) : (
                <BotOff className="size-3.5" aria-hidden />
            )}
            <span>{aiEnabled ? 'AI (Horse 2)' : 'AI'}</span>
        </button>
    );
}
