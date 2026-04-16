// apps/horse-racing/src/components/race-v2/RaceToolbar.tsx
import { type ReactNode, useCallback, useRef } from 'react';

import type { RacePhase, RaceRecording, V2SimHandle } from '@/simulation';

interface Props {
    sim: V2SimHandle | null;
    phase: RacePhase;
    onOpenBtTune?: () => void;
    onImportRace?: (recording: RaceRecording) => void;
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

export function RaceToolbar({ sim, phase, onOpenBtTune, onImportRace }: Props): ReactNode {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const rec = JSON.parse(reader.result as string) as RaceRecording;
                    if (!rec.frames || !Array.isArray(rec.frames)) return;
                    onImportRace?.(rec);
                } catch { /* ignore bad json */ }
            };
            reader.readAsText(file);
            e.target.value = '';
        },
        [onImportRace]
    );

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
                pointerEvents: 'auto',
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
            {phase === 'gate' && (
                <>
                    <button
                        style={buttonStyle}
                        onClick={() => fileRef.current?.click()}
                        title="Import a race recording (.json)"
                    >
                        Import Race
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />
                </>
            )}
            {(phase === 'running' || phase === 'finished') && (
                <button style={buttonStyle} onClick={() => sim.reset()}>
                    Reset
                </button>
            )}
            {onOpenBtTune && (
                <button
                    type="button"
                    style={buttonStyle}
                    onClick={onOpenBtTune}
                    title="Open BT workbench — edit knobs, run races, export configs"
                >
                    Workbench
                </button>
            )}
        </div>
    );
}
