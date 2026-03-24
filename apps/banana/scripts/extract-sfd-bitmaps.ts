/**
 * Scans translation files for CJK characters, extracts their bitmap
 * glyphs from the Cubic 11 SFD file, and writes a generated TypeScript
 * module that pixel-font.ts can import.
 *
 * Usage: bun run scripts/extract-sfd-bitmaps.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import {
    ROOT,
    SFD_PATH,
    extractGlyphLines,
} from './sfd-bitmap-core';

const LOCALES_DIR = resolve(ROOT, 'src/i18n/locales');
const OUTPUT_PATH = resolve(ROOT, 'src/components/pixel-font-cjk.generated.ts');

// ---------------------------------------------------------------------------
// Collect all CJK characters from translation files
// ---------------------------------------------------------------------------

function collectCJKChars(): Set<string> {
    const chars = new Set<string>();
    const localeFiles = ['zh-TW.ts', 'ja.ts'];

    for (const file of localeFiles) {
        const content = readFileSync(resolve(LOCALES_DIR, file), 'utf-8');
        for (const ch of content) {
            const code = ch.codePointAt(0)!;
            if (
                (code >= 0x4e00 && code <= 0x9fff) ||
                (code >= 0x3400 && code <= 0x4dbf) ||
                (code >= 0xf900 && code <= 0xfaff) ||
                (code >= 0x3000 && code <= 0x303f) ||
                (code >= 0xff00 && code <= 0xffef) ||
                (code >= 0x2e80 && code <= 0x2eff) ||
                (code >= 0x31c0 && code <= 0x31ef) ||
                (code >= 0x3100 && code <= 0x312f) ||
                (code >= 0x3040 && code <= 0x309f) ||
                (code >= 0x30a0 && code <= 0x30ff)
            ) {
                chars.add(ch);
            }
        }
    }

    return chars;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(SFD_PATH)) {
    console.error(
        `Missing Cubic 11 SFD:\n  ${SFD_PATH}\n` +
            'Download it from https://github.com/ACh-K/Cubic-11/releases — see fonts/README.md'
    );
    process.exit(1);
}

const chars = collectCJKChars();
console.log(`Found ${chars.size} unique CJK characters in translations`);

const sfd = readFileSync(SFD_PATH, 'utf-8');

const glyphs: Map<string, string[]> = new Map();
let missing = 0;

for (const char of chars) {
    const code = char.codePointAt(0)!;
    const lines = extractGlyphLines(sfd, code);
    if (!lines) {
        console.warn(
            `  Warning: ${char} (U+${code.toString(16).toUpperCase()}) not found in SFD`
        );
        missing++;
        continue;
    }

    glyphs.set(char, lines);
}

console.log(`Extracted ${glyphs.size} glyphs (${missing} missing)`);

const entries: string[] = [];
for (const [char, lines] of glyphs) {
    const linesStr = lines.map((l) => `        '${l}',`).join('\n');
    entries.push(`    ${JSON.stringify(char)}: [\n${linesStr}\n    ],`);
}

const output = `/**
 * Auto-generated CJK pixel font glyphs extracted from Cubic 11 SFD.
 * DO NOT EDIT — regenerate with: bun run scripts/extract-sfd-bitmaps.ts
 */
export const CJK_GLYPHS: Record<string, string[]> = {
${entries.join('\n')}
};
`;

writeFileSync(OUTPUT_PATH, output);
console.log(`Wrote ${OUTPUT_PATH}`);
