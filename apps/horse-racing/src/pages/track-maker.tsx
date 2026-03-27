import { useEffect } from 'react';
import {
    ScrollBarDisplay,
    Wrapper,
    usePixiCanvas,
} from '@ue-too/board-pixi-react-integration';

import { TrackMakerToolbar } from '@/components/track-maker/TrackMakerToolbar';
import { CurveSidebar } from '@/components/track-maker/CurveSidebar';
import { initTrackMaker, type TrackMakerAppComponents } from '@/track-maker/init-track-maker';

function TrackMakerKeyboardHandler() {
    const { result } = usePixiCanvas<TrackMakerAppComponents>();

    useEffect(() => {
        if (!result.initialized || !result.success) return;
        const sm = result.components.stateMachine;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture keys when typing in inputs
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            console.log('[TrackMaker] keydown:', e.key, '| current state:', sm.currentState, '| target:', tag);

            let handled = true;
            switch (e.key) {
                case 'g':
                case 'G': {
                    const result = sm.happens('G');
                    console.log('[TrackMaker] G result:', result, '| new state:', sm.currentState);
                    break;
                }
                case 'Tab': {
                    const result = sm.happens('tabKey');
                    console.log('[TrackMaker] tabKey result:', result, '| new state:', sm.currentState);
                    break;
                }
                case 'Escape': {
                    const result = sm.happens('escapeKey');
                    console.log('[TrackMaker] escapeKey result:', result, '| new state:', sm.currentState);
                    break;
                }
                case 'Delete':
                case 'Backspace': {
                    const result = sm.happens('deleteKey');
                    console.log('[TrackMaker] deleteKey result:', result, '| new state:', sm.currentState);
                    break;
                }
                default:
                    handled = false;
            }
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [result]);

    return null;
}

export function TrackMakerPage(): React.ReactNode {
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
                initFunction={initTrackMaker}
            >
                <ScrollBarDisplay />
                <TrackMakerToolbar />
                <CurveSidebar />
                <TrackMakerKeyboardHandler />
            </Wrapper>
        </div>
    );
}
