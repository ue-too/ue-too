import { Home, Upload } from 'lucide-react';
import { useRef } from 'react';
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
        </div>
    );
}
