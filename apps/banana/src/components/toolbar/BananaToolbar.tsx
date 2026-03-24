import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import {
    Bug,
    Building2,
    Landmark,
    Layers,
    List,
    ListOrdered,
    Map,
    Spline,
    TrainFront,
    TrainTrack,
    Trash2,
    Warehouse,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { StationManager } from '@/stations/station-manager';
import type { SerializedStationData } from '@/stations/types';
import {
    TerrainData,
    validateSerializedTerrainData,
} from '@/terrain/terrain-data';
import type { SerializedTerrainData } from '@/terrain/terrain-data';
import {
    type CarTemplate,
    generateTemplateId,
    validateCarDefinition,
} from '@/trains/car-template';
import type { ThrottleSteps } from '@/trains/formation';
import { ELEVATION } from '@/trains/tracks/types';
import type { SerializedTrackData, TrackStyle } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';
import {
    type SerializedTrainData,
    deserializeTrainData,
    serializeTrainData,
    validateSerializedTrainData,
} from '@/trains/train-serialization';

import { trackEvent } from '@/utils/analytics';

import { BuildingOptionsPanel } from './BuildingOptionsPanel';
import { DebugPanel } from './DebugPanel';
import { DepotPanel } from './DepotPanel';
import { ExportSubmenu } from './ExportSubmenu';
import { FormationSelector } from './FormationSelector';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LayoutDeletionToolbar } from './LayoutDeletionToolbar';
import { ScaleRuler } from './ScaleRuler';
import { StationListPanel } from './StationListPanel';
import { SunAngleControl } from './SunAngleControl';
import { TerrainControl } from './TerrainControl';
import { TerrainLegend } from './TerrainLegend';
import { ToolbarButton } from './ToolbarButton';
import { TrackStyleSelector } from './TrackStyleSelector';
import { TrainPanel } from './TrainPanel';
import type { AppMode } from './types';
import { TOOLBAR_LEFT } from './types';
import { downloadJson, uploadJson } from './utils';

