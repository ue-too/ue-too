import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { V2SimHandle } from '@/simulation';

interface HorseStaminaInfo {
    id: number;
    color: number;
    stamina: number;
    maxStamina: number;
    speed: number;
    cruiseSpeed: number;
    maxSpeed: number;
    progress: number;
}

function hexColor(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
}

interface Props {
    sim: V2SimHandle;
}

export function StaminaOverlay({ sim }: Props): ReactNode {
    const [horses, setHorses] = useState<HorseStaminaInfo[]>([]);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        function tick() {
            const h = sim.getHorses();
            setHorses(
                h.map((horse) => ({
                    id: horse.id,
                    color: horse.color,
                    stamina: horse.currentStamina,
                    maxStamina: horse.baseAttributes.maxStamina,
                    speed: horse.tangentialVel,
                    cruiseSpeed: horse.effectiveAttributes.cruiseSpeed,
                    maxSpeed: horse.effectiveAttributes.maxSpeed,
                    progress: horse.trackProgress,
                })),
            );
            rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [sim]);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 14px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 10,
                zIndex: 10,
                pointerEvents: 'none',
                fontFamily: 'monospace',
                fontSize: 12,
                minWidth: 260,
            }}
        >
            <span style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>
                Stamina
            </span>
            {horses.map((h) => {
                const ratio = h.maxStamina > 0 ? h.stamina / h.maxStamina : 0;
                const barColor =
                    ratio > 0.3 ? hexColor(h.color) : ratio > 0 ? '#ff8800' : '#ff2222';
                return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: hexColor(h.color),
                                flexShrink: 0,
                            }}
                        />
                        <div
                            style={{
                                flex: 1,
                                height: 8,
                                background: '#333',
                                borderRadius: 4,
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${(ratio * 100).toFixed(1)}%`,
                                    height: '100%',
                                    background: barColor,
                                    borderRadius: 4,
                                    transition: 'width 0.05s linear',
                                }}
                            />
                        </div>
                        <span style={{ color: '#ccc', width: 36, textAlign: 'right' }}>
                            {Math.round(h.stamina)}
                        </span>
                        <span style={{ color: '#888', width: 60, textAlign: 'right' }}>
                            {h.speed.toFixed(1)} m/s
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
