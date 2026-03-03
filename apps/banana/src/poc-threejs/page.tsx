/**
 * Three.js POC page: top-down orthographic view + straight track laying.
 * Entry for the standalone POC route/page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { createScene } from './scene';
import { createTrackState } from './track-state';

export function ThreeJSPOCPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackStateRef = useRef(createTrackState());
    const destroyRef = useRef<(() => void) | null>(null);
    const [layoutActive, setLayoutActive] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const trackState = trackStateRef.current;
        const { destroy } = createScene(el, trackState);
        destroyRef.current = destroy;
        return () => {
            destroy();
            destroyRef.current = null;
        };
    }, []);

    const handleLayoutToggle = useCallback(() => {
        const ts = trackStateRef.current;
        if (layoutActive) {
            ts.endLayout();
            setLayoutActive(false);
        } else {
            ts.startLayout();
            setLayoutActive(true);
        }
    }, [layoutActive]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            trackStateRef.current.endLayout();
            setLayoutActive(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflow: 'hidden',
            }}
        >
            <header
                style={{
                    padding: '8px 12px',
                    background: '#2a2a2a',
                    color: '#eee',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexShrink: 0,
                }}
            >
                <span style={{ fontWeight: 600 }}>
                    Three.js POC — Top-down track laying
                </span>
                <button
                    type="button"
                    onClick={handleLayoutToggle}
                    style={{
                        padding: '6px 12px',
                        background: layoutActive ? '#4a7c4a' : '#444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 500,
                    }}
                >
                    {layoutActive ? 'Stop laying track' : 'Lay straight track'}
                </button>
                {layoutActive && (
                    <span style={{ fontSize: 13, color: '#aaa' }}>
                        Click to set start, then click to set end. Escape to
                        cancel.
                    </span>
                )}
            </header>
            <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
        </div>
    );
}
