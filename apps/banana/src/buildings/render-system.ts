import { Graphics } from 'pixi.js';
import type { Point } from '@ue-too/math';
import { ELEVATION, ELEVATION_VALUES } from '@/trains/tracks/types';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';
import { WorldRenderSystem } from '@/world-render-system';
import type { BuildingData } from './types';
import { BuildingManager } from './building-manager';

const GROUND_BAND_INDEX = ELEVATION_VALUES.indexOf(ELEVATION.GROUND as number);

const ROOF_COLOR = 0x9B8365;
const BUILDING_BORDER = 0x3A2A15;

type BuildingShadowRecord = {
  bodyGraphics: Graphics;
  shadowGraphics: Graphics;
  data: BuildingData;
};

/**
 * Renders buildings and their shadows through the WorldRenderSystem.
 *
 * Shadows are drawn as the full 3D silhouette of the extruded building
 * (base + connecting sides + projected roof) and are redrawn when the
 * sun angle or building height changes.
 *
 * @group Building System
 */
export class BuildingRenderSystem {

  private _worldRenderSystem: WorldRenderSystem;
  private _buildingManager: BuildingManager;
  private _records: Map<number, BuildingShadowRecord> = new Map();
  private _sunAngle: number = 135;
  private _baseShadowLength: number = 10;
  private _abortController: AbortController = new AbortController();

  constructor(worldRenderSystem: WorldRenderSystem, buildingManager: BuildingManager) {
    this._worldRenderSystem = worldRenderSystem;
    this._buildingManager = buildingManager;

    buildingManager.onAdd(this._onAdd.bind(this), { signal: this._abortController.signal });
    buildingManager.onDelete(this._onDelete.bind(this), { signal: this._abortController.signal });
    buildingManager.onUpdate(this._onUpdate.bind(this), { signal: this._abortController.signal });
  }

  get sunAngle(): number {
    return this._sunAngle;
  }

  set sunAngle(angle: number) {
    if (this._sunAngle === angle) return;
    this._sunAngle = angle;
    this._updateAll();
  }

  cleanup(): void {
    this._abortController.abort();
    for (const [id, record] of this._records) {
      const key = buildingKey(id);
      const body = this._worldRenderSystem.removeDrawable(key);
      body?.destroy({ children: true });
      this._worldRenderSystem.removeShadow(key);
    }
    this._records.clear();
  }

  private _onAdd(id: number, data: BuildingData): void {
    const key = buildingKey(id);
    const elevationValue = data.elevation as number;

    const bodyGraphics = new Graphics();
    drawBuilding(bodyGraphics, data.vertices);

    const shadowGraphics = new Graphics();
    drawBuildingShadow(shadowGraphics, data.vertices, elevationValue, data.height, this._sunAngle, this._baseShadowLength);

    this._records.set(id, { bodyGraphics, shadowGraphics, data });

    const elevationLevel = this._worldRenderSystem.resolveElevationLevel(
      elevationValue * LEVEL_HEIGHT,
    );

    this._worldRenderSystem.addShadow(key, shadowGraphics, elevationLevel);
    this._worldRenderSystem.addDrawable(key, bodyGraphics);

    const zIndex = rooftopZIndex(elevationValue, data.height);
    this._worldRenderSystem.setDrawableZIndex(key, zIndex);
    this._worldRenderSystem.sortChildren();
  }

  private _onUpdate(id: number, data: BuildingData): void {
    const record = this._records.get(id);
    if (record === undefined) return;

    record.data = data;

    record.shadowGraphics.clear();
    drawBuildingShadow(record.shadowGraphics, data.vertices, data.elevation as number, data.height, this._sunAngle, this._baseShadowLength);

    record.bodyGraphics.clear();
    drawBuilding(record.bodyGraphics, data.vertices);

    const key = buildingKey(id);
    const zIndex = rooftopZIndex(data.elevation as number, data.height);
    this._worldRenderSystem.setDrawableZIndex(key, zIndex);
    this._worldRenderSystem.sortChildren();
  }

