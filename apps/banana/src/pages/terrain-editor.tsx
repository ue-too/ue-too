import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasSource, Graphics, MeshSimple, Texture } from 'pixi.js';
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
    Download, Upload, Layers, Package, Eraser,
} from '@/assets/icons';

import { TerrainData, validateSerializedTerrainData } from '@/terrain/terrain-data';
import type { TerrainConfig, SerializedTerrainData } from '@/terrain/terrain-data';
import {
    TerrainPaintCanvas,
    TERRAIN_PALETTE,
    WATER_PALETTE,
    GROUND_PALETTE_INDEX,
} from '@/terrain/terrain-paint-canvas';
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
// Terrain grid config (shared between editor and export)
// ---------------------------------------------------------------------------

const TERRAIN_CONFIG: TerrainConfig = {
    originX: -5000,
    originY: -5000,
    cellsX: 400,
    cellsY: 400,
    cellSize: 25,
};

// ---------------------------------------------------------------------------
// Brush mode types
// ---------------------------------------------------------------------------

/** What the brush is currently painting. */
type BrushTarget =
    | { layer: 'terrain'; paletteIndex: number }
    | { layer: 'water'; paletteIndex: number }
    | { layer: 'water-erase' };

// ---------------------------------------------------------------------------
// Types & init
// ---------------------------------------------------------------------------

type PaintEditorComponents = BaseAppComponents & {
    paintCanvas: TerrainPaintCanvas;
    terrainCanvasSource: CanvasSource;
    waterCanvasSource: CanvasSource;
    terrainMesh: MeshSimple;
    waterMesh: MeshSimple;
    brushCursor: Graphics;
    terrainConfig: TerrainConfig;
};

/**
 * Build the shared mesh geometry (positions, UVs, indices) for a grid.
 * Both terrain and water meshes use identical geometry.
 */
function buildGridGeometry(config: TerrainConfig) {
    const vx = config.cellsX + 1;
    const vy = config.cellsY + 1;
    const vertCount = vx * vy;

    const positions = new Float32Array(vertCount * 2);
    const uvs = new Float32Array(vertCount * 2);

    for (let row = 0; row < vy; row++) {
        for (let col = 0; col < vx; col++) {
            const idx = row * vx + col;
            positions[idx * 2] = config.originX + col * config.cellSize;
            positions[idx * 2 + 1] = config.originY + row * config.cellSize;
            uvs[idx * 2] = (col + 0.5) / vx;
            uvs[idx * 2 + 1] = (row + 0.5) / vy;
        }
    }

    const cellCount = config.cellsX * config.cellsY;
    const indices = new Uint32Array(cellCount * 6);
    let ii = 0;
    for (let row = 0; row < config.cellsY; row++) {
        for (let col = 0; col < config.cellsX; col++) {
            const tl = row * vx + col;
            const tr = tl + 1;
            const bl = (row + 1) * vx + col;
            const br = bl + 1;
            indices[ii++] = tl;
            indices[ii++] = tr;
            indices[ii++] = bl;
            indices[ii++] = tr;
            indices[ii++] = br;
            indices[ii++] = bl;
        }
    }

    return { positions, uvs, indices };
}

