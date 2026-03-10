import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import {
    ArrowLeftRight,
    Building2,
    CircleDot,
    Download,
    Eraser,
    Gauge,
    House,
    Layers,
    Map,
    Paintbrush,
    Pause,
    Pencil,
    Plus,
    Spline,
    Sun,
    TrainFront,
    Trash2,
    Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuildingPreset } from '@/buildings/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBananaApp } from '@/contexts/pixi';
import { cn } from '@/lib/utils';
import type { DetailedTrackRenderStyle } from '@/trains/tracks/render-system';
import { ELEVATION } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';

type AppMode =
    | 'idle'
    | 'layout'
    | 'layout-deletion'
    | 'train-placement'
    | 'building-placement'
    | 'building-deletion';

function ToolbarButton({
    tooltip,
    active,
    destructive,
    disabled,
    onClick,
    children,
}: {
    tooltip: string;
    active?: boolean;
    destructive?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    const variant = destructive
        ? 'destructive'
        : active
          ? 'default'
          : 'ghost';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant={variant}
                    size="icon"
                    disabled={disabled}
                    onClick={onClick}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    );
}

export function BananaToolbar() {
    const app = useBananaApp();
    const convertCoords = useCoordinateConversion();
    const toggleKmtInput = useToggleKmtInput();

    const [mode, setMode] = useState<AppMode>('idle');
    const [elevation, setElevation] = useState<string>('N/A');
    const [tension, setTension] = useState<string>('1.0');
    const [sunAngle, setSunAngle] = useState(135);
    const [buildingPreset, setBuildingPreset] =
        useState<BuildingPreset>('medium');
    const [buildingElevation, setBuildingElevation] = useState<ELEVATION>(
        ELEVATION.ABOVE_1
    );
    const [buildingHeight, setBuildingHeight] = useState(1);
    const [showDistricts, setShowDistricts] = useState(true);
    const [showVillages, setShowVillages] = useState(true);
    const [trackRenderStyle, setTrackRenderStyle] =
        useState<DetailedTrackRenderStyle>('elevation');
    const [showJointNumbers, setShowJointNumbers] = useState(false);
    const [showSegmentIds, setShowSegmentIds] = useState(false);
    const [trainListVersion, setTrainListVersion] = useState(0);

    const selectedBuildingRef = useRef<number | null>(null);
    const modeRef = useRef(mode);
    modeRef.current = mode;

    const buildingPresetRef = useRef(buildingPreset);
    buildingPresetRef.current = buildingPreset;
    const buildingElevationRef = useRef(buildingElevation);
    buildingElevationRef.current = buildingElevation;
    const buildingHeightRef = useRef(buildingHeight);
    buildingHeightRef.current = buildingHeight;

    useEffect(() => {
        if (!app) return;
        app.curveEngine.onElevationChange(elev => {
            setElevation(elev != null ? String(elev) : 'N/A');
        });
        setTension(app.curveEngine.currentTension.toFixed(1));
        app.curveEngine.onTensionChange(t => {
            setTension(t.toFixed(1));
        });
    }, [app]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.sunAngle = sunAngle;
        app.buildingRenderSystem.sunAngle = sunAngle;
    }, [app, sunAngle]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.detailedRenderStyle = trackRenderStyle;
    }, [app, trackRenderStyle]);

    useEffect(() => {
        if (!app) return;
        app.debugOverlayRenderSystem.setShowJointDebug(showJointNumbers);
    }, [app, showJointNumbers]);

    useEffect(() => {
        if (!app) return;
        app.debugOverlayRenderSystem.setShowSegmentDebug(showSegmentIds);
    }, [app, showSegmentIds]);

    useEffect(() => {
        if (!app) return;
        return app.trainManager.subscribeToChanges((id, type) =>
            setTrainListVersion(v => v + 1)
        );
    }, [app]);

    useEffect(() => {
        if (!app) return;
        if (selectedBuildingRef.current !== null) {
            app.buildingManager.updateBuildingHeight(
                selectedBuildingRef.current,
                buildingHeight
            );
        }
    }, [app, buildingHeight]);

    const exitAllModes = useCallback(() => {
        if (!app) return;
        app.kmtStateMachineExpansion.happens('switchToIdle');
        selectedBuildingRef.current = null;
        setMode('idle');
    }, [app, toggleKmtInput]);

    const handleLayoutToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'layout' || mode === 'layout-deletion') {
            if (mode === 'layout-deletion') {
                app.kmtStateMachineExpansion.happens('endDeletion');
            }
            app.kmtStateMachineExpansion.happens('switchToIdle');
            setMode('idle');
        } else {
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToLayout');
            setMode('layout');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

    const handleLayoutDeletionToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'layout-deletion') {
            app.kmtStateMachineExpansion.happens('endDeletion');
            setMode('layout');
        } else if (mode === 'layout') {
            app.kmtStateMachineExpansion.happens('startDeletion');
            setMode('layout-deletion');
        }
    }, [app, mode]);

    const handleTrainPlacementToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'train-placement') {
            app.kmtStateMachineExpansion.happens('switchToIdle');
            setMode('idle');
        } else {
            app.kmtStateMachineExpansion.happens('switchToTrain');
            setMode('train-placement');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

    const handleBuildingPlacementToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'building-placement') {
            exitAllModes();
        } else {
            exitAllModes();
            toggleKmtInput(false);
            setMode('building-placement');
        }
    }, [app, exitAllModes, toggleKmtInput]);

    const handleBuildingDeletionToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'building-deletion') {
            exitAllModes();
        } else {
            exitAllModes();
            toggleKmtInput(false);
            setMode('building-deletion');
        }
    }, [app, exitAllModes, toggleKmtInput]);

    const handlePointerDown = useCallback(
        (event: PointerEvent) => {
            if (event.button !== 0 || !app) return;

            const worldPosition = convertCoords(event);
            const currentMode = modeRef.current;

            if (currentMode === 'building-placement') {
                const existingHit =
                    app.buildingManager.getBuildingAt(worldPosition);
                if (existingHit !== null) {
                    selectedBuildingRef.current = existingHit;
                    const existing =
                        app.buildingManager.getBuilding(existingHit);
                    if (existing) {
                        setBuildingHeight(existing.height);
                    }
                } else {
                    const id = app.buildingManager.addBuilding(
                        worldPosition,
                        buildingPresetRef.current,
                        buildingElevationRef.current,
                        buildingHeightRef.current
                    );
                    selectedBuildingRef.current = id;
                }
            } else if (currentMode === 'building-deletion') {
                const hit = app.buildingManager.getBuildingAt(worldPosition);
                if (hit !== null) {
                    if (selectedBuildingRef.current === hit) {
                        selectedBuildingRef.current = null;
                    }
                    app.buildingManager.removeBuilding(hit);
                }
            }
        },
        [app, convertCoords]
    );

    useCanvasPointerDown(handlePointerDown);

    const handleExportTracks = useCallback(() => {
        if (!app) return;
        const data = app.curveEngine.trackGraph.serialize();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `track-data-${Date.now()}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [app]);

    const handleImportTracks = useCallback(() => {
        if (!app) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result as string);
                    const result = validateSerializedTrackData(parsed);
                    if (!result.valid) {
                        alert(`Invalid track data: ${result.error}`);
                        return;
                    }
                    app.curveEngine.trackGraph.loadFromSerializedData(parsed);
                } catch (e) {
                    alert(`Failed to parse JSON: ${(e as Error).message}`);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }, [app]);

    if (!app) return null;

    const trainManager = app.trainManager;
    const placedTrains = trainManager.getPlacedTrains();
    const selectedTrain = trainManager.getSelectedTrain();
    const selectedIndex = trainManager.selectedIndex;

    const isLayoutActive = mode === 'layout' || mode === 'layout-deletion';

    return (
        <TooltipProvider delayDuration={200}>
            <div className="pointer-events-auto absolute left-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
                {/* Main icon toolbar */}
                <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                    {/* Track layout group */}
                    <ToolbarButton
                        tooltip={isLayoutActive ? 'End Layout' : 'Start Layout'}
                        active={isLayoutActive}
                        disabled={
                            mode !== 'idle' && !isLayoutActive
                        }
                        onClick={handleLayoutToggle}
                    >
                        <Pencil />
                    </ToolbarButton>

                    {isLayoutActive && (
                        <ToolbarButton
                            tooltip={
                                mode === 'layout-deletion'
                                    ? 'End Deletion'
                                    : 'Delete Track'
                            }
                            active={mode === 'layout-deletion'}
                            destructive={mode === 'layout-deletion'}
                            onClick={handleLayoutDeletionToggle}
                        >
                            <Eraser />
                        </ToolbarButton>
                    )}

                    <Separator />

                    {/* Train */}
                    <ToolbarButton
                        tooltip={
                            mode === 'train-placement'
                                ? 'End Placement'
                                : 'Place Train'
                        }
                        active={mode === 'train-placement'}
                        disabled={
                            mode !== 'idle' && mode !== 'train-placement'
                        }
                        onClick={handleTrainPlacementToggle}
                    >
                        <TrainFront />
                    </ToolbarButton>

                    {/* Building */}
                    <ToolbarButton
                        tooltip={
                            mode === 'building-placement'
                                ? 'End Placement'
                                : 'Place Building'
                        }
                        active={mode === 'building-placement'}
                        disabled={
                            mode !== 'idle' && mode !== 'building-placement'
                        }
                        onClick={handleBuildingPlacementToggle}
                    >
                        <Building2 />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={
                            mode === 'building-deletion'
                                ? 'End Deletion'
                                : 'Delete Building'
                        }
                        active={mode === 'building-deletion'}
                        destructive={mode === 'building-deletion'}
                        disabled={
                            mode !== 'idle' && mode !== 'building-deletion'
                        }
                        onClick={handleBuildingDeletionToggle}
                    >
                        <Trash2 />
                    </ToolbarButton>

                    <Separator />

                    {/* Track style */}
                    <ToolbarButton
                        tooltip="Elevation Style"
                        active={trackRenderStyle === 'elevation'}
                        onClick={() => setTrackRenderStyle('elevation')}
                    >
                        <Layers />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Texture Style"
                        active={trackRenderStyle === 'texture'}
                        onClick={() => setTrackRenderStyle('texture')}
                    >
                        <Paintbrush />
                    </ToolbarButton>

                    <Separator />

                    {/* Geo layers */}
                    <ToolbarButton
                        tooltip={
                            showDistricts
                                ? 'Hide Districts'
                                : 'Show Districts'
                        }
                        active={showDistricts}
                        onClick={() => setShowDistricts(v => !v)}
                    >
                        <Map />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={
                            showVillages ? 'Hide Villages' : 'Show Villages'
                        }
                        active={showVillages}
                        onClick={() => setShowVillages(v => !v)}
                    >
                        <House />
                    </ToolbarButton>

                    <Separator />

                    {/* Import/Export */}
                    <ToolbarButton
                        tooltip="Export Tracks"
                        onClick={handleExportTracks}
                    >
                        <Download />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Import Tracks"
                        onClick={handleImportTracks}
                    >
                        <Upload />
                    </ToolbarButton>

                    <Separator />

                    {/* Debug */}
                    <ToolbarButton
                        tooltip="Joint Numbers"
                        active={showJointNumbers}
                        onClick={() => setShowJointNumbers(v => !v)}
                    >
                        <CircleDot />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip="Segment IDs"
                        active={showSegmentIds}
                        onClick={() => setShowSegmentIds(v => !v)}
                    >
                        <Spline />
                    </ToolbarButton>
                </div>

                {/* Sun angle mini control */}
                <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex flex-col items-center gap-1">
                                <Sun className="text-muted-foreground size-4" />
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    step={1}
                                    value={sunAngle}
                                    onChange={e =>
                                        setSunAngle(Number(e.target.value))
                                    }
                                    className="h-20 w-1.5 appearance-none [writing-mode:vertical-lr]"
                                />
                                <span className="text-muted-foreground text-[10px]">
                                    {sunAngle}°
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">Sun Angle</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Train controls panel — only visible when trains exist or in placement mode */}
            {(mode === 'train-placement' || placedTrains.length > 0) && (
                <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">
                    <div className="bg-background/80 flex items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                        {placedTrains.map((entry, index) => (
                            <Tooltip key={entry.id}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={
                                            index === selectedIndex
                                                ? 'default'
                                                : 'ghost'
                                        }
                                        size="icon-sm"
                                        onClick={() =>
                                            trainManager.setSelectedIndex(index)
                                        }
                                    >
                                        <span className="text-xs font-mono">
                                            {index + 1}
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Train {index + 1}
                                </TooltipContent>
                            </Tooltip>
                        ))}

                        {placedTrains.length > 0 && (
                            <>
                                <Separator
                                    orientation="vertical"
                                    className="mx-0.5 h-6"
                                />
                                <ToolbarButton
                                    tooltip="Throttle P5"
                                    disabled={!selectedTrain}
                                    onClick={() =>
                                        selectedTrain?.setThrottleStep('p5')
                                    }
                                >
                                    <Gauge />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Neutral"
                                    disabled={!selectedTrain}
                                    onClick={() =>
                                        selectedTrain?.setThrottleStep('N')
                                    }
                                >
                                    <Pause />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Switch Direction"
                                    disabled={!selectedTrain}
                                    onClick={() =>
                                        selectedTrain?.switchDirection()
                                    }
                                >
                                    <ArrowLeftRight />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Remove Selected Train"
                                    destructive
                                    onClick={() =>
                                        trainManager.removeSelectedTrain()
                                    }
                                >
                                    <Trash2 />
                                </ToolbarButton>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Building options — only visible in building-placement mode */}
            {mode === 'building-placement' && (
                <div className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="bg-background/80 flex flex-col gap-2 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                        <span className="text-muted-foreground text-xs font-medium">
                            Building
                        </span>
                        <select
                            className="bg-background h-7 rounded-md border px-2 text-xs"
                            value={buildingPreset}
                            onChange={e =>
                                setBuildingPreset(
                                    e.target.value as BuildingPreset
                                )
                            }
                        >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                            <option value="l-shape">L-Shape</option>
                        </select>
                        <select
                            className="bg-background h-7 rounded-md border px-2 text-xs"
                            value={buildingElevation}
                            onChange={e =>
                                setBuildingElevation(
                                    Number(e.target.value) as ELEVATION
                                )
                            }
                        >
                            <option value={ELEVATION.GROUND}>Ground</option>
                            <option value={ELEVATION.ABOVE_1}>Above 1</option>
                            <option value={ELEVATION.ABOVE_2}>Above 2</option>
                            <option value={ELEVATION.ABOVE_3}>Above 3</option>
                        </select>
                        <label className="flex flex-col gap-1 text-xs">
                            Height: {buildingHeight} lv
                            <input
                                type="range"
                                min={0.5}
                                max={5}
                                step={0.5}
                                value={buildingHeight}
                                onChange={e =>
                                    setBuildingHeight(Number(e.target.value))
                                }
                                className="w-full"
                            />
                        </label>
                    </div>
                </div>
            )}

            {/* Status bar */}
            <div className="pointer-events-none absolute bottom-3 right-3">
                <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-[10px] backdrop-blur-sm">
                    Elev: {elevation} · T: {tension}
                </span>
            </div>
        </TooltipProvider>
    );
}
