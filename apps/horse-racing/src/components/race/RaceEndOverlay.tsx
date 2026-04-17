// apps/horse-racing/src/components/race-v2/RaceEndOverlay.tsx
import { type ReactNode, useCallback } from 'react';

import type { V2SimHandle } from '@/simulation';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

interface Props {
    order: number[];
    sim: V2SimHandle;
}

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function RaceEndOverlay({ order, sim }: Props): ReactNode {
    const exportRace = useCallback(() => {
        const recording = sim.exportRace();
        if (!recording) return;
        const json = JSON.stringify(recording);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `race-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [sim]);

    const horses = sim.getHorses();
    const colorMap = new Map(horses.map(h => [h.id, h.color]));

    // Build a row per horse: first the finishers in order, then any DNFs.
    const finishers = order.map((id, idx) => ({
        id,
        rank: idx,
        dnf: false,
    }));
    const finished = new Set(order);
    const dnfs = horses
        .map(h => h.id)
        .filter(id => !finished.has(id))
        .map(id => ({ id, rank: -1, dnf: true }));

    const rows = [...finishers, ...dnfs];

    return (
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '24px 32px',
                background: 'rgba(15,15,15,0.95)',
                borderRadius: 16,
                zIndex: 20,
                pointerEvents: 'auto',
                color: 'white',
                minWidth: 260,
            }}
        >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20, textAlign: 'center' }}>
                Finish
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((r) => (
                    <div
                        key={r.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 15,
                        }}
                    >
                        <span
                            style={{
                                width: 36,
                                color: r.dnf ? '#888' : 'white',
                                fontWeight: 600,
                            }}
                        >
                            {r.dnf ? 'DNF' : ORDINALS[r.rank]}
                        </span>
                        <span
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                background: hex(colorMap.get(r.id) ?? 0x888888),
                                display: 'inline-block',
                            }}
                        />
                        <span>Horse {r.id + 1}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                    onClick={exportRace}
                    style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: 15,
                        borderRadius: 8,
                        border: '1px solid #888',
                        background: '#333',
                        color: 'white',
                        cursor: 'pointer',
                    }}
                >
                    Export
                </button>
                <button
                    onClick={() => sim.reset()}
                    style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: 15,
                        borderRadius: 8,
                        border: '1px solid #888',
                        background: '#222',
                        color: 'white',
                        cursor: 'pointer',
                    }}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
