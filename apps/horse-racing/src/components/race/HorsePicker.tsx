import { useState, type ReactNode } from 'react';

import type { V2SimHandle } from '@/simulation';

const HORSE_COLORS = [0xc9a227, 0x4169e1, 0xe53935, 0x43a047];

interface Props {
    sim: V2SimHandle;
}

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function HorsePicker({ sim }: Props): ReactNode {
    const [selected, setSelected] = useState<number | null>(null);

    const pick = (id: number | null) => {
        setSelected(id);
        sim.pickHorse(id);
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 12,
                padding: '12px 16px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 12,
                zIndex: 10,
                pointerEvents: 'auto',
            }}
        >
            {HORSE_COLORS.map((color, id) => (
                <button
                    key={id}
                    onClick={() => pick(id)}
                    aria-label={`Pick horse ${id + 1}`}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        border: selected === id ? '3px solid white' : '2px solid #555',
                        background: hex(color),
                        cursor: 'pointer',
                    }}
                />
            ))}
            <button
                onClick={() => pick(null)}
                style={{
                    padding: '0 14px',
                    borderRadius: 22,
                    border: selected === null ? '3px solid white' : '2px solid #555',
                    background: '#333',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 14,
                }}
            >
                Watch
            </button>
        </div>
    );
}