const initPaintEditor = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<PaintEditorComponents> => {
    const baseComponents = await baseInitApp(canvas, option);
    const config = TERRAIN_CONFIG;
    const vx = config.cellsX + 1;
    const vy = config.cellsY + 1;

    const paintCanvas = new TerrainPaintCanvas(vx, vy);
    const { positions, uvs, indices } = buildGridGeometry(config);

    // Terrain mesh (opaque base layer)
    const terrainCanvasSource = new CanvasSource({ resource: paintCanvas.terrainCanvas, resolution: 1 });
    const terrainTexture = new Texture(terrainCanvasSource);
    const terrainMesh = new MeshSimple({ texture: terrainTexture, vertices: positions, uvs, indices });
    baseComponents.app.stage.addChild(terrainMesh);

    // Water mesh (semi-transparent overlay)
    // Clone positions/uvs since MeshSimple takes ownership
    const waterCanvasSource = new CanvasSource({ resource: paintCanvas.waterCanvas, resolution: 1 });
    const waterTexture = new Texture(waterCanvasSource);
    const waterMesh = new MeshSimple({
        texture: waterTexture,
        vertices: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
    });
    baseComponents.app.stage.addChild(waterMesh);

    // Brush cursor overlay (on top of everything)
    const brushCursor = new Graphics();
    brushCursor.visible = false;
    baseComponents.app.stage.addChild(brushCursor);

    return {
        ...baseComponents,
        paintCanvas,
        terrainCanvasSource,
        waterCanvasSource,
        terrainMesh,
        waterMesh,
        brushCursor,
        terrainConfig: config,
    };
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function usePaintEditor(): PaintEditorComponents | null {
    const { result } = usePixiCanvas();
    return useMemo(() => {
        const check = appIsReady(result);
        if (!check.ready) return null;
        return check.components as unknown as PaintEditorComponents;
    }, [result]);
}

// ---------------------------------------------------------------------------
// Brush input handler
// ---------------------------------------------------------------------------

function useBrushInput(brushTarget: BrushTarget, brushRadius: number) {
    const app = usePaintEditor();
    const paintingRef = useRef(false);

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

    const toCanvasPixel = useCallback(
        (worldX: number, worldY: number) => {
            if (!app) return null;
            const { originX, originY, cellSize } = app.terrainConfig;
            return {
                x: (worldX - originX) / cellSize,
                y: (worldY - originY) / cellSize,
            };
        },
        [app],
    );

    const radiusPixels = useMemo(() => {
        if (!app) return 0;
        return brushRadius / app.terrainConfig.cellSize;
    }, [app, brushRadius]);

    const cursorColor = useMemo(() => {
        if (brushTarget.layer === 'terrain') return 0xffffff;
        return 0x4488ff;
    }, [brushTarget]);

    const updateCursor = useCallback(
        (e: PointerEvent) => {
            if (!app) return;
            const world = toWorld(e);
            if (!world) return;
            const g = app.brushCursor;
            g.clear();
            g.circle(world.x, world.y, brushRadius);
            g.stroke({
                width: 2 / app.camera.zoomLevel,
                color: cursorColor,
                alpha: 0.6,
            });
            g.visible = true;
        },
        [app, brushRadius, cursorColor, toWorld],
    );

    const applyStroke = useCallback(
        (e: PointerEvent) => {
            if (!app) return;
            const world = toWorld(e);
            if (!world) return;
            const pixel = toCanvasPixel(world.x, world.y);
            if (!pixel) return;

            switch (brushTarget.layer) {
                case 'terrain':
                    app.paintCanvas.paintTerrain(pixel.x, pixel.y, radiusPixels, brushTarget.paletteIndex);
                    app.terrainCanvasSource.update();
                    break;
                case 'water':
                    app.paintCanvas.paintWater(pixel.x, pixel.y, radiusPixels, brushTarget.paletteIndex);
                    app.waterCanvasSource.update();
                    break;
                case 'water-erase':
                    app.paintCanvas.eraseWater(pixel.x, pixel.y, radiusPixels);
                    app.waterCanvasSource.update();
                    break;
            }
        },
        [app, brushTarget, radiusPixels, toWorld, toCanvasPixel],
    );

    useEffect(() => {
        if (!app) return;
        const canvasEl = app.app.canvas;
        if (!canvasEl) return;

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            paintingRef.current = true;
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
            paintingRef.current = false;
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
        };
    }, [app, applyStroke, updateCursor]);
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function PaintEditorToolbar({
    brushTarget,
    onBrushTargetChange,
    brushRadius,
    onBrushRadiusChange,
}: {
    brushTarget: BrushTarget;
    onBrushTargetChange: (target: BrushTarget) => void;
    brushRadius: number;
    onBrushRadiusChange: (v: number) => void;
}) {
    const app = usePaintEditor();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ---- Export ----

    const handleExport = useCallback(() => {
        if (!app) return;
        const terrainData = app.paintCanvas.exportToTerrainData(app.terrainConfig);
        const data = terrainData.serialize();
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
        const terrainData = app.paintCanvas.exportToTerrainData(app.terrainConfig);
        const sceneData = {
            tracks: { joints: [], segments: [] },
            trains: { trains: [], formations: [], carStocks: [] },
            stations: { stations: [] },
            terrain: terrainData.serialize(),
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

    // ---- Import ----

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
                    app.paintCanvas.importFromTerrainData(restored);
                    app.terrainCanvasSource.update();
                    app.waterCanvasSource.update();
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

    // ---- Palette selection helpers ----

    const isTerrainSelected = (index: number) =>
        brushTarget.layer === 'terrain' && brushTarget.paletteIndex === index;

    const isWaterSelected = (index: number) =>
        brushTarget.layer === 'water' && brushTarget.paletteIndex === index;

    const isWaterEraseSelected = brushTarget.layer === 'water-erase';

    return (
        <div className="pointer-events-auto absolute top-4 left-4 z-50 flex flex-col gap-2">
            {/* Elevation palette */}
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Land</span>
                {TERRAIN_PALETTE.map((entry, index) => (
                    <Tooltip key={entry.height}>
                        <TooltipTrigger asChild>
                            <button
                                className={`size-8 rounded-md border-2 transition-all ${
                                    isTerrainSelected(index)
                                        ? 'border-white scale-110 shadow-md'
                                        : 'border-transparent hover:border-white/40'
                                }`}
                                style={{ backgroundColor: entry.css }}
                                onClick={() => onBrushTargetChange({ layer: 'terrain', paletteIndex: index })}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {entry.height}m
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>

            {/* Water palette */}
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
                <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Water</span>
                {WATER_PALETTE.map((entry, index) => (
                    <Tooltip key={entry.depth}>
                        <TooltipTrigger asChild>
                            <button
                                className={`size-8 rounded-md border-2 transition-all ${
                                    isWaterSelected(index)
                                        ? 'border-white scale-110 shadow-md'
                                        : 'border-transparent hover:border-white/40'
                                }`}
                                style={{ backgroundColor: entry.css }}
                                onClick={() => onBrushTargetChange({ layer: 'water', paletteIndex: index })}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {entry.depth}m deep
                        </TooltipContent>
                    </Tooltip>
                ))}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isWaterEraseSelected ? 'default' : 'ghost'}
                            size="icon"
                            className="size-8"
                            onClick={() => onBrushTargetChange({ layer: 'water-erase' })}
                        >
                            <Eraser className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Erase water</TooltipContent>
                </Tooltip>
            </div>

            {/* Brush size + export/import */}
            <div className="bg-background/80 flex flex-col items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur-sm">
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
    brushTarget,
    brushRadius,
}: {
    brushTarget: BrushTarget;
    brushRadius: number;
}) {
    useBrushInput(brushTarget, brushRadius);
    return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function TerrainEditorPage(): React.ReactNode {
    const [showMap, setShowMap] = useState(false);
    const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
    const handleMapDestroy = useCallback(() => setMapInstance(null), []);

    const [brushTarget, setBrushTarget] = useState<BrushTarget>({
        layer: 'terrain',
        paletteIndex: GROUND_PALETTE_INDEX,
    });
    const [brushRadius, setBrushRadius] = useState(100);

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
                    initFunction={initPaintEditor}
                >
                    {showMap && mapInstance && (
                        <MapTileLayerSync map={mapInstance} />
                    )}
                    <ScrollBarDisplay />

                    <BrushInputWiring
                        brushTarget={brushTarget}
                        brushRadius={brushRadius}
                    />

                    <PaintEditorToolbar
                        brushTarget={brushTarget}
                        onBrushTargetChange={setBrushTarget}
                        brushRadius={brushRadius}
                        onBrushRadiusChange={setBrushRadius}
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
