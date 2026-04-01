import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X } from '@/assets/icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import type { BlockSignalManager } from '@/signals/block-signal-manager';
import type { SignalRenderSystem } from '@/signals/signal-render-system';
import type { SignalStateEngine } from '@/signals/signal-state-engine';
import type { SignalAspect, BlockSegmentEntry } from '@/signals/types';
import type { TrackGraph } from '@/trains/tracks/track';

type SignalPanelProps = {
    blockSignalManager: BlockSignalManager;
    signalStateEngine: SignalStateEngine;
    signalRenderSystem: SignalRenderSystem;
    trackGraph: TrackGraph;
    onClose: () => void;
};

/** Aspect indicator dot. */
function AspectDot({ aspect }: { aspect: SignalAspect }) {
    const color =
        aspect === 'red'
            ? 'bg-red-500'
            : aspect === 'yellow'
              ? 'bg-yellow-400'
              : 'bg-green-500';
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

/** Format a segment entry for display: "10" for full, "10 [0.3-1]" for partial. */
function formatSegEntry(s: BlockSegmentEntry): string {
    if (s.fromT === 0 && s.toT === 1) return String(s.segmentNumber);
    return `${s.segmentNumber} [${fmtT(s.fromT)}-${fmtT(s.toT)}]`;
}

/** Format a t-value: drop trailing zeros, max 2 decimals. */
function fmtT(v: number): string {
    if (v === 0) return '0';
    if (v === 1) return '1';
    return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function SignalPanel({
    blockSignalManager,
    signalStateEngine,
    signalRenderSystem: _signalRenderSystem,
    trackGraph,
    onClose,
}: SignalPanelProps) {
    const { t } = useTranslation();

    // -- live aspect refresh ---------------------------------------------------
    const [, setTick] = useState(0);
    const rafRef = useRef(0);
    useEffect(() => {
        const loop = () => {
            setTick(v => v + 1);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    // -- signal form state -----------------------------------------------------
    const [sigSeg, setSigSeg] = useState('');
    const [sigT, setSigT] = useState('0.5');
    const [sigDir, setSigDir] = useState<'tangent' | 'reverseTangent'>('tangent');

    const handleAddSignal = useCallback(() => {
        const seg = Number(sigSeg);
        const tv = Number(sigT);
        if (!Number.isFinite(seg) || !Number.isFinite(tv)) return;
        blockSignalManager.addSignal(seg, tv, sigDir);
        setSigSeg('');
        setSigT('0.5');
    }, [blockSignalManager, sigSeg, sigT, sigDir]);

    // -- block form state ------------------------------------------------------
    const [blockEntry, setBlockEntry] = useState('');
    const [blockExit, setBlockExit] = useState('');
    const [blockSegs, setBlockSegs] = useState('');
    const [autoFillError, setAutoFillError] = useState('');

    /** Auto-fill segments and immediately create the block. */
    const handleAutoFillAndCreate = useCallback(() => {
        setAutoFillError('');
        const entryId = Number(blockEntry);
        const exitId = Number(blockExit);
        if (!Number.isFinite(entryId) || !Number.isFinite(exitId)) {
            setAutoFillError('Enter valid signal IDs');
            return;
        }

        const segments = blockSignalManager.computeBlockSegments(entryId, exitId, trackGraph);
        if (!segments) {
            setAutoFillError('No path found between signals');
            return;
        }

        blockSignalManager.addBlock(entryId, exitId, segments);
        setBlockEntry('');
        setBlockExit('');
        setBlockSegs('');
    }, [blockSignalManager, trackGraph, blockEntry, blockExit]);

    /** Auto-fill segments into the text field without creating. */
    const handleAutoFillPreview = useCallback(() => {
        setAutoFillError('');
        const entryId = Number(blockEntry);
        const exitId = Number(blockExit);
        if (!Number.isFinite(entryId) || !Number.isFinite(exitId)) {
            setAutoFillError('Enter valid signal IDs');
            return;
        }

        const segments = blockSignalManager.computeBlockSegments(entryId, exitId, trackGraph);
        if (!segments) {
            setAutoFillError('No path found between signals');
            return;
        }

        const text = segments
            .map(s => {
                if (s.fromT === 0 && s.toT === 1) return String(s.segmentNumber);
                return `${s.segmentNumber}:${fmtT(s.fromT)}-${fmtT(s.toT)}`;
            })
            .join(',');
        setBlockSegs(text);
    }, [blockSignalManager, trackGraph, blockEntry, blockExit]);

    const handleAddBlock = useCallback(() => {
        const entryId = Number(blockEntry);
        if (!Number.isFinite(entryId)) return;
        const exitId = blockExit.trim() === '' ? null : Number(blockExit);
        if (exitId !== null && !Number.isFinite(exitId)) return;

        // Parse segments: "10,11,12" or "10:0.5-1,11:0-1,12:0-0.8"
        const rawSegs = blockSegs.split(',').map(s => s.trim()).filter(Boolean);
        const segments: BlockSegmentEntry[] = [];
        for (const raw of rawSegs) {
            if (raw.includes(':')) {
                const [numStr, rangeStr] = raw.split(':');
                const [fromStr, toStr] = (rangeStr ?? '').split('-');
                segments.push({
                    segmentNumber: Number(numStr),
                    fromT: Number(fromStr),
                    toT: Number(toStr),
                });
            } else {
                segments.push({
                    segmentNumber: Number(raw),
                    fromT: 0,
                    toT: 1,
                });
            }
        }
        if (segments.length === 0) return;

        blockSignalManager.addBlock(entryId, exitId, segments);
        setBlockEntry('');
        setBlockExit('');
        setBlockSegs('');
    }, [blockSignalManager, blockEntry, blockExit, blockSegs]);

    // Clear auto-fill error when inputs change
    useEffect(() => {
        setAutoFillError('');
    }, [blockEntry, blockExit]);

    // -- snapshot data for rendering -------------------------------------------
    const signals = Array.from(blockSignalManager.getSignals().values());
    const blocks = Array.from(blockSignalManager.getBlocks().values());

    const canAutoFill = blockEntry.trim() !== '' && blockExit.trim() !== '';

    return (
        <DraggablePanel
            title={t('signals', 'Signals')}
            onClose={onClose}
            className="w-72"
        >
            <Separator className="mb-2" />

            {/* ---- Add Signal ---- */}
            <div className="mb-2">
                <div className="text-xs font-semibold text-foreground mb-1">{t('addSignal', 'Add Signal')}</div>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                        <input
                            type="number"
                            placeholder={t('segmentNumber', 'Segment #')}
                            value={sigSeg}
                            onChange={e => setSigSeg(e.target.value)}
                            className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs"
                        />
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            placeholder="t"
                            value={sigT}
                            onChange={e => setSigT(e.target.value)}
                            className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs"
                        />
                        <select
                            value={sigDir}
                            onChange={e => setSigDir(e.target.value as 'tangent' | 'reverseTangent')}
                            className="rounded border bg-background px-1 py-0.5 text-xs"
                        >
                            <option value="tangent">tan</option>
                            <option value="reverseTangent">rev</option>
                        </select>
                    </div>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleAddSignal}>
                        <Plus className="mr-1 h-3 w-3" /> {t('addSignal', 'Add Signal')}
                    </Button>
                </div>
            </div>

            {/* ---- Signals List ---- */}
            {signals.length > 0 && (
                <div className="mb-2">
                    <div className="text-xs font-semibold text-foreground mb-1">{t('signalsList', 'Signals')}</div>
                    <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                        {signals.map(sig => (
                            <div key={sig.id} className="flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 text-xs">
                                <span className="flex items-center gap-1.5">
                                    <AspectDot aspect={signalStateEngine.getAspect(sig.id)} />
                                    <span className="font-mono">#{sig.id}</span>
                                    <span className="text-muted-foreground">seg {sig.segmentNumber} t={fmtT(sig.tValue)} {sig.direction === 'tangent' ? 'T' : 'R'}</span>
                                </span>
                                <button
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => blockSignalManager.removeSignal(sig.id)}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Separator className="mb-2" />

            {/* ---- Add Block ---- */}
            <div className="mb-2">
                <div className="text-xs font-semibold text-foreground mb-1">{t('addBlock', 'Add Block')}</div>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                        <input
                            type="number"
                            placeholder={t('entrySignal', 'Entry signal ID')}
                            value={blockEntry}
                            onChange={e => setBlockEntry(e.target.value)}
                            className="flex-1 rounded border bg-background px-1.5 py-0.5 text-xs"
                        />
                        <input
                            type="number"
                            placeholder={t('exitSignal', 'Exit signal ID')}
                            value={blockExit}
                            onChange={e => setBlockExit(e.target.value)}
                            className="flex-1 rounded border bg-background px-1.5 py-0.5 text-xs"
                        />
                    </div>

                    {/* Auto-fill: primary action when both signal IDs are set */}
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="default"
                            className="h-6 flex-1 text-xs"
                            onClick={handleAutoFillAndCreate}
                            disabled={!canAutoFill}
                        >
                            Auto-fill & Create
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={handleAutoFillPreview}
                            disabled={!canAutoFill}
                            title="Preview auto-filled segments without creating"
                        >
                            Preview
                        </Button>
                    </div>

                    {autoFillError && (
                        <div className="text-xs text-destructive">{autoFillError}</div>
                    )}

                    {/* Manual segment entry (collapsible) */}
                    <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Manual segments</summary>
                        <div className="mt-1 flex flex-col gap-1">
                            <input
                                placeholder="10,11 or 10:0.5-1,11:0-0.8"
                                value={blockSegs}
                                onChange={e => setBlockSegs(e.target.value)}
                                className="w-full rounded border bg-background px-1.5 py-0.5 text-xs"
                            />
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleAddBlock}>
                                <Plus className="mr-1 h-3 w-3" /> Add Block
                            </Button>
                        </div>
                    </details>
                </div>
            </div>

            {/* ---- Blocks List ---- */}
            {blocks.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-foreground mb-1">{t('blocksList', 'Blocks')}</div>
                    <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                        {blocks.map(block => (
                            <div key={block.id} className="flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 text-xs">
                                <div className="flex flex-col min-w-0">
                                    <span>
                                        <span className="font-mono">B#{block.id}</span>{' '}
                                        <span className="text-muted-foreground">
                                            S{block.entrySignalId}
                                            {block.exitSignalId !== null ? ` \u2192 S${block.exitSignalId}` : ''}
                                        </span>
                                    </span>
                                    <span className="text-muted-foreground truncate">
                                        {block.segments.map(formatSegEntry).join(', ')}
                                    </span>
                                </div>
                                <button
                                    className="ml-1 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => blockSignalManager.removeBlock(block.id)}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </DraggablePanel>
    );
}
