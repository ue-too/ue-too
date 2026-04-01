import {
    Download,
    Eye,
    Grid3x3,
    Home,
    Image,
    Magnet,
    Plus,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';

import type { TrackMakerAppComponents } from '@/track-maker/init-track-maker';
import type { Track } from '@/track-maker/types';

export function TrackMakerToolbar() {
    const { t } = useTranslation();
    const { result } = usePixiCanvas<TrackMakerAppComponents>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [, forceUpdate] = useState(0);
    const [hasRefImage, setHasRefImage] = useState(false);
    const [refImageOpacity, setRefImageOpacity] = useState(0.3);

    const sm = result.initialized && result.success ? result.components.stateMachine : null;
    const model = result.initialized && result.success ? result.components.model : null;
    const renderSystem = result.initialized && result.success ? result.components.renderSystem : null;

    // Re-render when model changes
    useEffect(() => {
        if (!model) return;
        return model.onChange(() => forceUpdate((n) => n + 1));
    }, [model]);

    // Re-render when state machine state changes (e.g. mode toggle)
    useEffect(() => {
        if (!sm) return;
        sm.onStateChange(() => forceUpdate((n) => n + 1));
    }, [sm]);

    // Derive mode from state machine state
    const smState = sm?.currentState;
    const mode = smState === 'EDIT_MODE' || smState === 'DRAGGING_POINT' ? 'EDIT' : 'OBJECT';

    const handleToggleMode = () => {
        if (!sm) return;
        sm.happens('tabKey');
    };

    const handleAddCurve = () => {
        if (!sm) return;
        // Pass viewport center as window coordinates so the state machine's
        // convert2WorldPosition places the curve at the center of the view.
        const canvas = document.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        sm.happens('addCurve', { x, y });
    };

    const handleDelete = () => {
        if (!model) return;
        model.deleteSelectedCurves();
    };

    const handleToggleArcFit = () => {
        if (!model) return;
        model.toggleArcFit();
    };

    const handleToggleSnap = () => {
        if (!model) return;
        model.toggleSnap();
    };

    const handleExport = () => {
        if (!model) return;
        const origin = { x: 0, y: 0 };
        const tracks = model.exportTrack(origin);
        if (tracks == null) return;

        const json = JSON.stringify(tracks, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'track.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // TODO: import existing track JSON back into the editor
        e.target.value = '';
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !renderSystem) return;
        const reader = new FileReader();
        reader.onload = async () => {
            await renderSystem.setReferenceImage(reader.result as string);
            setHasRefImage(true);
            setRefImageOpacity(renderSystem.getReferenceImageOpacity());
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleClearRefImage = () => {
        if (!renderSystem) return;
        renderSystem.clearReferenceImage();
        setHasRefImage(false);
    };

    const handleRefImageOpacity = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!renderSystem) return;
        const val = parseFloat(e.target.value);
        renderSystem.setReferenceImageOpacity(val);
        setRefImageOpacity(val);
    };

    const handleSetScale = () => {
        if (!model) return;
        const success = model.calculateScale();
        if (!success) {
            alert('Name a curve "SCALE" (100m reference) to set scale.');
        }
    };

    return (
        <div className="border-border bg-card/90 pointer-events-auto fixed top-4 left-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm backdrop-blur">
            <Link
                to="/"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
                <Home className="size-4 shrink-0" aria-hidden />
            </Link>

            <span className="bg-border mx-1 h-4 w-px" />

            {/* Mode toggle */}
            <button
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    mode === 'EDIT'
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={handleToggleMode}
            >
                {mode === 'EDIT' ? 'Edit Mode' : 'Object Mode'}
            </button>

            <span className="bg-border mx-1 h-4 w-px" />

            {/* Curve operations */}
            <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                onClick={handleAddCurve}
                title="Add curve"
            >
                <Plus className="size-3.5" aria-hidden />
                <span>Add</span>
            </button>

            <button
                type="button"
                className="text-muted-foreground hover:text-red-500 inline-flex items-center gap-1 text-xs transition-colors"
                onClick={handleDelete}
                title="Delete selected"
            >
                <Trash2 className="size-3.5" aria-hidden />
            </button>

            <span className="bg-border mx-1 h-4 w-px" />

            {/* Toggles */}
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    model?.arcFitEnabled ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={handleToggleArcFit}
                title="Toggle arc fit visualization"
            >
                <Eye className="size-3.5" aria-hidden />
                <span>Arc Fit</span>
            </button>

            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    model?.isSnapEnabled ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={handleToggleSnap}
                title="Toggle snap to points"
            >
                <Magnet className="size-3.5" aria-hidden />
                <span>Snap</span>
            </button>

            <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                onClick={handleSetScale}
                title="Calculate scale from SCALE curve"
            >
                <Grid3x3 className="size-3.5" aria-hidden />
                <span>Scale</span>
            </button>

            <span className="bg-border mx-1 h-4 w-px" />

            {/* Import / Export */}
            <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                onClick={handleExport}
                title="Export track JSON"
            >
                <Download className="size-3.5" aria-hidden />
                <span>Export</span>
            </button>

            <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                onClick={() => fileInputRef.current?.click()}
                title="Load track JSON"
            >
                <Upload className="size-3.5" aria-hidden />
                <span>Load</span>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
            />

            <span className="bg-border mx-1 h-4 w-px" />

            {/* Reference image */}
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    hasRefImage ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => imageInputRef.current?.click()}
                title="Upload reference image for tracing"
            >
                <Image className="size-3.5" aria-hidden />
                <span>Ref Image</span>
            </button>
            {hasRefImage && (
                <>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={refImageOpacity}
                        onChange={handleRefImageOpacity}
                        className="w-16"
                        title={`Opacity: ${Math.round(refImageOpacity * 100)}%`}
                    />
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-red-500 text-xs transition-colors"
                        onClick={handleClearRefImage}
                        title="Remove reference image"
                    >
                        <X className="size-3.5" aria-hidden />
                    </button>
                </>
            )}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />
        </div>
    );
}
