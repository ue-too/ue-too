import { ChevronFirst, ChevronLast, Pause, Play } from 'lucide-react';
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

    const stepBy = (delta: number) => {
        // Pause before stepping so auto-advance doesn't immediately move
        // the frame forward again.
        if (!paused) sim.togglePlayback();
        sim.seekPlayback(frame + delta);
    };

    const iconBtn = {
        width: 32,
        height: 32,
        borderRadius: 16,
        border: 'none',
        background: '#333',
        color: 'white',
        cursor: 'pointer',
        fontSize: 13,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    } as const;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: 'rgba(20, 20, 20, 0.9)',
                borderRadius: 28,
                color: 'white',
                zIndex: 20,
                pointerEvents: 'auto',
                minWidth: 440,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
        >
            <button
                onClick={() => stepBy(-1)}
                aria-label="Step back one frame"
                title="Step back"
                style={iconBtn}
            >
                <ChevronFirst size={16} />
            </button>

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
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {paused ? (
                    <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
                ) : (
                    <Pause size={16} fill="currentColor" />
                )}
            </button>

            <button
                onClick={() => stepBy(1)}
                aria-label="Step forward one frame"
                title="Step forward"
                style={iconBtn}
            >
                <ChevronLast size={16} />
            </button>

            <input
                type="range"
                min={0}
                max={Math.max(0, totalFrames - 1)}
                value={frame}
                onChange={e => sim.seekPlayback(Number(e.target.value))}
                style={{
                    flexGrow: 1,
                    marginLeft: 4,
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
