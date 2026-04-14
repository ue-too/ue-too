// apps/horse-racing/src/App.tsx
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { HorsePicker } from '@/components/race/HorsePicker';
import { RaceEndOverlay } from '@/components/race/RaceEndOverlay';
import { RaceToolbar } from '@/components/race/RaceToolbar';
import { StaminaOverlay } from '@/components/race/StaminaOverlay';
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

    const initFunction = useMemo(
        () => makeInitApp(handle => setSimHandle(handle)),
        []
    );

    useEffect(() => {
        if (!simHandle) return;
        const unsubscribe = simHandle.onPhaseChange((p, order) => {
            setPhase(p);
            setFinishOrder(order);
        });
        return () => {
            unsubscribe();
        };
    }, [simHandle]);

    // Sim cleanup is handled by components.cleanups in init-app.ts,
    // not by a React effect — avoids the Strict Mode double-mount race.

    return (
        <div className="app">
            <Wrapper option={WRAPPER_OPTION} initFunction={initFunction}>
                <ScrollBarDisplay />
                <RaceToolbar sim={simHandle} phase={phase} />
                {phase === 'gate' && simHandle && (
                    <HorsePicker
                        sim={simHandle}
                        horses={simHandle.getHorses().map(h => ({
                            id: h.id,
                            color: h.color,
                        }))}
                    />
                )}
                {phase === 'finished' && simHandle && (
                    <RaceEndOverlay order={finishOrder} sim={simHandle} />
                )}
                {simHandle && phase === 'running' && (
                    <StaminaOverlay sim={simHandle} />
                )}
            </Wrapper>
        </div>
    );
};

export default App;
