import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    Bug,
    ChevronDown,
    ChevronUp,
    Clock,
    Copy,
    Download,
    FilePlus,
    FolderOpen,
    GitFork,
    Landmark,
    Layers,
    List,
    ListOrdered,
    Map,
    Save,
    Signal,
    Spline,
    Timer,
    TrainFront,
    TrainTrack,
    Warehouse,
    X,
    Zap,
} from '@/assets/icons';
import type { BuildingPreset } from '@/buildings/types';
import { CarDefinitionLibraryDialog } from '@/components/car-definition-library/CarDefinitionLibraryDialog';
import { FormationEditor } from '@/components/formation-editor';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBananaApp } from '@/contexts/pixi';
import { useAutoSave } from '@/hooks/use-auto-save';
import { useRenderSync } from '@/hooks/use-render-sync';
import { cn } from '@/lib/utils';
import {
    type SerializedSceneData,
    deserializeSceneData,
    serializeSceneData,
    validateSerializedSceneData,
} from '@/scene-serialization';
import { StationManager } from '@/stations/station-manager';
import type { SerializedStationData } from '@/stations/types';
import type { StoredCarDefinition } from '@/storage';
import { useGaugeStore } from '@/stores/gauge-store';
import { useRenderSettingsStore } from '@/stores/render-settings-store';
import { useSceneStore } from '@/stores/scene-store';
import {
    type ToolbarCategory,
    useToolbarUIStore,
} from '@/stores/toolbar-ui-store';
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
import type { CarType } from '@/trains/cars';
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
import { CategoryFlyout, type FlyoutCategory } from './CategoryFlyout';
import { CategoryRail } from './CategoryRail';
import { DebugPanel } from './DebugPanel';
import { DepotPanel } from './DepotPanel';
import { ExportSubmenu } from './ExportSubmenu';
import { FormationSelector } from './FormationSelector';
import { GaugeSelector } from './GaugeSelector';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LayoutDeletionToolbar } from './LayoutDeletionToolbar';
import { ScaleRuler } from './ScaleRuler';
import { SignalPanel } from './SignalPanel';
import { StationListPanel } from './StationListPanel';
import { SunAngleControl } from './SunAngleControl';
import { TerrainControl } from './TerrainControl';
import { TerrainLegend } from './TerrainLegend';
import { TimetablePanel } from './TimetablePanel';
import { TrackStyleSelector } from './TrackStyleSelector';
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
    const showScenePickerAction = useSceneStore(s => s.showScenePicker);
    const createNewScene = useSceneStore(s => s.createNewScene);

    // Toolbar UI store — mode and panel visibility
    const mode = useToolbarUIStore(s => s.mode);
    const setMode = useToolbarUIStore(s => s.setMode);
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
        useShallow(s => ({
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
    const setPanel = useToolbarUIStore(s => s.setPanel);
    const togglePanel = useToolbarUIStore(s => s.togglePanel);
    const activeCategory = useToolbarUIStore(s => s.activeCategory);
    const toggleCategory = useToolbarUIStore(s => s.toggleCategory);
    const setActiveCategory = useToolbarUIStore(s => s.setActiveCategory);

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
        showGaugeLabels,
        showFormationIds,
        showStationStops,
        showStationLocations,
        showProximityLines,
        showBogies,
        showStats,
        terrainXray,
    } = useRenderSettingsStore(
        useShallow(s => ({
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
            showGaugeLabels: s.showGaugeLabels,
            showFormationIds: s.showFormationIds,
            showStationStops: s.showStationStops,
            showStationLocations: s.showStationLocations,
            showProximityLines: s.showProximityLines,
            showBogies: s.showBogies,
            showStats: s.showStats,
            terrainXray: s.terrainXray,
        }))
    );
    const rs = useRenderSettingsStore;

    // Gauge store
    const { selectedPresetId, customWidth, currentGauge } = useGaugeStore();

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
    const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);

    const selectedBuildingRef = useRef<number | null>(null);

    const buildingPresetRef = useRef(buildingPreset);
    buildingPresetRef.current = buildingPreset;
    const buildingElevationRef = useRef(buildingElevation);
    buildingElevationRef.current = buildingElevation;
    const buildingHeightRef = useRef(buildingHeight);
    buildingHeightRef.current = buildingHeight;

    // Shell ref used by CategoryFlyout to detect outside clicks
    const shellRef = useRef<HTMLDivElement>(null);

    // Scroll overflow indicators
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const updateScrollIndicators = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const threshold = 2;
        setCanScrollUp(el.scrollTop > threshold);
        setCanScrollDown(
            el.scrollTop + el.clientHeight < el.scrollHeight - threshold
        );
    }, []);

    useEffect(() => {
        if (!app) return;
        app.curveEngine.setCurrentGauge(currentGauge);
    }, [app, currentGauge]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollIndicators();
        el.addEventListener('scroll', updateScrollIndicators, {
            passive: true,
        });
        const ro = new ResizeObserver(updateScrollIndicators);
        ro.observe(el);

        // Watch for children being added/removed so we re-check overflow
        const mo = new MutationObserver(() => {
            // Re-observe new children and recheck
            ro.disconnect();
            ro.observe(el);
            for (const child of el.children) {
                ro.observe(child);
            }
            updateScrollIndicators();
        });
        mo.observe(el, { childList: true, subtree: true });

        return () => {
            el.removeEventListener('scroll', updateScrollIndicators);
            ro.disconnect();
            mo.disconnect();
        };
    }, [updateScrollIndicators, app]);

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

    useEffect(() => {
        if (!app) return;
        if (mode === 'joint-direction') {
            app.jointDirectionRenderSystem.show();
        } else {
            app.jointDirectionRenderSystem.hide();
        }
    }, [app, mode]);

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

    const handleDuplicateToSideToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'duplicate-to-side') {
            exitAllModes();
        } else {
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToDuplicate');
            setMode('duplicate-to-side');
        }
    }, [app, mode, exitAllModes]);

    const handleCatenaryLayoutToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'catenary-layout') {
            exitAllModes();
        } else {
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToCatenary');
            setMode('catenary-layout');
        }
    }, [app, mode, exitAllModes]);

    const handleJointDirectionToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'joint-direction') {
            app.kmtStateMachineExpansion.happens('switchToIdle');
            setMode('idle');
        } else {
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToJointDirection');
            setMode('joint-direction');
        }
    }, [app, mode, exitAllModes, setMode]);

    const handleStartSingleSpinePlatform = useCallback(
        (stationId: number) => {
            if (!app) return;
            exitAllModes();
            app.kmtStateMachineExpansion.happens(
                'switchToSingleSpinePlatform',
                { stationId }
            );
            setMode('single-spine-platform');
        },
        [app, exitAllModes]
    );

    const handleStartDualSpinePlatform = useCallback(
        (stationId: number) => {
            if (!app) return;
            exitAllModes();
            app.kmtStateMachineExpansion.happens('switchToDualSpinePlatform', {
                stationId,
            });
            setMode('dual-spine-platform');
        },
        [app, exitAllModes]
    );

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
        uploadJson(async parsed => {
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
                        useSceneStore
                            .getState()
                            .setSceneLoadProgress(
                                total > 0 ? loaded / total : 1
                            ),
                }
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
        uploadJson(async parsed => {
            const result = validateSerializedSceneData(parsed);
            if (!result.valid) {
                alert(t('invalidSceneData', { error: result.error }));
                return;
            }

            useSceneStore.getState().setSceneLoading(true);
            useSceneStore.getState().setSceneLoadProgress(0);

            await deserializeSceneData(app, parsed as SerializedSceneData, {
                onProgress: (loaded, total) =>
                    useSceneStore
                        .getState()
                        .setSceneLoadProgress(total > 0 ? loaded / total : 1),
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

    const addCarTemplateFromDefinition = useCallback(
        (def: {
            bogieOffsets: number[];
            edgeToBogie?: number;
            bogieToEdge?: number;
            carType?: CarType;
            image?: {
                src: string;
                position: { x: number; y: number };
                width: number;
                height: number;
            };
        }) => {
            const template: CarTemplate = {
                id: generateTemplateId(),
                bogieOffsets: def.bogieOffsets,
                edgeToBogie: def.edgeToBogie ?? 2.5,
                bogieToEdge: def.bogieToEdge ?? 2.5,
                type: def.carType,
                image: def.image,
            };
            setCarTemplates(prev => [...prev, template]);
        },
        []
    );

    const handleImportCarDefinition = useCallback(() => {
        if (!app) return;
        trackEvent('import-car-definition');
        uploadJson(parsed => {
            const result = validateCarDefinition(parsed);
            if (!result.valid) {
                alert(t('invalidCarDefinition', { error: result.error }));
                return;
            }
            addCarTemplateFromDefinition(
                parsed as Parameters<typeof addCarTemplateFromDefinition>[0]
            );
        });
    }, [app, addCarTemplateFromDefinition, t]);

    const handleImportCarDefinitionFromLibrary = useCallback(() => {
        if (!app) return;
        trackEvent('import-car-definition');
        setLibraryDialogOpen(true);
    }, [app]);

    const handleLibraryPick = useCallback(
        (stored: StoredCarDefinition) => {
            const result = validateCarDefinition(stored.data);
            if (!result.valid) {
                alert(t('invalidCarDefinition', { error: result.error }));
                return;
            }
            addCarTemplateFromDefinition(stored.data);
        },
        [addCarTemplateFromDefinition, t]
    );

    const handleSpawnStressTest = useCallback(
        (count: number, startX?: number, startY?: number) => {
            if (!app) return;
            const placed = app.spawnParallelTracksWithTrains(
                count,
                startX,
                startY
            );
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

    const modeHolderCategory: ToolbarCategory | null =
        mode === 'layout' ||
        mode === 'layout-deletion' ||
        mode === 'station-placement' ||
        mode === 'duplicate-to-side' ||
        mode === 'catenary-layout' ||
        mode === 'single-spine-platform' ||
        mode === 'dual-spine-platform' ||
        mode === 'joint-direction'
            ? 'drawing'
            : mode === 'train-placement'
              ? 'trains'
              : null;

    const modeLabelKey: string | null =
        mode === 'layout'
            ? 'modeDrawingLayout'
            : mode === 'layout-deletion'
              ? 'modeDeletingTrack'
              : mode === 'train-placement'
                ? 'modePlacingTrain'
                : mode === 'station-placement'
                  ? 'modePlacingStation'
                  : mode === 'duplicate-to-side'
                    ? 'modeDuplicatingTrack'
                    : mode === 'catenary-layout'
                      ? 'modeCatenaryLayout'
                      : mode === 'building-placement'
                        ? 'modePlacingBuilding'
                        : mode === 'building-deletion'
                          ? 'modeDeletingBuilding'
                          : mode === 'single-spine-platform'
                            ? 'modeSingleSpinePlatform'
                            : mode === 'dual-spine-platform'
                              ? 'modeDualSpinePlatform'
                              : mode === 'joint-direction'
                                ? 'modeJointDirection'
                                : null;

    const flyoutCategories: Record<ToolbarCategory, FlyoutCategory> = {
        drawing: {
            title: t('toolbarCategoryDrawing'),
            rows: [
                {
                    kind: 'button',
                    id: 'draw-layout',
                    icon: <TrainTrack />,
                    label: isLayoutActive ? t('endLayout') : t('startLayout'),
                    active: isLayoutActive,
                    disabled: mode !== 'idle' && !isLayoutActive,
                    onClick: handleLayoutToggle,
                },
                {
                    kind: 'button',
                    id: 'place-station',
                    icon: <Warehouse />,
                    label: t('placeStation'),
                    active: mode === 'station-placement',
                    disabled: mode !== 'idle' && mode !== 'station-placement',
                    onClick: handleStationPlacementToggle,
                },
                {
                    kind: 'button',
                    id: 'duplicate-track',
                    icon: <Copy />,
                    label: t('duplicateTrackToSide'),
                    active: mode === 'duplicate-to-side',
                    disabled: mode !== 'idle' && mode !== 'duplicate-to-side',
                    onClick: handleDuplicateToSideToggle,
                },
                {
                    kind: 'button',
                    id: 'catenary-layout',
                    icon: <Zap />,
                    label: t('catenaryLayout'),
                    active: mode === 'catenary-layout',
                    disabled: mode !== 'idle' && mode !== 'catenary-layout',
                    onClick: handleCatenaryLayoutToggle,
                },
                {
                    kind: 'button',
                    id: 'joint-direction',
                    icon: <GitFork />,
                    label: t('jointDirection'),
                    active: mode === 'joint-direction',
                    disabled: mode !== 'idle' && mode !== 'joint-direction',
                    onClick: handleJointDirectionToggle,
                },
            ],
        },
        trains: {
            title: t('toolbarCategoryTrains'),
            rows: [
                {
                    kind: 'button',
                    id: 'place-train',
                    icon: <TrainFront />,
                    label: t('placeTrain'),
                    active: mode === 'train-placement',
                    disabled: mode !== 'idle' && mode !== 'train-placement',
                    onClick: handleTrainPlacementToggle,
                },
                {
                    kind: 'button',
                    id: 'train-list',
                    icon: <List />,
                    label: t('trainList'),
                    active: showTrainPanel,
                    disabled:
                        placedTrains.length === 0 && mode !== 'train-placement',
                    onClick: () => {
                        if (!showTrainPanel) trackEvent('open-train-panel');
                        togglePanel('trainPanel');
                    },
                },
                {
                    kind: 'button',
                    id: 'depot',
                    icon: <Warehouse />,
                    label: t('depot'),
                    active: showDepot,
                    onClick: () => {
                        if (!showDepot) trackEvent('open-depot');
                        togglePanel('depot');
                    },
                },
                {
                    kind: 'button',
                    id: 'formations',
                    icon: <ListOrdered />,
                    label: t('formations'),
                    active: showFormationEditor,
                    onClick: () => {
                        if (!showFormationEditor)
                            trackEvent('open-formation-editor');
                        togglePanel('formationEditor');
                    },
                },
                {
                    kind: 'button',
                    id: 'timetable',
                    icon: <Clock />,
                    label: t('timetable'),
                    active: showTimetable,
                    onClick: () => togglePanel('timetable'),
                },
            ],
        },
        infra: {
            title: t('toolbarCategoryInfra'),
            rows: [
                {
                    kind: 'button',
                    id: 'station-list',
                    icon: <Landmark />,
                    label: t('stations'),
                    active: showStationList,
                    onClick: () => {
                        if (!showStationList) trackEvent('open-station-list');
                        togglePanel('stationList');
                    },
                },
                {
                    kind: 'button',
                    id: 'signals',
                    icon: <Signal />,
                    label: t('signals'),
                    active: showSignalPanel,
                    onClick: () => togglePanel('signalPanel'),
                },
                {
                    kind: 'button',
                    id: 'elevation-gradient',
                    icon: <Layers />,
                    label: t('elevationGradientLabel'),
                    active: showElevationGradient,
                    onClick: () =>
                        rs
                            .getState()
                            .setShowElevationGradient(!showElevationGradient),
                },
                {
                    kind: 'button',
                    id: 'curve-arcs',
                    icon: <Spline />,
                    label: t('curveArcsLabel'),
                    active: showPreviewCurveArcs,
                    onClick: () =>
                        rs
                            .getState()
                            .setShowPreviewCurveArcs(!showPreviewCurveArcs),
                },
            ],
        },
        scene: {
            title: t('toolbarCategoryScene'),
            rows: [
                {
                    kind: 'button',
                    id: 'saved-scenes',
                    icon: <FolderOpen />,
                    label: t('savedScenes'),
                    onClick: () => showScenePickerAction(),
                },
                {
                    kind: 'button',
                    id: 'save-scene',
                    icon: <Save />,
                    label: t('saveScene'),
                    onClick: saveNow,
                },
                {
                    kind: 'button',
                    id: 'new-scene',
                    icon: <FilePlus />,
                    label: t('newScene'),
                    onClick: () => createNewScene(),
                },
                {
                    kind: 'custom',
                    id: 'export-submenu',
                    node: (
                        <ExportSubmenu
                            show={showExportSubmenu}
                            onShowChange={open => {
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
                            onImportCarDefinitionFromLibrary={
                                handleImportCarDefinitionFromLibrary
                            }
                            trigger={
                                <Button
                                    variant={
                                        showExportSubmenu ? 'default' : 'ghost'
                                    }
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full justify-start gap-2.5 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-4",
                                        !showExportSubmenu &&
                                            'hover:bg-foreground/15 hover:text-foreground dark:hover:bg-foreground/20'
                                    )}
                                >
                                    <Download />
                                    <span className="truncate">
                                        {t('importExport')}
                                    </span>
                                </Button>
                            }
                        />
                    ),
                },
                {
                    kind: 'custom',
                    id: 'auto-save-menu',
                    node: (
                        <AutoSaveIntervalSelector
                            show={showAutoSaveMenu}
                            onShowChange={open => {
                                setPanel('autoSaveMenu', open);
                                if (open) setPanel('exportSubmenu', false);
                            }}
                            trigger={
                                <Button
                                    variant={
                                        showAutoSaveMenu ? 'default' : 'ghost'
                                    }
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full justify-start gap-2.5 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-4",
                                        !showAutoSaveMenu &&
                                            'hover:bg-foreground/15 hover:text-foreground dark:hover:bg-foreground/20'
                                    )}
                                >
                                    <Timer />
                                    <span className="truncate">
                                        {t('autoSaveInterval')}
                                    </span>
                                </Button>
                            }
                        />
                    ),
                },
            ],
        },
        debug: {
            title: t('toolbarCategoryDebug'),
            rows: [
                ...(onToggleMap
                    ? [
                          {
                              kind: 'button' as const,
                              id: 'map-toggle',
                              icon: <Map />,
                              label: t('mapLabel'),
                              active: showMap,
                              onClick: onToggleMap,
                          },
                      ]
                    : []),
                {
                    kind: 'button',
                    id: 'debug-panel',
                    icon: <Bug />,
                    label: t('debug'),
                    active: showDebugPanel,
                    onClick: () => {
                        if (!showDebugPanel) trackEvent('open-debug-panel');
                        togglePanel('debugPanel');
                    },
                },
            ],
        },
    };

    return (
        <TooltipProvider delayDuration={200}>
            <div
                ref={shellRef}
                className={cn(
                    'pointer-events-auto absolute top-1/2 flex -translate-y-1/2 flex-col items-start gap-2',
                    TOOLBAR_LEFT
                )}
            >
                {modeLabelKey && (
                    <button
                        type="button"
                        onClick={exitAllModes}
                        className="bg-background/80 text-destructive hover:bg-destructive hover:border-destructive absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap shadow-sm backdrop-blur-sm transition-colors hover:text-white"
                        title={t('exitMode')}
                    >
                        <X className="size-3.5" />
                        <span>{t(modeLabelKey)}</span>
                    </button>
                )}
                {/* Top scroll arrow – always takes space, invisible when not needed */}
                <div
                    className={cn(
                        'bg-background/80 flex justify-center self-center rounded-full border px-2 py-0.5 shadow-sm backdrop-blur-sm',
                        canScrollUp ? 'text-foreground' : 'invisible'
                    )}
                >
                    <ChevronUp className="h-4 w-4" />
                </div>
                <div className="relative flex items-start">
                    <div
                        ref={scrollRef}
                        className={cn(
                            'scrollbar-hide flex flex-col items-center gap-3 overflow-x-clip overflow-y-auto rounded-xl',
                            modeLabelKey
                                ? 'max-h-[calc(100dvh-9rem)]'
                                : 'max-h-[calc(100dvh-6rem)]'
                        )}
                    >
                        <CategoryRail
                            activeCategory={activeCategory}
                            modeHolderCategory={modeHolderCategory}
                            onToggleCategory={toggleCategory}
                        />

                        <SunAngleControl
                            value={sunAngle}
                            onChange={rs.getState().setSunAngle}
                        />
                        <TerrainControl
                            visible={terrainFillVisible}
                            onVisibleChange={
                                rs.getState().setTerrainFillVisible
                            }
                            opacity={terrainOpacity}
                            onOpacityChange={rs.getState().setTerrainOpacity}
                            whiteOcclusion={whiteOcclusion}
                            onWhiteOcclusionChange={
                                rs.getState().setWhiteOcclusion
                            }
                        />
                    </div>

                    <CategoryFlyout
                        category={activeCategory}
                        categories={flyoutCategories}
                        onClose={() => setActiveCategory(null)}
                        shellRef={shellRef}
                    />
                </div>
                {/* Bottom scroll arrow – always takes space, invisible when not needed */}
                <div
                    className={cn(
                        'bg-background/80 flex justify-center self-center rounded-full border px-2 py-0.5 shadow-sm backdrop-blur-sm',
                        canScrollDown ? 'text-foreground' : 'invisible'
                    )}
                >
                    <ChevronDown className="h-4 w-4" />
                </div>
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
                        onProjectionBufferChange={
                            rs.getState().setProjectionBuffer
                        }
                        bed={bed}
                        onBedChange={rs.getState().setBed}
                        bedWidth={bedWidth}
                        onBedWidthChange={rs.getState().setBedWidth}
                        gaugePresetId={selectedPresetId}
                        onGaugePresetChange={id => {
                            if (id === 'custom') {
                                useGaugeStore
                                    .getState()
                                    .setCustomGauge(customWidth ?? 1.0);
                            } else {
                                useGaugeStore.getState().selectPreset(id);
                            }
                        }}
                        customGaugeWidth={customWidth}
                        onCustomGaugeChange={w =>
                            useGaugeStore.getState().setCustomGauge(w)
                        }
                    />
                </>
            )}

            {mode === 'station-placement' && (
                <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
                    <div className="bg-background/80 flex flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-sm">
                        <GaugeSelector
                            gaugePresetId={selectedPresetId}
                            onGaugePresetChange={id => {
                                if (id === 'custom') {
                                    useGaugeStore
                                        .getState()
                                        .setCustomGauge(customWidth ?? 1.0);
                                } else {
                                    useGaugeStore.getState().selectPreset(id);
                                }
                            }}
                            customGaugeWidth={customWidth}
                            onCustomGaugeChange={w =>
                                useGaugeStore.getState().setCustomGauge(w)
                            }
                        />
                    </div>
                </div>
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
                    trackAlignedPlatformManager={
                        app.trackAlignedPlatformManager
                    }
                    cameraRig={app.cameraRig}
                    onClose={() => setPanel('stationList', false)}
                    onStationChange={() =>
                        app.debugOverlayRenderSystem.refresh()
                    }
                    onAddSingleSpinePlatform={handleStartSingleSpinePlatform}
                    onAddDualSpinePlatform={handleStartDualSpinePlatform}
                />
            )}

            {showTimetable && (
                <TimetablePanel onClose={() => setPanel('timetable', false)} />
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
                    showGaugeLabels={showGaugeLabels}
                    onShowGaugeLabelsChange={rs.getState().setShowGaugeLabels}
                    showFormationIds={showFormationIds}
                    onShowFormationIdsChange={rs.getState().setShowFormationIds}
                    showStationStops={showStationStops}
                    onShowStationStopsChange={rs.getState().setShowStationStops}
                    showStationLocations={showStationLocations}
                    onShowStationLocationsChange={
                        rs.getState().setShowStationLocations
                    }
                    showProximityLines={showProximityLines}
                    onShowProximityLinesChange={
                        rs.getState().setShowProximityLines
                    }
                    showBogies={showBogies}
                    onShowBogiesChange={rs.getState().setShowBogies}
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

            <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
            </div>

            <div className="absolute right-3 bottom-10 flex flex-col items-end gap-1">
                <TerrainLegend />
                <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-[10px] backdrop-blur-sm">
                    {t('elevation')}: {elevation} · T: {tension}
                </span>
                <ScaleRuler />
            </div>

            <CarDefinitionLibraryDialog
                open={libraryDialogOpen}
                onOpenChange={setLibraryDialogOpen}
                onPick={handleLibraryPick}
            />
        </TooltipProvider>
    );
}
