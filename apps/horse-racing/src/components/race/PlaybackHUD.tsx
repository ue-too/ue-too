import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import type { HorseFrame, RaceFrame, V2SimHandle } from '@/simulation';

function hexColor(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
}

interface Props {
    sim: V2SimHandle;
    /** Map from horse id → label (archetype / jockey name). */
    horseLabels?: Map<number, string>;
}

interface HorseRow {
    id: number;
    color: number;
    label: string;
    speed: number;
    accel: number;
    progress: number;
    stamina: number;
    maxStamina: number;
    lateralOffset: number;
    finished: boolean;
    place: number | null;
    inputT: number;
    inputN: number;
}

function buildRows(
    sim: V2SimHandle,
    frame: RaceFrame | null,
    prevFrame: RaceFrame | null,
    labels: Map<number, string>
): HorseRow[] {
    const horses = sim.getHorses();
    if (!frame) {
        return horses.map(h => ({
            id: h.id,
            color: h.color,
            label: labels.get(h.id) ?? `Horse ${h.id}`,
            speed: h.tangentialVel,
            accel: 0,
            progress: h.trackProgress,
            stamina: h.currentStamina,
            maxStamina: h.baseAttributes.maxStamina,
            lateralOffset: 0,
            finished: h.finished,
            place: h.finishOrder,
            inputT: 0,
            inputN: 0,
        }));
    }

    return frame.horses.map((hf: HorseFrame) => {
        const horse = horses[hf.id];
        const prevHf = prevFrame?.horses.find(p => p.id === hf.id);
        const accel = prevHf ? hf.tVel - prevHf.tVel : 0;
        const inp = frame.inputs[hf.id];
        return {
            id: hf.id,
            color: horse?.color ?? 0x888888,
            label: labels.get(hf.id) ?? `Horse ${hf.id}`,
            speed: hf.tVel,
            accel,
            progress: hf.progress,
            stamina: hf.stamina,
            maxStamina: horse?.baseAttributes.maxStamina ?? 100,
            lateralOffset: hf.lateralOffset,
            finished: hf.finished,
            place: hf.finishOrder,
            inputT: inp?.t ?? 0,
            inputN: inp?.n ?? 0,
        };
    });
}

export function PlaybackHUD({ sim, horseLabels }: Props): ReactNode {
    const [rows, setRows] = useState<HorseRow[]>([]);
    const [followId, setFollowId] = useState<number | null>(
        sim.getFollowedHorse()
    );
    const labels = horseLabels ?? new Map<number, string>();
    const prevFrameRef = useRef<RaceFrame | null>(null);

    // --- Drag state ---
    const panelRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [positioned, setPositioned] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

    const [dragging, setDragging] = useState(false);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if ((e.target as HTMLElement).tagName === 'SELECT') return;
        e.preventDefault();
        let origX = pos.x;
        let origY = pos.y;
        if (!positioned && panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;
            setPos({ x: origX, y: origY });
            setPositioned(true);
        }
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX,
            origY,
        };
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [pos, positioned]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current) return;
        setPos({
            x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
        });
    }, []);

    const onPointerUp = useCallback(() => {
        dragRef.current = null;
        setDragging(false);
    }, []);

    useEffect(() => {
        let raf = 0;
        function tick() {
            const frame = sim.getCurrentFrame();
            setRows(buildRows(sim, frame, prevFrameRef.current, labels));
            prevFrameRef.current = frame;
            raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [sim, labels]);

    const onFollow = useCallback(
        (id: number | null) => {
            sim.followHorse(id);
            setFollowId(id);
        },
        [sim]
    );

    const sorted = [...rows].sort((a, b) => a.id - b.id);
    const positionByHorse = new Map<number, number>();
    [...rows]
        .sort((a, b) => b.progress - a.progress)
        .forEach((r, i) => positionByHorse.set(r.id, i + 1));

    return (
        <div
            ref={panelRef}
            style={{
                position: 'absolute',
                top: positioned ? pos.y : 56,
                right: positioned ? undefined : 16,
                left: positioned ? pos.x : undefined,
                width: 460,
                maxHeight: 'min(70vh, 600px)',
                overflow: 'auto',
                zIndex: 20,
                pointerEvents: 'auto',
                background: 'rgba(18,18,18,0.93)',
                border: '1px solid #444',
                borderRadius: 10,
                padding: '10px 12px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                color: '#eee',
                fontSize: 11,
                fontFamily: 'monospace',
            }}
        >
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    cursor: dragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
            >
                <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'sans-serif' }}>
                    Race HUD
                </span>
                <span style={{ color: '#888', fontSize: 10 }}>
                    Follow:{' '}
                    <select
                        value={followId === null ? '__none__' : String(followId)}
                        onChange={e => {
                            const v = e.target.value;
                            onFollow(v === '__none__' ? null : Number(v));
                        }}
                        style={{
                            background: '#333',
                            color: 'white',
                            border: '1px solid #555',
                            borderRadius: 4,
                            padding: '2px 4px',
                            fontSize: 10,
                        }}
                    >
                        <option value="__none__">Free cam</option>
                        {rows.map(r => (
                            <option key={r.id} value={r.id}>
                                #{r.id}
                            </option>
                        ))}
                    </select>
                </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ color: '#777', fontSize: 10, textAlign: 'left' }}>
                        <th style={th}>Pos</th>
                        <th style={th}>Horse</th>
                        <th style={th}>Speed</th>
                        <th style={th}>Accel</th>
                        <th style={th}>Progress</th>
                        <th style={th}>Stam</th>
                        <th style={th}>Lane</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r, idx) => {
                        const isFollowed = followId === r.id;
                        const staminaPct = r.maxStamina > 0 ? r.stamina / r.maxStamina : 0;
                        return (
                            <tr
                                key={r.id}
                                onClick={() => onFollow(isFollowed ? null : r.id)}
                                style={{
                                    cursor: 'pointer',
                                    background: isFollowed
                                        ? 'rgba(74,158,255,0.15)'
                                        : 'transparent',
                                    borderBottom: '1px solid #333',
                                }}
                            >
                                <td style={td}>
                                    {r.place ?? positionByHorse.get(r.id) ?? idx + 1}
                                </td>
                                <td style={td}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 8,
                                            height: 8,
                                            borderRadius: 2,
                                            background: hexColor(r.color),
                                            marginRight: 4,
                                            verticalAlign: 'middle',
                                        }}
                                    />
                                    <span style={{ verticalAlign: 'middle' }}>
                                        #{r.id} {r.label}
                                    </span>
                                </td>
                                <td style={td}>{r.speed.toFixed(1)}</td>
                                <td
                                    style={{
                                        ...td,
                                        color:
                                            r.accel > 0.005
                                                ? '#4ade80'
                                                : r.accel < -0.005
                                                  ? '#f87171'
                                                  : '#888',
                                    }}
                                >
                                    {r.accel >= 0 ? '+' : ''}
                                    {r.accel.toFixed(2)}
                                </td>
                                <td style={td}>
                                    {(r.progress * 100).toFixed(1)}%
                                </td>
                                <td
                                    style={{
                                        ...td,
                                        color:
                                            staminaPct > 0.3
                                                ? '#ccc'
                                                : staminaPct > 0
                                                  ? '#ff8800'
                                                  : '#ff2222',
                                    }}
                                >
                                    {Math.round(r.stamina)}
                                </td>
                                <td style={td}>
                                    {r.lateralOffset.toFixed(2)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const th: React.CSSProperties = { padding: '3px 4px', fontWeight: 400 };
const td: React.CSSProperties = { padding: '4px 4px', whiteSpace: 'nowrap' };
