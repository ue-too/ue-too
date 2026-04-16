import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { BT_ARCHETYPE_IDS } from '@/ai/bt-jockey';
import type { V2SimHandle } from '@/simulation';

interface ModelEntry {
    label: string;
    url: string;
}

interface Props {
    sim: V2SimHandle;
    horses: { id: number; color: number }[];
    btVersion?: number;
}

const HORSE_COUNT_OPTIONS = [2, 3, 4, 6, 8, 10, 12];

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

const selectStyle = {
    padding: '4px 6px',
    borderRadius: 6,
    border: '1px solid #555',
    background: '#222',
    color: 'white',
    fontSize: 11,
    cursor: 'pointer',
    maxWidth: 110,
} as const;

const mainSelectStyle = {
    ...selectStyle,
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 8,
    maxWidth: 'none',
} as const;

/** ONNX list comes from `/models/manifest.json` (vite scans .onnx only). BT URLs are merged in. */
function btManifestEntries(): ModelEntry[] {
    return BT_ARCHETYPE_IDS.map(id => ({
        label: `BT · ${id}`,
        url: `bt://${id}`,
    }));
}

function readHorseModels(sim: V2SimHandle, horses: { id: number }[]): Record<number, string> {
    const out: Record<number, string> = {};
    for (const h of horses) {
        const url = sim.getHorseJockeyUrl(h.id);
        if (url) out[h.id] = url;
    }
    return out;
}

export function HorsePicker({ sim, horses, btVersion }: Props): ReactNode {
    const [selected, setSelected] = useState<number | null>(null);
    const [onnxModels, setOnnxModels] = useState<ModelEntry[]>([]);
    const [tracks, setTracks] = useState<ModelEntry[]>([]);
    const [currentTrack, setCurrentTrack] = useState<string>('/tracks/test_oval.json');
    const [horseCount, setHorseCount] = useState(sim.getHorseCount());
    const [horseModels, setHorseModels] = useState<Record<number, string>>(() => readHorseModels(sim, horses));
    const [loadingHorse, setLoadingHorse] = useState<number | null>(null);
    const [loadingTrack, setLoadingTrack] = useState(false);

    useEffect(() => {
        setHorseCount(sim.getHorseCount());
        setHorseModels(readHorseModels(sim, horses));
    }, [sim, horses]);

    useEffect(() => {
        fetch('/models/manifest.json')
            .then(res => res.json())
            .then((data: ModelEntry[]) =>
                setOnnxModels(Array.isArray(data) ? data : [])
            )
            .catch(() => setOnnxModels([]));
        fetch('/tracks/manifest.json')
            .then(res => res.json())
            .then((data: ModelEntry[]) => setTracks(data))
            .catch(() => setTracks([]));
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const models = useMemo(() => [...btManifestEntries(), ...onnxModels], [onnxModels, btVersion]);

    const onTrackChange = async (url: string) => {
        if (url === currentTrack) return;
        setLoadingTrack(true);
        try {
            await sim.setTrack(url);
            setCurrentTrack(url);
            // Changing track resets the race, so clear per-horse model state
            setHorseModels({});
            setSelected(null);
        } catch (err) {
            console.error(`Failed to load track ${url}:`, err);
        } finally {
            setLoadingTrack(false);
        }
    };

    const pick = (id: number | null) => {
        setSelected(id);
        sim.pickHorse(id);
    };

    const onHorseModelChange = async (horseId: number, url: string) => {
        setHorseModels(prev => ({ ...prev, [horseId]: url }));
        setLoadingHorse(horseId);
        try {
            await sim.setHorseJockeyUrl(horseId, url || null);
        } catch (err) {
            console.error(`Failed to load model for horse ${horseId}:`, err);
            setHorseModels(prev => ({ ...prev, [horseId]: '' }));
        } finally {
            setLoadingHorse(null);
        }
    };

    const onAllHorsesModelChange = async (url: string) => {
        const ids = horses
            .filter(h => h.id !== selected)
            .map(h => h.id);
        if (ids.length === 0) return;
        setHorseModels(prev => {
            const next = { ...prev };
            for (const id of ids) next[id] = url;
            return next;
        });
        try {
            await Promise.all(
                ids.map(id => sim.setHorseJockeyUrl(id, url || null))
            );
        } catch (err) {
            console.error('Failed to apply model to all horses:', err);
        }
    };

    const onHorseCountChange = (count: number) => {
        setHorseCount(count);
        setSelected(null);
        setHorseModels({});
        sim.setHorseCount(count);
    };

    const resetSetup = () => {
        for (const h of horses) {
            sim.setHorseJockeyUrl(h.id, null);
        }
        const defaultCount = 4;
        setHorseCount(defaultCount);
        setSelected(null);
        setHorseModels({});
        sim.setHorseCount(defaultCount);
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 12,
                zIndex: 10,
                pointerEvents: 'auto',
            }}
        >
            {/* Track picker */}
            {tracks.length > 0 && (
                <select
                    value={currentTrack}
                    onChange={e => onTrackChange(e.target.value)}
                    disabled={loadingTrack}
                    style={mainSelectStyle}
                >
                    {tracks.map(t => (
                        <option key={t.url} value={t.url}>
                            {t.label}
                        </option>
                    ))}
                </select>
            )}

            {/* Horse count picker + reset setup */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                    value={horseCount}
                    onChange={e => onHorseCountChange(Number(e.target.value))}
                    style={mainSelectStyle}
                >
                    {HORSE_COUNT_OPTIONS.map(n => (
                        <option key={n} value={n}>
                            {n} Horses
                        </option>
                    ))}
                </select>
                <button
                    onClick={resetSetup}
                    title="Reset horse count and AI selections to defaults"
                    style={{
                        ...mainSelectStyle,
                        color: '#aaa',
                    }}
                >
                    Reset
                </button>
            </div>

            {/* Apply model to all horses at once (excluding player) */}
            {models.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: '#aaa',
                    }}
                >
                    <span>All horses:</span>
                    <select
                        value=""
                        onChange={e => {
                            if (e.target.value !== '__label__') {
                                onAllHorsesModelChange(e.target.value);
                            }
                        }}
                        style={{ ...selectStyle, maxWidth: 160 }}
                    >
                        <option value="__label__">— set all —</option>
                        <option value="">No AI</option>
                        {models.map(m => (
                            <option key={m.url} value={m.url}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Per-horse model + pick buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {horses.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => pick(h.id)}
                            aria-label={`Pick horse ${h.id + 1}`}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                border:
                                    selected === h.id
                                        ? '3px solid white'
                                        : '2px solid #555',
                                background: hex(h.color),
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                        />
                        {models.length > 0 && (
                            <select
                                value={horseModels[h.id] ?? ''}
                                onChange={e => onHorseModelChange(h.id, e.target.value)}
                                disabled={loadingHorse === h.id || selected === h.id}
                                style={{
                                    ...selectStyle,
                                    opacity: selected === h.id ? 0.4 : 1,
                                }}
                            >
                                <option value="">No AI</option>
                                {models.map(m => (
                                    <option key={m.url} value={m.url}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
