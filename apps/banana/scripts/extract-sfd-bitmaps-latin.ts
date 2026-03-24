/**
 * Collects Latin / ASCII (and a few UI symbols) needed for the LED marquee,
 * extracts glyphs from the Cubic 11 SFD file using the same rasterization
 * pipeline as CJK extraction, and writes pixel-font-latin.generated.ts.
 *
 * Usage: bun run scripts/extract-sfd-bitmaps-latin.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { ROOT, SFD_PATH, extractGlyphLines } from './sfd-bitmap-core';

const LOCALES_DIR = resolve(ROOT, 'src/i18n/locales');
const OUTPUT_PATH = resolve(ROOT, 'src/components/pixel-font-latin.generated.ts');

/** Printable ASCII: space (0x20) through tilde (0x7E). */
function printableAsciiChars(): Set<string> {
    const set = new Set<string>();
    for (let c = 0x20; c <= 0x7e; c++) {
        set.add(String.fromCodePoint(c));
    }
    return set;
}

/**
 * Characters from locale files in the Basic Latin range (helps catch any
 * punctuation used only in copy).
 */
function collectLatinCharsFromLocales(): Set<string> {
    const out = new Set<string>();
    const files = ['en.ts', 'ja.ts', 'zh-TW.ts'];
    for (const file of files) {
        const content = readFileSync(resolve(LOCALES_DIR, file), 'utf-8');
        for (const ch of content) {
            const code = ch.codePointAt(0)!;
            if (code >= 0x20 && code <= 0x7e) {
                out.add(ch);
            }
        }
    }
    return out;
}

/**
 * Symbols used in TSX / UI alongside translations (e.g. arrow appended in code).
 * Add more code points here if the marquee shows a missing glyph after extraction.
 */
const EXTRA_UNICODE: readonly string[] = ['→'];

function collectLatinTargetChars(): Set<string> {
    const chars = printableAsciiChars();
    for (const ch of collectLatinCharsFromLocales()) {
        chars.add(ch);
    }
    for (const ch of EXTRA_UNICODE) {
        chars.add(ch);
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

const chars = collectLatinTargetChars();
console.log(
    `Extracting ${chars.size} Latin / ASCII / extra code points from Cubic 11 SFD`
);

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

const entries = [...glyphs.entries()].sort(([a], [b]) =>
    compareGlyphKeys(a, b)
);

const body = entries
    .map(([char, lines]) => {
        const linesStr = lines.map((l) => `        '${l}',`).join('\n');
        return `    ${JSON.stringify(char)}: [\n${linesStr}\n    ],`;
    })
    .join('\n');

const output = `/**
 * Auto-generated Latin / ASCII pixel font glyphs extracted from Cubic 11 SFD.
 * DO NOT EDIT — regenerate with: bun run scripts/extract-sfd-bitmaps-latin.ts
 *
 * Includes all printable ASCII (U+0020–U+007E), characters found in locale files
 * in that range, and extra symbols listed in scripts/extract-sfd-bitmaps-latin.ts.
 */
export const LATIN_GLYPHS: Record<string, string[]> = {
${body}
};
`;

writeFileSync(OUTPUT_PATH, output);
console.log(`Wrote ${OUTPUT_PATH}`);

/** Sort by Unicode code point. */
function compareGlyphKeys(a: string, b: string): number {
    const ca = a.codePointAt(0)!;
    const cb = b.codePointAt(0)!;
    return ca - cb;
}
