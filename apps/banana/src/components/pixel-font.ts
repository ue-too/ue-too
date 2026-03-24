import { CJK_GLYPHS } from './pixel-font-cjk.generated';
import { LATIN_GLYPHS } from './pixel-font-latin.generated';

/**
 * Bitmap font for LED dot-matrix rendering (`#` = lit, `.` = unlit).
 *
 * Latin / ASCII: see `pixel-font-latin.generated.ts` — regenerate with
 * `bun run scripts/extract-sfd-bitmaps-latin.ts` (Cubic 11 SFD).
 *
 * CJK: see `pixel-font-cjk.generated.ts` — regenerate with
 * `bun run scripts/extract-sfd-bitmaps.ts`.
 */
const GLYPHS: Record<string, string[]> = {
    ...LATIN_GLYPHS,
    ...CJK_GLYPHS,
};

/**
 * Converts a string into a boolean grid using the built-in pixel font.
 * Handles mixed glyph heights by padding shorter glyphs vertically.
 * Each character is separated by 1 column of spacing.
 *
 * @param text - Raw string to render (unknown characters are skipped).
 * @returns Rows of lit (`true`) / unlit (`false`) cells.
 */
export function pixelFontToGrid(text: string): boolean[][] {
    const charGrids: boolean[][][] = [];

    for (const ch of text) {
        const glyph = GLYPHS[ch];
        if (!glyph) continue;
        const rows = glyph.length;
        const cols = glyph[0].length;
        const grid: boolean[][] = [];
        for (let r = 0; r < rows; r++) {
            const row: boolean[] = [];
            for (let c = 0; c < cols; c++) {
                row.push(glyph[r][c] === '#');
            }
            grid.push(row);
        }
        charGrids.push(grid);
    }

    if (charGrids.length === 0) return [];

    const totalRows = Math.max(...charGrids.map((g) => g.length));

    const result: boolean[][] = [];
    for (let r = 0; r < totalRows; r++) {
        const row: boolean[] = [];
        for (let gi = 0; gi < charGrids.length; gi++) {
            if (gi > 0) row.push(false);
            const g = charGrids[gi];
            const cols = g[0].length;
            const offsetY = Math.floor((totalRows - g.length) / 2);
            const gr = r - offsetY;
            for (let c = 0; c < cols; c++) {
                row.push(gr >= 0 && gr < g.length && g[gr][c]);
            }
        }
        result.push(row);
    }

    return result;
}
