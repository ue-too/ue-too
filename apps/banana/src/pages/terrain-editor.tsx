import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Graphics } from 'pixi.js';
import { toast } from 'sonner';
import {
    ScrollBarDisplay,
    Wrapper,
    usePixiCanvas,
    appIsReady,
} from '@ue-too/board-pixi-react-integration';
import {
    baseInitApp,
    type BaseAppComponents,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';
import {
    convertFromWindow2Canvas,
    convertFromCanvas2ViewPort,
    convertFromViewport2World,
} from '@ue-too/board';
import {
    Download, Upload, Mountain, Layers, Eye, EyeOff, Package,
    ArrowUp, ArrowDown, Minus, Droplets, Eraser,
} from 'lucide-react';

import { WorldRenderSystem } from '@/world-render-system';
import { TerrainData, validateSerializedTerrainData } from '@/terrain/terrain-data';
import type { SerializedTerrainData } from '@/terrain/terrain-data';
import { TerrainRenderSystem } from '@/terrain/terrain-render-system';
import { createHillyWithWater } from '@/terrain/terrain-water';
import { applyBrush, type BrushMode, type BrushParams, type DirtyRegion } from '@/terrain/terrain-brush';
import { MapTileLayer, MapTileLayerSync, type MapInstance } from '@/components/map-tile-layer';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

import '../App.css';

// ---------------------------------------------------------------------------
// Types & init
// ---------------------------------------------------------------------------

/** Components returned by the terrain editor init function. */
export type TerrainEditorComponents = BaseAppComponents & {
    worldRenderSystem: WorldRenderSystem;
    terrainData: TerrainData;
    terrainRenderSystem: TerrainRenderSystem;
    /** Brush cursor graphic shown on the terrain. */
    brushCursor: Graphics;
};

const initTerrainEditor = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<TerrainEditorComponents> => {
    const baseComponents = await baseInitApp(canvas, option);

    const worldRenderSystem = new WorldRenderSystem();

    const terrainData = createHillyWithWater(
        {
            originX: -5000,
            originY: -5000,
            cellsX: 400,
            cellsY: 400,
            cellSize: 25,
        },
        { baseHeight: 0, amplitude: 30, seed: 42, riverCount: 3, lakeCount: 2 },
    );

    const terrainRenderSystem = new TerrainRenderSystem(
        worldRenderSystem,
        terrainData,
        { renderer: baseComponents.app.renderer },
    );

    // Brush cursor: a circle drawn in world space
    const brushCursor = new Graphics();
    brushCursor.visible = false;
    worldRenderSystem.container.addChild(brushCursor);

    baseComponents.app.stage.addChild(worldRenderSystem.container);

    return {
        ...baseComponents,
        worldRenderSystem,
        terrainData,
        terrainRenderSystem,
        brushCursor,
    };
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useTerrainEditor(): TerrainEditorComponents | null {
    const { result } = usePixiCanvas();
    return useMemo(() => {
        const check = appIsReady(result);
        if (!check.ready) return null;
        return check.components as unknown as TerrainEditorComponents;
    }, [result]);
}

// ---------------------------------------------------------------------------
// Brush input handler (React hook)
// ---------------------------------------------------------------------------

function useBrushInput(
    activeTool: BrushMode | null,
    brushRadius: number,
    brushStrength: number,
    waterDepth: number,
) {
    const app = useTerrainEditor();
    const paintingRef = useRef(false);
    const flattenTargetRef = useRef(0);
    const lastTimeRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    /** Accumulated dirty region across multiple pointer moves within one frame. */
    const dirtyRef = useRef<DirtyRegion | null>(null);

    /** Convert a DOM pointer event to world coordinates. */
    const toWorld = useCallback(
        (e: PointerEvent) => {
            if (!app) return null;
            const canvas = app.canvasProxy;
            const camera = app.camera;
            const pt = { x: e.clientX, y: e.clientY };
            const inCanvas = convertFromWindow2Canvas(pt, canvas);
            const inViewport = convertFromCanvas2ViewPort(inCanvas, {
                x: canvas.width / 2,
                y: canvas.height / 2,
            });
            return convertFromViewport2World(
                inViewport,
                camera.position,
                camera.zoomLevel,
                camera.rotation,
                false,
            );
        },
        [app],
    );

    /** Flush accumulated dirty region to the render system once per frame. */
    const scheduleRefresh = useCallback(() => {
        if (!app) return;
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const d = dirtyRef.current;
            if (d) {
                app.terrainRenderSystem.refreshRegion(d.colMin, d.colMax, d.rowMin, d.rowMax);
                dirtyRef.current = null;
            }
        });
    }, [app]);

    // Draw brush cursor
    const updateCursor = useCallback(
        (e: PointerEvent) => {
            if (!app || !activeTool) return;
            const world = toWorld(e);
            if (!world) return;

            const g = app.brushCursor;
            g.clear();
            g.circle(world.x, world.y, brushRadius);
            g.stroke({
                width: 2 / app.camera.zoomLevel,
                color: activeTool.startsWith('water') ? 0x4488ff : 0xffffff,
                alpha: 0.6,
            });
            g.visible = true;
        },
        [app, activeTool, brushRadius, toWorld],
    );

    const applyStroke = useCallback(
        (e: PointerEvent) => {
            if (!app || !activeTool) return;
            const world = toWorld(e);
            if (!world) return;

            const now = performance.now() / 1000;
            const dt = lastTimeRef.current > 0 ? Math.min(now - lastTimeRef.current, 0.1) : 0.016;
            lastTimeRef.current = now;

            const params: BrushParams = {
                mode: activeTool,
                radius: brushRadius,
                strength: brushStrength,
                flattenTarget: flattenTargetRef.current,
                waterDepth,
            };

            const region = applyBrush(app.terrainData, world.x, world.y, params, dt);

            // Merge into accumulated dirty region
            const prev = dirtyRef.current;
            if (prev) {
                prev.colMin = Math.min(prev.colMin, region.colMin);
                prev.colMax = Math.max(prev.colMax, region.colMax);
                prev.rowMin = Math.min(prev.rowMin, region.rowMin);
                prev.rowMax = Math.max(prev.rowMax, region.rowMax);
            } else {
                dirtyRef.current = { ...region };
            }

            scheduleRefresh();
        },
        [app, activeTool, brushRadius, brushStrength, waterDepth, toWorld, scheduleRefresh],
    );

    useEffect(() => {
        if (!app) return;

        const canvasEl = app.app.canvas;
        if (!canvasEl) return;

        // Hide cursor when no tool active
        if (!activeTool) {
            app.brushCursor.visible = false;
            return;
        }

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return; // left click only
            e.stopPropagation();
            paintingRef.current = true;
            lastTimeRef.current = 0;

            // Sample flatten target at click position
            if (activeTool === 'flatten') {
                const world = toWorld(e);
                if (world) {
                    flattenTargetRef.current = app.terrainData.getHeight(world.x, world.y);
                }
            }

            applyStroke(e);
        };

        const onPointerMove = (e: PointerEvent) => {
            updateCursor(e);
            if (paintingRef.current) {
                applyStroke(e);
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (e.button !== 0) return;
            if (paintingRef.current) {
                paintingRef.current = false;
                if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
                dirtyRef.current = null;
                // Full rebuild for contours + occlusion
                app.terrainRenderSystem.markDirty();
                app.terrainRenderSystem.rebuild(true);
            }
        };

        const onPointerLeave = () => {
            app.brushCursor.visible = false;
            paintingRef.current = false;
        };

        canvasEl.addEventListener('pointerdown', onPointerDown, { capture: true });
        canvasEl.addEventListener('pointermove', onPointerMove);
        canvasEl.addEventListener('pointerup', onPointerUp);
        canvasEl.addEventListener('pointerleave', onPointerLeave);

        return () => {
            canvasEl.removeEventListener('pointerdown', onPointerDown, { capture: true });
            canvasEl.removeEventListener('pointermove', onPointerMove);
            canvasEl.removeEventListener('pointerup', onPointerUp);
            canvasEl.removeEventListener('pointerleave', onPointerLeave);
            app.brushCursor.visible = false;
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            dirtyRef.current = null;
        };
    }, [app, activeTool, applyStroke, updateCursor, toWorld]);
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const TOOLS: { mode: BrushMode; icon: typeof ArrowUp; label: string }[] = [
    { mode: 'raise', icon: ArrowUp, label: 'Raise terrain' },
    { mode: 'lower', icon: ArrowDown, label: 'Lower terrain' },
    { mode: 'flatten', icon: Minus, label: 'Flatten terrain' },
    { mode: 'water-paint', icon: Droplets, label: 'Paint water' },
    { mode: 'water-erase', icon: Eraser, label: 'Erase water' },
];

function TerrainEditorToolbar({
    activeTool,
    onToolChange,
    brushRadius,
    onBrushRadiusChange,
    brushStrength,
    onBrushStrengthChange,
    waterDepth,
    onWaterDepthChange,
}: {
    activeTool: BrushMode | null;
    onToolChange: (tool: BrushMode | null) => void;
    brushRadius: number;
    onBrushRadiusChange: (v: number) => void;
    brushStrength: number;
    onBrushStrengthChange: (v: number) => void;
    waterDepth: number;
    onWaterDepthChange: (v: number) => void;
}) {
    const app = useTerrainEditor();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fillVisible, setFillVisible] = useState(true);
    const [fillOpacity, setFillOpacity] = useState(1);

    // ---- Export / Import ----

    const handleExport = useCallback(() => {
        if (!app) return;
        const data = app.terrainData.serialize();
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'terrain.json';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Terrain exported');
    }, [app]);

    const handleExportAsScene = useCallback(() => {
        if (!app) return;
        const sceneData = {
            tracks: { joints: [], segments: [] },
            trains: { trains: [], formations: [], carStocks: [] },
            stations: { stations: [] },
            terrain: app.terrainData.serialize(),
        };
        const json = JSON.stringify(sceneData);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene-terrain-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Terrain exported as scene');
    }, [app]);

    const handleImport = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!app) return;
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    const validation = validateSerializedTerrainData(data);
                    if (!validation.valid) {
                        toast.error(`Invalid terrain file: ${validation.error}`);
                        return;
                    }
                    const restored = TerrainData.deserialize(data as SerializedTerrainData);
                    app.terrainRenderSystem.setTerrainData(restored);
                    (app as { terrainData: TerrainData }).terrainData = restored;
                    toast.success('Terrain imported');
                } catch (err) {
                    toast.error(`Failed to parse terrain file: ${err}`);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        },
        [app],
    );

    // ---- Visibility / opacity ----

    const handleToggleVisibility = useCallback(() => {
        if (!app) return;
        const next = !fillVisible;
        setFillVisible(next);
        app.terrainRenderSystem.fillVisible = next;
    }, [app, fillVisible]);

    const handleOpacityChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!app) return;
            const v = Number(e.target.value) / 100;
            setFillOpacity(v);
            app.terrainRenderSystem.fillOpacity = v;
        },
        [app],
    );

    return (
        <div className="pointer-events-auto absolute top-4 left-4 z-50 flex flex-col gap-2">
            {/* Brush tools */}
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                {TOOLS.map(({ mode, icon: Icon, label }) => (
                    <Tooltip key={mode}>
                        <TooltipTrigger asChild>
                            <Button
                                variant={activeTool === mode ? 'default' : 'ghost'}
                                size="icon"
                                onClick={() =>
                                    onToolChange(activeTool === mode ? null : mode)
                                }
                            >
                                <Icon className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                ))}

                {/* Brush size */}
                {activeTool && (
                    <>
                        <div className="bg-border my-0.5 h-px w-full" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-muted-foreground text-[9px]">Size</span>
                                    <input
                                        type="range"
                                        min={25}
                                        max={500}
                                        step={25}
                                        value={brushRadius}
                                        onChange={e => onBrushRadiusChange(Number(e.target.value))}
                                        className="h-16 w-1.5 appearance-none [writing-mode:vertical-lr]"
                                    />
                                    <span className="text-muted-foreground text-[9px]">
                                        {brushRadius}m
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">Brush size</TooltipContent>
                        </Tooltip>

                        {/* Brush strength */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-muted-foreground text-[9px]">Str</span>
                                    <input
                                        type="range"
                                        min={5}
                                        max={100}
                                        step={5}
                                        value={Math.round(brushStrength * 100)}
                                        onChange={e => onBrushStrengthChange(Number(e.target.value) / 100)}
                                        className="h-16 w-1.5 appearance-none [writing-mode:vertical-lr]"
                                    />
                                    <span className="text-muted-foreground text-[9px]">
                                        {Math.round(brushStrength * 100)}%
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">Brush strength</TooltipContent>
                        </Tooltip>

                        {/* Water depth (only for water-paint) */}
                        {activeTool === 'water-paint' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-muted-foreground text-[9px]">Dep</span>
                                        <input
                                            type="range"
                                            min={1}
                                            max={20}
                                            step={1}
                                            value={waterDepth}
                                            onChange={e => onWaterDepthChange(Number(e.target.value))}
                                            className="h-16 w-1.5 appearance-none [writing-mode:vertical-lr]"
                                        />
                                        <span className="text-muted-foreground text-[9px]">
                                            {waterDepth}m
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">Water depth</TooltipContent>
                            </Tooltip>
                        )}
                    </>
                )}
            </div>

            {/* Visibility & export/import */}
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleToggleVisibility}>
                            {fillVisible ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4 text-muted-foreground/40" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Toggle terrain fill</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex flex-col items-center gap-1">
                            <Mountain className="size-4" />
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={Math.round(fillOpacity * 100)}
                                onChange={handleOpacityChange}
                                disabled={!fillVisible}
                                className="h-20 w-1.5 appearance-none disabled:opacity-30 [writing-mode:vertical-lr]"
                            />
                            <span className="text-muted-foreground text-[10px]">
                                {Math.round(fillOpacity * 100)}%
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Terrain opacity</TooltipContent>
                </Tooltip>

                <div className="bg-border my-0.5 h-px w-full" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleExport}>
                            <Download className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Export terrain</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleExportAsScene}>
                            <Package className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Export as scene (for main app)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleImport}>
                            <Upload className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Import terrain</TooltipContent>
                </Tooltip>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Brush input wiring (child of Wrapper so it can access the pixi context)
