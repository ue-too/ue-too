// apps/horse-racing/src/pages/race-v2.tsx
import { ScrollBarDisplay, Wrapper } from '@ue-too/board-pixi-react-integration';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { HorsePicker } from '@/components/race-v2/HorsePicker';
import { RaceEndOverlay } from '@/components/race-v2/RaceEndOverlay';
import { RaceToolbar } from '@/components/race-v2/RaceToolbar';
import type { RacePhase, V2SimHandle } from '@/simulation/v2';
import { makeInitRaceV2 } from '@/utils/init-race-v2';

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

export function RaceV2Page(): ReactNode {
    const [simHandle, setSimHandle] = useState<V2SimHandle | null>(null);
    const [phase, setPhase] = useState<RacePhase>('gate');
    const [finishOrder, setFinishOrder] = useState<number[]>([]);

    const initFunction = useMemo(
        () => makeInitRaceV2((handle) => setSimHandle(handle)),
        [],
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

    // Sim cleanup is handled by components.cleanups in init-race-v2.ts,
    // not by a React effect — avoids the Strict Mode double-mount race.

    return (
        <div className="app">
            <Wrapper option={WRAPPER_OPTION} initFunction={initFunction}>
                <ScrollBarDisplay />
                <RaceToolbar sim={simHandle} phase={phase} />
                {phase === 'gate' && simHandle && <HorsePicker sim={simHandle} />}
                {phase === 'finished' && simHandle && (
                    <RaceEndOverlay order={finishOrder} sim={simHandle} />
                )}
            </Wrapper>
        </div>
    );
}
