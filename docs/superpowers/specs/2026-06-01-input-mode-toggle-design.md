# Input-Mode Toggle API on `Board`

**Date:** 2026-06-01
**Package:** `board`
**Branch:** `feat/switch-between-kmt-trackpad`

## Problem

The `Board` class can lock its input modality via `setInputMode('kmt' | 'trackpad')`
(`packages/board/src/boardify/index.ts:932`), but there is no convenient way to:

- read the current mode (no getter), so UI cannot reflect or drive a toggle button;
- flip between keyboard-mouse and trackpad without the caller tracking current state;
- return to auto-detection after a manual lock (the tracker supports it via the
  unexposed `enableInputModeDetection()`).

The mode is tri-state: `'kmt'` (keyboard-mouse), `'trackpad'`, and `'TBD'`
(auto-detecting, not yet committed).

## Goal

Add a small, convenient public API on `Board` for toggling and inspecting input
mode, plus a path back to auto-detection. Binary toggle with a separate auto
method — not a 3-way cycle.

## Design

All changes are confined to the `Board` class in
`packages/board/src/boardify/index.ts`. No state-machine or interface changes:
`_observableInputTracker` is typed as the concrete `ObservableInputTracker`
(`index.ts:213`), which already exposes `mode`, `setMode`, and
`enableInputModeDetection`.

### 1. `get inputMode(): 'kmt' | 'trackpad' | 'TBD'`

Returns `this._observableInputTracker.mode`. Lets UI reflect current state.
`'TBD'` means auto-detection is active and has not committed to a mode.

### 2. `toggleInputMode(): void`

Flips between the two concrete modes and locks it (via the existing `setMode`,
which sets `_deciding = false`, disabling auto-detection):

- current `'kmt'` → `setMode('trackpad')`
- current `'trackpad'` or `'TBD'` → `setMode('kmt')`

The `'TBD' → 'kmt'` choice is deliberate: in the scroll handler, `'TBD'` already
behaves like trackpad (`mode === 'kmt' ? scrollZoom : scrollPan`), so the natural
"other" state to toggle into is `'kmt'`.

### 3. `enableAutoInputMode(): void`

Calls `this._observableInputTracker.enableInputModeDetection()` (already
implemented at `kmt-input-context.ts:717`: resets `_deciding = true` and score to
0). Returns the board to auto-detection after a manual lock.

## Out of scope

- Wiring up the commented-out auto-detect threshold
  (`kmt-input-context.ts:733,744`). Auto mode stays as-is: it tracks score but
  never commits on its own. That is separate detection behavior and not requested.
- Any change to `VanillaKMTEventParser` / `VanillaTouchEventParser`.

## Testing

Unit tests on `Board`:

- `inputMode` reflects `setInputMode('kmt')` and `setInputMode('trackpad')`.
- `toggleInputMode` from `'kmt'` → `'trackpad'`.
- `toggleInputMode` from `'trackpad'` → `'kmt'`.
- `toggleInputMode` from `'TBD'` (initial state) → `'kmt'`.
- `enableAutoInputMode` returns `inputMode` to `'TBD'` after a manual lock.