export function BananaToolbar({
    showMap = false,
    onToggleMap,
}: {
    showMap?: boolean;
    onToggleMap?: () => void;
} = {}) {
    const { t } = useTranslation();
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
    const [showElevationGradient, setShowElevationGradient] = useState(false);
    const [showPreviewCurveArcs, setShowPreviewCurveArcs] = useState(false);
    const [showJointNumbers, setShowJointNumbers] = useState(false);
    const [showSegmentIds, setShowSegmentIds] = useState(false);
    const [showFormationIds, setShowFormationIds] = useState(false);
    const [showStationStops, setShowStationStops] = useState(false);
    const [showStationLocations, setShowStationLocations] = useState(false);
    const [showProximityLines, setShowProximityLines] = useState(false);
    const [, setTrainListVersion] = useState(0);
    const [showDepot, setShowDepot] = useState(false);
    const [showTrainPanel, setShowTrainPanel] = useState(false);
    const [showFormationEditor, setShowFormationEditor] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(false);
    const [showStationList, setShowStationList] = useState(false);
    const [showStats, setShowStats] = useState(true);
    const [terrainXray, setTerrainXray] = useState(false);
    const [terrainFillVisible, setTerrainFillVisible] = useState(true);
    const [terrainOpacity, setTerrainOpacity] = useState(1);
    const [whiteOcclusion, setWhiteOcclusion] = useState(false);
    const [trackStyle, setTrackStyle] = useState<TrackStyle>('ballasted');
    const [electrified, setElectrified] = useState(false);
    const [projectionBuffer, setProjectionBuffer] = useState(0.5);
    const [bed, setBed] = useState(false);
    const [bedWidth, setBedWidth] = useState(3);
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
        app.trackRenderSystem.showElevationGradient = showElevationGradient;
    }, [app, showElevationGradient]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.showPreviewCurveArcs = showPreviewCurveArcs;
    }, [app, showPreviewCurveArcs]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.trackStyle = trackStyle;
    }, [app, trackStyle]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.electrified = electrified;
    }, [app, electrified]);

    useEffect(() => {
        if (!app) return;
        app.curveEngine.trackGraph.projectionBuffer = projectionBuffer;
    }, [app, projectionBuffer]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.bed = bed;
        app.curveEngine.trackGraph.bedEnabled = bed;
    }, [app, bed]);

    useEffect(() => {
        if (!app) return;
        app.trackRenderSystem.bedWidth = bedWidth;
        app.curveEngine.trackGraph.bedWidth = bedWidth;
    }, [app, bedWidth]);

    useEffect(() => {
        if (!app) return;
        app.terrainRenderSystem.xray = terrainXray;
    }, [app, terrainXray]);

    useEffect(() => {
        if (!app) return;
        app.terrainRenderSystem.fillVisible = terrainFillVisible;
    }, [app, terrainFillVisible]);

    useEffect(() => {
        if (!app) return;
        app.terrainRenderSystem.fillOpacity = terrainOpacity;
    }, [app, terrainOpacity]);

    useEffect(() => {
        if (!app) return;
        app.terrainRenderSystem.whiteOcclusion = whiteOcclusion;
    }, [app, whiteOcclusion]);

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
        app.debugOverlayRenderSystem.setShowFormationDebug(showFormationIds);
    }, [app, showFormationIds]);

    useEffect(() => {
        if (!app) return;
        app.debugOverlayRenderSystem.setShowStationStopDebug(showStationStops);
    }, [app, showStationStops]);

    useEffect(() => {
        if (!app) return;
        app.debugOverlayRenderSystem.setShowStationLocationDebug(
            showStationLocations
        );
    }, [app, showStationLocations]);

    useEffect(() => {
        if (!app) return;
        app.debugOverlayRenderSystem.setShowProximityDebug(showProximityLines);
    }, [app, showProximityLines]);

    useEffect(() => {
        if (!app) return;
        app.statsDom.style.display = showStats ? 'block' : 'none';
    }, [app, showStats]);

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
            trackEvent('start-track-drawing');
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
            trackEvent('start-train-placement');
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
            trackEvent('start-building-placement');
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

    const handleStationPlacementToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'station-placement') {
            exitAllModes();
        } else {
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToStation');
            setMode('station-placement');
            trackEvent('start-station-placement');
        }
    }, [app, mode, exitAllModes]);

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
        trackEvent('export-tracks');
        const data = {
            ...app.curveEngine.trackGraph.serialize(),
            stations: app.stationManager.serialize().stations,
        };
        downloadJson(`track-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportTracks = useCallback(() => {
        if (!app) return;
        trackEvent('import-tracks');
        uploadJson(parsed => {
            const result = validateSerializedTrackData(parsed);
            if (!result.valid) {
                alert(t('invalidTrackData', { error: result.error }));
                return;
            }
            app.curveEngine.trackGraph.loadFromSerializedData(
                parsed as SerializedTrackData
            );
            // Restore stations if present in the track data
            const obj = parsed as Record<string, unknown>;
            if (Array.isArray(obj.stations)) {
                for (const { id } of app.stationManager.getStations()) {
                    app.stationRenderSystem.removeStation(id);
                    app.stationManager.destroyStation(id);
                }
                const restored = StationManager.deserialize({
                    stations: obj.stations as SerializedStationData['stations'],
                });
                for (const { id, station } of restored.getStations()) {
                    app.stationManager.createStationWithId(id, station);
                    app.stationRenderSystem.addStation(id);
                }
            }
        });
    }, [app]);

    const handleExportTrains = useCallback(() => {
        if (!app) return;
        trackEvent('export-trains');
        const data = serializeTrainData(
            app.trainManager,
            app.formationManager,
            app.carStockManager
        );
        downloadJson(`train-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportTrains = useCallback(() => {
        if (!app) return;
        trackEvent('import-trains');
        uploadJson(parsed => {
            const result = validateSerializedTrainData(parsed);
            if (!result.valid) {
                alert(t('invalidTrainData', { error: result.error }));
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
        trackEvent('export-scene');
        const data = serializeSceneData(app);
        downloadJson(`scene-data-${Date.now()}.json`, data);
    }, [app]);

    const handleImportAll = useCallback(() => {
        if (!app) return;
        trackEvent('import-scene');
        uploadJson(parsed => {
            const result = validateSerializedSceneData(parsed);
            if (!result.valid) {
                alert(t('invalidSceneData', { error: result.error }));
                return;
            }
            deserializeSceneData(app, parsed as SerializedSceneData);
        });
    }, [app]);

    const handleImportTerrain = useCallback(() => {
        if (!app) return;
        trackEvent('import-terrain');
        uploadJson(parsed => {
            // Accept both standalone terrain files and scene files with a terrain field
            let terrainObj: unknown = parsed;
            if (
                parsed != null &&
                typeof parsed === 'object' &&
                'terrain' in (parsed as Record<string, unknown>)
            ) {
                terrainObj = (parsed as Record<string, unknown>).terrain;
            }
            const result = validateSerializedTerrainData(terrainObj);
            if (!result.valid) {
                alert(t('invalidTerrainData', { error: result.error }));
                return;
            }
            const restored = TerrainData.deserialize(
                terrainObj as SerializedTerrainData
            );
            app.terrainRenderSystem.setTerrainData(restored);
        });
    }, [app, t]);

    const handleImportCarDefinition = useCallback(() => {
        if (!app) return;
        trackEvent('import-car-definition');
        uploadJson(parsed => {
            const result = validateCarDefinition(parsed);
            if (!result.valid) {
                alert(t('invalidCarDefinition', { error: result.error }));
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

    const handleSpawnStressTest = useCallback(
        (count: number) => {
            if (!app) return;
            const placed = app.spawnParallelTracksWithTrains(count);
            console.log(
                `Stress test: spawned ${placed} trains on parallel tracks`
            );
        },
        [app]
    );

    const handleThrottleAll = useCallback(
        (step: string) => {
            if (!app) return;
            const placed = app.trainManager.getPlacedTrains();
            for (const { train } of placed) {
                train.setThrottleStep(step as ThrottleSteps);
            }
            console.log(`Set throttle to ${step} on ${placed.length} trains`);
        },
        [app]
    );

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
                        tooltip={
                            isLayoutActive ? t('endLayout') : t('startLayout')
                        }
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
                                ? t('endPlacement')
                                : t('placeTrain')
                        }
                        active={mode === 'train-placement'}
                        disabled={mode !== 'idle' && mode !== 'train-placement'}
                        onClick={handleTrainPlacementToggle}
                    >
                        <TrainFront />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={
                            showTrainPanel
                                ? t('closeTrainList')
                                : t('trainList')
                        }
                        active={showTrainPanel}
                        disabled={
                            placedTrains.length === 0 &&
                            mode !== 'train-placement'
                        }
                        onClick={() => { if (!showTrainPanel) trackEvent('open-train-panel'); setShowTrainPanel(v => !v); }}
                    >
                        <List />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={showDepot ? t('closeDepot') : t('openDepot')}
                        active={showDepot}
                        onClick={() => { if (!showDepot) trackEvent('open-depot'); setShowDepot(v => !v); }}
                    >
                        <Warehouse />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={
                            showFormationEditor
                                ? t('closeFormations')
                                : t('editFormations')
                        }
                        active={showFormationEditor}
                        onClick={() => { if (!showFormationEditor) trackEvent('open-formation-editor'); setShowFormationEditor(v => !v); }}
                    >
                        <ListOrdered />
                    </ToolbarButton>

                    {/* <ToolbarButton
                        tooltip={
                            mode === 'building-placement'
                                ? t('endPlacement')
                                : t('placeBuilding')
                        }
                        active={mode === 'building-placement'}
                        disabled={
                            mode !== 'idle' && mode !== 'building-placement'
                        }
                        onClick={handleBuildingPlacementToggle}
                    >
                        <Building2 />
                    </ToolbarButton> */}
                    {/* <ToolbarButton
                        tooltip={
                            mode === 'building-deletion'
                                ? t('endDeletion')
                                : t('deleteBuilding')
                        }
                        active={mode === 'building-deletion'}
                        destructive={mode === 'building-deletion'}
                        disabled={
                            mode !== 'idle' && mode !== 'building-deletion'
                        }
                        onClick={handleBuildingDeletionToggle}
                    >
                        <Trash2 />
                    </ToolbarButton> */}
                    <ToolbarButton
                        tooltip={
                            mode === 'station-placement'
                                ? t('endStationPlacement')
                                : t('placeStation')
                        }
                        active={mode === 'station-placement'}
                        disabled={
                            mode !== 'idle' && mode !== 'station-placement'
                        }
                        onClick={handleStationPlacementToggle}
                    >
                        <Warehouse />
                    </ToolbarButton>
                    <ToolbarButton
                        tooltip={
                            showStationList
                                ? t('closeStationList')
                                : t('openStationList')
                        }
                        active={showStationList}
                        onClick={() => { if (!showStationList) trackEvent('open-station-list'); setShowStationList(v => !v); }}
                    >
                        <Landmark />
                    </ToolbarButton>

                    <Separator />

                    <ToolbarButton
                        tooltip={
                            showElevationGradient
                                ? t('hideElevationGradient')
                                : t('showElevationGradient')
                        }
                        active={showElevationGradient}
                        onClick={() => setShowElevationGradient(v => !v)}
                    >
                        <Layers />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={
                            showPreviewCurveArcs
                                ? t('hidePreviewCurveArcs')
                                : t('showPreviewCurveArcs')
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
                        onImportTerrain={handleImportTerrain}
                        onImportCarDefinition={handleImportCarDefinition}
                    />

                    <Separator />

                    {onToggleMap && (
                        <ToolbarButton
                            tooltip={showMap ? t('hideMap') : t('showMap')}
                            active={showMap}
                            onClick={onToggleMap}
                        >
                            <Map />
                        </ToolbarButton>
                    )}

                    <ToolbarButton
                        tooltip={
                            showDebugPanel ? t('closeDebug') : t('openDebug')
                        }
                        active={showDebugPanel}
                        onClick={() => { if (!showDebugPanel) trackEvent('open-debug-panel'); setShowDebugPanel(v => !v); }}
                    >
                        <Bug />
                    </ToolbarButton>
                </div>

                <SunAngleControl value={sunAngle} onChange={setSunAngle} />
                <TerrainControl
                    visible={terrainFillVisible}
                    onVisibleChange={setTerrainFillVisible}
                    opacity={terrainOpacity}
                    onOpacityChange={setTerrainOpacity}
                    whiteOcclusion={whiteOcclusion}
                    onWhiteOcclusionChange={setWhiteOcclusion}
                />
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
                <>
                    <LayoutDeletionToolbar
                        isDeletionMode={mode === 'layout-deletion'}
                        onToggle={handleLayoutDeletionToggle}
                    />
                    <TrackStyleSelector
                        value={trackStyle}
                        onChange={setTrackStyle}
                        electrified={electrified}
                        onElectrifiedChange={setElectrified}
                        projectionBuffer={projectionBuffer}
                        onProjectionBufferChange={setProjectionBuffer}
                        bed={bed}
                        onBedChange={setBed}
                        bedWidth={bedWidth}
                        onBedWidthChange={setBedWidth}
                    />
                </>
            )}

            {showTrainPanel &&
                (mode === 'train-placement' || placedTrains.length > 0) && (
                    <TrainPanel
                        trainManager={trainManager}
                        startFocusAnimation={app.startFocusAnimation}
                        startFollowAnimation={app.startFollowAnimation}
                        stopFollowing={app.stopFollowing}
                        isFollowing={app.isFollowing}
                        camera={app.camera}
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

            {showStationList && (
                <StationListPanel
                    stationManager={app.stationManager}
                    stationRenderSystem={app.stationRenderSystem}
                    trackGraph={app.curveEngine.trackGraph}
                    cameraRig={app.cameraRig}
                    onClose={() => setShowStationList(false)}
                    onStationChange={() =>
                        app.debugOverlayRenderSystem.refresh()
                    }
                />
            )}

            {showDebugPanel && (
                <DebugPanel
                    showJointNumbers={showJointNumbers}
                    onShowJointNumbersChange={setShowJointNumbers}
                    showSegmentIds={showSegmentIds}
                    onShowSegmentIdsChange={setShowSegmentIds}
                    showFormationIds={showFormationIds}
                    onShowFormationIdsChange={setShowFormationIds}
                    showStationStops={showStationStops}
                    onShowStationStopsChange={setShowStationStops}
                    showStationLocations={showStationLocations}
                    onShowStationLocationsChange={setShowStationLocations}
                    showProximityLines={showProximityLines}
                    onShowProximityLinesChange={setShowProximityLines}
                    showStats={showStats}
                    onShowStatsChange={setShowStats}
                    terrainXray={terrainXray}
                    onTerrainXrayChange={setTerrainXray}
                    onSpawnStressTest={handleSpawnStressTest}
                    onThrottleAll={handleThrottleAll}
                    onClose={() => setShowDebugPanel(false)}
                />
            )}

            <div className="pointer-events-auto absolute top-3 right-3">
                <LanguageSwitcher />
            </div>

            <div className="absolute right-3 bottom-10 flex flex-col items-end gap-1">
                <TerrainLegend />
                <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-[10px] backdrop-blur-sm">
                    {t('elevation')}: {elevation} · T: {tension}
                </span>
                <ScaleRuler />
            </div>
        </TooltipProvider>
    );
}
