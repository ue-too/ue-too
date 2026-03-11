import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import {
    ArrowLeftRight,
    Bug,
    Building2,
    CircleDot,
    Download,
    Gauge,
    Layers,
    ListOrdered,
    Paintbrush,
    Pause,
    Plus,
    Spline,
    Sun,
    TrainFront,
    TrainTrack,
    Trash2,
    Warehouse,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BulldozerIcon } from '@/assets/icons/bulldozer';
import { ExportSceneIcon } from '@/assets/icons/export-scene';
import { ExportTrackIcon } from '@/assets/icons/export-track';
import { ExportTrainIcon } from '@/assets/icons/export-train';
import { ImportSceneIcon } from '@/assets/icons/import-scene';
import { ImportTrackIcon } from '@/assets/icons/import-track';
import { ImportTrainIcon } from '@/assets/icons/import-train';
import type { BuildingPreset } from '@/buildings/types';
import { FormationEditor } from '@/components/formation-editor';
import { Button } from '@/components/ui/button';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBananaApp } from '@/contexts/pixi';
import { cn } from '@/lib/utils';
import {
    type SerializedSceneData,
    deserializeSceneData,
    serializeSceneData,
    validateSerializedSceneData,
} from '@/scene-serialization';
import type { DetailedTrackRenderStyle } from '@/trains/tracks/render-system';
import { ELEVATION } from '@/trains/tracks/types';
import type { SerializedTrackData } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';
import {
    type SerializedTrainData,
    deserializeTrainData,
    serializeTrainData,
    validateSerializedTrainData,
} from '@/trains/train-serialization';

type AppMode =
    | 'idle'
    | 'layout'
    | 'layout-deletion'
    | 'train-placement'
    | 'building-placement'
    | 'building-deletion';

/** Shared left offset for left-aligned toolbars (main toolbar, layout deletion toolbar) */
const TOOLBAR_LEFT = 'left-6';

function ToolbarButton({
    tooltip,
    active,
    destructive,
    destructiveMuted,
    disabled,
    onClick,
    children,
}: {
    tooltip: string;
    active?: boolean;
    destructive?: boolean;
    /** When true, normal state uses darker red; active uses bright red */
    destructiveMuted?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    const variant = destructive ? 'destructive' : active ? 'default' : 'ghost';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant={variant}
                    size="icon"
                    disabled={disabled}
                    onClick={onClick}
                    className={
                        destructiveMuted && !active
                            ? 'text-destructive/70 hover:text-destructive hover:bg-destructive/10'
                            : undefined
                    }
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    );
}

