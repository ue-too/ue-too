# Fonts

## Cubic 11 — CJK Pixel Font

The LED dot-matrix marquee on the landing page uses a built-in pixel font for rendering text. Latin characters (A–Z, a–z, 0–9, punctuation) are hand-crafted 5×7 bitmaps defined in `src/components/pixel-font.ts`. CJK characters (Chinese, Japanese) are extracted from the **Cubic 11** bitmap font at build time.

### How CJK glyph generation works

1. The script `scripts/extract-sfd-bitmaps.ts` scans translation files (`src/i18n/locales/*.ts`) for CJK, hiragana, and katakana characters.
2. It parses the Cubic 11 SFD (FontForge Spline Font Database) file to extract vector outlines for each character.
3. Each glyph is rasterized to a bitmap grid via ray casting on the font's 100-unit coordinate system.
4. The result is written to `src/components/pixel-font-cjk.generated.ts`, which `pixel-font.ts` imports.

### Required file (not tracked by git)

The SFD source file is required to run the extraction script but is not tracked by git due to its size (~29MB):

```
fonts/cubic/source/Cubic_11_1.451_R.sfd
```

Download it from the [Cubic 11 releases](https://github.com/ACh-K/Cubic-11/releases) and place it at the path above.

### Running the extraction

```bash
bun run scripts/extract-sfd-bitmaps.ts
```

This regenerates `src/components/pixel-font-cjk.generated.ts`. Run it whenever translations change to pick up new CJK characters.

### License

Cubic 11 is licensed under the SIL Open Font License 1.1. See `cubic/OFL.txt` for details.
