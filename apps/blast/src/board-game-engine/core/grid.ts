/**
 * Grid System - Support for square and hexagonal grids
 * 
 * Provides components and utilities for grid-based positioning,
 * separate from zone membership (LocationComponent).
 */

import { createGlobalComponentName, ComponentName, type Entity } from '@ue-too/ecs';

/**
 * Component name for grid location components.
 * Tracks spatial position on a grid (separate from zone membership).
 */
export const GRID_LOCATION_COMPONENT = createGlobalComponentName('GridLocation');

/**
 * Grid type - determines coordinate system and neighbor calculations.
 */
export type GridType = 'square' | 'hexagonal';

/**
 * Grid location component - tracks spatial position on a grid.
 * 
 * Supports both square grids (row/column) and hexagonal grids (q/r).
 * The grid type is determined by which coordinates are set:
 * - Square: row and column are set, q and r are null
 * - Hexagonal: q and r are set, row and column are null
 * 
 * @example
 * ```typescript
 * // Square grid position
 * const squarePos: GridLocationComponent = {
 *   grid: boardGridEntity,
 *   row: 2,
 *   column: 3,
 *   q: null,
 *   r: null,
 * };
 * 
 * // Hexagonal grid position
 * const hexPos: GridLocationComponent = {
 *   grid: hexBoardEntity,
 *   row: null,
 *   column: null,
 *   q: 1,
 *   r: -2,
 * };
 * ```
 */
export interface GridLocationComponent {
  /** The grid entity this position is relative to (null if not on a grid) */
  grid: Entity | null;

  /** Square grid: row coordinate (0-based, top to bottom) */
  row: number | null;

  /** Square grid: column coordinate (0-based, left to right) */
  column: number | null;

  /** Hexagonal grid: q coordinate (axial/cube coordinate system) */
  q: number | null;

  /** Hexagonal grid: r coordinate (axial/cube coordinate system) */
  r: number | null;
}

/**
 * Get the grid type from a grid location component.
 * 
 * @param location - The grid location component
 * @returns The grid type, or null if not on a grid
 */
export function getGridType(location: GridLocationComponent): GridType | null {
  if (location.grid === null) return null;
  
  if (location.row !== null && location.column !== null) {
    return 'square';
  }
  
  if (location.q !== null && location.r !== null) {
    return 'hexagonal';
  }
  
  return null;
}

/**
 * Get neighbors of a square grid position.
 * 
 * @param row - Row coordinate
 * @param column - Column coordinate
 * @param includeDiagonals - Whether to include diagonal neighbors (default: false)
 * @returns Array of {row, column} neighbor positions
 */
export function getSquareNeighbors(
  row: number,
  column: number,
  includeDiagonals: boolean = false
): Array<{ row: number; column: number }> {
  const neighbors: Array<{ row: number; column: number }> = [
    { row: row - 1, column },     // Up
    { row: row + 1, column },     // Down
    { row, column: column - 1 }, // Left
    { row, column: column + 1 }, // Right
  ];

  if (includeDiagonals) {
    neighbors.push(
      { row: row - 1, column: column - 1 }, // Up-Left
      { row: row - 1, column: column + 1 }, // Up-Right
      { row: row + 1, column: column - 1 }, // Down-Left
      { row: row + 1, column: column + 1 }  // Down-Right
    );
  }

  return neighbors;
}

/**
 * Get neighbors of a hexagonal grid position.
 * 
 * Hexagonal grids have 6 neighbors in axial coordinates.
 * 
 * @param q - Q coordinate
 * @param r - R coordinate
 * @returns Array of {q, r} neighbor positions
 */
export function getHexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  // Hex neighbors in axial coordinate system
  return [
    { q: q + 1, r },      // East
    { q: q + 1, r: r - 1 }, // Northeast
    { q, r: r - 1 },      // Northwest
    { q: q - 1, r },      // West
    { q: q - 1, r: r + 1 }, // Southwest
    { q, r: r + 1 },      // Southeast
  ];
}

/**
 * Calculate distance between two square grid positions.
 * 
 * @param row1 - Row of first position
 * @param column1 - Column of first position
 * @param row2 - Row of second position
 * @param column2 - Column of second position
 * @returns Manhattan distance (or Euclidean if diagonal movement allowed)
 */
export function getSquareDistance(
  row1: number,
  column1: number,
  row2: number,
  column2: number,
  allowDiagonal: boolean = false
): number {
  const rowDiff = Math.abs(row2 - row1);
  const columnDiff = Math.abs(column2 - column1);

  if (allowDiagonal) {
    // Euclidean distance
    return Math.sqrt(rowDiff * rowDiff + columnDiff * columnDiff);
  } else {
    // Manhattan distance
    return rowDiff + columnDiff;
  }
}

/**
 * Calculate distance between two hexagonal grid positions.
 * 
 * Uses the cube coordinate system for distance calculation.
 * 
 * @param q1 - Q coordinate of first position
 * @param r1 - R coordinate of first position
 * @param q2 - Q coordinate of second position
 * @param r2 - R coordinate of second position
 * @returns Hexagonal distance (number of hexes between positions)
 */
export function getHexDistance(
  q1: number,
  r1: number,
  q2: number,
  r2: number
): number {
  // Convert axial to cube coordinates
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  
  // Distance in cube coordinates
  return (Math.abs(q2 - q1) + Math.abs(r2 - r1) + Math.abs(s2 - s1)) / 2;
}

/**
 * Convert hexagonal axial coordinates (q, r) to cube coordinates (q, r, s).
 * 
 * @param q - Q coordinate
 * @param r - R coordinate
 * @returns Cube coordinates {q, r, s}
 */
export function hexAxialToCube(q: number, r: number): { q: number; r: number; s: number } {
  return { q, r, s: -q - r };
}

/**
 * Convert hexagonal cube coordinates (q, r, s) to axial coordinates (q, r).
 * 
 * @param q - Q coordinate
 * @param r - R coordinate
 * @param s - S coordinate
 * @returns Axial coordinates {q, r}
 */
export function hexCubeToAxial(q: number, r: number, s: number): { q: number; r: number } {
  return { q, r };
}
