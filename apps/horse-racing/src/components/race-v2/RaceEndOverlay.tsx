// apps/horse-racing/src/components/race-v2/RaceEndOverlay.tsx
import type { ReactNode } from 'react';

import type { V2SimHandle } from '@/simulation/v2';

const HORSE_COLORS = [0xc9a227, 0x4169e1, 0xe53935, 0x43a047];
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

interface Props {
    order: number[];
    sim: V2SimHandle;
}

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function RaceEndOverlay({ order, sim }: Props): ReactNode {
    // Build a row per horse: first the finishers in order, then any DNFs.
    const finishers = order.map((id, idx) => ({
        id,
        rank: idx,
        dnf: false,
    }));
    const finished = new Set(order);
    const dnfs = HORSE_COLORS
        .map((_, id) => id)
        .filter((id) => !finished.has(id))
        .map((id) => ({ id, rank: -1, dnf: true }));

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
                                background: hex(HORSE_COLORS[r.id]),
                                display: 'inline-block',
                            }}
                        />
                        <span>Horse {r.id + 1}</span>
                    </div>
                ))}
            </div>
            <button
                onClick={() => sim.reset()}
                style={{
                    marginTop: 20,
                    width: '100%',
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
    );
}
