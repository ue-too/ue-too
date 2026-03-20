export { TerrainData, validateSerializedTerrainData } from './terrain-data';
export type { TerrainConfig, SerializedTerrainData } from './terrain-data';
export { TerrainRenderSystem } from './terrain-render-system';
export { sampleColorRamp, sampleWaterColor, WATER_COLOR_STOPS, hillshade, computeNormal } from './terrain-colors';
export { extractContourSegments } from './contour';
export type { ContourPoint, ContourSegment } from './contour';
export { floodBelow, traceRiver, fillDepression, generateWater, createHillyWithWater } from './terrain-water';
export { applyBrush } from './terrain-brush';
export type { BrushMode, BrushParams, DirtyRegion } from './terrain-brush';
