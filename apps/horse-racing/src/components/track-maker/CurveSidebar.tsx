import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import type { TrackMakerAppComponents } from '@/track-maker/init-track-maker';
import type { CurveListEntry } from '@/track-maker/types';
import { HandleType } from '@/track-maker/types';

export function CurveSidebar() {
    const { result } = usePixiCanvas<TrackMakerAppComponents>();
    const [curves, setCurves] = useState<CurveListEntry[]>([]);
    const [slopeInput, setSlopeInput] = useState('');
    const [showSlopeInput, setShowSlopeInput] = useState(false);
    const [editingName, setEditingName] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const model = result.initialized && result.success ? result.components.model : null;
    const sm = result.initialized && result.success ? result.components.stateMachine : null;

    useEffect(() => {
        if (!model) return;
        const update = () => setCurves(model.getCurveList());
        update();
        return model.onChange(update);
    }, [model]);

    // Focus the name input when entering rename mode
    useEffect(() => {
        if (editingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [editingName]);

    const handleCurveClick = (ident: string, shiftKey: boolean) => {
        if (!model) return;
        if (editingName) return; // don't interfere while renaming
        model.clickedOnCurveCard(shiftKey, ident);
    };

    const handleCurveDoubleClick = (ident: string) => {
        // Double-click starts renaming (not editing the curve)
        setEditingName(ident);
    };

    const handleRenameFinish = (ident: string, newName: string) => {
        if (model) model.renameCurve(ident, newName);
        setEditingName(null);
    };

    const handleExtend = (prepend: boolean) => {
        if (!sm) return;
        sm.happens('extendCurve', { prepend });
    };

    const handleSetHandleType = (type: HandleType) => {
        if (!sm) return;
        switch (type) {
            case HandleType.VECTOR:
                sm.happens('setHandleVector');
                break;
            case HandleType.ALIGNED:
                sm.happens('setHandleAligned');
                break;
            case HandleType.FREE:
                sm.happens('setHandleFree');
                break;
        }
    };

    const handleSlopeSubmit = () => {
        if (!sm) return;
        const val = parseFloat(slopeInput);
        if (!isNaN(val)) {
            sm.happens('setSlope', { slope: val });
        }
        setShowSlopeInput(false);
        setSlopeInput('');
    };

    return (
        <div className="border-border bg-card/90 pointer-events-auto fixed top-4 right-4 z-20 flex w-56 flex-col gap-2 rounded-lg border p-3 shadow-sm backdrop-blur">
            <h3 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                Curves
            </h3>

            {/* Curve list */}
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {curves.map((c) => (
                    <div
                        key={c.ident}
                        className={`flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                            c.selected
                                ? 'bg-blue-600/20 text-blue-700 dark:text-blue-300'
                                : 'text-muted-foreground hover:bg-muted'
                        }`}
                        onClick={(e) => handleCurveClick(c.ident, e.shiftKey)}
                        onDoubleClick={() => handleCurveDoubleClick(c.ident)}
                    >
                        {editingName === c.ident ? (
                            <input
                                ref={nameInputRef}
                                className="bg-transparent w-full truncate outline-none"
                                defaultValue={c.name}
                                onBlur={(e) => handleRenameFinish(c.ident, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleRenameFinish(c.ident, (e.target as HTMLInputElement).value);
                                    }
                                    if (e.key === 'Escape') {
                                        setEditingName(null);
                                    }
                                    e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="w-full truncate">{c.name}</span>
                        )}
                        {c.selected && (
                            <Pencil className="text-blue-500 size-3 shrink-0 ml-1" aria-hidden />
                        )}
                    </div>
                ))}
                {curves.length === 0 && (
                    <p className="text-muted-foreground text-xs italic">
                        No curves. Click + Add to create one.
                    </p>
                )}
            </div>

            {/* Extend buttons */}
            <div className="flex gap-1">
                <button
                    type="button"
                    className="bg-muted text-muted-foreground hover:text-foreground flex-1 rounded px-2 py-1 text-xs transition-colors"
                    onClick={() => handleExtend(true)}
                    title="Prepend control point"
                >
                    <ChevronLeft className="mr-1 inline size-3" aria-hidden />
                    Prepend
                </button>
                <button
                    type="button"
                    className="bg-muted text-muted-foreground hover:text-foreground flex-1 rounded px-2 py-1 text-xs transition-colors"
                    onClick={() => handleExtend(false)}
                    title="Append control point"
                >
                    Append
                    <ChevronRight className="ml-1 inline size-3" aria-hidden />
                </button>
            </div>

            {/* Handle type buttons */}
            <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Handle Type
                </label>
                <div className="flex gap-1">
                    <button
                        type="button"
                        className="flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: '#7c9971', color: 'white' }}
                        onClick={() => handleSetHandleType(HandleType.VECTOR)}
                    >
                        Vector
                    </button>
                    <button
                        type="button"
                        className="flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: '#edb947', color: 'white' }}
                        onClick={() => handleSetHandleType(HandleType.ALIGNED)}
                    >
                        Aligned
                    </button>
                    <button
                        type="button"
                        className="flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: '#bd4456', color: 'white' }}
                        onClick={() => handleSetHandleType(HandleType.FREE)}
                    >
                        Free
                    </button>
                </div>
            </div>

            {/* Slope input */}
            <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Slope (Grade)
                </label>
                {showSlopeInput ? (
                    <div className="flex gap-1">
                        <input
                            type="number"
                            step="0.001"
                            className="border-border bg-background text-foreground flex-1 rounded border px-1.5 py-0.5 text-xs"
                            value={slopeInput}
                            onChange={(e) => setSlopeInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSlopeSubmit();
                                if (e.key === 'Escape') setShowSlopeInput(false);
                            }}
                            autoFocus
                        />
                        <button
                            type="button"
                            className="bg-blue-600 rounded px-2 py-0.5 text-xs text-white"
                            onClick={handleSlopeSubmit}
                        >
                            Set
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="bg-muted text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
                        onClick={() => setShowSlopeInput(true)}
                    >
                        Set Slope for Selected Point
                    </button>
                )}
            </div>
        </div>
    );
}