function downloadJson(filename: string, data: unknown): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function uploadJson(onJson: (parsed: unknown) => void): void {
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
                onJson(parsed);
            } catch (e) {
                alert(`Failed to parse JSON: ${(e as Error).message}`);
            }
        };
        reader.readAsText(file);
    });
    input.click();
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
    const [trackRenderStyle, setTrackRenderStyle] =
        useState<DetailedTrackRenderStyle>('elevation');
    const [showPreviewCurveArcs, setShowPreviewCurveArcs] = useState(false);
    const [showJointNumbers, setShowJointNumbers] = useState(false);
    const [showSegmentIds, setShowSegmentIds] = useState(false);
    const [trainListVersion, setTrainListVersion] = useState(0);
    const [showDepot, setShowDepot] = useState(false);
    const [showFormationEditor, setShowFormationEditor] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [showExportSubmenu, setShowExportSubmenu] = useState(false);
    const exportSubmenuTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const [depotVersion, setDepotVersion] = useState(0);
    const [formationVersion, setFormationVersion] = useState(0);
    const [selectedPlacementFormationId, setSelectedPlacementFormationId] =
        useState<string | null>(null);

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
        app.trackRenderSystem.showPreviewCurveArcs = showPreviewCurveArcs;
    }, [app, showPreviewCurveArcs]);

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
        const unsubChanges = app.trainManager.subscribeToChanges((id, type) =>
            setTrainListVersion(v => v + 1)
        );
        const unsubSelect = app.trainManager.subscribe(() =>
            setTrainListVersion(v => v + 1)
        );
        return () => {
            unsubChanges();
            unsubSelect();
        };
    }, [app]);

    useEffect(() => {
        if (!app) return;
        const unsub = app.carStockManager.subscribe(() =>
            setDepotVersion(v => v + 1)
        );
        return unsub;
    }, [app]);

    useEffect(() => {
        if (!app) return;
        const unsub = app.formationManager.subscribe(() =>
            setFormationVersion(v => v + 1)
        );
        return unsub;
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

    useEffect(() => {
        return () => {
            if (exportSubmenuTimeoutRef.current) {
                clearTimeout(exportSubmenuTimeoutRef.current);
            }
        };
    }, []);

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
        downloadJson(`track-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportTracks = useCallback(() => {
        if (!app) return;
        uploadJson(parsed => {
            const result = validateSerializedTrackData(parsed);
            if (!result.valid) {
                alert(`Invalid track data: ${result.error}`);
                return;
            }
            app.curveEngine.trackGraph.loadFromSerializedData(
                parsed as SerializedTrackData
            );
        });
    }, [app]);

    const handleExportTrains = useCallback(() => {
        if (!app) return;
        const data = serializeTrainData(
            app.trainManager,
            app.formationManager,
            app.carStockManager
        );
        downloadJson(`train-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportTrains = useCallback(() => {
        if (!app) return;
        uploadJson(parsed => {
            const result = validateSerializedTrainData(parsed);
            if (!result.valid) {
                alert(`Invalid train data: ${result.error}`);
                return;
            }
            deserializeTrainData(
                parsed as SerializedTrainData,
                app.curveEngine.trackGraph,
                app.jointDirectionManager,
                app.trainManager,
                app.formationManager,
                app.carStockManager
            );
        });
    }, [app]);

    const handleExportAll = useCallback(() => {
        if (!app) return;
        const data = serializeSceneData(app);
        downloadJson(`scene-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportAll = useCallback(() => {
        if (!app) return;
        uploadJson(parsed => {
            const result = validateSerializedSceneData(parsed);
            if (!result.valid) {
                alert(`Invalid scene data: ${result.error}`);
                return;
            }
            deserializeSceneData(app, parsed as SerializedSceneData);
        });
    }, [app]);

    if (!app) return null;

    const trainManager = app.trainManager;
    const placedTrains = trainManager.getPlacedTrains();
    const selectedTrain = trainManager.getSelectedTrain();
    const selectedIndex = trainManager.selectedIndex;

    const isLayoutActive = mode === 'layout' || mode === 'layout-deletion';

    return (
        <TooltipProvider delayDuration={200}>
            <div
                className={cn(
                    'pointer-events-auto absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-3',
                    TOOLBAR_LEFT
                )}
            >
                {/* Main icon toolbar */}
                <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                    {/* Track layout group */}
                    <ToolbarButton
                        tooltip={isLayoutActive ? 'End Layout' : 'Start Layout'}
                        active={isLayoutActive}
                        disabled={mode !== 'idle' && !isLayoutActive}
                        onClick={handleLayoutToggle}
                    >
                        <TrainTrack />
                    </ToolbarButton>

                    <Separator />

                    {/* Train */}
                    <ToolbarButton
                        tooltip={
                            mode === 'train-placement'
                                ? 'End Placement'
                                : 'Place Train'
                        }
                        active={mode === 'train-placement'}
                        disabled={mode !== 'idle' && mode !== 'train-placement'}
                        onClick={handleTrainPlacementToggle}
                    >
                        <TrainFront />
                    </ToolbarButton>

                    {/* Depot */}
                    <ToolbarButton
                        tooltip={showDepot ? 'Close Depot' : 'Open Depot'}
                        active={showDepot}
                        onClick={() => setShowDepot(v => !v)}
                    >
                        <Warehouse />
                    </ToolbarButton>

                    {/* Formation Editor */}
                    <ToolbarButton
                        tooltip={
                            showFormationEditor
                                ? 'Close Formations'
                                : 'Edit Formations'
                        }
                        active={showFormationEditor}
                        onClick={() => setShowFormationEditor(v => !v)}
                    >
                        <ListOrdered />
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

                    <ToolbarButton
                        tooltip={
                            showPreviewCurveArcs
                                ? 'Hide Preview Curve Arcs'
                                : 'Show Preview Curve Arcs'
                        }
                        active={showPreviewCurveArcs}
                        onClick={() => setShowPreviewCurveArcs(v => !v)}
                    >
                        <Spline />
                    </ToolbarButton>

                    <Separator />

                    {/* Import/Export — hover to expand */}
                    <div
                        className="relative"
                        onMouseEnter={() => {
                            if (exportSubmenuTimeoutRef.current) {
                                clearTimeout(exportSubmenuTimeoutRef.current);
                                exportSubmenuTimeoutRef.current = null;
                            }
                            setShowExportSubmenu(true);
                        }}
                        onMouseLeave={() => {
                            exportSubmenuTimeoutRef.current = setTimeout(
                                () => setShowExportSubmenu(false),
                                400
                            );
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                showExportSubmenu && 'bg-accent'
                            )}
                        >
                            <Download />
                        </Button>
                        {showExportSubmenu && (
                            <div
                                className="bg-background/80 absolute top-0 left-full z-50 flex translate-x-4 flex-col gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
                                onMouseEnter={() => {
                                    if (exportSubmenuTimeoutRef.current) {
                                        clearTimeout(
                                            exportSubmenuTimeoutRef.current
                                        );
                                        exportSubmenuTimeoutRef.current = null;
                                    }
                                    setShowExportSubmenu(true);
                                }}
                                onMouseLeave={() => {
                                    exportSubmenuTimeoutRef.current =
                                        setTimeout(
                                            () => setShowExportSubmenu(false),
                                            150
                                        );
                                }}
                            >
                                <ToolbarButton
                                    tooltip="Export Tracks"
                                    onClick={handleExportTracks}
                                >
                                    <ExportTrackIcon />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Import Tracks"
                                    onClick={handleImportTracks}
                                >
                                    <ImportTrackIcon />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Export Trains (cars, formations, positions)"
                                    onClick={handleExportTrains}
                                >
                                    <ExportTrainIcon />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Import Trains"
                                    onClick={handleImportTrains}
                                >
                                    <ImportTrainIcon />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Export All (tracks + trains)"
                                    onClick={handleExportAll}
                                >
                                    <ExportSceneIcon />
                                </ToolbarButton>
                                <ToolbarButton
                                    tooltip="Import All (tracks + trains)"
                                    onClick={handleImportAll}
                                >
                                    <ImportSceneIcon />
                                </ToolbarButton>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Debug */}
                    <ToolbarButton
                        tooltip={showDebugPanel ? 'Close Debug' : 'Open Debug'}
                        active={showDebugPanel}
                        onClick={() => setShowDebugPanel(v => !v)}
                    >
                        <Bug />
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

            {/* Layout deletion toolbar — lower left, only visible when layout mode is active */}
            {isLayoutActive && (
                <div
                className={cn(
                    'pointer-events-auto absolute bottom-3',
                    TOOLBAR_LEFT
                )}
            >
                    <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                        <ToolbarButton
                            tooltip={
                                mode === 'layout-deletion'
                                    ? 'End Deletion'
                                    : 'Delete Track'
                            }
                            active={mode === 'layout-deletion'}
                            destructive={mode === 'layout-deletion'}
                            destructiveMuted
                            onClick={handleLayoutDeletionToggle}
                        >
                            <BulldozerIcon />
                        </ToolbarButton>
                    </div>
                </div>
            )}

            {/* Train controls panel — only visible when trains exist or in placement mode */}
            {(mode === 'train-placement' || placedTrains.length > 0) && (
                <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">
                    <div className="bg-background/80 flex items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                        {/* Formation selector — only in placement mode */}
                        {mode === 'train-placement' && (
                            <>
                                <select
                                    className="bg-background h-7 rounded-md border px-2 text-xs"
                                    value={selectedPlacementFormationId ?? ''}
                                    onChange={e => {
                                        const val = e.target.value || null;
                                        setSelectedPlacementFormationId(val);
                                        const formation = val
                                            ? app.formationManager.getFormation(
                                                  val
                                              )
                                            : null;
                                        app.trainPlacementEngine.setFormation(
                                            formation
                                        );
                                    }}
                                >
                                    <option value="">Default (4 cars)</option>
                                    {app.formationManager
                                        .getFormations()
                                        .map(entry => (
                                            <option
                                                key={entry.id}
                                                value={entry.id}
                                            >
                                                {entry.id} (
                                                {
                                                    entry.formation.flatCars()
                                                        .length
                                                }{' '}
                                                car
                                                {entry.formation.flatCars()
                                                    .length !== 1
                                                    ? 's'
                                                    : ''}
                                                )
                                            </option>
                                        ))}
                                </select>
                                <Separator
                                    orientation="vertical"
                                    className="mx-0.5 h-6"
                                />
                            </>
                        )}

                        {placedTrains.map((entry, index) => (
                            <Tooltip key={entry.id}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={
                                            entry.id === selectedIndex
                                                ? 'default'
                                                : 'ghost'
                                        }
                                        size="icon-sm"
                                        onClick={() =>
                                            trainManager.setSelectedIndex(
                                                entry.id
                                            )
                                        }
                                    >
                                        <span className="font-mono text-xs">
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
                <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
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

            {/* Depot panel — car stock */}
            {showDepot && (
                <DraggablePanel
                    title="Depot"
                    onClose={() => setShowDepot(false)}
                    className="w-56"
                    headerActions={
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => app.carStockManager.createCar()}
                        >
                            <Plus className="size-3.5" />
                        </Button>
                    }
                >
                    <Separator className="mb-2" />
                    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                        {app.carStockManager.getAvailableCars().length === 0 ? (
                            <span className="text-muted-foreground py-4 text-center text-xs">
                                No cars in stock
                            </span>
                        ) : (
                            app.carStockManager
                                .getAvailableCars()
                                .map(entry => (
                                    <div
                                        key={entry.id}
                                        className="bg-muted/50 flex items-center justify-between rounded-lg px-2.5 py-1.5"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-foreground font-mono text-xs">
                                                {entry.id}
                                            </span>
                                            <span className="text-muted-foreground text-[10px]">
                                                {entry.car.bogieOffsets()
                                                    .length + 1}{' '}
                                                bogies
                                                {' · '}
                                                {entry.car.edgeToBogie +
                                                    entry.car
                                                        .bogieOffsets()
                                                        .reduce(
                                                            (a, b) => a + b,
                                                            0
                                                        ) +
                                                    entry.car.bogieToEdge}
                                                m
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() =>
                                                app.carStockManager.removeCar(
                                                    entry.id
                                                )
                                            }
                                        >
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </div>
                                ))
                        )}
                    </div>
                </DraggablePanel>
            )}

            {/* Formation editor panel */}
            {showFormationEditor && (
                <FormationEditor
                    formationManager={app.formationManager}
                    carStockManager={app.carStockManager}
                    onClose={() => setShowFormationEditor(false)}
                />
            )}

            {/* Debug panel */}
            {showDebugPanel && (
                <DraggablePanel
                    title="Debug"
                    onClose={() => setShowDebugPanel(false)}
                    className="w-56"
                >
                    <Separator className="mb-2" />
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-foreground">
                                Joint numbers
                            </span>
                            <input
                                type="checkbox"
                                checked={showJointNumbers}
                                onChange={() => setShowJointNumbers(v => !v)}
                            />
                        </label>
                        <label className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-foreground">Segment IDs</span>
                            <input
                                type="checkbox"
                                checked={showSegmentIds}
                                onChange={() => setShowSegmentIds(v => !v)}
                            />
                        </label>
                    </div>
                </DraggablePanel>
            )}

            {/* Status bar */}
            <div className="pointer-events-none absolute right-3 bottom-3">
                <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-[10px] backdrop-blur-sm">
                    Elev: {elevation} · T: {tension}
                </span>
            </div>
        </TooltipProvider>
    );
}
