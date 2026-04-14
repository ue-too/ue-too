import { type ReactNode, useEffect, useState } from 'react';

import { NullJockey, OnnxJockey } from '@/ai';
import type { V2SimHandle } from '@/simulation';

interface ModelEntry {
    label: string;
    url: string;
}

interface Props {
    sim: V2SimHandle;
    horses: { id: number; color: number }[];
}

const HORSE_COUNT_OPTIONS = [2, 3, 4, 6, 8, 10, 12];

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

const selectStyle = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #555',
    background: '#222',
    color: 'white',
    fontSize: 13,
    cursor: 'pointer',
} as const;

export function HorsePicker({ sim, horses }: Props): ReactNode {
    const [selected, setSelected] = useState<number | null>(null);
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [horseCount, setHorseCount] = useState(sim.getHorseCount());

    useEffect(() => {
        fetch('/models/manifest.json')
            .then(res => res.json())
            .then((data: ModelEntry[]) => setModels(data))
            .catch(() => setModels([]));
    }, []);

    const pick = (id: number | null) => {
        setSelected(id);
        sim.pickHorse(id);
    };

    const onModelChange = async (url: string) => {
        setSelectedModel(url);
        if (!url) {
            sim.setJockey(new NullJockey());
            return;
        }
        setLoading(true);
        try {
            const jockey = await OnnxJockey.create(url);
            sim.setJockey(jockey);
        } catch (err) {
            console.error('Failed to load model:', err);
            sim.setJockey(new NullJockey());
            setSelectedModel('');
        } finally {
            setLoading(false);
        }
    };

    const onHorseCountChange = (count: number) => {
        setHorseCount(count);
        setSelected(null);
        sim.setHorseCount(count);
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
                gap: 12,
                padding: '12px 16px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 12,
                zIndex: 10,
                pointerEvents: 'auto',
            }}
        >
            {/* Settings row */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Model picker */}
                {models.length > 0 && (
                    <select
                        value={selectedModel}
                        onChange={e => onModelChange(e.target.value)}
                        disabled={loading}
                        style={selectStyle}
                    >
                        <option value="">No AI Model</option>
                        {models.map(m => (
                            <option key={m.url} value={m.url}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Horse count picker */}
                <select
                    value={horseCount}
                    onChange={e => onHorseCountChange(Number(e.target.value))}
                    style={selectStyle}
                >
                    {HORSE_COUNT_OPTIONS.map(n => (
                        <option key={n} value={n}>
                            {n} Horses
                        </option>
                    ))}
                </select>
            </div>

            {/* Horse picker */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {horses.map(h => (
                    <button
                        key={h.id}
                        onClick={() => pick(h.id)}
                        aria-label={`Pick horse ${h.id + 1}`}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            border:
                                selected === h.id
                                    ? '3px solid white'
                                    : '2px solid #555',
                            background: hex(h.color),
                            cursor: 'pointer',
                        }}
                    />
                ))}
                <button
                    onClick={() => pick(null)}
                    style={{
                        padding: '0 14px',
                        borderRadius: 22,
                        border:
                            selected === null
                                ? '3px solid white'
                                : '2px solid #555',
                        background: '#333',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 14,
                    }}
                >
                    Watch
                </button>
            </div>
        </div>
    );
}
