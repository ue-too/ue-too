/**
 * Shared SFD parsing + rasterization for Cubic 11 glyph extraction.
 * Used by extract-sfd-bitmaps.ts (CJK) and extract-sfd-bitmaps-latin.ts (ASCII + extras).
 */

import { resolve } from 'path';

export const ROOT = resolve(import.meta.dir, '..');

export const SFD_PATH = resolve(
    ROOT,
    'fonts/cubic/source/Cubic_11_1.451_R.sfd'
);

export const UNIT = 100;

// ---------------------------------------------------------------------------
// Parse SFD glyphs
// ---------------------------------------------------------------------------

export function parseGlyph(
    sfdContent: string,
    charCode: number
): { width: number; splines: number[][][] } | null {
    const encoding = `Encoding: ${charCode} ${charCode}`;
    const idx = sfdContent.indexOf(encoding);
    if (idx === -1) return null;

    const widthMatch = sfdContent
        .substring(idx - 200, idx + 500)
        .match(/Width: (\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 1200;

    const splineStart = sfdContent.indexOf('SplineSet', idx);
    const splineEnd = sfdContent.indexOf('EndSplineSet', splineStart);
    if (splineStart === -1 || splineEnd === -1) return null;

    const splineBlock = sfdContent.substring(splineStart + 10, splineEnd);
    const lines = splineBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const contours: number[][][] = [];
    let currentContour: number[][] = [];

    for (const line of lines) {
        const moveMatch = line.match(/^(-?\d+)\s+(-?\d+)\s+m\b/);
        const lineMatch = line.match(/^(-?\d+)\s+(-?\d+)\s+l\b/);

        if (moveMatch) {
            if (currentContour.length > 0) {
                contours.push(currentContour);
            }
            currentContour = [
                [parseInt(moveMatch[1]), parseInt(moveMatch[2])],
            ];
        } else if (lineMatch) {
            currentContour.push([
                parseInt(lineMatch[1]),
                parseInt(lineMatch[2]),
            ]);
        }
    }
    if (currentContour.length > 0) {
        contours.push(currentContour);
    }

    return { width, splines: contours };
}

// ---------------------------------------------------------------------------
// Rasterize via ray casting
// ---------------------------------------------------------------------------

export function rasterize(
    contours: number[][][],
    width: number
): boolean[][] {
    const minY = -200;
    const maxY = 900;
    const cols = Math.ceil(width / UNIT);
    const rows = (maxY - minY) / UNIT + 1;

    const grid: boolean[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(false)
    );

    for (let row = 0; row < rows; row++) {
        const py = maxY - row * UNIT + UNIT / 2;

        for (let col = 0; col < cols; col++) {
            const px = col * UNIT + UNIT / 2;

            let inside = false;
            for (const contour of contours) {
                const n = contour.length;
                for (let i = 0; i < n; i++) {
                    const [x1, y1] = contour[i];
                    const [x2, y2] = contour[(i + 1) % n];

                    if (
                        (y1 > py) !== (y2 > py) &&
                        px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1
                    ) {
                        inside = !inside;
                    }
                }
            }

            grid[row][col] = inside;
        }
    }

    return grid;
}

export function trimGrid(grid: boolean[][]): string[] {
    let firstRow = 0;
    while (firstRow < grid.length && grid[firstRow].every((v) => !v))
        firstRow++;
    let lastRow = grid.length - 1;
    while (lastRow > firstRow && grid[lastRow].every((v) => !v))
        lastRow--;

    const trimmedRows = grid.slice(firstRow, lastRow + 1);
    if (trimmedRows.length === 0) return [];

    let firstCol = trimmedRows[0].length;
    let lastCol = 0;
    for (const row of trimmedRows) {
        for (let c = 0; c < row.length; c++) {
            if (row[c]) {
                firstCol = Math.min(firstCol, c);
                lastCol = Math.max(lastCol, c);
            }
        }
    }

    return trimmedRows.map((row) =>
        row
            .slice(firstCol, lastCol + 1)
            .map((v) => (v ? '#' : '.'))
            .join('')
    );
}

export function extractGlyphLines(
    sfdContent: string,
    charCode: number
): string[] | null {
    const glyph = parseGlyph(sfdContent, charCode);
    if (!glyph) return null;
    const grid = rasterize(glyph.splines, glyph.width);
    const lines = trimGrid(grid);
    return lines.length > 0 ? lines : null;
}