// ---------------------------------------------------------------------------

function BrushInputWiring({
    activeTool,
    brushRadius,
    brushStrength,
    waterDepth,
}: {
    activeTool: BrushMode | null;
    brushRadius: number;
    brushStrength: number;
    waterDepth: number;
}) {
    useBrushInput(activeTool, brushRadius, brushStrength, waterDepth);
    return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function TerrainEditorPage(): React.ReactNode {
    const [showMap, setShowMap] = useState(false);
    const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
    const handleMapDestroy = useCallback(() => setMapInstance(null), []);

    // Brush state — lifted to page level so toolbar + input handler share it
    const [activeTool, setActiveTool] = useState<BrushMode | null>(null);
    const [brushRadius, setBrushRadius] = useState(100);
    const [brushStrength, setBrushStrength] = useState(0.5);
    const [waterDepth, setWaterDepth] = useState(3);

    const wrapperOption = useMemo(
        () => ({
            fullScreen: true,
            boundaries: {
                min: { x: -5000, y: -5000 },
                max: { x: 5000, y: 5000 },
            },
        }),
        [],
    );

    return (
        <TooltipProvider delayDuration={200}>
            <div className="app" style={{ position: 'relative' }}>
                <MapTileLayer
                    visible={showMap}
                    onMapReady={setMapInstance}
                    onMapDestroy={handleMapDestroy}
                />
                <Wrapper
                    option={wrapperOption}
                    initFunction={initTerrainEditor}
                >
                    {showMap && mapInstance && (
                        <MapTileLayerSync map={mapInstance} />
                    )}
                    <ScrollBarDisplay />

                    <BrushInputWiring
                        activeTool={activeTool}
                        brushRadius={brushRadius}
                        brushStrength={brushStrength}
                        waterDepth={waterDepth}
                    />

                    <TerrainEditorToolbar
                        activeTool={activeTool}
                        onToolChange={setActiveTool}
                        brushRadius={brushRadius}
                        onBrushRadiusChange={setBrushRadius}
                        brushStrength={brushStrength}
                        onBrushStrengthChange={setBrushStrength}
                        waterDepth={waterDepth}
                        onWaterDepthChange={setWaterDepth}
                    />

                    {/* Map toggle — bottom-left */}
                    <div className="pointer-events-auto absolute bottom-4 left-4 z-50">
                        <div className="bg-background/80 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={showMap ? 'default' : 'ghost'}
                                        size="icon"
                                        onClick={() => setShowMap(s => !s)}
                                    >
                                        <Layers className="size-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Toggle map overlay</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </Wrapper>
            </div>
        </TooltipProvider>
    );
}
