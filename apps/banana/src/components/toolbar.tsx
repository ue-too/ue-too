import {
    useCanvasPointerDown,
    useCoordinateConversion,
    useToggleKmtInput,
} from '@ue-too/board-pixi-react-integration';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuildingPreset } from '@/buildings/types';
import { Button } from '@/components/ui/button';
import { useBananaApp } from '@/contexts/pixi';
import { ELEVATION } from '@/trains/tracks/types';
import type { DetailedTrackRenderStyle } from '@/trains/tracks/render-system';
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
            app.layoutStateMachine.happens('endLayout');
            toggleKmtInput(true);
            setMode('idle');
        } else {
            exitAllModes();
            app.layoutStateMachine.happens('startLayout');
            toggleKmtInput(false);
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

    const train = app.trainPlacementEngine.train;

    return (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
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

            {/* Train controls */}
            <div className="flex items-center gap-1.5">
                <Button
                    variant={mode === 'train-placement' ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleTrainPlacementToggle}
                    disabled={mode !== 'idle' && mode !== 'train-placement'}
                >
                    {mode === 'train-placement'
                        ? 'End Train Placement'
                        : 'Place Train'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => train.setThrottleStep('p5')}
                >
                    P5
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => train.setThrottleStep('N')}
                >
                    Neutral
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => train.switchDirectionOnly()}
                >
                    Switch Dir
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
                Elevation: {elevation}
            </p>
        </div>
    );
}
