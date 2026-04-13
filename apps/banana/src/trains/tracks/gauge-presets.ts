/** A named track gauge preset with width in meters. */
export type TrackGaugePreset = {
    id: string;
    name: string;
    width: number;
    description: string;
};

/** Built-in gauge presets. */
export const GAUGE_PRESETS: readonly TrackGaugePreset[] = [
    {
        id: 'narrow-cape',
        name: 'Narrow (Cape)',
        width: 1.067,
        description: 'Japan, South Africa, Australia',
    },
    {
        id: 'meter',
        name: 'Meter',
        width: 1.0,
        description: 'Southeast Asia, South America',
    },
    {
        id: 'standard',
        name: 'Standard',
        width: 1.435,
        description: 'Europe, China, North America',
    },
    {
        id: 'russian',
        name: 'Russian',
        width: 1.52,
        description: 'Russia, Finland',
    },
    {
        id: 'broad-indian',
        name: 'Broad (Indian)',
        width: 1.676,
        description: 'India, Argentina',
    },
] as const;

/** Default gauge preset (narrow cape, 1.067m). */
export const DEFAULT_GAUGE_PRESET: TrackGaugePreset = GAUGE_PRESETS[0];

/** Epsilon for floating-point gauge comparison. */
const WIDTH_EPSILON = 1e-6;

/** Find a preset by its gauge width. Returns null for custom (non-preset) widths. */
export function findPresetByWidth(width: number): TrackGaugePreset | null {
    return (
        GAUGE_PRESETS.find((p) => Math.abs(p.width - width) < WIDTH_EPSILON) ??
        null
    );
}
