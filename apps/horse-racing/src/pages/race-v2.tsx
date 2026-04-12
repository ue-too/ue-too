import { ScrollBarDisplay, Wrapper } from '@ue-too/board-pixi-react-integration';
import { useMemo, useRef, type ReactNode } from 'react';

import { makeInitRaceV2 } from '@/utils/init-race-v2';
import type { V2SimHandle } from '@/simulation/v2';

export function RaceV2Page(): ReactNode {
    const handleRef = useRef<V2SimHandle | null>(null);

    const initFunction = useMemo(() => {
        return makeInitRaceV2((handle) => {
            handleRef.current = handle;
            // Task 10 only: hardcode the player to horse 0 and auto-start.
            // This entire block is replaced by real chrome in Task 11+.
            handle.pickHorse(0);
            handle.start();
        });
    }, []);

    return (
        <div className="app">
            <Wrapper
                option={{
                    fullScreen: true,
                    boundaries: {
                        min: { x: -4000, y: -4000 },
                        max: { x: 4000, y: 4000 },
                    },
                }}
                initFunction={initFunction}
            >
                <ScrollBarDisplay />
            </Wrapper>
        </div>
    );
}
