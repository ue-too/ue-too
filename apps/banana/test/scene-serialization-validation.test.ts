import { describe, it, expect } from 'bun:test';

import { validateSerializedSceneData } from '../src/scene-serialization';

// Minimal valid track and train data that passes validation
const VALID_TRACKS = { joints: [], segments: [] };
const VALID_TRAINS = {
    cars: [],
    formations: [],
    carStockIds: [],
    formationManagerIds: [],
    placedTrains: [],
};

function makeValid(overrides: Record<string, unknown> = {}) {
    return {
        tracks: VALID_TRACKS,
        trains: VALID_TRAINS,
        ...overrides,
    };
}

describe('validateSerializedSceneData', () => {
    describe('valid data', () => {
        it('accepts minimal valid scene data', () => {
            const result = validateSerializedSceneData(makeValid());
            expect(result.valid).toBe(true);
        });

        it('accepts scene with optional stations field', () => {
            const result = validateSerializedSceneData(
                makeValid({
                    stations: {
                        stations: [
                            {
                                id: 1,
                                name: 'Central',
                                position: { x: 0, y: 0 },
                                elevation: 0,
                                platforms: [],
                                trackSegments: [],
                                joints: [],
                            },
                        ],
                    },
                })
            );
            expect(result.valid).toBe(true);
        });

        it('accepts scene without optional fields', () => {
            const data = { tracks: VALID_TRACKS, trains: VALID_TRAINS };
            const result = validateSerializedSceneData(data);
            expect(result.valid).toBe(true);
        });

        it('accepts scene with optional time field', () => {
            const result = validateSerializedSceneData(
                makeValid({ time: Date.UTC(2026, 3, 9, 12, 0, 0) })
            );
            expect(result.valid).toBe(true);
        });

        it('accepts scene with time field set to 0', () => {
            const result = validateSerializedSceneData(makeValid({ time: 0 }));
            expect(result.valid).toBe(true);
        });
    });

    describe('invalid top-level', () => {
        it('rejects null', () => {
            const result = validateSerializedSceneData(null);
            expect(result.valid).toBe(false);
        });

        it('rejects undefined', () => {
            const result = validateSerializedSceneData(undefined);
            expect(result.valid).toBe(false);
        });

        it('rejects non-object', () => {
            const result = validateSerializedSceneData('string');
            expect(result.valid).toBe(false);
        });

        it('rejects number', () => {
            const result = validateSerializedSceneData(42);
            expect(result.valid).toBe(false);
        });
    });

    describe('invalid tracks', () => {
        it('rejects missing tracks', () => {
            const result = validateSerializedSceneData({ trains: VALID_TRAINS });
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('tracks');
            }
        });

        it('rejects null tracks', () => {
            const result = validateSerializedSceneData({
                tracks: null,
                trains: VALID_TRAINS,
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('invalid trains', () => {
        it('rejects missing trains', () => {
            const result = validateSerializedSceneData({
                tracks: VALID_TRACKS,
            });
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('trains');
            }
        });

        it('rejects null trains', () => {
            const result = validateSerializedSceneData({
                tracks: VALID_TRACKS,
                trains: null,
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('invalid stations', () => {
        it('rejects stations with non-object value', () => {
            const result = validateSerializedSceneData(
                makeValid({ stations: 'bad' })
            );
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('stations');
            }
        });

        it('rejects station missing required fields', () => {
            const result = validateSerializedSceneData(
                makeValid({
                    stations: {
                        stations: [{ id: 'not-a-number' }],
                    },
                })
            );
            expect(result.valid).toBe(false);
        });

        it('rejects station with invalid position', () => {
            const result = validateSerializedSceneData(
                makeValid({
                    stations: {
                        stations: [
                            {
                                id: 1,
                                name: 'Test',
                                position: 'bad',
                                elevation: 0,
                                platforms: [],
                                trackSegments: [],
                                joints: [],
                            },
                        ],
                    },
                })
            );
            expect(result.valid).toBe(false);
        });
    });
});
