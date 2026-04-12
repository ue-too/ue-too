// apps/horse-racing/src/components/race-v2/RaceToolbar.tsx
import type { ReactNode } from 'react';

import type { RacePhase, V2SimHandle } from '@/simulation/v2';

interface Props {
    sim: V2SimHandle | null;
    phase: RacePhase;
}

const buttonStyle: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #888',
    background: '#222',
    color: 'white',
    cursor: 'pointer',
};

export function RaceToolbar({ sim, phase }: Props): ReactNode {
    if (!sim) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 10,
                zIndex: 10,
                alignItems: 'center',
            }}
        >
            <span style={{ color: '#aaa', fontSize: 13, marginRight: 4 }}>
                {phase}
            </span>
            {phase === 'gate' && (
                <button style={buttonStyle} onClick={() => sim.start()}>
                    Start
                </button>
            )}
            {(phase === 'running' || phase === 'finished') && (
                <button style={buttonStyle} onClick={() => sim.reset()}>
                    Reset
                </button>
            )}
        </div>
    );
}
