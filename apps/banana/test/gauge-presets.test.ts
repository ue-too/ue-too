import { describe, expect, it } from 'bun:test';

import {
    GAUGE_PRESETS,
    DEFAULT_GAUGE_PRESET,
    findPresetByWidth,
} from '../src/trains/tracks/gauge-presets';

describe('GAUGE_PRESETS', () => {
    it('contains 5 built-in presets', () => {
        expect(GAUGE_PRESETS.length).toBe(5);
    });

    it('has unique ids', () => {
        const ids = GAUGE_PRESETS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('has unique widths', () => {
        const widths = GAUGE_PRESETS.map((p) => p.width);
        expect(new Set(widths).size).toBe(widths.length);
    });

    it('all widths are positive', () => {
        for (const preset of GAUGE_PRESETS) {
            expect(preset.width).toBeGreaterThan(0);
        }
    });
});

describe('DEFAULT_GAUGE_PRESET', () => {
    it('is narrow-cape (1.067m)', () => {
        expect(DEFAULT_GAUGE_PRESET.id).toBe('narrow-cape');
        expect(DEFAULT_GAUGE_PRESET.width).toBe(1.067);
    });
});

describe('findPresetByWidth', () => {
    it('finds narrow-cape by exact width', () => {
        const preset = findPresetByWidth(1.067);
        expect(preset).not.toBeNull();
        expect(preset!.id).toBe('narrow-cape');
    });

    it('finds standard by exact width', () => {
        const preset = findPresetByWidth(1.435);
        expect(preset).not.toBeNull();
        expect(preset!.id).toBe('standard');
    });

    it('returns null for non-preset width', () => {
        expect(findPresetByWidth(1.2)).toBeNull();
    });

    it('handles floating point near-match', () => {
        const preset = findPresetByWidth(1.067 + 1e-10);
        expect(preset).not.toBeNull();
        expect(preset!.id).toBe('narrow-cape');
    });

    it('does not match values outside epsilon', () => {
        expect(findPresetByWidth(1.07)).toBeNull();
    });
});
