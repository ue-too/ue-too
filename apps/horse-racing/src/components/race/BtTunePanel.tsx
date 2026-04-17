import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
    BT_ARCHETYPE_IDS,
    DEFAULT_CONFIG,
    type BTConfig,
} from '@/ai/bt-jockey';
import type { BtBatchResult } from '@/simulation';
import type { V2SimHandle } from '@/simulation';

const DEFAULT_SLOT_ORDER = [
    'front-runner',
    'closer',
    'stalker',
    'speedball',
    'steady',
    'drifter',
];

interface Props {
    sim: V2SimHandle;
    onClose: () => void;
}

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 4,
    display: 'block',
};

const inputStyle: React.CSSProperties = {
    background: '#2a2a2a',
    border: '1px solid #555',
    borderRadius: 6,
    color: 'white',
    padding: '6px 8px',
    fontSize: 13,
};

export function BtTunePanel({ sim, onClose }: Props): ReactNode {
    const [horseCount, setHorseCount] = useState(4);
    const [slots, setSlots] = useState<string[]>(() => [
        ...DEFAULT_SLOT_ORDER.slice(0, 4),
    ]);
    const [numRaces, setNumRaces] = useState(200);
    const [seedStr, setSeedStr] = useState('');
    const [randomize, setRandomize] = useState(false);
    const [useOverrides, setUseOverrides] = useState(false);
    const [ov, setOv] = useState({
        wPass: DEFAULT_CONFIG.wPass,
        wKick: DEFAULT_CONFIG.wKick,
        wDraft: DEFAULT_CONFIG.wDraft,
        kickPhase: DEFAULT_CONFIG.kickPhase,
        targetLane: DEFAULT_CONFIG.targetLane,
        cruiseLow: DEFAULT_CONFIG.cruiseLow,
        cruiseHigh: DEFAULT_CONFIG.cruiseHigh,
    });
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BtBatchResult | null>(null);

    useEffect(() => {
        setSlots(prev => {
            const next = prev.slice(0, horseCount);
            for (let i = next.length; i < horseCount; i++) {
                next.push(DEFAULT_SLOT_ORDER[i % DEFAULT_SLOT_ORDER.length]);
            }
            return next;
        });
    }, [horseCount]);

    const archetypeOptions = useMemo(() => BT_ARCHETYPE_IDS, []);

    const runBatch = useCallback(async () => {
        setError(null);
        setResult(null);
        setRunning(true);
        setProgress(0);
        try {
            const seed =
                seedStr.trim() === '' ? undefined : parseInt(seedStr, 10);
            if (seedStr.trim() !== '' && !Number.isFinite(seed)) {
                throw new Error('Seed must be a valid integer.');
            }
            const globalOverrides: Partial<BTConfig> | undefined = useOverrides
                ? {
                      wPass: ov.wPass,
                      wKick: ov.wKick,
                      wDraft: ov.wDraft,
                      kickPhase: ov.kickPhase,
                      targetLane: ov.targetLane,
                      cruiseLow: ov.cruiseLow,
                      cruiseHigh: ov.cruiseHigh,
                  }
                : undefined;

            const res = await sim.runBtBatch({
                races: numRaces,
                horseCount,
                slotArchetypes: slots.slice(0, horseCount),
                randomizeAttributes: randomize,
                seed,
                globalOverrides,
                onProgress: (done, total) => setProgress(done / total),
            });
            setResult(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setRunning(false);
            setProgress(0);
        }
    }, [
        sim,
        numRaces,
        horseCount,
        slots,
        randomize,
        seedStr,
        useOverrides,
        ov,
    ]);

    const rows = useMemo(() => {
        if (!result) return [];
        return Object.entries(result.byArchetype).sort(([a], [b]) =>
            a.localeCompare(b)
        );
    }, [result]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 56,
                left: 16,
                width: 380,
                maxHeight: 'min(78vh, 720px)',
                overflow: 'auto',
                zIndex: 45,
                pointerEvents: 'auto',
                background: 'rgba(18,18,18,0.96)',
                border: '1px solid #444',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
                color: '#eee',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                }}
            >
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                    BT batch tuning
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        border: 'none',
                        background: '#333',
                        color: '#ccc',
                        borderRadius: 6,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: 13,
                    }}
                >
                    Close
                </button>
            </div>

            <p style={{ fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 1.45 }}>
                Headless races on the <strong>current track</strong> (same geometry as
                the sim). All horses use BT jockeys — no ONNX. Stats mirror Python{' '}
                <code style={{ fontSize: 11 }}>tune_bt.py</code>: win rate and mean
                finish place per archetype.
            </p>

            <label style={labelStyle}>Horses</label>
            <select
                value={horseCount}
                onChange={e => setHorseCount(Number(e.target.value))}
                style={{ ...inputStyle, width: '100%', marginBottom: 10 }}
            >
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>
                        {n} horses
                    </option>
                ))}
            </select>

            {slots.slice(0, horseCount).map((name, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 2 }}>
                        Slot {i} archetype
                    </label>
                    <select
                        value={name}
                        onChange={e => {
                            const v = e.target.value;
                            setSlots(s => {
                                const copy = [...s];
                                copy[i] = v;
                                return copy;
                            });
                        }}
                        style={{ ...inputStyle, width: '100%' }}
                    >
                        {archetypeOptions.map(id => (
                            <option key={id} value={id}>
                                {id}
                            </option>
                        ))}
                    </select>
                </div>
            ))}

            <label style={labelStyle}>Batch size (races)</label>
            <input
                type="number"
                min={1}
                max={5000}
                value={numRaces}
                onChange={e => setNumRaces(Number(e.target.value) || 1)}
                style={{ ...inputStyle, width: '100%', marginBottom: 10 }}
            />

            <label style={labelStyle}>Seed (optional, reproducible batch)</label>
            <input
                type="text"
                placeholder="random"
                value={seedStr}
                onChange={e => setSeedStr(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginBottom: 10 }}
            />

            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    marginBottom: 10,
                    cursor: 'pointer',
                }}
            >
                <input
                    type="checkbox"
                    checked={randomize}
                    onChange={e => setRandomize(e.target.checked)}
                />
                Randomize horse attributes (±trait ranges, weight fixed)
            </label>

            <details style={{ marginBottom: 12 }}>
                <summary
                    style={{
                        fontSize: 13,
                        cursor: 'pointer',
                        color: '#aaa',
                        marginBottom: 8,
                    }}
                >
                    Global BT overrides
                </summary>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        marginBottom: 8,
                        cursor: 'pointer',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={useOverrides}
                        onChange={e => setUseOverrides(e.target.checked)}
                    />
                    Apply overrides on top of each slot&apos;s archetype
                </label>
                {useOverrides && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                        }}
                    >
                        {(
                            [
                                ['wPass', 'w_pass', 0.2, 2.5],
                                ['wKick', 'w_kick', 0.2, 2.5],
                                ['wDraft', 'w_draft', 0.2, 2.5],
                                ['kickPhase', 'kick_phase', 0.5, 0.95],
                                ['targetLane', 'lane', -0.95, -0.05],
                                ['cruiseLow', 'cruise_lo', 0.3, 0.85],
                                ['cruiseHigh', 'cruise_hi', 0.35, 0.92],
                            ] as const
                        ).map(([key, short, minV, maxV]) => (
                            <label key={key} style={{ fontSize: 11 }}>
                                <span style={{ color: '#888' }}>{short}</span>
                                <input
                                    type="number"
                                    step={0.01}
                                    value={ov[key as keyof typeof ov]}
                                    min={minV}
                                    max={maxV}
                                    onChange={e => {
                                        const v = parseFloat(e.target.value);
                                        if (!Number.isFinite(v)) return;
                                        setOv(o => ({
                                            ...o,
                                            [key]: v,
                                        }));
                                    }}
                                    style={{
                                        ...inputStyle,
                                        width: '100%',
                                        marginTop: 4,
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                )}
            </details>

            <button
                type="button"
                disabled={running}
                onClick={() => void runBatch()}
                style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: running ? '#444' : 'linear-gradient(90deg, #4a9eff, #22d3ee)',
                    color: running ? '#888' : '#0a0a0a',
                    fontWeight: 600,
                    cursor: running ? 'wait' : 'pointer',
                    marginBottom: running ? 8 : 12,
                }}
            >
                {running
                    ? `Running… ${Math.round(progress * 100)}%`
                    : 'Run batch'}
            </button>

            {error && (
                <div
                    style={{
                        fontSize: 12,
                        color: '#f66',
                        marginBottom: 10,
                    }}
                >
                    {error}
                </div>
            )}

            {result && (
                <div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                        Mean ticks / race: {result.meanTicks.toFixed(0)}
                    </div>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 12,
                        }}
                    >
                        <thead>
                            <tr style={{ color: '#999', textAlign: 'left' }}>
                                <th style={{ padding: '4px 6px' }}>Archetype</th>
                                <th style={{ padding: '4px 6px' }}>Win%</th>
                                <th style={{ padding: '4px 6px' }}>Mean place</th>
                                <th style={{ padding: '4px 6px' }}>n</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(([name, agg]) => {
                                const winPct =
                                    agg.appearances > 0
                                        ? (100 * agg.wins) / agg.appearances
                                        : 0;
                                const meanPlace =
                                    agg.appearances > 0
                                        ? agg.placeSum / agg.appearances
                                        : 0;
                                return (
                                    <tr key={name}>
                                        <td style={{ padding: '6px 6px' }}>
                                            {name}
                                        </td>
                                        <td style={{ padding: '6px 6px' }}>
                                            {winPct.toFixed(1)}
                                        </td>
                                        <td style={{ padding: '6px 6px' }}>
                                            {meanPlace.toFixed(2)}
                                        </td>
                                        <td style={{ padding: '6px 6px' }}>
                                            {agg.appearances}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
