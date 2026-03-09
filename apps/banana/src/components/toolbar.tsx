import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuildingPreset } from '@/buildings/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBananaApp } from '@/contexts/pixi';
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

    useEffect(() => {
        if (!app) return;

        const unsub = app.layoutStateMachine.onStateChange((_current, next) => {
            switch (next) {
                case 'HOVER_FOR_CURVE_DELETION':
                    setMode('layout-deletion');
                    break;
                case 'HOVER_FOR_STARTING_POINT':
                    setMode('layout');
                    break;
                case 'IDLE':
                    if (
                        modeRef.current === 'layout' ||
                        modeRef.current === 'layout-deletion'
                    ) {
                        setMode('idle');
                    }
                    break;
            }
        });

        return unsub;
    }, [app]);

    const exitAllModes = useCallback(() => {
        if (!app) return;
        app.layoutStateMachine.happens('endLayout');
        app.layoutStateMachine.happens('endDeletion');
        app.trainStateMachine.happens('endPlacement');
        toggleKmtInput(true);
        selectedBuildingRef.current = null;
        setMode('idle');
    }, [app, toggleKmtInput]);

    const handleLayoutToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'layout') {
            app.kmtInputStateMachine.happens('endLayout');
            toggleKmtInput(true);
            setMode('idle');
        } else {
            exitAllModes();
            app.kmtInputStateMachine.happens('startLayout');
            // toggleKmtInput(false);
            setMode('layout');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

    const handleLayoutDeletionToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'layout-deletion') {
            app.layoutStateMachine.happens('endDeletion');
            toggleKmtInput(true);
            setMode('idle');
        } else {
            exitAllModes();
            app.layoutStateMachine.happens('startDeletion');
            toggleKmtInput(false);
            setMode('layout-deletion');
        }
    }, [app, mode, exitAllModes, toggleKmtInput]);

    const handleTrainPlacementToggle = useCallback(() => {
        if (!app) return;
        if (mode === 'train-placement') {
            app.trainStateMachine.happens('endPlacement');
            toggleKmtInput(true);
            setMode('idle');
        } else {
            exitAllModes();
            app.trainStateMachine.happens('startPlacement');
            toggleKmtInput(false);
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

            app.layoutStateMachine.happens('pointerdown', {
                position: worldPosition,
                pointerId: event.pointerId,
            });
            app.trainStateMachine.happens('pointerdown', {
                position: worldPosition,
            });
        },
        [app, convertCoords]
    );

    useCanvasPointerDown(handlePointerDown);

    useEffect(() => {
        if (!app) return;

        const canvas = app.app.canvas;

        const handlePointerUp = (event: PointerEvent) => {
            if (event.button !== 0) return;
            const worldPosition = convertCoords(event);
            app.layoutStateMachine.happens('pointerup', {
                pointerId: event.pointerId,
                position: worldPosition,
            });
            app.trainStateMachine.happens('pointerup', {
                position: worldPosition,
            });
        };

        const handlePointerMove = (event: PointerEvent) => {
            const worldPosition = convertCoords(event);
            app.layoutStateMachine.happens('pointermove', {
                pointerId: event.pointerId,
                position: worldPosition,
            });
            app.trainStateMachine.happens('pointermove', {
                position: worldPosition,
            });
        };

        const handleWheel = (event: WheelEvent) => {
            app.layoutStateMachine.happens('scroll', {
                positive: event.deltaY > 0,
            });
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                app.layoutStateMachine.happens('escapeKey');
            } else if (event.key === 'f') {
                app.layoutStateMachine.happens('flipEndTangent');
                app.trainStateMachine.happens('flipTrainDirection');
            } else if (event.key === 'g') {
                app.layoutStateMachine.happens('flipStartTangent');
            } else if (event.key === 'q') {
                app.layoutStateMachine.happens('toggleStraightLine');
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                app.layoutStateMachine.happens('arrowUp');
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                app.layoutStateMachine.happens('arrowDown');
            }
        };

        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('wheel', handleWheel);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [app, convertCoords]);

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

    return (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
            {/* Train list and controls */}
            <Card className="w-full max-w-md">
                <CardHeader className="px-4 py-2">
                    <CardTitle className="text-sm">Trains</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 py-0 pb-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                            variant={
                                mode === 'train-placement'
                                    ? 'default'
                                    : 'outline'
                            }
                            size="sm"
                            onClick={handleTrainPlacementToggle}
                            disabled={
                                mode !== 'idle' && mode !== 'train-placement'
                            }
                        >
                            {mode === 'train-placement'
                                ? 'End Placement'
                                : 'Place Train'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedTrain?.setThrottleStep('p5')}
                            disabled={!selectedTrain}
                        >
                            P5
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedTrain?.setThrottleStep('N')}
                            disabled={!selectedTrain}
                        >
                            Neutral
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedTrain?.switchDirection()}
                            disabled={!selectedTrain}
                        >
                            Switch Dir
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => trainManager.removeSelectedTrain()}
                            disabled={placedTrains.length === 0}
                        >
                            Remove selected
                        </Button>
                    </div>
                    {placedTrains.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {placedTrains.map((entry, index) => (
                                <Button
                                    key={entry.id}
                                    variant={
                                        index === selectedIndex
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() =>
                                        trainManager.setSelectedIndex(index)
                                    }
                                >
                                    Train {index + 1}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            No trains. Use &quot;Place Train&quot; then click on
                            track.
                        </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t pt-2">
                        <span className="text-muted-foreground text-xs">
                            Stress test:
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => app.addStressTestTrains(10)}
                            disabled={
                                app.curveEngine.trackGraph.trackCurveManager
                                    .livingEntities.length === 0
                            }
                        >
                            +10 trains
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => app.addStressTestTrains(50)}
                            disabled={
                                app.curveEngine.trackGraph.trackCurveManager
                                    .livingEntities.length === 0
                            }
                        >
                            +50 trains
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Track layout controls */}
            <div className="flex items-center gap-1.5">
                <Button
                    variant={mode === 'layout' ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleLayoutToggle}
                    disabled={mode !== 'idle' && mode !== 'layout'}
                >
                    {mode === 'layout' ? 'End Layout' : 'Start Layout'}
                </Button>
                <Button
                    variant={
                        mode === 'layout-deletion' ? 'destructive' : 'outline'
                    }
                    size="sm"
                    onClick={handleLayoutDeletionToggle}
                    disabled={mode !== 'idle' && mode !== 'layout-deletion'}
                >
                    {mode === 'layout-deletion'
                        ? 'End Deletion'
                        : 'Delete Layout'}
                </Button>
            </div>

            {/* Procedural tracks (stress test) */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-xs">
                    Procedural tracks:
                </span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                        app.generateProceduralTracks({ segmentCount: 20 })
                    }
                >
                    20 segments
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                        app.generateProceduralTracks({ segmentCount: 100 })
                    }
                >
                    100 segments
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                        app.generateProceduralTracks({
                            segmentCount: 100,
                            gentleCurve: true,
                        })
                    }
                >
                    100 curved
                </Button>
            </div>

            {/* Building controls */}
            <div className="flex items-center gap-1.5">
                <Button
                    variant={
                        mode === 'building-placement' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={handleBuildingPlacementToggle}
                    disabled={mode !== 'idle' && mode !== 'building-placement'}
                >
                    {mode === 'building-placement'
                        ? 'End Placement'
                        : 'Place Building'}
                </Button>
                <Button
                    variant={
                        mode === 'building-deletion' ? 'destructive' : 'outline'
                    }
                    size="sm"
                    onClick={handleBuildingDeletionToggle}
                    disabled={mode !== 'idle' && mode !== 'building-deletion'}
                >
                    {mode === 'building-deletion'
                        ? 'End Deletion'
                        : 'Delete Building'}
                </Button>

                <select
                    className="bg-background h-8 rounded-md border px-2 text-sm"
                    value={buildingPreset}
                    onChange={e =>
                        setBuildingPreset(e.target.value as BuildingPreset)
                    }
                >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="l-shape">L-Shape</option>
                </select>

                <select
                    className="bg-background h-8 rounded-md border px-2 text-sm"
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

                <label className="flex items-center gap-1.5 text-sm">
                    Height:
                    <input
                        type="range"
                        min={0.5}
                        max={5}
                        step={0.5}
                        value={buildingHeight}
                        onChange={e =>
                            setBuildingHeight(Number(e.target.value))
                        }
                        className="w-24"
                    />
                    <span className="w-10 text-xs">{buildingHeight} lv</span>
                </label>
            </div>

            {/* Track detailed render style (when zoomed in) */}
            <div className="flex items-center gap-1.5">
                <span className="text-sm">Track style:</span>
                <Button
                    variant={
                        trackRenderStyle === 'elevation' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setTrackRenderStyle('elevation')}
                >
                    Elevation
                </Button>
                <Button
                    variant={
                        trackRenderStyle === 'texture' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setTrackRenderStyle('texture')}
                >
                    Texture
                </Button>
            </div>

            {/* Sun angle */}
            <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5 text-sm">
                    Sun Angle:
                    <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={sunAngle}
                        onChange={e => setSunAngle(Number(e.target.value))}
                        className="w-40"
                    />
                    <span className="w-10 text-xs">{sunAngle}°</span>
                </label>
            </div>

            {/* Debug overlays (joint numbers, segment IDs) */}
            <div className="flex items-center gap-1.5">
                <span className="text-sm">Debug:</span>
                <Button
                    variant={showJointNumbers ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowJointNumbers(v => !v)}
                >
                    Joint #
                </Button>
                <Button
                    variant={showSegmentIds ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowSegmentIds(v => !v)}
                >
                    Segment #
                </Button>
            </div>

            {/* GeoJSON + Import/Export */}
            <div className="flex items-center gap-1.5">
                <Button
                    variant={showDistricts ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowDistricts(v => !v)}
                >
                    {showDistricts ? 'Hide Districts' : 'Show Districts'}
                </Button>
                <Button
                    variant={showVillages ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowVillages(v => !v)}
                >
                    {showVillages ? 'Hide Villages' : 'Show Villages'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTracks}
                >
                    Export Tracks
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportTracks}
                >
                    Import Tracks
                </Button>
            </div>

            {/* Status */}
            <p className="text-muted-foreground text-xs">
                Elevation: {elevation} · Tension: {tension}
            </p>
        </div>
    );
}
