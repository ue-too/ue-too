import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import {
    Bug,
    Building2,
    Gauge,
    Layers,
    List,
    ListOrdered,
    Map,
    Paintbrush,
    Spline,
    TrainFront,
    TrainTrack,
    Trash2,
    Warehouse,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuildingPreset } from '@/buildings/types';
import { FormationEditor } from '@/components/formation-editor';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
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
import {
    type CarTemplate,
    generateTemplateId,
    validateCarDefinition,
} from '@/trains/car-template';

import type { AppMode } from './types';
import { TOOLBAR_LEFT } from './types';
import { downloadJson, uploadJson } from './utils';
import { ToolbarButton } from './ToolbarButton';
import { ExportSubmenu } from './ExportSubmenu';
import { SunAngleControl } from './SunAngleControl';
import { FormationSelector } from './FormationSelector';
import { LayoutDeletionToolbar } from './LayoutDeletionToolbar';
import { TrainPanel } from './TrainPanel';
import { BuildingOptionsPanel } from './BuildingOptionsPanel';
import { DepotPanel } from './DepotPanel';
import { DebugPanel } from './DebugPanel';

export function BananaToolbar({
    showMap = false,
    onToggleMap,
}: {
    showMap?: boolean;
    onToggleMap?: () => void;
} = {}) {
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
    const [, setTrainListVersion] = useState(0);
    const [showDepot, setShowDepot] = useState(false);
    const [showTrainPanel, setShowTrainPanel] = useState(false);
    const [showFormationEditor, setShowFormationEditor] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [showExportSubmenu, setShowExportSubmenu] = useState(false);
    const [carTemplates, setCarTemplates] = useState<CarTemplate[]>([]);
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
        const unsubChanges = app.trainManager.subscribeToChanges(() =>
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
    }, [app]);

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
    }, [app, mode, exitAllModes]);

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
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToTrain');
            setMode('train-placement');
        }
    }, [app, mode, exitAllModes]);

    const handleBuildingPlacementToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'building-placement') {
            exitAllModes();
        } else {
            exitAllModes();
            toggleKmtInput(false);
            setMode('building-placement');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

    const handleBuildingDeletionToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'building-deletion') {
            exitAllModes();
        } else {
            exitAllModes();
            toggleKmtInput(false);
            setMode('building-deletion');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

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

    const handleImportCarDefinition = useCallback(() => {
        if (!app) return;
        uploadJson(parsed => {
            const result = validateCarDefinition(parsed);
            if (!result.valid) {
                alert(`Invalid car definition: ${result.error}`);
                return;
            }
            const def = parsed as {
                bogieOffsets: number[];
                edgeToBogie?: number;
                bogieToEdge?: number;
                image?: {
                    src: string;
                    position: { x: number; y: number };
                    width: number;
                    height: number;
                };
            };
            const template: CarTemplate = {
                id: generateTemplateId(),
                bogieOffsets: def.bogieOffsets,
                edgeToBogie: def.edgeToBogie ?? 2.5,
                bogieToEdge: def.bogieToEdge ?? 2.5,
                image: def.image,
            };
            setCarTemplates(prev => [...prev, template]);
        });
    }, [app]);

    if (!app) return null;

    const trainManager = app.trainManager;
    const placedTrains = trainManager.getPlacedTrains();
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
                    <ToolbarButton
                        tooltip={isLayoutActive ? 'End Layout' : 'Start Layout'}
                        active={isLayoutActive}
                        disabled={mode !== 'idle' && !isLayoutActive}
                        onClick={handleLayoutToggle}
                    >
                        <TrainTrack />
                    </ToolbarButton>

                    <Separator />

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

                    <ToolbarButton
                        tooltip={
                            showTrainPanel ? 'Close Train List' : 'Train List'
                        }
                        active={showTrainPanel}
                        disabled={
                            placedTrains.length === 0 &&
                            mode !== 'train-placement'
                        }
                        onClick={() => setShowTrainPanel(v => !v)}
                    >
                        <List />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={showDepot ? 'Close Depot' : 'Open Depot'}
                        active={showDepot}
                        onClick={() => setShowDepot(v => !v)}
                    >
                        <Warehouse />
                    </ToolbarButton>

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

                    <ExportSubmenu
                        show={showExportSubmenu}
                        onShowChange={setShowExportSubmenu}
                        onExportTracks={handleExportTracks}
                        onImportTracks={handleImportTracks}
                        onExportTrains={handleExportTrains}
                        onImportTrains={handleImportTrains}
                        onExportAll={handleExportAll}
                        onImportAll={handleImportAll}
                        onImportCarDefinition={handleImportCarDefinition}
                    />

                    <Separator />

                    {onToggleMap && (
                        <ToolbarButton
                            tooltip={showMap ? 'Hide Map' : 'Show Map'}
                            active={showMap}
                            onClick={onToggleMap}
                        >
                            <Map />
                        </ToolbarButton>
                    )}

                    <ToolbarButton
                        tooltip={showDebugPanel ? 'Close Debug' : 'Open Debug'}
                        active={showDebugPanel}
                        onClick={() => setShowDebugPanel(v => !v)}
                    >
                        <Bug />
                    </ToolbarButton>
                </div>

                <SunAngleControl value={sunAngle} onChange={setSunAngle} />
            </div>

            {mode === 'train-placement' && (
                <FormationSelector
                    formationManager={app.formationManager}
                    trainPlacementEngine={app.trainPlacementEngine}
                    selectedFormationId={selectedPlacementFormationId}
                    onFormationChange={setSelectedPlacementFormationId}
                />
            )}

            {isLayoutActive && (
                <LayoutDeletionToolbar
                    isDeletionMode={mode === 'layout-deletion'}
                    onToggle={handleLayoutDeletionToggle}
                />
            )}

            {showTrainPanel &&
                (mode === 'train-placement' || placedTrains.length > 0) && (
                    <TrainPanel
                        trainManager={trainManager}
                        onClose={() => setShowTrainPanel(false)}
                    />
                )}

            {mode === 'building-placement' && (
                <BuildingOptionsPanel
                    preset={buildingPreset}
                    onPresetChange={setBuildingPreset}
                    elevation={buildingElevation}
                    onElevationChange={setBuildingElevation}
                    height={buildingHeight}
                    onHeightChange={setBuildingHeight}
                />
            )}

            {showDepot && (
                <DepotPanel
                    carStockManager={app.carStockManager}
                    carImageRegistry={app.carImageRegistry}
                    carTemplates={carTemplates}
                    onCarTemplatesChange={setCarTemplates}
                    onClose={() => setShowDepot(false)}
                />
            )}

            {showFormationEditor && (
                <FormationEditor
                    formationManager={app.formationManager}
                    carStockManager={app.carStockManager}
                    trainManager={app.trainManager}
                    onClose={() => setShowFormationEditor(false)}
                />
            )}

            {showDebugPanel && (
                <DebugPanel
                    showJointNumbers={showJointNumbers}
                    onShowJointNumbersChange={setShowJointNumbers}
                    showSegmentIds={showSegmentIds}
                    onShowSegmentIdsChange={setShowSegmentIds}
                    onClose={() => setShowDebugPanel(false)}
                />
            )}

            <div className="pointer-events-none absolute right-3 bottom-10">
                <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-[10px] backdrop-blur-sm">
                    Elev: {elevation} · T: {tension}
                </span>
            </div>
        </TooltipProvider>
    );
}
