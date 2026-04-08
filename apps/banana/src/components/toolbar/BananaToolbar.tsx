import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import {
    Bug,
    Building2,
    Clock,
    FilePlus,
    FolderOpen,
    Landmark,
    Save,
    Layers,
    List,
    ListOrdered,
    Map,
    Signal,
    Spline,
    TrainFront,
    TrainTrack,
    Trash2,
    Warehouse,
} from '@/assets/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import type { BuildingPreset } from '@/buildings/types';
import { FormationEditor } from '@/components/formation-editor';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBananaApp } from '@/contexts/pixi';
import { useAutoSave } from '@/hooks/use-auto-save';
import { useRenderSync } from '@/hooks/use-render-sync';
import { cn } from '@/lib/utils';
import { useRenderSettingsStore } from '@/stores/render-settings-store';
import { useSceneStore } from '@/stores/scene-store';
import { useToolbarUIStore } from '@/stores/toolbar-ui-store';
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
import type { SerializedTrackData } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';
import {
    type SerializedTrainData,
    deserializeTrainData,
    serializeTrainData,
    validateSerializedTrainData,
} from '@/trains/train-serialization';

import { trackEvent } from '@/utils/analytics';

import { AutoSaveIntervalSelector } from './AutoSaveIntervalSelector';
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
import { SignalPanel } from './SignalPanel';
import { TimetablePanel } from './TimetablePanel';
import { TrainPanel } from './TrainPanel';
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
    const { saveNow } = useAutoSave();
    const showScenePickerAction = useSceneStore((s) => s.showScenePicker);
    const createNewScene = useSceneStore((s) => s.createNewScene);

    // Toolbar UI store — mode and panel visibility
    const mode = useToolbarUIStore((s) => s.mode);
    const setMode = useToolbarUIStore((s) => s.setMode);
    const {
        showDepot,
        showTrainPanel,
        showFormationEditor,
        showDebugPanel,
        showStationList,
        showTimetable,
        showSignalPanel,
        showExportSubmenu,
        showAutoSaveMenu,
    } = useToolbarUIStore(
        useShallow((s) => ({
            showDepot: s.showDepot,
            showTrainPanel: s.showTrainPanel,
            showFormationEditor: s.showFormationEditor,
            showDebugPanel: s.showDebugPanel,
            showStationList: s.showStationList,
            showTimetable: s.showTimetable,
            showSignalPanel: s.showSignalPanel,
            showExportSubmenu: s.showExportSubmenu,
            showAutoSaveMenu: s.showAutoSaveMenu,
        }))
    );
    const setPanel = useToolbarUIStore((s) => s.setPanel);
    const togglePanel = useToolbarUIStore((s) => s.togglePanel);

    // Render settings store
    const {
        sunAngle,
        showElevationGradient,
        showPreviewCurveArcs,
        trackStyle,
        electrified,
        projectionBuffer,
        bed,
        bedWidth,
        terrainFillVisible,
        terrainOpacity,
        whiteOcclusion,
        showJointNumbers,
        showSegmentIds,
        showFormationIds,
        showStationStops,
        showStationLocations,
        showProximityLines,
        showStats,
        terrainXray,
    } = useRenderSettingsStore(
        useShallow((s) => ({
            sunAngle: s.sunAngle,
            showElevationGradient: s.showElevationGradient,
            showPreviewCurveArcs: s.showPreviewCurveArcs,
            trackStyle: s.trackStyle,
            electrified: s.electrified,
            projectionBuffer: s.projectionBuffer,
            bed: s.bed,
            bedWidth: s.bedWidth,
            terrainFillVisible: s.terrainFillVisible,
            terrainOpacity: s.terrainOpacity,
            whiteOcclusion: s.whiteOcclusion,
            showJointNumbers: s.showJointNumbers,
            showSegmentIds: s.showSegmentIds,
            showFormationIds: s.showFormationIds,
            showStationStops: s.showStationStops,
            showStationLocations: s.showStationLocations,
            showProximityLines: s.showProximityLines,
            showStats: s.showStats,
            terrainXray: s.terrainXray,
        }))
    );
    const rs = useRenderSettingsStore;

    // Local state that stays in the component
    const [elevation, setElevation] = useState<string>('N/A');
    const [tension, setTension] = useState<string>('1.0');
    const [buildingPreset, setBuildingPreset] =
        useState<BuildingPreset>('medium');
    const [buildingElevation, setBuildingElevation] = useState<ELEVATION>(
        ELEVATION.ABOVE_1
    );
    const [buildingHeight, setBuildingHeight] = useState(1);
    const [, setTrainListVersion] = useState(0);
    const [stressStartX, setStressStartX] = useState(0);
    const [stressStartY, setStressStartY] = useState(0);
    const [carTemplates, setCarTemplates] = useState<CarTemplate[]>([]);

    const selectedBuildingRef = useRef<number | null>(null);

    const buildingPresetRef = useRef(buildingPreset);
    buildingPresetRef.current = buildingPreset;
    const buildingElevationRef = useRef(buildingElevation);
    buildingElevationRef.current = buildingElevation;
    const buildingHeightRef = useRef(buildingHeight);
    buildingHeightRef.current = buildingHeight;

    // Sync render settings to PIXI systems
    useRenderSync(app);

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
            const currentMode = useToolbarUIStore.getState().mode;

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
            } else if (currentMode === 'stress-pick') {
                setStressStartX(Math.round(worldPosition.x));
                setStressStartY(Math.round(worldPosition.y));
                setMode('idle');
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
        uploadJson(async (parsed) => {
            const result = validateSerializedTrackData(parsed);
            if (!result.valid) {
                alert(t('invalidTrackData', { error: result.error }));
                return;
            }

            useSceneStore.getState().setSceneLoading(true);
            useSceneStore.getState().setSceneLoadProgress(0);

            await app.curveEngine.trackGraph.loadFromSerializedData(
                parsed as SerializedTrackData,
                {
                    onProgress: (loaded, total) =>
                        useSceneStore.getState().setSceneLoadProgress(
                            total > 0 ? loaded / total : 1
                        ),
                },
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

            useSceneStore.getState().setSceneLoading(false);
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
        uploadJson(async (parsed) => {
            const result = validateSerializedSceneData(parsed);
            if (!result.valid) {
                alert(t('invalidSceneData', { error: result.error }));
                return;
            }

            useSceneStore.getState().setSceneLoading(true);
            useSceneStore.getState().setSceneLoadProgress(0);

            await deserializeSceneData(app, parsed as SerializedSceneData, {
                onProgress: (loaded, total) =>
                    useSceneStore.getState().setSceneLoadProgress(
                        total > 0 ? loaded / total : 1
                    ),
            });

            useSceneStore.getState().setSceneLoading(false);
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
        (count: number, startX?: number, startY?: number) => {
            if (!app) return;
            const placed = app.spawnParallelTracksWithTrains(count, startX, startY);
            console.log(
                `Stress test: spawned ${placed} trains at (${startX ?? 0}, ${startY ?? 0})`
            );
        },
        [app]
    );

    const handleGenerateTracks = useCallback(
        (count: number) => {
            if (!app) return;
            const created = app.generateProceduralTracks({
                segmentCount: count,
                startX: stressStartX,
                startY: stressStartY,
                gentleCurve: true,
            });
            console.log(`Generated ${created} track segments`);
        },
        [app, stressStartX, stressStartY]
    );

    const handlePickStressStart = useCallback(() => {
        setMode('stress-pick');
    }, []);

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

    const handleSwitchDirectionAll = useCallback(() => {
        if (!app) return;
        const placed = app.trainManager.getPlacedTrains();
        for (const { train } of placed) {
            train.switchDirection();
        }
        console.log(`Switched direction on ${placed.length} trains`);
    }, [app]);

    const handleBrakeAll = useCallback(
        (step: string) => {
            if (!app) return;
            const placed = app.trainManager.getPlacedTrains();
            for (const { train } of placed) {
                train.setThrottleStep(step as ThrottleSteps);
            }
            console.log(`Brake ${step} on ${placed.length} trains`);
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
                    'scrollbar-hide pointer-events-auto absolute top-1/2 flex max-h-[calc(100dvh-2rem)] -translate-y-1/2 flex-col items-center gap-3 overflow-y-auto overflow-x-visible',
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
                        onClick={() => { if (!showTrainPanel) trackEvent('open-train-panel'); togglePanel('trainPanel'); }}
                    >
                        <List />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={showDepot ? t('closeDepot') : t('openDepot')}
                        active={showDepot}
                        onClick={() => { if (!showDepot) trackEvent('open-depot'); togglePanel('depot'); }}
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
                        onClick={() => { if (!showFormationEditor) trackEvent('open-formation-editor'); togglePanel('formationEditor'); }}
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
                        onClick={() => { if (!showStationList) trackEvent('open-station-list'); togglePanel('stationList'); }}
                    >
                        <Landmark />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={
                            showTimetable
                                ? t('closeTimetable')
                                : t('openTimetable')
                        }
                        active={showTimetable}
                        onClick={() => togglePanel('timetable')}
                    >
                        <Clock />
                    </ToolbarButton>

                    <ToolbarButton
                        tooltip={
                            showSignalPanel
                                ? t('closeSignals')
                                : t('openSignals')
                        }
                        active={showSignalPanel}
                        onClick={() => togglePanel('signalPanel')}
                    >
                        <Signal />
                    </ToolbarButton>

                    <Separator />

                    <ToolbarButton
                        tooltip={
                            showElevationGradient
                                ? t('hideElevationGradient')
                                : t('showElevationGradient')
                        }
                        active={showElevationGradient}
                        onClick={() => rs.getState().setShowElevationGradient(!showElevationGradient)}
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
                        onClick={() => rs.getState().setShowPreviewCurveArcs(!showPreviewCurveArcs)}
                    >
                        <Spline />
                    </ToolbarButton>

                    <Separator />

                    <ExportSubmenu
                        show={showExportSubmenu}
                        onShowChange={(open) => {
                            setPanel('exportSubmenu', open);
                            if (open) setPanel('autoSaveMenu', false);
                        }}
                        onExportTracks={handleExportTracks}
                        onImportTracks={handleImportTracks}
                        onExportTrains={handleExportTrains}
                        onImportTrains={handleImportTrains}
                        onExportAll={handleExportAll}
                        onImportAll={handleImportAll}
                        onImportTerrain={handleImportTerrain}
                        onImportCarDefinition={handleImportCarDefinition}
                    />

                    <ToolbarButton tooltip={t('savedScenes')} onClick={() => showScenePickerAction()}>
                        <FolderOpen />
                    </ToolbarButton>
                    <ToolbarButton tooltip={t('saveScene')} onClick={saveNow}>
                        <Save />
                    </ToolbarButton>
                    <ToolbarButton tooltip={t('newScene')} onClick={() => createNewScene()}>
                        <FilePlus />
                    </ToolbarButton>
                    <AutoSaveIntervalSelector
                        show={showAutoSaveMenu}
                        onShowChange={(open) => {
                            setPanel('autoSaveMenu', open);
                            if (open) setPanel('exportSubmenu', false);
                        }}
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
                        onClick={() => { if (!showDebugPanel) trackEvent('open-debug-panel'); togglePanel('debugPanel'); }}
                    >
                        <Bug />
                    </ToolbarButton>
                </div>

                <SunAngleControl value={sunAngle} onChange={rs.getState().setSunAngle} />
                <TerrainControl
                    visible={terrainFillVisible}
                    onVisibleChange={rs.getState().setTerrainFillVisible}
                    opacity={terrainOpacity}
                    onOpacityChange={rs.getState().setTerrainOpacity}
                    whiteOcclusion={whiteOcclusion}
                    onWhiteOcclusionChange={rs.getState().setWhiteOcclusion}
                />
            </div>

            {mode === 'train-placement' && (
                <FormationSelector
                    formationManager={app.formationManager}
                    trainPlacementEngine={app.trainPlacementEngine}
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
                        onChange={rs.getState().setTrackStyle}
                        electrified={electrified}
                        onElectrifiedChange={rs.getState().setElectrified}
                        projectionBuffer={projectionBuffer}
                        onProjectionBufferChange={rs.getState().setProjectionBuffer}
                        bed={bed}
                        onBedChange={rs.getState().setBed}
                        bedWidth={bedWidth}
                        onBedWidthChange={rs.getState().setBedWidth}
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
                        onClose={() => setPanel('trainPanel', false)}
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
                    onClose={() => setPanel('depot', false)}
                />
            )}

            {showFormationEditor && (
                <FormationEditor
                    formationManager={app.formationManager}
                    carStockManager={app.carStockManager}
                    trainManager={app.trainManager}
                    onClose={() => setPanel('formationEditor', false)}
                />
            )}

            {showStationList && (
                <StationListPanel
                    stationManager={app.stationManager}
                    stationRenderSystem={app.stationRenderSystem}
                    trackGraph={app.curveEngine.trackGraph}
                    cameraRig={app.cameraRig}
                    onClose={() => setPanel('stationList', false)}
                    onStationChange={() =>
                        app.debugOverlayRenderSystem.refresh()
                    }
                />
            )}

            {showTimetable && (
                <TimetablePanel
                    onClose={() => setPanel('timetable', false)}
                />
            )}

            {showSignalPanel && (
                <SignalPanel
                    blockSignalManager={app.blockSignalManager}
                    signalStateEngine={app.signalStateEngine}
                    signalRenderSystem={app.signalRenderSystem}
                    trackGraph={app.curveEngine.trackGraph}
                    onClose={() => setPanel('signalPanel', false)}
                />
            )}

            {showDebugPanel && (
                <DebugPanel
                    showJointNumbers={showJointNumbers}
                    onShowJointNumbersChange={rs.getState().setShowJointNumbers}
                    showSegmentIds={showSegmentIds}
                    onShowSegmentIdsChange={rs.getState().setShowSegmentIds}
                    showFormationIds={showFormationIds}
                    onShowFormationIdsChange={rs.getState().setShowFormationIds}
                    showStationStops={showStationStops}
                    onShowStationStopsChange={rs.getState().setShowStationStops}
                    showStationLocations={showStationLocations}
                    onShowStationLocationsChange={rs.getState().setShowStationLocations}
                    showProximityLines={showProximityLines}
                    onShowProximityLinesChange={rs.getState().setShowProximityLines}
                    showStats={showStats}
                    onShowStatsChange={rs.getState().setShowStats}
                    terrainXray={terrainXray}
                    onTerrainXrayChange={rs.getState().setTerrainXray}
                    onSpawnStressTest={handleSpawnStressTest}
                    onThrottleAll={handleThrottleAll}
                    onSwitchDirectionAll={handleSwitchDirectionAll}
                    onBrakeAll={handleBrakeAll}
                    stressStartX={stressStartX}
                    stressStartY={stressStartY}
                    onStressStartXChange={setStressStartX}
                    onStressStartYChange={setStressStartY}
                    onPickStressStart={handlePickStressStart}
                    isPicking={mode === 'stress-pick'}
                    onGenerateTracks={handleGenerateTracks}
                    onClose={() => setPanel('debugPanel', false)}
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
