// apps/horse-racing/src/App.tsx
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { BtWorkbench } from '@/components/race/BtWorkbench';
import { HorsePicker } from '@/components/race/HorsePicker';
import { PlaybackControls } from '@/components/race/PlaybackControls';
import { PlaybackHUD } from '@/components/race/PlaybackHUD';
import { RaceEndOverlay } from '@/components/race/RaceEndOverlay';
import { RaceToolbar } from '@/components/race/RaceToolbar';
import type { RacePhase, V2SimHandle } from '@/simulation';
import { makeInitApp } from '@/utils/init-app';

// Stable reference — the Wrapper's init hook uses `option` as a useEffect
// dep, so a new object identity on every render re-triggers the entire
// Pixi init/destroy cycle (= canvas flash).
const WRAPPER_OPTION = {
    fullScreen: true,
    boundaries: {
        min: { x: -4000, y: -4000 },
        max: { x: 4000, y: 4000 },
    },
} as const;

const App = (): ReactNode => {
    const [simHandle, setSimHandle] = useState<V2SimHandle | null>(null);
    const [phase, setPhase] = useState<RacePhase>('gate');
    const [finishOrder, setFinishOrder] = useState<number[]>([]);
    const [resetKey, setResetKey] = useState(0);
    const [precomputeProgress, setPrecomputeProgress] = useState<number | null>(null);
    const [simulationReady, setSimulationReady] = useState(false);
    const [showWorkbench, setShowWorkbench] = useState(false);
    const [btVersion, setBtVersion] = useState(0);
    const bumpBtVersion = useCallback(() => setBtVersion(v => v + 1), []);
    const [horseLabels, setHorseLabels] = useState<Map<number, string>>(new Map());

    const initFunction = useMemo(
        () => makeInitApp(handle => setSimHandle(handle)),
        []
    );

    useEffect(() => {
        if (!simHandle) return;
        const unsubscribe = simHandle.onPhaseChange((p, order) => {
            setPhase(p);
            setFinishOrder(order);
            if (p === 'gate') {
                setResetKey(k => k + 1);
                setSimulationReady(false);
            }
            if (p === 'running') {
                setSimulationReady(false);
                const labels = new Map<number, string>();
                for (const h of simHandle.getHorses()) {
                    const url = simHandle.getHorseJockeyUrl(h.id);
                    if (url?.startsWith('bt://')) {
                        labels.set(h.id, url.slice(5));
                    } else if (url) {
                        labels.set(h.id, url.split('/').pop()?.replace('.onnx', '') ?? url);
                    } else {
                        labels.set(h.id, 'no AI');
                    }
                }
                setHorseLabels(labels);
            }
        });
        const unsubscribeProgress = simHandle.onPrecomputeProgress(p => {
            setPrecomputeProgress(p);
        });
        const unsubscribeReady = simHandle.onSimulationReady(() => {
            setSimulationReady(true);
        });
        return () => {
            unsubscribe();
            unsubscribeProgress();
            unsubscribeReady();
        };
    }, [simHandle]);

    // Sim cleanup is handled by components.cleanups in init-app.ts,
    // not by a React effect — avoids the Strict Mode double-mount race.

    return (
        <div className="app">
            <Wrapper option={WRAPPER_OPTION} initFunction={initFunction}>
                <ScrollBarDisplay />
                <RaceToolbar
                    sim={simHandle}
                    phase={phase}
                    onOpenBtTune={() => setShowWorkbench(true)}
                />
                {showWorkbench && simHandle && (
                    <BtWorkbench
                        sim={simHandle}
                        onClose={() => setShowWorkbench(false)}
                        onConfigChange={bumpBtVersion}
                    />
                )}
                {phase === 'gate' && simHandle && (
                    <HorsePicker
                        key={resetKey}
                        sim={simHandle}
                        horses={simHandle.getHorses().map(h => ({
                            id: h.id,
                            color: h.color,
                        }))}
                        btVersion={btVersion}
                    />
                )}
                {phase === 'finished' && simHandle && (
                    <RaceEndOverlay order={finishOrder} sim={simHandle} />
                )}
                {simHandle && (phase === 'running' || phase === 'finished') && (
                    <>
                        <PlaybackHUD sim={simHandle} horseLabels={horseLabels} />
                        <PlaybackControls sim={simHandle} />
                    </>
                )}
                {(precomputeProgress !== null || simulationReady) && simHandle && (
                    <PrecomputeModal
                        progress={precomputeProgress}
                        ready={simulationReady}
                        onPlay={() => simHandle.playback()}
                    />
                )}
            </Wrapper>
        </div>
    );
};

function PrecomputeModal({
    progress,
    ready,
    onPlay,
}: {
    progress: number | null;
    ready: boolean;
    onPlay: () => void;
}): ReactNode {
    const showProgress = !ready && progress !== null;
    const pct = showProgress ? Math.round((progress ?? 0) * 100) : 100;
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                pointerEvents: 'auto',
            }}
        >
            <div
                style={{
                    background: '#1a1a1a',
                    padding: '24px 32px',
                    borderRadius: 12,
                    minWidth: 280,
                    color: 'white',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
            >
                {ready ? (
                    <>
                        <div style={{ fontSize: 18, marginBottom: 8, fontWeight: 500 }}>
                            Race ready
                        </div>
                        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                            Simulation complete. Click to watch the replay.
                        </div>
                        <button
                            onClick={onPlay}
                            style={{
                                padding: '10px 28px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(90deg, #4a9eff, #22d3ee)',
                                color: '#0a0a0a',
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ▶ Play
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 16, marginBottom: 12, fontWeight: 500 }}>
                            Simulating race...
                        </div>
                        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                            Running physics and AI decisions.
                        </div>
                        <div
                            style={{
                                width: '100%',
                                height: 8,
                                background: '#333',
                                borderRadius: 4,
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #4a9eff, #22d3ee)',
                                    transition: 'width 0.15s ease-out',
                                }}
                            />
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                            {pct}%
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