  private _onDelete(id: number): void {
    const key = buildingKey(id);
    const record = this._records.get(id);
    if (record === undefined) return;

    const body = this._worldRenderSystem.removeDrawable(key);
    body?.destroy({ children: true });
    this._worldRenderSystem.removeShadow(key);
    this._records.delete(id);
  }

  /** Redraw all shadows for the current sun angle. */
  private _updateAll(): void {
    for (const [, record] of this._records) {
      record.shadowGraphics.clear();
      drawBuildingShadow(record.shadowGraphics, record.data.vertices, record.data.elevation as number, record.data.height, this._sunAngle, this._baseShadowLength);
    }
  }
}

/** Stable key for WorldRenderSystem keyed maps. */
const buildingKey = (id: number): string => `__building__${id}`;

/**
 * Compute z-index for a building's rooftop based on its total height
 * (base elevation + building height in levels).
 *
 * Uses the same LAYERS_PER_ELEVATION spacing as WorldRenderSystem
 * so a building with roof at level N sorts above all drawables at
 * elevation N-1, even when N exceeds the ELEVATION enum range.
 */
const LAYERS_PER_ELEVATION = 1000;
const rooftopZIndex = (elevation: number, height: number): number => {
  const roofBandIndex = Math.ceil(elevation + height) + GROUND_BAND_INDEX;
  return roofBandIndex * LAYERS_PER_ELEVATION + 1;
};

/** Trace a closed polygon path on a Graphics object (does not fill/stroke). */
const drawPolygon = (graphics: Graphics, vertices: Point[]): void => {
  if (vertices.length === 0) return;
  graphics.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    graphics.lineTo(vertices[i].x, vertices[i].y);
  }
  graphics.closePath();
};

/**
 * Draw the full 3D shadow silhouette of an extruded building.
 *
 * The shadow is the union of:
 * 1. The base footprint polygon
 * 2. Connecting quads from each base edge to the corresponding projected edge
 * 3. The roof footprint projected onto the ground along the sun direction
 *
 * All pieces are filled black; overlapping fills produce the correct outline.
 */
const drawBuildingShadow = (
  graphics: Graphics,
  baseVertices: Point[],
  elevation: number,
  height: number,
  sunAngle: number,
  baseShadowLength: number,
): void => {
  if (height <= 0) return;

  const roofWorldHeight = (elevation + height) * LEVEL_HEIGHT;
  const shadowLen = baseShadowLength * (roofWorldHeight / 100);
  const rad = (sunAngle * Math.PI) / 180;
  const offsetX = Math.cos(rad) * shadowLen;
  const offsetY = Math.sin(rad) * shadowLen;

  const projectedVertices: Point[] = baseVertices.map(v => ({
    x: v.x + offsetX,
    y: v.y + offsetY,
  }));

  drawPolygon(graphics, baseVertices);
  graphics.fill({ color: 0x000000 });

  const n = baseVertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    graphics.moveTo(baseVertices[i].x, baseVertices[i].y);
    graphics.lineTo(baseVertices[j].x, baseVertices[j].y);
    graphics.lineTo(projectedVertices[j].x, projectedVertices[j].y);
    graphics.lineTo(projectedVertices[i].x, projectedVertices[i].y);
    graphics.closePath();
    graphics.fill({ color: 0x000000 });
  }

  drawPolygon(graphics, projectedVertices);
  graphics.fill({ color: 0x000000 });
};

/** Draw a top-down building: just the footprint filled and outlined. */
const drawBuilding = (
  graphics: Graphics,
  baseVertices: Point[],
): void => {
  drawPolygon(graphics, baseVertices);
  graphics.fill({ color: ROOF_COLOR });
  drawPolygon(graphics, baseVertices);
  graphics.stroke({ color: BUILDING_BORDER, pixelLine: true });
};
