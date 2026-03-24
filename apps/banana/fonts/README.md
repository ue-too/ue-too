# Fonts

## Cubic 11 — LED marquee glyphs

The LED dot-matrix marquee on the landing page uses a built-in pixel font: Latin / ASCII / symbols come from **`pixel-font-latin.generated.ts`**, and CJK (plus hiragana and katakana used in locales) from **`pixel-font-cjk.generated.ts`**. Both can be regenerated from the same **Cubic 11** FontForge **SFD** using the same rasterization idea: parse outlines, ray-cast to a coarse grid, trim to the glyph bounding box.

### Required file (not tracked by git)

The SFD source file is required to run the extraction scripts but is not tracked by git due to its size (~29MB):

```
fonts/cubic/source/Cubic_11_1.451_R.sfd
```

Download it from the [Cubic 11 releases](https://github.com/ACh-K/Cubic-11/releases) and place it at the path above.

### Latin / ASCII (`pixel-font-latin.generated.ts`)

1. **Script:** `scripts/extract-sfd-bitmaps-latin.ts`
2. **Character set:** All printable ASCII (U+0020–U+007E), any Basic Latin characters that appear in `src/i18n/locales/*.ts`, plus extra symbols used beside locale strings (see `EXTRA_UNICODE` in that script — e.g. `→`).
3. **Output:** Overwrites `src/components/pixel-font-latin.generated.ts` with `LATIN_GLYPHS`.
4. **Run:**

```bash
bun run scripts/extract-sfd-bitmaps-latin.ts
```

The repo may ship hand-tuned 5×7 bitmaps in that file until you run the script locally; after extraction, glyphs match Cubic 11’s outlines at the same grid scale as the CJK pipeline.

### CJK (`pixel-font-cjk.generated.ts`)

1. **Script:** `scripts/extract-sfd-bitmaps.ts`
2. **Character set:** CJK, kana, and related ranges found in `zh-TW.ts` and `ja.ts` (see the script for Unicode ranges).
3. **Output:** Overwrites `src/components/pixel-font-cjk.generated.ts` with `CJK_GLYPHS`.
4. **Run:**

```bash
bun run scripts/extract-sfd-bitmaps.ts
```

Run this whenever translations change so new CJK code points are included.

### Shared implementation

Both scripts use **`scripts/sfd-bitmap-core.ts`** for SFD parsing, rasterization, and trimming — parallel to the old inline logic in `extract-sfd-bitmaps.ts`.

### License

Cubic 11 is licensed under the SIL Open Font License 1.1. See `cubic/OFL.txt` for details.
