import { type ReactNode, useEffect, useState } from 'react';

import type { V2SimHandle } from '@/simulation';

interface Props {
    sim: V2SimHandle;
}

export function PlaybackControls({ sim }: Props): ReactNode {
    const [frame, setFrame] = useState(0);
    const [totalFrames, setTotalFrames] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        return sim.onPlaybackProgress((f, total, p) => {
            setFrame(f);
            setTotalFrames(total);
            setPaused(p);
        });
    }, [sim]);

    if (totalFrames === 0) return null;

    const pct = Math.min(100, (frame / totalFrames) * 100);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: 'rgba(20, 20, 20, 0.9)',
                borderRadius: 28,
                color: 'white',
                zIndex: 20,
                pointerEvents: 'auto',
                minWidth: 400,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
        >
            <button
                onClick={() => sim.togglePlayback()}
                aria-label={paused ? 'Resume' : 'Pause'}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    border: 'none',
                    background: paused ? '#4a9eff' : '#333',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 14,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {paused ? '▶' : '❚❚'}
            </button>

            <input
                type="range"
                min={0}
                max={Math.max(0, totalFrames - 1)}
                value={frame}
                onChange={e => sim.seekPlayback(Number(e.target.value))}
                style={{
                    flexGrow: 1,
                    accentColor: '#4a9eff',
                    cursor: 'pointer',
                }}
            />

            <div
                style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#aaa',
                    minWidth: 60,
                    textAlign: 'right',
                }}
            >
                {Math.round(pct)}%
            </div>
        </div>
    );
}
